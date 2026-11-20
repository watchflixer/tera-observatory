import test from 'node:test';
import assert from 'node:assert/strict';
import { getGlobeDetailZoom, getRenderPixelRatio } from './renderQuality';

test('3D globe uses a modest mobile sharpness boost with GPU-safe caps', () => {
  assert.equal(getRenderPixelRatio('systems', 3, true, false), 1.75);
  assert.equal(getRenderPixelRatio('interior', 3, true, false), 1.5);
  assert.equal(getRenderPixelRatio('history', 3, true, false), 1.5);
  assert.equal(getRenderPixelRatio('atmosphere', 3, true, false), 1.5);
  assert.equal(getRenderPixelRatio('systems', 1, true, false), 1);
  assert.equal(getRenderPixelRatio('systems', 3, false, false), 2);
  assert.equal(getRenderPixelRatio('systems', 3, true, true), 1);
  assert.equal(getRenderPixelRatio('systems', Number.NaN, true, false), 1);
});

test('localized globe imagery loads sooner without reducing closer detail levels', () => {
  assert.equal(getGlobeDetailZoom(13, 3), 4);
  assert.equal(getGlobeDetailZoom(6.5, 3), 4);
  assert.equal(getGlobeDetailZoom(5.2, 3), 4);
  assert.equal(getGlobeDetailZoom(3.0, 5), 5);
  assert.equal(getGlobeDetailZoom(2.4, 6), 6);
});
