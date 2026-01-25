
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export class InputTools {
    async sendKeys(keys: string, forceFocus: boolean = false) {
        console.error(`[InputTools] ⌨️ Sending keys: ${keys} (Focus: ${forceFocus})`);

        // 1. Try Direct Injection (The "God Mode" Fix)
        try {
            // @ts-ignore
            const { ProcessRegistry } = await import("../os/ProcessRegistry.js");
            const process = ProcessRegistry.getLatest();
            if (process && process.stdin) {
                console.error(`[InputTools] 💉 Injecting '${keys}' directly into Process Stdin`);
                // Normalize Keys for Stdin
                let input = keys;
                if (keys.toLowerCase() === 'y') input = 'y';
                if (keys.toLowerCase() === 'n') input = 'n';
                if (keys.toLowerCase().includes('enter')) input = '\n';

                // If it's a combo like 'y' then 'enter' (which usually comes separate), just write it.
                // But Director sends 'y', then 'enter'.
                // If keys is just 'y', we write 'y'.
                // If keys is 'enter', we write '\n'.

                process.stdin.write(input);
                if (input !== '\n' && input !== '\r') {
                    // Auto-flush?? stream writes are usually buffered or flush immediately.
                }
                return `Injected: ${keys}`;
            }
        } catch (e) {
            console.error(`[InputTools] Injection Failed (ignoring):`, e);
        }

        // 2. Fallback to VBScript (if no active process or injection failed)
        console.error(`[InputTools] 📺 Fallback to VBScript...`);

        // Map keys to VBScript SendKeys format
        const vbMap: Record<string, string> = {
            'ctrl+r': '^r',
            'f5': '{F5}',
            'enter': '{ENTER}',
            'esc': '{ESC}',
            'control+enter': '^{ENTER}',
            'ctrl+enter': '^{ENTER}',
            'shift+enter': '+{ENTER}',
            'alt+enter': '%{ENTER}',
            'y': 'y'
        };

        const command = vbMap[keys.toLowerCase()] || keys;

        // Create VBScript file
        let focusLogic = "";
        if (forceFocus) {
            focusLogic = `
            ' Try to focus commonly used windows
            On Error Resume Next
            Set WshShell = WScript.CreateObject("WScript.Shell")
            WshShell.AppActivate "Code - Insiders"
            WshShell.AppActivate "Visual Studio Code"
            WshShell.AppActivate "Code"
            WshShell.AppActivate "borg"
            WshShell.AppActivate "Terminal"
            On Error GoTo 0
            `;
        }

        const vbsContent = `
Set WshShell = WScript.CreateObject("WScript.Shell")
${focusLogic}
WScript.Sleep 50
WshShell.SendKeys "${command}"
`;

        const tempFile = path.join(os.tmpdir(), `borg_input_${Date.now()}.vbs`);
        fs.writeFileSync(tempFile, vbsContent);

        return new Promise((resolve, reject) => {
            // Use wscript (GUI) + windowsHide: true to prevent focus stealing console
            const child = spawn('wscript', ['//Nologo', tempFile], {
                stdio: 'ignore',
                windowsHide: true,
                detached: false
            });

            child.on('close', (code) => {
                try { fs.unlinkSync(tempFile); } catch (e) { }
                if (code === 0) resolve(`Sent keys: ${keys}`);
                else reject(new Error(`wscript exited with code ${code}`));
            });

            child.on('error', (err) => {
                try { fs.unlinkSync(tempFile); } catch (e) { }
                reject(err);
            });
        });
    }
}
