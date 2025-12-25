import fs from 'fs';
import path from 'path';

const rootDir = path.resolve(__dirname, '../../../');
const versionFile = path.join(rootDir, 'VERSION.md');

if (!fs.existsSync(versionFile)) {
    console.error('VERSION.md not found!');
    process.exit(1);
}

const version = fs.readFileSync(versionFile, 'utf-8').trim();
console.log(`Syncing version: ${version}`);

// Update Root package.json
const updatePackageJson = (p: string) => {
    if (fs.existsSync(p)) {
        const pkg = JSON.parse(fs.readFileSync(p, 'utf-8'));
        pkg.version = version;
        fs.writeFileSync(p, JSON.stringify(pkg, null, 2));
        console.log(`Updated ${p}`);
    }
};

updatePackageJson(path.join(rootDir, 'package.json'));

// Update Packages
const packagesDir = path.join(rootDir, 'packages');
const packages = fs.readdirSync(packagesDir);
for (const pkg of packages) {
    updatePackageJson(path.join(packagesDir, pkg, 'package.json'));
}

// Update Adapters
const adaptersDir = path.join(rootDir, 'packages', 'adapters');
if (fs.existsSync(adaptersDir)) {
    const adapters = fs.readdirSync(adaptersDir);
    for (const adp of adapters) {
        updatePackageJson(path.join(adaptersDir, adp, 'package.json'));
    }
}

// Update Changelog
const changelogPath = path.join(rootDir, 'CHANGELOG.md');
if (fs.existsSync(changelogPath)) {
    let content = fs.readFileSync(changelogPath, 'utf-8');
    if (!content.includes(`[${version}]`)) {
        const date = new Date().toISOString().split('T')[0];
        const newEntry = `## [${version}] - ${date}\n\n### Updated\n* Synchronized version numbers.\n\n`;
        // Insert after header
        content = content.replace('# Changelog\n\n', `# Changelog\n\n${newEntry}`);
        fs.writeFileSync(changelogPath, content);
        console.log('Updated CHANGELOG.md');
    }
}
