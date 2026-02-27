// navigation.js - Tab bar controller for iOS-style navigation

document.addEventListener('DOMContentLoaded', () => {
  const navButtons = document.querySelectorAll('[data-tab-target]');
  const tabSections = document.querySelectorAll('[data-tab-section]');

  if (navButtons.length === 0) return;

  function switchTab(targetTab) {
    tabSections.forEach(section => {
      section.classList.toggle('hidden', section.dataset.tabSection !== targetTab);
    });

    navButtons.forEach(button => {
      const isActive = button.dataset.tabTarget === targetTab;
      button.classList.toggle('active', isActive);
      if (button.getAttribute('role') === 'tab') {
        button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      }
    });

    // Scroll main area to top on tab switch
    const main = document.getElementById('app-main');
    if (main) main.scrollTop = 0;
  }

  navButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(button.dataset.tabTarget);
    });
  });

  switchTab('calc');
});
