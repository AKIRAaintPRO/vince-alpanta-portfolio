(() => {
  "use strict";

  const doc = document;
  const root = doc.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const $ = (selector, scope = doc) => scope.querySelector(selector);
  const $$ = (selector, scope = doc) => [...scope.querySelectorAll(selector)];

  root.classList.replace("no-js", "js");

  // Keep the rendered, keyboard, and transition order aligned with the rail.
  const main = $("main");
  const orderedSections = [
    $("#about", main),
    $("#work", main),
    $("#expect", main),
    $("#services", main),
    $("#process", main),
    $("#faq", main),
    $("#contact", main)
  ];
  orderedSections.filter(Boolean).forEach((section) => main?.append(section));

  const gsapEngine = window.gsap;
  const FlipPlugin = window.Flip;
  const ScrollTriggerPlugin = window.ScrollTrigger;
  const canUseFlip = Boolean(gsapEngine && FlipPlugin);
  const canUseWorkScroll = Boolean(gsapEngine && ScrollTriggerPlugin);
  if (gsapEngine) {
    const motionPlugins = [FlipPlugin, ScrollTriggerPlugin].filter(Boolean);
    if (motionPlugins.length) gsapEngine.registerPlugin(...motionPlugins);
  }

  const year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());

  const scrollProgress = $("#scrollProgress");
  const hero = $(".hero");
  const heroPortrait = $("#heroPortrait");
  const heroPortraitImage = $("img", heroPortrait);
  let blurredPortraitSource = null;
  const heroName = $(".hero-name", hero);
  const heroHeadline = $("#hero-title");
  const aboutSection = $("#about");
  const aboutTitle = $("#about-title");
  const aboutShell = $(".shell", aboutSection);
  const aboutRevealTargets = $$('[data-transition-reveal]', aboutSection);
  const aboutHeaderReveal = aboutRevealTargets[0] || null;
  const aboutDetailReveals = aboutRevealTargets.slice(1);
  const aboutPortraitReveal = $(".about-portrait[data-transition-reveal]", aboutSection);
  const aboutCopyReveals = aboutDetailReveals.filter((element) => element !== aboutPortraitReveal);
  const desktopRail = $("#desktopRail");
  const railBrand = $(".rail-brand", desktopRail);
  const railBrandMark = $("strong", railBrand);
  const railShells = $$(".rail-card, .rail-email", desktopRail);
  const railShellSequence = [
    $(".rail-menu", desktopRail),
    $(".rail-stats", desktopRail),
    $(".rail-intro", desktopRail),
    $(".rail-tools", desktopRail),
    $(".rail-email", desktopRail)
  ].filter(Boolean);
  const railIcons = $$(".rail-menu i", desktopRail);
  const railLinks = $$(".rail-menu a");
  const heroNavSeparators = $$(".hero-nav-group > i", hero);
  const routeLinks = $$(".hero-nav a, .rail-menu a, .mobile-menu > a:not(.button)");
  const trackedSections = railLinks.map((link) => $(link.getAttribute("href"))).filter(Boolean);
  const flipElements = $$(".flip-source, .flip-target");
  const flipSources = $$(".flip-source");
  const flipTargets = $$(".flip-target");
  const isPrimaryFlip = (element) => /^(stat-|cta$|nav-(home|about|work|expect|services|faq)$)/.test(element.dataset.flipId || "");
  const flipMotionSources = flipSources.filter(isPrimaryFlip);
  const flipMotionTargets = flipTargets.filter(isPrimaryFlip);
  const isStatFlip = (element) => (element.dataset.flipId || "").startsWith("stat-");
  const isCtaFlip = (element) => element.dataset.flipId === "cta";
  const statFlipSources = flipMotionSources.filter(isStatFlip);
  const statFlipTargets = flipMotionTargets.filter(isStatFlip);
  const ctaFlipSource = flipMotionSources.find(isCtaFlip);
  const ctaFlipTarget = flipMotionTargets.find(isCtaFlip);
  const standardFlipSources = flipMotionSources.filter((element) => !isStatFlip(element) && !isCtaFlip(element));
  const standardFlipTargets = flipMotionTargets.filter((element) => !isStatFlip(element) && !isCtaFlip(element));
  const railSurfaceParts = $$(".rail-intro, .rail-stats, .rail-menu, .rail-tools, .rail-email");
  const heroSupportingElements = $$(".hero-identity, .hero-description, .hero-scroll");
  const heroQualitiesCard = $(".hero-card-qualities", hero);
  const heroAboutAction = $(".hero-actions > a[href='#about']", hero);
  const heroTravelGlass = $$(".hero-card-project .hero-card-glass, .hero-card-workflow .hero-card-glass");
  const workShowcase = $("#work");
  const workScene = $(".work-shell", workShowcase);
  const projectTrack = $(".project-grid", workShowcase);
  let workTravel = 0;
  let workScrollDistance = 0;
  let workMotionDistance = 0;
  let workStartHold = 0;
  let workEndHold = 0;
  let workTween = null;
  let workCardTweens = [];
  let workRefreshFrame = 0;
  let workSetupFrame = 0;
  let scrollFrame = 0;
  let transitionControllerReady = false;
  let lastScrollY = window.scrollY;
  let scrollGestureDirection = 0;
  let scrollGestureUntil = 0;
  let lastTouchY = null;
  let wheelIntent = 0;
  let wheelIntentTimer = 0;

  const initialHash = window.location.hash || "#home";
  const initialView = initialHash === "#home" ? "home" : "about";
  const transitionState = {
    view: initialView,
    targetView: null,
    transitioning: false,
    timeline: null,
    scrubFrame: 0,
    scrubVelocity: 0,
    scrubLastTime: 0,
    scrubbed: false,
    scrubTarget: 0,
    scrubTimelineReversed: false,
    originView: initialView,
    portraitClone: null,
    nameClone: null,
    headlineClone: null,
    separatorClones: [],
    navClones: [],
    statClones: [],
    ctaClone: null,
    aboutActionClone: null,
    aboutY: 0,
    booting: true,
    historyMode: "none",
    moveFocus: false
  };

  const setActiveNavigation = (hash) => {
    const normalized = hash || "#home";
    routeLinks.forEach((link) => {
      const active = link.hash === normalized;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  };

  const setInert = (element, inert) => {
    if (element && "inert" in element) element.inert = inert;
  };

  const syncStableAccessibility = () => {
    const desktopAbout = transitionState.view === "about" && window.innerWidth > 1100;
    const hideHero = transitionState.view === "about";
    setInert(hero, hideHero);
    hero?.setAttribute("aria-hidden", String(hideHero));
    setInert(desktopRail, !desktopAbout);
    desktopRail?.setAttribute("aria-hidden", String(!desktopAbout));
    setInert(aboutSection, false);
  };

  const applyViewMode = (view, { stable = true, keepRail = false } = {}) => {
    transitionState.view = view;
    doc.body.dataset.pageState = view;
    doc.body.classList.toggle("is-about-mode", view === "about");
    const showRail = window.innerWidth > 1100 && (view === "about" || keepRail);
    doc.body.classList.toggle("rail-visible", showRail);
    if (stable) syncStableAccessibility();
  };

  applyViewMode(initialView);
  setActiveNavigation(initialHash);
  // Direct links enter the post-hero route without playing the Home -> About
  // timeline. Reveal its opening content immediately so a refresh at #about
  // never depends on IntersectionObserver timing or image/font loading.
  if (initialView === "about") {
    aboutRevealTargets.forEach((element) => element.classList.add("is-visible"));
  }
  root.classList.add("motion-ready");

  // A direct #about visit must be aligned before the first painted frame. The
  // later route pass repeats this after layout settles, but this synchronous
  // pass prevents the hidden Home hero from briefly occupying the viewport.
  if (initialView === "about" && aboutSection) {
    const previousBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, aboutSection.getBoundingClientRect().top + window.scrollY);
    root.style.scrollBehavior = previousBehavior;
  }

  const measureWorkShowcase = () => {
    const desktopMotion = Boolean(
      workShowcase && workScene && projectTrack && window.innerWidth > 1100
    );

    if (!desktopMotion) {
      if (workSetupFrame) {
        window.cancelAnimationFrame(workSetupFrame);
        workSetupFrame = 0;
      }
      workTween?.scrollTrigger?.kill();
      workTween?.kill();
      workTween = null;
      workCardTweens.forEach((tween) => {
        tween?.scrollTrigger?.kill();
        tween?.kill?.();
      });
      workCardTweens = [];
      if (gsapEngine) {
        gsapEngine.set($$(".project", projectTrack || doc), { clearProps: "transform,opacity" });
      }
      workTravel = 0;
      workScrollDistance = 0;
      workMotionDistance = 0;
      workStartHold = 0;
      workEndHold = 0;
      workShowcase?.style.removeProperty("--work-scroll-height");
      workShowcase?.style.removeProperty("--work-progress");
      projectTrack?.style.removeProperty("--project-travel");
      return;
    }

    workTravel = Math.max(0, projectTrack.scrollWidth - workScene.clientWidth);
    // The reference uses roughly one vertical scroll pixel per horizontal
    // track pixel. Its 400vh section contains nine cards; calculate the same
    // pacing from this shorter three-card track instead of making it drag.
    workStartHold = 0;
    workEndHold = 0;
    workMotionDistance = Math.max(window.innerHeight * 1.25, workTravel * 1.05);
    workScrollDistance = workMotionDistance;
    workShowcase.style.setProperty("--work-scroll-height", `${window.innerHeight + workScrollDistance}px`);

    if (workTween?.scrollTrigger && !workRefreshFrame) {
      workRefreshFrame = window.requestAnimationFrame(() => {
        workRefreshFrame = 0;
        workTween?.scrollTrigger?.refresh();
      });
    } else if (canUseWorkScroll && !reduceMotion.matches && !workTween && !workSetupFrame) {
      workSetupFrame = window.requestAnimationFrame(() => {
        workSetupFrame = 0;
        if (!workTween && window.innerWidth > 1100) setupWorkShowcase();
      });
    }
  };

  const setupWorkShowcase = () => {
    if (
      !canUseWorkScroll || reduceMotion.matches || !workShowcase || !workScene ||
      !projectTrack || window.innerWidth <= 1100
    ) return;

    workTween?.scrollTrigger?.kill();
    workTween?.kill();
    workCardTweens.forEach((tween) => {
      tween?.scrollTrigger?.kill();
      tween?.kill?.();
    });
    workCardTweens = [];

    gsapEngine.set(projectTrack, { x: 0 });
    workTween = gsapEngine.to(projectTrack, {
      x: () => {
        workTravel = Math.max(0, projectTrack.scrollWidth - workScene.clientWidth);
        return -workTravel;
      },
      ease: "none",
      scrollTrigger: {
        trigger: workShowcase,
        start: "top top",
        end: () => `+=${Math.max(1, workShowcase.offsetHeight - window.innerHeight)}`,
        scrub: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          workShowcase.style.setProperty("--work-progress", self.progress.toFixed(4));
        }
      }
    });

    const cards = $$(".project", projectTrack);
    gsapEngine.set(cards, {
      yPercent: 10,
      scale: 0.6,
      opacity: 0,
      transformOrigin: "50% 50%"
    });

    const sceneRect = workScene.getBoundingClientRect();
    const initiallyVisible = [];
    const enteringCards = [];
    cards.forEach((card) => {
      if (card.getBoundingClientRect().left < sceneRect.right) initiallyVisible.push(card);
      else enteringCards.push(card);
    });

    if (initiallyVisible.length) {
      const revealInitialCards = () => {
        gsapEngine.to(initiallyVisible, {
          yPercent: 0,
          scale: 1,
          opacity: 1,
          duration: 1.1,
          ease: "expo.out",
          stagger: 0.1,
          overwrite: "auto"
        });
      };
      const revealTrigger = ScrollTriggerPlugin.create({
        trigger: workShowcase,
        start: "top 80%",
        onEnter: revealInitialCards,
        onEnterBack: revealInitialCards
      });
      workCardTweens.push(revealTrigger);

      const workRect = workShowcase.getBoundingClientRect();
      if (workRect.top < window.innerHeight * 0.8 && workRect.bottom > 0) revealInitialCards();
    }

    enteringCards.forEach((card) => {
      const tween = gsapEngine.to(card, {
        yPercent: 0,
        scale: 1,
        opacity: 1,
        duration: 1.1,
        ease: "expo.out",
        scrollTrigger: {
          trigger: card,
          containerAnimation: workTween,
          start: "left right",
          toggleActions: "play none none none"
        }
      });
      workCardTweens.push(tween);
    });

    ScrollTriggerPlugin.refresh();
  };

  const updateScrollState = () => {
    scrollFrame = 0;
    const currentScrollY = window.scrollY;
    const movingDown = currentScrollY > lastScrollY + 1;
    const movingUp = currentScrollY < lastScrollY - 1;
    lastScrollY = currentScrollY;
    const available = doc.documentElement.scrollHeight - window.innerHeight;
    const progress = available > 0 ? Math.min(1, currentScrollY / available) : 0;
    if (scrollProgress) scrollProgress.style.transform = `scaleX(${progress})`;

    if (transitionState.transitioning) return;

    if (hero && !transitionState.booting) {
      const enterAt = hero.offsetHeight * 0.46;
      const leaveAt = hero.offsetHeight * 0.24;
      const usesManualRouteScrub = window.innerWidth > 1100 && canUseFlip && !reduceMotion.matches;
      const aboutStart = aboutSection
        ? aboutSection.getBoundingClientRect().top + currentScrollY
        : hero.offsetHeight;
      const gestureIsFresh = performance.now() < scrollGestureUntil;

      if (transitionControllerReady && gestureIsFresh) {
        if (
          transitionState.view === "home" &&
          scrollGestureDirection > 0 && movingDown && currentScrollY > enterAt
        ) {
          transitionTo("about", { historyMode: "replace", moveFocus: false });
          return;
        }

        if (
          transitionState.view === "about" &&
          !usesManualRouteScrub &&
          scrollGestureDirection < 0 && movingUp &&
          currentScrollY <= aboutStart + Math.max(32, window.innerHeight * 0.08)
        ) {
          transitionTo("home", { historyMode: "replace", moveFocus: false });
          return;
        }
      }

      if (transitionControllerReady) {
        if (transitionState.view === "home" && currentScrollY > enterAt) {
          transitionTo("about", { historyMode: "replace", moveFocus: false });
          return;
        }
        if (transitionState.view === "about" && !usesManualRouteScrub && currentScrollY < leaveAt) {
          transitionTo("home", { historyMode: "replace", moveFocus: false });
          return;
        }
      }
    }

    const railVisible = Boolean(
      hero && window.innerWidth > 1100 &&
      (transitionState.view === "about" || window.scrollY > hero.offsetHeight * 0.46)
    );
    doc.body.classList.toggle("rail-visible", railVisible);
    desktopRail?.setAttribute("aria-hidden", String(!railVisible));
    if (desktopRail && "inert" in desktopRail) desktopRail.inert = !railVisible;

    if (railVisible) {
      const marker = window.innerHeight * 0.42;
      let active = trackedSections[0];
      let activeTop = -Infinity;
      trackedSections.forEach((section) => {
        const top = section.getBoundingClientRect().top;
        if (top <= marker && top > activeTop) {
          active = section;
          activeTop = top;
        }
      });
      setActiveNavigation(`#${active?.id || "home"}`);

      const surface = doc.elementsFromPoint(Math.min(320, window.innerWidth - 1), marker)
        .map((element) => element.closest(".section, .hero, .footer"))
        .find((element) => element && !element.closest(".desktop-rail"));
      desktopRail?.classList.toggle(
        "rail-on-dark",
        Boolean(surface?.matches(".work, .expect, .contact, .footer"))
      );
      desktopRail?.classList.toggle("rail-project-mode", Boolean(surface?.matches(".work")));
    }

    if (heroPortrait && hero && transitionState.view === "home" && !reduceMotion.matches) {
      const heroBottom = hero.offsetTop + hero.offsetHeight;
      const heroProgress = Math.min(1, window.scrollY / hero.offsetHeight);
      const shift = window.scrollY < heroBottom ? heroProgress * 48 : 48;
      heroPortrait.style.setProperty("--portrait-shift", `${shift}px`);
      hero.style.setProperty("--hero-scroll", String(heroProgress));
    }

    if (workShowcase && projectTrack && !workTween) {
      if (workScrollDistance > 0 && workMotionDistance > 0) {
        const workTop = workShowcase.getBoundingClientRect().top;
        const distanceInsideScene = Math.max(0, -workTop);
        const workProgress = Math.max(
          0,
          Math.min(1, (distanceInsideScene - workStartHold) / workMotionDistance)
        );
        projectTrack.style.setProperty("--project-travel", `${(-workTravel * workProgress).toFixed(2)}px`);
        workShowcase.style.setProperty("--work-progress", workProgress.toFixed(4));
      }
    }
  };

  const scheduleScrollState = () => {
    if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateScrollState);
  };

  const markScrollGesture = (direction, { scrub = false } = {}) => {
    if (!direction) return;
    scrollGestureDirection = direction > 0 ? 1 : -1;
    scrollGestureUntil = performance.now() + 260;

    // Start the cinematic route on the gesture itself. Waiting for the page
    // to travel almost half a viewport made trackpads reveal the next section
    // before the hero pieces began moving.
    if (transitionControllerReady && !transitionState.booting && !transitionState.transitioning) {
      if (transitionState.view === "home" && scrollGestureDirection > 0) {
        transitionTo("about", { historyMode: "replace", moveFocus: false, scrub });
        if (scrub) scrubActiveTransition(direction);
        return;
      }

      if (transitionState.view === "about" && scrollGestureDirection < 0) {
        const aboutStart = aboutSection
          ? aboutSection.getBoundingClientRect().top + window.scrollY
          : hero?.offsetHeight || 0;
        if (window.scrollY <= aboutStart + Math.max(96, window.innerHeight * 0.22)) {
          // The dedicated return timeline keeps every shared element on its
          // own measured path, so the user can scrub it manually without the
          // menu collapsing into the left highlight card.
          transitionTo("home", { historyMode: "replace", moveFocus: false, scrub });
          if (scrub) scrubActiveTransition(direction);
          return;
        }
      }
    }

    scheduleScrollState();
  };

  measureWorkShowcase();
  setupWorkShowcase();
  updateScrollState();
  window.addEventListener("wheel", (event) => {
    const deltaPixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);

    if (transitionState.transitioning) {
      event.preventDefault();
      if (transitionState.scrubbed) scrubActiveTransition(deltaPixels);
      return;
    }

    const aboutStart = aboutSection
      ? aboutSection.getBoundingClientRect().top + window.scrollY
      : hero?.offsetHeight || 0;
    const atHomeGateway = transitionState.view === "home" && deltaPixels > 0;
    const atAboutGateway = transitionState.view === "about" && deltaPixels < 0 &&
      window.scrollY <= aboutStart + Math.max(96, window.innerHeight * 0.22);

    if (!atHomeGateway && !atAboutGateway) {
      markScrollGesture(deltaPixels);
      return;
    }

    // Stop native scrolling before the route locks. A small intent threshold
    // filters trackpad noise without creating a noticeable delay.
    event.preventDefault();
    const direction = Math.sign(deltaPixels);
    if (Math.sign(wheelIntent) !== direction) wheelIntent = 0;
    wheelIntent += deltaPixels;
    window.clearTimeout(wheelIntentTimer);
    wheelIntentTimer = window.setTimeout(() => { wheelIntent = 0; }, 140);
    if (Math.abs(wheelIntent) < 20) return;

    const committedIntent = wheelIntent;
    wheelIntent = 0;
    markScrollGesture(committedIntent, { scrub: window.innerWidth > 1100 && canUseFlip && !reduceMotion.matches });
  }, { passive: false });
  window.addEventListener("touchstart", (event) => {
    lastTouchY = event.touches[0]?.clientY ?? null;
  }, { passive: true });
  window.addEventListener("touchmove", (event) => {
    const currentTouchY = event.touches[0]?.clientY;
    if (lastTouchY !== null && currentTouchY !== undefined) {
      const direction = lastTouchY - currentTouchY;
      const aboutStart = aboutSection
        ? aboutSection.getBoundingClientRect().top + window.scrollY
        : hero?.offsetHeight || 0;
      const atHomeGateway = transitionState.view === "home" && direction > 0;
      const atAboutGateway = transitionState.view === "about" && direction < 0 &&
        window.scrollY <= aboutStart + Math.max(96, window.innerHeight * 0.22);

      if (transitionState.transitioning || atHomeGateway || atAboutGateway) event.preventDefault();
      if (!transitionState.transitioning && (!(atHomeGateway || atAboutGateway) || Math.abs(direction) >= 10)) {
        markScrollGesture(direction);
      }
    }
    lastTouchY = currentTouchY ?? null;
  }, { passive: false });
  window.addEventListener("touchend", () => { lastTouchY = null; }, { passive: true });
  window.addEventListener("scroll", scheduleScrollState, { passive: true });
  window.addEventListener("resize", () => {
    measureWorkShowcase();
    scheduleScrollState();
  }, { passive: true });
  window.addEventListener("load", () => {
    measureWorkShowcase();
    scheduleScrollState();
  }, { once: true });
  doc.fonts?.ready.then(() => {
    measureWorkShowcase();
    scheduleScrollState();
  });

  const menuToggle = $("#menuToggle");
  const mobileMenu = $("#mobileMenu");
  const menuLinks = mobileMenu ? $$("a", mobileMenu) : [];
  let menuReturnFocus = null;

  const isMobileNavigation = () => window.innerWidth <= 1100;

  const setMenu = (open, restoreFocus = true) => {
    if (!menuToggle || !mobileMenu) return;
    const active = Boolean(open && isMobileNavigation());
    mobileMenu.classList.toggle("open", active);
    menuToggle.setAttribute("aria-expanded", String(active));
    const label = $(".sr-only", menuToggle);
    if (label) label.textContent = active ? "Close menu" : "Open menu";
    doc.body.classList.toggle("menu-open", active);

    if ("inert" in mobileMenu) mobileMenu.inert = !active && isMobileNavigation();

    if (active) {
      menuReturnFocus = doc.activeElement;
      menuLinks[0]?.focus();
    } else if (restoreFocus && menuReturnFocus instanceof HTMLElement) {
      menuReturnFocus.focus({ preventScroll: true });
      menuReturnFocus = null;
    }
  };

  menuToggle?.addEventListener("click", () => {
    setMenu(menuToggle.getAttribute("aria-expanded") !== "true");
  });

  menuLinks.forEach((link) => link.addEventListener("click", () => setMenu(false, false)));

  const syncNavigationMode = () => {
    if (!mobileMenu || !menuToggle) return;
    if (!isMobileNavigation()) {
      mobileMenu.classList.remove("open");
      mobileMenu.inert = false;
      menuToggle.setAttribute("aria-expanded", "false");
      doc.body.classList.remove("menu-open");
    } else if (!mobileMenu.classList.contains("open")) {
      mobileMenu.inert = true;
    }
  };

  syncNavigationMode();
  window.addEventListener("resize", syncNavigationMode, { passive: true });

  const railOnlyElements = $$(".rail-intro > p, .rail-menu a[href='#process'], .rail-tools, .rail-email");
  const simpleHeroElements = $$(".hero-name, .hero-center, .hero-cards, .hero-identity, .hero-description");
  let scrollLock = null;
  const resetInteractiveTransforms = () => {
    if (gsapEngine) gsapEngine.set($$(".magnetic"), { clearProps: "transform" });
    $$(".tilt-card").forEach((card) => {
      card.style.setProperty("--tilt-x", "0deg");
      card.style.setProperty("--tilt-y", "0deg");
    });
  };

  const lockScroll = () => {
    if (scrollLock) return;
    scrollLock = {
      rootOverflow: root.style.overflow,
      bodyOverflow: doc.body.style.overflow,
      rootBehavior: root.style.scrollBehavior
    };
    root.classList.add("is-scroll-locked");
    root.style.overflow = "hidden";
    root.style.scrollBehavior = "auto";
    doc.body.style.overflow = "hidden";
  };

  const unlockScrollAt = (top) => {
    const destination = Math.max(0, Math.round(top || 0));
    if (!scrollLock) {
      window.scrollTo(0, destination);
      return;
    }

    root.classList.remove("is-scroll-locked");
    root.style.overflow = scrollLock.rootOverflow;
    doc.body.style.overflow = scrollLock.bodyOverflow;
    window.scrollTo(0, destination);
    root.style.scrollBehavior = scrollLock.rootBehavior;
    scrollLock = null;
  };

  const buildBlurredPortraitSource = () => {
    if (blurredPortraitSource || !heroPortraitImage?.complete || !heroPortraitImage.naturalWidth) {
      return blurredPortraitSource;
    }

    const canvas = doc.createElement("canvas");
    const renderScale = Math.min(0.28, 360 / heroPortraitImage.naturalWidth);
    canvas.width = Math.max(1, Math.round(heroPortraitImage.naturalWidth * renderScale));
    canvas.height = Math.max(1, Math.round(heroPortraitImage.naturalHeight * renderScale));
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return null;

    // Bake the softness once at low resolution. Animating this bitmap uses
    // only transform/opacity, unlike a live CSS blur on the 1086x1448 PNG.
    const inset = Math.max(3, Math.round(canvas.width * 0.018));
    context.filter = "blur(5px)";
    context.drawImage(
      heroPortraitImage,
      inset,
      inset,
      canvas.width - inset * 2,
      canvas.height - inset * 2
    );
    blurredPortraitSource = canvas;
    return blurredPortraitSource;
  };

  const queueBlurredPortrait = () => {
    const prepare = () => buildBlurredPortraitSource();
    if ("requestIdleCallback" in window) window.requestIdleCallback(prepare, { timeout: 900 });
    else window.setTimeout(prepare, 120);
  };

  if (heroPortraitImage?.complete) queueBlurredPortrait();
  else heroPortraitImage?.addEventListener("load", queueBlurredPortrait, { once: true });

  const createPortraitClone = () => {
    if (!heroPortraitImage) return null;
    const rect = heroPortraitImage.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    // Start from the exact sharp portrait. The timeline animates the real
    // blur radius so the effect builds continuously with scroll progress.
    const clone = doc.createElement("img");
    clone.className = "portrait-transition-clone";
    clone.src = heroPortraitImage.currentSrc || heroPortraitImage.src;
    clone.alt = "";
    clone.setAttribute("aria-hidden", "true");
    Object.assign(clone.style, {
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`
    });
    doc.body.append(clone);
    transitionState.portraitClone = clone;
    return clone;
  };

  const removePortraitClone = () => {
    transitionState.portraitClone?.remove();
    transitionState.portraitClone = null;
  };

  const createNameClone = () => {
    if (!heroName) return null;
    const sourceRect = heroName.getBoundingClientRect();
    if (!sourceRect.width || !sourceRect.height) return null;

    const clone = doc.createElement("div");
    clone.className = "name-transition-clone";
    clone.textContent = heroName.textContent;
    clone.setAttribute("aria-hidden", "true");
    const styles = window.getComputedStyle(heroName);
    Object.assign(clone.style, {
      top: `${sourceRect.top}px`,
      left: `${sourceRect.left}px`,
      fontSize: styles.fontSize,
      fontWeight: styles.fontWeight
    });
    doc.body.append(clone);

    const naturalRect = clone.getBoundingClientRect();
    const metrics = {
      element: clone,
      sourceRect,
      naturalWidth: naturalRect.width,
      naturalHeight: naturalRect.height,
      sourceScaleX: sourceRect.width / naturalRect.width,
      sourceScaleY: sourceRect.height / naturalRect.height
    };
    transitionState.nameClone = clone;
    return metrics;
  };

  const removeNameClone = () => {
    transitionState.nameClone?.remove();
    transitionState.nameClone = null;
  };

  const createHeadlineClone = () => {
    if (!heroHeadline) return null;
    const rect = heroHeadline.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    const clone = heroHeadline.cloneNode(true);
    clone.removeAttribute("id");
    clone.removeAttribute("tabindex");
    clone.className = "headline-transition-clone";
    clone.setAttribute("aria-hidden", "true");
    const styles = window.getComputedStyle(heroHeadline);
    Object.assign(clone.style, {
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      color: styles.color,
      fontFamily: styles.fontFamily,
      fontSize: styles.fontSize,
      fontWeight: styles.fontWeight,
      lineHeight: styles.lineHeight,
      letterSpacing: styles.letterSpacing,
      textAlign: styles.textAlign
    });
    doc.body.append(clone);
    transitionState.headlineClone = clone;
    return { element: clone, sourceRect: rect };
  };

  const removeHeadlineClone = () => {
    transitionState.headlineClone?.remove();
    transitionState.headlineClone = null;
  };

  const createSeparatorClones = () => {
    transitionState.separatorClones.forEach((clone) => clone.remove());
    transitionState.separatorClones = heroNavSeparators.map((separator) => {
      const rect = separator.getBoundingClientRect();
      const clone = doc.createElement("i");
      clone.className = "nav-separator-transition";
      clone.setAttribute("aria-hidden", "true");
      Object.assign(clone.style, {
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`
      });
      doc.body.append(clone);
      return clone;
    });
    return transitionState.separatorClones;
  };

  const removeSeparatorClones = () => {
    transitionState.separatorClones.forEach((clone) => clone.remove());
    transitionState.separatorClones = [];
  };

  const createNavClones = (sources) => {
    transitionState.navClones.forEach(({ element }) => element.remove());
    transitionState.navClones = sources.map((source) => {
      const rect = source.getBoundingClientRect();
      const styles = window.getComputedStyle(source);
      const element = doc.createElement("span");
      element.className = "nav-text-transition-clone";
      element.textContent = source.textContent.trim();
      element.setAttribute("aria-hidden", "true");
      Object.assign(element.style, {
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        color: styles.color,
        fontFamily: styles.fontFamily,
        fontSize: styles.fontSize,
        fontWeight: styles.fontWeight,
        lineHeight: styles.lineHeight,
        letterSpacing: styles.letterSpacing,
        textTransform: styles.textTransform
      });
      doc.body.append(element);
      return { element, rect, id: source.dataset.flipId };
    });
    return transitionState.navClones;
  };

  const removeNavClones = () => {
    transitionState.navClones.forEach(({ element }) => element.remove());
    transitionState.navClones = [];
  };

  const addNavMorph = (timeline, clones, destinations, startAt) => {
    clones.forEach(({ element, rect, id }, index) => {
      const destination = destinations.find((target) => target.dataset.flipId === id);
      const destinationRect = destination?.getBoundingClientRect();
      if (!destination || !destinationRect?.width) return;
      const styles = window.getComputedStyle(destination);

      gsapEngine.set(destination, { autoAlpha: 0 });
      timeline
        .to(element, {
          x: destinationRect.left - rect.left,
          y: destinationRect.top - rect.top,
          color: styles.color,
          fontSize: styles.fontSize,
          fontWeight: styles.fontWeight,
          lineHeight: styles.lineHeight,
          letterSpacing: styles.letterSpacing,
          duration: 1.32,
          ease: "power3.inOut"
        }, startAt + index * 0.008)
        .to(element, {
          autoAlpha: 0,
          duration: 0.12,
          ease: "power1.inOut"
        }, startAt + 1.28)
        .to(destination, {
          autoAlpha: 1,
          duration: 0.12,
          ease: "power1.inOut"
        }, startAt + 1.28);
    });
  };

  const copyVisualStyles = (source, clone) => {
    const styles = window.getComputedStyle(source);
    [
      "display", "color", "fontFamily", "fontSize", "fontWeight", "fontStyle",
      "lineHeight", "letterSpacing", "textTransform", "textAlign", "fill",
      "alignItems", "justifyContent", "alignContent", "justifyItems", "placeItems",
      "placeContent", "gridTemplateColumns", "gridTemplateRows", "flexDirection",
      "gap", "background", "backgroundColor", "border", "borderRadius", "padding",
      "margin", "whiteSpace", "boxShadow", "minWidth"
    ].forEach((property) => { clone.style[property] = styles[property]; });
    [...source.children].forEach((child, index) => {
      if (clone.children[index]) copyVisualStyles(child, clone.children[index]);
    });
  };

  const createStatClones = (sources) => {
    transitionState.statClones.forEach(({ element }) => element.remove());
    transitionState.statClones = sources.map((source) => {
      const rect = source.getBoundingClientRect();
      const visual = source.cloneNode(true);
      visual.classList.remove("flip-source", "flip-target");
      visual.removeAttribute("data-flip-id");
      copyVisualStyles(source, visual);

      const element = doc.createElement("div");
      element.className = "stat-transition-clone";
      element.setAttribute("aria-hidden", "true");
      Object.assign(element.style, {
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`
      });
      element.append(visual);
      doc.body.append(element);
      return { element, rect, id: source.dataset.flipId };
    });
    return transitionState.statClones;
  };

  const removeStatClones = () => {
    transitionState.statClones.forEach(({ element }) => element.remove());
    transitionState.statClones = [];
  };

  const addStatMorph = (timeline, clones, destinations, startAt) => {
    clones.forEach(({ element, rect, id }, index) => {
      const destination = destinations.find((target) => target.dataset.flipId === id);
      const destinationRect = destination?.getBoundingClientRect();
      if (!destination || !destinationRect?.width) return;

      const scale = Math.min(
        destinationRect.width / Math.max(1, rect.width),
        destinationRect.height / Math.max(1, rect.height)
      );
      gsapEngine.set(destination, { autoAlpha: 0 });
      timeline
        .to(element, {
          x: destinationRect.left - rect.left,
          y: destinationRect.top - rect.top,
          duration: 1.32,
          ease: "power3.inOut"
        }, startAt)
        .to(element, {
          scale: Math.max(0.42, Math.min(1.35, scale)),
          duration: 0.6,
          ease: "power2.inOut"
        }, startAt + 0.72)
        .to(element, { autoAlpha: 0, duration: 0.14, ease: "power1.inOut" }, startAt + 1.27)
        .to(destination, {
          autoAlpha: 1,
          duration: 0.14,
          ease: "power1.inOut"
        }, startAt + 1.27 + index * 0.012);
    });
  };

  const createCtaClone = (source) => {
    transitionState.ctaClone?.element.remove();
    if (!source) return null;
    const rect = source.getBoundingClientRect();
    const visual = source.cloneNode(true);
    visual.classList.remove("flip-source", "flip-target", "magnetic");
    visual.removeAttribute("data-flip-id");
    copyVisualStyles(source, visual);

    const element = doc.createElement("div");
    element.className = "cta-transition-clone";
    element.setAttribute("aria-hidden", "true");
    Object.assign(element.style, {
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`
    });
    element.append(visual);
    doc.body.append(element);
    transitionState.ctaClone = { element, rect };
    return transitionState.ctaClone;
  };

  const removeCtaClone = () => {
    transitionState.ctaClone?.element.remove();
    transitionState.ctaClone = null;
  };

  const createAboutActionClone = (source) => {
    transitionState.aboutActionClone?.remove();
    if (!source) return null;
    const rect = source.getBoundingClientRect();
    const visual = source.cloneNode(true);
    visual.classList.remove("magnetic");
    copyVisualStyles(source, visual);

    const element = doc.createElement("div");
    element.className = "about-action-transition-clone";
    element.setAttribute("aria-hidden", "true");
    Object.assign(element.style, {
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`
    });
    element.append(visual);
    doc.body.append(element);
    transitionState.aboutActionClone = element;
    return element;
  };

  const removeAboutActionClone = () => {
    transitionState.aboutActionClone?.remove();
    transitionState.aboutActionClone = null;
  };

  const addCtaMorph = (timeline, clone, destination, startAt) => {
    const destinationRect = destination?.getBoundingClientRect();
    if (!clone || !destination || !destinationRect?.width) return;
    gsapEngine.set(destination, { autoAlpha: 0 });
    timeline
      .to(clone.element, {
        x: destinationRect.left - clone.rect.left,
        y: destinationRect.top - clone.rect.top,
        duration: 1.32,
        ease: "power3.inOut"
      }, startAt)
      .to(clone.element, {
        width: destinationRect.width,
        height: destinationRect.height,
        duration: 0.68,
        ease: "power2.inOut"
      }, startAt + 0.52)
      .to(clone.element, { autoAlpha: 0, duration: 0.14, ease: "power1.inOut" }, startAt + 1.27)
      .to(destination, { autoAlpha: 1, duration: 0.14, ease: "power1.inOut" }, startAt + 1.27);
  };

  const setTransitionAccessibility = () => {
    setInert(hero, true);
    hero?.setAttribute("aria-hidden", "true");
    setInert(desktopRail, true);
    desktopRail?.setAttribute("aria-hidden", "true");
    setInert(aboutSection, true);
  };

  const beginTransition = (targetView, { historyMode = "none", moveFocus = false } = {}) => {
    // The hero entrance animation is for the first page load only. Without
    // this guard it restarts when the FLIP sources become visible on return.
    root.classList.add("hero-intro-complete");
    transitionState.originView = transitionState.view;
    transitionState.targetView = targetView;
    transitionState.transitioning = true;
    transitionState.historyMode = historyMode;
    transitionState.moveFocus = moveFocus;
    transitionState.aboutY = aboutSection
      ? aboutSection.getBoundingClientRect().top + window.scrollY
      : 0;

    resetInteractiveTransforms();
    lockScroll();
    doc.body.classList.add("is-transitioning", `transition-to-${targetView}`);
    setTransitionAccessibility();
  };

  const clearMotionStyles = () => {
    if (!gsapEngine) return;
    gsapEngine.set([
      aboutSection,
      aboutShell,
      heroName,
      heroHeadline,
      heroPortraitImage,
      railBrand,
      ...aboutRevealTargets,
      ...heroSupportingElements,
      heroQualitiesCard,
      heroAboutAction,
      ...heroTravelGlass,
      ...railSurfaceParts,
      ...railIcons,
      ...railOnlyElements,
      ...simpleHeroElements,
      ...heroNavSeparators,
      ...flipElements
    ].filter(Boolean), {
      clearProps: "opacity,visibility,transform,transformOrigin,filter,clipPath,willChange,display,position,width,height,top,right,bottom,left,zIndex,backgroundColor,color,borderRadius"
    });
    desktopRail?.style.removeProperty("--rail-shell-progress");
    desktopRail?.style.removeProperty("--rail-row-progress");
    railShells.forEach((element) => element.style.removeProperty("--rail-shell-progress"));
  };

  const finishTransition = (view) => {
    const historyMode = transitionState.historyMode;
    const moveFocus = transitionState.moveFocus;
    const destination = view === "about" ? transitionState.aboutY : 0;
    const finalHash = view === "about" ? "#about" : "#home";

    if (transitionState.scrubFrame) window.cancelAnimationFrame(transitionState.scrubFrame);
    transitionState.scrubFrame = 0;
    transitionState.scrubVelocity = 0;
    transitionState.scrubLastTime = 0;
    transitionState.timeline = null;
    transitionState.booting = false;

    applyViewMode(view, { stable: false });
    if (view === "about") aboutRevealTargets.forEach((element) => element.classList.add("is-visible"));
    else aboutRevealTargets.forEach((element) => element.classList.remove("is-visible"));

    clearMotionStyles();
    removePortraitClone();
    removeNameClone();
    removeHeadlineClone();
    removeSeparatorClones();
    removeNavClones();
    removeStatClones();
    removeCtaClone();
    removeAboutActionClone();
    doc.body.classList.remove("is-transitioning", "transition-to-about", "transition-to-home");
    doc.body.style.removeProperty("--about-background-progress");
    unlockScrollAt(destination);
    syncStableAccessibility();
    setActiveNavigation(finalHash);

    transitionState.transitioning = false;
    transitionState.targetView = null;
    transitionState.originView = view;
    transitionState.scrubbed = false;
    transitionState.scrubTarget = 0;
    transitionState.scrubTimelineReversed = false;
    wheelIntent = 0;
    lastScrollY = destination;

    if (historyMode === "push" && window.location.hash !== finalHash) {
      window.history.pushState({ view }, "", finalHash);
    } else if (historyMode === "replace" && window.location.hash !== finalHash) {
      window.history.replaceState({ view }, "", finalHash);
    }

    if (moveFocus) {
      const focusTarget = view === "about" ? aboutTitle : heroHeadline;
      focusTarget?.focus({ preventScroll: true });
    }

    window.requestAnimationFrame(() => {
      measureWorkShowcase();
      scheduleScrollState();
    });
  };

  const forceSettleTransition = () => {
    if (!transitionState.transitioning) return;
    const destination = transitionState.targetView || transitionState.view;
    transitionState.timeline?.eventCallback("onComplete", null);
    transitionState.timeline?.eventCallback("onReverseComplete", null);
    transitionState.timeline?.kill();
    if (transitionState.scrubFrame) window.cancelAnimationFrame(transitionState.scrubFrame);
    transitionState.scrubFrame = 0;
    transitionState.scrubVelocity = 0;
    transitionState.scrubLastTime = 0;
    if (canUseFlip) FlipPlugin.killFlipsOf(flipElements, true);
    finishTransition(destination);
  };

  const transitionDesktopToAbout = (options) => {
    // Capture the exact visible button positions before magnetic transforms,
    // scrollbar locking, or transition classes can alter their first frame.
    const ctaClone = createCtaClone(ctaFlipSource);
    const aboutActionClone = createAboutActionClone(heroAboutAction);
    const navClones = createNavClones(standardFlipSources);
    beginTransition("about", options);

    transitionState.scrubbed = Boolean(options?.scrub);
    transitionState.scrubTarget = 0;
    transitionState.scrubTimelineReversed = false;
    gsapEngine.set(doc.body, { "--about-background-progress": 0 });
    // A wheel gesture can cross the trigger after the document has already
    // moved several hundred pixels. Re-anchor the locked transition to the
    // hero before measuring the shared elements so the black work section
    // never flashes underneath the beige Home -> About choreography.
    window.scrollTo(0, 0);
    hero?.style.setProperty("--hero-scroll", "0");
    heroPortrait?.style.setProperty("--portrait-shift", "0px");
    const aboutTravel = Math.min(window.innerHeight * 0.68, 640);
    gsapEngine.set(aboutSection, { autoAlpha: 0 });
    gsapEngine.set(aboutShell, { y: aboutTravel });
    gsapEngine.set(aboutRevealTargets, {
      autoAlpha: 0,
      y: 28
    });
    gsapEngine.set(railOnlyElements, { autoAlpha: 0, y: 16 });
    gsapEngine.set(railIcons, { autoAlpha: 0 });
    gsapEngine.set(railShellSequence, { "--rail-shell-progress": 0 });
    gsapEngine.set(desktopRail, { "--rail-row-progress": 0 });
    gsapEngine.set(heroTravelGlass, { autoAlpha: 1 });
    gsapEngine.set(heroAboutAction, { autoAlpha: 0, x: 0, y: 0 });
    gsapEngine.set(heroQualitiesCard, { autoAlpha: 1, x: 0, y: 0 });

    const statClones = createStatClones(statFlipSources);
    const nameTransition = createNameClone();
    if (nameTransition) {
      gsapEngine.set(nameTransition.element, {
        scaleX: nameTransition.sourceScaleX,
        scaleY: nameTransition.sourceScaleY,
        autoAlpha: 1
      });
      gsapEngine.set(heroName, { autoAlpha: 0 });
    }
    gsapEngine.set(railBrand, { autoAlpha: 0 });
    const headlineTransition = createHeadlineClone();
    const movingHeadline = headlineTransition?.element || heroHeadline;
    if (headlineTransition) gsapEngine.set(heroHeadline, { autoAlpha: 0 });
    const portraitClone = createPortraitClone();
    const separatorClones = createSeparatorClones();
    gsapEngine.set(heroNavSeparators, { autoAlpha: 0 });
    if (portraitClone) {
      gsapEngine.set(portraitClone, {
        autoAlpha: 1,
        scaleX: 1,
        scaleY: 1,
        yPercent: 0,
        filter: "blur(0px)"
      });
      gsapEngine.set(heroPortraitImage, { autoAlpha: 1 });
    }

    applyViewMode("about", { stable: false });
    doc.body.classList.add("rail-visible");
    const brandDestination = railBrandMark?.getBoundingClientRect();
    const timeline = gsapEngine.timeline({
      paused: true,
      defaults: { ease: "power3.inOut" }
    });
    addNavMorph(timeline, navClones, standardFlipTargets, 0.18);
    addStatMorph(timeline, statClones, statFlipTargets, 0.18);
    addCtaMorph(timeline, ctaClone, ctaFlipTarget, 0.18);

    timeline
      .to(doc.body, {
        "--about-background-progress": 1,
        duration: 0.9,
        ease: "sine.inOut"
      }, 0.72)
      .to(movingHeadline, {
        y: headlineTransition
          ? -(headlineTransition.sourceRect.top + headlineTransition.sourceRect.height * 0.72)
          : -window.innerHeight * 0.72,
        duration: 1.2,
        ease: "power2.inOut"
      }, 0.08)
      .to(movingHeadline, { autoAlpha: 0, duration: 0.28, ease: "power1.in" }, 1.04)
      .to(heroSupportingElements, {
        autoAlpha: 0,
        y: -22,
        duration: 0.42,
        stagger: 0.035
      }, 0.12)
      .to(aboutActionClone, {
        autoAlpha: 0,
        x: -16,
        duration: 0.34,
        ease: "power2.out"
      }, 0.34)
      .to(heroQualitiesCard, {
        autoAlpha: 0,
        x: -24,
        duration: 0.24,
        ease: "power1.out"
      }, 0.02)
      .to(separatorClones, {
        autoAlpha: 0,
        duration: 0.52,
        stagger: 0.035,
        ease: "power2.out"
      }, 0.12)
      .to(heroTravelGlass, {
        autoAlpha: 0,
        duration: 0.24,
        stagger: 0.03,
        ease: "power1.out"
      }, 0.02)
      .to(railShellSequence, {
        "--rail-shell-progress": 1,
        duration: 0.46,
        stagger: 0.07,
        ease: "power2.out"
      }, 1.02)
      .to(desktopRail, {
        "--rail-row-progress": 1,
        duration: 0.5,
        ease: "power2.out"
      }, 1.04)
      .to(railIcons, {
        autoAlpha: 1,
        duration: 0.3,
        stagger: 0.035,
        ease: "power2.out"
      }, 1.16)
      .to(railOnlyElements, {
        autoAlpha: 1,
        y: 0,
        duration: 0.42,
        stagger: 0.08,
        ease: "power2.out"
      }, 1.28)
      .to(aboutSection, { autoAlpha: 1, duration: 0.25, ease: "power1.out" }, 1.05)
      .to(aboutShell, { y: 0, duration: 0.84, ease: "power2.inOut" }, 1.12)
      .to(aboutHeaderReveal, {
        autoAlpha: 1,
        y: 0,
        duration: 0.5,
        ease: "power2.out"
      }, 1.14)
      .to(aboutDetailReveals, {
        autoAlpha: 1,
        y: 0,
        duration: 0.45,
        stagger: 0.08,
        ease: "power2.out"
      }, 1.48)
      .call(() => setActiveNavigation("#about"), [], 1.56);

    if (nameTransition && brandDestination) {
      const destinationX = brandDestination.left - nameTransition.sourceRect.left;
      const destinationY = brandDestination.top - nameTransition.sourceRect.top;
      const destinationScaleX = brandDestination.width / nameTransition.naturalWidth;
      const destinationScaleY = brandDestination.height / nameTransition.naturalHeight;
      timeline
        .to(nameTransition.element, {
          x: destinationX * 0.55,
          y: destinationY * 0.65,
          scaleX: nameTransition.sourceScaleX * 0.46,
          scaleY: nameTransition.sourceScaleY * 0.46,
          duration: 0.82,
          ease: "power3.inOut"
        }, 0.04)
        .to(nameTransition.element, {
          x: destinationX,
          y: destinationY,
          scaleX: destinationScaleX,
          scaleY: destinationScaleY,
          duration: 0.72,
          ease: "power2.inOut"
        }, 0.86)
        .to(nameTransition.element, { autoAlpha: 0, duration: 0.26, ease: "power1.out" }, 1.53)
        .to(railBrand, { autoAlpha: 1, duration: 0.32, ease: "power1.out" }, 1.48);
    } else {
      timeline.to(railBrand, { autoAlpha: 1, duration: 0.32 }, 1.48);
    }

    if (portraitClone) {
      timeline
        .to(heroPortraitImage, {
          autoAlpha: 0,
          duration: 0.16,
          ease: "power1.out"
        }, 0)
        .to(portraitClone, {
          filter: "blur(64px)",
          duration: 1.46,
          ease: "sine.inOut"
        }, 0.08)
        .to(portraitClone, {
          autoAlpha: 0.18,
          duration: 1.08,
          ease: "sine.out"
        }, 0.18)
        .to(portraitClone, {
          autoAlpha: 0,
          duration: 0.38,
          ease: "power2.in"
        }, 1.55);
    }

    transitionState.timeline = timeline;
    if (transitionState.scrubbed) {
      timeline.pause(0);
    } else {
      timeline.eventCallback("onComplete", () => finishTransition("about"));
      timeline.play(0);
    }
  };

  const transitionDesktopToHome = (options) => {
    // Capture the exact rendered rail labels before any route class changes.
    const navClones = createNavClones(standardFlipTargets);
    beginTransition("home", options);
    transitionState.scrubbed = Boolean(options?.scrub);
    transitionState.scrubTarget = 0;
    transitionState.scrubTimelineReversed = false;
    gsapEngine.set(doc.body, { "--about-background-progress": 1 });
    const aboutTravel = Math.min(window.innerHeight * 0.68, 640);
    gsapEngine.set(aboutSection, { autoAlpha: 1 });
    gsapEngine.set(aboutShell, { y: 0 });
    gsapEngine.set(aboutRevealTargets, { autoAlpha: 1, y: 0 });
    gsapEngine.set(railShellSequence, { "--rail-shell-progress": 1 });
    gsapEngine.set(desktopRail, { "--rail-row-progress": 1 });
    gsapEngine.set(railIcons, { autoAlpha: 1 });
    gsapEngine.set(heroTravelGlass, { autoAlpha: 0 });
    window.scrollTo(0, 0);
    hero?.style.setProperty("--hero-scroll", "0");
    heroPortrait?.style.setProperty("--portrait-shift", "0px");

    const statClones = createStatClones(statFlipTargets);
    const ctaClone = createCtaClone(ctaFlipTarget);
    const brandOrigin = railBrandMark?.getBoundingClientRect();
    const nameTransition = createNameClone();
    if (nameTransition && brandOrigin) {
      gsapEngine.set(nameTransition.element, {
        x: brandOrigin.left - nameTransition.sourceRect.left,
        y: brandOrigin.top - nameTransition.sourceRect.top,
        scaleX: brandOrigin.width / nameTransition.naturalWidth,
        scaleY: brandOrigin.height / nameTransition.naturalHeight,
        autoAlpha: 0
      });
      gsapEngine.set(heroName, { autoAlpha: 0 });
      gsapEngine.set(railBrand, { autoAlpha: 1 });
    }
    const headlineTransition = createHeadlineClone();
    const movingHeadline = headlineTransition?.element || heroHeadline;
    const headlineExit = headlineTransition
      ? -(headlineTransition.sourceRect.top + headlineTransition.sourceRect.height * 0.72)
      : -window.innerHeight * 0.72;
    gsapEngine.set(movingHeadline, { y: headlineExit, autoAlpha: 0 });
    if (headlineTransition) gsapEngine.set(heroHeadline, { autoAlpha: 0 });
    const portraitClone = createPortraitClone();
    if (portraitClone) {
      gsapEngine.set(portraitClone, {
        autoAlpha: 0,
        scaleX: 1,
        scaleY: 1,
        yPercent: 0,
        filter: "blur(64px)"
      });
      gsapEngine.set(heroPortraitImage, { autoAlpha: 0 });
    }

    applyViewMode("home", { stable: false, keepRail: true });
    doc.body.classList.add("rail-visible");
    gsapEngine.set(heroSupportingElements, { autoAlpha: 0, y: -20 });
    gsapEngine.set(heroAboutAction, { autoAlpha: 0, x: -16 });
    gsapEngine.set(heroQualitiesCard, { autoAlpha: 0, x: -24, y: 0 });
    gsapEngine.set(heroNavSeparators, { autoAlpha: 0 });

    const timeline = gsapEngine.timeline({
      paused: true,
      defaults: { ease: "power3.inOut" },
      onComplete: () => finishTransition("home")
    });
    addNavMorph(timeline, navClones, standardFlipSources, 0.52);
    addStatMorph(timeline, statClones, statFlipSources, 0.52);
    // Hold the rail CTA at its exact stable position during the opening part
    // of a manual reverse. Starting it near zero made even a tiny wheel delta
    // displace and partially clip the yellow button before the rail shell had
    // begun its own transition.
    addCtaMorph(timeline, ctaClone, ctaFlipSource, 0.52);

    timeline
      .to(doc.body, {
        "--about-background-progress": 0,
        duration: 0.92,
        ease: "sine.inOut"
      }, 0.58)
      .to(aboutPortraitReveal, {
        autoAlpha: 0,
        y: 16,
        duration: 0.14,
        ease: "power1.in"
      }, 0)
      .to(aboutCopyReveals, {
        autoAlpha: 0,
        y: 20,
        duration: 0.36,
        stagger: { each: 0.045, from: "end" },
        ease: "power2.in"
      }, 0)
      .to(aboutHeaderReveal, {
        autoAlpha: 0,
        y: 24,
        duration: 0.42,
        ease: "power2.in"
      }, 0.54)
      .to(aboutShell, { y: aboutTravel, duration: 0.78, ease: "power2.inOut" }, 0.52)
      .to(railOnlyElements, {
        autoAlpha: 0,
        y: -10,
        duration: 0.34,
        stagger: { each: 0.04, from: "end" }
      }, 0.6)
      .to(railIcons, { autoAlpha: 0, duration: 0.28, stagger: { each: 0.025, from: "end" } }, 0.58)
      .to(desktopRail, { "--rail-row-progress": 0, duration: 0.42, ease: "power2.in" }, 0.62)
      .to(railShellSequence, {
        "--rail-shell-progress": 0,
        duration: 0.38,
        stagger: { each: 0.05, from: "end" },
        ease: "power2.in"
      }, 0.64)
      .to(aboutSection, { autoAlpha: 0, duration: 0.5, ease: "power2.inOut" }, 0.28)
      .call(() => setActiveNavigation("#home"), [], 0.28)
      .to(movingHeadline, { autoAlpha: 1, duration: 0.22, ease: "power1.out" }, 0.72)
      .to(movingHeadline, { y: 0, duration: 1.0, ease: "power2.inOut" }, 0.7)
      .to(heroSupportingElements, {
        autoAlpha: 1,
        y: 0,
        duration: 0.45,
        stagger: 0.04,
        ease: "power2.out"
      }, 1.35);

    timeline.to(heroAboutAction, {
      autoAlpha: 1,
      x: 0,
      duration: 0.34,
      ease: "power2.out"
    }, 1.32);

    timeline.to(heroQualitiesCard, {
      autoAlpha: 1,
      x: 0,
      duration: 0.3,
      ease: "power2.out"
    }, 1.34);

    timeline.to(heroTravelGlass, {
      autoAlpha: 1,
      duration: 0.3,
      stagger: 0.03,
      ease: "power2.out"
    }, 1.34);

    timeline.to(heroNavSeparators, {
      autoAlpha: 1,
      duration: 0.52,
      stagger: 0.035,
      ease: "power2.out"
    }, 1.05);

    if (nameTransition && brandOrigin) {
      const originX = brandOrigin.left - nameTransition.sourceRect.left;
      const originY = brandOrigin.top - nameTransition.sourceRect.top;
      timeline
        .to(railBrand, { autoAlpha: 0, duration: 0.2, ease: "power1.in" }, 0.5)
        .to(nameTransition.element, {
          x: originX * 0.55,
          y: originY * 0.65,
          scaleX: nameTransition.sourceScaleX * 0.46,
          scaleY: nameTransition.sourceScaleY * 0.46,
          autoAlpha: 1,
          duration: 0.76,
          ease: "power2.inOut"
        }, 0.52)
        .to(nameTransition.element, {
          x: 0,
          y: 0,
          scaleX: nameTransition.sourceScaleX,
          scaleY: nameTransition.sourceScaleY,
          autoAlpha: 1,
          duration: 0.78,
          ease: "power3.inOut"
        }, 0.84);
    }

    if (portraitClone) {
      timeline
        .to(portraitClone, { autoAlpha: 1, duration: 0.34, ease: "power1.out" }, 0.08)
        .to(portraitClone, { filter: "blur(0px)", duration: 1.12, ease: "sine.inOut" }, 0.3)
        .to(portraitClone, {
          autoAlpha: 0,
          duration: 0.34,
          ease: "power1.inOut"
        }, 1.24)
        .to(heroPortraitImage, {
          autoAlpha: 1,
          duration: 0.38,
          ease: "power1.inOut"
        }, 1.24);
    }

    transitionState.timeline = timeline;
    if (transitionState.scrubbed) timeline.pause(0);
    else timeline.play(0);
  };

  const scrubActiveTransition = (rawDelta) => {
    const timeline = transitionState.timeline;
    if (!transitionState.transitioning || !transitionState.scrubbed || !timeline || !rawDelta) return;

    // About advances on downward input; Home advances on upward input. Limit
    // one wheel event so high-resolution mice cannot skip the entire sequence.
    const routeDirection = transitionState.targetView === "about" ? 1 : -1;
    const clampedDelta = Math.max(-160, Math.min(160, rawDelta));
    // Returning from a scrolled About page has much less gesture distance
    // available after the top gateway. Keep the exact same timeline/path,
    // but let that reverse reach its real Home endpoint before the gesture
    // ends instead of freezing while the labels are still fanned out.
    const returningHome = transitionState.targetView === "home";
    const scrollDistance = returningHome
      ? Math.max(620, window.innerHeight * 0.72)
      : Math.max(1200, window.innerHeight * 1.4);
    const progressDelta = (clampedDelta * routeDirection) / scrollDistance;
    let nextProgress = Math.max(0, Math.min(1, transitionState.scrubTarget + progressDelta));
    // Smoothly finish the final few percent so the stable DOM handoff always
    // happens instead of leaving the page paused on a nearly-complete frame.
    if (progressDelta > 0 && nextProgress >= 0.94) nextProgress = 1;
    else if (progressDelta < 0 && nextProgress <= 0.06) nextProgress = 0;
    if (Math.abs(nextProgress - transitionState.scrubTarget) < 0.0001) return;

    transitionState.scrubTarget = nextProgress;
    if (transitionState.scrubFrame) return;

    // A single time-based spring keeps its momentum across every wheel event.
    // This fills the gaps between irregular input samples with continuous
    // frame-by-frame motion instead of restarting an ease for each delta.
    const renderSmoothedProgress = (time) => {
      if (!transitionState.transitioning || transitionState.timeline !== timeline) {
        transitionState.scrubFrame = 0;
        return;
      }

      const previousTime = transitionState.scrubLastTime || time - 16.667;
      const deltaTime = Math.min(0.034, Math.max(0.001, (time - previousTime) / 1000));
      transitionState.scrubLastTime = time;

      const reverseTimeline = transitionState.scrubTimelineReversed;
      const current = reverseTimeline ? 1 - timeline.progress() : timeline.progress();
      const distance = transitionState.scrubTarget - current;
      const stiffness = 210;
      const damping = 28;
      transitionState.scrubVelocity += distance * stiffness * deltaTime;
      transitionState.scrubVelocity *= Math.exp(-damping * deltaTime);

      let smoothed = current + transitionState.scrubVelocity * deltaTime;
      if (Math.abs(distance) < 0.00001) {
        smoothed = transitionState.scrubTarget;
        transitionState.scrubVelocity *= 0.35;
      } else if (distance > 0) {
        smoothed = Math.min(smoothed, transitionState.scrubTarget);
      } else {
        smoothed = Math.max(smoothed, transitionState.scrubTarget);
      }
      smoothed = Math.max(0, Math.min(0.9998, smoothed));
      timeline.progress(reverseTimeline ? 1 - smoothed : smoothed).pause();

      const settled = Math.abs(transitionState.scrubTarget - smoothed) < 0.00035 &&
        Math.abs(transitionState.scrubVelocity) < 0.0025;
      if (settled) {
        const settledTarget = transitionState.scrubTarget;
        transitionState.scrubFrame = 0;
        transitionState.scrubVelocity = 0;
        transitionState.scrubLastTime = 0;
        if (settledTarget <= 0.0001) finishTransition(transitionState.originView);
        else if (settledTarget >= 0.9999) finishTransition(transitionState.targetView);
        else timeline.progress(reverseTimeline ? 1 - settledTarget : settledTarget).pause();
        return;
      }

      transitionState.scrubFrame = window.requestAnimationFrame(renderSmoothedProgress);
    };

    transitionState.scrubLastTime = 0;
    transitionState.scrubFrame = window.requestAnimationFrame(renderSmoothedProgress);
  };

  const transitionSimple = (view, options) => {
    const forward = view === "about";
    const desktop = window.innerWidth > 1100;
    beginTransition(view, options);
    const duration = reduceMotion.matches ? 0.15 : window.innerWidth <= 820 ? 0.88 : 1.05;

    if (!forward) {
      gsapEngine.set(aboutSection, { autoAlpha: 1 });
      gsapEngine.set(aboutRevealTargets, { autoAlpha: 1, y: 0 });
      window.scrollTo(0, 0);
      hero?.style.setProperty("--hero-scroll", "0");
      heroPortrait?.style.setProperty("--portrait-shift", "0px");
    } else {
      gsapEngine.set(aboutSection, { autoAlpha: 0 });
      gsapEngine.set(aboutRevealTargets, { autoAlpha: 0, y: reduceMotion.matches ? 0 : 24 });
    }

    if (desktop) gsapEngine.set(desktopRail, { autoAlpha: forward ? 0 : 1 });

    applyViewMode(view, { stable: false, keepRail: !forward });
    if (!forward) {
      gsapEngine.set(simpleHeroElements, { autoAlpha: 0, y: reduceMotion.matches ? 0 : -18 });
      gsapEngine.set(heroPortraitImage, { autoAlpha: 0.45, scale: reduceMotion.matches ? 1 : 1.04 });
    }

    const timeline = gsapEngine.timeline({
      paused: true,
      defaults: { ease: "power3.inOut", force3D: true },
      onComplete: () => finishTransition(view)
    });

    if (forward) {
      timeline
        .to(simpleHeroElements, {
          autoAlpha: 0,
          y: reduceMotion.matches ? 0 : -18,
          duration: duration * 0.72,
          stagger: reduceMotion.matches ? 0 : 0.025
        }, 0)
        .to(heroPortraitImage, {
          autoAlpha: 0.35,
          scale: reduceMotion.matches ? 1 : 1.06,
          duration
        }, 0)
        .fromTo(aboutSection, {
          autoAlpha: 0,
          y: reduceMotion.matches ? 0 : 28
        }, {
          autoAlpha: 1,
          y: 0,
          duration: duration * 0.78
        }, duration * 0.22)
        .to(aboutRevealTargets, {
          autoAlpha: 1,
          y: 0,
          duration: duration * 0.72,
          stagger: reduceMotion.matches ? 0 : 0.07,
          ease: "power2.out"
        }, duration * 0.46);
      if (desktop) {
        timeline.to(desktopRail, { autoAlpha: 1, duration: duration * 0.55, ease: "power2.out" }, duration * 0.42);
      }
    } else {
      timeline
        .to(aboutRevealTargets, {
          autoAlpha: 0,
          y: reduceMotion.matches ? 0 : 20,
          duration: duration * 0.55,
          stagger: reduceMotion.matches ? 0 : { each: 0.04, from: "end" }
        }, 0)
        .to(aboutSection, { autoAlpha: 0, duration: duration * 0.6 }, duration * 0.15)
        .to(simpleHeroElements, {
          autoAlpha: 1,
          y: 0,
          duration: duration * 0.7,
          stagger: reduceMotion.matches ? 0 : 0.025
        }, duration * 0.35)
        .to(heroPortraitImage, {
          autoAlpha: 1,
          scale: 1,
          duration: duration * 0.7
        }, duration * 0.3);
      if (desktop) {
        timeline.to(desktopRail, { autoAlpha: 0, duration: duration * 0.35, ease: "power2.in" }, 0);
      }
    }

    transitionState.timeline = timeline;
    timeline.play(0);
  };

  const transitionImmediately = (view, { historyMode = "none", moveFocus = false } = {}) => {
    const destination = view === "about" && aboutSection
      ? aboutSection.getBoundingClientRect().top + window.scrollY
      : 0;
    applyViewMode(view);
    if (view === "about") aboutRevealTargets.forEach((element) => element.classList.add("is-visible"));
    const previousBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, destination);
    root.style.scrollBehavior = previousBehavior;
    const hash = view === "about" ? "#about" : "#home";
    setActiveNavigation(hash);
    if (historyMode === "push" && window.location.hash !== hash) {
      window.history.pushState({ view }, "", hash);
    } else if (historyMode === "replace" && window.location.hash !== hash) {
      window.history.replaceState({ view }, "", hash);
    }
    if (moveFocus) (view === "about" ? aboutTitle : heroHeadline)?.focus({ preventScroll: true });
    transitionState.booting = false;
    measureWorkShowcase();
    scheduleScrollState();
  };

  const transitionTo = (view, options = {}) => {
    if (transitionState.transitioning) return;
    if (view === transitionState.view) {
      const target = view === "about" ? aboutSection : hero;
      const top = view === "about" && target
        ? target.getBoundingClientRect().top + window.scrollY
        : 0;
      window.scrollTo({ top, behavior: reduceMotion.matches ? "auto" : "smooth" });
      return;
    }

    setMenu(false, false);
    if (!gsapEngine) {
      transitionImmediately(view, options);
      return;
    }

    const fullDesktopMotion = window.innerWidth > 1100 && canUseFlip && !reduceMotion.matches;
    if (fullDesktopMotion) {
      if (view === "about") transitionDesktopToAbout(options);
      else transitionDesktopToHome(options);
    } else {
      transitionSimple(view, options);
    }
  };

  transitionControllerReady = true;

  doc.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element
      ? event.target.closest('a[href="#home"], a[href="#about"]')
      : null;
    if (!link) return;

    const view = link.hash === "#about" ? "about" : "home";
    if (transitionState.transitioning) {
      event.preventDefault();
      return;
    }
    if (view === transitionState.view) return;

    event.preventDefault();
    transitionTo(view, { historyMode: "push", moveFocus: true });
  });

  const scrollToRoute = (hash) => {
    const normalized = hash || "#home";
    if (normalized === "#home" || normalized === "#about") {
      transitionTo(normalized === "#about" ? "about" : "home", {
        historyMode: "none",
        moveFocus: false
      });
      return;
    }

    if (transitionState.transitioning) forceSettleTransition();
    applyViewMode("about");
    const target = $(normalized);
    const previousBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    target?.scrollIntoView();
    root.style.scrollBehavior = previousBehavior;
    setActiveNavigation(normalized);
  };

  if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
  let historyFrame = 0;
  window.addEventListener("popstate", () => {
    if (historyFrame) window.cancelAnimationFrame(historyFrame);
    historyFrame = window.requestAnimationFrame(() => {
      historyFrame = 0;
      if (transitionState.transitioning) forceSettleTransition();
      scrollToRoute(window.location.hash || "#home");
    });
  });

  let initialRouteAligned = false;
  const alignInitialRoute = () => {
    if (initialRouteAligned) return;
    initialRouteAligned = true;
    const hash = window.location.hash || "#home";
    const target = hash === "#home" ? hero : $(hash);
    const previousBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    if (hash === "#home") window.scrollTo(0, 0);
    else if (hash === "#about" && target) {
      window.scrollTo(0, target.getBoundingClientRect().top + window.scrollY);
    } else {
      target?.scrollIntoView();
    }
    root.style.scrollBehavior = previousBehavior;
    if (hash !== "#home") applyViewMode("about");
    if (hash === "#about") aboutRevealTargets.forEach((element) => element.classList.add("is-visible"));
    setActiveNavigation(hash);
    transitionState.booting = false;
    measureWorkShowcase();
    scheduleScrollState();
  };

  window.requestAnimationFrame(() => window.requestAnimationFrame(alignInitialRoute));
  window.addEventListener("load", alignInitialRoute, { once: true });

  let transitionResizeFrame = 0;
  let transitionViewportWidth = window.innerWidth;
  window.addEventListener("resize", () => {
    if (transitionResizeFrame) window.cancelAnimationFrame(transitionResizeFrame);
    transitionResizeFrame = window.requestAnimationFrame(() => {
      transitionResizeFrame = 0;
      const nextWidth = window.innerWidth;
      const widthDelta = Math.abs(nextWidth - transitionViewportWidth);
      const crossedDesktopBreakpoint = (transitionViewportWidth > 1100) !== (nextWidth > 1100);
      transitionViewportWidth = nextWidth;

      if (transitionState.transitioning) {
        if (crossedDesktopBreakpoint || widthDelta > 24) forceSettleTransition();
        else return;
      }
      applyViewMode(transitionState.view);
      measureWorkShowcase();
      scheduleScrollState();
    });
  }, { passive: true });

  if ("ResizeObserver" in window && workScene) {
    const workResizeObserver = new ResizeObserver(() => {
      measureWorkShowcase();
      scheduleScrollState();
    });
    workResizeObserver.observe(workScene);
  }

  doc.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && transitionState.transitioning) {
      event.preventDefault();
      forceSettleTransition();
      return;
    }

    if (event.key === "Escape" && mobileMenu?.classList.contains("open")) {
      setMenu(false);
      return;
    }

    if (event.key !== "Tab" || !mobileMenu?.classList.contains("open")) return;
    const focusable = [menuToggle, ...menuLinks].filter(Boolean);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && doc.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && doc.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  const reveals = $$(".reveal");
  if (reduceMotion.matches || !("IntersectionObserver" in window)) {
    reveals.forEach((element) => element.classList.add("is-visible"));
  } else {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (transitionState.transitioning && entry.target.hasAttribute("data-transition-reveal")) return;
        entry.target.classList.toggle("is-visible", entry.isIntersecting);
      });
    }, { rootMargin: "0px 0px -8%", threshold: 0.08 });
    reveals.forEach((element) => revealObserver.observe(element));
  }

  // Give every readable content element its own scroll entrance. Large type uses
  // a clipped rise; supporting copy follows with a softer staggered lift.
  const textRevealSelector = [
    "h2", "h3", "h4", "p", "li", "dt", "dd", "summary", "label",
    ".button", ".project-link", ".copy-email"
  ].join(",");
  const textRevealElements = $$(textRevealSelector, $("main")).filter((element) =>
    !element.closest(".hero, .work, #about, dialog") && element.textContent.trim()
  );
  const footerText = $(".footer") ? $$(textRevealSelector, $(".footer")) : [];

  [...textRevealElements, ...footerText].forEach((element) => {
    element.classList.add("text-scroll-reveal");
    if (element.matches("h2, h3, h4")) element.classList.add("text-scroll-heading");
    const siblings = element.parentElement
      ? $$(":scope > .text-scroll-reveal", element.parentElement)
      : [];
    const siblingIndex = Math.max(0, siblings.indexOf(element));
    element.style.setProperty("--text-delay", `${Math.min(siblingIndex, 6) * 65}ms`);
  });

  if (reduceMotion.matches || !("IntersectionObserver" in window)) {
    $$(".text-scroll-reveal").forEach((element) => element.classList.add("is-text-visible"));
  } else {
    const textObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle("is-text-visible", entry.isIntersecting);
      });
    }, { rootMargin: "0px 0px -5%", threshold: 0.08 });

    $$(".text-scroll-reveal").forEach((element) => textObserver.observe(element));
  }

  if (!reduceMotion.matches && finePointer.matches) {
    $$(".tilt-card").forEach((card) => {
      card.addEventListener("pointermove", (event) => {
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        card.style.setProperty("--tilt-x", `${(-y * 4).toFixed(2)}deg`);
        card.style.setProperty("--tilt-y", `${(x * 4).toFixed(2)}deg`);
      });
      card.addEventListener("pointerleave", () => {
        card.style.setProperty("--tilt-x", "0deg");
        card.style.setProperty("--tilt-y", "0deg");
      });
    });

    $$(".magnetic").forEach((button) => {
      button.addEventListener("pointermove", (event) => {
        const rect = button.getBoundingClientRect();
        const x = (event.clientX - rect.left - rect.width / 2) * 0.08;
        const y = (event.clientY - rect.top - rect.height / 2) * 0.08;
        button.style.transform = `translate(${x}px, ${y}px)`;
      });
      button.addEventListener("pointerleave", () => {
        button.style.transform = "";
      });
    });
  }

  $$(".accordion details").forEach((details) => {
    details.addEventListener("toggle", () => {
      if (!details.open) return;
      $$(".accordion details[open]").forEach((other) => {
        if (other !== details) other.open = false;
      });
    });
  });

  const dialog = $("#videoDialog");
  const dialogClose = $("#dialogClose");
  const dialogTitle = $("#dialogTitle");
  const projectVideo = $("#projectVideo");
  let dialogOpener = null;

  const releaseVideo = () => {
    if (!projectVideo) return;
    projectVideo.pause();
    projectVideo.removeAttribute("src");
    projectVideo.removeAttribute("poster");
    projectVideo.load();
  };

  const closeDialog = () => {
    if (dialog?.open) dialog.close();
  };

  $$(".watch-project").forEach((button) => {
    button.addEventListener("click", () => {
      const videoPath = button.dataset.video || "";
      if (!dialog || !projectVideo || typeof dialog.showModal !== "function") {
        if (videoPath) window.location.href = videoPath;
        return;
      }

      dialogOpener = button;
      if (dialogTitle) dialogTitle.textContent = button.dataset.title || "Project Film";
      projectVideo.src = videoPath;
      if (button.dataset.poster) projectVideo.poster = button.dataset.poster;
      projectVideo.setAttribute("aria-label", `${button.dataset.title || "Project"} video`);
      projectVideo.load();
      doc.body.classList.add("dialog-open");
      dialog.showModal();
      dialogClose?.focus();
    });
  });

  dialogClose?.addEventListener("click", closeDialog);
  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog();
  });
  dialog?.addEventListener("close", () => {
    releaseVideo();
    doc.body.classList.remove("dialog-open");
    if (dialogOpener instanceof HTMLElement) dialogOpener.focus({ preventScroll: true });
    dialogOpener = null;
  });

  doc.addEventListener("play", (event) => {
    if (!(event.target instanceof HTMLMediaElement)) return;
    $$("video, audio").forEach((media) => {
      if (media !== event.target) media.pause();
    });
  }, true);

  const copyButton = $("#copyEmail");
  const copyStatus = $("#copyStatus");
  const railCopyButton = $("#railCopyEmail");
  const railCopyStatus = $("#railCopyStatus");

  const copyText = async (value) => {
    let copied = false;

    try {
      await navigator.clipboard.writeText(value);
      copied = true;
    } catch {
      const field = doc.createElement("textarea");
      field.value = value;
      field.style.position = "fixed";
      field.style.opacity = "0";
      doc.body.append(field);
      field.select();
      copied = doc.execCommand("copy");
      field.remove();
    }

    return copied;
  };

  const bindCopyButton = (button, status, successLabel) => {
    button?.addEventListener("click", async () => {
      const email = button.dataset.email || "";
      const copied = email ? await copyText(email) : false;

      if (status) status.textContent = copied ? successLabel : "Unable to copy";
      window.setTimeout(() => {
        if (status) status.textContent = "";
      }, 3000);
    });
  };

  bindCopyButton(copyButton, copyStatus, "Email copied.");
  bindCopyButton(railCopyButton, railCopyStatus, "Copied");

  $("#contactForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement) || !form.reportValidity()) return;

    const data = new FormData(form);
    const subject = `Portfolio inquiry - ${data.get("type")}`;
    const body = [
      `Name: ${data.get("name")}`,
      `Email: ${data.get("email")}`,
      `Project type: ${data.get("type")}`,
      `Budget: ${data.get("budget")}`,
      "",
      "Project details:",
      data.get("details")
    ].join("\n");

    window.location.href = `mailto:itsmeakiravince@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });

  window.addEventListener("pagehide", releaseVideo);
})();
