import { io } from "socket.io-client";

console.log("aios Browser Extension Background Service Worker Starting...");

const socket = io("http://localhost:3002", {
  transports: ["websocket"],
  autoConnect: true,
  reconnection: true,
});

socket.on("connect", () => {
  console.log("Connected to aios Hub");
  socket.emit("register_browser", { id: chrome.runtime.id });
});

socket.on("disconnect", () => {
  console.log("Disconnected from aios Hub");
});

socket.on("browser_command", async (data: any) => {
  console.log("Received command:", data);
  const { command, args, id } = data;

  try {
    let result;
    if (command === "get_active_tab_content") {
      result = await getActiveTabContent();
    } else if (command === "navigate") {
      result = await navigate(args.url);
    } else if (command === "screenshot") {
        // TODO: Implement screenshot
        result = "Screenshot not implemented yet";
    } else {
        throw new Error(`Unknown command: ${command}`);
    }
    
    socket.emit("browser_response", { id, result, status: "success" });
  } catch (error: any) {
    console.error("Error executing command:", error);
    socket.emit("browser_response", { id, error: error.message, status: "error" });
  }
});

async function getActiveTabContent() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab || !tab.id) throw new Error("No active tab found");
  
  const result = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
        // Simple text extraction for now to save tokens, or full HTML
        // Let's return a simplified markdown-like structure or just innerText
        return document.body.innerText; 
    },
  });
  
  return result[0].result;
}

async function navigate(url: string) {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab && tab.id) {
        await chrome.tabs.update(tab.id, { url });
        return `Navigated to ${url}`;
    } else {
        await chrome.tabs.create({ url });
        return `Opened ${url}`;
    }
}
