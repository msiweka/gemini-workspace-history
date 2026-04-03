import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { promisify } from 'util';

const gunzip = promisify(zlib.gunzip);
const HISTORY_DIR = '.gemini-workspace-history';

async function getAllFiles(pattern) {
    if (!fs.existsSync(HISTORY_DIR)) return [];
    return fs.readdirSync(HISTORY_DIR)
        .filter(f => pattern.test(f))
        .map(name => ({
            name,
            path: path.join(HISTORY_DIR, name),
            mtime: fs.statSync(path.join(HISTORY_DIR, name)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);
}

async function main() {
    if (!fs.existsSync(HISTORY_DIR)) {
        fs.mkdirSync(HISTORY_DIR, { recursive: true });
    }

    const sessions = await getAllFiles(/^session-.*\.json\.gz$/);
    const summaries = await getAllFiles(/^summary-.*\.md$/);
    
    const latestSession = sessions[0];
    const secondLatestSession = sessions[1];
    const latestSummary = summaries[0];
    
    const activeContextPath = path.join(HISTORY_DIR, 'active-context.md');

    let systemMessage = "";
    let isSummaryCurrent = false;

    // A summary is current if it's newer than the end of the session BEFORE the last one.
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

    // Success output with the dynamic system message
    process.stdout.write(JSON.stringify({
        systemMessage: systemMessage
    }));
}

main().catch(console.error);
