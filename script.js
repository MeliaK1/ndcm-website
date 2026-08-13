const languageButton = document.querySelector(".lang-toggle");

function applyLanguage(language) {
  const selectedLanguage =
    language === "el" ? "el" : "en";

  document.documentElement.lang = selectedLanguage;

  document
    .querySelectorAll("[data-en][data-el]")
    .forEach(element => {
      element.textContent =
        element.dataset[selectedLanguage];
    });

  if (languageButton) {
    languageButton.dataset.lang = selectedLanguage;

    languageButton.textContent =
      selectedLanguage === "en"
        ? "EN | ΕΛ"
        : "ΕΛ | EN";
  }
}

/*
 * Restore the language selected by the visitor.
 * If no language has previously been selected,
 * use English.
 */
const savedLanguage =
  localStorage.getItem("ndcm-language") || "en";

applyLanguage(savedLanguage);

/*
 * Change language when the visitor clicks
 * the EN | ΕΛ button.
 */
if (languageButton) {
  languageButton.addEventListener("click", () => {
    const currentLanguage =
      document.documentElement.lang === "el"
        ? "el"
        : "en";

    const nextLanguage =
      currentLanguage === "en"
        ? "el"
        : "en";

    localStorage.setItem(
      "ndcm-language",
      nextLanguage
    );

    applyLanguage(nextLanguage);

    /*
     * Tell dynamically generated content,
     * such as News and Publications,
     * that the language has changed.
     */
    document.dispatchEvent(
      new CustomEvent("languageChanged", {
        detail: {
          language: nextLanguage
        }
      })
    );
  });
}

if (languageButton) {
  languageButton.addEventListener("click", () => {
    const currentLanguage = languageButton.dataset.lang || "en";
    const nextLanguage = currentLanguage === "en" ? "el" : "en";

    document
      .querySelectorAll("[data-en][data-el]")
      .forEach(element => {
        element.textContent = element.dataset[nextLanguage];
      });

    document.documentElement.lang = nextLanguage;
    languageButton.dataset.lang = nextLanguage;
    languageButton.textContent =
      nextLanguage === "en" ? "EN | ΕΛ" : "ΕΛ | EN";
  });
}

const menuButton = document.querySelector('.menu-btn');
const nav = document.querySelector('.main-nav');

menuButton?.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  nav?.classList.toggle('is-open');
});
