import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const submodules = [
  'submodules/metamcp/submodules/mcp-shark',
  'submodules/metamcp',
  'submodules/jules-app',
  'submodules/mcp-shark'
];

function run(command, cwd) {
  try {
    console.log('[' + cwd + '] Running: ' + command);
    execSync(command, { cwd, stdio: 'inherit' });
  } catch (error) {
    console.error('[' + cwd + '] Error running command: ' + command);
  }
}

async function syncSubmodules() {
  const commitMessage = process.argv[2] || 'chore: sync submodule changes';

  for (const submodule of submodules) {
    const submodulePath = path.join(rootDir, submodule);
    if (!fs.existsSync(submodulePath)) {
      console.warn('Submodule not found: ' + submodulePath);
      continue;
    }

    console.log('\n--- Syncing ' + submodule + ' ---');
    
    try {
        try {
            execSync('git diff --quiet && git diff --cached --quiet', { cwd: submodulePath });
            console.log('No changes in ' + submodule);
        } catch (e) {
            run('git add .', submodulePath);
            run('git commit -m "' + commitMessage + '"', submodulePath);
            run('git push origin main', submodulePath); 
        }
    } catch (e) {
        console.error('Failed to check status for ' + submodule);
    }
  }

  console.log('\n--- Updating Root Pointers ---');
  run('git add submodules', rootDir);
  try {
      execSync('git diff --cached --quiet submodules', { cwd: rootDir });
      console.log('No submodule pointer updates needed.');
  } catch (e) {
      run('git commit -m "chore: update submodule pointers"', rootDir);
  }
}

syncSubmodules();
