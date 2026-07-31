(() => {
  const LOCAL_WEBSITE_ORIGIN = "http://localhost:3000";
  const PRODUCTION_WEBSITE_ORIGIN = "https://real-estate-lac-ten.vercel.app";
  const ALLOWED_WEBSITE_ORIGINS = new Set([
    LOCAL_WEBSITE_ORIGIN,
    PRODUCTION_WEBSITE_ORIGIN,
  ]);
  const SUPABASE_WEBSITE_STORAGE_KEY = "sb-uvexonxityogdjfuqmus-auth-token";
  const EXTENSION_SESSION_STORAGE_KEY = "brei:supabase-session";
  const WEBSITE_AUTH_EVENT = "BREI_WEBSITE_AUTH_SESSION";
  const SYNC_INTERVAL_MS = 3000;
  const BASE64_COOKIE_PREFIX = "base64-";

  if (
    !ALLOWED_WEBSITE_ORIGINS.has(window.location.origin) ||
    typeof chrome === "undefined" ||
    !chrome.runtime?.sendMessage
  ) {
    return;
  }

  let lastSessionValue;

  const parseCookies = () =>
    document.cookie
      .split(";")
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .reduce((cookies, cookie) => {
        const separatorIndex = cookie.indexOf("=");

        if (separatorIndex === -1) {
          return cookies;
        }

        const name = decodeURIComponent(cookie.slice(0, separatorIndex));
        const value = decodeURIComponent(cookie.slice(separatorIndex + 1));
        cookies[name] = value;
        return cookies;
      }, {});

  const decodeBase64Url = (value) => {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    return decodeURIComponent(
      Array.from(window.atob(padded), (character) =>
        `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`,
      ).join(""),
    );
  };

  const normalizeSessionValue = (value) => {
    if (!value) {
      return null;
    }

    if (value.startsWith(BASE64_COOKIE_PREFIX)) {
      try {
        return decodeBase64Url(value.slice(BASE64_COOKIE_PREFIX.length));
      } catch (error) {
        console.error("Balkan Real Estate auth bridge could not decode Supabase cookie.", error);
        return null;
      }
    }

    return value;
  };

  const normalizePostedSessionValue = (sessionValue) => {
    if (!sessionValue || typeof sessionValue !== "string") {
      return null;
    }

    try {
      const parsed = JSON.parse(sessionValue);

      if (parsed && typeof parsed === "object") {
        if (parsed.currentSession) {
          return JSON.stringify(parsed.currentSession);
        }

        if (parsed.access_token || parsed.refresh_token || parsed.user) {
          return sessionValue;
        }
      }
    } catch {
      // Keep the raw string if it is already a storage payload.
    }

    return sessionValue;
  };

  const readChunkedCookie = (cookies, key) => {
    if (cookies[key]) {
      return cookies[key];
    }

    const chunks = [];

    for (let index = 0; index < 10; index += 1) {
      const chunk = cookies[`${key}.${index}`];

      if (!chunk) {
        break;
      }

      chunks.push(chunk);
    }

    return chunks.length > 0 ? chunks.join("") : null;
  };

  const readSessionFromApi = async () => {
    try {
      const response = await fetch(`${window.location.origin}/api/auth/session`, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        return null;
      }

      const payload = await response.json();

      if (!payload?.authenticated || !payload?.session) {
        return null;
      }

      return JSON.stringify(payload.session);
    } catch (error) {
      console.error("Balkan Real Estate auth bridge session API failed.", error);
      return null;
    }
  };

  const readWebsiteSession = async () => {
    const localStorageSession = window.localStorage.getItem(SUPABASE_WEBSITE_STORAGE_KEY);

    if (localStorageSession) {
      return localStorageSession;
    }

    const cookieSession = normalizeSessionValue(
      readChunkedCookie(parseCookies(), SUPABASE_WEBSITE_STORAGE_KEY),
    );

    if (cookieSession) {
      return cookieSession;
    }

    return readSessionFromApi();
  };

  const broadcastSession = async (sessionValue) => {
    const response = await chrome.runtime.sendMessage({
      type: "BREI_AUTH_SESSION_SYNC",
      sessionValue,
      storageKey: EXTENSION_SESSION_STORAGE_KEY,
      sourceOrigin: window.location.origin,
    });

    console.log("Balkan Real Estate auth bridge broadcast session:", response);
  };

  const syncSession = async (forcedSessionValue) => {
    const sessionValue =
      typeof forcedSessionValue === "undefined"
        ? await readWebsiteSession()
        : forcedSessionValue;

    if (sessionValue === lastSessionValue) {
      return;
    }

    lastSessionValue = sessionValue;

    try {
      await broadcastSession(sessionValue);
    } catch (error) {
      console.error("Balkan Real Estate auth bridge failed to broadcast session.", error);
    }

    try {
      if (sessionValue) {
        await chrome.storage?.local?.set({ [EXTENSION_SESSION_STORAGE_KEY]: sessionValue });
        return;
      }

      await chrome.storage?.local?.remove(EXTENSION_SESSION_STORAGE_KEY);
    } catch (error) {
      console.error("Balkan Real Estate auth bridge failed to sync session.", error);
    }
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "BREI_SYNC_AUTH_SESSION") {
      return false;
    }

    syncSession()
      .then(() => {
        sendResponse({ ok: true, hasSession: Boolean(lastSessionValue) });
      })
      .catch((error) => {
        console.error("Balkan Real Estate auth bridge manual sync failed.", error);
        sendResponse({ ok: false, hasSession: false });
      });

    return true;
  });

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== window.location.origin) {
      return;
    }

    if (event.data?.type !== WEBSITE_AUTH_EVENT) {
      return;
    }

    void syncSession(normalizePostedSessionValue(event.data.sessionValue));
  });

  window.addEventListener("storage", (event) => {
    if (event.key === SUPABASE_WEBSITE_STORAGE_KEY) {
      void syncSession();
    }
  });

  window.addEventListener("focus", () => {
    void syncSession();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void syncSession();
    }
  });

  void syncSession();
  window.setInterval(() => {
    void syncSession();
  }, SYNC_INTERVAL_MS);
})();
