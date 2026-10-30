"""Render every numbered figure from the CC BY 4.0 OpenWAM v1 source.

Usage: python scripts/figures/openwam-assets.py /path/to/extracted/arxiv/source
Uses the author's standalone figures, preserving their complete canvas.
"""
import concurrent.futures
import hashlib
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

source = Path(sys.argv[1])
root = Path(__file__).resolve().parents[2]
out = root / 'content/images/openwam'
out.mkdir(parents=True, exist_ok=True)
tex = (source / 'arxiv.tex').read_text()
active = '\n'.join(line for line in tex.splitlines() if not line.lstrip().startswith('%'))
figures = re.findall(r'includegraphics(?:\[[^\]]*\])?\{([^}]+)\}', active)
assert len(figures) == 21

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def render(item):
    number, name = item
    original = source / name
    destination = out / f'figure-{number:02}.webp'
    with tempfile.TemporaryDirectory() as directory:
        if original.suffix == '.pdf':
            prefix = Path(directory) / 'figure'
            subprocess.run(['pdftoppm', '-singlefile', '-png', '-scale-to',
                            '3600' if number in (1, 2, 13, 16, 17, 19, 21) else '2800',
                            str(original), str(prefix)], check=True, capture_output=True)
            image = Image.open(prefix.with_suffix('.png')).convert('RGB')
        else:
            image = Image.open(original).convert('RGB')
        image.save(destination, 'WEBP', lossless=True, method=6)
        width, height = image.size
    return dict(number=number, source=name, sourceSha256=digest(original),
                file=destination.name, sha256=digest(destination), width=width,
                height=height, bytes=destination.stat().st_size)

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
    manifest = list(executor.map(render, enumerate(figures, 1)))
(out / 'asset-sources.json').write_text(json.dumps({
    'paper': 'https://arxiv.org/abs/2609.07398v1',
    'sourceArchive': 'https://arxiv.org/src/2609.07398v1',
    'license': 'https://creativecommons.org/licenses/by/4.0/',
    'credit': 'Yuran Wang et al., OpenWAM (2026), Figures 1–21.',
    'processing': 'Complete author figure canvases rendered to lossless WebP; no content cropped or redrawn.',
    'figures': manifest,
}, ensure_ascii=False, indent=2) + '\n')
for figure in manifest:
    print(f"Figure {figure['number']:2}: {figure['width']} × {figure['height']}, {figure['bytes']:,} bytes")
