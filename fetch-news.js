const fs = require("fs");
const { XMLParser } = require("fast-xml-parser");


/*
 * ============================================================
 * ACADEMICIANS INCLUDED IN THE AUTOMATED NEWS FEED
 * ============================================================
 *
 * Only:
 * - Costas Synolakis
 * - Georgios Marios Karagiannis
 *
 * Articles are accepted only when an approved version
 * of the name appears in the HEADLINE.
 *
 * We do NOT:
 * - search surnames alone
 * - inspect article body text
 * - accept generic "Γιώργος Καραγιάννης"
 * - accept generic "Karagiannis"
 */

const SEARCH_GROUPS = [
  {
    academicianEn: "Costas Synolakis",
    academicianEl: "Κώστας Συνολάκης",

    /*
     * Synolakis has a distinctive surname, so a broader
     * set of full-name / initial variants is acceptable.
     */
    searchNames: [
      "Κώστας Συνολάκης",
      "Κωνσταντίνος Συνολάκης",
      "Κ. Συνολάκης",
      "Costas Synolakis",
      "Konstantinos Synolakis",
      "Constantine Synolakis",
      "C. Synolakis",
      "K. Synolakis"
    ],

    headlineNames: [
      "Κώστας Συνολάκης",
      "Κωνσταντίνος Συνολάκης",
      "Κ. Συνολάκης",
      "Costas Synolakis",
      "Konstantinos Synolakis",
      "Constantine Synolakis",
      "C. Synolakis",
      "K. Synolakis"
    ]
  },

  {
    academicianEn: "Georgios Marios Karagiannis",
    academicianEl: "Γεώργιος Μάριος Καραγιάννης",

    /*
     * Karagiannis is deliberately much stricter.
     *
     * We search and accept only highly specific
     * versions of his full name.
     */
    searchNames: [
      "Γεώργιος Μάριος Καραγιάννης",
      "Γιώργος Μάριος Καραγιάννης",
      "Georgios Marios Karagiannis"
    ],

    headlineNames: [
      "Γεώργιος Μάριος Καραγιάννης",
      "Γιώργος Μάριος Καραγιάννης",
      "Georgios Marios Karagiannis"
    ]
  }
];


/*
 * ============================================================
 * BLACKLIST
 * ============================================================
 */

const BLACKLISTED_DOMAINS = [
  "documentonews.gr",
  "1voice.gr",
  "avgi.gr"
];


const BLACKLISTED_PUBLISHER_NAMES = [
  "documentonews",
  "documento",
  "1voice",
  "1 voice",
  "avgi",
  "η αυγή"
];


/*
 * ============================================================
 * TEXT NORMALISATION
 * ============================================================
 */

function normaliseText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("el-GR")
    .replace(/[“”"'’‘«»]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}


/*
 * ============================================================
 * DOMAIN NORMALISATION
 * ============================================================
 */

function normaliseDomain(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
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


/*
 * ============================================================
 * GOOGLE NEWS PUBLISHER INFORMATION
 * ============================================================
 */

function getPublisher(item) {
  if (!item?.source) {
    return "";
  }

  if (typeof item.source === "string") {
    return item.source;
  }

  return (
    item.source["#text"] ||
    item.source.name ||
    ""
  );
}


function getPublisherUrl(item) {
  if (!item?.source) {
    return "";
  }

  if (typeof item.source === "string") {
    return "";
  }

  return (
    item.source["@_url"] ||
    item.source.url ||
    ""
  );
}


function getPublisherDomain(item) {
  return getDomain(
    getPublisherUrl(item)
  );
}


/*
 * ============================================================
 * BLACKLIST CHECK
 * ============================================================
 */

function isBlacklistedDomain(domain) {
  const cleanDomain =
    normaliseDomain(domain);

  if (!cleanDomain) {
    return false;
  }

  return BLACKLISTED_DOMAINS.some(
    blockedDomain => {
      const blocked =
        normaliseDomain(blockedDomain);

      return (
        cleanDomain === blocked ||
        cleanDomain.endsWith(
          `.${blocked}`
        )
      );
    }
  );
}


function isBlacklistedPublisher(publisher) {
  const cleanPublisher =
    normaliseText(publisher);

  if (!cleanPublisher) {
    return false;
  }

  return BLACKLISTED_PUBLISHER_NAMES.some(
    blockedName =>
      cleanPublisher.includes(
        normaliseText(blockedName)
      )
  );
}


function articleIsBlacklisted(item) {
  const publisher =
    getPublisher(item);

  const publisherDomain =
    getPublisherDomain(item);

  return (
    isBlacklistedDomain(
      publisherDomain
    ) ||
    isBlacklistedPublisher(
      publisher
    )
  );
}


/*
 * ============================================================
 * HEADLINE RELEVANCE
 * ============================================================
 *
 * This is the main relevance safeguard.
 *
 * Google can return broad results.
 * The website accepts narrowly.
 */

function titleContainsAcademician(
  title,
  headlineNames
) {
  const cleanTitle =
    normaliseText(title);

  return headlineNames.some(name =>
    cleanTitle.includes(
      normaliseText(name)
    )
  );
}


/*
 * ============================================================
 * GOOGLE NEWS RSS SEARCH
 * ============================================================
 */

function buildGoogleNewsRssUrl(name) {
  const query =
    encodeURIComponent(
      `"${name}"`
    );

  return (
    "https://news.google.com/rss/search" +
    `?q=${query}` +
    "&hl=el" +
    "&gl=GR" +
    "&ceid=GR:el"
  );
}


/*
 * ============================================================
 * FETCH RSS
 * ============================================================
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
 * ============================================================
 * TITLE DEDUPLICATION
 * ============================================================
 */

function escapeRegExp(value) {
  return String(value || "")
    .replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );
}


function stripPublisherFromTitle(
  title,
  publisher
) {
  let result =
    String(title || "").trim();

  if (!publisher) {
    return result;
  }

  const escapedPublisher =
    escapeRegExp(
      String(publisher).trim()
    );

  const pattern =
    new RegExp(
      `\\s[-–—]\\s*${escapedPublisher}\\s*$`,
      "i"
    );

  return result
    .replace(pattern, "")
    .trim();
}


function stripGenericPublisherSuffix(title) {
  const value =
    String(title || "").trim();

  const parts =
    value.split(/\s[-–—]\s/);

  if (parts.length < 2) {
    return value;
  }

  const possiblePublisher =
    parts[
      parts.length - 1
    ].trim();

  /*
   * A short final fragment is likely
   * to be the publisher name.
   */
  if (possiblePublisher.length > 45) {
    return value;
  }

  return parts
    .slice(0, -1)
    .join(" - ")
    .trim();
}


function createArticleKey(article) {
  let title =
    stripPublisherFromTitle(
      article.title,
      article.publisher
    );

  title =
    stripGenericPublisherSuffix(
      title
    );

  return normaliseText(title)
    .replace(
      /[^\p{L}\p{N}\s]/gu,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}


function addUniqueArticle(
  results,
  article
) {
  const newKey =
    createArticleKey(article);

  if (!newKey) {
    return;
  }

  const duplicate =
    results.some(existing =>
      createArticleKey(existing) ===
      newKey
    );

  if (duplicate) {
    console.log(
      `Duplicate rejected: ${article.title}`
    );

    return;
  }

  results.push(article);
}


/*
 * ============================================================
 * PROCESS ONE NAME SEARCH
 * ============================================================
 */

async function processNameSearch({
  name,
  group,
  results
}) {

  const rssUrl =
    buildGoogleNewsRssUrl(name);

  console.log(
    `Searching Google News for: "${name}"`
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
        String(
          item?.title || ""
        ).trim();

      const link =
        String(
          item?.link || ""
        ).trim();


      if (!title || !link) {
        continue;
      }


      /*
       * --------------------------------------------------------
       * 1. STRICT HEADLINE CHECK
       * --------------------------------------------------------
       */

      if (
        !titleContainsAcademician(
          title,
          group.headlineNames
        )
      ) {

        console.log(
          `Rejected - approved name not in headline: ${title}`
        );

        continue;
      }


      /*
       * --------------------------------------------------------
       * 2. BLACKLIST CHECK
       * --------------------------------------------------------
       */

      if (
        articleIsBlacklisted(item)
      ) {

        console.log(
          `Rejected - blacklisted publisher: ${title}`
        );

        continue;
      }


      /*
       * --------------------------------------------------------
       * 3. DATE
       * --------------------------------------------------------
       */

      let pubDate =
        item.pubDate
          ? new Date(item.pubDate)
          : new Date();

      if (
        Number.isNaN(
          pubDate.getTime()
        )
      ) {
        pubDate =
          new Date();
      }


      /*
       * --------------------------------------------------------
       * 4. PUBLISHER
       * --------------------------------------------------------
       */

      const publisher =
        getPublisher(item);

      const publisherDomain =
        getPublisherDomain(item);


      /*
       * --------------------------------------------------------
       * 5. ARTICLE
       * --------------------------------------------------------
       *
       * IMPORTANT:
       *
       * Always keep the Google News RSS article link.
       *
       * We do not use the publisher's <source> URL as the
       * article URL because Google frequently provides a
       * homepage/category/archive URL there.
       */

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
          publisherDomain ||
          "news.google.com",

        approved:
          true
      };


      /*
       * --------------------------------------------------------
       * 6. DEDUPLICATION
       * --------------------------------------------------------
       */

      addUniqueArticle(
        results,
        article
      );
    }

  } catch (error) {

    console.error(
      `Could not fetch news for "${name}":`,
      error.message
    );

  }
}


/*
 * ============================================================
 * MAIN
 * ============================================================
 */

async function main() {

  const results = [];


  /*
   * Search only recognised names.
   *
   * NO surname-only searches.
   * NO article-body searches.
   */

  for (
    const group of SEARCH_GROUPS
  ) {

    for (
      const name of group.searchNames
    ) {

      await processNameSearch({
        name,
        group,
        results
      });

    }

  }


  /*
   * Final deduplication.
   */

  const uniqueResults = [];

  for (
    const article of results
  ) {

    addUniqueArticle(
      uniqueResults,
      article
    );

  }


  /*
   * Newest first.
   */

  uniqueResults.sort(
    (a, b) =>
      new Date(b.date) -
      new Date(a.date)
  );


  /*
   * Rewrite news.json.
   */

  fs.writeFileSync(
    "data/news.json",

    JSON.stringify(
      uniqueResults,
      null,
      2
    ),

    "utf8"
  );


  console.log(
    `Updated data/news.json with ${uniqueResults.length} unique approved articles.`
  );

}


main().catch(error => {

  console.error(
    "News update failed:",
    error
  );

  process.exitCode = 1;

});