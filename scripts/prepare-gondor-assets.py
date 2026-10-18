"""Reproduce reviewed, lossless Gondor frame slices from unchanged source PNGs."""
from pathlib import Path
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/gondor'
SLICES = {
    'gondor-header-frame.png': {
        'header-top-left': (9, 90, 154, 235),
        'header-top-right': (2017, 90, 2162, 235),
        'header-bottom-left': (9, 530, 154, 675),
        'header-bottom-right': (2017, 530, 2162, 675),
        'header-top': (400, 90, 800, 140),
        'header-bottom': (400, 625, 800, 675),
        'header-left': (9, 400, 79, 500),
        'header-right': (2092, 400, 2162, 500),
        'header-tree': (970, 0, 1202, 160),
        'header-diamond': (1028, 610, 1144, 698),
    },
    'gondor-left-rail.png': {
        'page-rail-top': (256, 0, 466, 420),
        'page-rail-shaft': (310, 420, 414, 800),
        'page-rail-bottom': (295, 1880, 430, 2140),
    },
}
manifest = {'coordinateConvention': '[left, top, right, bottom), native source pixels',
            'delivery': 'lossless WebP, exact alpha, no color removal or upscaling',
            'sources': [], 'slices': []}
for source, slices in SLICES.items():
    path = OUT / 'originals' / source
    im = Image.open(path).convert('RGBA')
    manifest['sources'].append({'path': 'originals/' + source,
        'size': list(im.size), 'alphaBounds': list(im.getchannel('A').getbbox()),
        'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    for name, bounds in slices.items():
        cropped = im.crop(bounds)
        target = OUT / (name + '.webp')
        cropped.save(target, 'WEBP', lossless=True, exact=True, method=6)
        assert Image.open(target).getchannel('A').tobytes() == cropped.getchannel('A').tobytes()
        manifest['slices'].append({'path': target.name, 'source': source,
            'bounds': bounds, 'size': list(cropped.size), 'bytes': target.stat().st_size})
(OUT / 'slice-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print('Prepared', len(manifest['slices']), 'lossless slices;',
      sum(s['bytes'] for s in manifest['slices']), 'delivery bytes; alpha verified.')
