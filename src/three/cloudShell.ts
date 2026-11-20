import * as THREE from 'three';

/** Keep the cloud cutout and its centre aligned with the outer crust shell. */
export function alignCloudShell(clouds: THREE.Object3D, crust: THREE.Object3D): void {
  clouds.position.copy(crust.position);
  clouds.quaternion.copy(crust.quaternion);
  clouds.scale.copy(crust.scale);
}

/** Drift the texture rather than the mesh, so the cutaway edges stay aligned. */
export function advanceCloudDrift(offset: number, deltaSeconds: number): number {
  return (offset + Math.max(0, deltaSeconds) * 0.018 / (2 * Math.PI)) % 1;
}

export function applyCloudDrift(material: THREE.MeshStandardMaterial, offset: number): void {
  if (material.map) material.map.offset.x = offset;
  if (material.alphaMap) material.alphaMap.offset.x = offset;
}
