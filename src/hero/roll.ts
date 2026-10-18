import { axisAngle, faceOrientation, multiply, slerp, type Quaternion } from "./d20.js";
export const ROLL_LIMIT = 2 ** 32 - ((2 ** 32) % 20);
export function rollD20(source: Pick<Crypto, "getRandomValues"> = globalThis.crypto): number {
  const buffer = new Uint32Array(1);
  do { source.getRandomValues(buffer); } while (buffer[0] >= ROLL_LIMIT);
  return buffer[0] % 20 + 1;
}
export type Stage = "idle" | "rolling" | "result" | "dissolving" | "restoring";
export type Frame = { stage: Stage; rotation: Quaternion; dissolve: number; scatter: number; lift: number; result: number };
const ease = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t*t*t*(t*(t*6-15)+10); };
const initial = multiply(axisAngle([1, 0.6, 0], 0.32), faceOrientation(20));
export class DiceRoll {
  private started = -Infinity;
  private origin: Quaternion = initial;
  private target: Quaternion = initial;
  private result = 20;
  private reduced = false;
  private active = false;
  roll(time: number, reduced = false): boolean {
    if (this.active && !reduced) return false;
    this.origin = this.frame(time).rotation;
    this.result = rollD20();
    this.target = faceOrientation(this.result);
    this.started = time;
    this.reduced = reduced;
    this.active = !reduced;
    return true;
  }
  private tumble(t: number): Quaternion {
    return multiply(multiply(axisAngle([0.6, 1, 0.2], t * 10), axisAngle([0, 0, 1], t * 2.8)), this.origin);
  }
  settle(): Frame {
    this.active = false;
    this.reduced = true;
    return { stage: "result", rotation: this.target, dissolve: 0, scatter: 0, lift: 0, result: this.result };
  }
  frame(time: number): Frame {
    const t = Math.max(0, time - this.started);
    const base = { rotation: this.target, dissolve: 0, scatter: 0, lift: 0, result: this.result };
    if (this.reduced) return { ...base, stage: "result" };
    if (this.active && t < 2.1) return { ...base, stage: "rolling", rotation: t < 1.1 ? this.tumble(t) : slerp(this.tumble(1.1), this.target, ease((t-1.1)/1)), lift: Math.sin(Math.min(1,t/2.1)*Math.PI)*0.07 };
    if (this.active && t < 4.1) return { ...base, stage: "result" };
    if (this.active && t < 6.3) return { ...base, stage: "dissolving", dissolve: ease((t-4.1)/2.2), scatter: (t-4.1)/2.2 };
    if (this.active && t < 8.1) return { ...base, stage: "restoring", dissolve: 1-ease((t-6.3)/1.8), scatter: 1+(t-6.3)/1.8 };
    this.active = false;
    const idleTime = Number.isFinite(this.started) ? Math.max(0,t-8.1) : time;
    return { ...base, stage: "idle", rotation: multiply(axisAngle([0.5,1,0.15], Math.sin(idleTime*0.16)*0.13), this.target) };
  }
}
