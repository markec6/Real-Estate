chrome.runtime.onInstalled.addListener(() => {
  // Reserved for future extension initialization.
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) {
    console.warn("Extension icon clicked, but no active tab ID was available.");
    return;
  }

  await chrome.sidePanel.open({ tabId: tab.id });

  console.log("Side panel opened from extension icon click.", {
    tabId: tab.id,
    url: tab.url,
  });
});
