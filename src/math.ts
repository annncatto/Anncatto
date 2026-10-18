export const clamp = (x: number, a: number, b: number) =>
  Math.max(a, Math.min(b, x));
export function gaussian(x: number, mu: number, sigma: number) {
  return (
    Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI))
  );
}
export function gaussianKL(mq: number, sq: number, mp: number, sp: number) {
  return Math.log(sp / sq) + (sq * sq + (mq - mp) ** 2) / (2 * sp * sp) - 0.5;
}
export function entropy(p: number[]) {
  return p.reduce((s, x) => s - (x === 0 ? 0 : x * Math.log2(x)), 0);
}
export function crossEntropy(p: number[], r: number[]) {
  return p.reduce((s, x, i) => s - (x === 0 ? 0 : x * Math.log2(r[i])), 0);
}
export function discreteKL(p: number[], r: number[]) {
  return crossEntropy(p, r) - entropy(p);
}
export function losses(a: number, targets = [0]) {
  return {
    l1: targets.reduce((s, x) => s + Math.abs(a - x), 0) / targets.length,
    l2: targets.reduce((s, x) => s + (a - x) ** 2, 0) / targets.length,
  };
}
