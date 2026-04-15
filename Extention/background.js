chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "speedread",
    title: "Speed Read selection",
    contexts: ["selection"]
  });
});

// Right-click context menu
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "speedread") {
    chrome.tabs.sendMessage(tab.id, {
      action: "openReader",
      text: info.selectionText
    });
  }
});

// Keyboard shortcut (Alt+S)
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "open-reader") {
    // Grab selected text from the page then open the reader
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection().toString()
    }, (results) => {
      const text = results && results[0] && results[0].result ? results[0].result : '';
      chrome.tabs.sendMessage(tab.id, {
        action: "openReader",
        text: text
      });
    });
  }
});
