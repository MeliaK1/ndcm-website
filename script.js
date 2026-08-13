const languageButton = document.querySelector(".lang-toggle");
const menuButton = document.querySelector(".menu-btn");
const nav = document.querySelector(".main-nav");

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
 * Restore the visitor's saved language.
 * English is used only if no language
 * has previously been selected.
 */
const savedLanguage =
  localStorage.getItem("ndcm-language") || "en";

applyLanguage(savedLanguage);

/*
 * Change and save the language.
 */
languageButton?.addEventListener("click", () => {
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
   * Notify other scripts, such as news.js
   * and publications.js, that the language
   * has changed.
   */
  document.dispatchEvent(
    new CustomEvent("languageChanged", {
      detail: {
        language: nextLanguage
      }
    })
  );
});

/*
 * Mobile navigation.
 */
menuButton?.addEventListener("click", () => {
  const isOpen =
    menuButton.getAttribute("aria-expanded") === "true";

  menuButton.setAttribute(
    "aria-expanded",
    String(!isOpen)
  );

  nav?.classList.toggle("is-open");
});
/*
 * Close the mobile menu after selecting a link.
 */
nav?.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => {
    nav.classList.remove("is-open");

    menuButton?.setAttribute(
      "aria-expanded",
      "false"
    );
  });
});