import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export class InputManager {
    async sendKeys(keys: string) {
        // Map common keys to SendKeys format
        const keyMap: Record<string, string> = {
            'ctrl+r': '^{r}',
            'f5': '{F5}',
            'enter': '{ENTER}',
            'esc': '{ESC}'
        };

        const command = keyMap[keys.toLowerCase()] || keys;

        // PowerShell script to use WScript.Shell SendKeys
        const psCommand = `
            $wshell = New-Object -ComObject wscript.shell;
            $wshell.SendKeys('${command}')
        `;

        try {
            await execAsync(`powershell -Command "${psCommand}"`);
            return `Successfully sent keys: ${keys}`;
        } catch (error: any) {
            return `Error sending keys: ${error.message}`;
        }
    }
}
