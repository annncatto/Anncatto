import test from 'node:test';
import assert from 'node:assert/strict';
import { groupAccess, readableTokens, tokenDiagram, latentRoutes } from '../.build/pi07-diagrams.js';

test('π0.7 preserves context access and isolates the two action targets', () => {
  assert.equal(groupAccess(0, 0), 'all');
  assert.equal(groupAccess(0, 2), 'blocked');
  assert.equal(groupAccess(1, 1), 'causal');
  assert.equal(groupAccess(2, 1), 'all');
  for (const context of [0, 1, 2]) {
    assert.equal(groupAccess(3, context), 'all');
    assert.equal(groupAccess(4, context), 'all');
  }
  assert.equal(groupAccess(3, 3), 'all');
  assert.equal(groupAccess(4, 4), 'causal');
  assert.equal(groupAccess(3, 4), 'blocked');
  assert.equal(groupAccess(4, 3), 'blocked');
});

test('latent action interfaces separate training with future frames from deployable control', () => {
  assert.ok(latentRoutes.video.nodes.includes('frame-pair'));
  for (const mode of ['policy', 'planning']) {
    assert.ok(!latentRoutes[mode].nodes.includes('frame-pair'));
    assert.ok(!latentRoutes[mode].nodes.includes('inverse'));
  }
  assert.deepEqual(latentRoutes.policy.edges.at(-1), ['decoder', 'command']);
  assert.deepEqual(latentRoutes.planning.edges.slice(0, 2), [['candidate', 'projector'], ['projector', 'latent']]);
});

test('the first action token can read later chunk positions while a causal token cannot', () => {
  assert.deepEqual(readableTokens('causal', 0), [0]);
  assert.deepEqual(readableTokens('causal', 1), [0, 1]);
  assert.deepEqual(readableTokens('bidirectional', 0), [0, 1, 2, 3]);
  const arrows = svg => [...svg.matchAll(/marker-end=/g)].length;
  assert.equal(arrows(tokenDiagram('causal', 0)), 1);
  assert.equal(arrows(tokenDiagram('bidirectional', 0)), 4);
});
