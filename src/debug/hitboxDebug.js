import * as THREE from 'three';

function disposeObjectTree(root) {
    root.traverse(object => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
            if (Array.isArray(object.material)) {
                for (const material of object.material) material.dispose();
            } else {
                object.material.dispose();
            }
        }
    });
    root.parent?.remove(root);
}

export function createPlayerHitboxDebug({ playerPivot }) {
    const root = new THREE.Group();
    root.visible = false;
    playerPivot.add(root);

    const volume = new THREE.Mesh(
        new THREE.CylinderGeometry(1.55, 1.55, 2.2, 24, 1, true),
        new THREE.MeshBasicMaterial({
            color: 0x34f2ff,
            wireframe: true,
            transparent: true,
            opacity: 0.42,
            depthWrite: false
        })
    );
    volume.position.y = 1.1;
    root.add(volume);

    const floorRing = new THREE.Mesh(
        new THREE.RingGeometry(1.42, 1.55, 36),
        new THREE.MeshBasicMaterial({
            color: 0x78fbff,
            transparent: true,
            opacity: 0.72,
            side: THREE.DoubleSide,
            depthWrite: false
        })
    );
    floorRing.rotation.x = -Math.PI / 2;
    floorRing.position.y = 0.04;
    root.add(floorRing);

    return {
        root,
        dispose() {
            disposeObjectTree(root);
        }
    };
}

export function createEnemyHitboxDebug({ enemyPivot }) {
    const root = new THREE.Group();
    root.visible = false;
    enemyPivot.add(root);

    const volume = new THREE.Mesh(
        new THREE.SphereGeometry(1.05, 14, 12),
        new THREE.MeshBasicMaterial({
            color: 0xff7aa7,
            wireframe: true,
            transparent: true,
            opacity: 0.5,
            depthWrite: false
        })
    );
    volume.position.y = 0.95;
    root.add(volume);

    const floorRing = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1.02, 28),
        new THREE.MeshBasicMaterial({
            color: 0xff9ec0,
            transparent: true,
            opacity: 0.66,
            side: THREE.DoubleSide,
            depthWrite: false
        })
    );
    floorRing.rotation.x = -Math.PI / 2;
    floorRing.position.y = 0.04;
    root.add(floorRing);

    return {
        root,
        dispose() {
            disposeObjectTree(root);
        }
    };
}
