import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';

interface FileInfo {
  path: string;
  relativePath: string;
  language: string;
  size: number;
  symbols: SymbolInfo[];
  imports: string[];
  exports: string[];
}

interface SymbolInfo {
  name: string;
  kind: SymbolKind;
  line: number;
  signature?: string;
  children?: SymbolInfo[];
}

type SymbolKind = 
  | 'class' 
  | 'interface' 
  | 'function' 
  | 'method' 
  | 'property' 
  | 'variable' 
  | 'type' 
  | 'enum'
  | 'namespace';

interface RepoMap {
  rootDir: string;
  files: FileInfo[];
  summary: string;
  generatedAt: Date;
  stats: RepoStats;
}

interface RepoStats {
  totalFiles: number;
  totalLines: number;
  totalSymbols: number;
  byLanguage: Record<string, number>;
  byKind: Record<string, number>;
}

interface RepoMapOptions {
  includePatterns?: string[];
  excludePatterns?: string[];
  maxFileSize?: number;
  maxDepth?: number;
}

const DEFAULT_INCLUDE = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.py', '**/*.go', '**/*.rs'];
const DEFAULT_EXCLUDE = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/coverage/**'];

const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.rb': 'ruby',
  '.php': 'php',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp'
};

export class RepoMapService extends EventEmitter {
  private static instance: RepoMapService;
  private cache: Map<string, RepoMap> = new Map();
  private cacheExpiry = 5 * 60 * 1000;

  private constructor() {
    super();
  }

  public static getInstance(): RepoMapService {
    if (!RepoMapService.instance) {
      RepoMapService.instance = new RepoMapService();
    }
    return RepoMapService.instance;
  }

  async generateRepoMap(rootDir: string, options: RepoMapOptions = {}): Promise<RepoMap> {
    const cacheKey = `${rootDir}:${JSON.stringify(options)}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.generatedAt.getTime() < this.cacheExpiry) {
      return cached;
    }

    const files = await this.collectFiles(rootDir, options);
    const analyzedFiles = await Promise.all(
      files.map(f => this.analyzeFile(f, rootDir))
    );

    const validFiles = analyzedFiles.filter((f): f is FileInfo => f !== null);
    const stats = this.calculateStats(validFiles);
    const summary = this.generateSummary(validFiles, stats);

    const repoMap: RepoMap = {
      rootDir,
      files: validFiles,
      summary,
      generatedAt: new Date(),
      stats
    };

    this.cache.set(cacheKey, repoMap);
    this.emit('repomap:generated', { rootDir, fileCount: validFiles.length });

    return repoMap;
  }

  private async collectFiles(rootDir: string, options: RepoMapOptions): Promise<string[]> {
    const includePatterns = options.includePatterns || DEFAULT_INCLUDE;
    const excludePatterns = options.excludePatterns || DEFAULT_EXCLUDE;
    const maxDepth = options.maxDepth || 10;
    const maxFileSize = options.maxFileSize || 1024 * 1024;

    const files: string[] = [];

    const walk = async (dir: string, depth: number) => {
      if (depth > maxDepth) return;

      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(rootDir, fullPath);

          if (this.matchesAny(relativePath, excludePatterns)) continue;

          if (entry.isDirectory()) {
            await walk(fullPath, depth + 1);
          } else if (entry.isFile()) {
            if (this.matchesAny(relativePath, includePatterns)) {
              try {
                const stat = await fs.stat(fullPath);
                if (stat.size <= maxFileSize) {
                  files.push(fullPath);
                }
              } catch {}
            }
          }
        }
      } catch {}
    };

    await walk(rootDir, 0);
    return files;
  }

  private matchesAny(filePath: string, patterns: string[]): boolean {
    const normalized = filePath.replace(/\\/g, '/');
    
    for (const pattern of patterns) {
      if (pattern.startsWith('**/*.')) {
        const ext = pattern.slice(4);
        if (normalized.endsWith(ext)) return true;
      } else if (pattern.includes('**')) {
        const parts = pattern.split('**');
        if (parts.length === 2) {
          const [prefix, suffix] = parts;
          if (prefix && !normalized.startsWith(prefix.replace(/\//g, ''))) continue;
          if (suffix && normalized.includes(suffix.slice(1))) return true;
          if (!suffix && normalized.startsWith(prefix.replace(/\//g, ''))) return true;
        }
      } else if (normalized.includes(pattern)) {
        return true;
      }
    }
    return false;
  }

  private async analyzeFile(filePath: string, rootDir: string): Promise<FileInfo | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const ext = path.extname(filePath);
      const language = LANGUAGE_MAP[ext] || 'unknown';
      const relativePath = path.relative(rootDir, filePath);

      const symbols = this.extractSymbols(content, language);
      const imports = this.extractImports(content, language);
      const exports = this.extractExports(content, language);

      return {
        path: filePath,
        relativePath,
        language,
        size: content.length,
        symbols,
        imports,
        exports
      };
    } catch {
      return null;
    }
  }

  private extractSymbols(content: string, language: string): SymbolInfo[] {
    const symbols: SymbolInfo[] = [];
    const lines = content.split('\n');

    const patterns = this.getLanguagePatterns(language);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      for (const pattern of patterns) {
        const match = line.match(pattern.regex);
        if (match) {
          symbols.push({
            name: match[pattern.nameGroup] || match[1],
            kind: pattern.kind,
            line: lineNum,
            signature: this.extractSignature(line, pattern.kind)
          });
        }
      }
    }

    return symbols;
  }

  private getLanguagePatterns(language: string): Array<{ regex: RegExp; kind: SymbolKind; nameGroup: number }> {
    switch (language) {
      case 'typescript':
      case 'javascript':
        return [
          { regex: /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/, kind: 'class', nameGroup: 1 },
          { regex: /^(?:export\s+)?interface\s+(\w+)/, kind: 'interface', nameGroup: 1 },
          { regex: /^(?:export\s+)?type\s+(\w+)/, kind: 'type', nameGroup: 1 },
          { regex: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/, kind: 'function', nameGroup: 1 },
          { regex: /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(/, kind: 'function', nameGroup: 1 },
          { regex: /^(?:export\s+)?enum\s+(\w+)/, kind: 'enum', nameGroup: 1 },
          { regex: /^\s+(?:public|private|protected)?\s*(?:static)?\s*(?:async)?\s*(\w+)\s*\(/, kind: 'method', nameGroup: 1 },
          { regex: /^(?:export\s+)?const\s+(\w+)\s*:\s*\w+\s*=/, kind: 'variable', nameGroup: 1 }
        ];
      case 'python':
        return [
          { regex: /^class\s+(\w+)/, kind: 'class', nameGroup: 1 },
          { regex: /^(?:async\s+)?def\s+(\w+)/, kind: 'function', nameGroup: 1 },
          { regex: /^\s+(?:async\s+)?def\s+(\w+)/, kind: 'method', nameGroup: 1 }
        ];
      case 'go':
        return [
          { regex: /^type\s+(\w+)\s+struct/, kind: 'class', nameGroup: 1 },
          { regex: /^type\s+(\w+)\s+interface/, kind: 'interface', nameGroup: 1 },
          { regex: /^func\s+(\w+)/, kind: 'function', nameGroup: 1 },
          { regex: /^func\s+\([^)]+\)\s+(\w+)/, kind: 'method', nameGroup: 1 }
        ];
      case 'rust':
        return [
          { regex: /^(?:pub\s+)?struct\s+(\w+)/, kind: 'class', nameGroup: 1 },
          { regex: /^(?:pub\s+)?trait\s+(\w+)/, kind: 'interface', nameGroup: 1 },
          { regex: /^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/, kind: 'function', nameGroup: 1 },
          { regex: /^(?:pub\s+)?enum\s+(\w+)/, kind: 'enum', nameGroup: 1 },
          { regex: /^\s+(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/, kind: 'method', nameGroup: 1 }
        ];
      default:
        return [];
    }
  }

  private extractSignature(line: string, kind: SymbolKind): string {
    const trimmed = line.trim();
    
    if (kind === 'function' || kind === 'method') {
      const match = trimmed.match(/^.*?\([^)]*\)(?:\s*:\s*[^{]+)?/);
      return match ? match[0].replace(/\s+/g, ' ').trim() : trimmed;
    }
    
    const endIdx = trimmed.indexOf('{');
    return endIdx > 0 ? trimmed.slice(0, endIdx).trim() : trimmed;
  }

  private extractImports(content: string, language: string): string[] {
    const imports: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      let match: RegExpMatchArray | null = null;

      switch (language) {
        case 'typescript':
        case 'javascript':
          match = line.match(/^import\s+.*?from\s+['"]([^'"]+)['"]/);
          if (!match) match = line.match(/^import\s+['"]([^'"]+)['"]/);
          if (!match) match = line.match(/require\(['"]([^'"]+)['"]\)/);
          break;
        case 'python':
          match = line.match(/^(?:from\s+(\S+)\s+)?import\s+(\S+)/);
          break;
        case 'go':
          match = line.match(/^\s*"([^"]+)"/);
          break;
        case 'rust':
          match = line.match(/^use\s+(\S+)/);
          break;
      }

      if (match) {
        imports.push(match[1] || match[2] || match[0]);
      }
    }

    return [...new Set(imports)];
  }

  private extractExports(content: string, language: string): string[] {
    const exports: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      if (language === 'typescript' || language === 'javascript') {
        const exportMatch = line.match(/^export\s+(?:default\s+)?(?:class|interface|type|function|const|enum|abstract\s+class)\s+(\w+)/);
        if (exportMatch) {
          exports.push(exportMatch[1]);
        }
        
        const namedExport = line.match(/^export\s*\{([^}]+)\}/);
        if (namedExport) {
          const names = namedExport[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0]);
          exports.push(...names);
        }
      }
    }

    return [...new Set(exports)];
  }

  private calculateStats(files: FileInfo[]): RepoStats {
    const stats: RepoStats = {
      totalFiles: files.length,
      totalLines: 0,
      totalSymbols: 0,
      byLanguage: {},
      byKind: {}
    };

    for (const file of files) {
      stats.byLanguage[file.language] = (stats.byLanguage[file.language] || 0) + 1;
      stats.totalSymbols += file.symbols.length;

      for (const symbol of file.symbols) {
        stats.byKind[symbol.kind] = (stats.byKind[symbol.kind] || 0) + 1;
      }
    }

    return stats;
  }

  private generateSummary(files: FileInfo[], stats: RepoStats): string {
    const lines: string[] = [];
    
    lines.push(`# Repository Map`);
    lines.push(``);
    lines.push(`## Statistics`);
    lines.push(`- Files: ${stats.totalFiles}`);
    lines.push(`- Symbols: ${stats.totalSymbols}`);
    lines.push(``);
    
    lines.push(`## Languages`);
    for (const [lang, count] of Object.entries(stats.byLanguage).sort((a, b) => b[1] - a[1])) {
      lines.push(`- ${lang}: ${count} files`);
    }
    lines.push(``);
    
    lines.push(`## Symbol Types`);
    for (const [kind, count] of Object.entries(stats.byKind).sort((a, b) => b[1] - a[1])) {
      lines.push(`- ${kind}: ${count}`);
    }
    lines.push(``);
    
    lines.push(`## File Structure`);
    const byDir = new Map<string, FileInfo[]>();
    for (const file of files) {
      const dir = path.dirname(file.relativePath);
      if (!byDir.has(dir)) byDir.set(dir, []);
      byDir.get(dir)!.push(file);
    }
    
    const sortedDirs = Array.from(byDir.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [dir, dirFiles] of sortedDirs) {
      lines.push(``);
      lines.push(`### ${dir || '.'}`);
      for (const file of dirFiles) {
        const symbolNames = file.symbols.slice(0, 5).map(s => s.name);
        const symbolSummary = symbolNames.length > 0 
          ? `: ${symbolNames.join(', ')}${file.symbols.length > 5 ? '...' : ''}`
          : '';
        lines.push(`- ${path.basename(file.relativePath)}${symbolSummary}`);
      }
    }

    return lines.join('\n');
  }

  async getCompactMap(rootDir: string, options: RepoMapOptions = {}): Promise<string> {
    const repoMap = await this.generateRepoMap(rootDir, options);
    const lines: string[] = [];

    for (const file of repoMap.files) {
      const classes = file.symbols.filter(s => s.kind === 'class');
      const functions = file.symbols.filter(s => s.kind === 'function');
      const interfaces = file.symbols.filter(s => s.kind === 'interface');
      
      if (classes.length > 0 || functions.length > 0 || interfaces.length > 0) {
        lines.push(`${file.relativePath}`);
        
        for (const cls of classes) {
          lines.push(`  class ${cls.name}`);
          const methods = file.symbols.filter(s => s.kind === 'method');
          for (const method of methods.slice(0, 10)) {
            lines.push(`    ${method.name}()`);
          }
        }
        
        for (const iface of interfaces) {
          lines.push(`  interface ${iface.name}`);
        }
        
        for (const func of functions) {
          lines.push(`  ${func.name}()`);
        }
      }
    }

    return lines.join('\n');
  }

  async findSymbol(rootDir: string, symbolName: string): Promise<Array<{ file: string; symbol: SymbolInfo }>> {
    const repoMap = await this.generateRepoMap(rootDir);
    const results: Array<{ file: string; symbol: SymbolInfo }> = [];

    for (const file of repoMap.files) {
      for (const symbol of file.symbols) {
        if (symbol.name.toLowerCase().includes(symbolName.toLowerCase())) {
          results.push({ file: file.relativePath, symbol });
        }
      }
    }

    return results;
  }

  async getFileContext(rootDir: string, filePath: string, contextLines = 5): Promise<string> {
    const repoMap = await this.generateRepoMap(rootDir);
    const file = repoMap.files.find(f => f.relativePath === filePath || f.path === filePath);
    
    if (!file) return '';

    const lines: string[] = [];
    lines.push(`File: ${file.relativePath}`);
    lines.push(`Language: ${file.language}`);
    lines.push(`Imports: ${file.imports.join(', ') || 'none'}`);
    lines.push(`Exports: ${file.exports.join(', ') || 'none'}`);
    lines.push(``);
    lines.push(`Symbols:`);
    
    for (const symbol of file.symbols) {
      lines.push(`  ${symbol.kind} ${symbol.name} (line ${symbol.line})`);
      if (symbol.signature) {
        lines.push(`    ${symbol.signature}`);
      }
    }

    return lines.join('\n');
  }

  clearCache(): void {
    this.cache.clear();
    this.emit('cache:cleared');
  }
}

export default RepoMapService;
