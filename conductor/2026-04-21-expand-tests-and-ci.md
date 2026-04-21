# Expand Tests, Add .gitignore, and GitHub CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Increase test coverage for hooks, add a proper `.gitignore` file, and set up a GitHub Actions CI workflow to ensure continued reliability.

**Architecture:** The current single test only covers the happy path for path resolution. We need to add tests for edge cases (empty input, invalid JSON, missing files). A `.gitignore` file is necessary to keep the repository clean of local artifacts. A GitHub Actions workflow will automate the testing process on every push and pull request.

**Tech Stack:** Node.js, `node:test`, GitHub Actions

---

### Task 1: Add `.gitignore`

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: Create `.gitignore`**

Create the file with common Node.js exclusions and local history files.

```text
node_modules/
.gemini-workspace-history/
.gemini-extension.json.lock
*.log
.DS_Store
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: add .gitignore"
```

### Task 2: Expand `test/hooks.test.js` with edge cases

**Files:**
- Modify: `test/hooks.test.js`

- [ ] **Step 1: Add fallback tests for `on-start.js`**

Add tests to verify that `on-start.js` falls back to `process.cwd()` when stdin is empty or contains invalid JSON.

```javascript
// ... existing imports ...

test('on-start.js fallback to process.cwd() when stdin is empty', async (t) => {
    // We run in ROOT_DIR, so it should create .gemini-workspace-history there
    const result = spawnSync('node', [path.join(ROOT_DIR, 'hooks', 'on-start.js')], {
        cwd: ROOT_DIR,
        input: '', // Empty stdin
        encoding: 'utf8'
    });

    assert.strictEqual(result.status, 0, 'on-start.js should exit with status 0');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, '.gemini-workspace-history')), 'Should fallback to process.cwd()');
});

test('on-start.js fallback to process.cwd() when stdin has invalid JSON', async (t) => {
    const result = spawnSync('node', [path.join(ROOT_DIR, 'hooks', 'on-start.js')], {
        cwd: ROOT_DIR,
        input: 'not-json',
        encoding: 'utf8'
    });

    assert.strictEqual(result.status, 0, 'on-start.js should exit with status 0');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, '.gemini-workspace-history')), 'Should fallback to process.cwd()');
});
```

- [ ] **Step 2: Add error handling tests for `on-end.js`**

Add tests to verify that `on-end.js` handles missing transcript files or empty stdin gracefully (logging errors but not crashing).

```javascript
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
```

- [ ] **Step 3: Run expanded tests**

Run: `npm test`
Expected: ALL tests pass.

- [ ] **Step 4: Commit**

```bash
git add test/hooks.test.js
git commit -m "test: expand hook tests to cover edge cases and fallbacks"
```

### Task 3: Create GitHub CI Configuration

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create CI workflow**

Create the GitHub Actions workflow file.

```yaml
name: CI

on:
  push:
    branches: [ main, dev, fix/*, feat/* ]
  pull_request:
    branches: [ main, dev ]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v4
    
    - name: Use Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20.x'
        cache: 'npm'

    - run: npm ci || npm install
    - run: npm test
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "chore: add GitHub CI workflow"
```
