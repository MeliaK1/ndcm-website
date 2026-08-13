const fs = require("fs");
const { XMLParser } = require("fast-xml-parser");


/*
 * Academicians and recognised name variants.
 */
const SEARCH_GROUPS = [
  {
    academicianEn: "Stamatios M. Krimigis",
    academicianEl: "Σταμάτιος Μ. Κριμιζής",

    names: [
      "Σταμάτης Κριμιζής",
      "Σταμάτιος Κριμιζής",
      "Σ. Κριμιζής",
      "Stamatis Krimizis",
      "Stamatios Krimigis",
      "Stamatios M. Krimigis",
      "S. Krimigis"
    ],

    surnameGreek: "Κριμιζής",
    surnameEnglish: "Krimigis"
  },

  {
    academicianEn: "Costas Synolakis",
    academicianEl: "Κώστας Συνολάκης",

    names: [
      "Κώστας Συνολάκης",
      "Κωνσταντίνος Συνολάκης",
      "Κ. Συνολάκης",
      "Κ Συνολάκης",
      "Costas Synolakis",
      "Konstantinos Synolakis",
      "Constantine Synolakis",
      "C. Synolakis",
      "K. Synolakis"
    ],

    surnameGreek: "Συνολάκης",
    surnameEnglish: "Synolakis"
  },

  {
    academicianEn: "Christos S. Zerefos",
    academicianEl: "Χρήστος Σ. Ζερεφός",

    names: [
      "Χρήστος Ζερεφός",
      "Χρήστος Σ. Ζερεφός",
      "Χ. Ζερεφός",
      "Christos Zerefos",
      "Christos S. Zerefos",
      "C. Zerefos"
    ],

    surnameGreek: "Ζερεφός",
    surnameEnglish: "Zerefos"
  },

  {
    academicianEn: "Athanasios Fokas",
    academicianEl: "Αθανάσιος Φωκάς",

    names: [
      "Αθανάσιος Φωκάς",
      "Θανάσης Φωκάς",
      "Α. Φωκάς",
      "Athanasios Fokas",
      "Athanassios Fokas",
      "Athanassios S. Fokas",
      "A. Fokas"
    ],

    surnameGreek: "Φωκάς",
    surnameEnglish: "Fokas"
  },

  {
    academicianEn: "Andreas Karamanos",
    academicianEl: "Ανδρέας Καραμάνος",

    names: [
      "Ανδρέας Καραμάνος",
      "Ανδρέας Ι. Καραμάνος",
      "Α. Καραμάνος",
      "Andreas Karamanos",
      "Andreas I. Karamanos",
      "A. Karamanos"
    ],

    surnameGreek: "Καραμάνος",
    surnameEnglish: "Karamanos"
  },

  {
    academicianEn: "Emmanouil Floratos",
    academicianEl: "Εμμανουήλ Φλωράτος",

    names: [
      "Εμμανουήλ Φλωράτος",
      "Μανώλης Φλωράτος",
      "Ε. Φλωράτος",
      "Emmanouil Floratos",
      "Emmanuel Floratos",
      "E. Floratos"
    ],

    surnameGreek: "Φλωράτος",
    surnameEnglish: "Floratos"
  },

  {
    academicianEn: "Georgios Marios Karagiannis",
    academicianEl: "Γεώργιος Μάριος Καραγιάννης",

    names: [
      "Γεώργιος Μάριος Καραγιάννης",
      "Georgios Marios Karagiannis",
    ],

    surnameGreek: "Καραγιάννης",
    surnameEnglish: "Karagiannis"
  }
];


/*
 * Priority media outlets.
 *
 * We run extra surname-based searches
 * specifically against these publishers.
 */
const PRIORITY_SITES = [
  "protothema.gr",
  "naftemporiki.gr",
  "kathimerini.gr"
];


/*
 * Domains excluded from the site.
 */
const BLACKLISTED_DOMAINS = [
  "documentonews.gr",
  "avgi.gr"
];


/*
 * Normalise text for comparison.
 */
function normaliseText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("el-GR")
    .replace(/[“”"'’‘«»]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}


/*
 * Normalise domains.
 */
function normaliseDomain(domain) {
  return String(domain || "")
    .toLowerCase()
    .replace(/^www\./, "")
    .trim();
}


function getDomain(url) {
  try {
    return normaliseDomain(
      new URL(url).hostname
    );
  } catch {
    return "";
  }
}


function isBlacklisted(domain) {
  const cleanDomain =
    normaliseDomain(domain);

  return BLACKLISTED_DOMAINS.some(
    blocked =>
      normaliseDomain(blocked) === cleanDomain
  );
}


/*
 * Standard exact-name Google News search.
 */
function buildGoogleNewsRssUrl(queryText) {
  const query =
    encodeURIComponent(queryText);

  return (
    "https://news.google.com/rss/search" +
    `?q=${query}` +
    "&hl=el" +
    "&gl=GR" +
    "&ceid=GR:el"
  );
}


/*
 * Fetch and parse RSS.
 */
async function fetchRss(url) {
  const response =
    await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch RSS: ${response.status}`
    );
  }

  const xml =
    await response.text();

  const parser =
    new XMLParser({
      ignoreAttributes: false
    });

  return parser.parse(xml);
}


/*
 * Extract original publisher name.
 */
function getPublisher(item) {
  if (!item?.source) {
    return "";
  }

  if (
    typeof item.source === "string"
  ) {
    return item.source;
  }

  return (
    item.source["#text"] ||
    item.source.name ||
    ""
  );
}


/*
 * Remove publisher suffixes from titles.
 *
 * Example:
 *
 * "Title here - ProtoThema"
 * "Title here - Kathimerini"
 *
 * become:
 *
 * "Title here"
 */
function stripPublisherFromTitle(title) {
  return String(title || "")
    .replace(
      /\s[-–—]\s(?:protothema|πρωτο θεμα|naftemporiki|η ναυτεμπορικη|ναυτεμπορικη|kathimerini|καθημερινη|ertnews|cnn\.gr|skai\.gr|ant1 tv).*$/i,
      ""
    )
    .trim();
}


/*
 * Create a title key used for deduplication.
 */
function createArticleKey(article) {
  const cleanTitle =
    stripPublisherFromTitle(
      article.title
    );

  return normaliseText(cleanTitle);
}


/*
 * Check whether two titles are effectively
 * the same after normalisation.
 */
function titlesAreEquivalent(
  titleA,
  titleB
) {
  return (
    createArticleKey({
      title: titleA
    }) ===
    createArticleKey({
      title: titleB
    })
  );
}


/*
 * Add article only if an equivalent title
 * does not already exist.
 */
function addUniqueArticle(
  results,
  article
) {
  const duplicate =
    results.some(existing =>
      titlesAreEquivalent(
        existing.title,
        article.title
      )
    );

  if (!duplicate) {
    results.push(article);
  }
}


/*
 * Process one RSS query.
 */
async function processQuery({
  query,
  group,
  results
}) {

  const rssUrl =
    buildGoogleNewsRssUrl(query);

  console.log(
    `Searching Google News for: ${query}`
  );

  try {

    const feed =
      await fetchRss(rssUrl);

    const items =
      feed?.rss?.channel?.item || [];

    const itemList =
      Array.isArray(items)
        ? items
        : [items];

    for (const item of itemList) {

      const title =
        item.title || "";

      const link =
        item.link || "";

      if (!title || !link) {
        continue;
      }

      const pubDate =
        item.pubDate
          ? new Date(item.pubDate)
          : new Date();

      const googleDomain =
        getDomain(link);

      const publisher =
        getPublisher(item);

      if (
        isBlacklisted(publisher) ||
        isBlacklisted(googleDomain)
      ) {
        continue;
      }

      const article = {
        title,

        date:
          pubDate
            .toISOString()
            .slice(0, 10),

        category:
          "In the Media",

        academicianEn:
          group.academicianEn,

        academicianEl:
          group.academicianEl,

        url:
          link,

        publisher,

        domain:
          googleDomain,

        approved:
          true
      };

      addUniqueArticle(
        results,
        article
      );
    }

  } catch (error) {

    console.error(
      `Could not fetch news for ${query}:`,
      error.message
    );

  }
}


async function main() {

  const results = [];


  for (
    const group
    of SEARCH_GROUPS
  ) {

    /*
     * 1. Search every known name variant.
     */
    for (
      const name
      of group.names
    ) {

      await processQuery({
        query: `"${name}"`,
        group,
        results
      });

    }


    /*
     * 2. Run additional surname-only
     * searches on priority publishers.
     *
     * This is what should help us capture
     * articles where the name appears in
     * the description/body but not headline.
     */
    for (
      const site
      of PRIORITY_SITES
    ) {

      await processQuery({
        query:
          `${group.surnameGreek} site:${site}`,
        group,
        results
      });

      await processQuery({
        query:
          `${group.surnameEnglish} site:${site}`,
        group,
        results
      });

    }

  }


  /*
   * Final safety deduplication.
   */
  const deduplicatedResults = [];

  for (
    const article
    of results
  ) {

    addUniqueArticle(
      deduplicatedResults,
      article
    );

  }


  /*
   * Newest first.
   */
  const sortedResults =
    deduplicatedResults.sort(
      (a, b) =>
        new Date(b.date) -
        new Date(a.date)
    );


  fs.writeFileSync(
    "data/news.json",
    JSON.stringify(
      sortedResults,
      null,
      2
    ),
    "utf8"
  );


  console.log(
    `Updated data/news.json with ${sortedResults.length} unique articles.`
  );

}


main();
