const fs = require("fs");
const { XMLParser } = require("fast-xml-parser");

const NEWS_FILE_PATH = "data/news.json";

const GOOGLE_TRANSLATE_API_KEY =
  process.env.GOOGLE_TRANSLATE_API_KEY || "";

const GOOGLE_TRANSLATE_URL =
  "https://translation.googleapis.com/language/translate/v2";

/*
 * ============================================================
 * SCIENTISTS INCLUDED IN THE AUTOMATED NEWS FEED
 * ============================================================
 */

const SEARCH_GROUPS = [
  {
    academicianEn: "Costas Synolakis",
    academicianEl: "Κώστας Συνολάκης",

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
     * Karagiannis remains deliberately strict.
     * Do not add surname-only variants here.
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

function containsGreekText(value) {
  return /[\u0370-\u03FF\u1F00-\u1FFF]/u.test(
    String(value || "")
  );
}

async function translateHeadlineToEnglish(title) {
  const cleanTitle =
    String(title || "").trim();

  if (!cleanTitle) {
    return "";
  }

  /*
   * Headlines already written in English
   * do not need translation.
   */
  if (!containsGreekText(cleanTitle)) {
    return cleanTitle;
  }

  /*
   * If the API key is unavailable, keep the
   * news workflow running instead of failing.
   */
  if (!GOOGLE_TRANSLATE_API_KEY) {
    console.warn(
      "Google Translation API key is unavailable. Keeping original headline."
    );

    return "";
  }

  try {
    const response =
      await fetch(
        `${GOOGLE_TRANSLATE_URL}?key=${encodeURIComponent(
          GOOGLE_TRANSLATE_API_KEY
        )}`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            q: cleanTitle,
            source: "el",
            target: "en",
            format: "text"
          })
        }
      );

    if (!response.ok) {
      throw new Error(
        `Google Translation returned ${response.status}`
      );
    }

    const data =
      await response.json();

    return String(
      data?.data?.translations?.[0]
        ?.translatedText || ""
    ).trim();

  } catch (error) {
    console.error(
      `Could not translate headline: ${cleanTitle}`,
      error.message
    );

    /*
     * Translation failure must never stop
     * the automatic news update.
     */
    return "";
  }
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

function getPublisherUrl(item) {
  if (!item?.source) {
    return "";
  }

  if (
    typeof item.source === "string"
  ) {
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
        normaliseDomain(
          blockedDomain
        );

      return (
        cleanDomain === blocked ||
        cleanDomain.endsWith(
          `.${blocked}`
        )
      );
    }
  );
}

function isBlacklistedPublisher(
  publisher
) {
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
 * DATE HELPERS
 * ============================================================
 */

function isValidDateString(value) {
  if (!value) {
    return false;
  }

  const date =
    new Date(value);

  return !Number.isNaN(
    date.getTime()
  );
}

function earliestDate(
  firstDate,
  secondDate
) {
  const firstValid =
    isValidDateString(firstDate);

  const secondValid =
    isValidDateString(secondDate);

  if (
    firstValid &&
    !secondValid
  ) {
    return firstDate;
  }

  if (
    !firstValid &&
    secondValid
  ) {
    return secondDate;
  }

  if (
    !firstValid &&
    !secondValid
  ) {
    return "";
  }

  return (
    new Date(firstDate) <=
    new Date(secondDate)
      ? firstDate
      : secondDate
  );
}

/*
 * ============================================================
 * ARTICLE IDENTITY / DEDUPLICATION
 * ============================================================
 *
 * sourceTitle is the untouched headline received from Google
 * News. It is kept internally so an administrator can edit the
 * visible Greek title without changing the identity of the
 * article.
 *
 * Existing archive items created before sourceTitle was added
 * continue to work because we fall back to title.
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
   * A short final fragment is likely
   * to be the publisher name.
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
  /*
   * IMPORTANT:
   * Always prefer sourceTitle for automatic news.
   * This allows article.title to be manually edited
   * without causing the RSS article to be added again.
   */
  const identityTitle =
    article.sourceTitle ||
    article.title ||
    "";

  let title =
    stripPublisherFromTitle(
      identityTitle,
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
 * EXISTING ARCHIVE
 * ============================================================
 */

function readExistingNews() {
  if (
    !fs.existsSync(
      NEWS_FILE_PATH
    )
  ) {
    return [];
  }

  try {
    const raw =
      fs.readFileSync(
        NEWS_FILE_PATH,
        "utf8"
      );

    const data =
      JSON.parse(raw);

    if (!Array.isArray(data)) {
      console.warn(
        "Existing news.json is not an array. Starting with an empty archive."
      );

      return [];
    }

    return data;

  } catch (error) {
    console.error(
      "Could not read existing news.json:",
      error.message
    );

    /*
     * Safer to fail than overwrite
     * the existing archive accidentally.
     */
    throw error;
  }
}

/*
 * ============================================================
 * ARCHIVE MERGING
 * ============================================================
 *
 * Existing articles are preserved.
 *
 * If Google resurfaces the same story later,
 * we keep the EARLIEST date we have already
 * recorded for that story.
 *
 * The visible title and titleEn are also preserved.
 * This means manual headline corrections survive future runs.
 * ============================================================
 */

function mergeArticle(
  archiveMap,
  incomingArticle
) {
  const key =
    createArticleKey(
      incomingArticle
    );

  if (!key) {
    return;
  }

  const existing =
    archiveMap.get(key);

  /*
   * Completely new story.
   */
  if (!existing) {
    archiveMap.set(
      key,
      incomingArticle
    );

    console.log(
      `Added new article: ${incomingArticle.title}`
    );

    return;
  }

  /*
   * Story already exists.
   *
   * The earliest date wins. This stops an
   * older article jumping to the top simply
   * because Google News resurfaces it later.
   */
  const preservedDate =
    earliestDate(
      existing.date,
      incomingArticle.date
    );

  const mergedArticle = {
    ...existing,

    /*
     * Preserve the original Google News headline permanently.
     *
     * Existing sourceTitle wins. Otherwise the sourceTitle
     * supplied by the current RSS record is saved.
     */
    sourceTitle:
      existing.sourceTitle ||
      incomingArticle.sourceTitle ||
      incomingArticle.title ||
      existing.title ||
      "",

    /*
     * Preserve manually edited visible headlines.
     */
    title:
      existing.title ||
      incomingArticle.title,

    titleEn:
      existing.titleEn ||
      incomingArticle.titleEn ||
      "",

    category:
      existing.category ||
      incomingArticle.category,

    academicianEn:
      existing.academicianEn ||
      incomingArticle.academicianEn,

    academicianEl:
      existing.academicianEl ||
      incomingArticle.academicianEl,

    url:
      existing.url ||
      incomingArticle.url,

    publisher:
      existing.publisher ||
      incomingArticle.publisher,

    domain:
      existing.domain ||
      incomingArticle.domain,

    approved:
      existing.approved !== false,

    date:
      preservedDate
  };

  archiveMap.set(
    key,
    mergedArticle
  );

  if (
    existing.date !==
    incomingArticle.date
  ) {
    console.log(
      `Existing article preserved with earliest date ${preservedDate}: ${incomingArticle.title}`
    );
  } else {
    console.log(
      `Duplicate already in archive: ${incomingArticle.title}`
    );
  }
}

/*
 * ============================================================
 * PROCESS ONE NAME SEARCH
 * ============================================================
 */

async function processNameSearch({
  name,
  group,
  archiveMap
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
      feed?.rss?.channel?.item ||
      [];

    const itemList =
      Array.isArray(items)
        ? items
        : [items];

    for (
      const item of itemList
    ) {
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
       * 3. RSS DATE
       * --------------------------------------------------------
       *
       * Do NOT replace an invalid date with today's
       * date. That can make an old article appear new.
       */
      if (!item.pubDate) {
        console.log(
          `Rejected - missing publication date: ${title}`
        );

        continue;
      }

      const pubDate =
        new Date(
          item.pubDate
        );

      if (
        Number.isNaN(
          pubDate.getTime()
        )
      ) {
        console.log(
          `Rejected - invalid publication date: ${title}`
        );

        continue;
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
       * The RSS headline is stored as sourceTitle.
       *
       * title remains the visible Greek/original headline and
       * can later be edited manually in News Admin.
       */
      const sourceTitle =
        title;

      const articleKey =
        createArticleKey({
          sourceTitle,
          title,
          publisher
        });

      const existingArticle =
        archiveMap.get(
          articleKey
        );

      const titleEn =
        existingArticle?.titleEn ||
        await translateHeadlineToEnglish(
          title
        );

      const article = {
        sourceTitle,

        /*
         * Visible Greek/original headline.
         */
        title,

        /*
         * Visible English headline.
         */
        titleEn,

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
         * Keep the Google News RSS article link.
         */
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
       * 6. MERGE INTO ARCHIVE
       * --------------------------------------------------------
       */
      mergeArticle(
        archiveMap,
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
  /*
   * ----------------------------------------------------------
   * 1. Load the existing archive FIRST.
   * ----------------------------------------------------------
   */
  const existingArticles =
    readExistingNews();

  console.log(
    `Loaded ${existingArticles.length} existing news articles.`
  );

  /*
   * ----------------------------------------------------------
   * 2. Build archive map from existing articles.
   * ----------------------------------------------------------
   *
   * Old archive entries may not yet contain sourceTitle.
   * That is fine: createArticleKey falls back to title.
   */
  const archiveMap =
    new Map();

  for (
    const article of
    existingArticles
  ) {
    const key =
      createArticleKey(
        article
      );

    if (!key) {
      continue;
    }

    /*
     * If the existing JSON itself contains duplicates,
     * merge them and keep the earliest known date.
     */
    if (
      archiveMap.has(key)
    ) {
      mergeArticle(
        archiveMap,
        article
      );
    } else {
      archiveMap.set(
        key,
        article
      );
    }
  }

  /*
   * ----------------------------------------------------------
   * 3. Search Google News.
   * ----------------------------------------------------------
   *
   * No surname-only searches.
   * No article-body searches.
   */
  for (
    const group of SEARCH_GROUPS
  ) {
    for (
      const name of
      group.searchNames
    ) {
      await processNameSearch({
        name,
        group,
        archiveMap
      });
    }
  }

  /*
   * ----------------------------------------------------------
   * 4. Convert archive back to an array.
   * ----------------------------------------------------------
   */
  const finalArticles =
    Array.from(
      archiveMap.values()
    );

  for (
    const article of
    finalArticles
  ) {
    /*
     * Backfill sourceTitle for old articles.
     *
     * Before an administrator edits an old article, its current
     * title is also its best available original/source headline.
     *
     * Once sourceTitle exists, future title edits do not alter it.
     */
    if (!article.sourceTitle) {
      article.sourceTitle =
        article.title || "";
    }

    /*
     * Backfill missing English translations only.
     *
     * Existing titleEn values, including manual corrections,
     * are never translated again.
     */
    if (
      !article.titleEn &&
      containsGreekText(
        article.title
      )
    ) {
      article.titleEn =
        await translateHeadlineToEnglish(
          article.title
        );
    }

    /*
     * English headlines use their original
     * title as the English title.
     */
    if (
      !article.titleEn &&
      !containsGreekText(
        article.title
      )
    ) {
      article.titleEn =
        article.title || "";
    }
  }

  /*
   * ----------------------------------------------------------
   * 5. Newest first.
   * ----------------------------------------------------------
   */
  finalArticles.sort(
    (a, b) => {
      const firstDate =
        new Date(
          a.date || 0
        );

      const secondDate =
        new Date(
          b.date || 0
        );

      return (
        secondDate -
        firstDate
      );
    }
  );

  /*
   * ----------------------------------------------------------
   * 6. Write the COMPLETE archive.
   * ----------------------------------------------------------
   */
  fs.writeFileSync(
    NEWS_FILE_PATH,

    JSON.stringify(
      finalArticles,
      null,
      2
    ) + "\n",

    "utf8"
  );

  console.log(
    `Updated ${NEWS_FILE_PATH} with ${finalArticles.length} archived approved articles.`
  );
}

main().catch(error => {
  console.error(
    "News update failed:",
    error
  );

  process.exitCode = 1;
});