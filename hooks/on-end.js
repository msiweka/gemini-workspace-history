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

    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    const destination = path.join(HISTORY_DIR, `session-${timestamp}.json.gz`);

    const transcript = fs.readFileSync(transcriptPath);
    const compressed = await gzip(transcript);

    fs.writeFileSync(destination, compressed);
}

main().catch(console.error);
