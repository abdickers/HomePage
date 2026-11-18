# Alliance Warcraft controls and lion crest

The controls and top lion crest match the existing `assets/redesign/wow-alliance-portrait-frame.webp`: sculpted warm antique gold, deep cobalt enamel, dark iron joins, and small diamond studs. The built-in imagegen tool generated the two source masters using that portrait frame and the previous small lion as style references. Exact prompts and original image paths are in `prompts.json`; retained PNG masters are unchanged.

Run `node scripts/prepare-warcraft-controls.mjs` to reproduce six `assets/warcraft/control-*.webp` plates and `assets/warcraft/alliance-lion-crest.webp`. The exporter uses the existing sibling Work checkout's Sharp dependency. It crops each atlas cell to alpha bounds, resizes proportionally, preserves visible antialiasing, and normalizes invisible alpha noise at values 1–3 to zero. The manifest records precise crops, hashes, dimensions, byte counts and alpha presence.

`css/warcraft-controls.css` affects only edition buttons, Refresh, the two character links, the source link, and the section-top lion. It supplies normal, hover, pressed/selected, secondary, secondary hover, disabled, and keyboard focus treatments. Native text labels and all action handlers remain HTML and JavaScript. The character window, event cards, provider integrations, section background and other theme artwork are outside this change.

Control exports are 600px wide and use border-image slices `48 96 fill / 10px 22px`. The lion renders at 160px wide on desktop and 120px on phones, preserving its physical aspect ratio and keeping the heading clear beneath it.
