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

    // 3.1 Verify empty output to prevent duplicate summaries
    const startOutput = JSON.parse(startResult.stdout);
    assert.deepStrictEqual(startOutput, {}, 'on-start.js should return an empty object to prevent duplicate summaries');
    
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

test('Version consistency', (t) => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
    const ext = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'gemini-extension.json'), 'utf8'));
    const lock = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package-lock.json'), 'utf8'));
    
    assert.strictEqual(pkg.version, ext.version, 'package.json and gemini-extension.json versions should match');
    assert.strictEqual(pkg.version, lock.version, 'package.json and package-lock.json versions should match');
    assert.strictEqual(pkg.version, lock.packages[""].version, 'package.json and package-lock.json package versions should match');
});

test('Version must be greater than on main', (t) => {
    try {
        const headCommit = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
        
        let mainCommit = '';
        const tryMain = spawnSync('git', ['rev-parse', 'main'], { encoding: 'utf8' });
        const tryOriginMain = spawnSync('git', ['rev-parse', 'origin/main'], { encoding: 'utf8' });
        
        if (tryMain.status === 0) {
            mainCommit = tryMain.stdout.trim();
        } else if (tryOriginMain.status === 0) {
            mainCommit = tryOriginMain.stdout.trim();
        }

        if (mainCommit && headCommit === mainCommit) {
            console.log('Skipping strict version check: currently on the main branch commit');
            return;
        }

        // Try to get main package.json from either 'main' or 'origin/main'
        let mainPkgRaw = '';
        const tryShowMain = spawnSync('git', ['show', 'main:package.json'], { encoding: 'utf8' });
        const tryShowOriginMain = spawnSync('git', ['show', 'origin/main:package.json'], { encoding: 'utf8' });
        
        if (tryShowMain.status === 0) {
            mainPkgRaw = tryShowMain.stdout;
        } else if (tryShowOriginMain.status === 0) {
            mainPkgRaw = tryShowOriginMain.stdout;
        }

        if (!mainPkgRaw) {
            console.log('Skipping version check: could not find package.json on main or origin/main');
            return;
        }
        
        const mainPkg = JSON.parse(mainPkgRaw);
        const currentPkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));

        const vCurrent = currentPkg.version.split('.').map(Number);
        const vMain = mainPkg.version.split('.').map(Number);

        let isGreater = false;
        if (vCurrent[0] > vMain[0]) {
            isGreater = true;
        } else if (vCurrent[0] === vMain[0]) {
            if (vCurrent[1] > vMain[1]) {
                isGreater = true;
            } else if (vCurrent[1] === vMain[1]) {
                if (vCurrent[2] > vMain[2]) {
                    isGreater = true;
                }
            }
        }

        assert.ok(isGreater, `Current version (${currentPkg.version}) must be strictly greater than main version (${mainPkg.version})`);
    } catch (e) {
        if (e.message.includes('must be strictly greater')) throw e;
        console.error('Error during version check: ', e.message);
        // We don't want to fail the whole suite if git is missing, but we want to know about it
    }
});

test('on-start.js fallback to process.cwd() when stdin is empty', async (t) => {
    const tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-fallback-test-'));
    const historyDir = path.join(tempWorkspace, '.gemini-workspace-history');
    
    // We run the process in our tempWorkspace to ensure it can create the folder there
    const result = spawnSync('node', [path.join(ROOT_DIR, 'hooks', 'on-start.js')], {
        cwd: tempWorkspace,
        input: '', // Empty stdin
        encoding: 'utf8'
    });

    assert.strictEqual(result.status, 0, 'on-start.js should exit with status 0');
    assert.ok(fs.existsSync(historyDir), 'Should fallback to process.cwd() if stdin is empty');
    
    // Cleanup
    fs.rmSync(tempWorkspace, { recursive: true, force: true });
});

test('on-start.js fallback to process.cwd() when stdin has invalid JSON', async (t) => {
    const tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-invalid-test-'));
    const historyDir = path.join(tempWorkspace, '.gemini-workspace-history');

    const result = spawnSync('node', [path.join(ROOT_DIR, 'hooks', 'on-start.js')], {
        cwd: tempWorkspace,
        input: 'not-json',
        encoding: 'utf8'
    });

    assert.strictEqual(result.status, 0, 'on-start.js should exit with status 0');
    assert.ok(fs.existsSync(historyDir), 'Should fallback to process.cwd() if JSON is invalid');
    
    // Cleanup
    fs.rmSync(tempWorkspace, { recursive: true, force: true });
});

test('on-end.js error on missing transcript file', async (t) => {
    const payload = {
        cwd: ROOT_DIR,
        transcript_path: '/path/to/non-existent/transcript.json'
    };
    const result = spawnSync('node', [path.join(ROOT_DIR, 'hooks', 'on-end.js')], {
        cwd: ROOT_DIR,
        input: JSON.stringify(payload),
        encoding: 'utf8'
    });

    assert.strictEqual(result.status, 0, 'on-end.js should exit with status 0 (errors are logged to stderr)');
    assert.ok(result.stderr.includes('Transcript file missing'), 'Should log error to stderr');
});

test('on-end.js error on empty stdin', async (t) => {
    const result = spawnSync('node', [path.join(ROOT_DIR, 'hooks', 'on-end.js')], {
        cwd: ROOT_DIR,
        input: '',
        encoding: 'utf8'
    });

    assert.strictEqual(result.status, 0, 'on-end.js should exit with status 0');
    assert.ok(result.stderr.includes('No input received on stdin'), 'Should log error to stderr');
});
