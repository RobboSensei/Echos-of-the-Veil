import * as THREE from 'three';
import {
    PLAYER_HURTBOX_RADIUS,
    enemyBaseColor,
    enemyHitColor,
    enemyLungeColor,
    enemyTelegraphColor
} from '../core/constants.js';

function startEnemyRecovery(enemy) {
    enemy.state = 'recovery';
    enemy.recoveryT = 0.9;
    enemy.attackCooldown = 1.8 + Math.random() * 0.8;
    enemy.playerHitThisLunge = false;
}

export function createEchoStalker({
    scene,
    spawnOrigin = new THREE.Vector3(),
    spawnAngle = Math.atan2(2.5, 8.5),
    spawnRadius = Math.sqrt((8.5 * 8.5) + (2.5 * 2.5))
}) {
    const enemyPivot = new THREE.Group();
    scene.add(enemyPivot);
    enemyPivot.position.set(
        spawnOrigin.x + Math.cos(spawnAngle) * spawnRadius,
        0,
        spawnOrigin.z + Math.sin(spawnAngle) * spawnRadius
    );

    const enemyShadow = new THREE.Mesh(
        new THREE.CircleGeometry(0.8, 32),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42 })
    );
    enemyShadow.rotation.x = -Math.PI / 2;
    enemyShadow.position.y = 0.02;
    enemyPivot.add(enemyShadow);

    const enemyModel = new THREE.Group();
    enemyPivot.add(enemyModel);

    const enemyMat = new THREE.MeshStandardMaterial({
        color: 0xff4fd8,
        emissive: 0x8a134f,
        emissiveIntensity: 0.42,
        roughness: 0.35,
        metalness: 0.15,
        transparent: true
    });

    const enemyCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), enemyMat);
    enemyCore.position.y = 0.95;
    enemyModel.add(enemyCore);

    const enemyHalo = new THREE.Mesh(
        new THREE.TorusGeometry(0.9, 0.08, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0xff8dea, transparent: true, opacity: 0.18 })
    );
    enemyHalo.rotation.x = Math.PI / 2;
    enemyHalo.position.y = 0.95;
    enemyModel.add(enemyHalo);

    const enemyHpRoot = new THREE.Group();
    scene.add(enemyHpRoot);

    const enemyHpBg = new THREE.Mesh(
        new THREE.PlaneGeometry(1.9, 0.28),
        new THREE.MeshBasicMaterial({ color: 0x140812, transparent: true, opacity: 0.8, depthWrite: false, depthTest: false })
    );
    enemyHpRoot.add(enemyHpBg);

    const enemyHpFill = new THREE.Mesh(
        new THREE.PlaneGeometry(1.7, 0.16),
        new THREE.MeshBasicMaterial({ color: 0xff627f, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false })
    );
    enemyHpFill.position.z = 0.01;
    enemyHpRoot.add(enemyHpFill);

    const enemy = {
        state: 'orbit',
        angle: spawnAngle,
        radius: spawnRadius,
        attackCooldown: 2.2,
        telegraphT: 0,
        lungeT: 0,
        recoveryT: 0,
        hitStunT: 0,
        deadT: 0,
        bobT: 0,
        strafeDir: 1,
        lungeDir: new THREE.Vector3(),
        playerHitThisLunge: false,
        hitFlashT: 0,
        maxHealth: 4.0,
        health: 4.0,
        lastHitAttackId: -1
    };

    return {
        enemy,
        enemyPivot,
        enemyShadow,
        enemyModel,
        enemyMat,
        enemyCore,
        enemyHalo,
        enemyHpRoot,
        enemyHpBg,
        enemyHpFill,
        enemyKnockback: new THREE.Vector3(),
        enemyTargetPos: new THREE.Vector3(),
        enemyLookTarget: new THREE.Vector3(),
        scratchZero: new THREE.Vector3()
    };
}

export function disposeEchoStalker(echoStalker) {
    const {
        enemyPivot,
        enemyShadow,
        enemyCore,
        enemyHalo,
        enemyMat,
        enemyHpRoot,
        enemyHpBg,
        enemyHpFill
    } = echoStalker;

    enemyPivot.parent?.remove(enemyPivot);
    enemyHpRoot.parent?.remove(enemyHpRoot);

    enemyShadow.geometry.dispose();
    enemyShadow.material.dispose();
    enemyCore.geometry.dispose();
    enemyMat.dispose();
    enemyHalo.geometry.dispose();
    enemyHalo.material.dispose();
    enemyHpBg.geometry.dispose();
    enemyHpBg.material.dispose();
    enemyHpFill.geometry.dispose();
    enemyHpFill.material.dispose();
}

export function updateEnemy({ echoStalker, dt, elapsedTime, playerPivot, enemyKnockback, hitPlayer }) {
    const {
        enemy,
        enemyPivot,
        enemyShadow,
        enemyModel,
        enemyMat,
        enemyCore,
        enemyHalo,
        enemyTargetPos,
        enemyLookTarget,
        scratchZero
    } = echoStalker;

    if (!enemyPivot.visible) return;

    enemy.hitFlashT = Math.max(0, enemy.hitFlashT - dt);
    if (enemy.state === 'orbit') {
        enemy.attackCooldown -= dt;
        enemy.angle += dt * 0.85 * enemy.strafeDir;
        enemy.radius = THREE.MathUtils.lerp(enemy.radius, 8 + Math.sin(elapsedTime * 0.9) * 0.35, Math.min(1, dt * 1.6));
        enemyTargetPos.set(
            playerPivot.position.x + Math.cos(enemy.angle) * enemy.radius,
            0,
            playerPivot.position.z + Math.sin(enemy.angle) * enemy.radius
        );
        enemyPivot.position.lerp(enemyTargetPos, Math.min(1, dt * 2.4));

        if (enemy.attackCooldown <= 0 && enemyPivot.position.distanceTo(playerPivot.position) < 10.5) {
            enemy.state = 'telegraph';
            enemy.telegraphT = 0.55;
        }
    } else if (enemy.state === 'telegraph') {
        enemy.telegraphT -= dt;
        enemyTargetPos.copy(enemyPivot.position).lerp(playerPivot.position, Math.min(1, dt * 0.9));
        enemyTargetPos.y = 0;
        enemyPivot.position.lerp(enemyTargetPos, Math.min(1, dt * 1.2));

        if (enemy.telegraphT <= 0) {
            enemy.state = 'lunge';
            enemy.lungeT = 0.22;
            enemy.playerHitThisLunge = false;
            enemy.lungeDir.subVectors(playerPivot.position, enemyPivot.position).setY(0);
            if (enemy.lungeDir.lengthSq() < 0.0001) enemy.lungeDir.set(0, 0, -1);
            enemy.lungeDir.normalize();
        }
    } else if (enemy.state === 'lunge') {
        enemyPivot.position.addScaledVector(enemy.lungeDir, 23 * dt);
        enemy.lungeT -= dt;

        if (!enemy.playerHitThisLunge && enemyPivot.position.distanceTo(playerPivot.position) < PLAYER_HURTBOX_RADIUS) {
            enemy.playerHitThisLunge = true;
            hitPlayer();
        }

        if (enemy.lungeT <= 0) startEnemyRecovery(enemy);
    } else if (enemy.state === 'recovery') {
        enemy.recoveryT -= dt;
        if (enemy.recoveryT <= 0) {
            enemy.state = 'orbit';
            enemy.strafeDir *= Math.random() > 0.45 ? 1 : -1;
        }
    } else if (enemy.state === 'hitstun') {
        enemy.hitStunT -= dt;
        enemyPivot.position.addScaledVector(enemyKnockback, dt);
        enemyKnockback.lerp(scratchZero.set(0, 0, 0), Math.min(1, dt * 10));
        if (enemy.hitStunT <= 0) startEnemyRecovery(enemy);
    } else if (enemy.state === 'dead') {
        enemy.deadT -= dt;
        enemyPivot.position.addScaledVector(enemyKnockback, dt * 0.4);
        enemyKnockback.lerp(scratchZero.set(0, 0, 0), Math.min(1, dt * 8));
        if (enemy.deadT <= 0) {
            enemyPivot.visible = false;
        }
    }

    enemyLookTarget.copy(playerPivot.position);
    enemyLookTarget.y = enemyPivot.position.y;
    enemyPivot.lookAt(enemyLookTarget);

    enemy.bobT += dt * (enemy.state === 'lunge' ? 9 : 4.5);
    enemyModel.position.y = 0.32 + Math.sin(enemy.bobT) * 0.07;
    enemyCore.rotation.x += dt * 1.4;
    enemyCore.rotation.y += dt * 2.3;
    enemyHalo.rotation.z += dt * 1.6;

    let visualColor = enemyBaseColor;
    let emissiveIntensity = 0.48;
    let haloOpacity = 0.18;
    let scale = 1;
    let opacity = 1;

    if (enemy.state === 'telegraph') {
        const pulse = 0.5 + Math.sin((0.55 - enemy.telegraphT) * 22) * 0.5;
        visualColor = enemyTelegraphColor;
        emissiveIntensity = 0.78 + pulse * 0.48;
        haloOpacity = 0.24 + pulse * 0.16;
        scale = 1 + pulse * 0.16;
    } else if (enemy.state === 'lunge') {
        visualColor = enemyLungeColor;
        emissiveIntensity = 1.05;
        haloOpacity = 0.34;
        scale = 1.08;
    } else if (enemy.state === 'recovery') {
        emissiveIntensity = 0.34;
        haloOpacity = 0.12;
        scale = 0.96;
    } else if (enemy.state === 'hitstun') {
        emissiveIntensity = 0.3;
        haloOpacity = 0.1;
        scale = 0.92;
    } else if (enemy.state === 'dead') {
        const fade = THREE.MathUtils.clamp(enemy.deadT / 0.28, 0, 1);
        visualColor = enemyHitColor;
        emissiveIntensity = 1.05;
        haloOpacity = fade * 0.3;
        scale = 1.05 + (1 - fade) * 0.45;
        opacity = fade;
    }

    if (enemy.hitFlashT > 0) {
        visualColor = enemyHitColor;
        emissiveIntensity += 0.45;
        haloOpacity = 0.36;
        scale += 0.08;
    }

    enemyMat.color.copy(visualColor);
    enemyMat.emissive.copy(visualColor).multiplyScalar(0.18);
    enemyMat.emissiveIntensity = emissiveIntensity;
    enemyMat.opacity = opacity;
    enemyCore.scale.setScalar(scale);
    enemyHalo.material.color.copy(visualColor);
    enemyHalo.material.opacity = haloOpacity * opacity;
    enemyShadow.material.opacity = 0.42 * opacity;
}
