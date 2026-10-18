// The supplied 24×22 JPEG uses 2×2 blocks: this is its original 12×11 grid.
// 1 = ink, 0 = transparent. Only the eye layer changes during a blink.
export const CAT_PIXELS = [
  "100000000001",
  "110000000011",
  "101011110101",
  "100000000001",
  "000000000000",
  "000100001000",
  "000000000000",
  "111100001111",
  "000000000000",
  "001001100100",
  "000110011000",
] as const;

export function pixelCatSVG(): string {
  let face = "", eyes = "";
  for (const [y, row] of CAT_PIXELS.entries()) {
    for (const [x, cell] of [...row].entries()) {
      if (cell !== "1") continue;
      const pixel = `M${x} ${y}h1v1h-1z`;
      if (y === 5) eyes += pixel;
      else face += pixel;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" class="pixel-cat" viewBox="0 0 12 11" width="36" height="33" shape-rendering="crispEdges" aria-hidden="true"><path d="${face}" fill="currentColor"/><path class="cat-eyes-open" d="${eyes}" fill="currentColor"/><path class="cat-eyes-closed" d="M2 5h3v1H2zM7 5h3v1H7z" fill="currentColor" opacity="0"/></svg>`;
}
