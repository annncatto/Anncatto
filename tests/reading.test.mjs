import test from 'node:test';
import assert from 'node:assert/strict';
import {readingSeconds, readingEdge, readingEstimate} from '../.build/reading-math.js';

test('reading budget combines prose, formulas, figures, and code in seconds', () => {
  assert.equal(readingSeconds('word '.repeat(200)), 60);
  assert.equal(readingSeconds('文'.repeat(350)), 60);
  assert.equal(readingSeconds('', 2, 1, 5), 48);
});

test('remaining time follows content cost rather than equal page height', () => {
  const blocks = [
    {top: 0, bottom: 100, seconds: 90},
    {top: 100, bottom: 200, seconds: 10},
  ];
  assert.deepEqual(readingEstimate(blocks, 0), {total: 100, remaining: 100, progress: 0});
  assert.deepEqual(readingEstimate(blocks, 100), {total: 100, remaining: 10, progress: .9});
  assert.deepEqual(readingEstimate(blocks, 200), {total: 100, remaining: 0, progress: 1});
});

test('excluding collapsed blocks removes their cost from both time and progress', () => {
  const expanded = [
    {top: 0, bottom: 100, seconds: 90},
    {top: 100, bottom: 200, seconds: 10},
  ];
  const collapsed = [{top: 0, bottom: 100, seconds: 10}];
  assert.equal(readingEstimate(expanded, 100).remaining, 10);
  assert.equal(readingEstimate(collapsed, 0).total, 10);
  assert.equal(readingEstimate(collapsed, 50).remaining, 5);
  assert.equal(readingEstimate([], 0).progress, 0);
});

test('scroll mapping reaches the final content at the bottom of the viewport', () => {
  assert.equal(readingEdge(0, 200, 2200, 800), 200);
  assert.equal(readingEdge(200, 200, 2200, 800), 200);
  assert.equal(readingEdge(800, 200, 2200, 800), 1200);
  assert.equal(readingEdge(1400, 200, 2200, 800), 2200);
  assert.equal(readingEdge(3000, 200, 2200, 800), 2200);
});
