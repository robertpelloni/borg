// Content script to scrape page details
console.log('Super AI Content Script Loaded');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'read_page') {
        sendResponse({
            title: document.title,
            url: window.location.href,
            content: document.body.innerText.substring(0, 5000) // Truncate
        });
    }
});
