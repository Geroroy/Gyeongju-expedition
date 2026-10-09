// 정적 메시를 재질 + 공간 격자별로 병합해 드로우콜을 줄인다 (격자 단위로 컬링은 유지).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const CELL = 250;

export function staticBatch(root) {
  root.updateMatrixWorld(true);
  const groups = new Map();
  const victims = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.dynamic) return;
    if (Array.isArray(o.material)) return;
    const p = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
    const key = `${o.material.uuid}|${Math.floor(p.x / CELL)}|${Math.floor(p.z / CELL)}|${o.castShadow ? 1 : 0}`;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { material: o.material, geos: [], cast: o.castShadow, receive: o.receiveShadow }));
    let geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    const keep = ['position', 'normal', 'uv'];
    if (o.material.vertexColors) keep.push('color');
    for (const name of Object.keys(geo.attributes)) if (!keep.includes(name)) geo.deleteAttribute(name);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    if (o.material.vertexColors && !geo.attributes.color) {
      const c = new Float32Array(geo.attributes.position.count * 3).fill(1);
      geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    }
    geo.applyMatrix4(o.matrixWorld);
    g.geos.push(geo);
    victims.push(o);
  });
  for (const o of victims) o.parent.remove(o);
  let n = 0;
  for (const g of groups.values()) {
    const merged = mergeGeometries(g.geos);
    if (!merged) continue;
    const m = new THREE.Mesh(merged, g.material);
    m.castShadow = g.cast;
    m.receiveShadow = g.receive;
    root.add(m);
    n++;
  }
  return { before: victims.length, after: n };
}
