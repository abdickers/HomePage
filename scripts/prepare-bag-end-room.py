"""Prepare proportional room art and alpha-exact, asymmetric Hobbit frame slices."""
from pathlib import Path
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/bag-end/room'
SLICES = {
    'top-left': (17, 15, 290, 370),
    'top-right': (1050, 15, 1294, 250),
    'bottom-left': (17, 920, 290, 1155),
    'bottom-right': (1050, 920, 1294, 1155),
    'top': (400, 15, 600, 90),
    'bottom': (400, 1080, 600, 1155),
    'left': (17, 500, 90, 700),
    'right': (1220, 500, 1294, 700),
}
manifest = {'coordinates': '[left, top, right, bottom), source pixels',
            'sources': [], 'slices': []}
for name in ['hobbit-interior.png', 'hobbit-control-frame.png']:
    path = OUT / 'originals' / name
    im = Image.open(path)
    manifest['sources'].append({'path': 'originals/' + name, 'size': list(im.size),
                               'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
frame = Image.open(OUT / 'originals/hobbit-control-frame.png').convert('RGBA')
for name, box in SLICES.items():
    crop = frame.crop(box)
    dest = OUT / (name + '.webp')
    crop.save(dest, 'WEBP', lossless=True, exact=True, method=6)
    assert Image.open(dest).getchannel('A').tobytes() == crop.getchannel('A').tobytes()
    manifest['slices'].append({'path': dest.name, 'bounds': box, 'size': list(crop.size)})
room = Image.open(OUT / 'originals/hobbit-interior.png').convert('RGB')
room.save(OUT / 'interior.webp', 'WEBP', quality=88, method=6)
room.resize((1000, round(room.height * 1000 / room.width)), Image.Resampling.LANCZOS).save(OUT / 'interior-small.webp', 'WEBP', quality=86, method=6)
room.crop((180, 775, 1637, 866)).save(OUT / 'sill.webp', 'WEBP', quality=88, method=6)
(OUT / 'slice-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print('Prepared room and eight lossless frame slices; alpha verified.')
