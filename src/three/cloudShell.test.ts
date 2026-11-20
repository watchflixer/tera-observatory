import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { computeCutawayAngles, getExplodedOffset } from '../utils/earthMath';
import { advanceCloudDrift, alignCloudShell, applyCloudDrift } from './cloudShell';

test('cloud shell follows the exploded crust and keeps both cutaway edges aligned', () => {
  for (const cutaway of [0, 45, 95, 180, 200]) {
    const { phiStart, phiLength } = computeCutawayAngles(cutaway);
    const crust = new THREE.Mesh(new THREE.SphereGeometry(2, 84, 56, phiStart, phiLength));
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(2.022, 84, 56, phiStart, phiLength));
    for (const explode of [0, 0.25, 0.5, 1]) {
      const offset = getExplodedOffset(4, explode);
      crust.position.set(-offset * 0.55, offset * 0.25, offset * 0.45);
      crust.rotation.y = 0.23;
      clouds.position.set(4, 2, -1);
      clouds.rotation.y = 1;
      alignCloudShell(clouds, crust);
      assert.ok(clouds.position.equals(crust.position));
      assert.ok(clouds.quaternion.equals(crust.quaternion));
      assert.equal(clouds.geometry.parameters.phiStart, crust.geometry.parameters.phiStart);
      assert.equal(clouds.geometry.parameters.phiLength, crust.geometry.parameters.phiLength);
      // The same directions at each edge, with the clouds just above the crust.
      for (const phi of [phiStart, phiStart + phiLength]) {
        const edge = new THREE.Vector3(-Math.cos(phi), 0, Math.sin(phi));
        const crustEdge = edge.clone().multiplyScalar(2).applyQuaternion(crust.quaternion).add(crust.position);
        const cloudEdge = edge.clone().multiplyScalar(2.022).applyQuaternion(clouds.quaternion).add(clouds.position);
        assert.ok(Math.abs(crustEdge.distanceTo(cloudEdge) - 0.022) < 1e-10);
      }
    }
    crust.geometry.dispose();
    clouds.geometry.dispose();
  }
});

test('cloud texture drifts independently of cutaway geometry and wraps', () => {
  const map = new THREE.Texture();
  const alphaMap = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({ map, alphaMap });
  const offset = advanceCloudDrift(0.999, 1);
  assert.ok(offset >= 0 && offset < 1);
  applyCloudDrift(material, offset);
  assert.equal(map.offset.x, offset);
  assert.equal(alphaMap.offset.x, offset);
  assert.equal(advanceCloudDrift(0.5, -1), 0.5);
  material.map = null;
  const next = advanceCloudDrift(offset, 1);
  applyCloudDrift(material, next);
  assert.equal(alphaMap.offset.x, next);
  material.dispose();
});
