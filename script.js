(() => {
  "use strict";

  const root = document.documentElement;
  root.classList.replace("no-js", "js");

  const yearElement = document.getElementById("currentYear");
  if (yearElement) {
    yearElement.textContent = String(new Date().getFullYear());
  }

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const desktopNavigationQuery = window.matchMedia("(min-width: 68.751rem)");
  const header = document.querySelector(".site-header");
  const menuButton = document.getElementById("menuButton");
  const navigationLinks = document.getElementById("navigationLinks");
  const navigationItems = navigationLinks
    ? Array.from(navigationLinks.querySelectorAll("[data-nav-link]"))
    : [];
  const originalTabIndexes = new Map(
    navigationItems.map((link) => [link, link.getAttribute("tabindex")])
  );

  const setNavigationInteractive = (isInteractive) => {
    if (!navigationLinks) return;

    if ("inert" in navigationLinks) {
      navigationLinks.inert = !isInteractive;
    }

    navigationItems.forEach((link) => {
      const originalTabIndex = originalTabIndexes.get(link);
      if (!isInteractive) {
        link.setAttribute("tabindex", "-1");
      } else if (originalTabIndex === null) {
        link.removeAttribute("tabindex");
      } else {
        link.setAttribute("tabindex", originalTabIndex);
      }
    });
  };

  const isMenuOpen = () => Boolean(navigationLinks?.classList.contains("is-open"));

  const setMenuOpen = (shouldOpen, options = {}) => {
    if (!menuButton || !navigationLinks) return;

    const canUseMobileMenu = !desktopNavigationQuery.matches;
    const isOpen = Boolean(shouldOpen && canUseMobileMenu);

    navigationLinks.classList.toggle("is-open", isOpen);
    menuButton.classList.toggle("is-open", isOpen);
    menuButton.setAttribute("aria-expanded", String(isOpen));
    menuButton.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
    document.body.classList.toggle("menu-open", isOpen);
    setNavigationInteractive(desktopNavigationQuery.matches || isOpen);

    if (isOpen && options.focusFirst) {
      window.requestAnimationFrame(() => navigationItems[0]?.focus());
    }

    if (!isOpen && options.returnFocus) {
      window.requestAnimationFrame(() => menuButton.focus({ preventScroll: true }));
    }
  };

  if (menuButton && navigationLinks) {
    setMenuOpen(false);

    menuButton.addEventListener("click", () => {
      setMenuOpen(!isMenuOpen(), { focusFirst: !isMenuOpen() });
    });

    navigationLinks.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest("a")) {
        setMenuOpen(false, { returnFocus: !desktopNavigationQuery.matches });
      }
    });

    document.addEventListener("click", (event) => {
      if (!isMenuOpen() || !(event.target instanceof Node)) return;
      if (navigationLinks.contains(event.target) || menuButton.contains(event.target)) return;
      setMenuOpen(false, {
        returnFocus: navigationLinks.contains(document.activeElement),
      });
    });

    document.addEventListener("keydown", (event) => {
      if (!isMenuOpen()) return;

      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false, { returnFocus: true });
        return;
      }

      if (event.key !== "Tab") return;

      const focusableMenuItems = [menuButton, ...navigationItems];
      const firstMenuItem = focusableMenuItems[0];
      const lastMenuItem = focusableMenuItems[focusableMenuItems.length - 1];
      const activeItemIndex = focusableMenuItems.indexOf(document.activeElement);

      if (event.shiftKey && (document.activeElement === firstMenuItem || activeItemIndex === -1)) {
        event.preventDefault();
        lastMenuItem.focus();
      } else if (!event.shiftKey && (document.activeElement === lastMenuItem || activeItemIndex === -1)) {
        event.preventDefault();
        firstMenuItem.focus();
      }
    });

    const handleNavigationBreakpointChange = () => setMenuOpen(false);
    if (typeof desktopNavigationQuery.addEventListener === "function") {
      desktopNavigationQuery.addEventListener("change", handleNavigationBreakpointChange);
    } else {
      desktopNavigationQuery.addListener(handleNavigationBreakpointChange);
    }
  }

  const navigableSections = navigationItems
    .map((link) => {
      const hash = link.getAttribute("href");
      if (!hash?.startsWith("#")) return null;
      const section = document.getElementById(decodeURIComponent(hash.slice(1)));
      return section ? { link, section } : null;
    })
    .filter(Boolean);

  const updateNavigationState = () => {
    header?.classList.toggle("is-scrolled", window.scrollY > 20);
    if (!navigableSections.length) return;

    const headerOffset = (header?.offsetHeight || 0) + window.innerHeight * 0.24;
    const scrollMarker = window.scrollY + headerOffset;
    const pageBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
    const sectionsInPageOrder = [...navigableSections].sort(
      (firstItem, secondItem) => firstItem.section.offsetTop - secondItem.section.offsetTop
    );
    let activeItem = sectionsInPageOrder[0];

    sectionsInPageOrder.forEach((item) => {
      if (item.section.offsetTop <= scrollMarker) {
        activeItem = item;
      }
    });

    if (pageBottom) {
      activeItem = sectionsInPageOrder[sectionsInPageOrder.length - 1];
    }

    navigableSections.forEach((item) => {
      const isActive = item === activeItem;
      item.link.classList.toggle("is-active", isActive);
      if (isActive) {
        item.link.setAttribute("aria-current", "location");
      } else {
        item.link.removeAttribute("aria-current");
      }
    });
  };

  let pageStateFrame = 0;
  const scheduleNavigationUpdate = () => {
    if (pageStateFrame) return;
    pageStateFrame = window.requestAnimationFrame(() => {
      pageStateFrame = 0;
      updateNavigationState();
    });
  };

  updateNavigationState();
  window.addEventListener("scroll", scheduleNavigationUpdate, { passive: true });
  window.addEventListener("resize", scheduleNavigationUpdate, { passive: true });

  const revealElements = Array.from(document.querySelectorAll(".reveal"));
  let revealObserver = null;

  const revealEverything = () => {
    revealObserver?.disconnect();
    revealObserver = null;
    revealElements.forEach((element) => {
      element.classList.remove("is-reveal-pending");
      element.classList.add("is-visible");
    });
  };

  if (!window.location.hash && !reducedMotionQuery.matches && "IntersectionObserver" in window) {
    revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8%", threshold: 0.08 }
    );

    revealElements.forEach((element) => {
      element.classList.add("is-reveal-pending");
      revealObserver.observe(element);
    });
  } else {
    revealEverything();
  }

  const handleReducedMotionChange = (event) => {
    if (event.matches) revealEverything();
  };

  if (typeof reducedMotionQuery.addEventListener === "function") {
    reducedMotionQuery.addEventListener("change", handleReducedMotionChange);
  } else {
    reducedMotionQuery.addListener(handleReducedMotionChange);
  }

  const videoDialog = document.getElementById("videoDialog");
  const videoDialogTitle = document.getElementById("videoDialogTitle");
  const videoDialogClose = document.getElementById("videoDialogClose");
  const projectVideo = document.getElementById("projectVideo");
  const supportsVideoDialog = Boolean(
    videoDialog
    && projectVideo
    && videoDialogClose
    && typeof videoDialog.showModal === "function"
  );
  let videoDialogOpener = null;

  const releaseProjectVideo = () => {
    if (!projectVideo) return;
    projectVideo.pause();
    if (projectVideo.readyState > 0) {
      try {
        projectVideo.currentTime = 0;
      } catch {
        // Some browsers restrict seeking while media metadata is unavailable.
      }
    }
    projectVideo.removeAttribute("src");
    projectVideo.removeAttribute("poster");
    projectVideo.setAttribute("aria-label", "Selected project video");
    projectVideo.load();
  };

  const closeVideoDialog = () => {
    if (!videoDialog) return;
    if (videoDialog.open) {
      videoDialog.close();
    } else {
      releaseProjectVideo();
      document.body.classList.remove("dialog-open");
    }
  };

  const openVideoDialog = (projectLink) => {
    if (!supportsVideoDialog || !videoDialog || !projectVideo || !videoDialogClose) return;

    const videoPath = projectLink.getAttribute("href");
    const videoTitle = projectLink.dataset.videoTitle || "Project preview";
    const posterPath = projectLink.dataset.videoPoster;
    if (!videoPath) return;

    if (videoDialog.open) {
      releaseProjectVideo();
      videoDialog.close();
    }

    videoDialogOpener = projectLink;
    if (videoDialogTitle) videoDialogTitle.textContent = videoTitle;
    projectVideo.setAttribute("aria-label", `${videoTitle} video`);
    if (posterPath) projectVideo.setAttribute("poster", posterPath);
    projectVideo.setAttribute("src", videoPath);
    projectVideo.load();

    setMenuOpen(false);
    document.body.classList.add("dialog-open");
    videoDialog.showModal();
    videoDialogClose.focus({ preventScroll: true });
  };

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const projectLink = event.target.closest(".watch-project");
    if (!projectLink || !supportsVideoDialog) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;

    event.preventDefault();
    openVideoDialog(projectLink);
  });

  if (supportsVideoDialog && videoDialog && videoDialogClose) {
    videoDialogClose.addEventListener("click", closeVideoDialog);

    videoDialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeVideoDialog();
    });

    videoDialog.addEventListener("click", (event) => {
      if (event.target === videoDialog) closeVideoDialog();
    });

    videoDialog.addEventListener("close", () => {
      releaseProjectVideo();
      document.body.classList.remove("dialog-open");
      if (videoDialogTitle) videoDialogTitle.textContent = "Project preview";

      const openerToRestore = videoDialogOpener;
      videoDialogOpener = null;
      if (openerToRestore?.isConnected) {
        window.setTimeout(() => openerToRestore.focus({ preventScroll: true }), 0);
      }
    });

  }

  document.addEventListener(
    "play",
    (event) => {
      if (!(event.target instanceof HTMLMediaElement)) return;
      document.querySelectorAll("video, audio").forEach((mediaElement) => {
        if (mediaElement !== event.target) mediaElement.pause();
      });
    },
    true
  );

  window.addEventListener("pagehide", () => projectVideo?.pause());
})();
