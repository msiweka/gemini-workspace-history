import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const HISTORY_DIR = '.gemini-workspace-history';

async function main() {
    let input = '';
    try {
        // Read stdin synchronously to ensure we get data before process exit
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
        log(`Failed to parse input: ${e.message}`);
        return;
    }

    const transcriptPath = data.transcript_path;

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
