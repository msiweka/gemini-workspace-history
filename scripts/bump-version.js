#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

function getLatestTag() {
    const result = spawnSync('git', ['tag', '-l', 'v*'], { encoding: 'utf8' });
    const tags = result.stdout.trim().split('\n').filter(t => /^v\d+\.\d+(\.\d+)?$/.test(t));
    
    if (tags.length === 0) return '0.0.0';

    return tags.sort((a, b) => {
        const partsA = a.substring(1).split('.').map(Number);
        const partsB = b.substring(1).split('.').map(Number);
        for (let i = 0; i < 3; i++) {
            const va = partsA[i] || 0;
            const vb = partsB[i] || 0;
            if (va !== vb) return vb - va;
        }
        return 0;
    })[0].substring(1);
}

function getMainVersion() {
    try {
        const result = spawnSync('git', ['show', 'main:package.json'], { encoding: 'utf8' });
        if (result.status === 0) {
            return JSON.parse(result.stdout).version;
        }
    } catch (e) {}
    return '0.0.0';
}

function compareVersions(v1, v2) {
    const p1 = v1.split('.').map(Number);
    const p2 = v2.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if ((p1[i] || 0) > (p2[i] || 0)) return 1;
        if ((p1[i] || 0) < (p2[i] || 0)) return -1;
    }
    return 0;
}

function bumpPatch(version) {
    const parts = version.split('.').map(Number);
    while (parts.length < 3) parts.push(0);
    parts[2]++;
    return parts.join('.');
}

const latestTag = getLatestTag();
const mainVersion = getMainVersion();

let baseVersion = latestTag;
if (compareVersions(mainVersion, latestTag) > 0) {
    baseVersion = mainVersion;
}

const newVersion = bumpPatch(baseVersion);

console.log(`Latest Tag: ${latestTag}`);
console.log(`Main Version: ${mainVersion}`);
console.log(`Bumping from ${baseVersion} to ${newVersion}`);

// Update JSON files safely
[
    path.join(ROOT_DIR, 'package.json'),
    path.join(ROOT_DIR, 'gemini-extension.json'),
    path.join(ROOT_DIR, 'package-lock.json')
].forEach(filePath => {
    if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        data.version = newVersion;
        
        // Special case for package-lock.json packages
        if (path.basename(filePath) === 'package-lock.json' && data.packages && data.packages[""]) {
            data.packages[""].version = newVersion;
        }
        
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
        console.log(`Updated ${path.basename(filePath)}`);
    }
});
