const BLACKLISTED_DOMAINS = [
  "documentonews.gr",
  "1voice.gr",
  "avgi.gr"
];


const ALLOWED_ACADEMICIANS = [
  "Costas Synolakis",
  "Georgios Marios Karagiannis"
];


let cachedNewsArticles = [];


function normaliseDomain(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}


function isBlacklistedDomain(domain) {
  const cleanDomain =
    normaliseDomain(domain);

  return BLACKLISTED_DOMAINS.some(
    blocked =>
      cleanDomain ===
      normaliseDomain(blocked)
  );
}


function getNewsLanguage() {
  return (
    document.documentElement.lang === "el"
      ? "el"
      : "en"
  );
}


function getAcademicianEnglishName(article) {
  /*
   * New JSON structure.
   */
  if (article.academicianEn) {
    return article.academicianEn;
  }


  /*
   * Legacy structure fallback.
   */
  const oldValue =
    String(
      article.professorEn ||
      article.academician ||
      article.professor ||
      ""
    );


  if (
    oldValue.includes(
      "Costas Synolakis"
    ) ||
    oldValue.includes(
      "Κώστας Συνολάκης"
    )
  ) {
    return "Costas Synolakis";
  }


  if (
    oldValue.includes(
      "Georgios Marios Karagiannis"
    ) ||
    oldValue.includes(
      "Γεώργιος Μάριος Καραγιάννης"
    )
  ) {
    return "Georgios Marios Karagiannis";
  }


  return "";
}


function isAllowedAcademician(article) {
  const academician =
    getAcademicianEnglishName(
      article
    );

  return ALLOWED_ACADEMICIANS.includes(
    academician
  );
}


function getAcademicianName(article) {
  const language =
    getNewsLanguage();


  if (language === "el") {
    return (
      article.academicianEl ||
      article.professorEl ||
      (
        getAcademicianEnglishName(article) ===
        "Costas Synolakis"
          ? "Κώστας Συνολάκης"
          : getAcademicianEnglishName(article) ===
            "Georgios Marios Karagiannis"
            ? "Γεώργιος Μάριος Καραγιάννης"
            : ""
      )
    );
  }


  return (
    article.academicianEn ||
    article.professorEn ||
    getAcademicianEnglishName(
      article
    ) ||
    ""
  );
}


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function renderNews() {
  const newsContainer =
    document.querySelector(
      "[data-news-feed]"
    );


  if (!newsContainer) {
    return;
  }


  let approvedArticles =
    cachedNewsArticles
      .filter(
        article =>
          article.approved === true
      )
      .filter(
        article =>
          !isBlacklistedDomain(
            article.domain
          )
      )
      .filter(
        isAllowedAcademician
      );


  const limit =
    newsContainer.dataset.newsLimit;


  if (limit !== "all") {
    approvedArticles =
      approvedArticles.slice(
        0,
        Number(limit || 4)
      );
  }


  if (
    approvedArticles.length === 0
  ) {

    newsContainer.innerHTML = `
      <p class="empty-state">
        ${
          getNewsLanguage() === "el"
            ? "Δεν υπάρχουν διαθέσιμα νέα αυτή τη στιγμή."
            : "No news is available at the moment."
        }
      </p>
    `;

    return;
  }


  newsContainer.innerHTML =
    approvedArticles
      .map(article => {

        const title =
          escapeHtml(
            article.title || ""
          );

        const category =
          escapeHtml(
            article.category ||
            "In the Media"
          );

        const date =
          escapeHtml(
            article.date || ""
          );

        const academician =
          escapeHtml(
            getAcademicianName(
              article
            )
          );

        const url =
          escapeHtml(
            article.url || "#"
          );


        return `
          <article class="news-feed-card">

            <p class="news-meta">
              ${category} · ${date}
            </p>

            <h3>
              ${title}
            </h3>

            <p class="news-academician">
              <strong>
                ${
                  getNewsLanguage() === "el"
                    ? "Επιστήμονας:"
                    : "Scientist:"
                }
              </strong>

              ${academician}
            </p>

            <a
              href="${url}"
              target="_blank"
              rel="noopener noreferrer"
            >
              ${
                getNewsLanguage() === "el"
                  ? "Διαβάστε ολόκληρο το άρθρο"
                  : "Read full article"
              }
            </a>

          </article>
        `;
      })
      .join("");
}


async function loadNews() {
  const newsContainer =
    document.querySelector(
      "[data-news-feed]"
    );


  if (!newsContainer) {
    return;
  }


  try {
    const [
  autoResponse,
  manualResponse
] = await Promise.all([
  fetch(
    "data/news.json",
    {
      cache: "no-store"
    }
  ),

  fetch(
    "data/manual-news.json",
    {
      cache: "no-store"
    }
  )
]);


if (!autoResponse.ok) {
  throw new Error(
    "Automatic news file could not be loaded"
  );
}


/*
 * manual-news.json is allowed to be empty,
 * but the file itself must exist.
 */
if (!manualResponse.ok) {
  throw new Error(
    "Manual news file could not be loaded"
  );
}


const autoArticles =
  await autoResponse.json();

const manualArticles =
  await manualResponse.json();


if (
  !Array.isArray(autoArticles) ||
  !Array.isArray(manualArticles)
) {
  throw new Error(
    "News data is invalid"
  );
}


/*
 * Merge automatic + manual news.
 */
cachedNewsArticles = [
  ...autoArticles,
  ...manualArticles
];


/*
 * Sort newest first.
 */
cachedNewsArticles.sort(
  (a, b) =>
    new Date(b.date) -
    new Date(a.date)
);
    
    renderNews();


  } catch (error) {

    console.error(
      "Unable to load news:",
      error
    );


    newsContainer.innerHTML = `
      <p class="empty-state">
        ${
          getNewsLanguage() === "el"
            ? "Δεν ήταν δυνατή η φόρτωση των ειδήσεων."
            : "News could not be loaded at the moment."
        }
      </p>
    `;

  }
}


/*
 * Re-render dynamically generated cards
 * whenever script.js changes the language.
 */
document.addEventListener(
  "languageChanged",
  () => {
    renderNews();
  }
);


loadNews();