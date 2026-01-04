import { Server } from 'socket.io';
import fs from 'fs/promises';
import path from 'path';

// Define minimal interfaces to avoid importing from core and causing build issues
export interface IAgentDefinition {
  name: string;
  description: string;
  instructions: string;
  model?: string;
}

export interface IAgentExecutor {
  on(event: string, listener: (...args: any[]) => void): this;
  off(event: string, listener: (...args: any[]) => void): this;
  run(agent: IAgentDefinition, task: string, context?: any): Promise<string | null>;
}

export interface SupervisorOptions {
  io?: Server;
  agentExecutor?: IAgentExecutor;
  promptsDir?: string;
}

export class SupervisorPlugin {
  private io?: Server;
  private agentExecutor?: IAgentExecutor;
  private promptsDir: string;

  constructor(options: SupervisorOptions = {}) {
    this.io = options.io;
    this.agentExecutor = options.agentExecutor;
    // Default to a sensible path if not provided, though injecting it is better
    this.promptsDir = options.promptsDir || path.resolve(process.cwd(), 'packages/core/prompts');
  }

  public setSocketServer(io: Server) {
    this.io = io;
  }

  public setAgentExecutor(executor: IAgentExecutor) {
    this.agentExecutor = executor;
  }
  
  public setPromptsDir(dir: string) {
      this.promptsDir = dir;
  }

  private log(message: string, type: 'info' | 'error' | 'success' | 'warning' = 'info') {
    const logEntry = {
      timestamp: new Date().toISOString(),
      message,
      type
    };
    
    // Console log for backend debugging
    console.log(`[Supervisor] ${message}`);

    // Emit to frontend if socket is available
    if (this.io) {
      this.io.emit('supervisor:log', logEntry);
    }
  }

  private async getSupervisorInstructions(): Promise<string> {
      try {
          const promptPath = path.join(this.promptsDir, 'supervisor.md');
          const content = await fs.readFile(promptPath, 'utf-8');
          return content;
      } catch (e) {
          this.log('Failed to load supervisor prompt from file. Using fallback.', 'warning');
          return `You are an expert technical supervisor. Your goal is to break down the user's task into steps and execute them using the available tools.
1.  **Analyze** the request.
2.  **Plan** the execution.
3.  **Execute** the plan using tools like 'bash', 'write', 'read', etc.
4.  **Verify** the result.

Always inform the user of your progress.`;
      }
  }

  public async executeTask(task: string) {
    this.log(`Received task: ${task}`, 'info');
    
    if (!this.agentExecutor) {
      this.log('AgentExecutor not initialized. Cannot execute task.', 'error');
      throw new Error('AgentExecutor not initialized');
    }

    if (this.io) {
      this.io.emit('supervisor:status', 'planning');
    }

    try {
      const instructions = await this.getSupervisorInstructions();

      // Define the Supervisor Agent
      const supervisorAgent: IAgentDefinition = {
        name: "Supervisor",
        description: "Orchestrates complex tasks by planning and delegating.",
        instructions: instructions,
        model: "gpt-4-turbo" // Or configurable
      };

      // Hook into AgentExecutor events to stream logs
      const logListener = (data: any) => {
         // Try to interpret internal executor events as user-friendly logs
         if (data.agent) {
             this.log(`Agent ${data.agent} started task: ${data.task}`, 'info');
         }
      };
      
      const toolListener = (data: any) => {
          this.log(`Calling tool: ${data.name}`, 'warning');
      };

      const resultListener = (result: string) => {
          this.log(`Result: ${result}`, 'success');
      };

      this.agentExecutor.on('start', logListener);
      this.agentExecutor.on('tool_call', toolListener);
      // We can't easily listen to 'result' globally, but run returns it.

      if (this.io) this.io.emit('supervisor:status', 'executing');

      // Execute the task
      const result = await this.agentExecutor.run(supervisorAgent, task);

      // Cleanup listeners
      this.agentExecutor.off('start', logListener);
      this.agentExecutor.off('tool_call', toolListener);

      if (this.io) this.io.emit('supervisor:status', 'completed');
      this.log('Task completed successfully.', 'success');
      
      return { success: true, message: result };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log(`Task failed: ${errorMessage}`, 'error');
      if (this.io) this.io.emit('supervisor:status', 'failed');
      throw error;
    }
  }
}
