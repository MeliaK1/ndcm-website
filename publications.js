const PUBLICATIONS_BATCH_SIZE = 20;

let allPublications = [];
let visibleCount = PUBLICATIONS_BATCH_SIZE;

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

function t(en, el) {
  return isGreek() ? el : en;
}

function formatResearchers(researchers) {
  if (!Array.isArray(researchers)) return "";

  return researchers
    .map(name => escapeHtml(name))
    .join(", ");
}

function createPublicationCard(publication) {

  const title =
    escapeHtml(publication.title);

  const authors =
    escapeHtml(
      publication.authors ||
      t(
        "Authors unavailable",
        "Μη διαθέσιμοι συγγραφείς"
      )
    );

  const publicationName =
    escapeHtml(
      publication.publication ||
      t(
        "Publication unavailable",
        "Μη διαθέσιμη δημοσίευση"
      )
    );

  const year =
    escapeHtml(
      publication.year ||
      ""
    );

  const url =
    escapeHtml(
      publication.url || "#"
    );

  const citations =
    Number(
      publication.citations || 0
    );

  const researchers =
    formatResearchers(
      publication.researchers
    );

  return `

<article class="publication-card">

<div class="publication-card-top">

<span class="pub-type">
${year}
</span>

${
citations>0
?

`<span class="publication-citations">

${t(
"Cited by",
"Αναφορές"
)}

${citations}

</span>`

:

""

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

?

`

<p class="publication-researchers">

<strong>

${t(
"Centre researcher:",
"Ερευνητής του Κέντρου:"
)}

</strong>

${researchers}

</p>

`

:

""

}

<a

class="text-link"

href="${url}"

target="_blank"

rel="noopener noreferrer"

>

${t(

"View on Google Scholar →",

"Προβολή στο Google Scholar →"

)}

</a>

</article>

`;

}

function sortPublications(data, mode) {

const publications = [...data];

if (mode === "oldest") {

publications.sort((a,b)=>{

const diff =
Number(a.year||0)
-
Number(b.year||0);

if(diff!==0)
return diff;

return String(a.title)
.localeCompare(
String(b.title)
);

});

return publications;

}

publications.sort((a,b)=>{

const diff =
Number(b.year||0)
-
Number(a.year||0);

if(diff!==0)
return diff;

return String(a.title)
.localeCompare(
String(b.title)
);

});

return publications;

}

function buildResearcherFilter() {

const filter =
document.getElementById(
"filter-researcher"
);

if(!filter)
return;

const names =
Array.from(

new Set(

allPublications.flatMap(

publication=>

publication.researchers || []

)

)

)

.filter(Boolean)

.sort();

const previous =
filter.value;

filter.innerHTML=

`
<option value="all">

${t(

"All researchers",

"Όλοι οι ερευνητές"

)}

</option>

${names.map(name=>`

<option value="${escapeHtml(name)}">

${escapeHtml(name)}

</option>

`).join("")}

`;

if(
names.includes(previous)
){

filter.value=previous;

}

}
function updateCounter(totalVisible, totalAvailable) {

  const counter =
    document.getElementById(
      "publication-counter"
    );

  if (!counter) return;

  counter.textContent = t(
    `Showing ${totalVisible} of ${totalAvailable} publications`,
    `Εμφανίζονται ${totalVisible} από ${totalAvailable} δημοσιεύσεις`
  );

}

function getFilteredPublications() {

  const researcherFilter =
    document.getElementById(
      "filter-researcher"
    );

  const sortSelect =
    document.getElementById(
      "sort-publications"
    );

  const selectedResearcher =
    researcherFilter
      ? researcherFilter.value
      : "all";

  const sortMode =
    sortSelect
      ? sortSelect.value
      : "newest";

  let results =
    [...allPublications];

  if (
    selectedResearcher !== "all"
  ) {

    results =
      results.filter(
        publication =>
          Array.isArray(
            publication.researchers
          ) &&
          publication.researchers.includes(
            selectedResearcher
          )
      );

  }

  return sortPublications(
    results,
    sortMode
  );

}

function renderPublicationList() {

  const container =
    document.querySelector(
      "[data-publications-feed]"
    );

  if (!container)
    return;

  const filtered =
    getFilteredPublications();

  if (
    filtered.length === 0
  ) {

    container.innerHTML =

    `
      <p class="empty-state">

        ${t(
          "No publications found.",
          "Δεν βρέθηκαν δημοσιεύσεις."
        )}

      </p>
    `;

    updateCounter(
      0,
      0
    );

    return;

  }

  const visible =
    filtered.slice(
      0,
      visibleCount
    );

  container.innerHTML =
    visible
      .map(
        createPublicationCard
      )
      .join("");

  updateCounter(
    visible.length,
    filtered.length
  );

  const button =
    document.getElementById(
      "load-more-publications"
    );

  if (button) {

    if (
      visible.length >=
      filtered.length
    ) {

      button.style.display =
        "none";

    } else {

      button.style.display =
        "inline-flex";

    }

  }

}
async function loadPublications() {

  const containers =
    document.querySelectorAll(
      "[data-publications-feed]"
    );

  if (containers.length === 0)
    return;

  try {

    const response =
      await fetch(
        "data/publications.json",
        {
          cache: "no-store"
        }
      );

    if (!response.ok) {

      throw new Error(
        "Unable to load publication data."
      );

    }

    allPublications =
      await response.json();

    if (
      !Array.isArray(
        allPublications
      )
    ) {

      throw new Error(
        "Publication data is invalid."
      );

    }

    buildResearcherFilter();

    containers.forEach(container => {

      const limit =
        container.dataset
          .publicationsLimit;

      // Homepage

      if (limit !== "all") {

        const count =
          Number(limit) || 3;

        const latest =
          sortPublications(
            allPublications,
            "newest"
          ).slice(
            0,
            count
          );

        container.innerHTML =
          latest
            .map(
              createPublicationCard
            )
            .join("");

        return;

      }

      // Publications page

      renderPublicationList();

    });

    const sort =
      document.getElementById(
        "sort-publications"
      );

    sort?.addEventListener(
      "change",
      () => {

        visibleCount =
          PUBLICATIONS_BATCH_SIZE;

        renderPublicationList();

      }
    );

    const filter =
      document.getElementById(
        "filter-researcher"
      );

    filter?.addEventListener(
      "change",
      () => {

        visibleCount =
          PUBLICATIONS_BATCH_SIZE;

        renderPublicationList();

      }
    );

    const loadMore =
      document.getElementById(
        "load-more-publications"
      );

    loadMore?.addEventListener(
      "click",
      () => {

        visibleCount +=
          PUBLICATIONS_BATCH_SIZE;

        renderPublicationList();

      }
    );
    // Refresh labels when the language changes

    const languageButton =
      document.querySelector(
        ".lang-toggle"
      );

    languageButton?.addEventListener(
      "click",
      () => {

        // Give script.js time to update
        setTimeout(() => {

          buildResearcherFilter();

          const loadMore =
            document.getElementById(
              "load-more-publications"
            );

          if (loadMore) {

            loadMore.textContent = t(
              `Show ${PUBLICATIONS_BATCH_SIZE} more`,
              `Εμφάνιση ${PUBLICATIONS_BATCH_SIZE} ακόμη`
            );

          }

          const counter =
            document.getElementById(
              "publication-counter"
            );

          if (counter) {

            const filtered =
              getFilteredPublications();

            updateCounter(
              Math.min(
                visibleCount,
                filtered.length
              ),
              filtered.length
            );

          }

          renderPublicationList();

        }, 0);

      }
    );

  } catch (error) {

    console.error(error);

    containers.forEach(container => {

      container.innerHTML = `

        <p class="empty-state">

          ${t(

            "Publications could not be loaded at the moment.",

            "Δεν ήταν δυνατή η φόρτωση των δημοσιεύσεων."

          )}

        </p>

      `;

    });

  }

}

loadPublications();
