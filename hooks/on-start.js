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
