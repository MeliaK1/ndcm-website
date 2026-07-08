const langButton = document.querySelector('.lang-toggle');
const translatable = document.querySelectorAll('[data-en][data-el]');

langButton?.addEventListener('click', () => {
  const nextLang = langButton.dataset.lang === 'en' ? 'el' : 'en';
  langButton.dataset.lang = nextLang;
  translatable.forEach((el) => {
    el.textContent = el.dataset[nextLang];
  });
});

const menuButton = document.querySelector('.menu-btn');
const nav = document.querySelector('.main-nav');

menuButton?.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  nav?.classList.toggle('is-open');
});
