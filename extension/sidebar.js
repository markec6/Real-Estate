const DEFAULT_CREDITS_LIMIT = 20;
const CREDIT_COST_PER_UNLOCK = 1;
const AUTH_CHECK_TIMEOUT_MS = 3000;

const initialListings = [
  {
    id: "vracar-54",
    title: "Dvosoban stan 54m², Vračar",
    location: "Vračar, Beograd",
    price: "120.000 €",
    unlocked: false,
  },
  {
    id: "novi-beograd-68",
    title: "Trosoban stan 68m², Novi Beograd",
    location: "Blok 45, Novi Beograd",
    price: "149.000 €",
    unlocked: false,
  },
  {
    id: "nis-42",
    title: "Jednoiposoban stan 42m², Centar Niša",
    location: "Centar, Niš",
    price: "73.500 €",
    unlocked: false,
  },
];

document.addEventListener("DOMContentLoaded", () => {
  const scanState = document.querySelector("#scan-state");
  const resultsState = document.querySelector("#results-state");
  const scanButton = document.querySelector("#scan-button");
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
    !resultsState ||
    !scanButton ||
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

  const {
    ALLOWED_WEBSITE_ORIGINS = [],
    EXTENSION_SESSION_STORAGE_KEY,
    WEBSITE_DASHBOARD_URL,
    WEBSITE_LOGIN_URL,
    WEBSITE_ORIGIN,
  } = window.breiConfig ?? {};

  const supabaseClient = window.breiSupabase;

  let currentSession = null;
  let currentUser = null;
  let currentProfile = null;
  let profileChannel = null;
  let credits = 0;
  let creditsLimit = DEFAULT_CREDITS_LIMIT;
  let openListingId = null;
  let listings = initialListings.map((listing) => ({ ...listing }));
  let analyzingListingId = null;
  let scanTimer = null;
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

  const formatNumber = (value) =>
    new Intl.NumberFormat("sr-RS", {
      maximumFractionDigits: 0,
    }).format(value);

  const formatPercentage = (value) => {
    const absoluteValue = Math.abs(value);
    const precision = Number.isInteger(absoluteValue) ? 0 : 1;
    const sign = value > 0 ? "+" : "";

    return `${sign}${value.toFixed(precision)}%`;
  };

  const getMarketTone = (marketStatus) =>
    marketStatus === "Precenjeno" ? "warning" : "success";

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const withTimeout = (promise, timeoutMs, timeoutMessage) => {
    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = window.setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeoutMs);
    });

    return Promise.race([promise, timeout]).finally(() => {
      window.clearTimeout(timeoutId);
    });
  };

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

  const isAllowedWebsiteUrl = (url) => {
    if (!url) {
      return false;
    }

    try {
      const origin = new URL(url).origin;
      return ALLOWED_WEBSITE_ORIGINS.includes(origin) || origin === WEBSITE_ORIGIN;
    } catch {
      return false;
    }
  };

  const requestWebsiteSessionSync = async () => {
    if (typeof chrome === "undefined" || !chrome.tabs?.query || !chrome.tabs?.sendMessage) {
      return;
    }

    try {
      const tabs = await chrome.tabs.query({});
      const websiteTabs = tabs.filter((tab) => tab.id && isAllowedWebsiteUrl(tab.url));

      if (websiteTabs.length === 0) {
        return;
      }

      const responses = await Promise.all(
        websiteTabs.map(async (tab) => {
          try {
            return await chrome.tabs.sendMessage(tab.id, {
              type: "BREI_SYNC_AUTH_SESSION",
            });
          } catch (error) {
            return { ok: false, error: String(error) };
          }
        }),
      );

      console.log("[Extension Auth] Manual website session sync:", responses);
    } catch (error) {
      console.log("[Extension Auth] Manual website session sync skipped:", error);
    }
  };

  const getNumberValue = (...values) => {
    const value = values.find((candidate) => Number.isFinite(Number(candidate)));
    return value === undefined ? 0 : Number(value);
  };

  const getDisplayName = (profile, user) => {
    const fullName = profile?.fullname?.trim();
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
    currentSession = null;
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

  const renderProfileLoading = () => {
    setProfileStateClass("loading");
    profileAvatar.textContent = "...";
    profileLabel.textContent = "Učitavanje profila...";
    profileSubtitle.textContent = "Proveravamo Supabase sesiju";
    profileEmail.textContent = "";
    profileAction.textContent = "Prijava";
    profileAction.href = WEBSITE_LOGIN_URL || "#";
  };

  const renderProfileError = (user) => {
    setProfileStateClass("error");
    profileAvatar.textContent = getInitials(user?.email);
    profileLabel.textContent = user?.email || "Profil nije učitan";
    profileSubtitle.textContent = "Nije moguće učitati Supabase profil.";
    profileEmail.textContent = "";
    profileAction.textContent = "Dashboard";
    profileAction.href = WEBSITE_DASHBOARD_URL || "#";
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
      return;
    }

    supabaseClient.removeChannel(profileChannel);
    profileChannel = null;
  };

  const subscribeToProfileChanges = (userId) => {
    unsubscribeFromProfileChanges();

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
          currentProfile = payload.new;
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

  const syncUserProfile = async ({ silent = false } = {}) => {
    if (!supabaseClient?.auth?.getSession) {
      console.error("Supabase client is not available in the extension sidebar.");
      renderUnauthenticatedProfile();
      return null;
    }

    if (!silent) {
      renderProfileLoading();
    }

    try {
      const storedSession = await withTimeout(
        getStoredSessionSnapshot(),
        AUTH_CHECK_TIMEOUT_MS,
        "Timed out while reading chrome.storage.local session.",
      );
      const { data: sessionData, error: sessionError } = await withTimeout(
        supabaseClient.auth.getSession(),
        AUTH_CHECK_TIMEOUT_MS,
        "Timed out while checking Supabase auth session.",
      );

      if (sessionError) {
        throw sessionError;
      }

      const session = sessionData?.session;
      const user = session?.user;
      console.log("[Extension Auth] Session active:", Boolean(session && user), {
        hasChromeStorageSession: Boolean(storedSession),
        userId: user?.id ?? null,
      });

      if (!session || !user) {
        unsubscribeFromProfileChanges();
        renderUnauthenticatedProfile();
        renderListings();
        return null;
      }

      currentSession = session;
      currentUser = user;

      const { data: profile, error: profileError } = await withTimeout(
        supabaseClient
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .limit(1)
          .single(),
        AUTH_CHECK_TIMEOUT_MS,
        "Timed out while fetching Supabase profile.",
      );

      if (profileError) {
        console.error("[Extension Profile Fetch Error:]", profileError);
        throw profileError;
      }

      currentProfile = profile;
      renderAuthenticatedProfile(currentProfile, currentUser);
      subscribeToProfileChanges(user.id);
      renderListings();
      return profile;
    } catch (error) {
      console.error("[Extension Profile Fetch Error:]", error);
      console.error("Failed to sync Supabase user profile.", error);
      unsubscribeFromProfileChanges();
      if (!currentUser) {
        renderUnauthenticatedProfile();
      } else {
        renderProfileError(currentUser);
      }
      renderListings();
      return null;
    }
  };

  const setScannerLoading = (isLoading) => {
    scanButton.classList.toggle("is-loading", isLoading);
    scanButton.toggleAttribute("disabled", isLoading);
    scanButton.setAttribute("aria-busy", String(isLoading));
  };

  const clearScanTimer = () => {
    if (scanTimer) {
      window.clearTimeout(scanTimer);
      scanTimer = null;
    }
  };

  const setResultsVisible = (isVisible) => {
    scanState.classList.toggle("is-hidden", isVisible);
    resultsState.classList.toggle("is-hidden", !isVisible);
    scanState.setAttribute("aria-hidden", String(isVisible));
    resultsState.setAttribute("aria-hidden", String(!isVisible));
    devToggle?.classList.toggle("is-active", isVisible);
    devToggle?.setAttribute("aria-pressed", String(isVisible));
  };

  const getListingById = (id) => listings.find((listing) => listing.id === id);

  const renderInsightItems = (analysis) => {
    const riskItems = analysis.insights.risks.map((risk) => ({
      icon: "⚠️",
      text: risk,
      tone: "warning",
    }));
    const highlightItems = analysis.insights.highlights.map((highlight) => ({
      icon: "✅",
      text: highlight,
      tone: "success",
    }));
    const insightItems = [...riskItems, ...highlightItems];

    if (insightItems.length === 0) {
      return `
        <li class="risk-item risk-success">
          <span class="risk-icon" aria-hidden="true">✅</span>
          <span>Nema izdvojenih rizika ili prednosti u dostupnim podacima oglasa.</span>
        </li>
      `;
    }

    return insightItems
      .map(
        (item) => `
          <li class="risk-item risk-${item.tone}">
            <span class="risk-icon" aria-hidden="true">${item.icon}</span>
            <span>${escapeHtml(item.text)}</span>
          </li>
        `,
      )
      .join("");
  };

  const renderQuickPrompts = (listing) =>
    listing.analysis.dynamic_quick_prompts
      .map(
        (prompt) => `
          <button
            class="prompt-chip"
            type="button"
            data-listing-id="${listing.id}"
            data-prompt-label="${escapeHtml(prompt.label)}"
            data-prompt-query="${escapeHtml(prompt.prompt_query)}"
            aria-pressed="false"
          >
            ${escapeHtml(prompt.label)}
          </button>
        `,
      )
      .join("");

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

        <section class="analysis-module skeleton-card skeleton-financials" aria-label="Učitavanje finansijskog pregleda">
          <div class="skeleton-box skeleton-price-box"></div>
          <div class="skeleton-badge-row">
            <span class="skeleton-box skeleton-badge"></span>
            <span class="skeleton-box skeleton-badge"></span>
          </div>
        </section>

        <section class="analysis-module skeleton-card skeleton-score" aria-label="Učitavanje AI ocene ponude">
          <div class="skeleton-box skeleton-score-bar"></div>
        </section>

        <section class="analysis-module skeleton-card skeleton-insights" aria-label="Učitavanje rizika i prednosti">
          <div class="skeleton-box skeleton-line skeleton-line-100"></div>
          <div class="skeleton-box skeleton-line skeleton-line-80"></div>
          <div class="skeleton-box skeleton-line skeleton-line-60"></div>
        </section>

        <section class="analysis-module skeleton-card skeleton-prompts" aria-label="Učitavanje brzih upita">
          <div class="skeleton-chip-row">
            <span class="skeleton-box skeleton-chip"></span>
            <span class="skeleton-box skeleton-chip"></span>
            <span class="skeleton-box skeleton-chip"></span>
          </div>
        </section>
      </div>
    </div>
  `;

  const renderListingDetails = (listing) => {
    const { analysis } = listing;

    if (!analysis) {
      return "";
    }

    const score = analysis.deal_score.score;
    const scoreWidth = Math.min(Math.max(score * 10, 0), 100);
    const marketTone = getMarketTone(analysis.financials.market_status);
    const marketComparison = `${analysis.financials.market_status} (${formatPercentage(
      analysis.financials.price_difference_percentage,
    )})`;

    return `
      <div class="accordion-panel analysis-ready" id="panel-${listing.id}" role="region" aria-labelledby="trigger-${listing.id}">
        <div class="analysis-grid">
          <section class="analysis-module market-module" aria-label="Finansijski i tržišni pregled">
            <p class="module-kicker">FINANSIJSKI I TRŽIŠNI PREGLED</p>
            <div class="price-block compact">
              <p class="price-value">${formatNumber(analysis.financials.price_per_sqm)} € / m²</p>
              <p class="muted-label">Oglašena cena po m²</p>
            </div>
            <div class="module-tags">
              <span class="badge badge-${marketTone}">${escapeHtml(marketComparison)}</span>
              <span class="badge badge-owner">${escapeHtml(analysis.financials.seller_type)}</span>
            </div>
          </section>

          <section class="analysis-module score-module" aria-label="AI ocena ponude">
            <div class="module-title-row">
              <p class="module-kicker">AI OCENA PONUDE</p>
              <strong>${score.toFixed(1)} / 10</strong>
            </div>
            <div class="progress-track score-track" aria-label="AI ocena: ${score.toFixed(1)} od 10">
              <div class="progress-fill score-fill" style="width: ${scoreWidth}%"></div>
            </div>
            <p class="score-caption">${escapeHtml(analysis.deal_score.verdict)}</p>
          </section>

          <section class="analysis-module risk-module" aria-label="AI detektor rizika i prednosti">
            <p class="module-kicker">AI DETEKTOR RIZIKA I PREDNOSTI</p>
            <ul class="risk-list">
              ${renderInsightItems(analysis)}
            </ul>
          </section>

          <section class="analysis-module action-module" aria-label="Brze akcije">
            <p class="module-kicker">BRZE AKCIJE</p>
            <div class="prompt-chips" role="group" aria-label="Brzi upiti">
              ${renderQuickPrompts(listing)}
            </div>
            <div
              class="prompt-answer"
              id="prompt-answer-${listing.id}"
              aria-live="polite"
              aria-hidden="true"
            ></div>
            <button class="save-dashboard-button" type="button" data-listing-id="${listing.id}">Sačuvaj na Dashboard</button>
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
    accordion.innerHTML = listings.map(renderListing).join("");
    updateCredits();
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
      await syncUserProfile({ silent: true });
      showToast("Krediti su promenjeni. Pokušajte ponovo.");
      return null;
    }

    currentProfile = data;
    renderAuthenticatedProfile(currentProfile, currentUser);
    return data;
  };

  const unlockListing = async (id) => {
    const listing = getListingById(id);

    if (!listing || listing.unlocked || analyzingListingId) {
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

    if (!window.mockAiService?.getMockAnalysisForListing) {
      listing.analysisError = "Mock AI servis nije učitan. Osvežite ekstenziju i pokušajte ponovo.";
      renderListings();
      return;
    }

    analyzingListingId = id;
    listing.analysisError = "";
    renderListings();

    try {
      const analysis = await window.mockAiService.getMockAnalysisForListing(id);
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
      listing.analysisError =
        error instanceof Error
          ? error.message
          : "Greška pri analizi oglasa. Pokušajte ponovo.";
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

  const getQuickPromptAnswer = (listing, promptLabel, promptQuery) => {
    const firstRisk = listing.analysis?.insights.risks[0];
    const firstHighlight = listing.analysis?.insights.highlights[0];
    const answerParts = [
      `Simuliran AI odgovor za "${promptLabel}".`,
      `Upit: ${promptQuery}`,
      firstRisk ? `Ključni rizik: ${firstRisk}` : "",
      firstHighlight ? `Glavna prednost: ${firstHighlight}` : "",
      "Koristite ovaj odgovor kao početnu procenu pre pravne i tržišne provere.",
    ];

    return answerParts.filter(Boolean).join(" ");
  };

  const toggleQuickPromptAnswer = (promptChip) => {
    const listing = getListingById(promptChip.dataset.listingId);
    const actionModule = promptChip.closest(".action-module");
    const promptAnswer = actionModule?.querySelector(".prompt-answer");

    if (!listing || !promptAnswer) {
      return;
    }

    const wasActive = promptChip.classList.contains("is-active");
    actionModule
      .querySelectorAll(".prompt-chip")
      .forEach((chip) => {
        chip.classList.remove("is-active");
        chip.setAttribute("aria-pressed", "false");
      });

    if (wasActive) {
      promptAnswer.classList.remove("is-open");
      promptAnswer.setAttribute("aria-hidden", "true");
      return;
    }

    promptChip.classList.add("is-active");
    promptChip.setAttribute("aria-pressed", "true");
    promptAnswer.textContent = getQuickPromptAnswer(
      listing,
      promptChip.dataset.promptLabel,
      promptChip.dataset.promptQuery,
    );
    promptAnswer.classList.add("is-open");
    promptAnswer.setAttribute("aria-hidden", "false");
  };

  accordion.addEventListener("click", (event) => {
    const trigger = event.target.closest(".listing-trigger");
    const unlockButton = event.target.closest(".unlock-button");
    const promptChip = event.target.closest(".prompt-chip");
    const saveButton = event.target.closest(".save-dashboard-button");

    if (unlockButton) {
      unlockListing(unlockButton.dataset.listingId);
      return;
    }

    if (trigger) {
      toggleListing(trigger.dataset.listingId);
      return;
    }

    if (promptChip) {
      toggleQuickPromptAnswer(promptChip);
      return;
    }

    if (saveButton) {
      setActionFeedback(saveButton.dataset.listingId, "Oglas je sačuvan na Dashboard.");
    }
  });

  scanButton.addEventListener("click", () => {
    clearScanTimer();
    setScannerLoading(true);

    scanTimer = window.setTimeout(() => {
      setScannerLoading(false);
      setResultsVisible(true);
      scanTimer = null;
    }, 900);
  });

  devToggle?.addEventListener("click", () => {
    clearScanTimer();
    setScannerLoading(false);
    setResultsVisible(false);
  });

  profileAction.addEventListener("click", () => {
    void requestWebsiteSessionSync().then(() => syncUserProfile({ silent: true }));
  });

  const authStateListener = supabaseClient?.auth?.onAuthStateChange
    ? supabaseClient.auth.onAuthStateChange(() => {
        void syncUserProfile({ silent: true });
      }).data
    : null;

  if (!authStateListener) {
    console.error("Supabase auth listener was not registered because the client is unavailable.");
  }

  const handleStorageChange = (changes, areaName) => {
    if (areaName === "local" && EXTENSION_SESSION_STORAGE_KEY in changes) {
      void syncUserProfile({ silent: true });
    }
  };

  chrome.storage?.onChanged?.addListener(handleStorageChange);

  window.addEventListener("unload", () => {
    authStateListener?.subscription?.unsubscribe();
    chrome.storage?.onChanged?.removeListener(handleStorageChange);
    unsubscribeFromProfileChanges();
    clearScanTimer();
    window.clearTimeout(toastTimer);
  });

  renderListings();
  setResultsVisible(false);
  void syncUserProfile();
});
