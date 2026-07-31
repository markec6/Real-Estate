(() => {
  const MOCK_LATENCY_MS = 1200;
  const MOCK_ERROR_MESSAGE = "Greška pri analizi oglasa. Pokušajte ponovo.";

  /** @typedef {import("../types/listing").AIListingAnalysis} AIListingAnalysis */

  /** @type {Record<string, AIListingAnalysis>} */
  const mockAnalysesByListingId = {
    "vracar-54": {
      financials: {
        price_per_sqm: 2222,
        location_average_price_per_sqm: 2085,
        price_difference_percentage: 6.6,
        market_status: "Precenjeno",
        seller_type: "Direktno od Vlasnika",
      },
      deal_score: {
        score: 8.5,
        verdict:
          "Dobra lokacija na Vračaru i direktan kontakt sa vlasnikom daju prostor za pregovor, ali pravni status mora biti prva provera.",
      },
      insights: {
        risks: [
          "Nije uknjiženo, pa kupovina verovatno zahteva gotovinu ili dodatnu pravnu proveru.",
          "Četvrti sprat bez lifta može smanjiti krug budućih kupaca i zakupaca.",
          "Cena po kvadratu je oko 6.6% iznad lokalnog proseka.",
        ],
        highlights: [
          "Renovirana stolarija i instalacije smanjuju inicijalne troškove useljenja.",
          "Vračar ima stabilnu potražnju za izdavanje i bržu likvidnost pri prodaji.",
          "Direktno od vlasnika može otvoriti prostor za pregovor bez agencijske provizije.",
        ],
      },
      dynamic_quick_prompts: [
        {
          label: "Provera uknjižbe",
          prompt_query:
            "Koje dokumente treba tražiti za ovaj stan na Vračaru ako oglas navodi da nije uknjižen?",
        },
        {
          label: "Pregovor cene",
          prompt_query:
            "Koliko bih realno mogao da spustim cenu za ovaj stan od 54m² na Vračaru s obzirom na sprat bez lifta?",
        },
        {
          label: "Trošak lifta",
          prompt_query:
            "Kako četvrti sprat bez lifta utiče na vrednost i izdavanje ovog konkretnog stana?",
        },
      ],
    },
    "novi-beograd-68": {
      financials: {
        price_per_sqm: 2191,
        location_average_price_per_sqm: 2435,
        price_difference_percentage: -10,
        market_status: "Povoljno",
        seller_type: "Agencija",
      },
      deal_score: {
        score: 7.8,
        verdict:
          "Cena ispod proseka za Blok 45 deluje atraktivno, posebno za porodično izdavanje, uz rezervu oko troška osveženja kupatila.",
      },
      insights: {
        risks: [
          "Potrebno osveženje kupatila može odložiti izdavanje ili useljenje.",
          "Agencijska prodaja verovatno uključuje dodatnu proviziju kupca.",
          "Veća kvadratura traži širi budžet za renoviranje ako se otkriju dodatni radovi.",
        ],
        highlights: [
          "Cena po kvadratu je oko 10% ispod procenjenog proseka za lokaciju.",
          "Blizina škole i javnog prevoza je jaka prednost za porodične zakupce.",
          "Uknjiženo i odmah useljivo smanjuje pravni i vremenski rizik transakcije.",
        ],
      },
      dynamic_quick_prompts: [
        {
          label: "Izdavanje porodicama",
          prompt_query:
            "Koliku mesečnu kiriju može da postigne trosoban stan od 68m² u Bloku 45?",
        },
        {
          label: "Budžet kupatila",
          prompt_query:
            "Koliko bi okvirno koštalo osveženje kupatila u ovom stanu na Novom Beogradu?",
        },
        {
          label: "Kupovina preko agencije",
          prompt_query:
            "Na šta da obratim pažnju kod kupovine ovog uknjiženog stana preko agencije?",
        },
      ],
    },
    "nis-42": {
      financials: {
        price_per_sqm: 1750,
        location_average_price_per_sqm: 1681,
        price_difference_percentage: 4.1,
        market_status: "Precenjeno",
        seller_type: "Direktno od Vlasnika",
      },
      deal_score: {
        score: 6.9,
        verdict:
          "Centar Niša daje dobar potencijal za kratkoročni najam, ali viša cena i parking ograničenja smanjuju marginu sigurnosti.",
      },
      insights: {
        risks: [
          "Ograničen parking u centru Niša može biti ozbiljan minus za svakodnevno stanovanje.",
          "Starija fasada bez najavljene obnove može uticati na održavanje i vizuelnu vrednost zgrade.",
          "Manja kvadratura ograničava ciljnu grupu kupaca na samce, parove ili investitore.",
        ],
        highlights: [
          "Centralna lokacija podržava kratkoročni najam i brže popunjavanje kapaciteta.",
          "Direktno od vlasnika može omogućiti fleksibilniji dogovor oko cene.",
          "Niža ukupna cena olakšava ulazak investitora sa manjim budžetom.",
        ],
      },
      dynamic_quick_prompts: [
        {
          label: "Izdavanje po danu",
          prompt_query:
            "Da li je ovaj jednoiposoban stan u centru Niša dobar kandidat za izdavanje po danu?",
        },
        {
          label: "Parking rizik",
          prompt_query:
            "Koliko nedostatak parkinga utiče na prodajnu cenu i zakup ovog stana u centru Niša?",
        },
        {
          label: "Pregovor sa vlasnikom",
          prompt_query:
            "Koje argumente da koristim za pregovor cene ovog stana od 42m² u centru Niša?",
        },
      ],
    },
  };

  /** @type {AIListingAnalysis} */
  const minimalAnalysis = {
    financials: {
      price_per_sqm: 0,
      location_average_price_per_sqm: 0,
      price_difference_percentage: 0,
      market_status: "Realna cena",
      seller_type: "Agencija",
    },
    deal_score: {
      score: 5,
      verdict:
        "Nema dovoljno detalja za preciznu procenu, pa ovu analizu treba tretirati kao početnu proveru oglasa.",
    },
    insights: {
      risks: ["Oglas ima ograničene podatke, pa su potrebna dodatna pitanja prodavcu."],
      highlights: ["Dovoljno podataka za osnovnu početnu procenu pre detaljne provere."],
    },
    dynamic_quick_prompts: [
      {
        label: "Dodatna pitanja",
        prompt_query:
          "Koja dodatna pitanja treba postaviti prodavcu kada oglas nema dovoljno tehničkih i pravnih detalja?",
      },
    ],
  };

  let shouldFailNextRequest = false;

  const delay = () =>
    new Promise((resolve) => {
      window.setTimeout(resolve, MOCK_LATENCY_MS);
    });

  /**
   * Simulates an external AI analysis API call with deterministic listing mocks.
   *
   * @param {string} listingId
   * @returns {Promise<AIListingAnalysis>}
   */
  const getMockAnalysisForListing = async (listingId) => {
    await delay();

    if (shouldFailNextRequest || listingId === "mock-error") {
      shouldFailNextRequest = false;
      throw new Error(MOCK_ERROR_MESSAGE);
    }

    return structuredClone(mockAnalysesByListingId[listingId] ?? minimalAnalysis);
  };

  window.mockAiService = {
    getMockAnalysisForListing,
    failNextRequest() {
      shouldFailNextRequest = true;
    },
    MOCK_ERROR_MESSAGE,
  };
})();
