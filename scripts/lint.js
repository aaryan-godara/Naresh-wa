const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function collectJsFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) return collectJsFiles(fullPath);
        return entry.isFile() && entry.name.endsWith('.js') ? [fullPath] : [];
    });
}

const projectRoot = path.join(__dirname, '..');
const files = [
    path.join(projectRoot, 'server.js'),
    ...collectJsFiles(path.join(projectRoot, 'src'))
];

for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status || 1);
}

console.log(`Syntax check passed for ${files.length} JavaScript files.`);
