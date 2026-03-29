import * as THREE from 'three';
import {
    ENEMY_HURTBOX_HEIGHT,
    ENEMY_HURTBOX_RADIUS,
    PLAYER_HURTBOX_RADIUS
} from '../core/constants.js';

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

    const centerMarker = new THREE.Mesh(
        new THREE.CircleGeometry(0.14, 20),
        new THREE.MeshBasicMaterial({
            color: 0x34f2ff,
            transparent: true,
            opacity: 0.82,
            side: THREE.DoubleSide,
            depthWrite: false
        })
    );
    centerMarker.rotation.x = -Math.PI / 2;
    centerMarker.position.y = 0.04;
    root.add(centerMarker);

    const floorRing = new THREE.Mesh(
        new THREE.RingGeometry(PLAYER_HURTBOX_RADIUS - 0.05, PLAYER_HURTBOX_RADIUS, 48),
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
        new THREE.CylinderGeometry(ENEMY_HURTBOX_RADIUS, ENEMY_HURTBOX_RADIUS, ENEMY_HURTBOX_HEIGHT * 2, 18, 1, true),
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

    const floorProjection = new THREE.Mesh(
        new THREE.RingGeometry(ENEMY_HURTBOX_RADIUS - 0.05, ENEMY_HURTBOX_RADIUS, 24),
        new THREE.MeshBasicMaterial({
            color: 0xff9ec0,
            transparent: true,
            opacity: 0.66,
            side: THREE.DoubleSide,
            depthWrite: false
        })
    );
    floorProjection.rotation.x = -Math.PI / 2;
    floorProjection.position.y = 0.04;
    root.add(floorProjection);

    const centerMarker = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 10, 10),
        new THREE.MeshBasicMaterial({
            color: 0xff9ec0,
            transparent: true,
            opacity: 0.9,
            depthWrite: false
        })
    );
    centerMarker.position.y = 0.95;
    root.add(centerMarker);

    return {
        root,
        dispose() {
            disposeObjectTree(root);
        }
    };
}
