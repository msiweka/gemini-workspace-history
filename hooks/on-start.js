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
        // We use synchronous read for simplicity in hooks
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

    process.stdout.write(JSON.stringify({}));
}

main().catch(console.error);
