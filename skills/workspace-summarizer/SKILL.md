---
name: workspace-summarizer
description: Summarizes your last work
---

# Workspace Summarizer

## Goal
Manage technical summaries and context for the current workspace.

## Instructions
- ALWAYS check the provided `<extension_context>` for `.gemini-workspace-history/active-context.md` at the start of this skill.
- If the content is already present in the context, use it directly to avoid redundant file reads.
- Summarize the last workspace history immediately after activation.
- **Format:** The summary must follow the structure of existing `summary-*.md` files:
  - Brief technical overview.
  - List of modified files.
  - Key logic changes and architectural decisions.
  - Unresolved issues or next steps.
- When summarizing, be technical and concise.

## Tools
You can use standard file tools to write and read the summary if it is not present in the context.
