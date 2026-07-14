const PUBLICATIONS_BATCH_SIZE = 20;

let allPublications = [];
let visibleCount = PUBLICATIONS_BATCH_SIZE;
let selectedResearcherId = "all";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isGreek() {
  return document.documentElement.lang === "el";
}

function translate(english, greek) {
  return isGreek() ? greek : english;
}

function formatResearchers(researchers) {
  if (!Array.isArray(researchers) || researchers.length === 0) {
    return "";
  }

  return researchers
    .map(researcher => escapeHtml(researcher))
    .join(", ");
}

function createPublicationCard(publication) {
  const title = escapeHtml(
    publication.title ||
      translate("Untitled publication", "Δημοσίευση χωρίς τίτλο")
  );

  const authors = escapeHtml(
    publication.authors ||
      translate(
        "Authors unavailable",
        "Μη διαθέσιμοι συγγραφείς"
      )
  );

  const publicationName = escapeHtml(
    publication.publication ||
      translate(
        "Publication details unavailable",
        "Δεν υπάρχουν διαθέσιμα στοιχεία δημοσίευσης"
      )
  );

  const year = escapeHtml(
    publication.year ||
      translate("Year unavailable", "Μη διαθέσιμο έτος")
  );

  const url = escapeHtml(publication.url || "#");

  const citations = Number(publication.citations || 0);

  const researchers = formatResearchers(
    publication.researchers
  );

  return `
    <article class="publication-card">
      <div class="publication-card-top">
        <span class="pub-type">${year}</span>

        ${
          citations > 0
            ? `
              <span class="publication-citations">
                ${translate("Cited by", "Αναφορές")} ${citations}
              </span>
            `
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

      <p class="publication-authors">
        ${authors}
      </p>

      <p class="publication-source">
        ${publicationName}
      </p>

      ${
        researchers
          ? `
            <p class="publication-researchers">
              <strong>
                ${translate(
                  "Centre researcher:",
                  "Ερευνητής του Κέντρου:"
                )}
              </strong>

              ${researchers}
            </p>
          `
          : ""
      }

      <a
        class="text-link"
        href="${url}"
        target="_blank"
        rel="noopener noreferrer"
      >
        ${translate(
          "View on Google Scholar →",
          "Προβολή στο Google Scholar →"
        )}
      </a>
    </article>
  `;
}

function sortPublications(publications, sortMode) {
  const sortedPublications = [...publications];

  if (sortMode === "oldest") {
    return sortedPublications.sort((first, second) => {
      const yearDifference =
        Number(first.year || 0) -
        Number(second.year || 0);

      if (yearDifference !== 0) {
        return yearDifference;
      }

      return String(first.title || "").localeCompare(
        String(second.title || ""),
        "en",
        {
          sensitivity: "base"
        }
      );
    });
  }

  return sortedPublications.sort((first, second) => {
    const yearDifference =
      Number(second.year || 0) -
      Number(first.year || 0);

    if (yearDifference !== 0) {
      return yearDifference;
    }

    return String(first.title || "").localeCompare(
      String(second.title || ""),
      "en",
      {
        sensitivity: "base"
      }
    );
  });
}

function getSelectedSortMode() {
  const sortSelect = document.getElementById(
    "sort-publications"
  );

  return sortSelect?.value || "newest";
}

function getFilteredPublications() {
  let publications = [...allPublications];

  if (selectedResearcherId !== "all") {
    publications = publications.filter(publication => {
      /*
       * The automated publication data currently stores one
       * scholarProfileId on each publication.
       */
      return (
        String(publication.scholarProfileId || "") ===
        selectedResearcherId
      );
    });
  }

  return sortPublications(
    publications,
    getSelectedSortMode()
  );
}

function updateCounter(visible, total) {
  const counter = document.getElementById(
    "publication-counter"
  );

  if (!counter) {
    return;
  }

  counter.textContent = translate(
    `Showing ${visible} of ${total} publications`,
    `Εμφανίζονται ${visible} από ${total} δημοσιεύσεις`
  );
}

function updateLoadMoreButton(hasMore) {
  const button = document.getElementById(
    "load-more-publications"
  );

  if (!button) {
    return;
  }

  button.hidden = !hasMore;
  button.disabled = !hasMore;

  button.textContent = translate(
    `Show ${PUBLICATIONS_BATCH_SIZE} more`,
    `Εμφάνιση ${PUBLICATIONS_BATCH_SIZE} ακόμη`
  );
}

function updateActiveResearcherButton() {
  const buttons = document.querySelectorAll(
    "[data-researcher-filter]"
  );

  buttons.forEach(button => {
    const buttonResearcherId =
      button.dataset.researcherFilter;

    const isActive =
      buttonResearcherId === selectedResearcherId;

    button.classList.toggle("is-active", isActive);

    button.setAttribute(
      "aria-pressed",
      String(isActive)
    );
  });
}

function renderFullPublicationsList() {
  const container = document.querySelector(
    '[data-publications-feed][data-publications-limit="all"]'
  );

  if (!container) {
    return;
  }

  const filteredPublications =
    getFilteredPublications();

  if (filteredPublications.length === 0) {
    container.innerHTML = `
      <p class="empty-state">
        ${translate(
          "No publications were found for this researcher.",
          "Δεν βρέθηκαν δημοσιεύσεις για αυτόν τον ερευνητή."
        )}
      </p>
    `;

    updateCounter(0, 0);
    updateLoadMoreButton(false);
    return;
  }

  const visiblePublications =
    filteredPublications.slice(0, visibleCount);

  container.innerHTML = visiblePublications
    .map(createPublicationCard)
    .join("");

  updateCounter(
    visiblePublications.length,
    filteredPublications.length
  );

  updateLoadMoreButton(
    visiblePublications.length <
      filteredPublications.length
  );
}

function renderHomepagePublications(container) {
  const limit =
    Number(container.dataset.publicationsLimit) || 3;

  const latestPublications = sortPublications(
    allPublications,
    "newest"
  ).slice(0, limit);

  if (latestPublications.length === 0) {
    container.innerHTML = `
      <p class="empty-state">
        ${translate(
          "No publications are available at the moment.",
          "Δεν υπάρχουν διαθέσιμες δημοσιεύσεις αυτή τη στιγμή."
        )}
      </p>
    `;

    return;
  }

  container.innerHTML = latestPublications
    .map(createPublicationCard)
    .join("");
}

function attachResearcherFilterEvents() {
  const buttons = document.querySelectorAll(
    "[data-researcher-filter]"
  );

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      selectedResearcherId =
        button.dataset.researcherFilter || "all";

      visibleCount = PUBLICATIONS_BATCH_SIZE;

      updateActiveResearcherButton();
      renderFullPublicationsList();
    });
  });
}

function attachSortEvent() {
  const sortSelect = document.getElementById(
    "sort-publications"
  );

  sortSelect?.addEventListener("change", () => {
    visibleCount = PUBLICATIONS_BATCH_SIZE;
    renderFullPublicationsList();
  });
}

function attachLoadMoreEvent() {
  const loadMoreButton = document.getElementById(
    "load-more-publications"
  );

  loadMoreButton?.addEventListener("click", () => {
    visibleCount += PUBLICATIONS_BATCH_SIZE;
    renderFullPublicationsList();
  });
}

function refreshGeneratedTranslations() {
  document
    .querySelectorAll("[data-publications-feed]")
    .forEach(container => {
      const limitSetting =
        container.dataset.publicationsLimit || "all";

      if (limitSetting === "all") {
        renderFullPublicationsList();
      } else {
        renderHomepagePublications(container);
      }
    });
}

function attachLanguageEvent() {
  const languageButton = document.querySelector(
    ".lang-toggle"
  );

  languageButton?.addEventListener("click", () => {
    /*
     * script.js changes the page language during the same click.
     * Waiting until the next event-loop cycle ensures that the
     * generated publication text uses the new language.
     */
    window.setTimeout(() => {
      refreshGeneratedTranslations();
    }, 0);
  });
}

async function loadPublications() {
  const containers = document.querySelectorAll(
    "[data-publications-feed]"
  );

  if (containers.length === 0) {
    return;
  }

  try {
    const response = await fetch(
      "data/publications.json",
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(
        `Unable to load publication data: ${response.status}`
      );
    }

    const publicationData = await response.json();

    if (!Array.isArray(publicationData)) {
      throw new Error(
        "Publication data is not a valid array."
      );
    }

    allPublications = publicationData;

    containers.forEach(container => {
      const limitSetting =
        container.dataset.publicationsLimit || "all";

      if (limitSetting === "all") {
        renderFullPublicationsList();
      } else {
        renderHomepagePublications(container);
      }
    });

    updateActiveResearcherButton();

    attachResearcherFilterEvents();
    attachSortEvent();
    attachLoadMoreEvent();
    attachLanguageEvent();
  } catch (error) {
    console.error(
      "Unable to load publications:",
      error
    );

    containers.forEach(container => {
      container.innerHTML = `
        <p class="empty-state">
          ${translate(
            "Publications could not be loaded at the moment.",
            "Δεν ήταν δυνατή η φόρτωση των δημοσιεύσεων αυτή τη στιγμή."
          )}
        </p>
      `;
    });

    updateCounter(0, 0);
    updateLoadMoreButton(false);
  }
}

loadPublications();