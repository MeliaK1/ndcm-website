const BLACKLISTED_DOMAINS = [
  "example-bad-site.com",
  "clickbait-news.com",
  "lowqualityblog.com"
];

async function loadNews() {
  const newsContainer = document.querySelector("[data-news-feed]");

  if (!newsContainer) return;

  try {
    const response = await fetch("data/news.json");
    const articles = await response.json();

    const approvedArticles = articles
      .filter(article => article.approved === true)
      .filter(article => !BLACKLISTED_DOMAINS.includes(article.domain))
      .slice(0, 4);

    newsContainer.innerHTML = approvedArticles.map(article => `
      <article class="news-feed-card">
        <p class="news-meta">${article.category} · ${article.date}</p>
        <h3>${article.title}</h3>
        <p>${article.summary}</p>
        <a href="${article.url}" target="_blank" rel="noopener noreferrer">
          Read full article →
        </a>
      </article>
    `).join("");

  } catch (error) {
    newsContainer.innerHTML = `
      <p>News could not be loaded at the moment.</p>
    `;
  }
}

loadNews();