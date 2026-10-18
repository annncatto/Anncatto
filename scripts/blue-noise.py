"""Reproduce the 64×64 tile: python scripts/blue-noise.py (requires NumPy)."""
from pathlib import Path
import struct
import zlib
import numpy as np

size = 64
count = size * size
rng = np.random.default_rng(2097)
yy, xx = np.mgrid[:size, :size]
distance = np.minimum(xx, size - xx) ** 2 + np.minimum(yy, size - yy) ** 2
kernel = np.exp(-distance / (2 * 1.9**2))
pattern = np.zeros((size, size), dtype=bool)
pattern.flat[rng.choice(count, count // 10, replace=False)] = True

def contribution(index):
    return np.roll(kernel, (index // size, index % size), (0, 1))

def energy_of(mask):
    return np.fft.ifft2(np.fft.fft2(mask) * np.fft.fft2(kernel)).real

energy = energy_of(pattern)
for iteration in range(20000):
    cluster = np.where(pattern, energy, -np.inf).argmax()
    pattern.flat[cluster] = False
    energy -= contribution(cluster)
    void = np.where(~pattern, energy, np.inf).argmin()
    pattern.flat[void] = True
    energy += contribution(void)
    if cluster == void:
        break
else:
    raise RuntimeError("Prototype did not converge")

prototype = pattern.copy()
ranks = np.zeros((size, size), dtype=np.uint16)
initial = int(pattern.sum())
for rank in range(initial - 1, -1, -1):
    cluster = np.where(pattern, energy, -np.inf).argmax()
    ranks.flat[cluster] = rank
    pattern.flat[cluster] = False
    energy -= contribution(cluster)
pattern = prototype.copy()
energy = energy_of(pattern)
for rank in range(initial, count // 2):
    void = np.where(~pattern, energy, np.inf).argmin()
    ranks.flat[void] = rank
    pattern.flat[void] = True
    energy += contribution(void)
energy = energy_of(~pattern)
for rank in range(count // 2, count):
    cluster = np.where(~pattern, energy, -np.inf).argmax()
    ranks.flat[cluster] = rank
    pattern.flat[cluster] = True
    energy -= contribution(cluster)

pixels = (ranks.astype(np.uint32) * 256 // count).astype(np.uint8)
assert np.all(np.bincount(pixels.ravel(), minlength=256) == 16)

def chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))

png = b"\x89PNG\r\n\x1a\n"
png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 0, 0, 0, 0))
png += chunk(b"IDAT", zlib.compress(b"".join(b"\0" + row.tobytes() for row in pixels)))
png += chunk(b"IEND", b"")
target = Path(__file__).resolve().parent.parent / "public/textures/blue-noise.png"
target.parent.mkdir(parents=True, exist_ok=True)
target.write_bytes(png)

# A thresholded tile should suppress low spatial frequencies relative to white noise.
power = abs(np.fft.fft2((pixels < 128).astype(float) - 0.5)) ** 2
frequency = np.fft.fftfreq(size) * size
radius = np.hypot(frequency[:, None], frequency[None, :])
ratio = power[(radius > 0) & (radius < 6)].mean() / power[(radius > 16) & (radius < 28)].mean()
assert ratio < 0.1, ratio
print(f"{target}: {len(png)} bytes; low/high frequency power = {ratio:.4f}")
