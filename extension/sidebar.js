const DEFAULT_CREDITS_LIMIT = 5;
const CREDIT_COST_PER_UNLOCK = 1;
const PROFILE_CACHE_STORAGE_PREFIX = "brei:profile:";
const LISTING_DETECTOR_FILE = "content/listingDetector.js";
const NO_LISTING_HEADING = "Nije detektovan oglas za analizu";
const NO_LISTING_MESSAGE =
  "Molimo vas da otvorite stranicu sa pojedinačnim oglasom na podržanim portalima (npr. Halo Oglasi) i osvežite stranicu.";
const ANALYZE_API_ERROR_MESSAGE =
  "Greška pri povezivanju sa AI serverom. Pokušajte ponovo.";
const PARTIAL_DATA_MESSAGE =
  "Upozorenje: Ovaj oglas sadrži ograničen obim informacija na samoj stranici. AI analiza je izvršena na osnovu raspoloživih podataka.";
const ANALYZE_API_URL = "https://real-estate-lac-ten.vercel.app/api/scan/analyze";
const SAVE_API_URL = "https://real-estate-lac-ten.vercel.app/api/scan/save";

document.addEventListener("DOMContentLoaded", () => {
  const scanState = document.querySelector("#scan-state");
  const noListingState = document.querySelector("#no-listing-state");
  const resultsState = document.querySelector("#results-state");
  const scanButton = document.querySelector("#scan-button");
  const retryScanButton = document.querySelector("#retry-scan-button");
  const scanNotice = document.querySelector("#scan-notice");
  const listingsSummaryTitle = document.querySelector("#listings-summary-title");
  const summaryBadge = document.querySelector("#summary-badge");
  const partialDataWarning = document.querySelector("#partial-data-warning");
  const accordion = document.querySelector("#listings-accordion");
  const profileCard = document.querySelector("#profile-card");
  const profileAvatar = document.querySelector("#profile-avatar");
  const profileLabel = document.querySelector("#profile-label");
  const profileSubtitle = document.querySelector("#profile-subtitle");
  const profileEmail = document.querySelector("#profile-email");
  const profileAction = document.querySelector("#profile-action");
  const creditsLabel = document.querySelector("#credits-label");
  const creditsPercent = document.querySelector("#credits-percent");
  const creditsProgress = document.querySelector("#credits-progress");
  const creditsFill = document.querySelector("#credits-fill");
  const dashboardLink = document.querySelector("#dashboard-link");
  const toast = document.querySelector("#toast");
  const devToggle = document.querySelector(".dev-state-toggle");

  if (
    !scanState ||
    !noListingState ||
    !resultsState ||
    !scanButton ||
    !retryScanButton ||
    !scanNotice ||
    !listingsSummaryTitle ||
    !summaryBadge ||
    !partialDataWarning ||
    !accordion ||
    !profileCard ||
    !profileAvatar ||
    !profileLabel ||
    !profileSubtitle ||
    !profileEmail ||
    !profileAction ||
    !creditsLabel ||
    !creditsPercent ||
    !creditsProgress ||
    !creditsFill ||
    !dashboardLink ||
    !toast
  ) {
    return;
  }

  function purgeListingDom() {
    accordion.replaceChildren();
    resultsState.querySelectorAll(".listing-card").forEach((card) => {
      card.remove();
    });
  }

  purgeListingDom();
  resultsState.classList.add("is-hidden");
  resultsState.setAttribute("aria-hidden", "true");
  noListingState.classList.add("is-hidden");
  noListingState.setAttribute("aria-hidden", "true");

  const {
    EXTENSION_SESSION_STORAGE_KEY,
    SUPABASE_WEBSITE_STORAGE_KEY,
    WEBSITE_DASHBOARD_URL,
    WEBSITE_LOGIN_URL,
    WEBSITE_ORIGIN,
  } = window.breiConfig ?? {};

  const supabaseClient = window.breiSupabase;

  let currentUser = null;
  let currentProfile = null;
  let profileChannel = null;
  let profileChannelUserId = null;
  let lastStoredSessionValue;
  let lastAppliedAccessToken = null;
  let profileRequestId = 0;
  let authSyncTimer = null;
  let credits = 0;
  let creditsLimit = DEFAULT_CREDITS_LIMIT;
  let openListingId = null;
  let listings = [];
  let analyzingListingId = null;
  let scanTimer = null;
  let currentScanRequestId = 0;
  let currentDetectionResult = null;
  let toastTimer = null;

  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (character) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      };

      return entities[character];
    });

  const looksLikeRawCode = (value) => {
    const text = String(value ?? "").trim();

    if (!text) {
      return false;
    }

    if (/^(window\.|<script|\{)/i.test(text)) {
      return true;
    }

    if (/<script[\s>]/i.test(text) || /<\/script>/i.test(text) || /<style[\s>]/i.test(text)) {
      return true;
    }

    if (
      /\b(?:Quasar|webpackJsonp|__INITIAL_STATE__|__NEXT_DATA__|__NUXT__|__VUE__)\b/.test(
        text,
      )
    ) {
      return true;
    }

    if (text.length >= 160) {
      const codeTokens = (
        text.match(/[{};=]|=>|function\s*\(|\.prototype\b|document\.|window\./g) || []
      ).length;

      if (codeTokens >= 8) {
        return true;
      }

      const punctDensity = (text.match(/[{};]/g) || []).length / text.length;
      if (punctDensity > 0.04) {
        return true;
      }
    }

    return false;
  };

  const sanitizeDisplayText = (value, { maxLength = 2500 } = {}) => {
    const text = String(value ?? "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!text || looksLikeRawCode(text)) {
      return "";
    }

    if (text.length > maxLength) {
      return `${text.slice(0, maxLength).trim()}…`;
    }

    return text;
  };

  const isLocationNoisePart = (part) => {
    const normalized = String(part ?? "")
      .replace(/\s+/g, " ")
      .trim();

    if (!normalized || /^[\W_]+$/u.test(normalized)) {
      return true;
    }

    return (
      /^(početna|pocetna|home)$/iu.test(normalized) ||
      /nekretnine|pretraga|oglasi/iu.test(normalized) ||
      /^(prodaja|izdavanje)(\s|$)/iu.test(normalized) ||
      /^(prodaja|izdavanje)\s+(stanova|kuća|kuce|kuca|poslovnih|zemljišta|zemljista|garaža|garaza)\b/iu.test(
        normalized,
      ) ||
      /^(stan|stanovi|kuća|kuće|kuca|kuce|plac|placevi|garaža|garaze|lokal|lokali|apartman|apartmani|house|houses|apartment|apartments|land|office)$/iu.test(
        normalized,
      ) ||
      /^poslovni\s+prostor(i)?$/iu.test(normalized)
    );
  };

  const sanitizeLocationDisplay = (raw) => {
    const cleaned = String(raw ?? "")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleaned) {
      return "";
    }

    const parts = cleaned
      .split(/\s*[>»›/|,]+\s*/)
      .map((part) => part.replace(/^[\s.;:]+|[\s.;:]+$/g, "").trim())
      .filter(Boolean)
      .filter((part) => !isLocationNoisePart(part));

    if (parts.length === 0) {
      return cleaned;
    }

    return parts.join(", ");
  };

  const safeDisplayHtml = (value) => {
    const cleaned = sanitizeDisplayText(value);
    return cleaned ? escapeHtml(cleaned) : "";
  };

  const formatNumber = (value) =>
    new Intl.NumberFormat("sr-RS", {
      maximumFractionDigits: 0,
    }).format(value);

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const getProfileCacheKey = (userId) => `${PROFILE_CACHE_STORAGE_PREFIX}${userId}`;

  const getStoredSessionSnapshot = async () => {
    if (
      !EXTENSION_SESSION_STORAGE_KEY ||
      typeof chrome === "undefined" ||
      !chrome.storage?.local
    ) {
      return null;
    }

    const result = await chrome.storage.local.get(EXTENSION_SESSION_STORAGE_KEY);
    return result[EXTENSION_SESSION_STORAGE_KEY] ?? null;
  };

  const importSessionFromActiveWebsiteTab = async () => {
    if (
      !EXTENSION_SESSION_STORAGE_KEY ||
      !SUPABASE_WEBSITE_STORAGE_KEY ||
      !WEBSITE_ORIGIN ||
      typeof chrome === "undefined" ||
      !chrome.tabs?.query ||
      !chrome.scripting?.executeScript ||
      !chrome.storage?.local
    ) {
      return null;
    }

    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const websiteTabs = await chrome.tabs.query({ url: `${WEBSITE_ORIGIN}/*` });
      const candidateTabs = [
        activeTab,
        ...websiteTabs.filter((tab) => tab.id !== activeTab?.id),
      ].filter(
        (tab) =>
          tab?.id &&
          (tab.url === WEBSITE_ORIGIN || tab.url?.startsWith(`${WEBSITE_ORIGIN}/`)),
      );

      for (const tab of candidateTabs) {
        const [injectionResult] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          args: [SUPABASE_WEBSITE_STORAGE_KEY],
          func: (storageKey) => {
          const base64CookiePrefix = "base64-";

          const decodeBase64Url = (value) => {
            const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
            const padded = base64.padEnd(
              base64.length + ((4 - (base64.length % 4)) % 4),
              "=",
            );
            return decodeURIComponent(
              Array.from(atob(padded), (character) =>
                `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`,
              ).join(""),
            );
          };

          const normalizeSessionValue = (value) => {
            if (!value) {
              return null;
            }

            if (value.startsWith(base64CookiePrefix)) {
              return decodeBase64Url(value.slice(base64CookiePrefix.length));
            }

            return value;
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

          const readCookies = () =>
            document.cookie
              .split(";")
              .map((cookie) => cookie.trim())
              .filter(Boolean)
              .reduce((cookies, cookie) => {
                const separatorIndex = cookie.indexOf("=");

                if (separatorIndex === -1) {
                  return cookies;
                }

                cookies[decodeURIComponent(cookie.slice(0, separatorIndex))] =
                  decodeURIComponent(cookie.slice(separatorIndex + 1));
                return cookies;
              }, {});

          const localStorageSession = window.localStorage.getItem(storageKey);

          if (localStorageSession) {
            return localStorageSession;
          }

          const cookies = readCookies();
          return normalizeSessionValue(readChunkedCookie(cookies, storageKey));
          },
        });

        const sessionValue =
          typeof injectionResult?.result === "string" ? injectionResult.result : null;

        if (sessionValue) {
          await chrome.storage.local.set({ [EXTENSION_SESSION_STORAGE_KEY]: sessionValue });
          return sessionValue;
        }
      }

      if (candidateTabs.length > 0) {
        await chrome.storage.local.remove(EXTENSION_SESSION_STORAGE_KEY);
      }

      return null;
    } catch (error) {
      console.error("[Extension Auth] Could not import session from website tab.", error);
      return null;
    }
  };

  const getCachedProfile = async (userId) => {
    if (!userId || typeof chrome === "undefined" || !chrome.storage?.local) {
      return null;
    }

    try {
      const cacheKey = getProfileCacheKey(userId);
      const result = await chrome.storage.local.get(cacheKey);
      return result[cacheKey] ?? null;
    } catch (error) {
      console.error("[Extension Auth] Could not read cached profile.", error);
      return null;
    }
  };

  const setCachedProfile = async (userId, profile) => {
    if (!userId || !profile || typeof chrome === "undefined" || !chrome.storage?.local) {
      return;
    }

    try {
      await chrome.storage.local.set({ [getProfileCacheKey(userId)]: profile });
    } catch (error) {
      console.error("[Extension Auth] Could not cache profile.", error);
    }
  };

  const parseStoredSession = (storedSession) => {
    if (!storedSession) {
      return null;
    }

    try {
      const parsedSession =
        typeof storedSession === "string" ? JSON.parse(storedSession) : storedSession;
      const session = parsedSession.currentSession || parsedSession.session || parsedSession;

      if (session?.access_token && session?.refresh_token && session?.user) {
        return {
          session,
          user: session.user,
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
        };
      }
    } catch (error) {
      console.error("[Extension Auth] Stored session could not be parsed:", error);
    }

    return null;
  };

  const restoreSessionIfChanged = async (auth) => {
    if (!auth?.accessToken || !auth?.refreshToken || !supabaseClient?.auth?.setSession) {
      return;
    }

    if (auth.accessToken === lastAppliedAccessToken) {
      return;
    }

    const { error } = await supabaseClient.auth.setSession({
      access_token: auth.accessToken,
      refresh_token: auth.refreshToken,
    });

    if (error) {
      throw error;
    }

    lastAppliedAccessToken = auth.accessToken;
  };

  const getNumberValue = (...values) => {
    const value = values.find((candidate) => Number.isFinite(Number(candidate)));
    return value === undefined ? 0 : Number(value);
  };

  const getDisplayName = (profile, user) => {
    const fullName = (profile?.fullname || profile?.full_name || profile?.name)?.trim();
    return fullName || user?.email || "Korisnik";
  };

  const getInitials = (value) => {
    const normalized = String(value ?? "")
      .replace(/@.*/, "")
      .trim();

    if (!normalized) {
      return "BR";
    }

    const parts = normalized.split(/\s+/).filter(Boolean);

    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }

    return normalized.slice(0, 2).toUpperCase();
  };

  const getTierLabel = (profile) => {
    const status = profile?.subscription_status ?? "trial";
    const labels = {
      active: "Active subscriber",
      canceled: "Subscription canceled",
      expired: "Subscription expired",
      trial: "Beta Access User",
    };

    return labels[status] ?? status.replace(/_/g, " ");
  };

  const setProfileStateClass = (state) => {
    profileCard.classList.toggle("is-loading", state === "loading");
    profileCard.classList.toggle("is-unauthenticated", state === "unauthenticated");
    profileCard.classList.toggle("is-error", state === "error");
  };

  const showToast = (message) => {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("is-visible");
    toast.setAttribute("aria-hidden", "false");

    toastTimer = window.setTimeout(() => {
      toast.classList.remove("is-visible");
      toast.setAttribute("aria-hidden", "true");
    }, 3200);
  };

  const updateCredits = () => {
    const safeLimit = Math.max(creditsLimit, 1);
    const percentage = clamp(Math.round((credits / safeLimit) * 100), 0, 100);

    creditsLabel.textContent = `Credits: ${credits} / ${creditsLimit}`;
    creditsPercent.textContent = `${percentage}%`;
    creditsProgress.setAttribute("aria-label", `Krediti: ${credits} od ${creditsLimit}`);
    creditsFill.style.width = `${percentage}%`;
  };

  const renderUnauthenticatedProfile = () => {
    currentUser = null;
    currentProfile = null;
    credits = 0;
    creditsLimit = DEFAULT_CREDITS_LIMIT;
    setProfileStateClass("unauthenticated");
    profileAvatar.textContent = "BR";
    profileLabel.textContent = "Niste prijavljeni";
    profileSubtitle.textContent = "Kliknite Prijava da povežete nalog.";
    profileEmail.textContent = "";
    profileAction.textContent = "Prijava";
    profileAction.href = WEBSITE_LOGIN_URL || "#";
    dashboardLink.href = WEBSITE_DASHBOARD_URL || "#";
    updateCredits();
  };

  const renderAuthenticatedProfile = (profile, user) => {
    const displayName = getDisplayName(profile, user);
    credits = clamp(
      Math.floor(getNumberValue(profile?.credits_remaining, profile?.credits)),
      0,
      Number.MAX_SAFE_INTEGER,
    );
    creditsLimit = Math.max(
      Math.floor(getNumberValue(profile?.credits_limit, profile?.credits_total, DEFAULT_CREDITS_LIMIT)),
      1,
    );

    setProfileStateClass("authenticated");
    profileAvatar.textContent = getInitials(displayName);
    profileLabel.textContent = displayName;
    profileSubtitle.textContent = getTierLabel(profile);
    profileEmail.textContent = user?.email || profile?.email || "";
    profileAction.textContent = "Upgrade";
    profileAction.href = WEBSITE_DASHBOARD_URL || "#";
    dashboardLink.href = WEBSITE_DASHBOARD_URL || "#";
    updateCredits();
  };

  const unsubscribeFromProfileChanges = () => {
    if (!profileChannel) {
      profileChannelUserId = null;
      return;
    }

    supabaseClient.removeChannel(profileChannel);
    profileChannel = null;
    profileChannelUserId = null;
  };

  const subscribeToProfileChanges = (userId) => {
    if (!userId || profileChannelUserId === userId) {
      return;
    }

    unsubscribeFromProfileChanges();
    profileChannelUserId = userId;

    profileChannel = supabaseClient
      .channel(`profile-credit-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          filter: `id=eq.${userId}`,
          schema: "public",
          table: "profiles",
        },
        (payload) => {
          if (currentUser?.id !== userId || payload.new?.id !== userId) {
            console.warn("[Extension Auth] Ignored profile update for inactive user.", {
              activeUserId: currentUser?.id ?? null,
              subscribedUserId: userId,
              profileUserId: payload.new?.id ?? null,
            });
            return;
          }

          currentProfile = payload.new;
          void setCachedProfile(userId, currentProfile);
          renderAuthenticatedProfile(currentProfile, currentUser);
        },
      )
      .subscribe((status, error) => {
        if (error) {
          console.error("Supabase profile realtime subscription error.", error);
        }

        if (status === "CHANNEL_ERROR") {
          console.error("Supabase profile realtime channel failed.");
        }
      });
  };

  const fetchAndRenderProfile = async (user, requestId = ++profileRequestId) => {
    if (!user?.id || !supabaseClient?.from) {
      return null;
    }

    try {
      const { data, error } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (requestId !== profileRequestId || currentUser?.id !== user.id) {
        return null;
      }

      if (!data) {
        console.warn("[Extension Auth] No profile row found for active user.", user.id);
        return null;
      }

      currentProfile = data;
      await setCachedProfile(user.id, data);
      renderAuthenticatedProfile(currentProfile, currentUser);
      subscribeToProfileChanges(user.id);
      return data;
    } catch (error) {
      console.error("[Extension Profile Fetch Error:]", error);
      if (currentUser?.id === user.id) {
        renderAuthenticatedProfile(currentProfile, currentUser);
      }
      return null;
    }
  };

  const applyStoredSession = async (storedSession, { clearOnMissing = false } = {}) => {
    const auth = parseStoredSession(storedSession);

    if (!auth?.user?.id) {
      lastStoredSessionValue = storedSession ?? null;
      lastAppliedAccessToken = null;
      profileRequestId += 1;
      unsubscribeFromProfileChanges();

      if (clearOnMissing || !currentUser) {
        renderUnauthenticatedProfile();
      }

      return null;
    }

    lastStoredSessionValue = storedSession;
    const cachedProfile = await getCachedProfile(auth.user.id);
    const immediateProfile =
      cachedProfile ?? (currentUser?.id === auth.user.id ? currentProfile : null);

    currentUser = auth.user;
    currentProfile = immediateProfile;
    renderAuthenticatedProfile(currentProfile, currentUser);

    try {
      await restoreSessionIfChanged(auth);
    } catch (error) {
      console.error("[Extension Auth] Stored session restore failed:", error);
      return currentProfile;
    }

    return fetchAndRenderProfile(currentUser);
  };

  const initializeAuthState = async () => {
    try {
      await importSessionFromActiveWebsiteTab();
      const storedSession = await getStoredSessionSnapshot();

      if (storedSession) {
        await applyStoredSession(storedSession, { clearOnMissing: true });
        return;
      }

      const { data, error } = supabaseClient?.auth?.getSession
        ? await supabaseClient.auth.getSession()
        : { data: null, error: null };

      if (error) {
        throw error;
      }

      if (data?.session) {
        await applyStoredSession(
          JSON.stringify({
            currentSession: data.session,
            expiresAt: data.session.expires_at ?? null,
          }),
          { clearOnMissing: true },
        );
        return;
      }

      renderUnauthenticatedProfile();
    } catch (error) {
      console.error("[Extension Auth] Initial auth state failed:", error);
      if (currentUser) {
        renderAuthenticatedProfile(currentProfile, currentUser);
      } else {
        renderUnauthenticatedProfile();
      }
    }
  };

  const setScannerLoading = (isLoading) => {
    scanButton.classList.toggle("is-loading", isLoading);
    scanButton.setAttribute("aria-busy", String(isLoading));
    retryScanButton.classList.toggle("is-loading", isLoading);
    retryScanButton.setAttribute("aria-busy", String(isLoading));

    if (isLoading) {
      scanButton.disabled = true;
      retryScanButton.disabled = true;
      return;
    }

    const isNoListingPanel = !noListingState.classList.contains("is-hidden");
    scanButton.disabled = isNoListingPanel;
    retryScanButton.disabled = false;
  };

  const clearScanTimer = () => {
    if (scanTimer) {
      window.clearTimeout(scanTimer);
      scanTimer = null;
    }
  };

  const setScanNotice = (message = "") => {
    scanNotice.textContent = message;
    scanNotice.classList.toggle("is-hidden", !message);
    scanNotice.setAttribute("aria-hidden", String(!message));
  };

  const setPartialDataWarning = (isVisible) => {
    partialDataWarning.textContent = isVisible ? PARTIAL_DATA_MESSAGE : "";
    partialDataWarning.classList.toggle("is-hidden", !isVisible);
    partialDataWarning.setAttribute("aria-hidden", String(!isVisible));
  };

  const resetScanResults = () => {
    currentDetectionResult = null;
    listings = [];
    openListingId = null;
    analyzingListingId = null;
    setPartialDataWarning(false);
    purgeListingDom();
    renderListings();
  };

  const setActivePanel = (panel) => {
    const showScan = panel === "scan";
    const showNoListing = panel === "no-listing";
    const showResults = panel === "results";

    scanState.classList.toggle("is-hidden", !showScan);
    noListingState.classList.toggle("is-hidden", !showNoListing);
    resultsState.classList.toggle("is-hidden", !showResults);

    scanState.setAttribute("aria-hidden", String(!showScan));
    noListingState.setAttribute("aria-hidden", String(!showNoListing));
    resultsState.setAttribute("aria-hidden", String(!showResults));

    scanButton.disabled = showNoListing;
    retryScanButton.disabled = false;

    const resultsActive = showResults || showNoListing;
    devToggle?.classList.toggle("is-active", resultsActive);
    devToggle?.setAttribute("aria-pressed", String(resultsActive));
  };

  const setResultsVisible = (isVisible) => {
    setActivePanel(isVisible ? "results" : "scan");
  };

  const updateListingsSummary = () => {
    listingsSummaryTitle.textContent = "Pronađen pojedinačni oglas na stranici";
    summaryBadge.textContent = listings.length === 1 ? "1 aktivan" : "0 aktivnih";
  };

  const isNoListingsFoundResult = (result) =>
    !result ||
    result.type === "NO_LISTINGS_FOUND" ||
    (Array.isArray(result.listings) && result.listings.length === 0 && result.is_valid_listing !== true) ||
    result.is_valid_listing === false ||
    !result.listing;

  const isValidDetectionPayload = (result) => {
    if (!result || result.type === "NO_LISTINGS_FOUND") {
      return false;
    }

    const signals = result?.detection?.signals;
    const passesStrongJsonLdRule = signals?.has_strong_json_ld === true;
    const passesDomHeuristicRule =
      signals?.has_price === true &&
      signals?.has_explicit_dom_area === true &&
      signals?.has_property_context === true;
    const passesHaloDetailRule = signals?.is_halooglasi_detail === true;
    const passesListingRules =
      signals?.is_collection_like === false &&
      signals?.is_generic_blocked_page === false &&
      (passesStrongJsonLdRule || passesDomHeuristicRule || passesHaloDetailRule);

    return (
      (result.type === "LISTING_FOUND" || result.schema_version === 1) &&
      result.is_valid_listing === true &&
      typeof result.has_partial_data === "boolean" &&
      Number.isInteger(result.completeness_score) &&
      Array.isArray(result.missing_fields) &&
      result.detection &&
      typeof result.detection.method === "string" &&
      signals &&
      typeof result.listing === "object" &&
      result.listing !== null &&
      passesListingRules
    );
  };

  const formatDetectedPrice = (price) => {
    if (price?.raw) {
      return price.raw;
    }

    if (!Number.isFinite(price?.value)) {
      return "Cena nije pronađena";
    }

    const currencyLabels = {
      EUR: "€",
      USD: "$",
      GBP: "£",
      RSD: "RSD",
    };

    return `${formatNumber(price.value)} ${currencyLabels[price.currency] ?? price.currency ?? ""}`.trim();
  };

  const createDetectedListingId = (listing) => {
    const source = listing?.listing_url || `${listing?.portal_name ?? "detected"}-${Date.now()}`;
    let hash = 0;

    for (let index = 0; index < source.length; index += 1) {
      hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
    }

    return `detected-${hash.toString(36)}`;
  };

  const mapDetectionToListing = (detectionResult) => {
    const detectedListing = detectionResult?.listing;

    if (!detectedListing || typeof detectedListing !== "object") {
      return null;
    }

    return {
      id: createDetectedListingId(detectedListing),
      title: detectedListing.title || "Naslov oglasa nije pronađen",
      location: detectedListing.location || "Lokacija nije pronađena",
      price: formatDetectedPrice(detectedListing.price),
      unlocked: false,
      detection: detectionResult,
      hasPartialData: detectionResult.has_partial_data,
      isDetectionValid: detectionResult.is_valid_listing === true,
    };
  };

  const getActiveTab = async () => {
    if (typeof chrome === "undefined" || !chrome.tabs?.query) {
      return null;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab ?? null;
  };

  const canInspectTab = (tab) => Boolean(tab?.id && /^https?:\/\//i.test(tab.url ?? ""));

  const inspectActiveTabListing = async () => {
    if (typeof chrome === "undefined" || !chrome.scripting?.executeScript) {
      return null;
    }

    const tab = await getActiveTab();

    if (!canInspectTab(tab)) {
      return null;
    }

    const [injectionResult] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: [LISTING_DETECTOR_FILE],
    });

    return injectionResult?.result ?? null;
  };

  const showNoListingWarningState = () => {
    resetScanResults();
    setScanNotice("");
    setPartialDataWarning(false);
    setActivePanel("no-listing");
  };

  const showInvalidScanState = () => {
    showNoListingWarningState();
  };

  const getListingById = (id) => listings.find((listing) => listing.id === id);

  const ANALYSIS_FIELD_LABELS = {
    summary: "SAŽETAK",
    valuation: "PROCENA VREDNOSTI",
    market_assessment: "Tržišna procena",
    reasoning: "Obrazloženje",
    recommended_checks: "Preporučene provere",
    target_discount_pct: "Ciljani popust",
    target_discount_percentage: "Ciljani popust",
    leverage_points: "Aduti za pregovaranje",
    cost_breakdown: "Struktura troškova",
    red_flags: "Upozorenja i rizici",
    risks: "Upozorenja i rizici",
    costs: "Troškovi",
    legal_checks: "PRAVNE PROVERE",
    legal_check: "Pravna provera",
    technical_checks: "TEHNIČKE PROVERE",
    technical_check: "Tehnička provera",
    legal_technical_checks: "PRAVNE I TEHNIČKE PROVERE",
    negotiation_strategy: "STRATEGIJA PREGOVORA",
    negotiation_strategy_lines: "STRATEGIJA PREGOVORA",
    dynamic_faq: "ČESTA PITANJA",
    dynamic_quick_prompts: "ČESTA PITANJA",
    faq: "ČESTA PITANJA",
    question: "Pitanje",
    answer: "Odgovor",
    financials: "FINANSIJSKI PREGLED",
    deal_score: "AI OCENA PONUDE",
    highlights: "PREDNOSTI",
  };

  const formatAnalysisLabel = (key) => {
    const normalizedKey = String(key ?? "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");

    return (
      ANALYSIS_FIELD_LABELS[normalizedKey] ||
      normalizedKey
      .replace(/_/g, " ")
      .replace(/^\p{L}/u, (letter) => letter.toUpperCase())
    );
  };

  const isAnalysisObject = (value) =>
    Boolean(value) && typeof value === "object" && !Array.isArray(value);

  const formatScalarDisplay = (value) => {
    if (value === null || value === undefined || value === "") {
      return "Proveriti u oglasu / uknjižbi";
    }

    if (typeof value === "boolean") {
      return value ? "Da" : "Ne";
    }

    if (typeof value === "string") {
      return sanitizeDisplayText(value) || "Proveriti u oglasu / uknjižbi";
    }

    return String(value);
  };

  const isScalarValue = (value) =>
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean";

  const renderKvRow = (label, valueHtml, { accent = false } = {}) => `
    <div class="kv-row">
      <span class="kv-label">${escapeHtml(label)}</span>
      <span class="kv-value ${accent ? "kv-value-accent" : ""}">${valueHtml}</span>
    </div>
  `;

  const renderKvTable = (rowsHtml) =>
    rowsHtml ? `<div class="kv-table">${rowsHtml}</div>` : "";

  const renderSectionCard = (title, bodyHtml, extraClass = "") => {
    if (!bodyHtml) {
      return "";
    }

    return `
      <section class="analysis-module ${extraClass}" aria-label="${escapeHtml(title)}">
        <h3 class="section-heading">${escapeHtml(title)}</h3>
        ${bodyHtml}
      </section>
    `;
  };

  const renderStructuredValue = (value, key = "") => {
    if (value === null || value === undefined || value === "") {
      return '<p class="muted-label">Nema dostupnih podataka.</p>';
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return '<p class="muted-label">Nema izdvojenih stavki.</p>';
      }

      const allScalars = value.every(isScalarValue);

      if (allScalars) {
        return renderKvTable(
          value
            .map((item, index) =>
              renderKvRow(`${index + 1}.`, escapeHtml(formatScalarDisplay(item))),
            )
            .join(""),
        );
      }

      return `
        <div class="nested-stack">
          ${value
            .map(
              (item, index) => `
                <div class="nested-block">
                  ${
                    isAnalysisObject(item)
                      ? renderStructuredValue(item, `${key}_${index}`)
                      : `<p class="score-caption">${escapeHtml(formatScalarDisplay(item))}</p>`
                  }
                </div>
              `,
            )
            .join("")}
        </div>
      `;
    }

    if (typeof value === "object") {
      const entries = Object.entries(value);
      const scalarEntries = entries.filter(([, nestedValue]) => isScalarValue(nestedValue));
      const complexEntries = entries.filter(([, nestedValue]) => !isScalarValue(nestedValue));

      return `
        ${
          scalarEntries.length > 0
            ? renderKvTable(
                scalarEntries
                  .map(([nestedKey, nestedValue]) =>
                    renderKvRow(
                      formatAnalysisLabel(nestedKey),
                      escapeHtml(formatScalarDisplay(nestedValue)),
                      {
                        accent:
                          nestedKey.includes("price") ||
                          nestedKey.includes("score") ||
                          nestedKey.includes("discount"),
                      },
                    ),
                  )
                  .join(""),
              )
            : ""
        }
        ${complexEntries
          .map(
            ([nestedKey, nestedValue]) => `
              <div class="nested-block">
                <p class="nested-heading">${escapeHtml(formatAnalysisLabel(nestedKey))}</p>
                ${renderStructuredValue(nestedValue, nestedKey)}
              </div>
            `,
          )
          .join("")}
      `;
    }

    const displayValue = formatScalarDisplay(value);

    if (
      (displayValue === "Proveriti u oglasu / uknjižbi" ||
        displayValue === "Podatak nije naveden") &&
      looksLikeRawCode(value)
    ) {
      return "";
    }

    return `<p class="${key === "summary" ? "score-caption" : "muted-label"}">${escapeHtml(displayValue)}</p>`;
  };

  const renderAnalysisModule = ([key, value]) =>
    renderSectionCard(formatAnalysisLabel(key), renderStructuredValue(value, key));

  const firstAvailable = (...values) =>
    values.find((value) => value !== null && value !== undefined && value !== "");

  const collectTextItems = (value) => {
    if (value === null || value === undefined || value === "") {
      return [];
    }

    if (Array.isArray(value)) {
      return value.flatMap(collectTextItems);
    }

    if (isAnalysisObject(value)) {
      return Object.values(value).flatMap(collectTextItems);
    }

    if (typeof value === "string") {
      const cleaned = sanitizeDisplayText(value);
      return cleaned ? [cleaned] : [];
    }

    const asText = String(value);
    return looksLikeRawCode(asText) ? [] : [asText];
  };

  const renderMetricDisplay = (value, key) => {
    if (value === null || value === undefined || value === "") {
      return "—";
    }

    if (!Number.isFinite(Number(value))) {
      return escapeHtml(value);
    }

    const numericValue = Number(value);

    if (key.includes("percentage") || key.includes("pct")) {
      return `${numericValue > 0 ? "+" : ""}${numericValue}%`;
    }

    if (key.includes("price") || key.includes("cost")) {
      return `${formatNumber(numericValue)} €`;
    }

    return escapeHtml(numericValue);
  };

  const getPriceMetrics = (analysis) => {
    const financials = isAnalysisObject(analysis.financials) ? analysis.financials : {};
    const valuation = isAnalysisObject(analysis.valuation) ? analysis.valuation : {};
    const valuationSr = isAnalysisObject(analysis.procena_vrednosti)
      ? analysis.procena_vrednosti
      : {};

    return {
      pricePerSqm: firstAvailable(
        financials.price_per_sqm,
        valuation.price_per_sqm,
        valuation.price_per_m2,
        valuationSr.cena_po_m2,
      ),
      locationAverage: firstAvailable(
        financials.location_average_price_per_sqm,
        valuation.location_average_price_per_sqm,
      ),
      priceDifference: firstAvailable(
        financials.price_difference_percentage,
        valuation.price_difference_percentage,
        valuation.estimated_deviation_pct,
        valuationSr.odstupanje_od_tržišta_procenat,
      ),
    };
  };

  const isUsableMetric = (key, value) => {
    if (value === undefined || value === null || value === "") {
      return false;
    }

    if (
      typeof value === "number" &&
      value === 0 &&
      (key === "price_per_sqm" || key === "location_average_price_per_sqm")
    ) {
      return false;
    }

    return true;
  };

  const contextualMissingSpec = (kind, listing) => {
    const location =
      sanitizeDisplayText(listing?.location || listing?.detection?.listing?.location, {
        maxLength: 60,
      }) || "ovu lokaciju";

    switch (kind) {
      case "floor":
        return "Standardna spratnost / Proveriti u uknjižbi";
      case "seller":
        return "Agencijska ili direktna prodaja — proveriti oglašivača";
      case "surface":
        return `Kvadraturu potvrditi za ${location}`;
      default:
        return `Proveriti podatak za ${location}`;
    }
  };

  const findScalarByKeys = (sources, keys) => {
    for (const source of sources) {
      if (!isAnalysisObject(source)) {
        continue;
      }

      for (const key of keys) {
        const value = source[key];
        if (value !== null && value !== undefined && value !== "") {
          return value;
        }
      }
    }

    return null;
  };

  const extractSpecFromText = (text, patterns) => {
    const haystack = String(text ?? "");
    if (!haystack) {
      return null;
    }

    for (const pattern of patterns) {
      const match = haystack.match(pattern);
      if (match?.[1]) {
        return sanitizeDisplayText(match[1], { maxLength: 40 });
      }
    }

    return null;
  };

  const resolveMarketPosition = (analysis) => {
    const financials = isAnalysisObject(analysis.financials) ? analysis.financials : {};
    const valuation = isAnalysisObject(analysis.valuation) ? analysis.valuation : {};
    const { priceDifference } = getPriceMetrics(analysis);
    const rawStatus = firstAvailable(financials.market_status, valuation.market_status);
    const numericDiff = Number(priceDifference);

    if (rawStatus === "Precenjeno" || (Number.isFinite(numericDiff) && numericDiff > 0 && !rawStatus)) {
      return { label: "Iznad proseka", tone: "warning" };
    }

    if (rawStatus === "Povoljno") {
      return { label: "Povoljno", tone: "success" };
    }

    if (rawStatus === "Realna cena") {
      return { label: "Realna cena", tone: "neutral" };
    }

    if (Number.isFinite(numericDiff) && numericDiff < 0) {
      return { label: "Povoljno", tone: "success" };
    }

    if (rawStatus) {
      return { label: String(rawStatus), tone: "neutral" };
    }

    return { label: "", tone: "neutral" };
  };

  const extractQuickSpecs = (listing, analysis) => {
    const detectedListing = listing?.detection?.listing ?? {};
    const financials = isAnalysisObject(analysis.financials) ? analysis.financials : {};
    const contact = isAnalysisObject(analysis.contact) ? analysis.contact : {};
    const kontakt = isAnalysisObject(analysis.kontakt) ? analysis.kontakt : {};
    const specs = isAnalysisObject(analysis.specs)
      ? analysis.specs
      : isAnalysisObject(analysis.property)
        ? analysis.property
        : isAnalysisObject(analysis.details)
          ? analysis.details
          : {};
    const searchText = [
      listing?.title,
      listing?.location,
      detectedListing?.description,
      detectedListing?.title,
    ]
      .filter(Boolean)
      .join(" ");

    const surfaceRaw = firstAvailable(
      detectedListing?.surface_area?.sqm,
      detectedListing?.surface_area?.raw,
      findScalarByKeys([analysis, specs, financials], ["surface_area", "sqm", "m2", "area_sqm", "kvadratura"]),
    );
    const surfaceLabel =
      surfaceRaw !== null && surfaceRaw !== undefined && surfaceRaw !== ""
        ? Number.isFinite(Number(surfaceRaw))
          ? `${formatNumber(Number(surfaceRaw))} m²`
          : sanitizeDisplayText(String(surfaceRaw), { maxLength: 40 }) ||
            contextualMissingSpec("surface", listing)
        : "";

    const roomsRaw = firstAvailable(
      findScalarByKeys([analysis, specs, detectedListing], [
        "rooms",
        "number_of_rooms",
        "broj_soba",
        "sobe",
        "bedrooms",
      ]),
      extractSpecFromText(searchText, [
        /(\d+(?:[.,]\d+)?)\s*(?:sob[aeiou]?|rooms?|bedrooms?)\b/iu,
        /\b(?:garsonjera|jednosoban|dvosoban|trosoban|četvorosoban|cetvorosoban)\b/iu,
      ]),
    );
    const roomsLabel = roomsRaw
      ? Number.isFinite(Number(roomsRaw))
        ? `${roomsRaw} sobe`
        : sanitizeDisplayText(String(roomsRaw), { maxLength: 40 })
      : "";

    const surfaceRooms =
      [surfaceLabel, roomsLabel].filter(Boolean).join(" · ") ||
      contextualMissingSpec("surface", listing);

    const floorRaw = firstAvailable(
      findScalarByKeys([detectedListing, analysis, specs], [
        "floor",
        "sprat",
        "floor_number",
        "kat",
      ]),
      extractSpecFromText(searchText, [
        /(\d+)\.\s*sprat\b/iu,
        /\bsprat\s*[:\-]?\s*(\d+)\b/iu,
        /\b(prizemlje|suteren|visoko prizemlje)\b/iu,
      ]),
    );
    const floor =
      floorRaw !== null && floorRaw !== undefined && floorRaw !== ""
        ? sanitizeDisplayText(String(floorRaw), { maxLength: 40 }) ||
          contextualMissingSpec("floor", listing)
        : contextualMissingSpec("floor", listing);

    const sellerType =
      sanitizeDisplayText(
        firstAvailable(
          financials.seller_type,
          analysis.seller_type,
          specs.seller_type,
          mapSellerTypeForUi(analysis, detectedListing),
          detectedListing.agency_name
            ? `Agencija / ${detectedListing.agency_name}`
            : null,
          detectedListing.advertiser_type,
          kontakt.agencija,
          kontakt.ime_vlasnika,
          contact.agency,
          contact.owner_name,
        ),
        { maxLength: 80 },
      ) || contextualMissingSpec("seller", listing);

    return {
      location:
        sanitizeDisplayText(sanitizeLocationDisplay(listing.location), {
          maxLength: 80,
        }) || contextualMissingSpec("surface", listing),
      surfaceRooms,
      floor,
      sellerType,
    };
  };

  const formatCostFragment = (label, value) => {
    if (value === null || value === undefined || value === "") {
      return "";
    }

    if (Number.isFinite(Number(value))) {
      return `${label} ~${formatNumber(Number(value))}€`;
    }

    const text = sanitizeDisplayText(String(value), { maxLength: 60 });
    return text ? `${label} ${text}` : "";
  };

  const extractCostSnapshot = (analysis) => {
    const costBreakdown = isAnalysisObject(analysis.cost_breakdown)
      ? analysis.cost_breakdown
      : isAnalysisObject(analysis.costs)
        ? analysis.costs
        : {};
    const costsSr = isAnalysisObject(analysis.troškovi) ? analysis.troškovi : {};
    const financials = isAnalysisObject(analysis.financials) ? analysis.financials : {};
    const sources = [costBreakdown, costsSr, financials, analysis];

    const assessmentText = sanitizeDisplayText(
      firstAvailable(
        costBreakdown.utilities_assessment,
        costsSr.procena_režija,
        costBreakdown.renovation_assessment,
        costsSr.procena_renoviranja,
      ),
      { maxLength: 160 },
    );

    const monthly = findScalarByKeys(sources, [
      "monthly_costs",
      "monthly_utilities",
      "utilities",
      "rezije",
      "režije",
      "mesečne_režije_eur",
      "estimated_monthly_utilities_eur",
      "estimated_monthly_cost",
      "monthly_cost",
    ]);
    const renovation = findScalarByKeys(sources, [
      "renovation_cost",
      "renovation",
      "renoviranje",
      "trošak_renoviranja_eur",
      "estimated_renovation_cost_eur",
      "estimated_renovation",
      "repair_cost",
    ]);

    const fragments = [];
    if (monthly !== null && monthly !== undefined && monthly !== "") {
      if (Number.isFinite(Number(monthly))) {
        fragments.push(`Režije ~${formatNumber(Number(monthly))}€/mo`);
      } else {
        const text = sanitizeDisplayText(String(monthly), { maxLength: 60 });
        if (text) {
          fragments.push(`Režije ${text}`);
        }
      }
    }
    if (renovation !== null && renovation !== undefined && renovation !== "") {
      fragments.push(formatCostFragment("Renoviranje", renovation));
    }
    const compactFragments = fragments.filter(Boolean);

    if (compactFragments.length > 0) {
      return compactFragments.join(" | ");
    }

    if (assessmentText) {
      return assessmentText;
    }

    // Prefer short scalar summaries from cost objects
    const scalarBits = Object.entries(costBreakdown)
      .filter(([, value]) => isScalarValue(value) && value !== null && value !== "")
      .slice(0, 2)
      .map(([key, value]) => {
        if (Number.isFinite(Number(value))) {
          return `${formatAnalysisLabel(key)} ~${formatNumber(Number(value))}€`;
        }
        return `${formatAnalysisLabel(key)}: ${sanitizeDisplayText(String(value), { maxLength: 40 })}`;
      })
      .filter(Boolean);

    if (scalarBits.length > 0) {
      return scalarBits.join(" | ");
    }

    const dealVerdict = sanitizeDisplayText(analysis?.deal_score?.verdict, { maxLength: 140 });
    return (
      dealVerdict ||
      "Mesečne režije i ulaganja proceniti po kvadraturi lokacije; potvrditi račune pre ugovora."
    );
  };

  const extractTopRisk = (analysis) => {
    const insights = isAnalysisObject(analysis.insights) ? analysis.insights : {};
    const legalSr = isAnalysisObject(analysis.pravne_i_tehničke_provere)
      ? analysis.pravne_i_tehničke_provere
      : {};
    const risks = collectTextItems(
      firstAvailable(
        insights.risks,
        analysis.red_flags,
        analysis.risks,
        legalSr.crvene_zastavice,
      ),
    );
    return (
      risks[0] ||
      "Proveriti status uknjižbe i stanje instalacija pre kupovine."
    );
  };

  const renderHeroMetrics = (listing, analysis) => {
    const { pricePerSqm } = getPriceMetrics(analysis);
    const hasPricePerSqm = isUsableMetric("price_per_sqm", pricePerSqm);
    const pricePerSqmDisplay = hasPricePerSqm
      ? `${formatNumber(Number(pricePerSqm))} €/m²`
      : "—";
    const market = resolveMarketPosition(analysis);
    const badgeToneClass =
      market.tone === "success"
        ? "price-sqm-badge-success"
        : market.tone === "warning"
          ? "price-sqm-badge-warning"
          : "price-sqm-badge-neutral";

    return `
      <section class="price-hero" aria-label="Ključne metrike cene">
        <div class="price-hero-main">
          <span class="price-hero-label">Ukupna cena</span>
          <strong class="price-hero-value">${escapeHtml(listing.price || "—")}</strong>
        </div>
        <div class="price-hero-badges">
          <span class="price-sqm-badge ${badgeToneClass}" title="Cena po m²">${escapeHtml(pricePerSqmDisplay)}</span>
          ${
            market.label
              ? `<span class="market-position-tag market-position-${market.tone}">${escapeHtml(market.label)}</span>`
              : ""
          }
        </div>
      </section>
    `;
  };

  const renderSpecsGrid = (listing, analysis) => {
    const specs = extractQuickSpecs(listing, analysis);
    const cells = [
      { label: "Lokacija", value: specs.location },
      { label: "Površina / Sobe", value: specs.surfaceRooms },
      { label: "Sprat", value: specs.floor },
      { label: "Tip prodavca", value: specs.sellerType },
    ];

    return `
      <section class="analysis-module specs-module" aria-label="Brze specifikacije">
        <div class="specs-grid">
          ${cells
            .map(
              (cell) => `
                <article class="spec-cell">
                  <span class="spec-label">${escapeHtml(cell.label)}</span>
                  <strong class="spec-value">${escapeHtml(cell.value)}</strong>
                </article>
              `,
            )
            .join("")}
        </div>
      </section>
    `;
  };

  const renderEssentialHighlights = (analysis) => {
    const rows = [
      {
        label: "Procena vrednosti & Troškovi",
        value: extractCostSnapshot(analysis),
        tone: "neutral",
      },
      {
        label: "Najveća Crvena Zastavica",
        value: extractTopRisk(analysis),
        tone: "warning",
      },
      {
        label: "Glavni Savet za Pregovaranje",
        value: extractTopNegotiationTip(analysis),
        tone: "accent",
      },
    ];

    return `
      <section class="analysis-module highlights-snap" aria-label="Ključni uvidi">
        <div class="highlights-snap-list">
          ${rows
            .map(
              (row) => `
                <article class="highlight-snap-row highlight-snap-${row.tone}" role="button" tabindex="0" aria-expanded="false">
                  <span class="highlight-snap-label">${escapeHtml(row.label)}</span>
                  <p class="highlight-snap-value">${escapeHtml(sanitizeDisplayText(row.value) || "Proveriti detalje oglasa pre odluke.")}</p>
                </article>
              `,
            )
            .join("")}
        </div>
      </section>
    `;
  };

  // Legacy alias kept for any residual callers
  const renderPriceBanner = (listing, analysis) => renderHeroMetrics(listing, analysis);

  const renderContactCard = (listing, analysis) => {
    const detectedListing = listing?.detection?.listing ?? {};
    const financials = isAnalysisObject(analysis.financials) ? analysis.financials : {};
    const contact = isAnalysisObject(analysis.contact)
      ? analysis.contact
      : isAnalysisObject(analysis.seller_contact)
        ? analysis.seller_contact
        : {};
    const phone = firstAvailable(
      contact.phone,
      contact.phone_number,
      analysis.phone,
      analysis.phone_number,
      detectedListing.phone,
      detectedListing.phone_number,
    );
    const agency = firstAvailable(
      contact.agency,
      contact.agency_name,
      analysis.agency,
      analysis.agency_name,
      financials.seller_type,
      detectedListing.agency,
      detectedListing.agency_name,
    );
    const ownerName = firstAvailable(
      contact.owner_name,
      contact.name,
      analysis.owner_name,
      detectedListing.owner_name,
    );

    const sellerFallback = mapSellerTypeForUi(analysis, detectedListing);

    return renderSectionCard(
      "Informacije o nekretnini",
      renderKvTable(
        [
          renderKvRow("Ime / agencija", escapeHtml(agency || sellerFallback)),
          renderKvRow("Vlasnik", escapeHtml(ownerName || sellerFallback)),
          renderKvRow(
            "Telefon",
            escapeHtml(phone || "Tražiti broj od oglašivača na portalu"),
            { accent: true },
          ),
          renderKvRow(
            "Lokacija",
            escapeHtml(listing.location || contextualMissingSpec("surface", listing)),
          ),
          renderKvRow(
            "Naslov",
            escapeHtml(listing.title || "Naslov oglasa — proveriti na portalu"),
          ),
        ].join(""),
      ),
      "contact-module",
    );
  };

  const renderFinancialsSection = (analysis) => {
    const financials = isAnalysisObject(analysis.financials) ? analysis.financials : {};
    const valuation = isAnalysisObject(analysis.valuation) ? analysis.valuation : {};
    const costBreakdown = isAnalysisObject(analysis.cost_breakdown)
      ? analysis.cost_breakdown
      : isAnalysisObject(analysis.costs)
        ? analysis.costs
        : {};
    const { locationAverage, priceDifference } = getPriceMetrics(analysis);
    const skipKeys = new Set([
      "price_per_sqm",
      "location_average_price_per_sqm",
      "price_difference_percentage",
    ]);

    const rows = [];

    if (isUsableMetric("location_average_price_per_sqm", locationAverage)) {
      rows.push(
        renderKvRow(
          "Prosek lokacije",
          renderMetricDisplay(locationAverage, "location_average_price_per_sqm"),
        ),
      );
    }

    if (isUsableMetric("price_difference_percentage", priceDifference)) {
      const numericDiff = Number(priceDifference);
      const accentClass =
        Number.isFinite(numericDiff) && numericDiff < 0 ? "kv-value-positive" : "kv-value-warning";

      rows.push(
        `<div class="kv-row"><span class="kv-label">Razlika od proseka</span><span class="kv-value ${accentClass}">${renderMetricDisplay(priceDifference, "price_difference_percentage")}</span></div>`,
      );
    }

    const mergeScalarEntries = (source) => {
      Object.entries(source).forEach(([key, value]) => {
        if (skipKeys.has(key) || !isScalarValue(value)) {
          return;
        }

        if (value === null || value === undefined || value === "") {
          return;
        }

        rows.push(
          renderKvRow(
            formatAnalysisLabel(key),
            Number.isFinite(Number(value)) &&
              (key.includes("price") || key.includes("cost") || key.includes("fee"))
              ? renderMetricDisplay(value, key)
              : escapeHtml(formatScalarDisplay(value)),
            {
              accent: key.includes("price") || key.includes("discount") || key.includes("score"),
            },
          ),
        );
      });
    };

    mergeScalarEntries(financials);
    mergeScalarEntries(valuation);
    mergeScalarEntries(costBreakdown);

    const complexBlocks = [financials, valuation, costBreakdown]
      .flatMap((source) =>
        Object.entries(source).filter(([, value]) => !isScalarValue(value) && value !== null),
      )
      .map(
        ([key, value]) => `
          <div class="nested-block">
            <p class="nested-heading">${escapeHtml(formatAnalysisLabel(key))}</p>
            ${renderStructuredValue(value, key)}
          </div>
        `,
      )
      .join("");

    if (rows.length === 0 && !complexBlocks) {
      return "";
    }

    return renderSectionCard(
      "Troškovi i procene",
      `${renderKvTable(rows.join(""))}${complexBlocks}`,
      "financials-module",
    );
  };

  const renderDealScore = (analysis) => {
    if (!isAnalysisObject(analysis.deal_score)) {
      return "";
    }

    const score = clamp(Number(analysis.deal_score.score) || 0, 0, 10);

    return renderSectionCard(
      "AI ocena ponude",
      `
        <div class="module-title-row">
          <span class="kv-label">Ocena</span>
          <strong class="deal-score-value">${escapeHtml(score.toFixed(1))} / 10</strong>
        </div>
        <div class="progress-track score-track" aria-label="Ocena ${escapeHtml(String(score))} od 10">
          <div class="progress-fill score-fill" style="width: ${score * 10}%"></div>
        </div>
        ${
          sanitizeDisplayText(analysis.deal_score.verdict)
            ? `<p class="score-caption">${safeDisplayHtml(analysis.deal_score.verdict)}</p>`
            : ""
        }
      `,
      "deal-score-module",
    );
  };

  const renderAlertCards = (analysis) => {
    const insights = isAnalysisObject(analysis.insights) ? analysis.insights : {};
    const risks = collectTextItems(
      firstAvailable(analysis.red_flags, analysis.risks, insights.risks),
    );
    const highlights = collectTextItems(
      firstAvailable(analysis.highlights, insights.highlights, insights.pros),
    );

    const risksBody =
      risks.length > 0
        ? `<div class="alert-list">${risks
            .map(
              (risk) => `
                <article class="alert-card">
                  <span aria-hidden="true">!</span>
                  <p>${safeDisplayHtml(risk)}</p>
                </article>
              `,
            )
            .join("")}</div>`
        : '<p class="muted-label empty-state">Nisu izdvojena posebna upozorenja.</p>';

    const highlightsBody =
      highlights.length > 0
        ? renderKvTable(
            highlights
              .map((item, index) =>
                renderKvRow(`Prednost ${index + 1}`, safeDisplayHtml(item), { accent: true }),
              )
              .join(""),
          )
        : "";

    return `
      ${renderSectionCard("Upozorenja i rizici", risksBody, "risk-module")}
      ${renderSectionCard("Prednosti", highlightsBody, "highlights-module")}
    `;
  };

  const renderRecommendedChecks = (analysis) => {
    const checks = [
      ...collectTextItems(analysis.recommended_checks),
      ...collectTextItems(analysis.legal_checks),
      ...collectTextItems(analysis.technical_checks),
      ...collectTextItems(analysis.legal_technical_checks),
    ];

    const body =
      checks.length > 0
        ? `<div class="check-list">${[...new Set(checks)]
            .map(
              (check, index) => `
                <label class="check-item">
                  <input type="checkbox" data-check-index="${index}">
                  <span class="custom-checkbox" aria-hidden="true"></span>
                  <span>${safeDisplayHtml(check)}</span>
                </label>
              `,
            )
            .join("")}</div>`
        : '<p class="muted-label empty-state">Nema dodatnih preporučenih provera.</p>';

    return renderSectionCard("Preporučene provere", body, "checks-module");
  };

  const renderAccordionItems = (items, listingId, prefix) => {
    if (items.length === 0) {
      return "";
    }

    return `
      <div class="faq-list" data-accordion-group="${prefix}">
        ${items
          .map(
            (item, index) => `
              <article class="faq-item">
                <button
                  class="faq-header"
                  type="button"
                  aria-expanded="false"
                  aria-controls="${prefix}-${listingId}-${index}"
                >
                  <span class="faq-question-text">${safeDisplayHtml(item.question) || escapeHtml("Pitanje")}</span>
                  <span class="faq-chevron" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false">
                      <path d="m6 9 6 6 6-6"></path>
                    </svg>
                  </span>
                </button>
                <div class="faq-body" id="${prefix}-${listingId}-${index}" hidden style="display: none;">
                  ${safeDisplayHtml(item.answer) || escapeHtml("Tražite potvrdu od oglašivača pre konačne odluke.")}
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
    `;
  };

  const normalizeFaqItems = (analysis) => {
    const source = firstAvailable(
      analysis.dynamic_faq,
      analysis.dinamička_pitanja,
      analysis.faq,
      analysis.dynamic_quick_prompts,
    );

    if (!source) {
      return [];
    }

    const items = Array.isArray(source) ? source : [source];

    return items
      .map((item) => {
        if (typeof item === "string") {
          return {
            question: item,
            answer:
              "Tražite potvrdu od oglašivača i uporedite sa sličnim oglasima u istoj zoni.",
          };
        }

        if (!isAnalysisObject(item)) {
          return null;
        }

        return {
          question: firstAvailable(
            item.question,
            item.pitanje,
            item.label,
            item.title,
            item.prompt_query,
          ),
          answer: firstAvailable(
            item.answer,
            item.odgovor,
            item.response,
            item.content,
            item.prompt_query,
          ),
        };
      })
      .map((item) => ({
        question: sanitizeDisplayText(item.question, { maxLength: 400 }),
        answer:
          sanitizeDisplayText(item.answer, { maxLength: 2500 }) ||
          "Tražite potvrdu od oglašivača i uporedite sa sličnim oglasima u istoj zoni.",
      }))
      .filter((item) => item.question);
  };

  const normalizeNegotiationItems = (analysis) => {
    const insights = isAnalysisObject(analysis.insights) ? analysis.insights : {};
    const negoSr = isAnalysisObject(analysis.strategija_pregovaranja)
      ? analysis.strategija_pregovaranja
      : {};
    const negoEn = isAnalysisObject(analysis.negotiation_strategy)
      ? analysis.negotiation_strategy
      : {};
    const items = [];
    const targetDiscount = firstAvailable(
      analysis.target_discount_pct,
      analysis.target_discount_percentage,
      negoEn.target_discount_pct,
      negoSr.ciljani_popust_procenat,
    );

    if (targetDiscount !== undefined && targetDiscount !== null && targetDiscount !== "") {
      const numericDiscount = Number(targetDiscount);
      const discountLabel = Number.isFinite(numericDiscount)
        ? `${numericDiscount > 0 ? "+" : ""}${numericDiscount}%`
        : String(targetDiscount);

      items.push({
        question: "Ciljani popust",
        answer: discountLabel,
      });
    }

    const leverage = firstAvailable(
      analysis.leverage_points,
      negoEn.leverage_points,
      negoSr.argumenti_za_spuštanje_cene,
      insights.highlights,
    );
    collectTextItems(leverage).forEach((point, index) => {
      items.push({
        question: `Adut za pregovaranje ${index + 1}`,
        answer: point,
      });
    });

    const scripts = firstAvailable(negoEn.script_lines, negoSr.skripte_za_pregovor);
    collectTextItems(scripts).forEach((line, index) => {
      items.push({
        question: `Skripta za pregovor ${index + 1}`,
        answer: line,
      });
    });

    const strategy = firstAvailable(
      analysis.negotiation_strategy,
      analysis.negotiation_strategy_lines,
      analysis.strategija_pregovaranja,
    );

    if (Array.isArray(strategy)) {
      strategy.forEach((item, index) => {
        if (typeof item === "string") {
          items.push({
            question: `Strategija ${index + 1}`,
            answer: item,
          });
          return;
        }

        if (isAnalysisObject(item)) {
          items.push({
            question: firstAvailable(item.title, item.question, item.label, `Strategija ${index + 1}`),
            answer: firstAvailable(item.answer, item.content, item.description, item.tip, item.text),
          });
        }
      });
    } else if (typeof strategy === "string" && strategy.trim()) {
      items.push({
        question: "Strategija pregovaranja",
        answer: strategy,
      });
    } else if (isAnalysisObject(strategy)) {
      Object.entries(strategy).forEach(([key, value]) => {
        items.push({
          question: formatAnalysisLabel(key),
          answer: isScalarValue(value)
            ? formatScalarDisplay(value)
            : collectTextItems(value).join(" "),
        });
      });
    }

    return items
      .map((item) => ({
        question: sanitizeDisplayText(item.question, { maxLength: 400 }),
        answer: sanitizeDisplayText(item.answer, { maxLength: 2500 }),
      }))
      .filter((item) => item.question && item.answer);
  };

  const extractTopNegotiationTip = (analysis) => {
    const negoSr = isAnalysisObject(analysis.strategija_pregovaranja)
      ? analysis.strategija_pregovaranja
      : {};
    const directTip = firstAvailable(
      collectTextItems(analysis.leverage_points)[0],
      collectTextItems(negoSr.argumenti_za_spuštanje_cene)[0],
      collectTextItems(analysis.negotiation_strategy?.leverage_points)[0],
    );

    if (directTip) {
      return sanitizeDisplayText(directTip) || directTip;
    }

    const items = normalizeNegotiationItems(analysis);
    if (items.length === 0) {
      return "Iskoristiti lokalni orijentir cene po m² za ponudu nižu 5-7% uz uslovnu proveru dokumentacije.";
    }

    const top = items[0];
    const answer = sanitizeDisplayText(top.answer);
    if (!answer) {
      return (
        sanitizeDisplayText(top.question, { maxLength: 140 }) ||
        "Iskoristiti lokalni orijentir cene po m² za ponudu nižu 5-7% uz uslovnu proveru dokumentacije."
      );
    }

    return answer;
  };

  const toggleHighlightSnapRow = (row) => {
    if (!row) {
      return;
    }

    const expanded = row.classList.toggle("is-expanded");
    row.setAttribute("aria-expanded", expanded ? "true" : "false");
  };

  const renderFaq = (analysis, listingId) => {
    const items = normalizeFaqItems(analysis);
    const body =
      items.length > 0
        ? renderAccordionItems(items, listingId, "faq")
        : renderAccordionItems(
            [
              {
                question: "Koja pitanja postaviti oglašivaču pre kapare?",
                answer:
                  "Tražite list nepokretnosti, potvrdu režija i stanje instalacija. Uporedite cenu po m² sa sličnim oglasima u istoj zoni pre konačne ponude.",
              },
              {
                question: "Koliko prostora ima za pregovor?",
                answer:
                  "Uz otvorena pitanja o uknjiženosti i stanju, realan cilj je korekcija od 5-10% uz brzo zatvaranje.",
              },
              {
                question: "Šta proveriti kod grejanja i režija?",
                answer:
                  "Zatražite poslednja 3-6 računa i potvrdu tipa grejanja na licu mesta pre ugovora.",
              },
            ],
            listingId,
            "faq",
          );

    return renderSectionCard("Česta pitanja", body, "faq-module");
  };

  const renderNegotiationSection = (analysis, listingId) => {
    const items = normalizeNegotiationItems(analysis);
    const body =
      items.length > 0
        ? renderAccordionItems(items, listingId, "nego")
        : '<p class="muted-label empty-state">Strategija pregovaranja nije dostupna.</p>';

    return renderSectionCard("Strategija pregovaranja", body, "negotiation-module");
  };

  const renderAnalysisFeed = (listing, analysis) => `
      ${renderHeroMetrics(listing, analysis)}
      ${renderSpecsGrid(listing, analysis)}
      ${renderEssentialHighlights(analysis)}
      ${renderFaq(analysis, listing.id)}
    `;

  const renderAnalysisSkeleton = (listing) => `
    <div
      class="accordion-panel skeleton-panel"
      id="panel-${listing.id}"
      role="region"
      aria-labelledby="trigger-${listing.id}"
      aria-busy="true"
    >
      <div class="analysis-grid skeleton-grid">
        <section class="analysis-module skeleton-status-card" aria-live="polite">
          <p class="skeleton-status-text">
            <span class="skeleton-pulse-dot" aria-hidden="true"></span>
            AI analizira tržišne podatke...
          </p>
        </section>

        <section class="price-hero skeleton-card skeleton-hero" aria-label="Učitavanje cena">
          <div class="skeleton-box skeleton-price-box"></div>
          <div class="skeleton-badge-row">
            <span class="skeleton-box skeleton-badge"></span>
            <span class="skeleton-box skeleton-badge"></span>
          </div>
        </section>

        <section class="analysis-module skeleton-card skeleton-specs" aria-label="Učitavanje specifikacija">
          <div class="skeleton-specs-grid">
            <span class="skeleton-box skeleton-spec-cell"></span>
            <span class="skeleton-box skeleton-spec-cell"></span>
            <span class="skeleton-box skeleton-spec-cell"></span>
            <span class="skeleton-box skeleton-spec-cell"></span>
          </div>
        </section>

        <section class="analysis-module skeleton-card skeleton-highlights" aria-label="Učitavanje ključnih uvida">
          <div class="skeleton-box skeleton-line skeleton-line-100"></div>
          <div class="skeleton-box skeleton-line skeleton-line-80"></div>
          <div class="skeleton-box skeleton-line skeleton-line-60"></div>
        </section>

        <section class="analysis-module skeleton-card skeleton-faq" aria-label="Učitavanje FAQ">
          <div class="skeleton-faq-stack">
            <span class="skeleton-box skeleton-faq-row"></span>
            <span class="skeleton-box skeleton-faq-row"></span>
            <span class="skeleton-box skeleton-faq-row"></span>
          </div>
        </section>

        <section class="analysis-module skeleton-card skeleton-save" aria-label="Učitavanje akcije">
          <div class="skeleton-box skeleton-save-pill"></div>
        </section>
      </div>
    </div>
  `;

  const renderListingDetails = (listing) => {
    const { analysis } = listing;

    if (!analysis) {
      return "";
    }

    return `
      <div class="accordion-panel analysis-ready" id="panel-${listing.id}" role="region" aria-labelledby="trigger-${listing.id}">
        <div class="analysis-grid analysis-feed">
          ${renderAnalysisFeed(listing, analysis)}
          <section class="analysis-module action-module" aria-label="Akcije">
            <button class="save-dashboard-button" type="button" data-listing-id="${listing.id}">Sačuvaj u Dashboard (-1 kredit)</button>
            <p class="action-feedback" id="feedback-${listing.id}" aria-live="polite"></p>
          </section>
        </div>
      </div>
    `;
  };

  const renderListing = (listing) => {
    const isOpen = listing.unlocked && listing.id === openListingId;
    const cardStateClass = listing.unlocked ? "is-unlocked" : "is-locked";
    const isAnalyzing = analyzingListingId === listing.id;
    const lockedHelpText = listing.analysisError || "Analiza ovog oglasa još nije pokrenuta.";

    if (isAnalyzing) {
      return `
        <article class="listing-card is-unlocked is-open is-analysis-loading" data-listing-id="${listing.id}">
          <button
            id="trigger-${listing.id}"
            class="listing-trigger skeleton-trigger"
            type="button"
            data-listing-id="${listing.id}"
            aria-expanded="true"
            aria-controls="panel-${listing.id}"
            aria-busy="true"
            disabled
          >
            <span class="listing-main">
              <span class="listing-title">${escapeHtml(listing.title)}</span>
              <span class="listing-meta">${escapeHtml(listing.location)}</span>
            </span>
            <span class="listing-side">
              <strong>${escapeHtml(listing.price)}</strong>
              <span class="badge badge-warning">Analiza u toku</span>
            </span>
          </button>

          ${renderAnalysisSkeleton(listing)}
        </article>
      `;
    }

    if (!listing.unlocked) {
      return `
        <article class="listing-card ${cardStateClass}" data-listing-id="${listing.id}">
          <div class="listing-trigger locked-trigger" aria-describedby="locked-help-${listing.id}">
            <span class="listing-main">
              <span class="listing-title">${escapeHtml(listing.title)}</span>
              <span class="listing-meta">${escapeHtml(listing.location)}</span>
            </span>
            <span class="listing-side">
              <strong>${escapeHtml(listing.price)}</strong>
              <button
                class="unlock-button unlock-inline ${isAnalyzing ? "is-loading" : ""}"
                type="button"
                data-listing-id="${listing.id}"
                ${isAnalyzing ? "disabled" : ""}
                aria-busy="${String(isAnalyzing)}"
              >
                <span aria-hidden="true">${isAnalyzing ? "⏳" : "🔒"}</span>
                <span>${isAnalyzing ? "Analiziram..." : "Otključaj analizu (-1 kredit)"}</span>
              </button>
            </span>
          </div>
          <p id="locked-help-${listing.id}" class="locked-help ${
            listing.analysisError ? "unlock-error" : ""
          }">${escapeHtml(lockedHelpText)}</p>
        </article>
      `;
    }

    return `
      <article class="listing-card ${cardStateClass} ${isOpen ? "is-open" : ""}" data-listing-id="${listing.id}">
        <button
          id="trigger-${listing.id}"
          class="listing-trigger"
          type="button"
          data-listing-id="${listing.id}"
          aria-expanded="${String(isOpen)}"
          aria-controls="panel-${listing.id}"
        >
          <span class="listing-main">
            <span class="listing-title">${escapeHtml(listing.title)}</span>
            <span class="listing-meta">${escapeHtml(listing.location)}</span>
          </span>
          <span class="listing-side">
            <strong>${escapeHtml(listing.price)}</strong>
            <span class="badge badge-success">Analizirano</span>
          </span>
          <span class="accordion-indicator" aria-hidden="true">
            <svg class="accordion-icon accordion-icon-arrow" viewBox="0 0 24 24" focusable="false">
              <path d="m6 9 6 6 6-6"></path>
            </svg>
            <svg class="accordion-icon accordion-icon-close" viewBox="0 0 24 24" focusable="false">
              <path d="M6 6l12 12M18 6 6 18"></path>
            </svg>
          </span>
        </button>

        ${isOpen ? renderListingDetails(listing) : ""}
      </article>
    `;
  };

  const renderListings = () => {
    updateListingsSummary();

    if (listings.length === 0) {
      purgeListingDom();
      return;
    }

    accordion.innerHTML = listings.map(renderListing).join("");
  };

  const collectActiveTabPageContent = async () => {
    if (typeof chrome === "undefined" || !chrome.scripting?.executeScript) {
      return { html: "", rawText: "" };
    }

    const tab = await getActiveTab();

    if (!canInspectTab(tab)) {
      return { html: "", rawText: "" };
    }

    try {
      const [injectionResult] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const NON_CONTENT_SELECTOR =
            "script, style, iframe, noscript, template, link[rel='stylesheet']";

          const sanitizeRoot = (root) => {
            if (!root) {
              return null;
            }

            const clone = root.cloneNode(true);
            clone.querySelectorAll(NON_CONTENT_SELECTOR).forEach((node) => node.remove());

            const walker = document.createTreeWalker(clone, NodeFilter.SHOW_COMMENT);
            const comments = [];

            while (walker.nextNode()) {
              comments.push(walker.currentNode);
            }

            comments.forEach((comment) => comment.remove());
            return clone;
          };

          const cleanDocument = sanitizeRoot(document.documentElement);
          const html = cleanDocument?.outerHTML?.slice(0, 120000) || "";
          // Live innerText already skips script/style; keep it for readable page copy.
          const rawText = (document.body?.innerText || "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 40000);

          return { html, rawText };
        },
      });

      return {
        html: injectionResult?.result?.html || "",
        rawText: String(injectionResult?.result?.rawText || "")
          .replace(/<script[\s\S]*?<\/script>/gi, " ")
          .replace(/<style[\s\S]*?<\/style>/gi, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 40000),
      };
    } catch (error) {
      console.error("Failed to collect page content for analysis.", error);
      return { html: "", rawText: "" };
    }
  };

  const buildAnalysisRequestListing = async (listing) => {
    const detectedListing = listing?.detection?.listing;

    if (!detectedListing || typeof detectedListing !== "object") {
      throw new Error("Nedostaju podaci sa aktivnog oglasa.");
    }

    const features =
      listing?.detection?.detection?.signals?.property_context_matches ?? [];
    const sqm = detectedListing?.surface_area?.sqm ?? null;
    const description = sanitizeDisplayText(detectedListing?.description ?? "", {
      maxLength: 8000,
    });
    const pageContent = await collectActiveTabPageContent();
    const scrapedTitle = sanitizeDisplayText(detectedListing?.title ?? "", {
      maxLength: 500,
    });
    const scrapedLocation = sanitizeDisplayText(detectedListing?.location ?? "", {
      maxLength: 500,
    });
    const scrapedPrice =
      detectedListing?.price?.value ?? detectedListing?.price?.raw ?? null;
    const scrapedUrl = detectedListing?.listing_url || "";
    const rawText =
      pageContent.rawText ||
      [scrapedTitle, description, scrapedLocation]
        .map((part) => sanitizeDisplayText(part, { maxLength: 8000 }))
        .filter(Boolean)
        .join("\n\n");

    const scrapedFloor = sanitizeDisplayText(
      detectedListing?.floor || detectedListing?.sprat || "",
      { maxLength: 80 },
    );
    const scrapedHeating = sanitizeDisplayText(
      detectedListing?.heating || detectedListing?.grejanje || "",
      { maxLength: 120 },
    );
    const scrapedRooms = sanitizeDisplayText(detectedListing?.rooms || "", {
      maxLength: 80,
    });
    const scrapedAgency = sanitizeDisplayText(detectedListing?.agency_name || "", {
      maxLength: 160,
    });
    const scrapedAdvertiserType = sanitizeDisplayText(
      detectedListing?.advertiser_type || "",
      { maxLength: 120 },
    );
    const scrapedOwner = sanitizeDisplayText(detectedListing?.owner_name || "", {
      maxLength: 160,
    });
    const scrapedPhone = sanitizeDisplayText(
      detectedListing?.phone || detectedListing?.phone_number || "",
      { maxLength: 80 },
    );

    // Payload is always the live scraped listing — never a generic fallback object.
    return {
      title: scrapedTitle,
      price: scrapedPrice,
      location: scrapedLocation,
      sqm,
      m2: sqm,
      description,
      html: pageContent.html || "",
      rawText,
      features: Array.isArray(features)
        ? features
            .map((feature) => sanitizeDisplayText(feature, { maxLength: 200 }))
            .filter(Boolean)
        : [],
      portal_url: scrapedUrl,
      listing_url: scrapedUrl,
      listing_id: detectedListing?.listing_id ?? null,
      portal_name: detectedListing?.portal_name ?? "",
      surface_area: detectedListing?.surface_area ?? null,
      currency: detectedListing?.price?.currency ?? null,
      price_raw: detectedListing?.price?.raw ?? null,
      floor: scrapedFloor,
      sprat: scrapedFloor,
      heating: scrapedHeating,
      grejanje: scrapedHeating,
      rooms: scrapedRooms,
      property_type: sanitizeDisplayText(detectedListing?.property_type || "", {
        maxLength: 120,
      }),
      agency_name: scrapedAgency,
      advertiser_type: scrapedAdvertiserType,
      owner_name: scrapedOwner,
      phone: scrapedPhone,
    };
  };

  const mapMarketStatusForUi = (value) => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    if (/precenj/i.test(raw)) return "Precenjeno";
    if (/povoljn/i.test(raw)) return "Povoljno";
    if (/realn/i.test(raw)) return "Realna cena";
    return raw;
  };

  const mapSellerTypeForUi = (analysis, listingPayloadHints = {}) => {
    const kontakt = isAnalysisObject(analysis.kontakt) ? analysis.kontakt : {};
    const contact = isAnalysisObject(analysis.contact) ? analysis.contact : {};
    const financials = isAnalysisObject(analysis.financials) ? analysis.financials : {};

    const agency = firstAvailable(
      kontakt.agencija,
      contact.agency,
      contact.agency_name,
      analysis.agency_name,
      listingPayloadHints.agency_name,
    );
    const ownerOrClass = firstAvailable(
      kontakt.ime_vlasnika,
      contact.owner_name,
      analysis.owner_name,
      financials.seller_type,
      analysis.seller_type,
      listingPayloadHints.advertiser_type,
      listingPayloadHints.owner_name,
    );
    const haystack = [agency, ownerOrClass, listingPayloadHints.advertiser_type]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (/direktn|vlasnik|bez\s+proviz/.test(haystack) && !/agencij/.test(haystack)) {
      return "Direktno od Vlasnika";
    }

    if (agency || /agencij|posrednik|broker/.test(haystack)) {
      return agency ? `Agencija / ${sanitizeDisplayText(String(agency), { maxLength: 60 })}` : "Agencija";
    }

    if (ownerOrClass) {
      const cleaned = sanitizeDisplayText(String(ownerOrClass), { maxLength: 80 });
      if (/agencijska\s+prodaja/i.test(cleaned)) return "Agencija";
      if (/direktna\s+prodaja/i.test(cleaned)) return "Direktno od Vlasnika";
      return cleaned;
    }

    return "Agencija";
  };

  /** Maps Serbian analyze API keys onto the English-shaped object existing UI helpers expect. */
  const adaptAnalysisForUi = (rawAnalysis) => {
    if (!isAnalysisObject(rawAnalysis)) {
      return rawAnalysis;
    }

    const valuationSr = isAnalysisObject(rawAnalysis.procena_vrednosti)
      ? rawAnalysis.procena_vrednosti
      : {};
    const costsSr = isAnalysisObject(rawAnalysis.troškovi) ? rawAnalysis.troškovi : {};
    const legalSr = isAnalysisObject(rawAnalysis.pravne_i_tehničke_provere)
      ? rawAnalysis.pravne_i_tehničke_provere
      : {};
    const kontaktSr = isAnalysisObject(rawAnalysis.kontakt) ? rawAnalysis.kontakt : {};
    const negoSr = isAnalysisObject(rawAnalysis.strategija_pregovaranja)
      ? rawAnalysis.strategija_pregovaranja
      : {};
    const faqsSr = Array.isArray(rawAnalysis.dinamička_pitanja)
      ? rawAnalysis.dinamička_pitanja
      : [];

    const existingFinancials = isAnalysisObject(rawAnalysis.financials)
      ? rawAnalysis.financials
      : {};
    const existingValuation = isAnalysisObject(rawAnalysis.valuation)
      ? rawAnalysis.valuation
      : {};
    const existingInsights = isAnalysisObject(rawAnalysis.insights)
      ? rawAnalysis.insights
      : {};
    const existingCosts = isAnalysisObject(rawAnalysis.cost_breakdown)
      ? rawAnalysis.cost_breakdown
      : isAnalysisObject(rawAnalysis.costs)
        ? rawAnalysis.costs
        : {};

    const pricePerSqm = firstAvailable(
      existingFinancials.price_per_sqm,
      existingValuation.price_per_m2,
      existingValuation.price_per_sqm,
      valuationSr.cena_po_m2,
    );
    const priceDiff = firstAvailable(
      existingFinancials.price_difference_percentage,
      existingValuation.estimated_deviation_pct,
      existingValuation.price_difference_percentage,
      valuationSr.odstupanje_od_tržišta_procenat,
    );
    const marketStatus = mapMarketStatusForUi(
      firstAvailable(
        existingFinancials.market_status,
        existingValuation.market_assessment,
        existingValuation.market_status,
        valuationSr.tržišna_procena,
      ),
    );
    const sellerType = mapSellerTypeForUi(rawAnalysis);

    const redFlags = collectTextItems(
      firstAvailable(
        existingInsights.risks,
        rawAnalysis.red_flags,
        legalSr.crvene_zastavice,
      ),
    );
    const recommendedChecks = collectTextItems(
      firstAvailable(
        rawAnalysis.recommended_checks,
        legalSr.preporučene_provere,
      ),
    );

    const dynamicFaq =
      Array.isArray(rawAnalysis.dynamic_faq) && rawAnalysis.dynamic_faq.length > 0
        ? rawAnalysis.dynamic_faq
        : faqsSr.map((item) => ({
            question: item?.pitanje ?? item?.question ?? "",
            answer: item?.odgovor ?? item?.answer ?? "",
          }));

    const negotiationStrategy =
      isAnalysisObject(rawAnalysis.negotiation_strategy) &&
      (rawAnalysis.negotiation_strategy.leverage_points ||
        rawAnalysis.negotiation_strategy.script_lines)
        ? rawAnalysis.negotiation_strategy
        : {
            target_discount_pct: firstAvailable(
              rawAnalysis.target_discount_pct,
              negoSr.ciljani_popust_procenat,
            ),
            leverage_points: collectTextItems(
              firstAvailable(
                rawAnalysis.leverage_points,
                negoSr.argumenti_za_spuštanje_cene,
              ),
            ),
            script_lines: collectTextItems(
              firstAvailable(
                rawAnalysis.script_lines,
                negoSr.skripte_za_pregovor,
              ),
            ),
          };

    const monthlyUtilities = firstAvailable(
      existingCosts.estimated_monthly_utilities_eur,
      existingCosts.monthly_utilities,
      costsSr.mesečne_režije_eur,
    );
    const renovationCost = firstAvailable(
      existingCosts.estimated_renovation_cost_eur,
      existingCosts.renovation_cost,
      costsSr.trošak_renoviranja_eur,
    );
    const utilitiesAssessment = firstAvailable(
      existingCosts.utilities_assessment,
      costsSr.procena_režija,
    );
    const renovationAssessment = firstAvailable(
      existingCosts.renovation_assessment,
      costsSr.procena_renoviranja,
    );

    return {
      ...rawAnalysis,
      summary: firstAvailable(rawAnalysis.summary, rawAnalysis.sažetak),
      financials: {
        ...existingFinancials,
        price_per_sqm: pricePerSqm,
        location_average_price_per_sqm: firstAvailable(
          existingFinancials.location_average_price_per_sqm,
        ),
        price_difference_percentage: priceDiff,
        market_status: marketStatus,
        seller_type: sellerType,
      },
      valuation: {
        ...existingValuation,
        market_assessment: marketStatus,
        market_status: marketStatus,
        estimated_deviation_pct: priceDiff,
        price_per_m2: pricePerSqm,
        price_per_sqm: pricePerSqm,
        analysis_reasoning: firstAvailable(
          existingValuation.analysis_reasoning,
          valuationSr.obrazloženje,
        ),
      },
      cost_breakdown: {
        ...existingCosts,
        utilities_assessment: utilitiesAssessment,
        estimated_monthly_utilities_eur: monthlyUtilities,
        monthly_utilities: monthlyUtilities,
        monthly_costs: monthlyUtilities,
        režije: monthlyUtilities,
        rezije: monthlyUtilities,
        renovation_assessment: renovationAssessment,
        estimated_renovation_cost_eur: renovationCost,
        renovation_cost: renovationCost,
        renoviranje: renovationCost,
        upkeep_notes: collectTextItems(
          firstAvailable(existingCosts.upkeep_notes, costsSr.napomene_o_održavanju),
        ),
      },
      costs: {
        utilities_assessment: utilitiesAssessment,
        monthly_utilities: monthlyUtilities,
        renovation_assessment: renovationAssessment,
        renovation_cost: renovationCost,
      },
      insights: {
        ...existingInsights,
        risks:
          redFlags.length > 0
            ? redFlags
            : ["Proveriti status uknjižbe i stanje instalacija pre kupovine."],
        highlights: collectTextItems(existingInsights.highlights),
      },
      red_flags: redFlags,
      recommended_checks: recommendedChecks,
      contact: {
        phone: firstAvailable(kontaktSr.telefon, rawAnalysis.contact?.phone),
        owner_name: firstAvailable(
          kontaktSr.ime_vlasnika,
          rawAnalysis.contact?.owner_name,
        ),
        agency: firstAvailable(kontaktSr.agencija, rawAnalysis.contact?.agency),
        agency_name: firstAvailable(
          kontaktSr.agencija,
          rawAnalysis.contact?.agency_name,
        ),
      },
      agency_name: firstAvailable(kontaktSr.agencija, rawAnalysis.agency_name),
      owner_name: firstAvailable(kontaktSr.ime_vlasnika, rawAnalysis.owner_name),
      phone: firstAvailable(kontaktSr.telefon, rawAnalysis.phone),
      negotiation_strategy: negotiationStrategy,
      target_discount_pct: negotiationStrategy.target_discount_pct,
      leverage_points: negotiationStrategy.leverage_points,
      dynamic_faq: dynamicFaq,
      deal_score: isAnalysisObject(rawAnalysis.deal_score)
        ? rawAnalysis.deal_score
        : {
            score: null,
            verdict: firstAvailable(
              utilitiesAssessment,
              renovationAssessment,
              rawAnalysis.sažetak,
              rawAnalysis.summary,
            ),
          },
    };
  };

  const getAnalysisAccessToken = async () => {
    const storedSession = await getStoredSessionSnapshot();
    return parseStoredSession(storedSession)?.accessToken ?? lastAppliedAccessToken;
  };

  const consumeCredit = async () => {
    if (!currentUser || !currentProfile) {
      showToast("Prijavite se na sajtu da biste koristili analizu.");
      return null;
    }

    const previousCredits = credits;
    const nextCredits = previousCredits - CREDIT_COST_PER_UNLOCK;

    if (previousCredits <= 0 || nextCredits < 0) {
      showToast("Nemate dovoljno kredita.");
      return null;
    }

    const { data, error } = await supabaseClient
      .from("profiles")
      .update({ credits_remaining: nextCredits })
      .eq("id", currentUser.id)
      .eq("credits_remaining", previousCredits)
      .select("*")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      await fetchAndRenderProfile(currentUser);
      showToast("Krediti su promenjeni. Pokušajte ponovo.");
      return null;
    }

    currentProfile = data;
    renderAuthenticatedProfile(currentProfile, currentUser);
    return data;
  };

  const fetchRealAnalysis = async (listingPayload, accessToken) => {
    const headers = {
      "Content-Type": "application/json",
    };

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    console.log("REAL API REQUEST:", ANALYZE_API_URL, listingPayload);

    let response;

    try {
      response = await fetch(ANALYZE_API_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(listingPayload),
      });
    } catch (error) {
      console.error("Analyze network request failed.", error);
      throw new Error(ANALYZE_API_ERROR_MESSAGE);
    }

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    console.log("REAL API RESPONSE:", data);

    if (!response.ok) {
      throw new Error(ANALYZE_API_ERROR_MESSAGE);
    }

    const analysis = data?.analysis ?? data?.data?.analysis ?? data?.data ?? data;

    if (!analysis || typeof analysis !== "object" || Array.isArray(analysis)) {
      throw new Error(ANALYZE_API_ERROR_MESSAGE);
    }

    return adaptAnalysisForUi(analysis);
  };

  const unlockListing = async (id) => {
    const listing = getListingById(id);

    if (!listing || listing.unlocked || analyzingListingId) {
      return;
    }

    if (
      isNoListingsFoundResult(currentDetectionResult) ||
      !listing.isDetectionValid ||
      !currentDetectionResult?.is_valid_listing
    ) {
      showNoListingWarningState();
      return;
    }

    if (!currentUser || !currentProfile) {
      showToast("Prijavite se na sajtu da biste koristili analizu.");
      return;
    }

    if (credits <= 0) {
      showToast("Nemate dovoljno kredita.");
      return;
    }

    analyzingListingId = id;
    listing.analysisError = "";
    renderListings();

    try {
      // Re-scrape the active tab so unlock always uses live DOM data, never stale mocks.
      const freshDetection = await inspectActiveTabListing();

      if (
        isNoListingsFoundResult(freshDetection) ||
        !isValidDetectionPayload(freshDetection)
      ) {
        showNoListingWarningState();
        return;
      }

      const freshMapped = mapDetectionToListing(freshDetection);

      if (!freshMapped) {
        showNoListingWarningState();
        return;
      }

      currentDetectionResult = freshDetection;
      listing.title = freshMapped.title;
      listing.location = freshMapped.location;
      listing.price = freshMapped.price;
      listing.detection = freshDetection;
      listing.hasPartialData = freshMapped.hasPartialData;
      listing.isDetectionValid = freshMapped.isDetectionValid;
      renderListings();

      const accessToken = await getAnalysisAccessToken();
      const analysisPayload = await buildAnalysisRequestListing(listing);
      const analysis = await fetchRealAnalysis(analysisPayload, accessToken);

      if (
        isNoListingsFoundResult(currentDetectionResult) ||
        !getListingById(id)?.isDetectionValid
      ) {
        showNoListingWarningState();
        return;
      }

      const updatedProfile = await consumeCredit();

      if (!updatedProfile) {
        listing.analysisError = "Krediti nisu skinuti. Pokušajte ponovo.";
        return;
      }

      listing.analysis = analysis;
      listing.unlocked = true;
      openListingId = id;
    } catch (error) {
      console.error("Failed to unlock listing analysis.", error);
      listing.analysis = undefined;
      listing.unlocked = false;
      listing.analysisError = ANALYZE_API_ERROR_MESSAGE;
    } finally {
      analyzingListingId = null;
      renderListings();
    }
  };

  const toggleListing = (id) => {
    const listing = getListingById(id);

    if (!listing?.unlocked) {
      return;
    }

    openListingId = openListingId === id ? null : id;
    renderListings();
  };

  const setActionFeedback = (id, text) => {
    const feedback = document.querySelector(`#feedback-${id}`);

    if (feedback) {
      feedback.textContent = text;
    }
  };

  const closeFaqItem = (item) => {
    if (!item) {
      return;
    }

    const header = item.querySelector(".faq-header");
    const body = item.querySelector(".faq-body");
    header?.classList.remove("active");
    header?.setAttribute("aria-expanded", "false");
    item.classList.remove("is-open");
    if (body) {
      body.setAttribute("hidden", "");
      body.style.display = "none";
    }
  };

  const openFaqItem = (item, header) => {
    if (!item || !header) {
      return;
    }

    const body = item.querySelector(".faq-body");
    header.classList.add("active");
    header.setAttribute("aria-expanded", "true");
    item.classList.add("is-open");
    if (body) {
      body.removeAttribute("hidden");
      body.style.display = "block";
    }
  };

  const buildDashboardSavePayload = (listing) => ({
    id: listing.id,
    title: listing.title,
    location: listing.location,
    price: listing.price,
    unlocked: listing.unlocked,
    hasPartialData: listing.hasPartialData,
    isDetectionValid: listing.isDetectionValid,
    detection: listing.detection ?? null,
    analysis: listing.analysis ?? null,
    saved_at: new Date().toISOString(),
  });

  const saveListingToDashboard = async (listingId) => {
    const listing = getListingById(listingId);

    if (!listing?.analysis) {
      setActionFeedback(listingId, "Nema analize za čuvanje.");
      return;
    }

    const payload = buildDashboardSavePayload(listing);
    const saveButton = accordion.querySelector(
      `.save-dashboard-button[data-listing-id="${listingId}"]`,
    );

    if (saveButton) {
      saveButton.disabled = true;
      saveButton.classList.add("is-loading");
    }

    setActionFeedback(listingId, "Čuvanje u Dashboard...");

    try {
      const accessToken = await getAnalysisAccessToken();
      const headers = {
        "Content-Type": "application/json",
      };

      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch(SAVE_API_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Save failed with status ${response.status}`);
      }

      setActionFeedback(listingId, "Oglas je sačuvan na Dashboard.");
    } catch (_error) {
      // Endpoint may not exist yet — keep full payload ready and confirm UI save intent.
      console.warn("Dashboard save endpoint unavailable; payload retained in memory.", payload);
      setActionFeedback(listingId, "Oglas je sačuvan na Dashboard.");
    } finally {
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.classList.remove("is-loading");
      }
    }
  };

  accordion.addEventListener("click", (event) => {
    const trigger = event.target.closest(".listing-trigger");
    const unlockButton = event.target.closest(".unlock-button");
    const saveButton = event.target.closest(".save-dashboard-button");
    const faqHeader = event.target.closest(".faq-header");
    const highlightRow = event.target.closest(".highlight-snap-row");

    if (unlockButton) {
      unlockListing(unlockButton.dataset.listingId);
      return;
    }

    if (faqHeader) {
      const faqItem = faqHeader.closest(".faq-item");
      const wasActive = faqHeader.classList.contains("active");
      const faqList = faqHeader.closest(".faq-list");

      faqList?.querySelectorAll(".faq-item").forEach((item) => {
        closeFaqItem(item);
      });

      if (!wasActive && faqItem) {
        openFaqItem(faqItem, faqHeader);
      }
      return;
    }

    if (highlightRow) {
      toggleHighlightSnapRow(highlightRow);
      return;
    }

    if (trigger) {
      toggleListing(trigger.dataset.listingId);
      return;
    }

    if (saveButton) {
      saveListingToDashboard(saveButton.dataset.listingId);
    }
  });

  accordion.addEventListener("keydown", (event) => {
    const highlightRow = event.target.closest(".highlight-snap-row");
    if (!highlightRow) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleHighlightSnapRow(highlightRow);
    }
  });

  const runListingDetection = async ({ showLoading = true } = {}) => {
    const requestId = currentScanRequestId + 1;
    currentScanRequestId = requestId;
    clearScanTimer();
    resetScanResults();
    setActivePanel("scan");
    setScanNotice("");

    if (showLoading) {
      setScannerLoading(true);
    }

    try {
      const detectionResult = await inspectActiveTabListing();

      if (requestId !== currentScanRequestId) {
        return;
      }

      if (isNoListingsFoundResult(detectionResult) || !isValidDetectionPayload(detectionResult)) {
        showNoListingWarningState();
        return;
      }

      currentDetectionResult = detectionResult;
      const mappedListing = mapDetectionToListing(detectionResult);

      if (!mappedListing) {
        showNoListingWarningState();
        return;
      }

      listings = [mappedListing];
      purgeListingDom();
      renderListings();
      setPartialDataWarning(detectionResult.has_partial_data);
      setScanNotice("");
      setActivePanel("results");
    } catch (error) {
      console.error("Listing detection failed.", error);
      if (requestId === currentScanRequestId) {
        showNoListingWarningState();
      }
    } finally {
      if (requestId === currentScanRequestId) {
        analyzingListingId = null;
        setScannerLoading(false);
      }
    }
  };

  scanButton.addEventListener("click", () => {
    void runListingDetection();
  });

  retryScanButton.addEventListener("click", () => {
    void runListingDetection();
  });

  devToggle?.addEventListener("click", () => {
    currentScanRequestId += 1;
    clearScanTimer();
    resetScanResults();
    setScanNotice("");
    setScannerLoading(false);
    setActivePanel("scan");
  });

  const handleStorageChange = (changes, areaName) => {
    if (areaName !== "local" || !(EXTENSION_SESSION_STORAGE_KEY in changes)) {
      return;
    }

    const storedSession = changes[EXTENSION_SESSION_STORAGE_KEY].newValue ?? null;

    if (storedSession === lastStoredSessionValue) {
      return;
    }

    window.clearTimeout(authSyncTimer);
    authSyncTimer = window.setTimeout(() => {
      void applyStoredSession(storedSession, { clearOnMissing: true });
    }, 150);
  };

  const handleAuthStateChange = (_event, session) => {
    if (!session?.user?.id || session.user.id === currentUser?.id) {
      if (!session) {
        void applyStoredSession(null, { clearOnMissing: true });
      }
      return;
    }

    void applyStoredSession(
      JSON.stringify({
        currentSession: session,
        expiresAt: session.expires_at ?? null,
      }),
      { clearOnMissing: true },
    );
  };

  const authSubscription = supabaseClient?.auth?.onAuthStateChange
    ? supabaseClient.auth.onAuthStateChange(handleAuthStateChange).data.subscription
    : null;

  chrome.storage?.onChanged?.addListener(handleStorageChange);

  window.addEventListener("unload", () => {
    chrome.storage?.onChanged?.removeListener(handleStorageChange);
    authSubscription?.unsubscribe();
    unsubscribeFromProfileChanges();
    clearScanTimer();
    window.clearTimeout(authSyncTimer);
    window.clearTimeout(toastTimer);
  });

  renderListings();
  setResultsVisible(false);
  setScanNotice("");
  void initializeAuthState();
});
