import fs from 'fs';
import path from 'path';

const HISTORY_DIR = '.gemini-workspace-history';

function main() {
    const summary = process.argv[2];
    if (!summary) {
        console.error("Usage: node commands/summarize.js \"<summary_text>\"");
        process.exit(1);
    }

    if (!fs.existsSync(HISTORY_DIR)) {
        fs.mkdirSync(HISTORY_DIR, { recursive: true });
    }

    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    const filename = `summary-${timestamp}.md`;
    const filePath = path.join(HISTORY_DIR, filename);

    const content = `# Session Summary - ${now.toLocaleString()}\n\n${summary}`;
    
    fs.writeFileSync(filePath, content);
    console.log(`Summary saved to ${filePath}`);
}

main();
