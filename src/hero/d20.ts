export type Vec3 = [number, number, number];
export type Quaternion = [number, number, number, number];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const normalize = (v: Vec3): Vec3 => v.map(x => x / Math.hypot(...v)) as Vec3;
const phi = (1 + Math.sqrt(5)) / 2;
export const vertices: Vec3[] = [
  [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
  [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
  [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
].map(v => normalize(v as Vec3));
const triangles = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
];
export const faces = triangles.map(indices => {
  const points = indices.map(i => vertices[i]);
  const center = [0, 1, 2].map(i => points.reduce((sum, p) => sum + p[i] / 3, 0)) as Vec3;
  const normal = normalize(center);
  const up = normalize(points[0].map((v, i) => v - center[i]) as Vec3);
  const right = normalize(cross(up, normal));
  return { indices, center, normal, up, right, distance: dot(center, normal), value: 0 };
});
// Opposite faces sum to 21. Numbering is fixed, independent of the roll animation.
let next = 1;
for (const face of faces) {
  if (face.value) continue;
  face.value = next;
  faces.find(other => dot(face.normal, other.normal) < -0.999)!.value = 21 - next;
  next++;
}
export function multiply(a: Quaternion, b: Quaternion): Quaternion {
  const [x, y, z, w] = a, [u, v, s, t] = b;
  return [w*u+x*t+y*s-z*v, w*v-x*s+y*t+z*u, w*s+x*v-y*u+z*t, w*t-x*u-y*v-z*s];
}
export function axisAngle(axis: Vec3, angle: number): Quaternion {
  const a = normalize(axis), s = Math.sin(angle / 2);
  return [a[0] * s, a[1] * s, a[2] * s, Math.cos(angle / 2)];
}
export function rotate(q: Quaternion, p: Vec3): Vec3 {
  const r = multiply(multiply(q, [...p, 0]), [-q[0], -q[1], -q[2], q[3]]);
  return [r[0], r[1], r[2]];
}
export function slerp(a: Quaternion, b: Quaternion, t: number): Quaternion {
  let cosine = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const end = cosine < 0 ? b.map(v => -v) as Quaternion : b;
  cosine = Math.min(1, Math.abs(cosine));
  if (cosine > 0.9995) {
    const q = a.map((v, i) => v + (end[i] - v) * t) as Quaternion;
    const length = Math.hypot(...q);
    return q.map(v => v / length) as Quaternion;
  }
  const angle = Math.acos(cosine), sine = Math.sin(angle);
  return a.map((v, i) => (v * Math.sin((1-t)*angle) + end[i] * Math.sin(t*angle)) / sine) as Quaternion;
}
export function faceOrientation(value: number): Quaternion {
  const { right: u, up: v, normal: n } = faces.find(face => face.value === value)!;
  // Rows of the world transform: local right/up/normal become screen right/up/front.
  const m = [u, v, n], trace = m[0][0] + m[1][1] + m[2][2];
  let q: Quaternion;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    q = [(m[2][1]-m[1][2])/s, (m[0][2]-m[2][0])/s, (m[1][0]-m[0][1])/s, s/4];
  } else {
    const i = m[1][1] > m[0][0] ? (m[2][2] > m[1][1] ? 2 : 1) : (m[2][2] > m[0][0] ? 2 : 0);
    const j = (i+1)%3, k = (i+2)%3, s = Math.sqrt(1 + m[i][i] - m[j][j] - m[k][k]) * 2;
    q = [0, 0, 0, (m[k][j] - m[j][k])/s];
    q[i] = s/4; q[j] = (m[j][i]+m[i][j])/s; q[k] = (m[k][i]+m[i][k])/s;
  }
  return q;
}
export function fallbackDie(value = 20): string {
  const orientation = multiply(axisAngle([1, 0.6, 0], 0.32), faceOrientation(value));
  const projected = vertices.map(p => rotate(orientation, p));
  const visible = faces.filter(face => rotate(orientation, face.normal)[2] > 0)
    .sort((a, b) => rotate(orientation, a.normal)[2] - rotate(orientation, b.normal)[2]);
  return `<svg class="hero-fallback" viewBox="-1.35 -1.2 2.7 2.4" aria-hidden="true"><defs><radialGradient id="dice-ink"><stop stop-color="#72858b"/><stop offset="1" stop-color="#d9e2e3"/></radialGradient></defs>${visible.map(face => {
    const p = rotate(orientation, face.center);
    return `<polygon points="${face.indices.map(i => `${projected[i][0]},${-projected[i][1]}`).join(" ")}" fill="url(#dice-ink)" fill-opacity=".46" stroke="#54717b" stroke-width=".004"/><text x="${p[0]}" y="${-p[1]}" dy=".035" text-anchor="middle" fill="#304c58" font-family="IBM Plex Sans,sans-serif" font-size=".12">${face.value}</text>`;
  }).join("")}</svg>`;
}
