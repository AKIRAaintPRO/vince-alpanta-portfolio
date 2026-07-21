# Vince Alpanta Portfolio

A responsive, accessible single-page portfolio for Vince Alpanta, Video Editor and AI Video Specialist. It uses semantic HTML, modern CSS, and dependency-free vanilla JavaScript, and is designed for GitHub Pages.

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
- The contact form intentionally opens a prefilled email draft; it does not claim to submit to a backend.
- Replace the editable journey and revision-policy comments only when verified details are available.
- Compress large MP4 files before production deployment when possible, while preserving filenames or updating every matching path.

## Performance notes

Images below the fold are lazy-loaded, project video files load only when the viewer is opened, animation respects reduced-motion preferences, and no JavaScript framework or animation library is required.
