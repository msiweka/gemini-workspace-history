# Fix Path Resolution and Add Automated Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the path resolution in hooks to use the `cwd` provided in the JSON payload (preventing files from being saved in the extension directory) and add a robust automated test suite. This fix ensures that both session history and summary files (created via `/close-workspace`) are saved in the correct workspace.

**Architecture:** Hooks currently rely on `process.cwd()`, which can result in files being written to the extension directory instead of the workspace when invoked by the Gemini CLI as a linked extension. The fix modifies both hooks to read `stdin`, parse the JSON payload, and use the provided `cwd` field. By ensuring the `.gemini-workspace-history` directory is created in the correct workspace, the agent will naturally save its summary files there as well. The `/close-workspace` command prompt is also updated to be more explicit.

**Tech Stack:** Node.js, `node:test`, `child_process`

---

### Task 1: Update `package.json` to support tests

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the test script to `package.json`**

Replace the contents of `package.json` to include a test script.

```json
{
  "name": "gemini-workspace-history",
  "version": "0.1.1",
  "description": "Workspace-specific session history and summaries for Gemini CLI",
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore: add test script to package.json"
```

### Task 2: Create automated tests for hooks

**Files:**
- Create: `test/hooks.test.js`

- [ ] **Step 1: Write the failing test**

Create the test file to simulate the CLI hook execution. It will pass a specific `cwd` in the JSON payload but run the child process in the extension directory.

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL. `on-start.js` doesn't read stdin, so it uses `process.cwd()` and fails the assertion.

- [ ] **Step 3: Commit**

```bash
git add test/hooks.test.js
git commit -m "test: add automated test for hook path resolution"
```

### Task 3: Fix path resolution in `on-start.js`

**Files:**
- Modify: `hooks/on-start.js`

- [ ] **Step 1: Write the minimal implementation**

Update `hooks/on-start.js` to read from stdin and use `payload.cwd`.

```javascript
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { promisify } from 'util';

const gunzip = promisify(zlib.gunzip);

async function getAllFiles(historyDir, pattern) {
    if (!fs.existsSync(historyDir)) return [];
    return fs.readdirSync(historyDir)
        .filter(f => pattern.test(f))
        .map(name => ({
            name,
            path: path.join(historyDir, name),
            mtime: fs.statSync(path.join(historyDir, name)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);
}

async function main() {
    let input = '';
    try {
        input = fs.readFileSync(0, 'utf8');
    } catch (e) {
        // Fallback if no stdin
    }

    let cwd = process.cwd();
    if (input && input.trim() !== '') {
        try {
            const data = JSON.parse(input);
            if (data.cwd) {
                cwd = data.cwd;
            }
        } catch (e) {
            // Invalid JSON, fallback to process.cwd()
        }
    }

    const HISTORY_DIR = path.join(cwd, '.gemini-workspace-history');

    if (!fs.existsSync(HISTORY_DIR)) {
        fs.mkdirSync(HISTORY_DIR, { recursive: true });
    }

    const sessions = await getAllFiles(HISTORY_DIR, /^session-.*\.json\.gz$/);
    const summaries = await getAllFiles(HISTORY_DIR, /^summary-.*\.md$/);
    
    const latestSession = sessions[0];
    const secondLatestSession = sessions[1];
    const latestSummary = summaries[0];
    
    const activeContextPath = path.join(HISTORY_DIR, 'active-context.md');

    let systemMessage = "";
    let isSummaryCurrent = false;

    if (latestSummary) {
        if (!secondLatestSession || latestSummary.mtime > secondLatestSession.mtime) {
            isSummaryCurrent = true;
        }
    }

    if (isSummaryCurrent) {
        systemMessage = fs.readFileSync(latestSummary.path, 'utf8');
        fs.writeFileSync(activeContextPath, systemMessage);
    } else if (latestSession) {
        systemMessage = "No summary found for the last session. Please use the 'workspace-summarizer' skill to generate one if needed.";
        
        try {
            const compressed = fs.readFileSync(latestSession.path);
            const decompressed = await gunzip(compressed);
            fs.writeFileSync(activeContextPath, 
                `## Full Previous Session Transcript (from ${latestSession.name})\n\n${decompressed.toString()}`);
        } catch (e) {
            fs.writeFileSync(activeContextPath, `Error processing session ${latestSession.name}: ${e.message}`);
        }
    } else {
        systemMessage = "No previous session history found for this workspace.";
        fs.writeFileSync(activeContextPath, systemMessage);
    }

    process.stdout.write(JSON.stringify({
        systemMessage: systemMessage
    }));
}

main().catch(console.error);
```

- [ ] **Step 2: Commit**

```bash
git add hooks/on-start.js
git commit -m "fix: on-start.js uses cwd from payload to prevent saving in extension dir"
```

### Task 4: Fix path resolution in `on-end.js`

**Files:**
- Modify: `hooks/on-end.js`

- [ ] **Step 1: Write the minimal implementation**

Update `hooks/on-end.js` to use `data.cwd`.

```javascript
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);

async function main() {
    let input = '';
    try {
        input = fs.readFileSync(0, 'utf8');
    } catch (e) {
        console.error(`Error reading stdin: ${e.message}`);
    }

    if (!input || input.trim() === '') {
        console.error('No input received on stdin or input is empty');
        return;
    }

    let data;
    try {
        data = JSON.parse(input);
    } catch (e) {
        console.error(`Failed to parse input: ${e.message}`);
        return;
    }

    const transcriptPath = data.transcript_path;
    const cwd = data.cwd || process.cwd();
    const HISTORY_DIR = path.join(cwd, '.gemini-workspace-history');

    if (!transcriptPath || !fs.existsSync(transcriptPath)) {
        console.error(`Transcript file missing: ${transcriptPath}`);
        return;
    }

    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    const destination = path.join(HISTORY_DIR, `session-${timestamp}.json.gz`);

    if (!fs.existsSync(HISTORY_DIR)) {
        try {
            fs.mkdirSync(HISTORY_DIR, { recursive: true });
        } catch (e) {
            console.error(`Failed to create HISTORY_DIR: ${e.message}`);
            return;
        }
    }

    try {
        const transcript = fs.readFileSync(transcriptPath);
        const compressed = await gzip(transcript);

        fs.writeFileSync(destination, compressed);
    } catch (e) {
        console.error(`Error during compression/writing: ${e.message}`);
    }
}

main().catch(console.error);
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add hooks/on-end.js
git commit -m "fix: on-end.js uses cwd from payload to prevent saving in extension dir"
```

### Task 5: Refine `/close-workspace` prompt

**Files:**
- Modify: `commands/close-workspace.toml`

- [ ] **Step 1: Update the prompt**

Emphasize saving the summary in the *current project's* root directory to ensure the agent resolves the relative path correctly.

```toml
description = "Summarize the session and close the workspace"

prompt = """
Provide a detailed technical summary of this session's progress. Your summary MUST follow this structure:
1. ## Overview: A high-level summary of the session's goals and outcomes.
2. ## Technical Changes: A bulleted list of specific file modifications, new files created, and key logic changes.
3. ## Architectural Decisions: A summary of the design choices and technical trade-offs made.

Use your tools to save this summary into the `.gemini-workspace-history/` directory of the CURRENT WORKSPACE (the one you are currently working in). The filename MUST follow the format `summary-YYYY-MM-DD-HH-mm.md` (e.g., `summary-2026-04-21-14-30.md`) based on the current date and time. 

The content should follow this format:
# Session Summary - [Current Locale Date/Time]

[YOUR FORMATTED SUMMARY]

After saving, say 'Summarized and saved your work. See you next time :)' and end the session.
"""
```

- [ ] **Step 2: Commit**

```bash
git add commands/close-workspace.toml
git commit -m "fix: refine /close-workspace prompt to ensure summary is saved in workspace"
```
