export type ExtinctClipPhase = 'approach' | 'roar' | 'alert';

export interface ClipKinematicsState {
  phase: ExtinctClipPhase;
  /** World Z coordinate: starts deep in forest (~ -24), approaches viewer (~ -3.6) */
  z: number;
  /** Normalized progress of the run [0, 1] */
  approachProgress: number;
  /** Normalized roar intensity [0, 1] */
  roarIntensity: number;
  /** Lower jaw opening angle in radians (0 closed -> ~0.82 wide roar) */
  jawOpenRad: number;
  /** Stride phase in radians for leg swing & body bob */
  strideAngle: number;
  /** Vertical body bounce from running steps / rear-up during roar */
  bodyBounceY: number;
  /** Forward torso pitch during sprint vs reared-back chest during roar */
  torsoPitchRad: number;
  /** Trauma camera shake intensity [0, 1] */
  cameraShake: number;
  /** Monotonically increasing footstep index (triggers thud on each integer boundary during approach) */
  footstepCount: number;
}

export const APPROACH_DURATION_S = 2.6;
export const ROAR_START_S = 2.6;
export const ROAR_END_S = 6.2;
export const START_Z = -17.5;
export const END_Z = -3.35;

/**
 * Pure deterministic kinematics curve for an extinct creature clip:
 * 1. `0.0s .. 3.0s` (`approach`): charges forward from deep inside the forest (`z = -24`) toward the screen (`z = -3.6`) with rhythmic stride & footsteps.
 * 2. `3.0s .. 6.2s` (`roar`): plants feet near the camera, rears chest, opens jaw wide, and roars loudly.
 * 3. `6.2s+` (`alert`): holds breathing predatory stance in the forest clearing.
 */
export function computeClipKinematics(elapsedSec: number): ClipKinematicsState {
  const t = Math.max(0, elapsedSec);

  if (t < APPROACH_DURATION_S) {
    const raw = t / APPROACH_DURATION_S;
    // Slight ease-in-out charge acceleration as it bursts out of the trees
    const eased = raw * raw * (3 - 2 * raw) * 0.35 + raw * 0.65;
    const z = START_Z + (END_Z - START_Z) * eased;
    const strideFreqHz = 2.1; // ~6 steps over 3 seconds
    const strideAngle = t * Math.PI * 2 * strideFreqHz;
    const stepImpulse = Math.pow(Math.max(0, Math.sin(strideAngle)), 6);
    const bodyBounceY = Math.abs(Math.sin(strideAngle)) * 0.24;

    return {
      phase: 'approach',
      z,
      approachProgress: raw,
      roarIntensity: 0,
      jawOpenRad: 0.08 + Math.max(0, Math.sin(t * 5)) * 0.06,
      strideAngle,
      bodyBounceY,
      torsoPitchRad: 0.26, // leans aggressively forward while sprinting
      cameraShake: stepImpulse * (0.12 + raw * 0.35),
      footstepCount: Math.floor(t * strideFreqHz) + 1,
    };
  }

  if (t <= ROAR_END_S) {
    const roarT = (t - ROAR_START_S) / (ROAR_END_S - ROAR_START_S); // 0..1
    // Fast snap open, sustained full bellow, smooth close
    const envelope =
      roarT < 0.16
        ? roarT / 0.16
        : roarT < 0.78
          ? 1.0 - Math.sin((roarT - 0.16) * 14) * 0.08
          : Math.max(0, (1.0 - roarT) / 0.22);

    const jawOpenRad = 0.08 + envelope * 0.78;
    const torsoPitchRad = 0.26 - envelope * 0.44; // rears upward as it bellows!
    const bodyBounceY = envelope * 0.18 + Math.sin(t * 28) * 0.025 * envelope;

    return {
      phase: 'roar',
      z: END_Z,
      approachProgress: 1,
      roarIntensity: Math.min(1, Math.max(0, envelope)),
      jawOpenRad,
      strideAngle: 0,
      bodyBounceY,
      torsoPitchRad,
      cameraShake: envelope * 0.55,
      footstepCount: Math.floor(APPROACH_DURATION_S * 2.1) + 1,
    };
  }

  const idleT = t - ROAR_END_S;
  const breath = Math.sin(idleT * 1.9);
  return {
    phase: 'alert',
    z: END_Z,
    approachProgress: 1,
    roarIntensity: 0,
    jawOpenRad: 0.06 + (breath * 0.5 + 0.5) * 0.05,
    strideAngle: 0,
    bodyBounceY: breath * 0.04,
    torsoPitchRad: 0.06 + breath * 0.03,
    cameraShake: 0,
    footstepCount: Math.floor(APPROACH_DURATION_S * 2.1) + 1,
  };
}

export interface MovieCameraFrame {
  /** Low-angle dolly distance along +Z */
  camOffsetZ: number;
  /** Handheld vertical lens height */
  camHeightY: number;
  /** Horizontal tracking / hero orbit offset */
  camOffsetX: number;
  /** Dynamic anamorphic FOV (wider during pursuit, tighter hero lens during roar) */
  fov: number;
  /** Subtle handheld Dutch bank roll in radians */
  dutchRollRad: number;
  /** Forward deceleration slide after sprint stops (0..1 decaying) */
  skidSlide: number;
  /** Continuous chest breathing heave even while roaring/prowling */
  breathCycle: number;
}

/**
 * Pure 3-act blockbuster camera choreography:
 * 1. Approach: low-angle dolly-out pursuit ahead of the charging predator with organic Dutch roll.
 * 2. Roar: mud-skid deceleration + dramatic hero push-in / subtle orbit arc around roaring jaws.
 * 3. Alert: subtle handheld breathing drift as creature stalks in the clearing.
 */
export function computeMovieCameraFrame(
  elapsedSec: number,
  k: ClipKinematicsState,
  isRaptor: boolean
): MovieCameraFrame {
  const t = Math.max(0, elapsedSec);
  const breathCycle = Math.sin(t * 2.4) * 0.5 + Math.cos(t * 1.15) * 0.25;

  if (k.phase === 'approach') {
    const p = k.approachProgress;
    // Start tight in the ferns, smoothly dolly back as predator bursts close
    const camOffsetZ = (isRaptor ? 1.45 : 2.55) + p * (isRaptor ? 1.55 : 1.55);
    const camHeightY = (isRaptor ? 0.62 : 1.55) + p * (isRaptor ? 0.26 : 0.42);
    const camOffsetX = Math.sin(p * Math.PI * 1.2) * (isRaptor ? 0.34 : 0.65);
    const fov = (isRaptor ? 62 : 52) - p * 4;
    const dutchRollRad =
      Math.sin(t * 4.8) * 0.028 * (0.4 + p * 0.6) + Math.sin(k.strideAngle) * 0.018 * p;

    return {
      camOffsetZ,
      camHeightY,
      camOffsetX,
      fov,
      dutchRollRad,
      skidSlide: 0,
      breathCycle,
    };
  }

  if (k.phase === 'roar') {
    const roarT = Math.min(1, Math.max(0, (t - ROAR_START_S) / (ROAR_END_S - ROAR_START_S)));
    // Mud skid momentum decays quickly in the first 0.55s of roar
    const skidSlide = Math.sin(Math.min(1, roarT * 3.5) * Math.PI * 0.5) * 0.42;
    const arcWave = Math.sin(roarT * Math.PI);
    const camOffsetZ = (isRaptor ? 2.85 : 3.9) - arcWave * (isRaptor ? 0.42 : 0.35);
    const camHeightY = (isRaptor ? 0.88 : 1.98) + arcWave * 0.14;
    const camOffsetX = (isRaptor ? 0.22 : 0.38) - Math.sin(roarT * Math.PI * 0.9) * (isRaptor ? 0.52 : 0.65);
    const fov = (isRaptor ? 57 : 48) - k.roarIntensity * 4.5;
    const dutchRollRad = Math.sin(t * 14) * 0.022 * k.roarIntensity - 0.025 * arcWave;

    return {
      camOffsetZ,
      camHeightY,
      camOffsetX,
      fov,
      dutchRollRad,
      skidSlide,
      breathCycle,
    };
  }

  const idleT = Math.max(0, t - ROAR_END_S);
  return {
    camOffsetZ: (isRaptor ? 2.75 : 3.85) + Math.sin(idleT * 0.65) * 0.14,
    camHeightY: (isRaptor ? 0.92 : 2.02) + Math.sin(idleT * 0.9) * 0.04,
    camOffsetX: (isRaptor ? -0.15 : -0.12) + Math.sin(idleT * 0.55) * 0.24,
    fov: isRaptor ? 55 : 46,
    dutchRollRad: Math.sin(idleT * 0.7) * 0.014,
    skidSlide: 0.42,
    breathCycle,
  };
}

