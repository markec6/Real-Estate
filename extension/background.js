const EXTENSION_SESSION_STORAGE_KEY = "brei:supabase-session";
const LOCAL_WEBSITE_ORIGIN = "http://localhost:3000";
const PRODUCTION_WEBSITE_ORIGIN = "https://real-estate-lac-ten.vercel.app";
const ALLOWED_AUTH_BRIDGE_ORIGINS = new Set([
  LOCAL_WEBSITE_ORIGIN,
  PRODUCTION_WEBSITE_ORIGIN,
]);

chrome.runtime.onInstalled.addListener(() => {
  // Reserved for future extension initialization.
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "BREI_AUTH_SESSION_SYNC") {
    return false;
  }

  const senderOrigin = sender.url ? new URL(sender.url).origin : "";

  if (!ALLOWED_AUTH_BRIDGE_ORIGINS.has(senderOrigin)) {
    console.warn("Rejected auth session sync from unexpected origin.", senderOrigin);
    sendResponse({ ok: false, reason: "origin_not_allowed" });
    return false;
  }

  const storageKey = message.storageKey || EXTENSION_SESSION_STORAGE_KEY;
  const sessionValue = typeof message.sessionValue === "string" ? message.sessionValue : null;
  const storageOperation = sessionValue
    ? chrome.storage.local.set({ [storageKey]: sessionValue })
    : chrome.storage.local.remove(storageKey);

  storageOperation
    .then(() => {
      console.log("[Extension Auth] Background stored website session:", Boolean(sessionValue));
      sendResponse({ ok: true, hasSession: Boolean(sessionValue) });
    })
    .catch((error) => {
      console.error("[Extension Auth] Background session sync failed:", error);
      sendResponse({ ok: false, reason: "storage_failed" });
    });

  return true;
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
