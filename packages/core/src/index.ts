import path from 'path';
import { CoreService } from './server.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Assume we are running from packages/core/dist, so root is ../../..
const ROOT_DIR = path.resolve(__dirname, '../../../');

console.log(`Starting Super AI Plugin Core from ${ROOT_DIR}`);

const service = new CoreService(ROOT_DIR);
service.start(3000);
