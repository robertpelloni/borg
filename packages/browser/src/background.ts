import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
    query: { clientType: 'browser' },
    transports: ['websocket']
});

socket.on('connect', () => {
    console.log('Browser Extension Connected to Hub');
});

socket.on('hook_event', (event: any) => {
    if (event.type === 'inject_context') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    func: (text) => {
                        const activeElement = document.activeElement as HTMLElement;
                        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)) {
                            // Simple injection
                            (activeElement as any).value = text;
                             // Trigger input event
                            activeElement.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    },
                    args: [event.text]
                });
            }
        });
    }
});
