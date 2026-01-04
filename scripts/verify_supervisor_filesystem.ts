import { io } from 'socket.io-client';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const SOCKET_URL = 'http://localhost:3002';
const API_URL = 'http://localhost:3002/api/supervisor/task';
const TARGET_FILE = path.resolve(process.cwd(), 'hello_supervisor.txt');

async function verify() {
  console.log('Connecting to socket...');
  const socket = io(SOCKET_URL);

  // Clean up previous run
  if (fs.existsSync(TARGET_FILE)) {
      fs.unlinkSync(TARGET_FILE);
  }

  socket.on('connect', () => {
    console.log('Connected to socket!');
    
    // Trigger task after connection
    setTimeout(async () => {
        console.log('Triggering filesystem task...');
        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    task: `Create a file named '${TARGET_FILE}' with the content 'Hello from the Supervisor!'. Verify it was created by reading it back.` 
                })
            });
            const data = await res.json();
            console.log('Task trigger response:', data);
        } catch (e) {
            console.error('Failed to trigger task:', e);
            process.exit(1);
        }
    }, 1000);
  });

  socket.on('supervisor:log', (log) => {
    console.log(`[${log.type}] ${log.message}`);
  });

  socket.on('supervisor:status', (status) => {
    console.log('Received status:', status);
    
    if (status === 'completed') {
        console.log('Task reported completion. Checking file system...');
        
        if (fs.existsSync(TARGET_FILE)) {
            const content = fs.readFileSync(TARGET_FILE, 'utf-8');
            if (content.includes('Hello from the Supervisor!')) {
                console.log('SUCCESS: File created with correct content.');
                // Cleanup
                fs.unlinkSync(TARGET_FILE);
                process.exit(0);
            } else {
                console.error(`FAILURE: File content mismatch. Got: "${content}"`);
                process.exit(1);
            }
        } else {
            console.error('FAILURE: File was not created.');
            process.exit(1);
        }
    } else if (status === 'failed') {
        console.error('FAILURE: Task failed according to Supervisor.');
        process.exit(1);
    }
  });

  // Timeout
  setTimeout(() => {
    console.error('Verification Timeout: Task did not complete in time.');
    process.exit(1);
  }, 60000);
}

verify();
