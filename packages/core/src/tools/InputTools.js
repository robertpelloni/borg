import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
export class InputTools {
    async sendKeys(keys, forceFocus = false) {
        console.error(`[InputTools] ⌨️ Sending keys: ${keys} (Focus: ${forceFocus})`);
        // Map keys to VBScript SendKeys format
        const vbMap = {
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
                try {
                    fs.unlinkSync(tempFile);
                }
                catch (e) { }
                if (code === 0)
                    resolve(`Sent keys: ${keys}`);
                else
                    reject(new Error(`wscript exited with code ${code}`));
            });
            child.on('error', (err) => {
                try {
                    fs.unlinkSync(tempFile);
                }
                catch (e) { }
                reject(err);
            });
        });
    }
}
