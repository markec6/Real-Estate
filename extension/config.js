// config.js
(() => {
  const LOCAL_WEBSITE_ORIGIN = "http://localhost:3000";
  const PRODUCTION_WEBSITE_ORIGIN = "https://real-estate-lac-ten.vercel.app";

  // Side panel runs on chrome-extension://, so always point login/dashboard at production
  // unless the extension is being developed against a local Next.js app.
  const WEBSITE_ORIGIN = PRODUCTION_WEBSITE_ORIGIN;

  const SUPABASE_URL = "https://uvexonxityogdjfuqmus.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_eXLcaDBO5nRiQkuJ0j5dJA_2K7Vf4ly";
  const SUPABASE_PROJECT_REF = "uvexonxityogdjfuqmus";
  const SUPABASE_WEBSITE_STORAGE_KEY = `sb-${SUPABASE_PROJECT_REF}-auth-token`;
  const EXTENSION_SESSION_STORAGE_KEY = "brei:supabase-session";
  const WEBSITE_LOGIN_URL = `${WEBSITE_ORIGIN}?openAuth=true`;
  const WEBSITE_DASHBOARD_URL = `${WEBSITE_ORIGIN}/dashboard`;
  const WEBSITE_SESSION_API_URL = `${WEBSITE_ORIGIN}/api/auth/session`;
  const ALLOWED_WEBSITE_ORIGINS = [LOCAL_WEBSITE_ORIGIN, PRODUCTION_WEBSITE_ORIGIN];

  const chromeStorageAuthAdapter = {
    async getItem(key) {
      try {
        const result = await chrome.storage.local.get(key);
        return result[key] ?? null;
      } catch (e) {
        return null;
      }
    },

    async setItem(key, value) {
      try {
        await chrome.storage.local.set({ [key]: value });
      } catch (e) {}
    },

    async removeItem(key) {
      try {
        await chrome.storage.local.remove(key);
      } catch (e) {}
    },
  };

  window.breiConfig = {
    ALLOWED_WEBSITE_ORIGINS,
    EXTENSION_SESSION_STORAGE_KEY,
    SUPABASE_WEBSITE_STORAGE_KEY,
    WEBSITE_DASHBOARD_URL,
    WEBSITE_LOGIN_URL,
    WEBSITE_ORIGIN,
    WEBSITE_SESSION_API_URL,
  };

  // Sigurno kreiranje Supabase klijenta bez pucanja varijabli
  if (!window.breiSupabase && window.supabase?.createClient) {
    window.breiSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
        storage: chromeStorageAuthAdapter,
        storageKey: EXTENSION_SESSION_STORAGE_KEY,
      },
    });
  }
})();
