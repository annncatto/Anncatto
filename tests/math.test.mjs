import test from "node:test";
import assert from "node:assert/strict";
import {
  gaussianKL,
  entropy,
  crossEntropy,
  discreteKL,
  losses,
} from "../.build/math.js";
import { renderDiagram, defaults } from "../.build/diagrams.js";
test("KL identity, non-negativity and direction are preserved", () => {
  assert.ok(Math.abs(gaussianKL(1.4, 0.7, 1.4, 0.7)) < 1e-12);
  for (const m of [-2, 0, 1.4, 3])
    for (const s of [0.45, 0.7, 1, 2])
      assert.ok(gaussianKL(1.4, 0.7, m, s) >= -1e-12);
  assert.notEqual(gaussianKL(1, 0.5, 0, 2), gaussianKL(0, 2, 1, 0.5));
});
test("cross-entropy decomposition and target match", () => {
  const p = [0.15, 0.7, 0.15],
    r = [0.25, 0.375, 0.375];
  assert.ok(
    Math.abs(crossEntropy(p, r) - entropy(p) - discreteKL(p, r)) < 1e-12,
  );
  assert.equal(discreteKL(p, p), 0);
  assert.ok(entropy(p) > 0);
  assert.equal(entropy([0, 1, 0]), 0);
});
test("single-target penalties and conflicting demonstrations differ", () => {
  assert.deepEqual(losses(0.5, [0]), { l1: 0.5, l2: 0.25 });
  assert.deepEqual(losses(2, [0]), { l1: 2, l2: 4 });
  for (const prediction of [-1, -0.5, 0, 0.5, 1]) {
    const result = losses(prediction, [-1, 1]);
    assert.equal(result.l1, 1);
    assert.equal(result.l2, 1 + prediction ** 2);
  }
  assert.ok(losses(1.5, [-1, 1]).l1 > 1);
  assert.equal(losses(0, [-1, 1]).l2, 1);
});
test("all static diagrams carry accessible descriptions and finite values", () => {
  for (const id of Object.keys(defaults)) {
    const s = renderDiagram(id);
    assert.match(s, /<title/);
    assert.match(s, /<desc/);
    assert.doesNotMatch(s, /NaN|Infinity|undefined/);
  }
  for (const mode of ["train", "infer"])
    assert.doesNotMatch(renderDiagram("network", { mode }), /NaN|undefined/);
  for (const lossMode of ["single", "bimodal"])
    assert.doesNotMatch(
      renderDiagram("l1", { lossMode, prediction: -2 }),
      /NaN|undefined/,
    );
});
