import { Command } from 'commander';
import { io } from 'socket.io-client';
import chalk from 'chalk';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import axios from 'axios';

export const mineCommand = new Command('mine')
  .description('Start the mining process (Proof of Dance simulation or Hardware)')
  .option('-u, --url <string>', 'Core Service URL', 'http://localhost:3000')
  .option('-p, --port <string>', 'Serial Port path (e.g. /dev/ttyUSB0 or COM3)')
  .option('-b, --baud <number>', 'Baud Rate', '9600')
  .action(async (options) => {
    console.log(chalk.blue(`[Miner] Connecting to ${options.url}...`));

    const socket = io(options.url, {
        query: { clientType: 'miner', token: 'dev-token' }
    });

    const submitActivity = async (steps: number, danceScore: number) => {
        try {
            const res = await axios.post(
                `${options.url}/api/inspector/replay?token=dev-token`,
                {
                    tool: 'submit_activity',
                    args: { steps, danceScore }
                },
                { headers: { Authorization: 'Bearer dev-token' } }
            );
            console.log(chalk.green(`[Miner] Activity Submitted: ${steps} steps, Score: ${danceScore} -> ${res.data.result}`));
        } catch (e: any) {
            console.error(chalk.red(`[Miner] Error submitting activity: ${e.message}`));
        }
    };

    socket.on('connect', () => {
        console.log(chalk.green('[Miner] Connected to Core!'));

        if (options.port) {
            console.log(chalk.yellow(`[Miner] Initializing Hardware Mode on ${options.port} at ${options.baud} baud...`));
            
            try {
                const port = new SerialPort({ path: options.port, baudRate: parseInt(options.baud) });
                const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

                port.on('open', () => {
                    console.log(chalk.green(`[Miner] Serial Port ${options.port} Open`));
                });

                port.on('error', (err) => {
                    console.error(chalk.red(`[Miner] Serial Port Error: ${err.message}`));
                });

                parser.on('data', (data: any) => {
                    const line = data.toString().trim();
                    console.log(chalk.dim(`[Hardware] Received: ${line}`));
                    
                    try {
                        let steps = 0;
                        let score = 0;

                        if (line.startsWith('{')) {
                            const parsed = JSON.parse(line);
                            steps = parsed.steps || 0;
                            score = parsed.score || 0;
                        } else if (line.includes('steps:')) {
                            const parts = line.split(',');
                            parts.forEach((p: string) => {
                                const [key, val] = p.split(':');
                                if (key.trim() === 'steps') steps = parseInt(val);
                                if (key.trim() === 'score') score = parseInt(val);
                            });
                        }

                        if (steps > 0) {
                            submitActivity(steps, score);
                        }
                    } catch (parseErr) {
                        console.warn(chalk.yellow(`[Miner] Failed to parse hardware data: ${line}`));
                    }
                });

            } catch (err: any) {
                console.error(chalk.red(`[Miner] Failed to open serial port: ${err.message}`));
            }

        } else {
            console.log(chalk.magenta('[Miner] No hardware port specified. Starting Simulation Mode...'));
            
            setInterval(() => {
                const steps = Math.floor(Math.random() * 50);
                const danceScore = Math.floor(Math.random() * 10);
                
                console.log(chalk.dim(`[Simulation] Generated: ${steps} steps, ${danceScore} score`));
                submitActivity(steps, danceScore);
            }, 5000);
        }
    });
  });
