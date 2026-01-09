import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Determine project root
    // If running from packages/ui, go up two levels
    // If running from root, stay there
    let rootDir = process.cwd();
    // Obscure the path slightly to prevent bundlers from trying to include the entire monorepo
    // This is a runtime-only operation using fs
    const upLevel = '..';
    if (path.basename(rootDir) === 'ui' && path.basename(path.dirname(rootDir)) === 'packages') {
        rootDir = path.resolve(rootDir, upLevel, upLevel);
    }

    const submodulesDir = path.join(rootDir, 'submodules');
    const packagesDir = path.join(rootDir, 'packages');
    
    const submodules = [];
    if (fs.existsSync(submodulesDir)) {
        const subs = fs.readdirSync(submodulesDir);
        for (const sub of subs) {
            // Explicitly ignore system directories and known heavy folders
            if (sub.startsWith('.') || sub === 'node_modules' || sub === 'pnpm-store' || sub === '.git' || sub === '.next') continue;
            const subPath = path.join(submodulesDir, sub);
            try {
                if (fs.statSync(subPath).isDirectory()) {
                    let version = 'unknown';
                    try {
                        const pkgJsonPath = path.join(subPath, 'package.json');
                        if (fs.existsSync(pkgJsonPath)) {
                            const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
                            version = pkgJson.version || 'unknown';
                        }
                    } catch (e) {}
                    
                    submodules.push({
                        path: `submodules/${sub}`,
                        commit: 'HEAD', // Placeholder
                        version
                    });
                }
            } catch (e) {
                // Ignore errors for individual files
            }
        }
    }

    const packages = [];
    if (fs.existsSync(packagesDir)) {
        const pkgs = fs.readdirSync(packagesDir);
        for (const pkg of pkgs) {
             if (pkg.startsWith('.')) continue;
             try {
                if (fs.statSync(path.join(packagesDir, pkg)).isDirectory()) {
                    packages.push(pkg);
                }
             } catch (e) {}
        }
    }

    const configFiles = ['package.json', 'tsconfig.json', 'pnpm-workspace.yaml', 'README.md', 'AGENTS.md'];
    const existingConfig = configFiles.filter(f => fs.existsSync(path.join(rootDir, f)));

    return NextResponse.json({
      submodules,
      structure: {
        packages,
        config: existingConfig
      }
    });
  } catch (error) {
    console.error('Error reading project structure:', error);
    return NextResponse.json({ error: 'Failed to read project structure' }, { status: 500 });
  }
}
