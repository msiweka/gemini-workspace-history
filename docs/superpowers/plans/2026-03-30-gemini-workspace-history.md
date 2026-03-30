# Gemini Workspace History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically manage workspace-specific session summaries and compressed transcripts in a `.gemini-workspace-history` folder.

**Architecture:** Uses Gemini CLI hooks (`SessionStart`, `SessionEnd`) and a custom command (`/close-workspace`) to handle context injection, summarization, and storage.

**Tech Stack:** Node.js (zlib, fs, path), Gemini CLI Extension Manifest.

---

### Task 1: Project Initialization

**Files:**
- Create: `package.json`
- Create: `gemini-extension.json`
- Create: `README.md`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "gemini-workspace-history",
  "version": "1.0.0",
  "description": "Workspace-specific session history and summaries for Gemini CLI",
  "type": "module"
}
```

- [ ] **Step 2: Create `gemini-extension.json`**

```json
{
  "name": "workspace-history",
  "version": "1.0.0",
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "name": "restore-context",
            "type": "command",
            "command": "node hooks/on-start.js"
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "matcher": "exit",
        "hooks": [
          {
            "name": "archive-session",
            "type": "command",
            "command": "node hooks/on-end.js"
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 3: Commit**

```bash
git init
git add package.json gemini-extension.json
git commit -m "chore: initialize extension manifest and package.json"
```

### Task 2: Implement SessionStart Hook

**Files:**
- Create: `hooks/on-start.js`

- [ ] **Step 1: Create `hooks/on-start.js`**

```javascript
import fs from 'fs';
import path from 'path';

const HISTORY_DIR = '.gemini-workspace-history';

async function main() {
    if (!fs.existsSync(HISTORY_DIR)) {
        fs.mkdirSync(HISTORY_DIR, { recursive: true });
    }

    const files = fs.readdirSync(HISTORY_DIR)
        .filter(f => f.startsWith('summary-') && f.endsWith('.md'))
        .sort()
        .reverse();

    if (files.length > 0) {
        const lastSummaryPath = path.join(HISTORY_DIR, files[0]);
        const content = fs.readFileSync(lastSummaryPath, 'utf8');
        fs.writeFileSync(path.join(HISTORY_DIR, 'active-context.md'), 
            `## Previous Session Summary\n\n${content}`);
    } else {
        fs.writeFileSync(path.join(HISTORY_DIR, 'active-context.md'), 
            "No previous session history found for this workspace.");
    }
}

main().catch(console.error);
```

- [ ] **Step 2: Commit**

```bash
git add hooks/on-start.js
git commit -m "feat: implement SessionStart hook to restore context"
```

### Task 3: Implement SessionEnd Hook (Archiver)

**Files:**
- Create: `hooks/on-end.js`

- [ ] **Step 1: Create `hooks/on-end.js`**

```javascript
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { promisify } from 'util';
import readline from 'readline';

const gzip = promisify(zlib.gzip);
const HISTORY_DIR = '.gemini-workspace-history';

async function main() {
    const rl = readline.createInterface({ input: process.stdin });
    
    let input = '';
    for await (const line of rl) {
        input += line;
    }

    if (!input) return;

    const data = JSON.parse(input);
    const transcriptPath = data.transcript_path;

    if (!transcriptPath || !fs.existsSync(transcriptPath)) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const destination = path.join(HISTORY_DIR, `session-${timestamp}.json.gz`);

    const transcript = fs.readFileSync(transcriptPath);
    const compressed = await gzip(transcript);

    fs.writeFileSync(destination, compressed);
}

main().catch(console.error);
```

- [ ] **Step 2: Commit**

```bash
git add hooks/on-end.js
git commit -m "feat: implement SessionEnd hook to archive transcript"
```

### Task 4: Implement Workspace Manager Skill

**Files:**
- Create: `skills/workspace-manager/SKILL.md`

- [ ] **Step 1: Create `skills/workspace-manager/SKILL.md`**

```markdown
# Workspace Manager

## Goal
Manage technical summaries and context for the current workspace.

## Instructions
- ALWAYS check for `.gemini-workspace-history/active-context.md` at the start of a session.
- When summarizing, be technical: include modified files, key logic changes, and unresolved issues.

## Tools
You can use standard file tools to write the summary.
```

- [ ] **Step 2: Update `gemini-extension.json` to include the skill**

```json
{
  "name": "workspace-history",
  "version": "1.0.0",
  "contextFileName": ".gemini-workspace-history/active-context.md",
  "hooks": { ... },
  "skills": [
    {
      "name": "workspace-manager",
      "path": "skills/workspace-manager/SKILL.md"
    }
  ]
}
```

- [ ] **Step 3: Commit**

```bash
git add skills/workspace-manager/SKILL.md gemini-extension.json
git commit -m "feat: add workspace-manager skill and link active-context"
```

### Task 5: Implement /close-workspace Command

**Files:**
- Create: `commands/close-workspace.toml`

- [ ] **Step 1: Create `commands/close-workspace.toml`**

```toml
[command]
name = "close-workspace"
description = "Summarize the session and close the workspace"
help = "Generates a technical summary, saves it to .gemini-workspace-history, and exits the session."

[[steps]]
type = "agent"
prompt = "Please provide a concise technical summary of what we've done in this session, focusing on file changes and architectural decisions. Save this summary to `.gemini-workspace-history/summary-<TIMESTAMP>.md` (replacing <TIMESTAMP> with current time). After saving, say 'Workspace closed' and exit the session using the `/exit` command."
```

- [ ] **Step 2: Commit**

```bash
git add commands/close-workspace.toml
git commit -m "feat: add /close-workspace command"
```

### Task 6: Final Testing & Verification

- [ ] **Step 1: Link the extension locally**

Run: `gemini extensions link .`

- [ ] **Step 2: Verify folder creation**

Run a new session and check if `.gemini-workspace-history` is created.

- [ ] **Step 3: Test `/close-workspace`**

Run `/close-workspace` and verify:
1. `summary-*.md` is created.
2. `session-*.json.gz` is created.
3. Session exits.

- [ ] **Step 4: Verify context restoration**

Start a new session and ask: "What did we do last session?"
Expected: Agent should know the summary from the previous step.
