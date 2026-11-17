import assert from 'node:assert/strict';
import test from 'node:test';
import { EXTINCT_CATEGORIES, EXTINCT_SPECIMENS } from '../data/extinctCatalog';
import {
  APPROACH_DURATION_S,
  computeClipKinematics,
  computeMovieCameraFrame,
  END_Z,
  ROAR_END_S,
  START_Z,
} from './extinctShowcaseLogic';

test('EXTINCT_CATEGORIES covers animals, mammals, flowers, plants, humans, and marine', () => {
  const ids = new Set(EXTINCT_CATEGORIES.map((c) => c.id));
  for (const required of ['animals', 'mammals', 'flowers', 'plants', 'humans', 'marine'] as const) {
    assert.equal(ids.has(required), true, `Missing required category: ${required}`);
    const entries = EXTINCT_SPECIMENS.filter((s) => s.category === required);
    assert.ok(entries.length >= 2, `Expected >= 2 specimens in ${required}`);
  }
  const trex = EXTINCT_SPECIMENS.find((s) => s.id === 'tyrannosaurus-rex');
  assert.ok(trex, 'Tyrannosaurus rex must be present in extinct catalog');
  assert.equal(trex.category, 'animals');
  assert.equal(trex.soundProfile, 'trex-roar');
});

test('computeClipKinematics starts in the forest, runs toward screen, and roars loudly', () => {
  const start = computeClipKinematics(0);
  assert.equal(start.phase, 'approach');
  assert.equal(start.z, START_Z);

  const midRun = computeClipKinematics(APPROACH_DURATION_S * 0.5);
  assert.equal(midRun.phase, 'approach');
  assert.ok(midRun.z > START_Z && midRun.z < END_Z);
  assert.ok(midRun.footstepCount >= 2);

  const peakRoar = computeClipKinematics(APPROACH_DURATION_S + 1.0);
  assert.equal(peakRoar.phase, 'roar');
  assert.equal(peakRoar.z, END_Z);
  assert.ok(peakRoar.roarIntensity > 0.75, 'Roar intensity should peak during roar phase');
  assert.ok(peakRoar.jawOpenRad > 0.55, 'Jaw should snap wide open during roar');
  assert.ok(peakRoar.cameraShake > 0.3, 'Camera should rumble during T-Rex roar');

  const idle = computeClipKinematics(ROAR_END_S + 0.5);
  assert.equal(idle.phase, 'alert');
  assert.equal(idle.z, END_Z);
  assert.equal(idle.roarIntensity, 0);
});

test('computeMovieCameraFrame orchestrates dolly-out pursuit, skid momentum, and hero roar framing', () => {
  const startK = computeClipKinematics(0);
  const startCam = computeMovieCameraFrame(0, startK, true);
  const lateRunK = computeClipKinematics(APPROACH_DURATION_S * 0.9);
  const lateRunCam = computeMovieCameraFrame(APPROACH_DURATION_S * 0.9, lateRunK, true);
  assert.ok(lateRunCam.camOffsetZ > startCam.camOffsetZ, 'Camera dollies back ahead of charging raptor');
  assert.ok(lateRunCam.fov < startCam.fov, 'Lens subtly tightens during charge');

  const roarK = computeClipKinematics(APPROACH_DURATION_S + 0.9);
  const roarCam = computeMovieCameraFrame(APPROACH_DURATION_S + 0.9, roarK, true);
  assert.ok(roarCam.skidSlide > 0.1, 'Predator carries mud-skid deceleration into roar');
  assert.ok(roarCam.fov < lateRunCam.fov, 'Camera tightens onto roaring head for dramatic close-up');
});

