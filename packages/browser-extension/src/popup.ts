document.addEventListener('DOMContentLoaded', () => {
    const statusDiv = document.getElementById('status');
    
    // In a real implementation, we would query the background script
    // chrome.runtime.sendMessage({ action: "get_status" }, (response) => { ... });
    
    // For now, just show that it's installed
    if (statusDiv) {
        statusDiv.textContent = "Extension Installed";
        statusDiv.className = "status connected";
    }
});
