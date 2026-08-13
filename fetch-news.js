const fs = require("fs");
const { XMLParser } = require("fast-xml-parser");


/*
 * Academicians and recognised name variants.
 *
 * Google News will run a separate search for each alias.
 * This helps capture:
 * - Greek and English spellings
 * - shortened first names
 * - initials
 * - alternative transliterations
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
  },

  {
    academicianEn: "Georgios Marios Karagiannis",
    academicianEl: "Γεώργιος Μάριος Καραγιάννης",

    names: [
      "Γεώργιος Μάριος Καραγιάννης",
      "Γιώργος Καραγιάννης",
      "Γ. Μ. Καραγιάννης",
      "Georgios Marios Karagiannis",
      "Georgios M. Karagiannis",
      "G. M. Karagiannis"
    ]
  }
];


/*
 * Domains that should not appear.
 */
const BLACKLISTED_DOMAINS = [
  "documentonews.gr",
  "avgi.gr"
];


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
 * Create the Google News RSS search.
 *
 * Each alias is searched separately.
 */
function buildGoogleNewsRssUrl(name) {
  const query =
    encodeURIComponent(`"${name}"`);

  return (
    "https://news.google.com/rss/search" +
    `?q=${query}` +
    "&hl=el" +
    "&gl=GR" +
    "&ceid=GR:el"
  );
}


/*
 * Download and parse an RSS feed.
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
 * Extract the publisher shown by Google News.
 *
 * Google News RSS commonly provides a <source>
 * element containing the original publisher.
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
 * Create a reasonably stable key for
 * duplicate detection.
 */
function createArticleKey(article) {
  return String(article.title || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}


async function main() {
  const results = [];

  for (const group of SEARCH_GROUPS) {

    for (const name of group.names) {

      const rssUrl =
        buildGoogleNewsRssUrl(name);

      console.log(
        `Searching Google News for: ${name}`
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

          /*
           * IMPORTANT:
           *
           * We deliberately DO NOT require
           * the academician's name to appear
           * in the headline.
           *
           * Google News has already returned
           * this article for the exact-name
           * search above.
           *
           * The previous titleContainsName()
           * test discarded articles where the
           * academician appeared in the story
           * but not in the headline.
           */

          if (
            isBlacklisted(publisher) ||
            isBlacklisted(googleDomain)
          ) {
            continue;
          }

          results.push({
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

            publisher:
              publisher,

            domain:
              googleDomain,

            approved:
              true
          });
        }

      } catch (error) {
        console.error(
          `Could not fetch news for ${name}:`,
          error.message
        );
      }
    }
  }


  /*
   * Remove duplicates.
   *
   * Searching multiple aliases will often
   * return the same article more than once.
   */
  const uniqueResults =
    Array.from(
      new Map(
        results.map(article => [
          createArticleKey(article),
          article
        ])
      ).values()
    );


  /*
   * Newest first.
   */
  const sortedResults =
    uniqueResults.sort(
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
    `Updated data/news.json with ${sortedResults.length} articles.`
  );
}


main();
