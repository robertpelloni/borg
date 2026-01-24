
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export class InputTools {
    async sendKeys(keys: string) {
        // Map common keys to SendKeys format
        const keyMap: Record<string, string> = {
            'ctrl+r': '^{r}',
            'f5': '{F5}',
            'enter': '{ENTER}',
            'esc': '{ESC}',
            'control+enter': '^{ENTER}',
            'ctrl+enter': '^{ENTER}',
            'shift+enter': '+{ENTER}',
            'alt+enter': '%{ENTER}',
            'alt': '%',
            'tab': '{TAB}'
        };

        const command = keyMap[keys.toLowerCase()] || keys;

        // PowerShell script to use WScript.Shell SendKeys
        // FORCE FOCUS: Try to activate VS Code first (Process or Title)
        const psCommand = `
            $wshell = New-Object -ComObject wscript.shell;
            if ($wshell.AppActivate('Visual Studio Code')) {
                Start-Sleep -Milliseconds 100;
                $wshell.SendKeys('${command}')
            } elseif ($wshell.AppActivate('Code')) {
                Start-Sleep -Milliseconds 100;
                $wshell.SendKeys('${command}')
            } else {
                # Fallback: Just send keys
                $wshell.SendKeys('${command}')
            }
        `;

        try {
            await execAsync(`powershell -Command "${psCommand}"`);
            return `Successfully sent keys: ${keys}`;
        } catch (error: any) {
            return `Error sending keys: ${error.message}`;
        }
    }
}
