import * as THREE from 'three';

export function applySceneFog(scene) {
    scene.fog = new THREE.Fog(0x050508, 18, 70);
}

export function setupEnvironment(scene) {
    scene.add(new THREE.GridHelper(500, 100, 0x00ffff, 0x050520));
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(200, 200),
        new THREE.MeshStandardMaterial({ color: 0x050508 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    scene.add(floor);
    return { floor };
}
