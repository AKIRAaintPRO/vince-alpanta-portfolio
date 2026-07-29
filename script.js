(() => {
  "use strict";

  const doc = document;
  const root = doc.documentElement;
  const body = doc.body;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const desktopQuery = window.matchMedia("(min-width: 1101px)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const LenisEngine = window.Lenis;
  const $ = (selector, scope = doc) => scope?.querySelector(selector) || null;
  const $$ = (selector, scope = doc) => scope ? [...scope.querySelectorAll(selector)] : [];


  // Split selected copy into semantic inline word masks. This keeps natural
  // wrapping intact while allowing each word to reveal independently.
  const prepareWordRevealTarget = (target) => {
    if (!target || target.dataset.wordRevealReady === "true") return;

    const walker = doc.createTreeWalker(target, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const value = node.nodeValue || "";
        const parent = node.parentElement;
        if (!value.trim() || !parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest(".word-reveal-mask")) return NodeFilter.FILTER_REJECT;
        if (parent.closest('[aria-hidden="true"]')) return NodeFilter.FILTER_REJECT;
        if (["SCRIPT", "STYLE"].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    textNodes.forEach((textNode) => {
      const fragment = doc.createDocumentFragment();
      const tokens = (textNode.nodeValue || "").match(/\S+|\s+/g) || [];

      tokens.forEach((token) => {
        if (/^\s+$/.test(token)) {
          fragment.append(doc.createTextNode(token));
          return;
        }

        const mask = doc.createElement("span");
        const word = doc.createElement("span");
        mask.className = "word-reveal-mask";
        word.className = "word-reveal-word";
        word.textContent = token;
        mask.append(word);
        fragment.append(mask);
      });

      textNode.replaceWith(fragment);
    });

    target.classList.add("word-reveal-target");
    target.dataset.wordRevealReady = "true";
  };

  $$("[data-word-reveal]").forEach(prepareWordRevealTarget);
  root.classList.add("word-reveal-ready");

  const SECTION_IDS = [
    "home", "about", "work", "expect", "services", "process", "faq", "contact"
  ];
  const CONTENT_SECTION_IDS = SECTION_IDS.slice(1);
  const validSection = (value) => SECTION_IDS.includes(value);
  const parseSectionHash = () => {
    const requested = window.location.hash.slice(1);
    return validSection(requested) ? requested : "home";
  };

  root.classList.replace("no-js", "js");
  const navigationEntry = window.performance?.getEntriesByType?.("navigation")?.[0];
  const navigationType = navigationEntry?.type || "navigate";
  const isReload = navigationType === "reload";
  const restoringDocumentPosition = navigationType === "back_forward";

  if ("scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
  }
  if (isReload) {
    window.history.replaceState({ section: "home" }, "", "#home");
    window.scrollTo(0, 0);
  }

  const gsapEngine = window.gsap;
  const ScrollTriggerPlugin = window.ScrollTrigger;
  const FlipPlugin = window.Flip;
  if (gsapEngine) {
    const plugins = [ScrollTriggerPlugin, FlipPlugin].filter(Boolean);
    if (plugins.length) gsapEngine.registerPlugin(...plugins);
  }

  const initialSection = parseSectionHash();

  // Global smooth scrolling is enabled only for desktop wheel/trackpad input.
  // Touch devices and reduced-motion users keep native scrolling.
  let smoothScroll = null;
  let smoothScrollTicker = null;
  let smoothScrollHandler = null;
  let smoothScrollModeEnabled = false;

  const pageState = {
    layoutMode: initialSection === "home" ? "hero" : "content",
    activeSection: initialSection,
    transitioning: false,
    transitionDirection: null,
    navigationTarget: null,
    booting: true,
    homeAboutTimeline: null,
    homeAboutTrigger: null,
    aboutWordTimeline: null
  };

  // Reassigned after the section word timelines are built. Keeping this hook
  // outside setActiveSection lets hash navigation, rail clicks, and natural
  // scrolling all start the same automatic section reveal.
  let syncSectionWordReveal = () => {};

  const jumpTo = (top) => {
    const safeTop = Math.max(0, Number.isFinite(top) ? top : 0);

    // Keep Lenis's animated and target positions synchronized during refresh,
    // hash restoration, and ScrollTrigger progress preservation.
    if (smoothScroll) {
      smoothScroll.scrollTo(safeTop, {
        immediate: true,
        force: true,
        lock: false
      });
      ScrollTriggerPlugin?.update?.();
      scheduleDocumentState();
      return;
    }

    const previousBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, safeTop);
    root.style.scrollBehavior = previousBehavior;
  };

  const pageIntro = $("#pageIntro");
  const homeAboutScene = $("#homeAboutScene");
  const homeAboutStage = $("#homeAboutStage");
  const hero = $("#home");
  const aboutSection = $("#about");
  const heroNav = $(".hero-nav", hero);
  const heroName = $(".hero-name", hero);
  const heroHeadline = $("#hero-title");
  const heroPortrait = $("#heroPortrait");
  const heroPortraitImage = $("img", heroPortrait);
  const heroSupportingElements = $$(".hero-identity, .hero-description, .hero-scroll", hero);
  const heroQualitiesCard = $(".hero-card-qualities", hero);
  const heroAboutAction = $(".hero-actions > a[href='#about']", hero);
  const heroTravelGlass = $$(".hero-card-project .hero-card-glass, .hero-card-workflow .hero-card-glass", hero);
  const heroNavSeparators = $$(".hero-nav-group > i", hero);
  const aboutShell = $(".shell", aboutSection);
  const aboutRevealTargets = $$('[data-transition-reveal]', aboutSection);
  const aboutHeaderReveal = aboutRevealTargets[0] || null;
  const aboutDetailReveals = aboutRevealTargets.slice(1);
  const desktopRail = $("#desktopRail");
  const railBrand = $(".rail-brand", desktopRail);
  const railBrandMark = $("strong", railBrand);
  const railBrandLabel = $("span", railBrand);
  const railShells = $$(".rail-card, .rail-email", desktopRail);
  const railIcons = $$(".rail-menu i", desktopRail);
  const railOnlyElements = $$(".rail-intro > p, .rail-tools, .rail-email", desktopRail);
  const railTargets = $$(".flip-target", desktopRail);
  const heroSources = $$(".flip-source", hero);
  const workShowcase = $("#work");
  const workScene = $(".work-shell", workShowcase);
  const workIntro = $(".work-intro", workShowcase);
  const workTitleBlock = $(".work-title-block", workShowcase);
  const workDescription = $(".work-description", workShowcase);
  const projectTrack = $(".project-grid", workShowcase);
  const scrollProgress = $("#scrollProgress");
  const aboutMotionDisplayWords = $$("[data-word-reveal=\"display\"] .word-reveal-word", aboutHeaderReveal);
  const aboutMotionCopyWords = $$("[data-word-reveal=\"copy\"] .word-reveal-word", aboutHeaderReveal);
  const aboutDetailWordTargets = $$("[data-word-reveal]", aboutSection).filter((target) => {
    if (aboutHeaderReveal?.contains(target)) return false;
    return $$(".word-reveal-word", target).length > 0;
  });
  const aboutDetailWords = aboutDetailWordTargets.flatMap((target) =>
    $$(".word-reveal-word", target)
  );

  // The About chapter contains more content than some desktop viewport
  // heights can display. Its scene height is measured from the real content
  // so the portrait, facts, and toolkit are not clipped before Work begins.
  const ABOUT_SCENE_BOTTOM_SPACE = 120;

  // About remains the active rail item until Work is close to the top of the
  // viewport. A wider return threshold prevents About and Projects from
  // alternating when the user makes small wheel movements at the boundary.
  const workBoundaryThresholds = () => {
    const viewportHeight = Math.max(window.innerHeight, 1);
    return {
      enterWorkAt: Math.min(160, Math.max(96, viewportHeight * 0.14)),
      returnAboutAt: Math.min(360, Math.max(240, viewportHeight * 0.34))
    };
  };

  const shouldUseSmoothScroll = () => Boolean(
    LenisEngine
    && gsapEngine
    && ScrollTriggerPlugin
    && desktopQuery.matches
    && finePointer.matches
    && !reduceMotion.matches
  );

  const syncSmoothScrollPause = () => {
    if (!smoothScroll) return;
    const shouldPause = body.classList.contains("menu-open")
      || body.classList.contains("dialog-open");

    if (shouldPause) smoothScroll.stop();
    else smoothScroll.start();
  };

  const destroySmoothScroll = () => {
    if (smoothScroll && smoothScrollHandler) {
      smoothScroll.off?.("scroll", smoothScrollHandler);
    }
    if (smoothScrollTicker && gsapEngine?.ticker) {
      gsapEngine.ticker.remove(smoothScrollTicker);
    }

    smoothScroll?.destroy?.();
    smoothScroll = null;
    smoothScrollTicker = null;
    smoothScrollHandler = null;
    smoothScrollModeEnabled = false;
    root.classList.remove("site-smooth-scroll");
  };

  const buildSmoothScroll = () => {
    if (!shouldUseSmoothScroll()) return false;

    try {
      smoothScroll = new LenisEngine({
        autoRaf: false,
        lerp: 0.10,
        smoothWheel: true,
        syncTouch: false,
        wheelMultiplier: 0.9,
        touchMultiplier: 1,
        infinite: false,
        overscroll: true,
        anchors: false,
        prevent: (node) => Boolean(node?.closest?.("[data-lenis-prevent]"))
      });

      smoothScrollHandler = () => {
        ScrollTriggerPlugin.update();
        scheduleDocumentState();
      };

      smoothScroll.on("scroll", smoothScrollHandler);

      // Lenis and every GSAP ScrollTrigger scene run from one animation clock.
      // This avoids competing RAF loops, delayed pins, and reverse-scroll drift.
      smoothScrollTicker = (time) => smoothScroll?.raf(time * 1000);
      gsapEngine.ticker.add(smoothScrollTicker);
      gsapEngine.ticker.lagSmoothing(0);

      root.classList.add("site-smooth-scroll");
      smoothScrollModeEnabled = true;
      syncSmoothScrollPause();
      return true;
    } catch (error) {
      console.warn("Smooth scrolling could not start; native scrolling remains active.", error);
      destroySmoothScroll();
      return false;
    }
  };

  const syncSmoothScrollMode = ({ force = false } = {}) => {
    const shouldEnable = shouldUseSmoothScroll();
    if (!force && shouldEnable === smoothScrollModeEnabled) return;

    destroySmoothScroll();
    if (shouldEnable) buildSmoothScroll();
  };

  const sectionElements = new Map(
    SECTION_IDS.map((id) => [id, $(`#${id}`)]).filter(([, element]) => element)
  );
  const navigationLinks = $$([
    ".hero-nav a[href^='#']",
    ".rail-menu a[href^='#']",
    ".rail-cta[href^='#']",
    ".mobile-menu a[href^='#']",
    ".footer a[href^='#']"
  ].join(",")).filter((link) => validSection(link.hash.slice(1)));


  // Background-aware glassmorphism. Each fixed rail surface samples the
  // actually painted page behind itself. This stays accurate even while
  // ScrollTrigger pins or overlaps About and Work, where section rectangles
  // alone can report both chapters as occupying the full viewport.
  const parseCssRgb = (value) => {
    const match = String(value || "").match(/rgba?\(([^)]+)\)/i);
    if (!match) return null;
    const parts = match[1].trim().split(/[\s,\/]+/).filter(Boolean).map(Number);
    if (parts.length < 3 || parts.slice(0, 3).some((part) => !Number.isFinite(part))) return null;
    return { r: parts[0], g: parts[1], b: parts[2], a: Number.isFinite(parts[3]) ? parts[3] : 1 };
  };

  const relativeChannel = (value) => {
    const channel = Math.min(255, Math.max(0, value)) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };

  const colorDarkness = ({ r, g, b }) => {
    const luminance = 0.2126 * relativeChannel(r)
      + 0.7152 * relativeChannel(g)
      + 0.0722 * relativeChannel(b);
    return Math.min(1, Math.max(0, (0.58 - luminance) / 0.36));
  };

  const visibleBackgroundDarknessAt = (x, y) => {
    const elements = doc.elementsFromPoint(x, y);

    for (const element of elements) {
      if (!(element instanceof Element)) continue;
      if (desktopRail?.contains(element)) continue;
      if (element.closest?.('.scene-shared-clone, .top-rule, .skip-link')) continue;

      let current = element;
      while (current instanceof Element) {
        if (desktopRail?.contains(current)) break;
        const parsed = parseCssRgb(window.getComputedStyle(current).backgroundColor);
        if (parsed && parsed.a > 0.08) return colorDarkness(parsed);
        current = current.parentElement;
      }
    }

    const bodyColor = parseCssRgb(window.getComputedStyle(body).backgroundColor);
    return bodyColor ? colorDarkness(bodyColor) : 0;
  };

  const RAIL_GLASS_SAMPLE_COUNT = 7;

  const updateAdaptiveRailGlass = () => {
    if (!desktopRail || !desktopQuery.matches || !railShells.length) return;

    const railRect = desktopRail.getBoundingClientRect();
    if (railRect.width <= 0 || railRect.height <= 0) return;

    // Sample through the middle of the fixed rail. The rail itself is filtered
    // out of elementsFromPoint(), leaving the real visible section underneath.
    const sampleX = Math.min(window.innerWidth - 2, Math.max(2, railRect.left + railRect.width * 0.5));

    railShells.forEach((surface) => {
      const rect = surface.getBoundingClientRect();
      if (rect.height <= 0 || rect.bottom <= 0 || rect.top >= window.innerHeight) return;

      let darknessTotal = 0;
      let validSamples = 0;

      for (let index = 0; index < RAIL_GLASS_SAMPLE_COUNT; index += 1) {
        const ratio = RAIL_GLASS_SAMPLE_COUNT === 1 ? 0.5 : index / (RAIL_GLASS_SAMPLE_COUNT - 1);
        const y = Math.min(
          window.innerHeight - 2,
          Math.max(2, rect.top + 1 + (rect.height - 2) * ratio)
        );
        darknessTotal += visibleBackgroundDarknessAt(sampleX, y);
        validSamples += 1;
      }

      const darkProgress = validSamples ? Math.min(1, Math.max(0, darknessTotal / validSamples)) : 0;
      surface.style.setProperty("--rail-dark-pct", `${(darkProgress * 100).toFixed(2)}%`);
      surface.style.setProperty("--rail-light-pct", `${((1 - darkProgress) * 100).toFixed(2)}%`);
    });
  };


  const clearHomeAboutSceneHeight = () => {
    [homeAboutScene, homeAboutStage, aboutSection, hero].forEach((element) => {
      element?.style.removeProperty("height");
    });
  };

  const syncHomeAboutSceneHeight = () => {
    if (!homeAboutScene || !homeAboutStage || !aboutSection || !aboutShell || !hero || !desktopQuery.matches) {
      clearHomeAboutSceneHeight();
      return;
    }

    const viewportHeight = Math.max(window.innerHeight, 1);
    const sectionStyle = window.getComputedStyle(aboutSection);
    const paddingTop = Number.parseFloat(sectionStyle.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(sectionStyle.paddingBottom) || 0;

    // Measure the actual shell content instead of relying only on the section's
    // current scrollHeight. The section is absolutely positioned and animated,
    // so scrollHeight can briefly reflect the old viewport-sized scene during
    // refresh, which previously let Work arrive before the toolkit was visible.
    const shellHeight = Math.max(
      aboutShell.scrollHeight,
      aboutShell.offsetHeight,
      Math.ceil(aboutShell.getBoundingClientRect().height)
    );
    const requiredHeight = Math.ceil(
      paddingTop + shellHeight + paddingBottom + ABOUT_SCENE_BOTTOM_SPACE
    );
    const sceneHeight = Math.max(viewportHeight, requiredHeight);

    homeAboutScene.style.height = `${sceneHeight}px`;
    homeAboutStage.style.height = `${sceneHeight}px`;
    aboutSection.style.height = `${sceneHeight}px`;
    hero.style.height = "100svh";
  };

  const setInert = (element, inert) => {
    if (element && "inert" in element) element.inert = inert;
  };

  const applyLayoutMode = (mode) => {
    const normalized = mode === "content" ? "content" : "hero";
    if (pageState.layoutMode === normalized && body.dataset.layoutMode === normalized) return;
    pageState.layoutMode = normalized;
    body.dataset.layoutMode = normalized;
    body.classList.toggle("is-content-mode", normalized === "content");
    body.classList.toggle("rail-visible", normalized === "content" && desktopQuery.matches);
  };

  const syncNavigation = (sectionId) => {
    navigationLinks.forEach((link) => {
      const active = link.hash === `#${sectionId}`;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  };

  const updateStableAccessibility = () => {
    const trigger = pageState.homeAboutTrigger;
    const visualTimeline = pageState.homeAboutTimeline;
    const progress = visualTimeline?.progress() ?? trigger?.progress ?? (pageState.layoutMode === "content" ? 1 : 0);
    const cinematic = Boolean(trigger && desktopQuery.matches && !reduceMotion.matches);

    if (cinematic && progress > 0.01 && progress < 0.99) {
      setInert(hero, true);
      setInert(aboutSection, true);
      setInert(desktopRail, true);
      hero?.setAttribute("aria-hidden", "true");
      aboutSection?.setAttribute("aria-hidden", "true");
      desktopRail?.setAttribute("aria-hidden", "true");
      return;
    }

    const content = pageState.layoutMode === "content";
    setInert(hero, content);
    setInert(aboutSection, !content && cinematic);
    setInert(desktopRail, !content || !desktopQuery.matches);
    hero?.setAttribute("aria-hidden", String(content));
    aboutSection?.setAttribute("aria-hidden", String(!content && cinematic));
    desktopRail?.setAttribute("aria-hidden", String(!content || !desktopQuery.matches));
  };

  const setActiveSection = (sectionId, { historyMode = "replace", force = false } = {}) => {
    if (!validSection(sectionId)) return;

    // During a menu/hash jump the viewport naturally crosses several chapters.
    // Those intermediate chapters must not become active or consume their word
    // animations before the requested destination is reached.
    if (
      !force
      && pageState.navigationTarget
      && sectionId !== pageState.navigationTarget
    ) return;

    const previousSection = pageState.activeSection;
    const changed = previousSection !== sectionId;
    pageState.activeSection = sectionId;

    // Avoid rewriting every rail link on every scrub frame. Repeated class
    // writes were harmless logically, but they forced extra style/compositing
    // work exactly while the Home menu clones were handing off to the rail.
    if (changed || force) {
      body.dataset.activeSection = sectionId;
      syncNavigation(sectionId);
    }

    if (!pageState.transitioning) applyLayoutMode(sectionId === "home" ? "hero" : "content");
    updateStableAccessibility();

    const navigatingPastSection = pageState.navigationTarget && pageState.navigationTarget !== sectionId;
    if (!pageState.booting && !navigatingPastSection && (changed || force)) {
      const hash = `#${sectionId}`;
      if (historyMode === "push" && window.location.hash !== hash) {
        window.history.pushState({ section: sectionId }, "", hash);
      } else if (historyMode === "replace" && window.location.hash !== hash) {
        window.history.replaceState({ section: sectionId }, "", hash);
      }
    }

    if (pageState.navigationTarget === sectionId) pageState.navigationTarget = null;

    if (changed || force) {
      syncSectionWordReveal(sectionId, { previousSection, force });
    }
  };

  applyLayoutMode(pageState.layoutMode);
  syncNavigation(initialSection);
  body.classList.toggle("is-booting-content", initialSection !== "home");
  const year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());

  const cloneStyleProperties = [
    "display", "align-items", "justify-content", "grid-template-columns", "grid-template-rows",
    "gap", "padding", "border", "border-radius", "background", "background-color", "box-shadow",
    "color", "font-family", "font-size", "font-style", "font-weight", "font-kerning",
    "font-feature-settings", "font-variation-settings", "letter-spacing", "line-height",
    "text-align", "text-transform", "text-shadow", "text-rendering", "white-space", "fill",
    "-webkit-font-smoothing", "-webkit-text-stroke"
  ];

  const removeCloneIds = (clone) => {
    if (clone instanceof Element) {
      clone.removeAttribute("id");
      clone.removeAttribute("href");
      clone.removeAttribute("tabindex");
      clone.setAttribute("aria-hidden", "true");
      $$('[id]', clone).forEach((element) => element.removeAttribute("id"));
    }
  };

  const copyComputedTree = (source, clone) => {
    if (!(source instanceof Element) || !(clone instanceof Element)) return;
    const styles = window.getComputedStyle(source);
    cloneStyleProperties.forEach((property) => {
      clone.style.setProperty(property, styles.getPropertyValue(property));
    });
    const sourceChildren = [...source.children];
    const cloneChildren = [...clone.children];
    sourceChildren.forEach((child, index) => copyComputedTree(child, cloneChildren[index]));
  };

  const createSceneClone = (source, className) => {
    if (!source) return null;
    const clone = source.cloneNode(true);
    removeCloneIds(clone);
    clone.className = `scene-shared-clone ${className}`;
    copyComputedTree(source, clone);
    body.append(clone);
    return clone;
  };

  let sharedRecords = [];
  let sceneClones = [];

  const findFlipElement = (elements, flipId) => elements.find((element) => element.dataset.flipId === flipId);
  const createSharedRecords = () => {
    sceneClones.forEach((clone) => clone.remove());
    sceneClones = [];
    sharedRecords = [];

    const addRecord = (source, destination, type, className) => {
      const clone = createSceneClone(source, className);
      if (!clone) return null;
      const record = {
        source,
        destination,
        type,
        clone,
        sourceRect: null,
        destinationRect: null,
        baseWidth: 0,
        baseHeight: 0,
        initialScaleX: 1,
        initialScaleY: 1
      };
      sceneClones.push(clone);
      sharedRecords.push(record);
      return record;
    };

    addRecord(heroName, railBrandMark, "name", "scene-name-clone");

    ["nav-home", "nav-about", "nav-work", "nav-expect", "nav-services", "nav-process", "nav-faq"]
      .forEach((id) => addRecord(
        findFlipElement(heroSources, id),
        findFlipElement(railTargets, id),
        "nav",
        "scene-nav-clone"
      ));

    ["stat-projects", "stat-workflow"].forEach((id) => addRecord(
      findFlipElement(heroSources, id),
      findFlipElement(railTargets, id),
      "stat",
      "scene-stat-clone"
    ));

    addRecord(
      findFlipElement(heroSources, "cta"),
      findFlipElement(railTargets, "cta"),
      "cta",
      "scene-cta-clone"
    );
  };

  const measureRailAtRest = (callback) => {
    if (!desktopRail) return callback();

    const previous = {
      transition: desktopRail.style.transition,
      transform: desktopRail.style.transform,
      opacity: desktopRail.style.opacity,
      visibility: desktopRail.style.visibility,
      pointerEvents: desktopRail.style.pointerEvents
    };

    Object.assign(desktopRail.style, {
      transition: "none",
      transform: "none",
      opacity: "0",
      visibility: "hidden",
      pointerEvents: "none"
    });

    const result = callback();

    Object.assign(desktopRail.style, previous);
    return result;
  };

  const measureSharedRecords = () => {
    sharedRecords.forEach((record) => {
      const rect = record.source?.getBoundingClientRect();
      if (!rect?.width || !rect?.height) return;

      const baseWidth = record.source.offsetWidth || rect.width;
      const baseHeight = record.source.offsetHeight || rect.height;

      record.sourceRect = rect;
      record.baseWidth = baseWidth;
      record.baseHeight = baseHeight;
      record.initialScaleX = rect.width / baseWidth;
      record.initialScaleY = rect.height / baseHeight;

      Object.assign(record.clone.style, {
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${baseWidth}px`,
        height: `${baseHeight}px`
      });

      gsapEngine?.set(record.clone, {
        x: 0,
        y: 0,
        scaleX: record.initialScaleX,
        scaleY: record.initialScaleY,
        transformOrigin: "0 0",
        force3D: true,
        zIndex: record.type === "name" ? 2850 : undefined
      });
    });

    measureRailAtRest(() => {
      sharedRecords.forEach((record) => {
        if (!record.destination) return;
        const rect = record.destination.getBoundingClientRect();
        record.destinationRect = rect?.width && rect?.height ? rect : null;
      });
    });
  };

  const createNameUnderlayClone = (record) => {
    if (!record?.source || !hero) return null;

    const clone = record.source.cloneNode(true);
    removeCloneIds(clone);
    clone.className = "scene-shared-clone scene-name-clone scene-name-underlay-clone";
    copyComputedTree(record.source, clone);
    hero.append(clone);
    sceneClones.push(clone);
    return clone;
  };

  const measureNameUnderlayClone = (record, clone) => {
    if (!record?.sourceRect || !clone || !hero) return;

    const heroRect = hero.getBoundingClientRect();
    Object.assign(clone.style, {
      position: "absolute",
      top: `${record.sourceRect.top - heroRect.top}px`,
      left: `${record.sourceRect.left - heroRect.left}px`,
      width: `${record.baseWidth}px`,
      height: `${record.baseHeight}px`,
      zIndex: "11"
    });

    gsapEngine?.set(clone, {
      x: 0,
      y: 0,
      scaleX: record.initialScaleX,
      scaleY: record.initialScaleY,
      transformOrigin: "0 0",
      force3D: true
    });
  };

  const destinationTransform = (record) => {
    const sourceRect = record.sourceRect || record.source?.getBoundingClientRect();
    const destinationRect = record.destinationRect || record.destination?.getBoundingClientRect();
    const baseWidth = record.baseWidth || sourceRect?.width;
    const baseHeight = record.baseHeight || sourceRect?.height;

    if (!sourceRect || !destinationRect || !baseWidth || !baseHeight) {
      return { x: 0, y: 0, scaleX: 1, scaleY: 1 };
    }

    return {
      x: destinationRect.left - sourceRect.left,
      y: destinationRect.top - sourceRect.top,
      scaleX: destinationRect.width / baseWidth,
      scaleY: destinationRect.height / baseHeight
    };
  };

  const clearHomeAboutStyles = () => {
    if (!gsapEngine) return;
    gsapEngine.set([
      hero, heroNav, heroName, heroHeadline, heroPortrait, heroPortraitImage,
      aboutSection, aboutShell, desktopRail, railBrand, railBrandMark, railBrandLabel,
      ...aboutRevealTargets, ...aboutMotionDisplayWords, ...aboutMotionCopyWords,
      ...aboutDetailWordTargets, ...aboutDetailWords,
      ...heroSupportingElements, heroQualitiesCard, heroAboutAction,
      ...heroTravelGlass, ...heroNavSeparators, ...heroSources, ...railTargets,
      ...railShells, ...railIcons, ...railOnlyElements
    ].filter(Boolean), {
      clearProps: "opacity,visibility,transform,filter,willChange"
    });
    sceneClones.forEach((clone) => clone.remove());
    sceneClones = [];
    sharedRecords = [];
  };

  const updateHomeAboutState = (trigger, visualTimeline = pageState.homeAboutTimeline) => {
    const progress = visualTimeline?.progress() ?? trigger.progress;

    // Start the About text as soon as the About body has become visible near
    // the end of the Home-to-About cinematic. Waiting until 0.94 made the reveal
    // begin only after Projects was already entering. This earlier threshold
    // keeps the words visible at the About/Projects boundary while preserving
    // the same reverse behavior when scrolling back toward Home.
    const aboutWordTimeline = pageState.aboutWordTimeline;
    const aboutArrivalProgress = 0.80;
    if (aboutWordTimeline) {
      if (progress >= aboutArrivalProgress) {
        if (aboutWordTimeline.reversed() || aboutWordTimeline.progress() < 1) {
          aboutWordTimeline.timeScale(1).play();
        }
      } else if (trigger.direction < 0 && progress < aboutArrivalProgress) {
        aboutWordTimeline.timeScale(1).reverse();
      }
    }

    if (progress > 0.001) root.classList.add("hero-intro-complete");
    pageState.transitioning = progress > 0.001 && progress < 0.999;

    // During reverse scrub, content mode still keeps `.rail-visible` on the
    // body. That CSS state hides the entire Home nav parent and made all menu
    // labels pop back in on one frame at the very top. Keep the parent visible
    // while the timeline is between Home and About; the individual links and
    // traveling clones continue to control their own opacity and positions.
    if (heroNav) {
      if (pageState.transitioning) {
        heroNav.style.opacity = "1";
        heroNav.style.visibility = "visible";
      } else {
        heroNav.style.removeProperty("opacity");
        heroNav.style.removeProperty("visibility");
      }
    }

    pageState.transitionDirection = pageState.transitioning ? (trigger.direction > 0 ? "forward" : "reverse") : null;

    const sectionId = progress < 0.56 ? "home" : "about";
    const workRect = workShowcase?.getBoundingClientRect();
    const { enterWorkAt } = workBoundaryThresholds();
    const workHasTakenOver = Boolean(workRect && workRect.top <= enterWorkAt);

    // The scrubbed Home/About timeline and the document section detector used
    // to write different active links at the same time after a strong wheel
    // input. Once Work has actually reached its activation line, let the
    // document detector own the rail instead of forcing About from this tween.
    if (!workHasTakenOver) {
      setActiveSection(sectionId, { historyMode: "replace" });
    }
    scheduleDocumentState();
  };

  const buildHomeAboutScene = () => {
    if (!gsapEngine || !ScrollTriggerPlugin || !homeAboutScene || !homeAboutStage || !desktopQuery.matches || reduceMotion.matches) {
      return null;
    }

    syncHomeAboutSceneHeight();
    body.classList.add("home-about-enabled");
    createSharedRecords();
    measureSharedRecords();

    const nameRecord = sharedRecords.find((record) => record.type === "name");
    const travelRecords = sharedRecords.filter((record) => ["nav", "stat", "cta"].includes(record.type));
    const nameUnderlayClone = nameRecord ? createNameUnderlayClone(nameRecord) : null;
    if (nameRecord && nameUnderlayClone) measureNameUnderlayClone(nameRecord, nameUnderlayClone);

    // VINCE is represented by one visible layer at every point in the scrub.
    // The in-hero underlay carries the movement behind the model. Once the
    // foreground has faded, an identically transformed fixed clone takes over
    // on the exact same frame so the logo can finish above the incoming rail.
    const directGeometry = { headlineRect: null };

    const measureDirectElements = () => {
      if (heroHeadline) directGeometry.headlineRect = heroHeadline.getBoundingClientRect();
    };

    const headlineExitY = () => {
      const rect = directGeometry.headlineRect;
      return rect ? -rect.top - rect.height * 0.78 : -window.innerHeight * 0.7;
    };

    measureDirectElements();
    const sourceTravelElements = travelRecords.map((record) => record.source).filter(Boolean);
    const destinationTravelElements = travelRecords.map((record) => record.destination).filter(Boolean);
    const clones = sharedRecords.map((record) => record.clone);

    sharedRecords.forEach((record) => {
      gsapEngine.set(record.clone, {
        autoAlpha: 0,
        x: 0,
        y: 0,
        scaleX: record.initialScaleX,
        scaleY: record.initialScaleY,
        filter: "blur(0px)",
        transformOrigin: "0 0",
        force3D: true
      });
    });

    gsapEngine.set(heroHeadline, {
      backfaceVisibility: "hidden",
      willChange: "transform, opacity",
      force3D: false
    });
    gsapEngine.set(heroName, {
      autoAlpha: nameUnderlayClone ? 0 : 1,
      backfaceVisibility: "hidden",
      willChange: "opacity",
      force3D: false
    });
    if (nameUnderlayClone) {
      gsapEngine.set(nameUnderlayClone, {
        autoAlpha: 1,
        filter: "blur(0px)",
        backfaceVisibility: "hidden",
        willChange: "transform, opacity",
        force3D: true
      });
    }
    // Blur the portrait wrapper rather than the image itself. The image keeps
    // its existing contrast/saturation/drop-shadow filter, so GSAP only has to
    // interpolate a simple blur value and the exit stays smooth in both scroll
    // directions.
    gsapEngine.set(heroPortrait, {
      autoAlpha: 1,
      filter: "blur(0px)",
      backfaceVisibility: "hidden",
      willChange: "opacity, filter",
      force3D: true
    });
    gsapEngine.set(heroPortraitImage, {
      transformOrigin: "50% 95%",
      backfaceVisibility: "hidden",
      willChange: "transform",
      force3D: true
    });

    gsapEngine.set(aboutSection, { autoAlpha: 0, yPercent: 14 });
    gsapEngine.set(aboutRevealTargets, { autoAlpha: 0, y: 30 });
    gsapEngine.set(aboutMotionDisplayWords, {
      yPercent: 118,
      autoAlpha: 0,
      filter: "blur(8px)",
      rotate: 0.001,
      force3D: true
    });
    gsapEngine.set(aboutMotionCopyWords, {
      yPercent: 92,
      autoAlpha: 0,
      filter: "blur(5px)",
      force3D: true
    });

    // The About body uses its own autonomous word timeline. The cinematic
    // Home/About scrub only decides when this sequence starts or reverses.
    // This prevents the body copy from finishing invisibly behind its parent
    // and removes the need to keep scrolling toward Projects to reveal it.
    const aboutWordTimeline = gsapEngine.timeline({
      paused: true,
      defaults: { overwrite: "auto" }
    });
    const aboutKindCounts = new Map();

    // About heading words were prepared and hidden by the cinematic setup,
    // but were not attached to any reveal timeline. Keep this fix local to
    // the About header: it now plays automatically with the existing About
    // word sequence and reverses with the Home/About transition.
    if (aboutMotionDisplayWords.length) {
      aboutWordTimeline.to(aboutMotionDisplayWords, {
        yPercent: 0,
        autoAlpha: 1,
        filter: "blur(0px)",
        duration: 0.64,
        stagger: { each: 0.085, from: "start" },
        ease: "power3.out",
        force3D: true
      }, 0);
    }

    if (aboutMotionCopyWords.length) {
      aboutWordTimeline.to(aboutMotionCopyWords, {
        yPercent: 0,
        autoAlpha: 1,
        filter: "blur(0px)",
        duration: 0.52,
        stagger: { each: 0.036, from: "start" },
        ease: "power2.out",
        force3D: true
      }, 0.15);
    }

    aboutDetailWordTargets.forEach((target) => {
      const words = $$('.word-reveal-word', target);
      if (!words.length) return;

      const kind = target.dataset.wordReveal || "copy";
      const isLead = kind === "lead";
      const isMicro = kind === "micro";
      const kindIndex = aboutKindCounts.get(kind) || 0;
      aboutKindCounts.set(kind, kindIndex + 1);

      target.classList.add("word-reveal-item", "automatic-word-target");
      gsapEngine.set(target, { autoAlpha: 1, y: 0, filter: "none" });
      gsapEngine.set(words, {
        yPercent: isLead ? 102 : (isMicro ? 70 : 90),
        autoAlpha: 0,
        filter: isLead ? "blur(6px)" : (isMicro ? "blur(2px)" : "blur(4px)"),
        rotate: 0.001,
        force3D: true
      });

      const start = isLead
        ? 0
        : isMicro
          ? 0.52 + kindIndex * 0.035
          : 0.24 + kindIndex * 0.10;

      aboutWordTimeline.to(words, {
        yPercent: 0,
        autoAlpha: 1,
        filter: "blur(0px)",
        duration: isLead ? 0.58 : (isMicro ? 0.40 : 0.50),
        stagger: { each: isLead ? 0.055 : (isMicro ? 0.025 : 0.036), from: "start" },
        ease: isMicro ? "power2.out" : "power3.out",
        force3D: true
      }, start);
    });

    pageState.aboutWordTimeline = aboutWordTimeline;
    gsapEngine.set(desktopRail, { autoAlpha: 0 });
    gsapEngine.set(railShells, { autoAlpha: 0 });
    gsapEngine.set([...railIcons, ...railOnlyElements, railBrand, railBrandMark, railBrandLabel, ...destinationTravelElements].filter(Boolean), { autoAlpha: 0 });

    let trigger = null;
    const timeline = gsapEngine.timeline({
      defaults: { ease: "none" },
      onUpdate: () => {
        if (trigger) updateHomeAboutState(trigger, timeline);
      }
    });
    timeline
      .to(heroSupportingElements, { autoAlpha: 0, y: -22, duration: 0.22, stagger: 0.015 }, 0.06)
      .to(heroQualitiesCard, { autoAlpha: 0, x: -24, duration: 0.18 }, 0.04)
      .to(heroAboutAction, { autoAlpha: 0, x: -16, duration: 0.18 }, 0.12)
      .to(heroTravelGlass, { autoAlpha: 0, duration: 0.16, stagger: 0.015 }, 0.04)
      .to(heroNavSeparators, { autoAlpha: 0, duration: 0.2, stagger: 0.012 }, 0.08)
      // The source and its traveling clone are pixel-aligned. Swap them on the
      // same timeline frame instead of crossfading; a crossfade briefly showed
      // two copies of the navigation/stat text at slightly different raster
      // positions, which looked like duplicated text.
      .set(sourceTravelElements, { autoAlpha: 0 }, 0.075)
      .set(travelRecords.map((record) => record.clone), {
        autoAlpha: 1,
        force3D: true
      }, 0.075);

    travelRecords.forEach((record, index) => {
      timeline
        .to(record.clone, {
          x: () => destinationTransform(record).x,
          y: () => destinationTransform(record).y,
          scaleX: () => destinationTransform(record).scaleX,
          scaleY: () => destinationTransform(record).scaleY,
          duration: 0.56
        }, 0.12 + index * 0.008)
        .to(record.clone, { autoAlpha: 0, duration: 0.08 }, 0.69 + index * 0.004);
    });

    if (nameRecord && nameUnderlayClone) {
      const travelingNameLayers = [nameUnderlayClone, nameRecord.clone];

      timeline
        // Both layers share one transform curve, but only one is visible.
        // The invisible fixed layer is already at the exact same geometry
        // when the stacking-context handoff occurs, so there is no crossfade,
        // duplicate VINCE, blank frame, or change in velocity.
        .to(travelingNameLayers, {
          x: () => destinationTransform(nameRecord).x,
          y: () => destinationTransform(nameRecord).y,
          scaleX: () => destinationTransform(nameRecord).scaleX,
          scaleY: () => destinationTransform(nameRecord).scaleY,
          duration: 0.72,
          ease: "power2.inOut",
          autoRound: false,
          force3D: true
        }, 0.035)
        .set(nameUnderlayClone, { autoAlpha: 0 }, 0.655)
        .set(nameRecord.clone, { autoAlpha: 1 }, 0.655)
        // The traveling VINCE reaches the rail before dissolving into VA.
        .to(nameRecord.clone, { autoAlpha: 0, duration: 0.15 }, 0.715)
        .to(railBrandMark, { autoAlpha: 1, duration: 0.15 }, 0.715);
    } else {
      timeline.to(railBrandMark, { autoAlpha: 1, duration: 0.15 }, 0.715);
    }

    if (heroHeadline) {
      timeline.to(heroHeadline, {
        y: headlineExitY,
        autoAlpha: 0,
        duration: 0.58,
        ease: "power1.in",
        autoRound: false,
        force3D: false
      }, 0.06);
    }

    if (heroPortraitImage) {
      timeline.to(heroPortraitImage, {
        scaleX: 1.2,
        scaleY: 1.35,
        duration: 0.72,
        ease: "power2.inOut",
        autoRound: false,
        force3D: true
      }, 0.04);
    }

    if (heroPortrait) {
      timeline.to(heroPortrait, {
        filter: "blur(16px)",
        autoAlpha: 0,
        duration: 0.74,
        ease: "power2.inOut",
        autoRound: false,
        force3D: true
      }, 0.04);
    }

    timeline
      // Keep the next chapter behind the single-layer VINCE travel. The
      // About background and rail enter only after the foreground has cleared,
      // matching the reference's uninterrupted logo movement.
      .to(aboutSection, { autoAlpha: 1, yPercent: 0, duration: 0.32 }, 0.655)
      .to(desktopRail, { autoAlpha: 1, duration: 0.2 }, 0.67)
      .to(railShells, { autoAlpha: 1, duration: 0.23, stagger: 0.022 }, 0.69)
      .set(railBrand, { autoAlpha: 1 }, 0.69)
      .to(railBrandLabel, { autoAlpha: 1, duration: 0.17 }, 0.76)
      .to(destinationTravelElements, { autoAlpha: 1, duration: 0.1, stagger: 0.008 }, 0.73)
      .to(railIcons, { autoAlpha: 1, duration: 0.15, stagger: 0.012 }, 0.75)
      .to(railOnlyElements, { autoAlpha: 1, duration: 0.2, stagger: 0.025 }, 0.74)
      .to(aboutHeaderReveal, { autoAlpha: 1, y: 0, duration: 0.18 }, 0.705)
      // Expose the About body first; updateHomeAboutState then starts its
      // autonomous word sequence at this exact chapter-entry threshold.
      .to(aboutDetailReveals, { autoAlpha: 1, y: 0, duration: 0.24, stagger: 0.03 }, 0.79)
      .to(hero, { autoAlpha: 0, duration: 0.1 }, 0.94);

    trigger = ScrollTriggerPlugin.create({
      animation: timeline,
      trigger: homeAboutScene,
      start: "top top",
      end: "+=550",
      pin: homeAboutScene,
      pinSpacing: true,
      scrub: 1.0,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      refreshPriority: 10,
      onRefreshInit: () => {
        const visualProgress = timeline.progress();
        timeline.progress(0).pause();
        measureSharedRecords();
        if (nameRecord && nameUnderlayClone) {
          measureNameUnderlayClone(nameRecord, nameUnderlayClone);
        }
        measureDirectElements();
        timeline.invalidate().progress(visualProgress).pause();
      },
      onRefresh: (self) => updateHomeAboutState(self, timeline),
      onUpdate: (self) => updateHomeAboutState(self, timeline),
      onScrubComplete: (self) => updateHomeAboutState(self, timeline)
    });

    pageState.homeAboutTimeline = timeline;
    pageState.homeAboutTrigger = trigger;
    return () => {
      pageState.homeAboutTimeline = null;
      pageState.homeAboutTrigger = null;
      pageState.aboutWordTimeline?.kill?.();
      pageState.aboutWordTimeline = null;
      trigger.kill(true);
      timeline.kill();
      body.classList.remove("home-about-enabled");
      clearHomeAboutStyles();
    };
  };

  let homeAboutCleanup = null;
  let homeAboutModeEnabled = false;
  const syncHomeAboutMode = ({ force = false } = {}) => {
    const shouldEnable = desktopQuery.matches && !reduceMotion.matches;
    if (!force && shouldEnable === homeAboutModeEnabled) return;

    homeAboutCleanup?.();
    homeAboutCleanup = null;
    homeAboutModeEnabled = false;

    if (shouldEnable) {
      homeAboutCleanup = buildHomeAboutScene();
      homeAboutModeEnabled = Boolean(homeAboutCleanup);
    } else {
      clearHomeAboutStyles();
      clearHomeAboutSceneHeight();
      body.classList.remove("home-about-enabled");
    }
  };

  let workTween = null;
  let workTravel = 0;
  let deferredSceneRefresh = false;
  let deferredAboutSizeRefresh = false;

  const isInsideWorkPin = () => {
    const trigger = workTween?.scrollTrigger;
    if (!trigger) return false;
    const y = window.scrollY;
    return y >= trigger.start - 1 && y <= trigger.end + 1;
  };

  function flushDeferredProjectRefreshes() {
    if (!deferredSceneRefresh && !deferredAboutSizeRefresh) return;

    const rebuildScenes = deferredSceneRefresh;
    const resizeAbout = deferredAboutSizeRefresh;
    deferredSceneRefresh = false;
    deferredAboutSizeRefresh = false;

    window.setTimeout(() => {
      if (isInsideWorkPin()) {
        deferredSceneRefresh ||= rebuildScenes;
        deferredAboutSizeRefresh ||= resizeAbout;
        return;
      }

      if (rebuildScenes) {
        refreshAllScenes();
        return;
      }

      if (resizeAbout) {
        syncHomeAboutSceneHeight();
        refreshPreservingPosition();
      }
    }, 80);
  }

  const destroyWorkShowcase = () => {
    // Kill and fully revert the single Projects scene before rebuilding.
    // Pinning the entire Work section avoids nested pin/spacer jumps.
    workTween?.scrollTrigger?.kill(true);
    workTween?.kill?.();
    workTween = null;

    workShowcase?.classList.remove("is-work-pinned");
    workShowcase?.style.removeProperty("--work-progress");
    workShowcase?.style.removeProperty("--work-natural-settle");
    workShowcase?.style.removeProperty("--work-cards-top");
    workShowcase?.style.removeProperty("--work-card-height");

    if (projectTrack) {
      projectTrack.style.removeProperty("top");
      projectTrack.style.removeProperty("bottom");
      projectTrack.style.removeProperty("height");
    }

    if (gsapEngine && projectTrack) {
      gsapEngine.set(projectTrack, { clearProps: "transform,willChange" });
      const projectCards = $$(".project", projectTrack);
      projectCards.forEach((card) => card.style.removeProperty("height"));
      gsapEngine.set(projectCards, {
        clearProps: "transform,opacity,visibility,willChange"
      });
    }
  };

  const setupWorkShowcase = () => {
    destroyWorkShowcase();
    if (
      !gsapEngine || !ScrollTriggerPlugin || reduceMotion.matches ||
      !desktopQuery.matches || !workShowcase || !workScene || !projectTrack
    ) return;

    const cards = $$(".project", projectTrack);
    if (!cards.length) return;

    const firstCard = cards[0];
    const lastCard = cards[cards.length - 1];
    let workStartX = 0;
    let workEndX = 0;
    let workNaturalSettle = 0;

    const measureWorkGeometry = () => {
      const viewportHeight = Math.max(window.innerHeight, 1);

      // Give the Projects chapter a real vertical entrance runway. The cards
      // begin lower in the section, then normal document scrolling brings
      // them into their final centered position before horizontal motion can
      // start. Nothing inside the pinned scene animates upward independently.
      workNaturalSettle = Math.min(210, Math.max(120, viewportHeight * 0.16));

      // Keep the project row below the complete intro block. Because the Work
      // section is pinned only after the natural settle distance, both the
      // intro and cards shift upward by the same amount. Measuring the intro's
      // real local bottom guarantees a stable gap and prevents the cards from
      // ever sitting underneath the heading or description.
      const sceneRect = workScene.getBoundingClientRect();

      // Use layout measurements instead of transformed screen rectangles.
      // This keeps the result stable before, during, and after reveal effects.
      const introLayoutBottom = workIntro
        ? workIntro.offsetTop + workIntro.offsetHeight
        : 0;

      // Extra safety for layouts where the title and description are separate
      // grid columns. Measure their painted bottoms too, then use the lowest.
      const paintedIntroBottom = [workIntro, workTitleBlock, workDescription]
        .filter(Boolean)
        .reduce((lowestBottom, element) => {
          const rect = element.getBoundingClientRect();
          return Math.max(lowestBottom, rect.bottom - sceneRect.top);
        }, 0);

      const introBottom = Math.max(
        introLayoutBottom,
        paintedIntroBottom,
        viewportHeight * 0.34
      );

      // Guaranteed clear space after the complete intro text.
      const introGap = Math.min(128, Math.max(96, viewportHeight * 0.11));
      const bottomClearance = Math.min(48, Math.max(28, viewportHeight * 0.035));
      const cardsTop = Math.ceil(introBottom + introGap);
      const availableCardHeight =
        viewportHeight + workNaturalSettle - cardsTop - bottomClearance;
      const cardHeight = Math.min(620, Math.max(390, availableCardHeight));

      workShowcase.style.setProperty("--work-natural-settle", `${workNaturalSettle}px`);
      workShowcase.style.setProperty("--work-cards-top", `${cardsTop}px`);
      workShowcase.style.setProperty("--work-card-height", `${cardHeight}px`);

      // A later desktop CSS rule gives .project-grid a fixed clamp() top value,
      // so changing only the CSS variable cannot move the cards. Apply the
      // measured geometry directly with inline priority.
      projectTrack.style.setProperty("top", `${cardsTop}px`, "important");
      projectTrack.style.setProperty("bottom", "auto", "important");
      projectTrack.style.setProperty("height", `${cardHeight}px`, "important");
      cards.forEach((card) => card.style.setProperty("height", "100%", "important"));

      // The pinned content shell owns the permanent rail-safe inset. Center
      // the first and last project cards inside that visible content area so
      // neither end of the horizontal sequence is clipped by the viewport.
      const sceneStyles = window.getComputedStyle(workScene);
      const paddingLeft = Number.parseFloat(sceneStyles.paddingLeft) || 0;
      const paddingRight = Number.parseFloat(sceneStyles.paddingRight) || 0;
      const visibleLeft = sceneRect.left + paddingLeft;
      const visibleRight = sceneRect.right - paddingRight;
      const visibleCenter = (visibleLeft + visibleRight) / 2;

      // Use layout offsets rather than getBoundingClientRect() for the track.
      // The latter includes the current GSAP transform and would make refresh
      // measurements drift as the horizontal animation progresses.
      const trackLayoutLeft = sceneRect.left + projectTrack.offsetLeft;
      const firstCenter = trackLayoutLeft + firstCard.offsetLeft + firstCard.offsetWidth / 2;
      const lastCenter = trackLayoutLeft + lastCard.offsetLeft + lastCard.offsetWidth / 2;

      workStartX = visibleCenter - firstCenter;
      workEndX = visibleCenter - lastCenter;
      workTravel = Math.abs(workEndX - workStartX);

      return { startX: workStartX, endX: workEndX, settle: workNaturalSettle };
    };

    const workMotionDistance = () => {
      measureWorkGeometry();
      const cardDistance = window.innerHeight * Math.max(0.5, cards.length * 0.5);
      const travelDistance = workTravel * 0.5;
      return Math.max(800, cardDistance, travelDistance);
    };

    measureWorkGeometry();

    gsapEngine.set(projectTrack, {
      x: workStartX,
      y: 0,
      force3D: true,
      willChange: "transform"
    });
    gsapEngine.set(cards, {
      yPercent: 0,
      scale: 1,
      autoAlpha: 1,
      force3D: true,
      willChange: "transform, opacity"
    });

    const workTimeline = gsapEngine.timeline({ defaults: { ease: "none" } });

    // The page performs the short vertical settle before pinning. Inside the
    // pin, only horizontal travel is animated, so the cards never appear to
    // rise independently from the Projects page.
    workTimeline.fromTo(projectTrack, {
      x: () => {
        measureWorkGeometry();
        return workStartX;
      },
      y: 0
    }, {
      x: () => {
        measureWorkGeometry();
        return workEndX;
      },
      y: 0,
      duration: 1,
      immediateRender: true,
      force3D: true
    }, 0);

    workTween = workTimeline;
    ScrollTriggerPlugin.create({
      animation: workTimeline,
      trigger: workShowcase,
      start: () => {
        measureWorkGeometry();
        return workShowcase.getBoundingClientRect().top + window.scrollY + workNaturalSettle;
      },
      end: () => `+=${workMotionDistance()}`,
      pin: true,
      pinSpacing: true,
      pinType: "fixed",
      pinReparent: false,
      // Lenis already smooths the actual page scroll. A numeric scrub here
      // adds a second delayed easing layer, which makes the cards keep chasing
      // the scroll position and feel like they are being magnetically pulled
      // into place after the wheel stops.
      anticipatePin: 0,
      scrub: true,
      invalidateOnRefresh: true,
      refreshPriority: 5,
      onRefreshInit: () => {
        measureWorkGeometry();
        gsapEngine.set(projectTrack, { x: workStartX, y: 0 });
      },
      onEnter: () => workShowcase.classList.add("is-work-pinned"),
      onEnterBack: () => workShowcase.classList.add("is-work-pinned"),
      onLeave: () => {
        workShowcase.classList.remove("is-work-pinned");
        flushDeferredProjectRefreshes();
      },
      onLeaveBack: () => {
        workShowcase.classList.remove("is-work-pinned");
        flushDeferredProjectRefreshes();
      },
      onUpdate: (self) => {
        workShowcase.style.setProperty("--work-progress", self.progress.toFixed(4));
        scheduleDocumentState();
      }
    });
  };

  let documentStateFrame = 0;
  let aboutWorkBoundaryState = initialSection === "work" ? "work" : "about";

  const sectionAtMarker = () => {
    const marker = window.innerHeight * 0.38;
    const trigger = pageState.homeAboutTrigger;
    const visualProgress = pageState.homeAboutTimeline?.progress() ?? trigger?.progress ?? 0;
    const workRect = workShowcase?.getBoundingClientRect();
    const { enterWorkAt, returnAboutAt } = workBoundaryThresholds();
    const workHasReachedActivationLine = Boolean(workRect && workRect.top <= enterWorkAt);

    // ScrollTrigger's numeric scrub keeps the visual timeline moving after the
    // scrollbar has already passed the pin end. During that catch-up period,
    // keep Home/About as the single source of truth unless Work has genuinely
    // reached its activation line. This removes the About ↔ Projects flicker.
    if (trigger && (
      window.scrollY <= trigger.end + 1
      || (visualProgress < 0.999 && !workHasReachedActivationLine)
    )) {
      aboutWorkBoundaryState = "about";
      return visualProgress < 0.56 ? "home" : "about";
    }

    // About is still the current chapter while Work is below the activation
    // line. Hysteresis uses a later return line on reverse scroll, preventing
    // tiny wheel movements from alternating the two active rail items.
    if (trigger && workRect && workRect.bottom > marker) {
      if (workRect.top >= returnAboutAt) {
        aboutWorkBoundaryState = "about";
      } else if (workRect.top <= enterWorkAt) {
        aboutWorkBoundaryState = "work";
      }
      return aboutWorkBoundaryState;
    }

    const candidates = trigger ? CONTENT_SECTION_IDS.slice(1) : SECTION_IDS;
    let active = candidates[0] || "home";
    candidates.forEach((id) => {
      const section = sectionElements.get(id);
      if (!section) return;
      const rect = section.getBoundingClientRect();
      if (rect.top <= marker && rect.bottom > marker) active = id;
      else if (rect.top <= marker) active = id;
    });

    if (active === "about" || active === "work") aboutWorkBoundaryState = active;
    return active;
  };

  const updateRailTheme = () => {
    if (!desktopRail) return;

    // Adaptive glass is resolved per surface. Global dark/project classes would
    // recolor every card together and defeat the one-by-one boundary behavior.
    desktopRail.classList.remove("rail-on-dark", "rail-project-mode");
  };


  const updateDocumentState = () => {
    documentStateFrame = 0;
    const available = doc.documentElement.scrollHeight - window.innerHeight;
    const progress = available > 0 ? Math.min(1, Math.max(0, window.scrollY / available)) : 0;
    if (scrollProgress) scrollProgress.style.transform = `scaleX(${progress})`;
    const active = sectionAtMarker();
    setActiveSection(active, { historyMode: "replace" });
    updateRailTheme(active);
    updateAdaptiveRailGlass();
  };

  function scheduleDocumentState() {
    if (!documentStateFrame) documentStateFrame = window.requestAnimationFrame(updateDocumentState);
  }

  const sectionScrollTop = (sectionId) => {
    const trigger = pageState.homeAboutTrigger;
    if (trigger && sectionId === "home") return trigger.start;
    if (trigger && sectionId === "about") return Math.max(trigger.start, trigger.end - 1);
    const target = sectionElements.get(sectionId);
    if (!target) return 0;
    const headerOffset = desktopQuery.matches ? 0 : 72;
    const targetTop = target.getBoundingClientRect().top + window.scrollY - headerOffset;

    // Work has a short natural vertical settle before its horizontal pin starts.
    // Landing on the section's raw top left the 5:7 cards below the viewport,
    // which made their bottoms look cropped. Desktop navigation now lands at
    // the measured pin-start position, where the full card row is visible.
    if (sectionId === "work" && desktopQuery.matches && !reduceMotion.matches) {
      const settle = Number.parseFloat(
        window.getComputedStyle(workShowcase).getPropertyValue("--work-natural-settle")
      ) || 0;
      return Math.max(0, targetTop + settle);
    }

    return Math.max(0, targetTop);
  };

  let sectionNavigationRun = 0;

  const scrollToSection = (sectionId, { behavior = "smooth", historyMode = "none", focus = false } = {}) => {
    if (!validSection(sectionId)) return;

    const navigationRun = ++sectionNavigationRun;
    pageState.navigationTarget = sectionId;

    // Highlight the requested destination immediately, but delay its animation
    // until the scroll has actually arrived. This prevents every chapter passed
    // on the way from auto-playing off-screen.
    body.dataset.activeSection = sectionId;
    syncNavigation(sectionId);

    if (historyMode === "push") {
      const hash = `#${sectionId}`;
      if (window.location.hash !== hash) window.history.pushState({ section: sectionId }, "", hash);
    }

    const top = sectionScrollTop(sectionId);
    let settleFrame = 0;
    let settleDeadline = 0;

    const finishNavigation = () => {
      if (navigationRun !== sectionNavigationRun) return;
      if (settleFrame) window.cancelAnimationFrame(settleFrame);
      pageState.navigationTarget = null;
      setActiveSection(sectionId, { historyMode: "replace", force: true });
      scheduleDocumentState();

      if (focus) {
        const target = sectionElements.get(sectionId);
        const heading = sectionId === "home" ? heroHeadline : $("h2", target);
        heading?.focus?.({ preventScroll: true });
      }
    };

    const waitForNativeScroll = () => {
      if (!settleDeadline) settleDeadline = performance.now() + 1800;
      const arrived = Math.abs(window.scrollY - top) <= 3;
      if (arrived || performance.now() >= settleDeadline) {
        finishNavigation();
        return;
      }
      settleFrame = window.requestAnimationFrame(waitForNativeScroll);
    };

    if (reduceMotion.matches || behavior === "auto") {
      jumpTo(top);
      finishNavigation();
    } else if (smoothScroll) {
      smoothScroll.scrollTo(top, {
        duration: 1.05,
        easing: (value) => 1 - Math.pow(1 - value, 4),
        force: true,
        lock: false,
        onComplete: finishNavigation
      });
    } else {
      window.scrollTo({ top, behavior });
      settleFrame = window.requestAnimationFrame(waitForNativeScroll);
    }
  };

  const menuToggle = $("#menuToggle");
  const mobileMenu = $("#mobileMenu");
  const menuLinks = $$("a", mobileMenu);
  let menuReturnFocus = null;

  const setMenu = (open, restoreFocus = true) => {
    if (!menuToggle || !mobileMenu) return;
    const active = Boolean(open && !desktopQuery.matches);
    mobileMenu.classList.toggle("open", active);
    setInert(mobileMenu, !active && !desktopQuery.matches);
    menuToggle.setAttribute("aria-expanded", String(active));
    const label = $(".sr-only", menuToggle);
    if (label) label.textContent = active ? "Close menu" : "Open menu";
    body.classList.toggle("menu-open", active);
    syncSmoothScrollPause();
    setInert(mobileMenu, !active && !desktopQuery.matches);
    if (active) {
      menuReturnFocus = doc.activeElement;
      menuLinks[0]?.focus();
    } else if (restoreFocus && menuReturnFocus instanceof HTMLElement) {
      menuReturnFocus.focus({ preventScroll: true });
      menuReturnFocus = null;
    }
  };

  menuToggle?.addEventListener("click", () => setMenu(menuToggle.getAttribute("aria-expanded") !== "true"));

  const syncNavigationMode = () => {
    if (!mobileMenu || !menuToggle) return;
    if (desktopQuery.matches) {
      mobileMenu.classList.remove("open");
      setInert(mobileMenu, false);
      menuToggle.setAttribute("aria-expanded", "false");
      body.classList.remove("menu-open");
    } else if (!mobileMenu.classList.contains("open")) setInert(mobileMenu, true);
  };
  syncNavigationMode();

  doc.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
    if (!link) return;
    const sectionId = link.hash.slice(1);
    if (!validSection(sectionId)) return;
    event.preventDefault();
    setMenu(false, false);
    scrollToSection(sectionId, { behavior: "smooth", historyMode: "push", focus: false });
  });

  window.addEventListener("popstate", () => {
    const requested = parseSectionHash();
    const restoreHistorySection = () => {
      scrollToSection(requested, { behavior: "auto", historyMode: "none" });
      setActiveSection(requested, { historyMode: "none", force: true });
    };

    // Browsers may apply their saved scroll position after popstate. Re-align
    // once layout and ScrollTrigger have both observed the history change.
    restoreHistorySection();
    window.requestAnimationFrame(() => window.requestAnimationFrame(restoreHistorySection));
  });

  window.addEventListener("scroll", scheduleDocumentState, { passive: true });
  desktopRail?.addEventListener("scroll", scheduleDocumentState, { passive: true });

  const reveals = $$(".reveal");
  const managedRevealSelector = [
    "#about [data-transition-reveal]", "#work .work-intro", "#work .project",
    "#expect .expect-heading", "#expect .expect-list > div",
    "#services .services-heading", "#services .service-row",
    "#process .section-heading", "#process .process-grid > li",
    "#faq .faq-heading", "#faq .accordion > details"
  ].join(",");

  const setupRevealObservers = () => {
    if (reduceMotion.matches || !("IntersectionObserver" in window)) {
      reveals.forEach((element) => element.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.target.classList.toggle("is-visible", entry.isIntersecting));
    }, { rootMargin: "0px 0px -8%", threshold: 0.08 });
    reveals.filter((element) => !element.matches(managedRevealSelector)).forEach((element) => observer.observe(element));
  };

  let parallaxTweens = [];
  const clearParallax = () => {
    parallaxTweens.forEach((tween) => {
      tween?.scrollTrigger?.kill?.();
      tween?.kill?.();
    });
    parallaxTweens = [];
  };

  const setupSectionParallax = () => {
    clearParallax();
    if (!gsapEngine || !ScrollTriggerPlugin || reduceMotion.matches) return;
    const compact = window.innerWidth <= 768;
    const depth = compact ? 0.52 : 1;

    const addParallax = (target, trigger, fromY, toY) => {
      if (!target || !trigger) return;
      parallaxTweens.push(gsapEngine.fromTo(target, { yPercent: fromY * depth }, {
        yPercent: toY * depth,
        ease: "none",
        scrollTrigger: { trigger, start: "top bottom", end: "bottom top", scrub: true, invalidateOnRefresh: true }
      }));
    };

    const setWordStartState = (words, kind = "copy") => {
      if (!words.length) return;
      const display = kind === "display";
      const micro = kind === "micro";

      gsapEngine.set(words, {
        yPercent: display ? (compact ? 105 : 122) : (micro ? 72 : (compact ? 82 : 96)),
        autoAlpha: 0,
        filter: display
          ? (compact ? "blur(3px)" : "blur(9px)")
          : (micro ? "blur(2px)" : (compact ? "blur(2px)" : "blur(5px)")),
        rotate: 0.001,
        force3D: true
      });
    };

    const addWordMotion = (
      timeline,
      words,
      at,
      {
        duration = 0.5,
        each = 0.045,
        ease = "power3.out"
      } = {}
    ) => {
      if (!words.length) return at;
      timeline.to(words, {
        yPercent: 0,
        autoAlpha: 1,
        filter: "blur(0px)",
        duration,
        stagger: { each, from: "start" },
        ease,
        force3D: true
      }, at);
      return at + duration + Math.max(0, words.length - 1) * each;
    };

    const wordKindForTarget = (target) => {
      const kind = target?.dataset?.wordReveal || "copy";
      return ["display", "lead", "copy", "list", "micro"].includes(kind) ? kind : "copy";
    };

    const timingForKind = (kind) => {
      if (kind === "display") {
        return {
          base: compact ? 0.03 : 0.04,
          groupEach: compact ? 0.07 : 0.09,
          duration: compact ? 0.48 : 0.64,
          wordEach: compact ? 0.058 : 0.085,
          ease: "power3.out"
        };
      }
      if (kind === "lead") {
        return {
          base: compact ? 0.10 : 0.12,
          groupEach: compact ? 0.025 : 0.035,
          duration: compact ? 0.44 : 0.56,
          wordEach: compact ? 0.032 : 0.045,
          ease: "power3.out"
        };
      }
      if (kind === "list") {
        return {
          base: compact ? 0.14 : 0.17,
          groupEach: compact ? 0.028 : 0.040,
          duration: compact ? 0.44 : 0.56,
          wordEach: compact ? 0.040 : 0.058,
          ease: "power3.out"
        };
      }
      if (kind === "micro") {
        return {
          base: compact ? 0.18 : 0.22,
          groupEach: compact ? 0.014 : 0.020,
          duration: compact ? 0.36 : 0.44,
          wordEach: compact ? 0.020 : 0.028,
          ease: "power2.out"
        };
      }
      return {
        base: compact ? 0.12 : 0.15,
        groupEach: compact ? 0.020 : 0.028,
        duration: compact ? 0.40 : 0.52,
        wordEach: compact ? 0.026 : 0.036,
        ease: "power2.out"
      };
    };

    const sectionWordTimelines = new Map();

    const buildAutomaticSectionTimeline = (sectionId, section) => {
      if (!section) return;

      const targets = $$('[data-word-reveal]', section).filter(
        (target) => $$(".word-reveal-word", target).length
      );
      if (!targets.length) return;

      section.classList.add("continuous-scroll-scene", "automatic-word-section");

      // The legacy generic .reveal rule hides each structural wrapper with
      // opacity: 0 and translateY(). The word timeline animates the children,
      // not those wrappers, so headings such as Process and FAQ could remain
      // invisible even after every word had completed its animation.
      // About and Work keep their dedicated cinematic/pinned controllers;
      // all later chapters explicitly expose only the structural containers
      // that own word-reveal content.
      if (sectionId !== "about" && sectionId !== "work") {
        const structuralRevealContainers = new Set();
        targets.forEach((target) => {
          const container = target.closest(".reveal");
          if (container && section.contains(container)) {
            structuralRevealContainers.add(container);
          }
        });

        structuralRevealContainers.forEach((container) => {
          container.classList.add(
            "automatic-word-container",
            "scroll-scene-target",
            "is-visible"
          );
          gsapEngine.set(container, {
            autoAlpha: 1,
            x: 0,
            y: 0,
            filter: "none"
          });
        });
      }

      const timeline = gsapEngine.timeline({
        paused: true,
        defaults: { overwrite: "auto" }
      });

      const kicker = $(".section-kicker", section);
      if (kicker) {
        gsapEngine.set(kicker, {
          y: compact ? 12 : 22,
          autoAlpha: 0,
          filter: compact ? "blur(2px)" : "blur(4px)"
        });
        timeline.to(kicker, {
          y: 0,
          autoAlpha: 1,
          filter: "blur(0px)",
          duration: compact ? 0.36 : 0.46,
          ease: "power2.out"
        }, 0);
      }

      const kindCounts = new Map();
      targets.forEach((target) => {
        const words = $$(".word-reveal-word", target);
        const kind = wordKindForTarget(target);
        const timing = timingForKind(kind);
        const kindIndex = kindCounts.get(kind) || 0;
        kindCounts.set(kind, kindIndex + 1);

        target.classList.add("word-reveal-item", "automatic-word-target");
        gsapEngine.set(target, {
          y: 0,
          autoAlpha: 1,
          filter: "blur(0px)"
        });
        setWordStartState(words, kind);

        // Every text group in the section begins in the same short automatic
        // pass. The small per-group offset preserves visual order without
        // requiring the visitor to keep scrolling through each row or card.
        const at = timing.base + kindIndex * timing.groupEach;
        addWordMotion(timeline, words, at, {
          duration: timing.duration,
          each: timing.wordEach,
          ease: timing.ease
        });
      });

      timeline.eventCallback("onStart", () => {
        section.classList.add("word-section-playing");
      });
      timeline.eventCallback("onComplete", () => {
        section.classList.remove("word-section-playing");
        section.classList.add("word-section-complete");
      });
      timeline.eventCallback("onReverseComplete", () => {
        section.classList.remove("word-section-playing", "word-section-complete");
      });

      sectionWordTimelines.set(sectionId, timeline);
      parallaxTweens.push(timeline);
    };

    // The Projects chapter is one pinned horizontal scene. Its heading,
    // description, cards, and card copy must keep a constant vertical position
    // while only the project track travels left. Separate parallax tweens here
    // made the heading visibly drift and jump during pin entry/reverse scroll.
    const staticWorkTargets = [
      $(".work-title-block", workShowcase),
      $(".work-description", workShowcase),
      ...$$(".project-media, .project-copy", workShowcase)
    ].filter(Boolean);

    gsapEngine.set(staticWorkTargets, {
      clearProps: "transform,opacity,visibility,filter,willChange"
    });

    // The Projects heading uses the automatic word timeline, while its parent
    // still carries the legacy `.reveal` class. Expose only that parent so the
    // existing word animation can be seen; project cards and every other
    // section keep their current controllers unchanged.
    if (workIntro) {
      workIntro.classList.add(
        "automatic-word-container",
        "scroll-scene-target",
        "is-visible"
      );
      gsapEngine.set(workIntro, {
        autoAlpha: 1,
        x: 0,
        y: 0,
        filter: "none"
      });
    }

    // Desktop About remains owned by the Home/About cinematic. Phones do not
    // use that pinned scene, so give About the same compact word reveal as the
    // remaining chapters instead of leaving its copy static.
    if (!desktopQuery.matches) {
      buildAutomaticSectionTimeline("about", aboutSection);
    }

    [
      ["work", workShowcase],
      ["expect", $("#expect")],
      ["services", $("#services")],
      ["process", $("#process")],
      ["faq", $("#faq")],
      ["contact", $("#contact")]
    ].forEach(([sectionId, section]) => buildAutomaticSectionTimeline(sectionId, section));

    // Start only the Projects intro copy before the chapter becomes active.
    // At this point the visitor is still looking at the lower part of About,
    // giving the word reveal enough time to be underway as Work enters view.
    // Navigation jumps keep their existing destination-only behavior.
    const workIntroTimeline = sectionWordTimelines.get("work");
    if (workIntroTimeline && workShowcase) {
      const workIntroPreviewTrigger = ScrollTriggerPlugin.create({
        trigger: workShowcase,
        start: "top 88%",
        onEnter: () => {
          if (!pageState.navigationTarget) {
            workIntroTimeline.timeScale(1).play();
          }
        }
      });
      parallaxTweens.push(workIntroPreviewTrigger);
    }

    // Clicking a rail/hash link or naturally reaching a chapter starts its
    // entire word reveal automatically. Moving back to an earlier chapter
    // reverses the chapter being left, preserving the accepted reverse motion.
    syncSectionWordReveal = (sectionId, { previousSection = null, force = false } = {}) => {
      const currentIndex = SECTION_IDS.indexOf(sectionId);
      const previousIndex = SECTION_IDS.indexOf(previousSection);

      // Reverse only the chapter being left while travelling upward. Earlier
      // chapters stay readable when revisited; the leaving chapter folds away.
      if (
        previousSection &&
        previousSection !== sectionId &&
        currentIndex >= 0 &&
        previousIndex >= 0 &&
        currentIndex < previousIndex
      ) {
        const previousTimeline = sectionWordTimelines.get(previousSection);
        if (previousTimeline) {
          previousTimeline.timeScale(1);
          previousTimeline.reverse();
        }
      }

      const currentTimeline = sectionWordTimelines.get(sectionId);
      if (!currentTimeline) return;

      currentTimeline.timeScale(1);

      // A forced destination arrival must always reveal the target, even after
      // a refresh/rebuild left it paused at an intermediate progress value.
      if (force && currentTimeline.progress() < 0.001) currentTimeline.play(0);
      else currentTimeline.play();
    };

    // Scene rebuilds happen after resize and late asset measurement. Keep all
    // chapters above the current one completed and all later chapters ready,
    // preventing a resize from briefly hiding the active copy.
    if (!pageState.booting) {
      const activeIndex = SECTION_IDS.indexOf(pageState.activeSection);
      sectionWordTimelines.forEach((timeline, sectionId) => {
        const sectionIndex = SECTION_IDS.indexOf(sectionId);
        timeline.progress(sectionIndex <= activeIndex ? 1 : 0).pause();
      });
    }
  };

  if (!reduceMotion.matches && finePointer.matches) {
    $$(".tilt-card").forEach((card) => {
      card.addEventListener("pointermove", (event) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--tilt-x", `${(-((event.clientY - rect.top) / rect.height - 0.5) * 4).toFixed(2)}deg`);
        card.style.setProperty("--tilt-y", `${(((event.clientX - rect.left) / rect.width - 0.5) * 4).toFixed(2)}deg`);
      });
      card.addEventListener("pointerleave", () => {
        card.style.setProperty("--tilt-x", "0deg");
        card.style.setProperty("--tilt-y", "0deg");
      });
    });

    $$(".magnetic").forEach((button) => {
      button.addEventListener("pointermove", (event) => {
        const rect = button.getBoundingClientRect();
        button.style.transform = `translate(${(event.clientX - rect.left - rect.width / 2) * 0.08}px, ${(event.clientY - rect.top - rect.height / 2) * 0.08}px)`;
      });
      button.addEventListener("pointerleave", () => { button.style.transform = ""; });
    });
  }

  $$(".accordion details").forEach((details) => {
    details.addEventListener("toggle", () => {
      if (!details.open) return;
      $$(".accordion details[open]").forEach((other) => { if (other !== details) other.open = false; });
    });
  });

  const dialog = $("#videoDialog");
  const dialogClose = $("#dialogClose");
  const dialogBack = $("#dialogBack");
  const dialogTitle = $("#dialogTitle");
  const dialogSummary = $("#dialogSummary");
  const dialogDuration = $("#dialogDuration");
  const dialogMethod = $("#dialogMethod");
  const dialogRatio = $("#dialogRatio");
  const dialogRole = $("#dialogRole");
  const dialogDeliverables = $("#dialogDeliverables");
  const dialogQuote = $("#dialogQuote");
  const dialogBadge = $("#dialogBadge");
  const dialogOverview = $("#dialogOverview");
  const dialogGoal = $("#dialogGoal");
  const dialogAudience = $("#dialogAudience");
  const dialogStrategy = $("#dialogStrategy");
  const dialogHighlights = $("#dialogHighlights");
  const dialogTagline = $("#dialogTagline");
  const dialogTaglineSub = $("#dialogTaglineSub");
  const dialogProjectStrip = $("#dialogProjectStrip");
  const dialogFullscreen = $("#dialogFullscreen");
  const dialogCta = $("#dialogCta");
  const projectVideo = $("#projectVideo");
  const projectVideoWrap = $(".video-wrap", dialog);
  const projectButtons = $$(".watch-project");
  let dialogOpener = null;
  let activeProjectButton = null;
  let dialogTextTimeline = null;
  let dialogClosing = false;

  // Modal-only word animation. This deliberately stays separate from the
  // page section ScrollTriggers so opening or closing a project cannot alter
  // any of the accepted main-page text timelines.
  const DIALOG_TEXT_TARGET_SELECTOR = [
    ".case-study-kicker",
    ".case-study-left h2",
    ".case-study-summary",
    ".case-study-metrics dt",
    ".case-study-metrics strong",
    ".case-study-metrics span",
    ".case-study-field h3",
    ".case-study-field p",
    ".case-study-deliverables h3",
    ".case-study-deliverables li",
    ".case-study-quote p",
    ".case-study-quote cite",
    ".case-study-author strong",
    ".case-study-author span",
    ".video-badge",
    ".case-study-overview h3",
    ".case-study-overview p",
    ".case-study-insights dt",
    ".case-study-insights dd",
    ".case-study-highlights h3",
    ".case-study-highlights li",
    ".case-study-footer-copy strong",
    ".case-study-footer-copy small",
    ".case-study-cta"
  ].join(",");

  const PROJECT_CASE_STUDIES = {
    "videos/Sample1.mp4": {
      badge: "UGC Video",
      summary: "A warm, creator-led skincare concept built to feel natural, trustworthy, and native to the social feed.",
      duration: "22 sec",
      method: "AI + UGC",
      ratio: "9:16",
      role: "Video Editor + AI Video Specialist",
      deliverables: [
        "Concept and visual direction",
        "AI-assisted UGC production",
        "Editing and on-screen text",
        "Sound design",
        "Color finishing",
        "Platform-ready delivery"
      ],
      quote: "Authentic stories build real connections.",
      overview: "This creator-led skincare video was designed to showcase the product in a warm, everyday setting. The edit balances natural delivery, clear benefit callouts, and social-first pacing so the product remains the visual focus.",
      goal: "Build product trust and encourage action through relatable storytelling.",
      audience: "Skincare and beauty audiences on social platforms.",
      strategy: "Warm lifestyle imagery, benefit-led copy, creator-style pacing, and clear product emphasis.",
      highlights: [
        "Natural creator-first presentation",
        "Benefit-focused on-screen text",
        "Strong product visibility",
        "Warm sound and color finish",
        "Optimized vertical delivery"
      ],
      tagline: "Turning Real Experiences into Powerful Stories",
      taglineSub: "UGC content that connects, converts, and builds brand trust."
    },
    "videos/Sample3.mp4": {
      badge: "AI Explainer",
      summary: "A structured, fast-moving explainer that turns an emerging creator-economy topic into a clear visual story.",
      duration: "40 sec",
      method: "AI + Motion",
      ratio: "9:16",
      role: "Creative Editor + Motion Designer",
      deliverables: [
        "Concept and prompt development",
        "AI visual sequence creation",
        "Narrative editing and pacing",
        "Motion graphics",
        "Sound design",
        "Final social export"
      ],
      quote: "Clarity makes complex ideas watchable.",
      overview: "The project explains how AI is changing creator workflows through a tightly structured sequence of generated visuals, kinetic typography, and sound-led transitions. Each beat was designed to keep the information clear without losing energy.",
      goal: "Explain a complex trend quickly while maintaining strong audience retention.",
      audience: "Creators, marketers, digital teams, and AI-curious viewers.",
      strategy: "High-contrast visuals, concise narrative beats, energetic pacing, and motion-led emphasis.",
      highlights: [
        "Coherent AI-generated visual language",
        "Fast but readable information flow",
        "Motion-driven transitions",
        "Strong hook and closing beat",
        "Vertical social-first composition"
      ],
      tagline: "Complex Ideas, Shaped into Clear Visual Stories",
      taglineSub: "Explainer content built for attention, clarity, and modern audiences."
    },
    "videos/Sample4.mp4": {
      badge: "Product Film",
      summary: "A bold fitness product commercial built around intensity, product presence, and fast social-feed impact.",
      duration: "38 sec",
      method: "Product + AI",
      ratio: "9:16",
      role: "Video Editor + Creative Direction",
      deliverables: [
        "Product-focused creative direction",
        "AI-assisted image development",
        "Editing and visual pacing",
        "Motion graphics",
        "Sound design",
        "Color and final delivery"
      ],
      quote: "Energy should be felt before it is explained.",
      overview: "This pre-workout concept uses bold product imagery, high-energy pacing, and punchy sound design to create immediate visual impact. The edit keeps the container and performance message central throughout the sequence.",
      goal: "Create excitement around the product and make the performance benefit feel immediate.",
      audience: "Fitness audiences, gym-goers, and performance-focused consumers.",
      strategy: "High-energy imagery, strong contrast, rhythmic cuts, product repetition, and concise benefit messaging.",
      highlights: [
        "Bold product-first visual hierarchy",
        "High-energy edit rhythm",
        "AI-assisted campaign imagery",
        "Impactful sound and motion",
        "Social-ready vertical delivery"
      ],
      tagline: "High-Energy Product Stories Built to Perform",
      taglineSub: "Commercial edits that make the product clear, memorable, and hard to ignore."
    },
    "videos/Sample5.mp4": {
      badge: "Skincare UGC",
      summary: "A creator-led peptide serum video built around a clear product message and an approachable social-first presentation.",
      duration: "27 sec",
      method: "UGC + Editing",
      ratio: "9:16",
      role: "Video Editor + AI Video Specialist",
      deliverables: [
        "Product-led story structure",
        "Creator-style video editing",
        "On-screen text and benefit callouts",
        "Sound design",
        "Color finishing",
        "Vertical social delivery"
      ],
      quote: "A clear product story makes every benefit easier to remember.",
      overview: "This peptide serum video uses a creator-led presentation, readable benefit callouts, and a focused vertical composition to keep the skincare product and its message easy to follow.",
      goal: "Present the serum benefits clearly through an approachable creator-style video.",
      audience: "Skincare audiences viewing short-form social content.",
      strategy: "Creator-led framing, product visibility, concise benefit messaging, and mobile-first pacing.",
      highlights: [
        "Clear peptide serum product focus",
        "Firming, hydrating, and smoothing callouts",
        "Creator-first presentation",
        "Readable vertical composition",
        "Social-ready 9:16 delivery"
      ],
      tagline: "Clear Skincare Stories Made for Social",
      taglineSub: "Creator-led edits that keep the product visible and the message easy to understand."
    }
  };

  const setDialogText = (element, value = "") => {
    if (element) element.textContent = value;
  };

  const renderDialogList = (element, items = []) => {
    if (!element) return;
    element.replaceChildren(...items.map((item) => {
      const li = doc.createElement("li");
      li.textContent = item;
      return li;
    }));
  };

  const resetDialogWordTarget = (target) => {
    if (!target) return;

    $$(".word-reveal-mask", target).forEach((mask) => {
      mask.replaceWith(doc.createTextNode(mask.textContent || ""));
    });
    target.normalize();
    delete target.dataset.wordRevealReady;
    target.classList.remove("word-reveal-target", "dialog-word-target");
  };

  const prepareDialogTextTimeline = () => {
    dialogTextTimeline?.kill?.();
    dialogTextTimeline = null;

    if (!dialog) return null;

    const targets = $$(DIALOG_TEXT_TARGET_SELECTOR, dialog).filter(
      (target) => (target.textContent || "").trim().length > 0
    );

    targets.forEach((target) => {
      resetDialogWordTarget(target);
      prepareWordRevealTarget(target);
      target.classList.add("dialog-word-target");
    });

    const groups = targets
      .map((target) => $$(".word-reveal-word", target))
      .filter((words) => words.length);
    const words = groups.flat();

    if (!words.length || !gsapEngine || reduceMotion.matches) {
      gsapEngine?.set?.(words, { clearProps: "transform,opacity,filter" });
      return null;
    }

    gsapEngine.set(words, {
      yPercent: 115,
      opacity: 0,
      filter: "blur(8px)",
      rotateX: -8,
      transformOrigin: "50% 100%"
    });

    dialogTextTimeline = gsapEngine.timeline({ paused: true });
    groups.forEach((group, index) => {
      // Text blocks enter in reading order, while words inside each block use
      // the same slow masked rise and blur-to-clear language as the main page.
      dialogTextTimeline.to(group, {
        yPercent: 0,
        opacity: 1,
        filter: "blur(0px)",
        rotateX: 0,
        duration: 0.62,
        stagger: 0.028,
        ease: "power3.out"
      }, Math.min(index * 0.045, 0.72));
    });

    return dialogTextTimeline;
  };

  const playDialogTextIn = () => {
    const timeline = prepareDialogTextTimeline();
    if (!timeline) return;
    window.requestAnimationFrame(() => timeline.play(0));
  };

  const projectDetailsFor = (button) => {
    const videoPath = button?.dataset.video || "";
    return PROJECT_CASE_STUDIES[videoPath] || {
      badge: "Selected Work",
      summary: "A selected video project shaped around attention, clarity, and story.",
      duration: "Project",
      method: "Editing",
      ratio: "Multi-format",
      role: "Video Editor + AI Video Specialist",
      deliverables: ["Editing", "Sound design", "Color finishing", "Final delivery"],
      quote: "Every frame should have a reason to be there.",
      overview: "This project combines hands-on editing, visual direction, sound, and finishing to create a clear, platform-ready result.",
      goal: "Create a polished video that communicates clearly and keeps attention.",
      audience: "Digital and social audiences.",
      strategy: "Story-led pacing, clear visual hierarchy, and purposeful finishing.",
      highlights: ["Story-led editing", "Clear pacing", "Platform-ready delivery"],
      tagline: "Story-Led Editing, Built for Attention",
      taglineSub: "Video work shaped around clarity, performance, and memorable visual moments."
    };
  };

  const resetProjectVideoFit = () => {
    projectVideoWrap?.removeAttribute("data-orientation");
    projectVideoWrap?.style.removeProperty("--project-video-ratio");
  };

  const syncProjectVideoFit = () => {
    if (!projectVideo || !projectVideoWrap) return;
    const width = projectVideo.videoWidth;
    const height = projectVideo.videoHeight;
    if (!width || !height) return;

    const ratio = width / height;
    projectVideoWrap.style.setProperty("--project-video-ratio", `${width} / ${height}`);
    projectVideoWrap.dataset.orientation = ratio < 0.9
      ? "portrait"
      : ratio > 1.1
        ? "landscape"
        : "square";
  };

  const updateProjectStripState = () => {
    $$("button", dialogProjectStrip).forEach((stripButton) => {
      const active = stripButton.dataset.video === activeProjectButton?.dataset.video;
      stripButton.classList.toggle("is-active", active);
      stripButton.setAttribute("aria-current", active ? "true" : "false");
    });
  };

  const renderProjectDetails = (button) => {
    const detail = projectDetailsFor(button);
    setDialogText(dialogTitle, button?.dataset.title || "Project Film");
    setDialogText(dialogSummary, detail.summary);
    setDialogText(dialogDuration, detail.duration);
    setDialogText(dialogMethod, detail.method);
    setDialogText(dialogRatio, detail.ratio);
    setDialogText(dialogRole, detail.role);
    setDialogText(dialogQuote, detail.quote);
    setDialogText(dialogBadge, detail.badge);
    setDialogText(dialogOverview, detail.overview);
    setDialogText(dialogGoal, detail.goal);
    setDialogText(dialogAudience, detail.audience);
    setDialogText(dialogStrategy, detail.strategy);
    setDialogText(dialogTagline, detail.tagline);
    setDialogText(dialogTaglineSub, detail.taglineSub);
    renderDialogList(dialogDeliverables, detail.deliverables);
    renderDialogList(dialogHighlights, detail.highlights);
  };

  const loadProjectIntoDialog = (button, { autoplay = true } = {}) => {
    if (!button || !projectVideo) return;
    activeProjectButton = button;
    resetProjectVideoFit();
    renderProjectDetails(button);
    updateProjectStripState();

    const videoPath = button.dataset.video || "";
    projectVideo.pause();
    projectVideo.src = videoPath;
    if (button.dataset.poster) projectVideo.poster = button.dataset.poster;
    else projectVideo.removeAttribute("poster");
    projectVideo.setAttribute("aria-label", `${button.dataset.title || "Project"} video`);
    projectVideo.load();

    if (autoplay) {
      const playback = projectVideo.play();
      playback?.catch?.(() => {});
    }
  };

  const switchProjectInDialog = (button) => {
    if (!button || button === activeProjectButton || dialogClosing) return;

    const loadNextProject = () => {
      loadProjectIntoDialog(button);
      playDialogTextIn();
    };

    if (
      !dialogTextTimeline
      || !gsapEngine
      || reduceMotion.matches
      || dialogTextTimeline.progress() <= 0.01
    ) {
      loadNextProject();
      return;
    }

    projectVideo?.pause?.();
    dialogTextTimeline.eventCallback("onReverseComplete", loadNextProject);
    dialogTextTimeline.timeScale(1.45).reverse();
  };

  const buildProjectStrip = () => {
    if (!dialogProjectStrip || dialogProjectStrip.childElementCount) return;

    projectButtons.forEach((button, index) => {
      const stripButton = doc.createElement("button");
      stripButton.type = "button";
      stripButton.className = "dialog-project-thumb";
      stripButton.dataset.video = button.dataset.video || "";
      stripButton.setAttribute("aria-label", `Play ${button.dataset.title || `project ${index + 1}`}`);

      const image = doc.createElement("img");
      image.src = button.dataset.poster || "";
      image.alt = "";
      image.loading = "lazy";

      const number = doc.createElement("span");
      number.textContent = String(index + 1).padStart(2, "0");

      const title = doc.createElement("strong");
      title.textContent = button.dataset.title || `Project ${index + 1}`;

      stripButton.append(image, number, title);
      stripButton.addEventListener("click", () => switchProjectInDialog(button));
      dialogProjectStrip.append(stripButton);
    });
  };

  projectVideo?.addEventListener("loadedmetadata", syncProjectVideoFit);

  const releaseVideo = () => {
    if (!projectVideo) return;
    projectVideo.pause();
    projectVideo.removeAttribute("src");
    projectVideo.removeAttribute("poster");
    projectVideo.load();
    resetProjectVideoFit();
    activeProjectButton = null;
    updateProjectStripState();
  };

  const finalizeDialogClose = () => {
    if (dialog?.open) dialog.close();
  };

  const closeDialog = () => {
    if (!dialog?.open || dialogClosing) return;
    dialogClosing = true;
    projectVideo?.pause?.();

    if (
      !dialogTextTimeline
      || !gsapEngine
      || reduceMotion.matches
      || dialogTextTimeline.progress() <= 0.01
    ) {
      finalizeDialogClose();
      return;
    }

    // Reverse the exact entrance timeline so the words leave through their
    // masks instead of the dialog disappearing abruptly.
    dialogTextTimeline.eventCallback("onReverseComplete", finalizeDialogClose);
    dialogTextTimeline.timeScale(1.35).reverse();
  };

  buildProjectStrip();

  projectButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const videoPath = button.dataset.video || "";
      if (!dialog || !projectVideo || typeof dialog.showModal !== "function") {
        if (videoPath) window.location.href = videoPath;
        return;
      }

      dialogOpener = button;
      body.classList.add("dialog-open");
      syncSmoothScrollPause();
      dialog.showModal();
      loadProjectIntoDialog(button);
      playDialogTextIn();
      dialogBack?.focus();
    });
  });

  dialogFullscreen?.addEventListener("click", async () => {
    if (!projectVideo) return;
    try {
      if (projectVideo.requestFullscreen) await projectVideo.requestFullscreen();
      else if (projectVideo.webkitEnterFullscreen) projectVideo.webkitEnterFullscreen();
    } catch (error) {
      console.warn("Fullscreen mode could not be opened.", error);
    }
  });

  dialogBack?.addEventListener("click", closeDialog);
  dialogClose?.addEventListener("click", closeDialog);
  dialogCta?.addEventListener("click", closeDialog);
  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog();
  });
  dialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDialog();
  });
  dialog?.addEventListener("close", () => {
    dialogTextTimeline?.kill?.();
    dialogTextTimeline = null;
    dialogClosing = false;
    releaseVideo();
    body.classList.remove("dialog-open");
    syncSmoothScrollPause();
    if (dialogOpener instanceof HTMLElement) dialogOpener.focus({ preventScroll: true });
    dialogOpener = null;
  });
  doc.addEventListener("play", (event) => {
    if (!(event.target instanceof HTMLMediaElement)) return;
    $$("video, audio").forEach((media) => { if (media !== event.target) media.pause(); });
  }, true);

  const copyText = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      const field = doc.createElement("textarea");
      field.value = value;
      Object.assign(field.style, { position: "fixed", opacity: "0" });
      body.append(field);
      field.select();
      const copied = doc.execCommand("copy");
      field.remove();
      return copied;
    }
  };

  const bindCopyButton = (button, status, successLabel) => {
    button?.addEventListener("click", async () => {
      const copied = button.dataset.email ? await copyText(button.dataset.email) : false;
      if (status) status.textContent = copied ? successLabel : "Unable to copy";
      window.setTimeout(() => { if (status) status.textContent = ""; }, 3000);
    });
  };
  bindCopyButton($("#copyEmail"), $("#copyStatus"), "Email copied.");
  bindCopyButton($("#railCopyEmail"), $("#railCopyStatus"), "Copied");

  $("#contactForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement) || !form.reportValidity()) return;
    const data = new FormData(form);
    const subject = `Portfolio inquiry - ${data.get("type")}`;
    const message = [
      `Name: ${data.get("name")}`,
      `Email: ${data.get("email")}`,
      `Project type: ${data.get("type")}`,
      `Budget: ${data.get("budget")}`,
      "",
      "Project details:",
      data.get("details")
    ].join("\n");
    const gmailUrl = [
      "https://mail.google.com/mail/?view=cm&fs=1",
      `to=${encodeURIComponent("itsmeakiravince@gmail.com")}`,
      `su=${encodeURIComponent(subject)}`,
      `body=${encodeURIComponent(message)}`
    ].join("&");

    // Open Gmail directly instead of relying on a system mailto handler.
    // Because this runs from the user's submit click, browsers normally allow
    // the new compose tab. If popups are blocked, use the current tab instead.
    const composeWindow = window.open(gmailUrl, "_blank");
    if (composeWindow) composeWindow.opener = null;
    else window.location.href = gmailUrl;
  });

  doc.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuToggle?.getAttribute("aria-expanded") === "true") {
      setMenu(false);
      return;
    }
    if (event.key !== "Tab" || menuToggle?.getAttribute("aria-expanded") !== "true") return;
    const focusable = [menuToggle, ...menuLinks].filter(Boolean);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && doc.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && doc.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });

  const refreshPreservingPosition = () => {
    if (!ScrollTriggerPlugin) return;

    const previousY = window.scrollY;
    const homeTrigger = pageState.homeAboutTrigger;
    const currentWorkTrigger = workTween?.scrollTrigger;

    const insideHome = Boolean(
      homeTrigger && previousY >= homeTrigger.start - 1 && previousY <= homeTrigger.end + 1
    );
    const insideWork = Boolean(
      currentWorkTrigger && previousY >= currentWorkTrigger.start - 1 && previousY <= currentWorkTrigger.end + 1
    );

    const homeProgress = insideHome ? homeTrigger.progress : null;
    const workProgress = insideWork ? currentWorkTrigger.progress : null;

    ScrollTriggerPlugin.refresh();

    if (workProgress !== null && workTween?.scrollTrigger) {
      const refreshedWork = workTween.scrollTrigger;
      const mappedY = refreshedWork.start + workProgress * (refreshedWork.end - refreshedWork.start);
      if (Math.abs(window.scrollY - mappedY) > 1) jumpTo(mappedY);
    } else if (homeProgress !== null && pageState.homeAboutTrigger) {
      const refreshedHome = pageState.homeAboutTrigger;
      const mappedY = refreshedHome.start + homeProgress * (refreshedHome.end - refreshedHome.start);
      if (Math.abs(window.scrollY - mappedY) > 1) jumpTo(mappedY);
    }

    ScrollTriggerPlugin.update();
    scheduleDocumentState();
  };

  let resizeTimer = 0;
  let lastDesktopMode = desktopQuery.matches;
  const refreshAllScenes = ({ forceModeSync = false } = {}) => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      const breakpointChanged = lastDesktopMode !== desktopQuery.matches;
      lastDesktopMode = desktopQuery.matches;

      // Never destroy and recreate the active Projects pin. Late font/image
      // measurements previously rebuilt this scene mid-scroll, exposing About
      // for one frame and creating the visible vertical bounce.
      if (isInsideWorkPin() && !breakpointChanged && !forceModeSync) {
        deferredSceneRefresh = true;
        return;
      }

      syncNavigationMode();
      syncSmoothScrollMode({ force: forceModeSync || breakpointChanged });
      smoothScroll?.resize?.();
      syncHomeAboutMode({ force: forceModeSync || breakpointChanged });
      syncHomeAboutSceneHeight();
      setupWorkShowcase();
      setupSectionParallax();
      refreshPreservingPosition();
    }, 160);
  };

  let aboutSizeRefreshTimer = 0;
  const scheduleAboutSizeRefresh = () => {
    if (!desktopQuery.matches) return;
    window.clearTimeout(aboutSizeRefreshTimer);
    aboutSizeRefreshTimer = window.setTimeout(() => {
      // Do not mutate the Home/About scene height while Projects is pinned.
      // Changing an earlier section's height invalidates the current pin start
      // and can make the viewport jump backward before ScrollTrigger refreshes.
      if (isInsideWorkPin()) {
        deferredAboutSizeRefresh = true;
        return;
      }

      const previousHeight = homeAboutScene?.offsetHeight || 0;
      syncHomeAboutSceneHeight();
      const nextHeight = homeAboutScene?.offsetHeight || 0;
      if (Math.abs(nextHeight - previousHeight) > 1) refreshPreservingPosition();
      else scheduleDocumentState();
    }, 100);
  };

  const aboutResizeObserver = typeof ResizeObserver === "function" && aboutShell
    ? new ResizeObserver(scheduleAboutSizeRefresh)
    : null;
  aboutResizeObserver?.observe(aboutShell);
  $$("img", aboutSection).forEach((image) => {
    if (!image.complete) image.addEventListener("load", scheduleAboutSizeRefresh, { once: true });
  });

  window.addEventListener("resize", () => refreshAllScenes(), { passive: true });
  reduceMotion.addEventListener?.("change", () => refreshAllScenes({ forceModeSync: true }));
  finePointer.addEventListener?.("change", () => refreshAllScenes({ forceModeSync: true }));

  let pageIntroPlayed = false;
  let pageIntroTimeline = null;

  const finishPageIntro = ({ removeOverlay = true } = {}) => {
    if (pageIntroTimeline) {
      pageIntroTimeline.kill();
      pageIntroTimeline = null;
    }

    root.classList.remove("page-intro-pending");
    body.classList.remove("page-intro-active");
    pageIntro?.style.removeProperty("display");
    pageIntro?.style.removeProperty("opacity");
    pageIntro?.style.removeProperty("visibility");
    if (removeOverlay) pageIntro?.replaceChildren();

    // Resume input without re-measuring the live Home scene on the exact
    // clone-to-DOM handoff frame. The intro clone was already measured from
    // this scene, so an immediate Lenis resize / ScrollTrigger update can
    // produce a tiny final settle that looks like another layer repositioning.
    smoothScroll?.start?.();
    window.requestAnimationFrame(() => scheduleDocumentState());
  };

  const buildIntroHeroClone = () => {
    if (!pageIntro || !hero) return null;

    const clone = hero.cloneNode(true);
    removeCloneIds(clone);
    clone.removeAttribute("aria-labelledby");
    clone.classList.add("page-intro-hero-clone");
    clone.setAttribute("aria-hidden", "true");

    // The accepted Home scene uses its in-hero underlay as the only visible
    // VINCE layer at scroll progress zero. Keep that exact layer in the intro
    // clone and remove any redundant hidden copy.
    const underlayName = $(".scene-name-underlay-clone", clone);
    const originalName = $(":scope > .hero-name", clone);
    if (underlayName && originalName) originalName.remove();

    // Fixed transition clones live outside #home and are intentionally not
    // copied. Interactive attributes are also stripped from the temporary UI.
    $$('a, button, input, select, textarea, [tabindex]', clone).forEach((element) => {
      element.removeAttribute("href");
      element.removeAttribute("tabindex");
      element.setAttribute("aria-hidden", "true");
    });

    pageIntro.replaceChildren(clone);
    return clone;
  };

  const startPageIntro = () => {
    if (pageIntroPlayed) return;
    pageIntroPlayed = true;

    const requested = root.classList.contains("page-intro-pending");
    const canRun = requested
      && Boolean(gsapEngine)
      && Boolean(pageIntro)
      && Boolean(hero)
      && desktopQuery.matches
      && !reduceMotion.matches
      && initialSection === "home"
      && window.scrollY < 8;

    if (!canRun) {
      finishPageIntro();
      return;
    }

    root.classList.add("hero-intro-complete");
    body.classList.add("page-intro-active");
    root.classList.remove("page-intro-pending");
    smoothScroll?.stop();

    const introHero = buildIntroHeroClone();
    if (!introHero) {
      finishPageIntro();
      return;
    }

    const introName = $(".scene-name-underlay-clone", introHero)
      || $(":scope > .hero-name", introHero);
    const introPortrait = $(".hero-portrait", introHero);
    const introPortraitImage = $("img", introPortrait);
    const introHeadlineLines = $$(".hero-center h1 span", introHero);
    const introActions = $(".hero-actions", introHero);
    const introCards = $$(".hero-card", introHero);
    const introNav = $(".hero-nav", introHero);
    const introSupport = $$(".hero-identity, .hero-description, .hero-scroll", introHero);

    if (!introName || !introPortrait || !introPortraitImage) {
      finishPageIntro();
      return;
    }

    // Keep the portrait image's own color treatment unchanged throughout the
    // intro. Blur the wrapper instead of interpolating the image filter list;
    // this prevents temporary contrast/saturation shifts in skin tones.
    const introPortraitBlur = "blur(20px)";

    // Keep the first beat completely blank, then let VINCE travel in from the
    // right exactly like the supplied reference. Everything after that is a
    // staged reveal inside a disposable clone, leaving the production scene
    // and its scrubbed GSAP state untouched.
    pageIntroTimeline = gsapEngine.timeline({
      defaults: { overwrite: false },
      onComplete: () => finishPageIntro()
    });

    pageIntroTimeline
      .from(introName, {
        x: Math.max(window.innerWidth * 0.94, 980),
        duration: 1.08,
        ease: "power4.out",
        force3D: true
      }, 0.34)
      .from(introPortrait, {
        autoAlpha: 0,
        y: 72,
        scale: 1.035,
        filter: introPortraitBlur,
        duration: 0.78,
        ease: "power3.out",
        force3D: true
      }, 1.34)
      .from(introHeadlineLines, {
        autoAlpha: 0,
        yPercent: 105,
        clipPath: "inset(100% 0 0)",
        duration: 0.54,
        stagger: 0.065,
        ease: "power3.out"
      }, 1.62)
      .from(introActions, {
        autoAlpha: 0,
        y: 22,
        duration: 0.44,
        ease: "power3.out"
      }, 1.82)
      .from(introCards, {
        autoAlpha: 0,
        y: 26,
        scale: 0.975,
        duration: 0.5,
        stagger: 0.075,
        ease: "power3.out"
      }, 1.83)
      .from([introNav, ...introSupport].filter(Boolean), {
        autoAlpha: 0,
        y: 18,
        duration: 0.46,
        stagger: 0.055,
        ease: "power3.out"
      }, 1.92)
      // Use one atomic clone-to-live swap. Crossfading two independently
      // rasterized copies can create a subtle double edge and apparent final
      // reposition even when their CSS geometry is the same.
      .call(() => {
        pageState.homeAboutTimeline?.progress(0).pause();
        gsapEngine.set(hero, { autoAlpha: 1 });
      }, null, 2.50)
      .set(pageIntro, { autoAlpha: 0 }, 2.52);
  };

  let bootComplete = false;
  const completeBoot = () => {
    if (bootComplete) return;
    bootComplete = true;

    // Browsers can apply their saved reload position after the head script.
    // Reassert Home before and after ScrollTrigger measures the document.
    if (isReload) jumpTo(0);

    syncHomeAboutSceneHeight();
    setupWorkShowcase();
    setupSectionParallax();
    ScrollTriggerPlugin?.refresh?.();
    if (isReload) jumpTo(0);

    const shouldAlignToHash = !restoringDocumentPosition && initialSection !== "home";
    if (shouldAlignToHash) jumpTo(sectionScrollTop(initialSection));
    ScrollTriggerPlugin?.update?.();

    pageState.booting = false;
    body.classList.remove("is-booting-content");
    root.classList.add("motion-ready");

    const stableSection = isReload
      ? "home"
      : (restoringDocumentPosition ? sectionAtMarker() : initialSection);
    setActiveSection(stableSection, { historyMode: "replace", force: true });
    if (!restoringDocumentPosition) {
      window.history.replaceState({ section: stableSection }, "", `#${stableSection}`);
    }
    scheduleDocumentState();
    startPageIntro();
  };

  syncSmoothScrollMode({ force: true });
  syncHomeAboutMode({ force: true });
  setupRevealObservers();
  if (root.classList.contains("page-intro-pending")) {
    root.classList.add("hero-intro-complete");
  } else if (initialSection !== "home" || restoringDocumentPosition) {
    root.classList.add("hero-intro-complete");
  } else {
    window.setTimeout(() => root.classList.add("hero-intro-complete"), 900);
  }

  const fontsReady = doc.fonts?.ready || Promise.resolve();
  Promise.race([
    fontsReady,
    new Promise((resolve) => window.setTimeout(resolve, 800))
  ]).then(() => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(completeBoot));
  });

  fontsReady.then(() => {
    if (bootComplete) refreshAllScenes();
  });

  window.addEventListener("load", () => {
    if (!bootComplete) completeBoot();
    else {
      syncHomeAboutSceneHeight();
      refreshPreservingPosition();
    }
  }, { once: true });

  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    window.requestAnimationFrame(() => {
      smoothScroll?.resize?.();
      smoothScroll?.start?.();
      ScrollTriggerPlugin?.refresh?.();
      ScrollTriggerPlugin?.update?.();
      scheduleDocumentState();
    });
  });

  window.addEventListener("pagehide", () => {
    pageIntroTimeline?.kill();
    aboutResizeObserver?.disconnect();
    releaseVideo();
  });
})();
