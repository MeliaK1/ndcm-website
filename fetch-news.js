const fs = require("fs");
const { XMLParser } = require("fast-xml-parser");


/*
 * ============================================================
 * ACADEMICIANS AND ACCEPTED NAME VARIANTS
 * ============================================================
 *
 * We search Google News separately for each of these names.
 *
 * IMPORTANT:
 * An article is only accepted if one of these recognised names
 * also appears in the ARTICLE TITLE.
 *
 * We do NOT:
 * - search by surname alone
 * - inspect the article body
 * - accept an article simply because Google associated it
 *   with the search query
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
    academicianEn: "Georgios Marios Karagiannis",
    academicianEl: "Γεώργιος Μάριος Καραγιάννης",

    names: [
      "Γεώργιος Μάριος Καραγιάννης",
      "Georgios Marios Karagiannis"
    ]
  }
];


/*
 * ============================================================
 * BLACKLIST
 * ============================================================
 *
 * Do not include articles from these publishers.
 */

const BLACKLISTED_DOMAINS = [
  "documentonews.gr",
  "1voice.gr",
  "avgi.gr"
];


/*
 * Some Google News RSS feeds identify the publisher by name
 * rather than giving us the publisher domain directly.
 *
 * These values help catch those cases too.
 */

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
 * GOOGLE NEWS SOURCE / PUBLISHER
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
      const cleanBlocked =
        normaliseDomain(blockedDomain);

      return (
        cleanDomain === cleanBlocked ||
        cleanDomain.endsWith(
          `.${cleanBlocked}`
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


function articleIsBlacklisted(item, link) {
  /*
   * The RSS link itself will often be
   * news.google.com, so we check several
   * different signals.
   */

  const googleLinkDomain =
    getDomain(link);

  const publisherDomain =
    getPublisherDomain(item);

  const publisher =
    getPublisher(item);

  return (
    isBlacklistedDomain(
      googleLinkDomain
    ) ||
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
 * The academician MUST appear in the headline.
 *
 * We do not inspect article body text.
 * We do not use surname-only searches.
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
 * GOOGLE NEWS RSS URL
 * ============================================================
 *
 * Search only recognised full-name / initial variants.
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
 *
 * Google News frequently appends the publisher:
 *
 * "Article title - ProtoThema"
 *
 * Another website may contain:
 *
 * "Article title - Some Other Site"
 *
 * We strip the publisher associated with each RSS item before
 * comparing the titles.
 */


/*
 * Escape characters so publisher names can safely be used
 * inside a regular expression.
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

  result =
    result.replace(
      publisherPattern,
      ""
    );

  return result.trim();
}


/*
 * Remove a likely publisher suffix even when Google does not
 * provide a usable <source>.
 *
 * We only remove the final " - publisher" section when that
 * final section is short enough to look like an outlet name.
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
   * Publisher suffixes are generally short.
   * Avoid stripping long pieces of genuine
   * headline text.
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
    /*
     * Ignore most punctuation for duplicate
     * comparisons.
     */
    .replace(
      /[^\p{L}\p{N}\s]/gu,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}


/*
 * ============================================================
 * ADD ARTICLE WITHOUT DUPLICATES
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
    results.some(existing => {
      return (
        createArticleKey(
          existing
        ) === newKey
      );
    });

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
 * PROCESS ONE GOOGLE NEWS SEARCH
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
       * RELEVANCE TEST
       * --------------------------------------------------------
       *
       * This is the critical safeguard.
       *
       * Even though Google returned the article for an academician
       * search, we still reject it unless a recognised version of
       * the academician's name appears IN THE HEADLINE.
       */

      if (
        !titleContainsAcademician(
          title,
          group.names
        )
      ) {
        console.log(
          `Rejected because academician is not in title: ${title}`
        );

        continue;
      }


      /*
       * --------------------------------------------------------
       * BLACKLIST TEST
       * --------------------------------------------------------
       */

      if (
        articleIsBlacklisted(
          item,
          link
        )
      ) {
        console.log(
          `Blacklisted publisher rejected: ${title}`
        );

        continue;
      }


      /*
       * --------------------------------------------------------
       * DATE
       * --------------------------------------------------------
       */

      let pubDate =
        item.pubDate
          ? new Date(item.pubDate)
          : new Date();

      /*
       * Protect against invalid RSS dates.
       */
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
       * PUBLISHER INFORMATION
       * --------------------------------------------------------
       */

      const publisher =
        getPublisher(item);

      const publisherDomain =
        getPublisherDomain(item);


      /*
       * --------------------------------------------------------
       * ARTICLE OBJECT
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

        url:
          link,

        publisher:
          publisher,

        domain:
          publisherDomain ||
          getDomain(link),

        approved:
          true
      };


      /*
       * --------------------------------------------------------
       * DEDUPLICATION
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
   * Search every recognised name variant.
   *
   * There are NO surname-only searches here.
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
   * ==========================================================
   * FINAL DEDUPLICATION
   * ==========================================================
   *
   * This second pass is intentional.
   * Multiple alias searches can return the same story.
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
   * ==========================================================
   * SORT NEWEST FIRST
   * ==========================================================
   */

  uniqueResults.sort(
    (a, b) =>
      new Date(b.date) -
      new Date(a.date)
  );


  /*
   * ==========================================================
   * WRITE JSON
   * ==========================================================
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
    `Updated data/news.json with ${uniqueResults.length} unique, approved articles.`
  );
}


/*
 * Run the updater.
 */

main().catch(error => {
  console.error(
    "News update failed:",
    error
  );

  process.exitCode = 1;
});
