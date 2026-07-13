const header = document.querySelector(".site-header");
const menuBtn = document.getElementById("menuBtn");
const navLinks = document.getElementById("navLinks");
const navItems = document.querySelectorAll('.nav-links a[href^="#"]');
const hoverSound = document.getElementById("hoverSound");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.getElementById("year").textContent = new Date().getFullYear();

function closeMenu() {
  menuBtn.classList.remove("open");
  navLinks.classList.remove("open");
  menuBtn.setAttribute("aria-expanded", "false");
  menuBtn.setAttribute("aria-label", "Open menu");
}

menuBtn.addEventListener("click", () => {
  const isOpen = navLinks.classList.toggle("open");
  menuBtn.classList.toggle("open", isOpen);
  menuBtn.setAttribute("aria-expanded", String(isOpen));
  menuBtn.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
});

navItems.forEach((link) => link.addEventListener("click", closeMenu));
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeMenu(); });

const sections = document.querySelectorAll("#about, #expertise, #process, #edits, #contact");
const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const activeHref = entry.target.id === "process" ? "#expertise" : `#${entry.target.id}`;
    navItems.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === activeHref));
  });
}, { rootMargin: "-35% 0px -55%" });
sections.forEach((section) => sectionObserver.observe(section));

const revealObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });
document.querySelectorAll(".reveal").forEach((element) => revealObserver.observe(element));

window.addEventListener("scroll", () => header.classList.toggle("scrolled", window.scrollY > 20), { passive: true });

let soundReady = false;
document.addEventListener("pointerdown", () => { soundReady = true; }, { once: true });
if (!reduceMotion && hoverSound) {
  document.querySelectorAll(".btn, .nav-links a, .social-links a").forEach((element) => {
    element.addEventListener("mouseenter", () => {
      if (!soundReady) return;
      hoverSound.currentTime = 0;
      hoverSound.volume = 0.16;
      hoverSound.play().catch(() => {});
    });
  });
}
