import * as THREE from 'three';

export function setupLighting(scene) {
    scene.add(new THREE.AmbientLight(0x4444aa, 0.4));
    const pLight = new THREE.PointLight(0x00ffff, 60, 40);
    scene.add(pLight);
    return { pLight };
}
