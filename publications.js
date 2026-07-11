const PUBLICATIONS_PER_PAGE = 20;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatResearchers(researchers) {
  if (!Array.isArray(researchers) || researchers.length === 0) {
    return "";
  }

  return researchers.map(escapeHtml).join(", ");
}

function createPublicationCard(publication) {
  const title = escapeHtml(publication.title);
  const authors = escapeHtml(publication.authors || "Authors unavailable");
  const publicationName = escapeHtml(
    publication.publication || "Publication details unavailable"
  );
  const year = escapeHtml(publication.year || "Year unavailable");
  const url = escapeHtml(publication.url || "#");
  const researchers = formatResearchers(publication.researchers);
  const citations = Number(publication.citations || 0);

  return `
    <article class="publication-card">
      <div class="publication-card-top">
        <span class="pub-type">${year}</span>

        ${
          citations > 0
            ? `<span class="publication-citations">
                 Cited by ${citations}
               </span>`
            : ""
        }
      </div>

      <h3>
        <a
          href="${url}"
          target="_blank"
          rel="noopener noreferrer"
        >
          ${title}
        </a>
      </h3>

      <p class="publication-authors">${authors}</p>

      <p class="publication-source">${publicationName}</p>

      ${
        researchers
          ? `<p class="publication-researchers">
               <strong>Centre researcher:</strong> ${researchers}
             </p>`
          : ""
      }

      <a
        class="text-link"
        href="${url}"
        target="_blank"
        rel="noopener noreferrer"
      >
        View on Google Scholar →
      </a>
    </article>
  `;
}

function renderPagination({
  container,
  totalItems,
  pageSize,
  currentPage,
  onPageChange
}) {
  const totalPages = Math.ceil(totalItems / pageSize);

  if (totalPages <= 1) {
    container.innerHTML = "";
    container.hidden = true;
    return;
  }

  container.hidden = false;

  const buttons = [];

  buttons.push(`
    <button
      type="button"
      class="pagination-button"
      data-page="${currentPage - 1}"
      ${currentPage === 1 ? "disabled" : ""}
    >
      Previous
    </button>
  `);

  for (let page = 1; page <= totalPages; page += 1) {
    buttons.push(`
      <button
        type="button"
        class="pagination-button ${
          page === currentPage ? "is-active" : ""
        }"
        data-page="${page}"
        aria-current="${page === currentPage ? "page" : "false"}"
      >
        ${page}
      </button>
    `);
  }

  buttons.push(`
    <button
      type="button"
      class="pagination-button"
      data-page="${currentPage + 1}"
      ${currentPage === totalPages ? "disabled" : ""}
    >
      Next
    </button>
  `);

  container.innerHTML = buttons.join("");

  container.querySelectorAll("[data-page]").forEach(button => {
    button.addEventListener("click", () => {
      const requestedPage = Number(button.dataset.page);

      if (
        Number.isInteger(requestedPage) &&
        requestedPage >= 1 &&
        requestedPage <= totalPages
      ) {
        onPageChange(requestedPage);
      }
    });
  });
}

async function loadPublications() {
  const publicationContainers = document.querySelectorAll(
    "[data-publications-feed]"
  );

  if (publicationContainers.length === 0) {
    return;
  }

  try {
    const response = await fetch("data/publications.json", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(
        `Publication file could not be loaded: ${response.status}`
      );
    }

    const publications = await response.json();

    if (!Array.isArray(publications)) {
      throw new Error("Publication data is not an array.");
    }

    publicationContainers.forEach(container => {
      const limitSetting = container.dataset.publicationsLimit || "all";
      const paginationContainer = document.querySelector(
        "[data-publications-pagination]"
      );

      if (publications.length === 0) {
        container.innerHTML = `
          <p class="empty-state">
            No publications are available at the moment.
          </p>
        `;
        return;
      }

      // Homepage: show only the three most recent publications.
      if (limitSetting !== "all") {
        const limit = Number(limitSetting) || 3;

        container.innerHTML = publications
          .slice(0, limit)
          .map(createPublicationCard)
          .join("");

        return;
      }

      // Full publications page: show 20 per page.
      let currentPage = 1;

      function renderPage(page) {
        currentPage = page;

        const start = (currentPage - 1) * PUBLICATIONS_PER_PAGE;
        const end = start + PUBLICATIONS_PER_PAGE;
        const pageItems = publications.slice(start, end);

        container.innerHTML = pageItems
          .map(createPublicationCard)
          .join("");

        if (paginationContainer) {
          renderPagination({
            container: paginationContainer,
            totalItems: publications.length,
            pageSize: PUBLICATIONS_PER_PAGE,
            currentPage,
            onPageChange: renderPage
          });
        }

        window.scrollTo({
          top: container.offsetTop - 120,
          behavior: "smooth"
        });
      }

      renderPage(1);
    });
  } catch (error) {
    console.error("Unable to load publications:", error);

    publicationContainers.forEach(container => {
      container.innerHTML = `
        <p class="empty-state">
          Publications could not be loaded at the moment.
        </p>
      `;
    });
  }
}

loadPublications();