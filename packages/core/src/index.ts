import { CoreService } from './server.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve root directory correctly regardless of CWD
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Dist is ./dist, so package root is ../
const ROOT_DIR = path.resolve(__dirname, '..');

console.log(`[Core] Starting aios Hub from ${ROOT_DIR}`);

const service = new CoreService(ROOT_DIR);
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3002;

service.start(PORT).catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
