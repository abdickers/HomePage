"""Build measured Warcraft frame sheets; preserve the supplied PNGs unchanged.

Only quiet iron rails repeat. Corners, the lion and the lower seal keep their
proportions. No color-keying, dark-pixel removal, or alpha threshold is used.
"""
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'assets/warcraft'
SOURCE = OUTPUT / 'originals'
records = []
sources = []


def read(name):
    path = SOURCE / (name + '.png')
    image = Image.open(path)
    assert image.size == (1536, 1024) and image.mode == 'RGBA'
    assert image.getpixel((768, 512))[3] == 0
    sources.append(dict(file=path.relative_to(ROOT).as_posix(),
                        width=1536, height=1024, mode=image.mode,
                        center_alpha=0, sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
    return image


def save(image, name, source, **details):
    path = OUTPUT / (name + '.webp')
    image.save(path, 'WEBP', quality=90, method=6, exact=True)
    decoded = Image.open(path).convert('RGBA')
    assert ImageChops.difference(image.getchannel('A'), decoded.getchannel('A')).getbbox() is None
    records.append(dict(file=path.relative_to(ROOT).as_posix(),
                        width=image.width, height=image.height, source=source,
                        bytes=path.stat().st_size, alpha_roundtrip_exact=True, **details))


def rail(image, box, size, horizontal):
    """A mirrored quiet segment has matching endpoints for seamless repeats."""
    piece = image.crop(box)
    half = size // 2
    if horizontal:
        piece = piece.resize((half, size), Image.Resampling.LANCZOS)
        tile = Image.new('RGBA', (size, size))
        tile.paste(piece, (0, 0))
        tile.paste(ImageOps.mirror(piece), (half, 0))
    else:
        piece = piece.resize((size, half), Image.Resampling.LANCZOS)
        tile = Image.new('RGBA', (size, size))
        tile.paste(piece, (0, 0))
        tile.paste(ImageOps.flip(piece), (0, half))
    return tile


def frame(image, name, size, quiet):
    w, h = image.size
    corners = [(0, 0, size, size), (w-size, 0, w, size),
               (0, h-size, size, h), (w-size, h-size, w, h)]
    sheet = Image.new('RGBA', (size*3, size*3))
    for box, point in zip(corners, [(0, 0), (size*2, 0), (0, size*2), (size*2, size*2)]):
        sheet.paste(image.crop(box), point)
    for edge, point, horizontal in [('top', (size, 0), True), ('bottom', (size, size*2), True),
                                    ('left', (0, size), False), ('right', (size*2, size), False)]:
        sheet.paste(rail(image, quiet[edge], size, horizontal), point)
    assert sheet.getpixel((size*3//2, size*3//2))[3] == 0
    save(sheet, name+'-nine-slice', name+'.png', slice=size,
         corner_crops=corners, quiet_rail_crops=quiet,
         construction='unchanged square corner crops; mirrored quiet rails; empty center')


section = read('wow-section-border')
frame(section, 'wow-section-border', 336,
      dict(top=(410, 0, 510, 336), bottom=(410, 688, 510, 1024),
           left=(0, 368, 336, 432), right=(1200, 368, 1536, 432)))
save(section.crop((612, 16, 924, 196)), 'wow-section-lion', 'wow-section-border.png',
     crop=(612, 16, 924, 196))
save(section.crop((696, 864, 840, 976)), 'wow-section-seal', 'wow-section-border.png',
     crop=(696, 864, 840, 976))

story = read('wow-news-card-border')
frame(story, 'wow-news-card-border', 216,
      dict(top=(410, 0, 510, 216), bottom=(410, 808, 510, 1024),
           left=(0, 360, 216, 424), right=(1320, 360, 1536, 424)))

(OUTPUT / 'derivative-manifest.json').write_text(
    json.dumps(dict(originals=sources, derivatives=records), indent=2)+'\n', encoding='utf-8')
for record in records:
    print(record['file'], record['width'], record['height'], record['bytes'])
