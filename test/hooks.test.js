import test from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

test('Hooks save to payload cwd, not process cwd', async (t) => {
    // 1. Setup a temporary "workspace" directory
    const tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-test-'));
    const historyDir = path.join(tempWorkspace, '.gemini-workspace-history');
    const dummyTranscript = path.join(tempWorkspace, 'transcript.json');
    fs.writeFileSync(dummyTranscript, JSON.stringify({ messages: [] }));

    // 2. Prepare payload
    const payload = {
        cwd: tempWorkspace,
        transcript_path: dummyTranscript
    };

    // 3. Test on-start.js
    const startResult = spawnSync('node', [path.join(ROOT_DIR, 'hooks', 'on-start.js')], {
        cwd: ROOT_DIR, // Run in extension dir to prove it doesn't use process.cwd()
        input: JSON.stringify(payload),
        encoding: 'utf8'
    });

    if (startResult.status !== 0) {
        console.error(startResult.stderr);
    }
    assert.strictEqual(startResult.status, 0, 'on-start.js should exit with status 0');
    assert.ok(fs.existsSync(historyDir), 'HISTORY_DIR should be created in payload cwd by on-start.js');
    assert.ok(fs.existsSync(path.join(historyDir, 'active-context.md')), 'active-context.md should be created');
    
    // 4. Test on-end.js
    const endResult = spawnSync('node', [path.join(ROOT_DIR, 'hooks', 'on-end.js')], {
        cwd: ROOT_DIR,
        input: JSON.stringify(payload),
        encoding: 'utf8'
    });

    assert.strictEqual(endResult.status, 0, 'on-end.js should exit with status 0');
    const files = fs.readdirSync(historyDir);
    const sessionFile = files.find(f => f.startsWith('session-') && f.endsWith('.json.gz'));
    assert.ok(sessionFile, 'Session archive should be created in payload cwd by on-end.js');

    // Cleanup
    fs.rmSync(tempWorkspace, { recursive: true, force: true });
});
