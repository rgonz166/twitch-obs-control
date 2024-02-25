const initNavbar = () => {
  const mainNavEl = document.getElementById('navbar-link-list');
  const navChildren = mainNavEl.children;
  for (const child of navChildren) {
    const firstChild = child.children[0];
    firstChild.addEventListener('click', (e) => {
      e.preventDefault();
      removeActive();
      child.classList.add('active');
      showSpecificPage(firstChild.dataset.page);
      navbarTitleEl.innerText = firstChild.dataset.title;
    });
  }

  removeActive = () => {
    for (const child of navChildren) {
      child.classList.remove('active');
    }
  };

  showSpecificPage = (page) => {
    const mainBody = document.getElementById('main-body').children;
    for (const section of mainBody) {
      if (section.id === page) {
        section.classList.remove('hide-page');
      } else {
        section.classList.add('hide-page');
      }
    }
  };
};

initNavbar();