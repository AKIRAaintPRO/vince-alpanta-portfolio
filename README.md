# Vince Alpanta Portfolio

A responsive, accessible single-page portfolio for Vince Alpanta, Video Editor and AI Video Specialist. It uses semantic HTML, modern CSS, vanilla JavaScript, native browser scrolling, and GSAP ScrollTrigger for shared-element and scroll-driven transitions. It is designed for GitHub Pages.

## Run locally

Use any static server from the repository root. For example:

```powershell
python -m http.server 8000
```

Open `http://localhost:8000`. A static server is preferable to opening `index.html` directly because it matches GitHub Pages behavior more closely.

## Deploy with GitHub Pages

1. Commit and push the repository to the branch used for Pages.
2. In the GitHub repository, open **Settings → Pages**.
3. Choose **Deploy from a branch**, then select the relevant branch and `/ (root)` folder.
4. Save and wait for the deployment to finish.

The included `.nojekyll` file keeps the deployment as a plain static site. Canonical, sitemap, and sharing URLs assume `https://akiraaintpro.github.io/vince-alpanta-portfolio/`.

## Content maintenance

- Project video paths and thumbnails are defined in `index.html` through `data-video` and `data-poster` attributes.
- Keep every project-card title on the same shared font-size and line-height scale across desktop, tablet, and mobile. For longer titles, use intentional line breaks or title-specific layout classes, but never change the title's visual size relative to the other cards.
- When adding a new project, match the existing portrait-card proportions, title placement, spacing, tags, play control, and responsive behavior so the full project row remains visually consistent.
- The contact form intentionally opens a prefilled email draft; it does not claim to submit to a backend.
- Replace the editable journey and revision-policy comments only when verified details are available.
- Compress large MP4 files before production deployment when possible, while preserving filenames or updating every matching path.

## Performance notes

Images below the fold are lazy-loaded, project video files load only when the viewer is opened, and animation respects reduced-motion preferences. GSAP, ScrollTrigger, and Flip are loaded from jsDelivr with pinned versions; no smooth-scroll library or wheel interception is used.
