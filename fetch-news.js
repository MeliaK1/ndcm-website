const fs = require("fs");
const { XMLParser } = require("fast-xml-parser");

const SEARCH_GROUPS = [
  {
    professor: "Σταμάτης Κριμιζής / Stamatis Krimizis",
    names: ["Σταμάτης Κριμιζής", "Stamatis Krimizis"]
  },
  {
    professor: "Κώστας Συνολάκης / Costas Synolakis",
    names: ["Κώστας Συνολάκης", "Costas Synolakis"]
  },
  {
    professor: "Χρήστος Ζερεφός / Christos Zerefos",
    names: ["Χρήστος Ζερεφός", "Christos Zerefos"]
  },
  {
    professor: "Αθανάσιος Φωκάς / Θανάσης Φωκάς / Athanasios Fokas",
    names: ["Αθανάσιος Φωκάς", "Θανάσης Φωκάς", "Athanasios Fokas"]
  }
];

const BLACKLISTED_DOMAINS = [
  "documentonews.gr",
  "www.documentonews.gr"
];

function normaliseText(text) {
  return (text || "").toLowerCase();
}

function titleContainsName(title, names) {
  const normalisedTitle = normaliseText(title);
  return names.some(name => normalisedTitle.includes(normaliseText(name)));
}

function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isBlacklisted(domain) {
  const cleanDomain = domain.replace(/^www\./, "");
  return BLACKLISTED_DOMAINS.some(blocked => blocked.replace(/^www\./, "") === cleanDomain);
}

function buildGoogleNewsRssUrl(name) {
  const query = encodeURIComponent(`"${name}"`);
  return `https://news.google.com/rss/search?q=${query}&hl=el&gl=GR&ceid=GR:el`;
}

async function fetchRss(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch RSS: ${response.status}`);
  }

  const xml = await response.text();
  const parser = new XMLParser({
    ignoreAttributes: false
  });

  return parser.parse(xml);
}

async function main() {
  const results = [];

  for (const group of SEARCH_GROUPS) {
    for (const name of group.names) {
      const rssUrl = buildGoogleNewsRssUrl(name);

      try {
        const feed = await fetchRss(rssUrl);
        const items = feed?.rss?.channel?.item || [];
        const itemList = Array.isArray(items) ? items : [items];

        for (const item of itemList) {
          const title = item.title || "";
          const link = item.link || "";
          const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
          const domain = getDomain(link);

          if (!titleContainsName(title, group.names)) continue;
          if (isBlacklisted(domain)) continue;

          results.push({
            title,
            source: domain || "Google News",
            date: pubDate.toISOString().slice(0, 10),
            category: "In the Media",
            professor: group.professor,
            summary: `Article mentioning ${group.professor}. A short editorial summary can be added later.`,
            url: link,
            domain,
            approved: true
          });
        }
      } catch (error) {
        console.error(`Could not fetch news for ${name}:`, error.message);
      }
    }
  }

  const uniqueResults = Array.from(
    new Map(results.map(article => [article.title, article])).values()
  );

  const sortedResults = uniqueResults
  .sort((a, b) => new Date(b.date) - new Date(a.date));

  fs.writeFileSync("data/news.json", JSON.stringify(sortedResults, null, 2), "utf8");

  console.log(`Updated data/news.json with ${sortedResults.length} articles.`);
}

main();