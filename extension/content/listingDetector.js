(() => {
  const MAX_TEXT_LENGTH = 90000;
  const MAX_ELEMENTS = 180;
  const STRONG_PROPERTY_TYPES = new Set([
    "realestatelisting",
    "singlefamilyresidence",
    "apartment",
    "house",
    "accommodation",
  ]);
  const PRICE_SELECTORS = [
    ".offer-price-value",
    ".price-ad-detail",
    ".listing-price",
    ".price-by-surface",
    ".price-garant",
    ".price",
    "#cena",
    ".cena",
    '[itemprop="price"]',
    '[itemprop="priceCurrency"]',
    '[class*="price" i]',
    '[class*="cena" i]',
    '[id*="price" i]',
    '[data-testid*="price" i]',
  ];
  const TITLE_SELECTORS = [
    ".page-title",
    "h1.page-title",
    "h1",
    ".ad-title",
    ".listing-title",
    ".property-title",
    '[itemprop="name"]',
  ];
  const LOCATION_SELECTORS = [
    ".breadcrumb",
    ".breadcrumbs",
    ".bread-crumb",
    '[class*="breadcrumb" i]',
    '[itemprop="address"]',
    "address",
    ".product-location",
    '[class*="location" i]',
    '[class*="address" i]',
    '[class*="lokacija" i]',
  ];
  const SIMILAR_LISTINGS_SELECTOR =
    '[class*="similar" i], [class*="related" i], [class*="slicni" i], [class*="slični" i], [class*="other-ad" i], [class*="other-advert" i], [id*="similar" i], [id*="related" i]';
  const PROPERTY_CONTEXT_PATTERN =
    /\b(?:kvadratura|povr(?:š|s)ina|broj\s+soba|sobe|sprat|kat|grejanje|grijanje|uknji(?:ž|z)eno|tip\s+nekretnine|stambeni\s+prostor|bedrooms?|bathrooms?|property\s+details?|property\s+type|living\s+area|floor\s+area|heating|year\s+built)\b/giu;
  const REAL_ESTATE_OFFER_CONTEXT_PATTERN =
    /\b(?:real\s+estate|property|nekretnin[aeu]?|stan|ku[cć]a|apartman|stambeni|residential|bedrooms?|bathrooms?|living\s+area)\b/iu;
  const isHaloOglasiHost = () => /(^|\.)halooglasi\.com$/i.test(window.location.hostname);
  const BLOCKED_HOST_PATTERNS = [
    /(^|\.)gemini\.google\.com$/i,
    /(^|\.)chatgpt\.com$/i,
    /(^|\.)openai\.com$/i,
    /(^|\.)youtube\.com$/i,
    /(^|\.)youtu\.be$/i,
    /(^|\.)google\.[a-z.]+$/i,
    /(^|\.)bing\.com$/i,
    /(^|\.)duckduckgo\.com$/i,
  ];

  const normalizeText = (value) =>
    String(value ?? "")
      .replace(/\s+/g, " ")
      .trim();

  const toArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);

  const NON_CONTENT_SELECTOR = "script, style, iframe, noscript, template, svg, link[rel='stylesheet']";

  const removeCommentNodes = (root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
    const comments = [];

    while (walker.nextNode()) {
      comments.push(walker.currentNode);
    }

    comments.forEach((comment) => comment.remove());
  };

  const cloneWithoutNonContent = (element) => {
    if (!element || !(element instanceof Element)) {
      return null;
    }

    const clone = element.cloneNode(true);
    clone.querySelectorAll(NON_CONTENT_SELECTOR).forEach((node) => node.remove());
    removeCommentNodes(clone);
    return clone;
  };

  const looksLikeCodeNoise = (value) => {
    const text = normalizeText(value);

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

  const sanitizeExtractedText = (value) => {
    const text = normalizeText(value)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ");
    const cleaned = normalizeText(text);

    if (!cleaned || looksLikeCodeNoise(cleaned)) {
      return "";
    }

    return cleaned;
  };

  const getText = (element) => {
    const clone = cloneWithoutNonContent(element);

    if (!clone) {
      return "";
    }

    // Use textContent on the sanitized clone (detached nodes may yield empty innerText).
    return sanitizeExtractedText(clone.textContent ?? "");
  };

  const isVisible = (element) => {
    if (!element || !(element instanceof Element)) {
      return false;
    }

    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity) !== 0 &&
      rect.width > 0 &&
      rect.height > 0
    );
  };

  const getFirstText = (selectors, root = document) => {
    for (const selector of selectors) {
      const element = root.querySelector(selector);
      const text = getText(element);

      if (text) {
        return text;
      }
    }

    return "";
  };

  const cleanPhoneNumber = (value) => {
    const raw = normalizeText(value);
    if (!raw) {
      return "";
    }

    // Reject reveal-button labels and non-phone UI copy.
    if (
      /prikaži|prikazi|show\s*(phone|number|broj)|pogledaj|otkrij|reveal/i.test(raw) &&
      !/\d{6,}/.test(raw)
    ) {
      return "";
    }

    const decoded = raw.replace(/^tel:/i, "").replace(/\s+/g, " ").trim();
    const digits = decoded.replace(/[^\d+]/g, "");
    const digitCount = (digits.match(/\d/g) || []).length;

    if (digitCount < 6) {
      return "";
    }

    return decoded.replace(/[^\d+\s\-()/]/g, " ").replace(/\s+/g, " ").trim() || digits;
  };

  const extractTelHref = (element) => {
    if (!element || !(element instanceof Element)) {
      return "";
    }

    const href =
      element.getAttribute?.("href") ||
      element.closest?.("a[href^='tel:']")?.getAttribute("href") ||
      "";
    if (/^tel:/i.test(href)) {
      try {
        return cleanPhoneNumber(decodeURIComponent(href.replace(/^tel:/i, "")));
      } catch (_error) {
        return cleanPhoneNumber(href.replace(/^tel:/i, ""));
      }
    }

    const dataPhone =
      element.getAttribute?.("data-phone") ||
      element.getAttribute?.("data-telefon") ||
      element.getAttribute?.("data-number") ||
      element.dataset?.phone ||
      element.dataset?.telefon ||
      "";
    return cleanPhoneNumber(dataPhone);
  };

  const looksLikeRevealPhoneControl = (element) => {
    if (!element || !(element instanceof Element)) {
      return false;
    }

    const label = normalizeText(
      [
        element.getAttribute("aria-label"),
        element.getAttribute("title"),
        element.getAttribute("data-original-title"),
        getText(element),
      ]
        .filter(Boolean)
        .join(" "),
    );

    return /prikaži\s*(telefon|broj)|prikazi\s*(telefon|broj)|show\s*(phone|number)|otkrij\s*(telefon|broj)|pogledaj\s*(telefon|broj)|reveal\s*phone/i.test(
      label,
    );
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const revealHiddenPhoneNumbers = async (root = document) => {
    const scope = root instanceof Element || root === document ? root : document;
    const candidates = [
      ...scope.querySelectorAll(
        [
          "a[href^='tel:']",
          "button",
          "[role='button']",
          "[class*='phone' i]",
          "[class*='telefon' i]",
          "[class*='broj' i]",
          "[data-phone]",
          "[data-telefon]",
          "[onclick*='phone' i]",
          "[onclick*='telefon' i]",
        ].join(", "),
      ),
    ];

    let clicked = false;
    for (const element of candidates) {
      if (!looksLikeRevealPhoneControl(element)) {
        continue;
      }

      try {
        element.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true, view: window }),
        );
        if (typeof element.click === "function") {
          element.click();
        }
        clicked = true;
      } catch (_error) {
        // Keep scraping even if a portal blocks synthetic clicks.
      }
    }

    if (clicked) {
      await sleep(450);
    }
  };

  const extractEmailAddress = (root = document) => {
    const scope = root instanceof Element || root === document ? root : document;

    for (const anchor of scope.querySelectorAll("a[href^='mailto:']")) {
      const href = anchor.getAttribute("href") || "";
      try {
        const email = decodeURIComponent(href.replace(/^mailto:/i, ""))
          .split("?")[0]
          .trim();
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return email;
        }
      } catch (_error) {
        // ignore malformed mailto
      }
    }

    const labeled = extractSpecValueByLabels(scope, [
      /^e-?mail$/iu,
      /^kontakt\s*e-?mail$/iu,
      /^adresa\s*e-?mail$/iu,
    ]);
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(labeled)) {
      return labeled;
    }

    const haystack = getText(scope).slice(0, 2000);
    const match = haystack.match(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    );
    return match?.[0] ? normalizeText(match[0]) : "";
  };

  const deriveIsOwner = (advertiserType, haystack = "") => {
    const text = `${advertiserType} ${haystack}`.toLowerCase();
    if (/agencij|posrednik|broker|investitor|developer|prodavac\s*agenc/.test(text)) {
      return false;
    }
    if (
      /vlasnik|direktn|fizi[cč]ko\s*lice|privatni\s*(ogla|prod)|bez\s*proviz|od\s*vlasnika/.test(
        text,
      )
    ) {
      return true;
    }
    return false;
  };

  const extractPhoneFromRoot = (root = document) => {
    const scope = root instanceof Element || root === document ? root : document;
    const nodes = [
      ...scope.querySelectorAll(
        "a[href^='tel:'], [itemprop='telephone'], [class*='phone' i], [class*='telefon' i], [data-phone], [data-telefon]",
      ),
    ];

    for (const node of nodes) {
      const fromHref = extractTelHref(node);
      if (fromHref) {
        return fromHref;
      }

      const fromText = cleanPhoneNumber(getText(node));
      if (fromText) {
        return fromText;
      }
    }

    const labeled = cleanPhoneNumber(
      extractSpecValueByLabels(scope, [
        /^telefon$/iu,
        /^broj\s*telefona$/iu,
        /^kontakt\s*telefon$/iu,
        /^phone$/iu,
        /^mobile$/iu,
        /^mobilni$/iu,
      ]),
    );
    return labeled;
  };

  const getMetaContent = (...names) => {
    for (const name of names) {
      const escapedName = CSS.escape(name);
      const element = document.querySelector(
        `meta[name="${escapedName}"], meta[property="${escapedName}"]`,
      );
      const content = normalizeText(element?.getAttribute("content"));

      if (content) {
        return content;
      }
    }

    return "";
  };

  const readJsonLd = () => {
    const parsed = [];

    document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
      try {
        const value = JSON.parse(script.textContent || "null");
        parsed.push(value);
      } catch (_error) {
        // Malformed structured data should not block heuristic detection.
      }
    });

    return parsed;
  };

  const walkStructuredData = (value, nodes = []) => {
    if (!value || typeof value !== "object") {
      return nodes;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => walkStructuredData(item, nodes));
      return nodes;
    }

    nodes.push(value);

    if (Array.isArray(value["@graph"])) {
      walkStructuredData(value["@graph"], nodes);
    }

    for (const key of [
      "mainEntity",
      "about",
      "item",
      "itemOffered",
      "offers",
      "address",
      "hasPart",
    ]) {
      walkStructuredData(value[key], nodes);
    }

    return nodes;
  };

  const getTypes = (node) =>
    toArray(node?.["@type"])
      .map((type) => normalizeText(type).replace(/^https?:\/\/schema\.org\//i, ""))
      .filter(Boolean);

  const getNormalizedTypes = (node) => getTypes(node).map((type) => type.toLowerCase());

  const hasType = (node, expectedType) =>
    getNormalizedTypes(node).some((type) => type === expectedType.toLowerCase());

  const isPropertyNode = (node) =>
    getNormalizedTypes(node).some((type) => STRONG_PROPERTY_TYPES.has(type));

  const hasRealEstateAttributes = (node) =>
    Boolean(
      node &&
        typeof node === "object" &&
        (node.floorSize ||
          node.numberOfRooms ||
          node.numberOfBedrooms ||
          node.numberOfBathroomsTotal ||
          node.accommodationCategory ||
          node.address),
    );

  const isRealEstateOffer = (node) => {
    if (!hasType(node, "Offer")) {
      return false;
    }

    const offeredItems = toArray(node.itemOffered);
    const hasTypedProperty = offeredItems.some(isPropertyNode);
    const hasAttributedProperty = offeredItems.some(
      (item) =>
        hasRealEstateAttributes(item) &&
        REAL_ESTATE_OFFER_CONTEXT_PATTERN.test(
          normalizeText(`${item.name ?? ""} ${item.description ?? ""} ${item.category ?? ""}`),
        ),
    );
    const hasAttributedOffer =
      hasRealEstateAttributes(node) &&
      REAL_ESTATE_OFFER_CONTEXT_PATTERN.test(
        normalizeText(`${node.name ?? ""} ${node.description ?? ""} ${node.category ?? ""}`),
      );

    return hasTypedProperty || hasAttributedProperty || hasAttributedOffer;
  };

  const findOffer = (nodes) =>
    nodes.find((node) => hasType(node, "Offer")) ??
    nodes.find((node) => node && typeof node === "object" && ("price" in node || "priceCurrency" in node));

  const pickStructuredText = (...values) =>
    values.map(sanitizeExtractedText).find((value) => value.length > 0) ?? "";

  const parseNumber = (rawValue) => {
    const raw = normalizeText(rawValue).replace(/[^\d.,]/g, "");

    if (!raw) {
      return null;
    }

    const lastComma = raw.lastIndexOf(",");
    const lastDot = raw.lastIndexOf(".");
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const hasDecimal = Math.max(lastComma, lastDot) > -1 && raw.split(/[.,]/).pop().length <= 2;
    const normalized = raw
      .replace(/[.,]/g, (separator) => (hasDecimal && separator === decimalSeparator ? "." : ""));
    const number = Number(normalized);

    return Number.isFinite(number) ? number : null;
  };

  const normalizeCurrency = (value) => {
    const raw = normalizeText(value).toUpperCase();

    if (/€|EUR/.test(raw)) return "EUR";
    if (/\$|USD/.test(raw)) return "USD";
    if (/£|GBP/.test(raw)) return "GBP";
    if (/RSD/.test(raw)) return "RSD";

    return null;
  };

  const isRealisticPrice = (value) =>
    Number.isFinite(value) && value >= 100 && value <= 1_000_000_000;

  const extractPrice = (text, structuredOffer) => {
    const offerPrice = parseNumber(structuredOffer?.price ?? structuredOffer?.lowPrice);
    const offerCurrency = normalizeCurrency(structuredOffer?.priceCurrency);

    if (isRealisticPrice(offerPrice) && offerCurrency) {
      return {
        value: offerPrice,
        currency: offerCurrency,
        raw: normalizeText(
          `${structuredOffer.price ?? structuredOffer.lowPrice} ${structuredOffer.priceCurrency ?? ""}`,
        ),
      };
    }

    const pricePattern =
      /(?:€|\$|£|EUR|USD|GBP|RSD)\s*\d[\d\s.,]{2,}|\d[\d\s.,]{2,}\s*(?:€|\$|£|EUR|USD|GBP|RSD)/iu;
    const match = normalizeText(text).match(pricePattern);
    const raw = match?.[0] ?? "";
    const value = raw ? parseNumber(raw) : null;

    return {
      value: isRealisticPrice(value) ? value : null,
      currency: raw ? normalizeCurrency(raw) : null,
      raw: isRealisticPrice(value) ? raw : null,
    };
  };

  const getElementValue = (element) =>
    sanitizeExtractedText(
      [
        element?.getAttribute?.("content"),
        element?.getAttribute?.("value"),
        element?.getAttribute?.("data-price"),
        getText(element),
      ]
        .filter(Boolean)
        .join(" "),
    );

  const getDetailPriceText = (root = document) => {
    const values = [];
    const scope = root instanceof Element || root === document ? root : document;

    for (const selector of PRICE_SELECTORS) {
      scope.querySelectorAll(selector).forEach((element) => {
        if (values.length >= MAX_ELEMENTS) {
          return;
        }

        if (element.closest(SIMILAR_LISTINGS_SELECTOR)) {
          return;
        }

        const ownValue = getElementValue(element);
        const parentValue =
          element.hasAttribute("itemprop") && element.parentElement
            ? getElementValue(element.parentElement)
            : "";
        const value = normalizeText(`${ownValue} ${parentValue}`);

        // Prefer total listing prices over €/m² chips when collecting candidates.
        if (value && !/€\s*\/\s*m|\/\s*m²|\/\s*m2/iu.test(value)) {
          values.unshift(value);
        } else if (value) {
          values.push(value);
        }
      });
    }

    const metaPrice = [
      getMetaContent("product:price:amount", "og:price:amount"),
      getMetaContent("product:price:currency", "og:price:currency"),
    ]
      .filter(Boolean)
      .join(" ");

    return normalizeText(`${values.join(" | ")} ${metaPrice}`);
  };

  const getMainListingRoot = () => {
    const candidates = [
      ".product-main",
      ".product-page",
      ".product-details",
      ".ad-detail",
      ".offer-detail",
      ".listing-detail",
      "#plh1",
      "main",
      "article",
    ];

    for (const selector of candidates) {
      const element = document.querySelector(selector);

      if (element instanceof Element) {
        return element;
      }
    }

    return document.body;
  };

  const withoutSimilarListings = (element) => {
    const clone = cloneWithoutNonContent(element);

    if (!clone) {
      return null;
    }

    clone.querySelectorAll(SIMILAR_LISTINGS_SELECTOR).forEach((node) => node.remove());
    return clone;
  };

  const SPEC_ROW_SELECTOR =
    ".prominent li, .prominent .field-value, .product-characteristics li, .product-characteristics tr, table tr, dl dt, dl dd, [class*='attribute' i] li, [class*='spec' i] li, [class*='characteristic' i] li";

  const collectSpecRows = (root = document) => {
    const scope = root instanceof Element || root === document ? root : document;
    return Array.from(scope.querySelectorAll(SPEC_ROW_SELECTOR))
      .slice(0, MAX_ELEMENTS)
      .filter((row) => !row.closest?.(SIMILAR_LISTINGS_SELECTOR));
  };

  const splitSpecLabelValue = (text) => {
    const normalized = normalizeText(text);
    if (!normalized) {
      return { label: "", value: "" };
    }

    const colonMatch = normalized.match(/^(.{2,80}?)\s*[:：\-–—]\s*(.+)$/u);
    if (colonMatch) {
      return {
        label: normalizeText(colonMatch[1]),
        value: normalizeText(colonMatch[2]),
      };
    }

    return { label: normalized, value: "" };
  };

  const extractSpecValueByLabels = (root, labelPatterns) => {
    const rows = collectSpecRows(root);

    for (const row of rows) {
      const fullText = getText(row);
      if (!fullText) {
        continue;
      }

      const labelNode =
        row.querySelector?.(
          ".field-name, .name, .label, dt, th, [class*='label' i], [class*='name' i]",
        ) || null;
      const valueNode =
        row.querySelector?.(
          ".field-value, .value, dd, td:last-child, [class*='value' i]",
        ) || null;

      const labelText = normalizeText(
        labelNode ? getText(labelNode) : splitSpecLabelValue(fullText).label,
      );
      const valueText = normalizeText(
        valueNode ? getText(valueNode) : splitSpecLabelValue(fullText).value,
      );

      const matched = labelPatterns.some((pattern) => pattern.test(labelText));
      if (!matched) {
        // Also allow "Sprat 2" style rows without a clear separator.
        const inlineMatch = labelPatterns
          .map((pattern) => {
            const source = pattern.source.replace(/^\^|\$$/g, "");
            return fullText.match(new RegExp(`(?:^|\\b)${source}\\s*[:\\-–—]?\\s*(.+)`, "iu"));
          })
          .find((match) => match?.[1]);

        if (inlineMatch?.[1]) {
          const inlineValue = normalizeText(inlineMatch[1]).replace(/\s+/g, " ");
          if (inlineValue && inlineValue.length <= 80) {
            return inlineValue;
          }
        }
        continue;
      }

      if (valueText && valueText.length <= 120 && !labelPatterns.some((p) => p.test(valueText) && valueText === labelText)) {
        return valueText;
      }

      // Fallback: strip the label prefix from the full row text.
      for (const pattern of labelPatterns) {
        const stripped = fullText
          .replace(new RegExp(`^\\s*${pattern.source}\\s*[:\\-–—]?\\s*`, "iu"), "")
          .trim();
        if (stripped && stripped !== fullText && stripped.length <= 120) {
          return normalizeText(stripped);
        }
      }
    }

    return "";
  };

  const extractAttributeArea = (root = document) => {
    const rows = collectSpecRows(root);

    for (const row of rows) {
      const text = getText(row);

      if (!text) {
        continue;
      }

      if (/kvadratura|povr(?:š|s)ina|m²|m2/iu.test(text)) {
        const area = extractArea(text, null);

        if (area.sqm) {
          return area;
        }
      }
    }

    return {
      value: null,
      unit: null,
      sqm: null,
      raw: null,
    };
  };

  const extractListingSpecs = (root = document) => {
    const floor = extractSpecValueByLabels(root, [
      /^sprat(?:nost)?$/iu,
      /^kat$/iu,
      /^floor$/iu,
    ]);
    const heating = extractSpecValueByLabels(root, [
      /^grejanje$/iu,
      /^grijanje$/iu,
      /^heating$/iu,
    ]);
    const rooms = extractSpecValueByLabels(root, [
      /^broj\s+soba$/iu,
      /^sobe$/iu,
      /^rooms?$/iu,
      /^bedrooms?$/iu,
    ]);
    const propertyType = extractSpecValueByLabels(root, [
      /^tip\s+nekretnine$/iu,
      /^tip\s+objekta$/iu,
      /^property\s+type$/iu,
    ]);

    return {
      floor: floor || "",
      heating: heating || "",
      rooms: rooms || "",
      property_type: propertyType || "",
    };
  };

  const extractAdvertiserInfo = async (root = document) => {
    const scope = root instanceof Element || root === document ? root : document;
    const advertiserRoot =
      scope.querySelector(
        ".advertiser-info, .advertiser, .seller-info, .owner-info, .contact-info, [class*='advertiser' i], [class*='oglasivac' i], [class*='oglašivač' i], [class*='agency' i], [class*='agencij' i], [class*='kontakt' i], [class*='seller' i]",
      ) || scope;

    await revealHiddenPhoneNumbers(advertiserRoot);
    if (advertiserRoot !== scope) {
      await revealHiddenPhoneNumbers(scope);
    }

    const advertiserTypeRaw = extractSpecValueByLabels(advertiserRoot, [
      /^ogla(?:š|s)iva[cč]$/iu,
      /^tip\s+ogla(?:š|s)iva[cč]a$/iu,
      /^seller\s+type$/iu,
      /^advertiser$/iu,
      /^tip\s+prodavca$/iu,
    ]);

    let agencyName = pickStructuredText(
      getFirstText(
        [
          ".advertiser-name",
          ".agency-name",
          ".seller-name",
          "[class*='agency-name' i]",
          "[class*='advertiser-name' i]",
          "[class*='seller-name' i]",
        ],
        advertiserRoot,
      ),
      extractSpecValueByLabels(advertiserRoot, [
        /^agencija$/iu,
        /^naziv\s+agencije$/iu,
        /^agency$/iu,
        /^prodavac$/iu,
        /^ogla(?:š|s)iva[cč]$/iu,
      ]),
    );

    // Avoid grabbing the listing title via generic [itemprop=name] on the whole page.
    if (!agencyName && advertiserRoot !== scope) {
      agencyName = pickStructuredText(
        getFirstText(["[itemprop='name']"], advertiserRoot),
      );
    }

    const ownerName = pickStructuredText(
      getFirstText(
        [".owner-name", "[class*='owner-name' i]", "[class*='vlasnik' i]"],
        advertiserRoot,
      ),
      extractSpecValueByLabels(advertiserRoot, [
        /^vlasnik$/iu,
        /^ime\s+vlasnika$/iu,
        /^fizi[cč]ko\s+lice$/iu,
      ]),
    );

    const phone =
      extractPhoneFromRoot(advertiserRoot) ||
      extractPhoneFromRoot(scope) ||
      "";

    const contact_email =
      extractEmailAddress(advertiserRoot) || extractEmailAddress(scope) || "";

    const advertiserHaystack = [
      advertiserTypeRaw,
      agencyName,
      ownerName,
      getText(advertiserRoot).slice(0, 800),
    ]
      .filter(Boolean)
      .join(" ");

    let advertiser_type = normalizeText(advertiserTypeRaw);
    if (!advertiser_type) {
      if (/investitor/i.test(advertiserHaystack)) {
        advertiser_type = "Investitor";
      } else if (/agencij|posrednik|broker/i.test(advertiserHaystack)) {
        advertiser_type = "Agencija";
      } else if (/vlasnik|direktno|privatni|fizi[cč]ko/i.test(advertiserHaystack)) {
        advertiser_type = "Vlasnik";
      }
    }

    // HaloOglasi often shows "Agencija / Milenijum nekretnine" in one line.
    if (!agencyName && /agencij/i.test(advertiserHaystack)) {
      const slashMatch = advertiserHaystack.match(
        /agencij[ae]?\s*[\/|\-–—]\s*([A-Za-zÀ-ž0-9 .,&'-]{2,80})/iu,
      );
      if (slashMatch?.[1]) {
        agencyName = normalizeText(slashMatch[1]);
        advertiser_type = advertiser_type || "Agencija";
      }
    }

    // If DOM contact nodes exist, never invent placeholder copy — keep scraped values or "".
    const is_owner = deriveIsOwner(advertiser_type, advertiserHaystack);
    const phone_number = cleanPhoneNumber(phone);

    return {
      agency_name: agencyName || "",
      advertiser_type: advertiser_type || "",
      owner_name: ownerName || "",
      phone: phone_number || phone || "",
      phone_number: phone_number || phone || "",
      contact_email: contact_email || "",
      email: contact_email || "",
      is_owner,
    };
  };

  const extractBreadcrumbLocation = (root = document) => {
    const scope = root instanceof Element || root === document ? root : document;
    const breadcrumb = scope.querySelector(
      ".breadcrumb, .breadcrumbs, .bread-crumb, [class*='breadcrumb' i], nav[aria-label*='breadcrumb' i]",
    );

    if (!breadcrumb) {
      return "";
    }

    const parts = Array.from(breadcrumb.querySelectorAll("a, li, span"))
      .map((element) => getText(element))
      .map(normalizeText)
      .filter(Boolean)
      .filter(
        (part, index, all) =>
          part.length >= 2 &&
          all.indexOf(part) === index &&
          !/^(početna|home|nekretnine|prodaja|izdavanje)$/iu.test(part),
      );

    return parts.slice(-4).join(", ");
  };

  const extractListingIdFromUrl = (url) => {
    const href = normalizeText(url);

    if (!href) {
      return null;
    }

    try {
      const parsed = new URL(href);
      const pathMatch = parsed.pathname.match(/(\d{5,})\/?$/);
      if (pathMatch) {
        return pathMatch[1];
      }

      const queryId =
        parsed.searchParams.get("id") ||
        parsed.searchParams.get("adId") ||
        parsed.searchParams.get("oglasid");
      return queryId ? normalizeText(queryId) : null;
    } catch (_error) {
      return null;
    }
  };

  const extractHaloOglasiDomListing = async () => {
    if (!isHaloOglasiHost()) {
      return null;
    }

    const mainRootLive = getMainListingRoot() ?? document.body;
    const mainRoot = withoutSimilarListings(mainRootLive) ?? mainRootLive;
    const title = pickStructuredText(
      getFirstText([".page-title", "h1.page-title", "h1"], mainRoot),
      getFirstText(TITLE_SELECTORS),
      getMetaContent("og:title", "twitter:title"),
    );
    const priceCandidates = [
      getFirstText(
        [".offer-price-value", ".listing-price", ".price-ad-detail .offer-price-value"],
        mainRoot,
      ),
      getFirstText([".price-by-surface", ".listing-price", ".offer-price-value"], mainRoot),
      getDetailPriceText(mainRoot),
    ]
      .map(normalizeText)
      .filter(Boolean);
    const preferredPriceText =
      priceCandidates.find((text) => !/€\s*\/\s*m|\/\s*m²|\/\s*m2/iu.test(text)) ||
      priceCandidates[0] ||
      "";
    const price = extractPrice(
      preferredPriceText.includes("€") || /EUR|RSD|USD|GBP/i.test(preferredPriceText)
        ? preferredPriceText
        : `${preferredPriceText} €`,
      null,
    );
    const attributeArea = extractAttributeArea(mainRoot);
    const pageArea = extractArea(getText(mainRoot).slice(0, MAX_TEXT_LENGTH), null);
    const area = attributeArea.sqm ? attributeArea : pageArea;
    const location = pickStructuredText(
      extractBreadcrumbLocation(document),
      getFirstText(LOCATION_SELECTORS, mainRoot),
      getFirstText(LOCATION_SELECTORS),
    );
    const description = pickStructuredText(
      getFirstText(
        [
          '[itemprop="description"]',
          ".product-description",
          ".ad-description",
          '[class*="description" i]',
          '[class*="opis" i]',
        ],
        mainRoot,
      ),
      getMetaContent("description", "og:description", "twitter:description"),
    );
    const specs = {
      ...extractListingSpecs(document),
      ...Object.fromEntries(
        Object.entries(extractListingSpecs(mainRoot)).filter(([, value]) => Boolean(value)),
      ),
    };
    const advertiserFromMain = await extractAdvertiserInfo(mainRootLive);
    const advertiserFromPage = await extractAdvertiserInfo(document);
    const advertiser = {
      agency_name: advertiserFromMain.agency_name || advertiserFromPage.agency_name || "",
      advertiser_type:
        advertiserFromMain.advertiser_type || advertiserFromPage.advertiser_type || "",
      owner_name: advertiserFromMain.owner_name || advertiserFromPage.owner_name || "",
      phone: advertiserFromMain.phone || advertiserFromPage.phone || "",
      phone_number:
        advertiserFromMain.phone_number ||
        advertiserFromPage.phone_number ||
        advertiserFromMain.phone ||
        advertiserFromPage.phone ||
        "",
      contact_email:
        advertiserFromMain.contact_email || advertiserFromPage.contact_email || "",
      email: advertiserFromMain.email || advertiserFromPage.email || "",
      is_owner:
        typeof advertiserFromMain.is_owner === "boolean"
          ? advertiserFromMain.is_owner
          : Boolean(advertiserFromPage.is_owner),
    };

    return {
      title,
      description,
      location,
      price,
      area,
      floor: specs.floor || "",
      sprat: specs.floor || "",
      heating: specs.heating || "",
      grejanje: specs.heating || "",
      rooms: specs.rooms || "",
      property_type: specs.property_type || "",
      agency_name: advertiser.agency_name || "",
      advertiser_type: advertiser.advertiser_type || "",
      owner_name: advertiser.owner_name || "",
      phone: advertiser.phone || "",
      phone_number: advertiser.phone_number || advertiser.phone || "",
      contact_email: advertiser.contact_email || "",
      email: advertiser.email || advertiser.contact_email || "",
      is_owner: Boolean(advertiser.is_owner),
      listing_url: window.location.href,
      listing_id: extractListingIdFromUrl(window.location.href),
    };
  };

  const getAreaValue = (value) => {
    if (!value) {
      return null;
    }

    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "object") {
      return parseNumber(value.value ?? value.amount ?? value.name ?? "");
    }

    return parseNumber(value);
  };

  const extractArea = (text, propertyNode) => {
    const structuredArea = getAreaValue(
      propertyNode?.floorSize ?? propertyNode?.size ?? propertyNode?.area,
    );

    if (Number.isFinite(structuredArea) && structuredArea >= 5 && structuredArea <= 100_000) {
      return {
        value: structuredArea,
        unit: "sqm",
        sqm: structuredArea,
        raw: normalizeText(propertyNode.floorSize?.value ?? propertyNode.floorSize ?? structuredArea),
      };
    }

    const areaPattern =
      /\d+(?:[\s.,]\d+)?\s*(?:m²|m2|sqm|sq\.?\s?m|square\s(?:meters|metres)|sqft|sq\.?\s?ft|square\sfeet)/iu;
    const match = normalizeText(text).match(areaPattern);
    const raw = match?.[0] ?? "";
    const value = raw ? parseNumber(raw) : null;
    const isRealisticArea = Number.isFinite(value) && value >= 5 && value <= 1_000_000;
    const unit = /sqft|sq\.?\s?ft|square\sfeet/iu.test(raw)
      ? "sqft"
      : isRealisticArea
        ? "sqm"
        : null;

    return {
      value: isRealisticArea ? value : null,
      unit,
      sqm:
        isRealisticArea && unit === "sqft"
          ? Math.round(value * 0.092903 * 10) / 10
          : isRealisticArea
            ? value
            : null,
      raw: isRealisticArea ? raw : null,
    };
  };

  const extractAddress = (propertyNode) => {
    const address = propertyNode?.address;

    if (!address) {
      return "";
    }

    if (typeof address === "string") {
      return normalizeText(address);
    }

    return [
      address.streetAddress,
      address.addressLocality,
      address.addressRegion,
      address.postalCode,
      address.addressCountry,
    ]
      .map(normalizeText)
      .filter(Boolean)
      .join(", ");
  };

  const getPageText = () => {
    const scope = document.querySelector("main") ?? document.querySelector("article") ?? document.body;
    return getText(scope).slice(0, MAX_TEXT_LENGTH);
  };

  const getPropertyContextMatches = (text) =>
    Array.from(normalizeText(text).matchAll(PROPERTY_CONTEXT_PATTERN), (match) =>
      match[0].toLowerCase(),
    );

  const isBlockedGenericPage = () => {
    const hostname = window.location.hostname;
    const path = window.location.pathname;

    if (BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(hostname))) {
      return true;
    }

    return (
      /(^|\.)google\.[a-z.]+$/i.test(hostname) &&
      (/^\/search\b/i.test(path) || new URLSearchParams(window.location.search).has("q"))
    );
  };

  const countRepeatedListings = () => {
    const candidates = Array.from(
      document.querySelectorAll(
        'article, li, [class*="card" i], [class*="listing" i], [class*="property" i], [data-testid*="card" i]',
      ),
    )
      .filter(isVisible)
      .filter((element) => !element.closest(SIMILAR_LISTINGS_SELECTOR))
      .slice(0, MAX_ELEMENTS);

    return candidates.filter((element) => {
      const text = getText(element);
      const hasDistinctLink = Boolean(element.querySelector("a[href]"));
      const price = extractPrice(text, null);
      const area = extractArea(text, null);

      return hasDistinctLink && Boolean(price.value) && Boolean(area.value);
    }).length;
  };

  const detectSpecsContainer = () =>
    Boolean(
      document.querySelector(
        '.prominent, [class*="spec" i], [class*="detail" i], [class*="feature" i], [class*="attribute" i], dl, table',
      ),
    );

  const hasStrongJsonLdSignal = (structuredNodes, propertyNode) => {
    if (propertyNode) {
      return true;
    }

    return structuredNodes.some(isRealEstateOffer);
  };

  const mergeAdvertiserFields = (...sources) => {
    const merged = {
      agency_name: "",
      advertiser_type: "",
      owner_name: "",
      phone: "",
      phone_number: "",
      contact_email: "",
      email: "",
      is_owner: false,
    };

    for (const source of sources) {
      if (!source || typeof source !== "object") {
        continue;
      }

      merged.agency_name = merged.agency_name || source.agency_name || "";
      merged.advertiser_type = merged.advertiser_type || source.advertiser_type || "";
      merged.owner_name = merged.owner_name || source.owner_name || "";
      merged.phone = merged.phone || source.phone || source.phone_number || "";
      merged.phone_number =
        merged.phone_number || source.phone_number || source.phone || "";
      merged.contact_email =
        merged.contact_email || source.contact_email || source.email || "";
      merged.email = merged.email || source.email || source.contact_email || "";
    }

    if (!merged.phone_number && merged.phone) {
      merged.phone_number = merged.phone;
    }
    if (!merged.phone && merged.phone_number) {
      merged.phone = merged.phone_number;
    }
    if (!merged.email && merged.contact_email) {
      merged.email = merged.contact_email;
    }
    if (!merged.contact_email && merged.email) {
      merged.contact_email = merged.email;
    }

    merged.is_owner = deriveIsOwner(
      merged.advertiser_type,
      [merged.agency_name, merged.owner_name].filter(Boolean).join(" "),
    );

    return merged;
  };

  const buildResult = async () => {
    const pageUrl = window.location.href;
    const portalName = window.location.hostname;
    const jsonLd = readJsonLd();
    const structuredNodes = jsonLd.flatMap((item) => walkStructuredData(item));
    const propertyNode = structuredNodes.find(isPropertyNode) ?? null;
    const offerNode = findOffer(structuredNodes);
    const jsonLdTypes = Array.from(new Set(structuredNodes.flatMap(getTypes)));
    const pageText = getPageText();
    const haloListing = await extractHaloOglasiDomListing();
    const pageAdvertiser = await extractAdvertiserInfo(getMainListingRoot() ?? document);
    const advertiser = mergeAdvertiserFields(haloListing, pageAdvertiser);
    const attributeArea = extractAttributeArea(document);
    const title = pickStructuredText(
      haloListing?.title,
      propertyNode?.name,
      propertyNode?.headline,
      getFirstText(TITLE_SELECTORS),
      getMetaContent("og:title", "twitter:title"),
      document.title,
    );
    const descriptionBlock = getFirstText([
      '[itemprop="description"]',
      '[class*="description" i]',
      '[class*="opis" i]',
      '[class*="details" i] p',
      "article p",
      "main p",
    ]);
    const description = pickStructuredText(
      haloListing?.description,
      propertyNode?.description,
      descriptionBlock,
      getMetaContent("description", "og:description", "twitter:description"),
    );
    const location = pickStructuredText(
      haloListing?.location,
      extractAddress(propertyNode),
      extractBreadcrumbLocation(document),
      getFirstText(LOCATION_SELECTORS),
    );
    const detailPriceText = getDetailPriceText();
    const price =
      haloListing?.price?.value && haloListing?.price?.currency
        ? haloListing.price
        : extractPrice(detailPriceText, offerNode);
    const domArea = attributeArea.sqm
      ? attributeArea
      : extractArea(pageText, null);
    const structuredArea = extractArea("", propertyNode);
    const area =
      haloListing?.area?.sqm
        ? haloListing.area
        : structuredArea.sqm
          ? structuredArea
          : domArea;
    const propertyContextMatches = getPropertyContextMatches(pageText);
    const repeatedListingCount = countRepeatedListings();
    const propertyNodeCount = structuredNodes.filter(isPropertyNode).length;
    const hasItemList = structuredNodes.some(
      (node) =>
        hasType(node, "ItemList") ||
        hasType(node, "SearchResultsPage") ||
        (Array.isArray(node?.itemListElement) && node.itemListElement.length >= 3),
    );
    const isGenericBlockedPage = isBlockedGenericPage();
    const hasPropertySchema = Boolean(propertyNode);
    const hasOffer = Boolean(offerNode);
    const hasStrongJsonLd = hasStrongJsonLdSignal(structuredNodes, propertyNode);
    const hasDetailHeading = Boolean(getFirstText([".page-title", "h1"]));
    const hasTitle = title.length >= 4;
    const hasDescription =
      sanitizeExtractedText(propertyNode?.description).length >= 80 ||
      descriptionBlock.length >= 80 ||
      sanitizeExtractedText(haloListing?.description).length >= 80;
    const hasLocation = location.length >= 3;
    const hasPrice = Boolean(price.value && price.currency);
    const hasSurfaceArea = Boolean(area.sqm);
    const hasExplicitDomArea = Boolean(domArea.sqm || haloListing?.area?.sqm);
    const hasPropertyContext = propertyContextMatches.length > 0;
    const hasSpecsContainer = detectSpecsContainer();
    const hasHaloDetailSignal =
      Boolean(haloListing) &&
      hasTitle &&
      hasPrice &&
      hasExplicitDomArea &&
      /\/nekretnine\//i.test(window.location.pathname);
    const hasSingleListingDetailLayout =
      hasHaloDetailSignal ||
      (hasDetailHeading &&
        hasDescription &&
        hasSpecsContainer &&
        hasPrice &&
        hasExplicitDomArea &&
        hasPropertyContext);
    const isCollectionLike =
      !hasHaloDetailSignal &&
      (hasItemList ||
        propertyNodeCount >= 3 ||
        (repeatedListingCount >= 3 &&
          propertyNodeCount !== 1 &&
          !hasSingleListingDetailLayout));
    const essentialFields = {
      price: hasPrice,
      title: hasTitle,
      description: hasDescription,
      location: hasLocation,
      surface_area: hasSurfaceArea,
    };
    const completenessScore = Object.values(essentialFields).filter(Boolean).length * 20;
    const missingFields = Object.entries(essentialFields)
      .filter(([, hasField]) => !hasField)
      .map(([field]) => field);
    const jsonLdValid = hasStrongJsonLd && !isCollectionLike && !isGenericBlockedPage;
    const heuristicValid =
      !isCollectionLike &&
      !isGenericBlockedPage &&
      hasPrice &&
      hasExplicitDomArea &&
      (hasPropertyContext || hasHaloDetailSignal);
    const isValidListing = jsonLdValid || heuristicValid || hasHaloDetailSignal;
    const method =
      hasHaloDetailSignal && (jsonLdValid || heuristicValid)
        ? "hybrid"
        : hasHaloDetailSignal
          ? "dom_heuristic"
          : jsonLdValid && heuristicValid
            ? "hybrid"
            : jsonLdValid
              ? "json_ld"
              : heuristicValid
                ? "dom_heuristic"
                : "none";
    const confidenceScore = Math.min(
      100,
      Math.max(
        0,
        (hasStrongJsonLd ? 30 : 0) +
          (hasOffer ? 12 : 0) +
          (hasPrice ? 18 : 0) +
          (hasExplicitDomArea ? 18 : 0) +
          (hasPropertyContext || hasHaloDetailSignal ? 14 : 0) +
          (hasTitle ? 10 : 0) +
          (hasLocation ? 6 : 0) +
          (hasSpecsContainer ? 4 : 0) +
          (hasHaloDetailSignal ? 20 : 0) -
          (isCollectionLike ? 35 : 0) -
          (isGenericBlockedPage ? 100 : 0),
      ),
    );

    const detection = {
      method,
      confidence_score: Math.round(confidenceScore),
      json_ld_types: jsonLdTypes,
      signals: {
        has_property_schema: hasPropertySchema,
        has_strong_json_ld: hasStrongJsonLd,
        has_offer: hasOffer,
        has_price: hasPrice,
        has_title: hasTitle,
        has_description: hasDescription,
        has_location: hasLocation,
        has_surface_area: hasSurfaceArea,
        has_explicit_dom_area: hasExplicitDomArea,
        has_property_context: hasPropertyContext || hasHaloDetailSignal,
        property_context_matches: propertyContextMatches,
        has_specs_container: hasSpecsContainer,
        is_collection_like: isCollectionLike,
        property_node_count: propertyNodeCount,
        has_single_listing_detail_layout: hasSingleListingDetailLayout,
        is_generic_blocked_page: isGenericBlockedPage,
        repeated_listing_count: repeatedListingCount,
        is_halooglasi_detail: hasHaloDetailSignal,
      },
    };

    if (!isValidListing) {
      return {
        type: "NO_LISTINGS_FOUND",
        schema_version: 1,
        is_valid_listing: false,
        has_partial_data: false,
        completeness_score: completenessScore,
        missing_fields: missingFields,
        detection,
        listing: null,
        listings: [],
      };
    }

    return {
      type: "LISTING_FOUND",
      schema_version: 1,
      is_valid_listing: true,
      has_partial_data: completenessScore < 100,
      completeness_score: completenessScore,
      missing_fields: missingFields,
      detection,
      listing: {
        portal_name: portalName,
        listing_url: pageUrl,
        listing_id: haloListing?.listing_id ?? extractListingIdFromUrl(pageUrl),
        title: hasTitle ? title : null,
        description: description || null,
        location: location || null,
        price,
        surface_area: area,
        floor: haloListing?.floor || "",
        sprat: haloListing?.sprat || haloListing?.floor || "",
        heating: haloListing?.heating || "",
        grejanje: haloListing?.grejanje || haloListing?.heating || "",
        rooms: haloListing?.rooms || "",
        property_type: haloListing?.property_type || "",
        agency_name: advertiser.agency_name || "",
        advertiser_type: advertiser.advertiser_type || "",
        owner_name: advertiser.owner_name || "",
        phone: advertiser.phone || "",
        phone_number: advertiser.phone_number || advertiser.phone || "",
        contact_email: advertiser.contact_email || "",
        email: advertiser.email || advertiser.contact_email || "",
        is_owner: Boolean(advertiser.is_owner),
      },
    };
  };

  return buildResult();
})();
