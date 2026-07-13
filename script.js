const languageButton = document.querySelector(".lang-toggle");

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
