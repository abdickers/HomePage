# Sage's Middle-earth Command

A static GitHub Pages-ready homepage dashboard.

## Files

- `index.html` - page structure
- `styles.css` - Middle-earth command center styling
- `script.js` - search, tasks, notes, news feeds, clock, theme toggle

## Deploy to GitHub Pages

1. Upload these files to `https://github.com/abdickers/HomePage`.
2. In GitHub, go to **Settings → Pages**.
3. Set source to **Deploy from branch**.
4. Pick `main` and `/root`.
5. Save.

Your homepage should publish at the GitHub Pages URL for that repo.

## Notes

- Tasks and notes are stored locally in the browser using `localStorage`.
- News uses RSS through `rss2json`; if it is blocked, each tab still gives you a direct source button.
- This is static. No backend, no build system, no npm swamp creature.
