# Gemini Workspace History

Persistent session continuity for the Gemini CLI.

Gemini Workspace History is a Gemini CLI extension designed to provide continuity between AI-assisted coding sessions within a specific workspace. It solves "context amnesia" by automatically restoring the latest technical summary at the start of every session and archiving transcripts at the end.

## Key Features

- **Context Restoration:** Automatic injection of the latest session summary (`active-context.md`) into the current context.
- **Session Archiving:** Automatic Gzip compression of session transcripts for long-term history.
- **Controlled Exit:** Custom `close-workspace` command ensures a high-quality summary is generated before closing.
- **Workspace Summarizer Skill:** A dedicated skill to assist in generating and managing session summaries.
- **Local Storage:** All history (summaries, compressed transcripts, and active context) is kept within the project's `.gemini-workspace-history/` directory.

## Getting Started

### Installation

To use this extension in your project, link it to your Gemini CLI:

```bash
gemini extension link .
```

### Usage Workflow

1. **Start:** When you start a new session (`gemini`), the `on-start.js` hook identifies the latest summary and prepares `active-context.md`.
2. **Work:** The Gemini CLI automatically loads `active-context.md` into your session context.
3. **End:** Use the `/close-workspace` (or your custom command name) to summarize your work and exit cleanly.

### Commands

- `/close-workspace`: Prompts the agent to write a structured technical summary of the current session and then saves it to `.gemini-workspace-history/` using standard tools before exiting. This is the recommended way to end a session to ensure continuity.

## Under the Hood

### Directory Structure

The extension maintains all its data in the `.gemini-workspace-history/` directory:
- `active-context.md`: The summary currently being injected into the session.
- `session-YYYY-MM-DD-HH-mm.json.gz`: Compressed session transcripts.
- `summary-YYYY-MM-DD-HH-mm.md`: Individual session summaries.

### Technical Implementation

- **Lifecycle Hooks:**
    - `SessionStart`: Executes `hooks/on-start.js` to prepare the active context from the most recent session summary and history.
    - `SessionEnd`: Executes `hooks/on-end.js` to archive the session transcript as a compressed Gzipped JSON file.
- **Context Injection:** The `gemini-extension.json` manifest is configured with `contextFileName: ".gemini-workspace-history/active-context.md"`, which the CLI uses to automatically include the file in every session.
- **Hooks Configuration:** Lifecycle hooks are managed via `hooks/hooks.json`.
- **Skills:** Includes the `workspace-summarizer` skill to help maintain session continuity.
