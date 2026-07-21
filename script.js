(() => {
  "use strict";

  const doc = document;
  const root = doc.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const $ = (selector, scope = doc) => scope.querySelector(selector);
  const $$ = (selector, scope = doc) => [...scope.querySelectorAll(selector)];

  root.classList.replace("no-js", "js");

  const year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());

  const scrollProgress = $("#scrollProgress");
  const hero = $(".hero");
  const heroPortrait = $("#heroPortrait");
  let scrollFrame = 0;

  const updateScrollState = () => {
    scrollFrame = 0;
    const available = doc.documentElement.scrollHeight - window.innerHeight;
    const progress = available > 0 ? Math.min(1, window.scrollY / available) : 0;
    if (scrollProgress) scrollProgress.style.transform = `scaleX(${progress})`;

    if (heroPortrait && hero && !reduceMotion.matches) {
      const heroBottom = hero.offsetTop + hero.offsetHeight;
      const shift = window.scrollY < heroBottom ? Math.min(14, window.scrollY * 0.025) : 14;
      heroPortrait.style.setProperty("--portrait-shift", `${shift}px`);
    }
  };

  const scheduleScrollState = () => {
    if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateScrollState);
  };

  updateScrollState();
  window.addEventListener("scroll", scheduleScrollState, { passive: true });
  window.addEventListener("resize", scheduleScrollState, { passive: true });

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

  window.addEventListener("load", () => {
    if (!window.location.hash) return;
    const target = doc.getElementById(window.location.hash.slice(1));
    window.requestAnimationFrame(() => target?.scrollIntoView());
  }, { once: true });

  doc.addEventListener("keydown", (event) => {
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
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8%", threshold: 0.08 });
    reveals.forEach((element) => revealObserver.observe(element));
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

  copyButton?.addEventListener("click", async () => {
    const email = copyButton.dataset.email || "";
    let copied = false;

    try {
      await navigator.clipboard.writeText(email);
      copied = true;
    } catch {
      const field = doc.createElement("textarea");
      field.value = email;
      field.style.position = "fixed";
      field.style.opacity = "0";
      doc.body.append(field);
      field.select();
      copied = doc.execCommand("copy");
      field.remove();
    }

    if (copyStatus) copyStatus.textContent = copied ? "Email copied." : `Copy: ${email}`;
    window.setTimeout(() => {
      if (copyStatus) copyStatus.textContent = "";
    }, 3000);
  });

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
