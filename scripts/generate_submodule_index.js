const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const outputFile = path.join(__dirname, '../docs/SUBMODULE_INDEX.csv');

try {
  console.log('Fetching submodule status...');
  const statusOutput = execSync('git submodule status --recursive').toString();
  console.log(`Fetching submodule status... (Length: ${statusOutput.length})`);
  
  const submodules = [];
  const lines = statusOutput.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    if (submodules.length < 3) console.log('Processing:', trimmedLine);

    const match = trimmedLine.match(/^([+\-U]?)([0-9a-f]+)\s+(.*?)(\s+\(.*\))?$/);
    if (match) {
      const prefix = match[1];
      const sha = match[2];
      const subPath = match[3];
      const version = match[4] ? match[4].trim().replace(/[()]/g, '') : 'unknown';
      
      const name = path.basename(subPath);

      let commitDate = 'unknown';
      try {
        if (fs.existsSync(subPath)) {
            const dateOutput = execSync(`git -C "${subPath}" show -s --format=%ci HEAD`, { stdio: 'pipe' }).toString().trim();
            commitDate = dateOutput;
        }
      } catch (e) {
      }
      
      let category = 'Other';
      if (subPath.startsWith('external/agents_repos')) category = 'Agent';
      else if (subPath.startsWith('external/auth')) category = 'Auth';
      else if (subPath.startsWith('external/config_repos')) category = 'Config';
      else if (subPath.startsWith('external/misc')) category = 'Misc';
      else if (subPath.startsWith('external/plugins')) category = 'Plugin';
      else if (subPath.startsWith('external/research')) category = 'Research';
      else if (subPath.startsWith('external/skills_repos')) category = 'Skill';
      else if (subPath.startsWith('external/tools')) category = 'Tool';
      else if (subPath.startsWith('external/web_repos')) category = 'Web';
      else if (subPath.startsWith('references')) category = 'Reference';
      else if (subPath.startsWith('submodules')) category = 'Core Submodule';

      submodules.push({
        name: name,
        path: subPath,
        category: category,
        role: 'Submodule',
        description: `Submodule at ${subPath} (Version: ${version})`,
        rationale: 'Project dependency',
        integrationStrategy: 'Git Submodule',
        status: 'Active',
        date: commitDate,
        commit: sha
      });
    }
  }

  const header = 'name,path,category,role,description,rationale,integrationStrategy,status,date,commit';
  const csvLines = [header];

  for (const sub of submodules) {
    const row = [
      sub.name,
      sub.path,
      sub.category,
      sub.role,
      `"${sub.description.replace(/"/g, '""')}"`,
      sub.rationale,
      sub.integrationStrategy,
      sub.status,
      sub.date,
      sub.commit
    ].join(',');
    csvLines.push(row);
  }

  fs.writeFileSync(outputFile, csvLines.join('\n'));
  console.log(`Successfully generated ${outputFile} with ${submodules.length} entries.`);

} catch (error) {
  console.error('Error generating index:', error);
  process.exit(1);
}
