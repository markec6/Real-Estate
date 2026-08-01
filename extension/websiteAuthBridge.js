(() => {
  const WEBSITE_ORIGIN = "https://real-estate-lac-ten.vercel.app";
  const EXTENSION_SESSION_STORAGE_KEY = "brei:supabase-session";
  const WEBSITE_AUTH_EVENT = "BREI_WEBSITE_AUTH_SESSION";

  if (
    window.location.origin !== WEBSITE_ORIGIN ||
    typeof chrome === "undefined" ||
    !chrome.storage?.local
  ) {
    return;
  }

  let lastSessionValue;

  const storeSession = async (sessionValue) => {
    try {
      if (sessionValue) {
        await chrome.storage.local.set({ [EXTENSION_SESSION_STORAGE_KEY]: sessionValue });
      } else {
        await chrome.storage.local.remove(EXTENSION_SESSION_STORAGE_KEY);
      }

      lastSessionValue = sessionValue;
    } catch (error) {
      console.error("[Extension Auth] Could not sync session to extension storage.", error);
      throw error;
    }
  };

  const getSessionUserId = (sessionValue) => {
    if (!sessionValue) {
      return null;
    }

    try {
      const parsedSession = JSON.parse(sessionValue);
      const session = parsedSession.currentSession || parsedSession.session || parsedSession;
      return session?.user?.id ?? null;
    } catch (error) {
      console.error("[Extension Auth] Ignored invalid website session payload.", error);
      return null;
    }
  };

  const handleWebsiteAuthMessage = (event) => {
    if (event.source !== window || event.origin !== WEBSITE_ORIGIN) {
      return;
    }

    const message = event.data;

    if (message?.type !== WEBSITE_AUTH_EVENT) {
      return;
    }

    const sessionValue = typeof message.sessionValue === "string" ? message.sessionValue : null;

    if (sessionValue && !getSessionUserId(sessionValue)) {
      return;
    }

    if (sessionValue === lastSessionValue) {
      return;
    }

    storeSession(sessionValue).catch((error) => {
      console.error("[Extension Auth] Failed to store website session.", error);
    });
  };

  window.addEventListener("message", handleWebsiteAuthMessage);
})();
