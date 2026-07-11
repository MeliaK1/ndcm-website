const fs = require("fs");
const path = require("path");

const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY;

if (!SERPAPI_API_KEY) {
  console.error(
    "SERPAPI_API_KEY is missing. Add it as a GitHub Actions repository secret."
  );
  process.exit(1);
}

const SCHOLAR_PROFILES = [
  {
    authorId: "Z5AxUbAAAAAJ",
    language: "en"
  },
  {
    authorId: "20dnM4UAAAAJ",
    language: "el"
  },
  {
    authorId: "J9ARrjgAAAAJ",
    language: "en"
  },
  {
    authorId: "nMuRV_cAAAAJ",
    language: "el"
  },
  {
    authorId: "z4j5_IIAAAAJ",
    language: "en"
  },
  {
    authorId: "9jF1GewAAAAJ",
    language: "el"
  },
  {
    authorId: "mRVqqoUAAAAJ",
    language: "el"
  }
];

const RESULTS_PER_REQUEST = 100;

// Safety guard. This still permits up to 2,000 publications per profile.
const MAX_PAGES_PER_PROFILE = 20;

const OUTPUT_FILE = path.join(
  __dirname,
  "data",
  "publications.json"
);

function normaliseTitle(title) {
  return String(title || "")
    .toLocaleLowerCase("el-GR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function getPublicationKey(publication) {
  return [
    normaliseTitle(publication.title),
    String(publication.year || "")
  ].join("::");
}

function cleanYear(year) {
  const match = String(year || "").match(/\b(19|20)\d{2}\b/);

  return match ? match[0] : "";
}

function safeCitationCount(article) {
  const value = Number(article?.cited_by?.value);

  return Number.isFinite(value) ? value : 0;
}

async function fetchScholarPage({
  authorId,
  language,
  start
}) {
  const parameters = new URLSearchParams({
    engine: "google_scholar_author",
    author_id: authorId,
    hl: language,
    sort: "pubdate",
    start: String(start),
    num: String(RESULTS_PER_REQUEST),
    api_key: SERPAPI_API_KEY,
    output: "json"
  });

  const endpoint = `https://serpapi.com/search.json?${parameters}`;

  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(
      `SerpAPI request failed with HTTP ${response.status}`
    );
  }

  const payload = await response.json();

  if (payload.error) {
    throw new Error(payload.error);
  }

  return payload;
}

async function fetchProfile(profile) {
  const collected = [];
  let researcherName = profile.authorId;

  for (
    let page = 0;
    page < MAX_PAGES_PER_PROFILE;
    page += 1
  ) {
    const start = page * RESULTS_PER_REQUEST;

    console.log(
      `Fetching ${profile.authorId}, offset ${start}...`
    );

    const payload = await fetchScholarPage({
      authorId: profile.authorId,
      language: profile.language,
      start
    });

    researcherName =
      payload?.author?.name ||
      researcherName;

    const articles = Array.isArray(payload.articles)
      ? payload.articles
      : [];

    for (const article of articles) {
      const year = cleanYear(article.year);

      collected.push({
        id:
          article.citation_id ||
          `${profile.authorId}-${normaliseTitle(article.title)}`,
        title: article.title || "Untitled publication",
        authors: article.authors || "",
        publication: article.publication || "",
        year,
        citations: safeCitationCount(article),
        url:
          article.link ||
          `https://scholar.google.com/citations?user=${profile.authorId}`,
        scholarProfileId: profile.authorId,
        researchers: [researcherName]
      });
    }

    // Fewer than 100 means there is no further page.
    if (articles.length < RESULTS_PER_REQUEST) {
      break;
    }
  }

  return {
    researcherName,
    publications: collected
  };
}

function mergeDuplicatePublications(publications) {
  const merged = new Map();

  for (const publication of publications) {
    const key = getPublicationKey(publication);
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, publication);
      continue;
    }

    const researchers = new Set([
      ...(existing.researchers || []),
      ...(publication.researchers || [])
    ]);

    merged.set(key, {
      ...existing,
      authors: existing.authors || publication.authors,
      publication:
        existing.publication || publication.publication,
      url: existing.url || publication.url,
      citations: Math.max(
        existing.citations || 0,
        publication.citations || 0
      ),
      researchers: Array.from(researchers).sort()
    });
  }

  return Array.from(merged.values());
}

function sortPublications(publications) {
  return publications.sort((a, b) => {
    const yearDifference =
      Number(b.year || 0) - Number(a.year || 0);

    if (yearDifference !== 0) {
      return yearDifference;
    }

    return String(a.title).localeCompare(
      String(b.title),
      "en",
      {
        sensitivity: "base"
      }
    );
  });
}

async function main() {
  const allPublications = [];

  for (const profile of SCHOLAR_PROFILES) {
    try {
      const result = await fetchProfile(profile);

      console.log(
        `Found ${result.publications.length} publications for ${result.researcherName}.`
      );

      allPublications.push(...result.publications);
    } catch (error) {
      console.error(
        `Unable to fetch profile ${profile.authorId}:`,
        error.message
      );
    }
  }

  if (allPublications.length === 0) {
    throw new Error(
      "No publications were retrieved. The existing publications file was not overwritten."
    );
  }

  const publications = sortPublications(
    mergeDuplicatePublications(allPublications)
  );

  fs.mkdirSync(path.dirname(OUTPUT_FILE), {
    recursive: true
  });

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(publications, null, 2),
    "utf8"
  );

  console.log(
    `Saved ${publications.length} unique publications to data/publications.json.`
  );
}

main().catch(error => {
  console.error("Publication update failed:", error);
  process.exit(1);
});