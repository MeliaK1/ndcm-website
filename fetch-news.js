const fs = require("fs");
const { XMLParser } = require("fast-xml-parser");


/*
 * ============================================================
 * ACADEMICIANS INCLUDED IN AUTOMATED NEWS SEARCH
 * ============================================================
 *
 * IMPORTANT:
 * Fokas, Karamanos, Floratos and Karagiannis have deliberately
 * been removed because their names generate too many unrelated
 * results.
 *
 * Articles are accepted ONLY when a recognised version of the
 * academician's name appears in the headline.
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
  const publisherUrl =
    getPublisherUrl(item);

  if (!publisherUrl) {
    return "";
  }

  return getDomain(publisherUrl);
}


/*
 * ============================================================
 * BLACKLIST CHECKS
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


function articleIsBlacklisted(
  item,
  link
) {
  const linkDomain =
    getDomain(link);

  const publisherDomain =
    getPublisherDomain(item);

  const publisher =
    getPublisher(item);

  return (
    isBlacklistedDomain(linkDomain) ||
    isBlacklistedDomain(publisherDomain) ||
    isBlacklistedPublisher(publisher)
  );
}


/*
 * ============================================================
 * HEADLINE RELEVANCE
 * ============================================================
 *
 * The academician MUST appear in the headline.
 *
 * We do NOT:
 * - search surnames alone
 * - inspect article body text
 * - accept results just because Google returned them
 */

function titleContainsAcademician(
  title,
  names
) {
  const cleanTitle =
    normaliseText(title);

  return names.some(name => {
    const cleanName =
      normaliseText(name);

    return cleanTitle.includes(
      cleanName
    );
  });
}


/*
 * ============================================================
 * URL QUALITY VALIDATION
 * ============================================================
 *
 * Reject URLs that clearly represent:
 * - category pages
 * - archive pages
 * - search results
 * - tag pages
 * - author indexes
 * - pagination
 * - homepages
 *
 * This specifically prevents URLs such as:
 *
 * /finance/economy/page/398/?page=1360
 *
 * from being accepted as individual articles.
 */

function isValidArticleUrl(url) {
  if (!url) {
    return false;
  }

  let parsed;

  try {
    parsed = new URL(url);
  } catch {
    return false;
  }


  /*
   * Google News redirect URLs are allowed.
   *
   * Google News RSS commonly provides these instead
   * of the final publisher URL.
   */
  if (
    parsed.hostname === "news.google.com"
  ) {
    return (
      parsed.pathname.includes(
        "/rss/articles/"
      ) ||
      parsed.pathname.includes(
        "/articles/"
      )
    );
  }


  const pathname =
    parsed.pathname.toLowerCase();

  const search =
    parsed.search.toLowerCase();


  /*
   * Reject homepages.
   */
  if (
    pathname === "/" ||
    pathname === ""
  ) {
    return false;
  }


  /*
   * Reject obvious pagination paths.
   *
   * Examples:
   * /page/2/
   * /page/398/
   */
  if (
    /\/page\/\d+\/?$/i.test(
      pathname
    ) ||
    /\/page\/\d+\//i.test(
      pathname
    )
  ) {
    return false;
  }


  /*
   * Reject pagination query parameters.
   *
   * Examples:
   * ?page=1360
   * ?paged=4
   */
  if (
    /[?&](page|paged)=\d+/i.test(
      search
    )
  ) {
    return false;
  }


  /*
   * Reject common archive/category/search URLs.
   */
  const invalidPathPatterns = [
    /\/category\//i,
    /\/categories\//i,
    /\/tag\//i,
    /\/tags\//i,
    /\/author\//i,
    /\/authors\//i,
    /\/archive\//i,
    /\/archives\//i,
    /\/search\//i,
    /\/topic\//i,
    /\/topics\//i
  ];


  if (
    invalidPathPatterns.some(
      pattern =>
        pattern.test(pathname)
    )
  ) {
    return false;
  }


  /*
   * Reject common search query pages.
   */
  if (
    /[?&](s|search|q)=/i.test(
      search
    )
  ) {
    return false;
  }


  /*
   * Reject URLs that end simply in a generic
   * news/category section.
   */
  const genericSections = [
    "/news/",
    "/economy/",
    "/finance/",
    "/society/",
    "/politics/",
    "/world/",
    "/greece/",
    "/science/",
    "/culture/",
    "/business/"
  ];


  if (
    genericSections.includes(
      pathname
    )
  ) {
    return false;
  }


  /*
   * Require a reasonably substantial path.
   *
   * Individual articles normally contain
   * more than one meaningful path segment.
   */
  const segments =
    pathname
      .split("/")
      .filter(Boolean);


  if (segments.length < 2) {
    return false;
  }


  return true;
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
 * TITLE CLEANING FOR DEDUPLICATION
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

  const publisherPattern =
    new RegExp(
      `\\s[-–—]\\s*${escapedPublisher}\\s*$`,
      "i"
    );

  return result
    .replace(
      publisherPattern,
      ""
    )
    .trim();
}


/*
 * Google News normally formats headlines as:
 *
 * Article headline - Publisher
 *
 * Remove the final publisher section when necessary.
 */

function stripGenericPublisherSuffix(
  title
) {
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
   * Do not remove long headline fragments.
   */
  if (
    possiblePublisher.length > 45
  ) {
    return value;
  }

  return parts
    .slice(0, -1)
    .join(" - ")
    .trim();
}


/*
 * ============================================================
 * DUPLICATE KEY
 * ============================================================
 */

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


/*
 * ============================================================
 * ADD UNIQUE ARTICLE
 * ============================================================
 */

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
    results.some(
      existing =>
        createArticleKey(
          existing
        ) === newKey
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
    buildGoogleNewsRssUrl(
      name
    );


  console.log(
    `Searching Google News for: "${name}"`
  );


  try {

    const feed =
      await fetchRss(
        rssUrl
      );


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
       * 1. HEADLINE RELEVANCE
       * --------------------------------------------------------
       */

      if (
        !titleContainsAcademician(
          title,
          group.names
        )
      ) {

        console.log(
          `Rejected - academician not in headline: ${title}`
        );

        continue;
      }


      /*
       * --------------------------------------------------------
       * 2. BLACKLIST
       * --------------------------------------------------------
       */

      if (
        articleIsBlacklisted(
          item,
          link
        )
      ) {

        console.log(
          `Rejected - blacklisted publisher: ${title}`
        );

        continue;
      }


      /*
       * --------------------------------------------------------
       * 3. URL VALIDATION
       * --------------------------------------------------------
       */

      const publisherUrl =
        getPublisherUrl(item);


      /*
       * Validate publisher URL when Google provides one.
       *
       * This is the important check for archive/category
       * pages such as the Naftemporiki example.
       */
      if (
        publisherUrl &&
        !isValidArticleUrl(
          publisherUrl
        )
      ) {

        console.log(
          `Rejected - invalid publisher/article URL: ${publisherUrl}`
        );

        continue;
      }


      /*
       * Also ensure the RSS link itself has an acceptable
       * structure.
       */
      if (
        !isValidArticleUrl(
          link
        )
      ) {

        console.log(
          `Rejected - invalid RSS URL: ${link}`
        );

        continue;
      }


      /*
       * --------------------------------------------------------
       * 4. DATE
       * --------------------------------------------------------
       */

      let pubDate =
        item.pubDate
          ? new Date(
              item.pubDate
            )
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
       * 5. PUBLISHER
       * --------------------------------------------------------
       */

      const publisher =
        getPublisher(item);


      const publisherDomain =
        getPublisherDomain(item);


      /*
       * --------------------------------------------------------
       * 6. CREATE ARTICLE
       * --------------------------------------------------------
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

        /*
         * Prefer the publisher URL when it is a validated
         * individual article URL.
         *
         * Otherwise use the Google News article redirect.
         */
        url:
          publisherUrl ||
          link,

        publisher,

        domain:
          publisherDomain ||
          getDomain(link),

        approved:
          true
      };


      /*
       * --------------------------------------------------------
       * 7. DEDUPLICATE
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
   * Search ONLY recognised name variants
   * for the three selected academicians.
   */

  for (
    const group
    of SEARCH_GROUPS
  ) {

    for (
      const name
      of group.names
    ) {

      await processNameSearch({
        name,
        group,
        results
      });

    }

  }


  /*
   * Final duplicate check.
   */

  const uniqueResults = [];


  for (
    const article
    of results
  ) {

    addUniqueArticle(
      uniqueResults,
      article
    );

  }


  /*
   * Newest articles first.
   */

  uniqueResults.sort(
    (a, b) =>
      new Date(b.date) -
      new Date(a.date)
  );


  /*
   * Rewrite news.json from scratch.
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
    `Updated data/news.json with ${uniqueResults.length} unique, validated articles.`
  );

}


/*
 * Run.
 */

main().catch(error => {

  console.error(
    "News update failed:",
    error
  );

  process.exitCode = 1;

});
