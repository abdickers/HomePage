"""Reproducible, lossless slices of the supplied raster masters (Pillow)."""
from pathlib import Path
from shutil import copy2
import json
import sys
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
dest = root / 'assets' / 'personal-theme'
originals = dest / 'originals'
originals.mkdir(parents=True, exist_ok=True)
names = ['bagend-left-rail', 'bagend-panel-frame', 'bagend-interior',
         'dwarven-vault', 'dwarven-ledger', 'dwarven-button', 'gondor-settings-frame']
manifest = {}
for name in names:
    copy2(source / (name + '.png'), originals / (name + '.png'))
    im = Image.open(originals / (name + '.png'))
    manifest[name] = {'size': im.size, 'mode': im.mode, 'alpha_bounds': im.getbbox()}

def save(im, name):
    im.save(dest / (name + '.webp'), lossless=True, method=6)

def slices(im, prefix, xs, ys):
    x1, x2 = xs
    y1, y2 = ys
    w, h = im.size
    boxes = {'tl': (0, 0, x1, y1), 'tr': (x2, 0, w, y1),
             'bl': (0, y2, x1, h), 'br': (x2, y2, w, h),
             'top': (x1, 0, x2, y1), 'bottom': (x1, y2, x2, h),
             'left': (0, y1, x1, y2), 'right': (x2, y1, w, y2)}
    for key, box in boxes.items():
        save(im.crop(box), prefix + '-' + key)
    manifest[prefix + '-slices'] = {'crop_size': im.size, 'boxes': boxes}

panel = Image.open(originals / 'bagend-panel-frame.png').crop((17, 15, 1294, 1155))
slices(panel, 'oak', (270, 1027), (350, 885))

rail = Image.open(originals / 'bagend-left-rail.png')
# Alpha >64 bounds are (247,19,478,2148); faint stray pixels lie far outside
# the actual oak. Keep a small soft-edge margin around the visible carving.
save(rail.crop((240, 15, 486, 380)), 'rail-top')
save(rail.crop((307, 600, 419, 1000)), 'rail-shaft')
save(rail.crop((240, 1850, 486, 2153)), 'rail-bottom')
manifest['rail-crops'] = {'top': [240, 15, 486, 380], 'shaft': [307, 600, 419, 1000], 'bottom': [240, 1850, 486, 2153]}

gondor = Image.open(originals / 'gondor-settings-frame.png')
slices(gondor.crop((9, 92, 2160, 676)), 'silver', (160, 1991), (160, 424))
# Quiet rails exclude the central crest and bottom diamond, so repetition cannot
# create a row of partial trees or diamonds along a flexible dialog.
save(gondor.crop((300, 92, 650, 252)), 'silver-top')
save(gondor.crop((300, 516, 650, 676)), 'silver-bottom')
save(gondor.crop((9, 170, 169, 280)), 'silver-left')
save(gondor.crop((2000, 170, 2160, 280)), 'silver-right')
manifest['silver-quiet-edges'] = {'top': [300, 92, 650, 252], 'bottom': [300, 516, 650, 676], 'left': [9, 170, 169, 280], 'right': [2000, 170, 2160, 280]}
save(gondor.crop((995, 0, 1181, 158)), 'white-tree')
button = Image.open(originals / 'dwarven-button.png').crop((36, 88, 2156, 612))
save(button, 'dwarven-button')
manifest['button-nine-slice'] = {'crop': [36, 88, 2156, 612], 'slice': [98, 250, 98, 250]}
for name in ['dwarven-vault', 'dwarven-ledger']:
    im = Image.open(originals / (name + '.png'))
    im.thumbnail((160, 160), Image.Resampling.LANCZOS)
    save(im, name)
im = Image.open(originals / 'bagend-interior.png')
im.save(dest / 'bagend-interior.webp', quality=88, method=6)
(dest / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print('Prepared personal-theme masters, proportional corners, repeating rails and icons.')
