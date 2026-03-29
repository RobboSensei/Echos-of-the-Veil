import * as THREE from 'three';
import {
    ATTACK_1_BRIDGE_BLEND_TIME,
    ATTACK_1_BRIDGE_START_PROGRESS,
    ATTACK_1_CONFIG,
    ATTACK_1_END_T,
    ATTACK_2_CONFIG,
    ATTACK_BUFFER,
    PLAYER_MAX_HP,
    ROLL_BUFFER_WINDOW,
    ROLL_COOLDOWN,
    ROLL_DURATION,
    WEAPON_IDLE_X,
    WEAPON_IDLE_Y,
    WEAPON_IDLE_Z,
    playerBaseColor,
    playerHitColor
} from './constants.js';
import { ATTACK1_DEBUG_TOGGLE_KEY } from '../config/debugFlags.js';
import { renderAttack1DebugOverlay } from '../debug/debugOverlay.js';
import { createEchoStalker, disposeEchoStalker, updateEnemy } from '../enemy/echoStalker.js';
import { createInput } from '../input/input.js';
import {
    applyAttack1Pose,
    getAttack1CarryOffset,
    setAttack1WeaponTargets
} from '../combat/attack1.js';
import {
    applyAttack2Pose,
    getAttack2ActiveEndTime,
    getAttack2ActiveStartTime,
    getAttack2CarryOffset,
    getAttack2Damage,
    getAttack2DisplayT,
    getAttack2HitRange,
    getAttack2HitStun,
    getAttack2Knockback,
    getAttack2MaxLateral,
    getAttack2PendingPoseTime,
    getAttack2RootLungeOffset,
    getAttack2SelectedChargeT,
    getAttack2TotalTime,
    getAttack2ChargeRatio,
    setAttack2WeaponTargets
} from '../combat/attack2.js';
import { createPlayer } from '../player/createPlayer.js';
import {
    getAttackIntent,
    getFlatCameraForward,
    getWeaponParentLabel,
    rotateModelToward,
    validateAnatomicalCombatRig
} from '../player/playerProcedural.js';
import { applySceneFog, setupEnvironment, updateEnvironment } from '../scene/environment.js';
import { setupLighting } from '../scene/lighting.js';
import { easeInOutCubic } from '../utils/easing.js';

function createHeartGeometry() {
    const heartShape = new THREE.Shape();
    heartShape.moveTo(0, 0.35);
    heartShape.bezierCurveTo(0, 0.35, -0.45, -0.15, -0.9, -0.6);
    heartShape.bezierCurveTo(-1.35, -1.02, -1.32, -1.72, -0.85, -2.05);
    heartShape.bezierCurveTo(-0.42, -2.35, 0.02, -2.12, 0.25, -1.78);
    heartShape.bezierCurveTo(0.48, -2.12, 0.92, -2.35, 1.35, -2.05);
    heartShape.bezierCurveTo(1.82, -1.72, 1.85, -1.02, 1.4, -0.6);
    heartShape.bezierCurveTo(0.95, -0.15, 0.5, 0.35, 0.5, 0.35);
    const heartGeometry = new THREE.ShapeGeometry(heartShape, 24);
    heartGeometry.center();
    heartGeometry.rotateZ(Math.PI);
    return heartGeometry;
}

export function createGame({ runtime, dom }) {
    const comboTag = dom.comboTag;
    const snapFill = dom.snapFill;
    const playerHpFill = dom.playerHpFill;
    const damageTint = dom.damageTint;
    const attack1DebugEl = dom.attack1DebugEl;
    const deathScreen = dom.deathScreen;

    // --- SCENE SETUP ---
    const clock = runtime.clock;
    const scene = runtime.scene;
    const camera = runtime.camera;
    const lookTarget = new THREE.Vector3(0, 2, 0);
    const desiredLookTarget = new THREE.Vector3();
    const renderer = runtime.renderer;
    const HEART_SPAWN_INTERVAL = 15;
    const HEART_SPAWN_RADIUS = 14.5;
    const HEART_PICKUP_RADIUS = 1.35;
    const HEART_MIN_PLAYER_DISTANCE = 4.5;
    const HEART_MIN_ENEMY_DISTANCE = 2.75;
    const HEART_MIN_HEART_SPACING = 2.25;
    const HEART_HEAL_AMOUNT = PLAYER_MAX_HP * 0.25;
    const BLOCK_MOVE_SPEED = 7.5;
    const BLOCK_FACING_DOT = 0.2;
    applySceneFog(scene);
    const { pLight } = setupLighting(scene);
    setupEnvironment(scene);

    // --- PLAYER RIG (RESTORED EYES/BODY) ---
    const {
        playerPivot,
        playerModel,
        shadow,
        body,
        bodyMat,
        limbMat,
        leftHand,
        rightHand,
        leftFoot,
        rightFoot,
        anatomicalLeftHand,
        anatomicalRightHand,
        anatomicalLeftFoot,
        anatomicalRightFoot,
        anatomicalLeftHandDebugMarker,
        anatomicalRightHandDebugMarker,
        anatomicalLeftFootDebugMarker,
        anatomicalRightFootDebugMarker,
        eyeL,
        eyeR,
        weaponPivot,
        sword,
        tip,
        base,
        BODY_HOME_Y,
        FOOT_BASE_ROT_X,
        EYE_L_HOME,
        EYE_R_HOME,
        ANATOMICAL_LEFT_HAND_HOME,
        ANATOMICAL_RIGHT_HAND_HOME,
        ANATOMICAL_LEFT_HAND_IDLE,
        ANATOMICAL_RIGHT_HAND_IDLE,
        ANATOMICAL_LEFT_FOOT_HOME,
        ANATOMICAL_RIGHT_FOOT_HOME
    } = createPlayer({ scene });

    // --- STABLE TRAIL SYSTEM (NOW WITH SMOOTH GRADIENT) ---
    const trailMax = 22;
    const trailGeo = new THREE.PlaneGeometry(1, 1, 1, trailMax - 1);

    // Generate Vertex Colors for the fade out
    const trailColors = new Float32Array(trailMax * 2 * 3);
    const baseColor = new THREE.Color(0x00ffff);
    for (let i = 0; i < trailMax; i++) {
        const intensity = Math.pow(1.0 - (i / (trailMax - 1)), 1.65); // 1.0 at blade, softer fade at tail
        const c = baseColor.clone().multiplyScalar(intensity);
        // Base vertex
        trailColors[i * 6 + 0] = c.r; trailColors[i * 6 + 1] = c.g; trailColors[i * 6 + 2] = c.b;
        // Tip vertex
        trailColors[i * 6 + 3] = c.r; trailColors[i * 6 + 4] = c.g; trailColors[i * 6 + 5] = c.b;
    }
    trailGeo.setAttribute('color', new THREE.BufferAttribute(trailColors, 3));

    // Added vertexColors: true so the gradient renders
    const trailMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const trailMesh = new THREE.Mesh(trailGeo, trailMat);
    scene.add(trailMesh);
    const trailPoints = [];

    // --- TEST ENEMIES: ECHO-STALKERS ---
    const enemies = [];
    const heartPickups = [];
    let heartSpawnT = HEART_SPAWN_INTERVAL;

    const hitBurst = new THREE.Mesh(
        new THREE.RingGeometry(0.18, 0.55, 24),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    hitBurst.visible = false;
    scene.add(hitBurst);

    const cameraOrbit = new THREE.Group();
    scene.add(cameraOrbit);
    cameraOrbit.add(camera);
    camera.position.set(0, 11, 22);
    camera.lookAt(lookTarget);

    // --- COMBAT LOGIC ---
    let isAttacking = false, attackT = 0, orbitY = 0;
    let currentAttackType = null;
    let bufferedAttackType = null;
    let queuedAttackType = null;
    let attackBufferT = 0;
    let queuedAttackT = 0;
    let attack1Held = false;
    let attack2Held = false;
    let rollHeld = false;
    let attackId = 0;
    let snapMeter = 0;
    let hitStopT = 0;
    let playerFlashT = 0;
    let playerHitStunT = 0;
    let damageTintT = 0;
    let impactBurstT = 0;
    let playerHp = 5;
    let previousAttackT = 0;
    let attackHitConnected = false;
    let attackStartedFromBridge = false;
    let attackEntryCarry = 0;
    let attackBridgeBlendT = 0;
    let pendingAttack2 = false;
    let pendingAttack2HoldT = 0;
    let attack2ChargeT = 0;
    let attack2IsCharging = false;
    let attack2Released = false;
    let defeatedEnemyCount = 0;
    let isGameOver = false;
    let isBlocking = false;
    let isRolling = false;
    let rollT = 0;
    let rollCooldownT = 0;
    let walkTimer = 0;
    let moveAnimT = 0;
    let blockFlashT = 0;
    const keys = {};
    const moveAxis = new THREE.Vector3(0, 1, 0);
    const cameraForward = new THREE.Vector3();
    const attackIntent = new THREE.Vector3(0, 0, -1);
    const lastMoveWorld = new THREE.Vector3(0, 0, 0);
    const enemyCenter = new THREE.Vector3();
    const tempVecA = new THREE.Vector3();
    const tempVecB = new THREE.Vector3();
    const tempVecC = new THREE.Vector3();
    const attackBasePos = new THREE.Vector3();
    const attackTipPos = new THREE.Vector3();
    const attackEntryWeaponPos = new THREE.Vector3();
    const attackEntryWeaponRot = new THREE.Vector3();
    const attackTargetWeaponPos = new THREE.Vector3();
    const attack1WeaponReturnPos = new THREE.Vector3();
    const attack1WeaponReturnRot = new THREE.Vector3();
    const attack2WeaponReturnPos = new THREE.Vector3();
    const attack2WeaponReturnRot = new THREE.Vector3();
    const attackToEnemy = new THREE.Vector3();
    const attackRight = new THREE.Vector3();
    let currentWaveSize = 1;
    let pendingWaveSize = 0;
    const playerRig = {
        body,
        eyeL,
        eyeR,
        weaponPivot,
        attack1WeaponReturnPos,
        attack1WeaponReturnRot,
        attack2WeaponReturnPos,
        attack2WeaponReturnRot,
        BODY_HOME_Y,
        EYE_L_HOME,
        EYE_R_HOME,
        anatomicalLeftHand,
        anatomicalRightHand,
        anatomicalLeftFoot,
        anatomicalRightFoot,
        ANATOMICAL_LEFT_HAND_HOME,
        ANATOMICAL_RIGHT_HAND_HOME,
        ANATOMICAL_LEFT_HAND_IDLE,
        ANATOMICAL_RIGHT_HAND_IDLE,
        ANATOMICAL_LEFT_FOOT_HOME,
        ANATOMICAL_RIGHT_FOOT_HOME
    };
    const ATTACK_1_RUNTIME_ROLE_LABELS = Object.freeze({
        strikeHand: 'anatomicalLeftHand',
        counterHand: 'anatomicalRightHand',
        stepFoot: 'anatomicalLeftFoot',
        braceFoot: 'anatomicalRightFoot'
    });
    const attack1DebugState = {
        active: false,
        strikeHand: '',
        counterHand: '',
        stepFoot: '',
        braceFoot: '',
        weaponParent: '',
        strikeVals: '',
        counterVals: '',
        stepVals: '',
        braceVals: ''
    };
    const playerProceduralContext = {
        camera,
        cameraForward,
        moveAxis,
        playerModel,
        attackIntent,
        lastMoveWorld,
        weaponPivot,
        anatomicalLeftHand,
        anatomicalRightHand,
        anatomicalLeftFoot,
        anatomicalRightFoot,
        leftHand,
        rightHand,
        leftFoot,
        rightFoot,
        debug: { attack1DebugValidated: false }
    };
    const attack1DebugContext = {
        attack1DebugState,
        runtimeRoleLabels: ATTACK_1_RUNTIME_ROLE_LABELS,
        getWeaponParentLabel: () => getWeaponParentLabel(playerProceduralContext)
    };
    let attack1DebugEnabled = false;
    const playerKnockback = new THREE.Vector3();
    const rollDirection = new THREE.Vector3(0, 0, 1);
    const playerForward = new THREE.Vector3(0, 0, 1);
    createInput({
        keys,
        onKeyDown: e => {
            if (e.code === ATTACK1_DEBUG_TOGGLE_KEY && !e.repeat) {
                attack1DebugEnabled = !attack1DebugEnabled;
                if (attack1DebugEnabled) validateAnatomicalCombatRig(playerProceduralContext);
                console.info(`[ATTACK 1 DEBUG] ${attack1DebugEnabled ? 'enabled' : 'disabled'} (${ATTACK1_DEBUG_TOGGLE_KEY})`);
            }
        }
    });

    function setPlayerHp(value) {
        playerHp = THREE.MathUtils.clamp(value, 0, PLAYER_MAX_HP);
        playerHpFill.style.width = `${(playerHp / PLAYER_MAX_HP) * 100}%`;
    }

    function setSnapMeter(value) {
        snapMeter = THREE.MathUtils.clamp(value, 0, 100);
        snapFill.style.width = `${snapMeter}%`;
    }

    function addSnap(amount) {
        setSnapMeter(snapMeter + amount);
    }

    function getAttackProgress(type, rawT = attackT) {
        if (type === 'attack1') return Math.min(rawT / ATTACK_1_END_T, 1);
        if (type === 'attack2') return getAttack2DisplayT(rawT, getAttack2ChargeRatio(attack2ChargeT));
        return 0;
    }

    function getAttackCarryOffset(type, rawT = attackT) {
        if (type === 'attack1') return getAttack1CarryOffset(getAttackProgress(type, rawT));
        if (type === 'attack2') {
            return getAttack2CarryOffset(
                getAttackProgress(type, rawT),
                getAttack2ChargeRatio(attack2ChargeT),
                attack2IsCharging
            );
        }
        return 0;
    }

    function createEnemySpawnOrigin() {
        return new THREE.Vector3(playerPivot.position.x, 0, playerPivot.position.z);
    }

    function getActiveEnemies() {
        return enemies.filter(({ enemy, enemyPivot }) => enemyPivot.visible && enemy.state !== 'dead');
    }

    function updateEnemyHealthBar(echoStalker) {
        const { enemy, enemyHpFill } = echoStalker;
        const ratio = THREE.MathUtils.clamp(enemy.health / enemy.maxHealth, 0, 1);
        enemyHpFill.scale.x = ratio;
        enemyHpFill.position.x = -0.85 + 0.85 * ratio;
        enemyHpFill.material.color.set(ratio > 0.5 ? 0xff627f : 0xff3b5c);
    }

    function spawnEnemy({ angle, radius } = {}) {
        const echoStalker = createEchoStalker({
            scene,
            spawnOrigin: createEnemySpawnOrigin(),
            spawnAngle: angle,
            spawnRadius: radius
        });
        updateEnemyHealthBar(echoStalker);
        enemies.push(echoStalker);
        return echoStalker;
    }

    function spawnEnemyBurst(count) {
        const baseAngle = Math.random() * Math.PI * 2;
        for (let i = 0; i < count; i += 1) {
            const angle = baseAngle + (i / Math.max(1, count)) * Math.PI * 2;
            const radius = 7.2 + (i % 3) * 1.15 + Math.random() * 0.55;
            spawnEnemy({ angle, radius });
        }
    }

    function createHeartPickup(position) {
        const root = new THREE.Group();
        root.position.copy(position);
        scene.add(root);

        const shadow = new THREE.Mesh(
            new THREE.CircleGeometry(0.52, 24),
            new THREE.MeshBasicMaterial({ color: 0x1b0a12, transparent: true, opacity: 0.24, depthWrite: false })
        );
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.04;
        root.add(shadow);

        const glow = new THREE.Mesh(
            new THREE.RingGeometry(0.34, 0.64, 24),
            new THREE.MeshBasicMaterial({
                color: 0xff9cb7,
                transparent: true,
                opacity: 0.46,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            })
        );
        glow.position.y = 1.08;
        root.add(glow);

        const icon = new THREE.Mesh(
            createHeartGeometry(),
            new THREE.MeshBasicMaterial({
                color: 0xff5f86,
                transparent: true,
                opacity: 0.96,
                side: THREE.DoubleSide,
                depthWrite: false
            })
        );
        icon.position.y = 1.08;
        icon.scale.setScalar(0.34);
        root.add(icon);

        return {
            root,
            shadow,
            glow,
            icon,
            bobOffset: Math.random() * Math.PI * 2
        };
    }

    function disposeHeartPickup(heartPickup) {
        const { root, shadow, glow, icon } = heartPickup;
        root.parent?.remove(root);
        shadow.geometry.dispose();
        shadow.material.dispose();
        glow.geometry.dispose();
        glow.material.dispose();
        icon.geometry.dispose();
        icon.material.dispose();
    }

    function findHeartSpawnPosition() {
        const heartSpawnPosition = new THREE.Vector3();
        for (let attempt = 0; attempt < 18; attempt += 1) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.sqrt(Math.random()) * HEART_SPAWN_RADIUS;
            heartSpawnPosition.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);

            if (heartSpawnPosition.distanceToSquared(playerPivot.position) < HEART_MIN_PLAYER_DISTANCE * HEART_MIN_PLAYER_DISTANCE) {
                continue;
            }

            if (heartPickups.some(({ root }) => root.position.distanceToSquared(heartSpawnPosition) < HEART_MIN_HEART_SPACING * HEART_MIN_HEART_SPACING)) {
                continue;
            }

            if (getActiveEnemies().some(({ enemyPivot }) => enemyPivot.position.distanceToSquared(heartSpawnPosition) < HEART_MIN_ENEMY_DISTANCE * HEART_MIN_ENEMY_DISTANCE)) {
                continue;
            }

            return heartSpawnPosition.clone();
        }

        return heartSpawnPosition.set(0, 0, 0);
    }

    function spawnHeartPickup() {
        heartPickups.push(createHeartPickup(findHeartSpawnPosition()));
    }

    function collectHeartPickup(index) {
        const heartPickup = heartPickups[index];
        setPlayerHp(playerHp + HEART_HEAL_AMOUNT);
        disposeHeartPickup(heartPickup);
        heartPickups.splice(index, 1);
    }

    function updateHeartPickups(elapsedTime, delta) {
        heartSpawnT -= delta;
        while (heartSpawnT <= 0) {
            spawnHeartPickup();
            heartSpawnT += HEART_SPAWN_INTERVAL;
        }

        const canHeal = playerHp < PLAYER_MAX_HP;
        for (let i = heartPickups.length - 1; i >= 0; i -= 1) {
            const heartPickup = heartPickups[i];
            const bob = 1.08 + Math.sin(elapsedTime * 2.8 + heartPickup.bobOffset) * 0.16;
            const spin = elapsedTime * 0.7 + heartPickup.bobOffset;
            heartPickup.icon.position.y = bob;
            heartPickup.glow.position.y = bob;
            heartPickup.shadow.scale.setScalar(0.92 + Math.sin(elapsedTime * 2.8 + heartPickup.bobOffset) * 0.05);

            heartPickup.icon.quaternion.copy(camera.quaternion);
            heartPickup.icon.rotateZ(Math.sin(elapsedTime * 1.9 + heartPickup.bobOffset) * 0.14);
            heartPickup.glow.quaternion.copy(camera.quaternion);
            heartPickup.glow.rotateZ(spin);

            if (!canHeal) continue;

            const dx = heartPickup.root.position.x - playerPivot.position.x;
            const dz = heartPickup.root.position.z - playerPivot.position.z;
            if ((dx * dx) + (dz * dz) <= HEART_PICKUP_RADIUS * HEART_PICKUP_RADIUS) {
                collectHeartPickup(i);
            }
        }
    }

    function cleanupDeadEnemies() {
        for (let i = enemies.length - 1; i >= 0; i -= 1) {
            if (enemies[i].enemyPivot.visible) continue;
            disposeEchoStalker(enemies[i]);
            enemies.splice(i, 1);
        }
    }

    function queueNextWave() {
        if (pendingWaveSize > 0) return;
        pendingWaveSize = currentWaveSize * 2;
    }

    function maybeStartNextWave() {
        if (pendingWaveSize === 0 || enemies.length > 0) return;
        currentWaveSize = pendingWaveSize;
        pendingWaveSize = 0;
        spawnEnemyBurst(currentWaveSize);
    }

    function resetPendingAttack2() {
        pendingAttack2 = false;
        pendingAttack2HoldT = 0;
    }

    function resetAttackState() {
        isAttacking = false;
        currentAttackType = null;
        attackT = 0;
        previousAttackT = 0;
        attackHitConnected = false;
        attackStartedFromBridge = false;
        attackEntryCarry = 0;
        attackBridgeBlendT = 0;
        attack2ChargeT = 0;
        attack2IsCharging = false;
        attack2Released = false;
        queuedAttackType = null;
        queuedAttackT = 0;
        comboTag.innerText = 'READY';
    }

    function resetWeaponToIdle() {
        weaponPivot.scale.setScalar(1);
        weaponPivot.position.set(WEAPON_IDLE_X, WEAPON_IDLE_Y, WEAPON_IDLE_Z);
        weaponPivot.rotation.set(0, 0, 0);
    }

    function startAttack(type, worldMove, { fromBridge = false, preserveIntent = false } = {}) {
        if (!fromBridge && (isAttacking || isRolling)) return false;
        resetPendingAttack2();
        if (fromBridge) {
            attackEntryCarry = getAttackCarryOffset(currentAttackType, attackT);
        } else {
            attackEntryCarry = 0;
        }
        isAttacking = true;
        currentAttackType = type;
        attackT = fromBridge && type === 'attack1'
            ? ATTACK_1_END_T * ATTACK_1_BRIDGE_START_PROGRESS
            : 0;
        attackId += 1;
        previousAttackT = 0;
        attackHitConnected = false;
        attackStartedFromBridge = fromBridge && type === 'attack1';
        attackBridgeBlendT = 0;
        attack2ChargeT = 0;
        attack2IsCharging = false;
        attack2Released = type !== 'attack2';
        queuedAttackType = null;
        queuedAttackT = 0;
        if (type === 'attack1' && attack1DebugEnabled) {
            console.info(
                `[ATTACK 1 DEBUG] strikeHand:${ATTACK_1_RUNTIME_ROLE_LABELS.strikeHand} counterHand:${ATTACK_1_RUNTIME_ROLE_LABELS.counterHand} stepFoot:${ATTACK_1_RUNTIME_ROLE_LABELS.stepFoot} braceFoot:${ATTACK_1_RUNTIME_ROLE_LABELS.braceFoot} weaponParent:${getWeaponParentLabel(playerProceduralContext)}`
            );
        }
        if (!preserveIntent) getAttackIntent(playerProceduralContext, worldMove);
        attackEntryWeaponPos.copy(weaponPivot.position);
        attackEntryWeaponRot.set(weaponPivot.rotation.x, weaponPivot.rotation.y, weaponPivot.rotation.z);
        trailMat.opacity = Math.max(trailMat.opacity, type === 'attack1' ? ATTACK_1_CONFIG.trailOpacity : ATTACK_2_CONFIG.trailOpacity);
        comboTag.innerText = type === 'attack1' ? 'ATTACK 1' : 'ATTACK 2';
        return true;
    }

    function startAttack2Variant(worldMove, holdT) {
        const selectedChargeT = getAttack2SelectedChargeT(holdT);
        const selectedPoseT = getAttack2PendingPoseTime(holdT, selectedChargeT);
        if (!startAttack('attack2', worldMove)) return false;
        attackT = selectedPoseT;
        previousAttackT = selectedPoseT;
        attack2ChargeT = selectedChargeT;
        attack2IsCharging = false;
        attack2Released = true;
        return true;
    }

    function getRollDirection(worldMove) {
        if (worldMove.lengthSq() > 0.01) {
            rollDirection.copy(worldMove).normalize();
        } else if (lastMoveWorld.lengthSq() > 0.01) {
            rollDirection.copy(lastMoveWorld);
        } else if (attackIntent.lengthSq() > 0.01) {
            rollDirection.copy(attackIntent);
        } else {
            rollDirection.set(0, 0, 1).applyQuaternion(playerModel.quaternion).normalize();
        }
        return rollDirection;
    }

    function startRoll(worldMove) {
        if (isRolling || isAttacking || rollCooldownT > 0 || playerHitStunT > 0 || playerHp <= 0) return false;
        resetPendingAttack2();
        isRolling = true;
        rollT = ROLL_DURATION;
        rollCooldownT = ROLL_COOLDOWN;
        getRollDirection(worldMove);
        lastMoveWorld.copy(rollDirection);
        rotateModelToward(playerProceduralContext, rollDirection, 1);
        trailMat.opacity = Math.max(trailMat.opacity, 0.7);
        return true;
    }

    function isRollInvulnerable() {
        if (!isRolling) return false;
        const progress = 1 - (rollT / ROLL_DURATION);
        return progress >= 0.12 && progress <= 0.78;
    }

    function shouldEvaluateAttackHit(type, t, prevT, chargeRatio = 0) {
        const activeStart = type === 'attack1' ? ATTACK_1_CONFIG.activeStart : getAttack2ActiveStartTime(chargeRatio);
        const activeEnd = type === 'attack1' ? ATTACK_1_CONFIG.activeEnd : getAttack2ActiveEndTime(chargeRatio);
        const inWindow = t >= activeStart && t <= activeEnd;
        const overlappedWindow = prevT < activeEnd && t >= activeStart;
        return inWindow || overlappedWindow;
    }

    function canBridgeAttack2IntoAttack1(t, chargeRatio = 0) {
        const activeEnd = getAttack2ActiveEndTime(chargeRatio);
        return attackHitConnected
            && queuedAttackType === 'attack1'
            && queuedAttackT > 0
            && t >= activeEnd - ATTACK_2_CONFIG.bridgeWindowLead
            && t <= activeEnd + ATTACK_2_CONFIG.bridgeWindowLag;
    }

    function pointToSegmentDistanceXZ(point, a, b) {
        tempVecA.set(b.x - a.x, 0, b.z - a.z);
        tempVecB.set(point.x - a.x, 0, point.z - a.z);
        const segmentLengthSq = tempVecA.x * tempVecA.x + tempVecA.z * tempVecA.z;
        const projection = segmentLengthSq > 0 ? THREE.MathUtils.clamp(tempVecB.dot(tempVecA) / segmentLengthSq, 0, 1) : 0;
        tempVecC.copy(a).addScaledVector(tempVecA, projection);
        tempVecC.y = point.y;
        return tempVecC.distanceTo(point);
    }

    function updatePlayerProcedural(dt, moveAmount) {
        attack1DebugState.active = false;
        moveAnimT = THREE.MathUtils.lerp(moveAnimT, moveAmount, Math.min(1, dt * 10));
        walkTimer += dt * (1.8 + moveAnimT * 7.5);

        const stride = Math.sin(walkTimer);
        const strideOpp = Math.sin(walkTimer + Math.PI);
        const liftL = Math.max(0, stride);
        const liftR = Math.max(0, strideOpp);
        const idleBob = Math.sin(clock.elapsedTime * 2.4) * 0.015 * (1 - moveAnimT);
        const walkBob = Math.sin(walkTimer * 2) * 0.035 * moveAnimT;
        const bodyBob = idleBob + walkBob;
        const walkBlend = THREE.MathUtils.smoothstep(moveAnimT, 0, 0.12);
        const idleRelax = 1 - walkBlend;

        body.position.y = BODY_HOME_Y + bodyBob;
        body.rotation.x = 0.05 + moveAnimT * 0.03;
        body.rotation.y = 0;
        body.rotation.z = stride * 0.04 * moveAnimT;
        eyeL.position.copy(EYE_L_HOME);
        eyeR.position.copy(EYE_R_HOME);
        eyeL.position.y += idleBob * 0.12;
        eyeR.position.y += idleBob * 0.12;

        anatomicalRightHand.rotation.set(0, 0, 0);
        anatomicalLeftHand.rotation.set(0, 0, 0);
        anatomicalRightFoot.rotation.set(FOOT_BASE_ROT_X, 0, 0);
        anatomicalLeftFoot.rotation.set(FOOT_BASE_ROT_X, 0, 0);

        if (isRolling) {
            body.rotation.x = 0.08;
            body.rotation.y = 0;
            body.rotation.z = 0;
            anatomicalRightHand.position.copy(ANATOMICAL_RIGHT_HAND_HOME).add(tempVecA.set(0.02, -0.08, -0.14));
            anatomicalLeftHand.position.copy(ANATOMICAL_LEFT_HAND_HOME).add(tempVecB.set(0.05, -0.08, -0.1));
            anatomicalRightFoot.position.copy(ANATOMICAL_RIGHT_FOOT_HOME).add(tempVecC.set(-0.02, 0.03, -0.05));
            anatomicalLeftFoot.position.copy(ANATOMICAL_LEFT_FOOT_HOME).add(tempVecA.set(0.03, 0.03, -0.03));
            anatomicalRightHand.rotation.z = -0.1;
            anatomicalLeftHand.rotation.z = 0.18;
            resetWeaponToIdle();
            weaponPivot.scale.setScalar(0.45);
            weaponPivot.position.set(0.01, -0.005, 0.04);
            weaponPivot.rotation.x = 0.35;
            return;
        }

        if (pendingAttack2) {
            const previewChargeT = getAttack2SelectedChargeT(pendingAttack2HoldT);
            const previewChargeRatio = getAttack2ChargeRatio(previewChargeT);
            const previewPhaseT = getAttack2PendingPoseTime(pendingAttack2HoldT, previewChargeT);
            const attack2PreviewT = getAttack2DisplayT(previewPhaseT, previewChargeRatio);
            applyAttack2Pose(
                attack2PreviewT,
                bodyBob,
                1,
                playerRig,
                true,
                previewChargeRatio,
                pendingAttack2HoldT >= ATTACK_2_CONFIG.holdThreshold
            );
            return;
        }

        if (isBlocking) {
            body.rotation.x = 0.1;
            body.rotation.y = 0;
            body.rotation.z = 0;
            anatomicalRightFoot.position.copy(ANATOMICAL_RIGHT_FOOT_HOME).add(tempVecC.set(0.06, bodyBob * 0.12, -0.08));
            anatomicalLeftFoot.position.copy(ANATOMICAL_LEFT_FOOT_HOME).add(tempVecA.set(-0.06, bodyBob * 0.12, 0.16));
            anatomicalRightHand.position.copy(ANATOMICAL_RIGHT_HAND_HOME).add(tempVecA.set(0.36, 0.04, 0.2));
            anatomicalLeftHand.position.copy(ANATOMICAL_LEFT_HAND_HOME).add(tempVecB.set(-0.22, 0.02, 0.14));
            anatomicalRightHand.rotation.set(0.34, -0.02, -0.22);
            anatomicalLeftHand.rotation.set(0.28, -0.04, 0.08);
            weaponPivot.scale.setScalar(1);
            weaponPivot.position.set(-0.2, -0.04, 0.14);
            weaponPivot.rotation.x = 0.16;
            weaponPivot.rotation.y = -1.46;
            weaponPivot.rotation.z = -0.18;
            return;
        }

        if (isAttacking) {
            if (currentAttackType === 'attack1') {
                if (!attackStartedFromBridge) {
                    body.rotation.x = 0.08;
                    body.rotation.y = 0;
                    body.rotation.z = 0;
                    anatomicalRightFoot.position.copy(ANATOMICAL_RIGHT_FOOT_HOME).add(tempVecC.set(0, bodyBob * 0.15, 0));
                    anatomicalLeftFoot.position.copy(ANATOMICAL_LEFT_FOOT_HOME).add(tempVecA.set(0, bodyBob * 0.15, 0));
                }

                const attack1PreviewT = Math.min((attackT + dt * 1.9) / ATTACK_1_END_T, 1);
                const bridgeBlend = attackStartedFromBridge
                    ? THREE.MathUtils.smoothstep(attackBridgeBlendT, 0, ATTACK_1_BRIDGE_BLEND_TIME)
                    : 1;
                applyAttack1Pose(attack1PreviewT, bodyBob, bridgeBlend, playerRig, false, attack1DebugContext);
                return;
            }

            if (currentAttackType === 'attack2') {
                const previewChargeT = attack2IsCharging
                    ? Math.min(ATTACK_2_CONFIG.maxChargeTime, attack2ChargeT + dt * ATTACK_2_CONFIG.playbackRate)
                    : attack2ChargeT;
                const previewChargeRatio = getAttack2ChargeRatio(previewChargeT);
                const previewPhaseT = Math.min(attackT + dt * ATTACK_2_CONFIG.playbackRate, getAttack2TotalTime(previewChargeRatio));
                const attack2PreviewT = getAttack2DisplayT(previewPhaseT, previewChargeRatio);
                applyAttack2Pose(attack2PreviewT, bodyBob, 1, playerRig, false, previewChargeRatio, attack2IsCharging);
                return;
            }
        }


        anatomicalRightFoot.position.copy(ANATOMICAL_RIGHT_FOOT_HOME);
        anatomicalLeftFoot.position.copy(ANATOMICAL_LEFT_FOOT_HOME);
        anatomicalRightFoot.position.z += stride * 0.26 * moveAnimT;
        anatomicalLeftFoot.position.z += strideOpp * 0.26 * moveAnimT;
        anatomicalRightFoot.position.y += liftL * 0.14 * moveAnimT + bodyBob * 0.2;
        anatomicalLeftFoot.position.y += liftR * 0.14 * moveAnimT + bodyBob * 0.2;
        anatomicalRightFoot.rotation.x = FOOT_BASE_ROT_X - stride * 0.35 * moveAnimT;
        anatomicalLeftFoot.rotation.x = FOOT_BASE_ROT_X - strideOpp * 0.35 * moveAnimT;

        anatomicalRightHand.position.copy(ANATOMICAL_RIGHT_HAND_HOME);
        anatomicalRightHand.position.z += -stride * 0.18 * moveAnimT;
        anatomicalRightHand.position.y += Math.max(0, stride) * 0.06 * moveAnimT + bodyBob * 0.35;
        anatomicalRightHand.position.x += -0.04 * moveAnimT;
        anatomicalRightHand.position.lerp(tempVecA.copy(ANATOMICAL_RIGHT_HAND_IDLE).setY(ANATOMICAL_RIGHT_HAND_IDLE.y + idleBob * 0.45), idleRelax);

        anatomicalLeftHand.position.copy(ANATOMICAL_LEFT_HAND_HOME);
        anatomicalLeftHand.position.z += stride * 0.05 * moveAnimT;
        anatomicalLeftHand.position.y += Math.max(0, strideOpp) * 0.03 * moveAnimT + bodyBob * 0.3;
        anatomicalLeftHand.position.x += 0.04 * moveAnimT;
        anatomicalLeftHand.position.z -= 0.14 * walkBlend;
        anatomicalLeftHand.position.lerp(tempVecB.copy(ANATOMICAL_LEFT_HAND_IDLE).setY(ANATOMICAL_LEFT_HAND_IDLE.y + idleBob * 0.14), idleRelax);
        anatomicalRightHand.rotation.x = THREE.MathUtils.lerp(0.2, stride * 0.12 * moveAnimT, walkBlend);
        anatomicalRightHand.rotation.y = THREE.MathUtils.lerp(-0.08, 0, walkBlend);
        anatomicalRightHand.rotation.z = THREE.MathUtils.lerp(-0.1, -0.08 * moveAnimT, walkBlend);
        anatomicalLeftHand.rotation.x = THREE.MathUtils.lerp(0.18, 0.12 + stride * 0.03 * moveAnimT, walkBlend);
        anatomicalLeftHand.rotation.y = THREE.MathUtils.lerp(-0.02, -0.12, walkBlend);
        anatomicalLeftHand.rotation.z = THREE.MathUtils.lerp(0.1, 0.26 + 0.02 * stride * moveAnimT, walkBlend);
        weaponPivot.position.copy(tempVecA.set(0.008, -0.006, 0.115)).lerp(tempVecB.set(0.015, -0.005, -0.08), walkBlend);
        weaponPivot.rotation.x = THREE.MathUtils.lerp(-1.42, -0.2, walkBlend);
        weaponPivot.rotation.y = THREE.MathUtils.lerp(0.1, 1.08, walkBlend);
        weaponPivot.rotation.z = THREE.MathUtils.lerp(-0.03, -0.16, walkBlend);
    }

    function killEnemy(echoStalker) {
        const { enemy, enemyKnockback } = echoStalker;
        const activeEnemyCount = getActiveEnemies().length;
        enemy.state = 'dead';
        enemy.deadT = 0.28;
        enemy.hitFlashT = 0.16;
        enemyKnockback.set(0, 0, 0);
        updateEnemyHealthBar(echoStalker);
        defeatedEnemyCount += 1;
        addSnap(10);
        if (activeEnemyCount === 1) queueNextWave();
    }

    function hitEnemy(echoStalker, attackType, chargeRatio = 0) {
        const { enemy, enemyPivot, enemyCore, enemyKnockback } = echoStalker;
        if (enemy.state === 'dead' || enemy.lastHitAttackId === attackId) return;
        enemyCore.getWorldPosition(enemyCenter);
        const damage = attackType === 'attack1' ? ATTACK_1_CONFIG.damage : getAttack2Damage(chargeRatio);
        const knockback = attackType === 'attack1' ? ATTACK_1_CONFIG.knockback : getAttack2Knockback(chargeRatio);
        const hitStun = attackType === 'attack1' ? ATTACK_1_CONFIG.hitStun : getAttack2HitStun(chargeRatio);
        enemy.health -= damage;
        attackHitConnected = true;
        enemy.lastHitAttackId = attackId;
        enemy.hitFlashT = 0.12;
        hitStopT = 0.045;
        impactBurstT = 0.12;
        hitBurst.position.copy(enemyCenter);
        addSnap(enemy.health <= 0 ? 0 : 6);
        enemyKnockback.copy(attackIntent).multiplyScalar(knockback);
        if (attackType === 'attack2') {
            enemyPivot.position.addScaledVector(attackIntent, 0.08 + 0.16 * chargeRatio);
        }
        updateEnemyHealthBar(echoStalker);

        if (enemy.health <= 0) {
            killEnemy(echoStalker);
            return;
        }

        enemy.state = 'hitstun';
        enemy.hitStunT = hitStun;
        enemy.playerHitThisLunge = false;
    }

    function canBlockHit(sourceEchoStalker) {
        if (!isBlocking || !sourceEchoStalker) return false;
        playerForward.set(0, 0, 1).applyAxisAngle(moveAxis, playerModel.rotation.y).normalize();
        tempVecA.copy(sourceEchoStalker.enemy.lungeDir).multiplyScalar(-1);
        return playerForward.dot(tempVecA) >= BLOCK_FACING_DOT;
    }

    function blockHit(sourceEchoStalker) {
        resetPendingAttack2();
        bufferedAttackType = null;
        attackBufferT = 0;
        queuedAttackType = null;
        queuedAttackT = 0;
        hitStopT = Math.max(hitStopT, 0.035);
        impactBurstT = 0.08;
        blockFlashT = 0.18;
        if (!sourceEchoStalker) return;
        sourceEchoStalker.enemy.state = 'recovery';
        sourceEchoStalker.enemy.recoveryT = Math.max(sourceEchoStalker.enemy.recoveryT, 0.45);
        sourceEchoStalker.enemy.attackCooldown = Math.max(sourceEchoStalker.enemy.attackCooldown, 1.15);
        sourceEchoStalker.enemy.hitFlashT = 0.08;
        sourceEchoStalker.enemy.playerHitThisLunge = true;
        sourceEchoStalker.enemyKnockback.set(0, 0, 0);
    }

    function hitPlayer(sourceEchoStalker) {
        if (playerHp <= 0 || isRollInvulnerable()) return;
        if (canBlockHit(sourceEchoStalker)) {
            blockHit(sourceEchoStalker);
            return;
        }
        resetPendingAttack2();
        setPlayerHp(playerHp - 1);
        playerFlashT = 0.28;
        damageTintT = 0.1;
        playerHitStunT = 0.16;
        if (sourceEchoStalker) {
            playerKnockback.copy(sourceEchoStalker.enemy.lungeDir).multiplyScalar(8.5);
        }
        if (playerHp <= 0) {
            isGameOver = true;
            comboTag.innerText = 'DOWN';
            isAttacking = false;
            currentAttackType = null;
            bufferedAttackType = null;
            queuedAttackType = null;
            attackBufferT = 0;
            queuedAttackT = 0;
            attackStartedFromBridge = false;
            attack2ChargeT = 0;
            attack2IsCharging = false;
            attack2Released = false;
            trailMat.opacity = 0;
            if (deathScreen) deathScreen.show({ defeatedEnemyCount });
        }
    }

    setPlayerHp(PLAYER_MAX_HP);
    setSnapMeter(0);
    resetWeaponToIdle();
    spawnEnemyBurst(currentWaveSize);

    function updateTrail() {
        const tPos = new THREE.Vector3(); tip.getWorldPosition(tPos);
        const bPos = new THREE.Vector3(); base.getWorldPosition(bPos);

        const headPoint = trailPoints[0];
        const nextPoint = headPoint
            ? { t: headPoint.t.clone().lerp(tPos, 0.58), b: headPoint.b.clone().lerp(bPos, 0.58) }
            : { t: tPos.clone(), b: bPos.clone() };

        trailPoints.unshift(nextPoint);
        if (trailPoints.length > trailMax) trailPoints.pop();

        const fallbackPoint = trailPoints[trailPoints.length - 1];
        const attr = trailGeo.attributes.position;
        for (let i = 0; i < trailMax; i++) {
            const p = trailPoints[i] || fallbackPoint;
            if (p) {
                const prev = trailPoints[i - 1] || p;
                const next = trailPoints[i + 1] || p;
                tempVecA.copy(p.b).multiplyScalar(0.56).addScaledVector(prev.b, 0.28).addScaledVector(next.b, 0.16);
                tempVecB.copy(p.t).multiplyScalar(0.56).addScaledVector(prev.t, 0.28).addScaledVector(next.t, 0.16);
                attr.setXYZ(i * 2, tempVecA.x, tempVecA.y, tempVecA.z);
                attr.setXYZ(i * 2 + 1, tempVecB.x, tempVecB.y, tempVecB.z);
            }
        }
        attr.needsUpdate = true;
    }

    function frame() {
        const rawDt = clock.getDelta();
        const dt = hitStopT > 0 ? 0 : Math.min(rawDt, 0.033);
        const gp = navigator.getGamepads()[0];
        if (isGameOver) {
            if (deathScreen) {
                deathScreen.update({
                    confirmPressed: !!(gp && gp.buttons[0] && gp.buttons[0].pressed)
                });
            }
            renderer.render(scene, camera);
            return;
        }
        updateEnvironment(dt);
        if (hitStopT > 0) hitStopT = Math.max(0, hitStopT - rawDt);
        if (playerHitStunT > 0) playerHitStunT = Math.max(0, playerHitStunT - rawDt);
        if (rollCooldownT > 0) rollCooldownT = Math.max(0, rollCooldownT - rawDt);
        let moveInput = new THREE.Vector3();

        // Input
        if (gp) {
            if (Math.abs(gp.axes[0]) > 0.1) moveInput.x = gp.axes[0];
            if (Math.abs(gp.axes[1]) > 0.1) moveInput.z = gp.axes[1];
            if (Math.abs(gp.axes[2]) > 0.1) orbitY -= gp.axes[2] * 0.05;
        } else {
            if (keys.KeyW) moveInput.z = -1; if (keys.KeyS) moveInput.z = 1;
            if (keys.KeyA) moveInput.x = -1; if (keys.KeyD) moveInput.x = 1;
        }

        if (moveInput.lengthSq() > 1) moveInput.normalize();

        const attack2Pressed = keys.KeyE || !!(gp && gp.buttons[2] && gp.buttons[2].pressed);
        const attack2JustPressed = attack2Pressed && !attack2Held;
        const attack2JustReleased = !attack2Pressed && attack2Held;
        const attack1Pressed = keys.Space || !!(gp && gp.buttons[0] && gp.buttons[0].pressed);
        const attack1JustPressed = attack1Pressed && !attack1Held;
        const blockPressed = !!(gp && gp.buttons[3] && gp.buttons[3].pressed);
        if (blockPressed && pendingAttack2) resetPendingAttack2();
        isBlocking = blockPressed && !isAttacking && !isRolling && playerHitStunT <= 0 && playerHp > 0 && !pendingAttack2;
        if (isBlocking) {
            bufferedAttackType = null;
            attackBufferT = 0;
            queuedAttackType = null;
            queuedAttackT = 0;
        }

        if ((!isRolling || rollT <= ROLL_BUFFER_WINDOW) && !isBlocking) {
            if (attack2JustPressed && !isAttacking && !pendingAttack2 && playerHitStunT <= 0 && playerHp > 0) {
                resetPendingAttack2();
                pendingAttack2 = true;
                pendingAttack2HoldT = 0;
                bufferedAttackType = null;
                attackBufferT = 0;
            } else if (attack1JustPressed) {
                resetPendingAttack2();
                attackBufferT = ATTACK_BUFFER;
                bufferedAttackType = 'attack1';
            }

            if (isAttacking && currentAttackType === 'attack2' && attack1JustPressed) {
                queuedAttackType = 'attack1';
                queuedAttackT = ATTACK_BUFFER;
            }
        }
        attack2Held = attack2Pressed;
        attack1Held = attack1Pressed;
        cameraOrbit.rotation.y = THREE.MathUtils.lerp(cameraOrbit.rotation.y, orbitY, 0.1);
        const worldMove = moveInput.clone().applyAxisAngle(moveAxis, cameraOrbit.rotation.y);
        if (pendingAttack2) {
            pendingAttack2HoldT = Math.min(
                ATTACK_2_CONFIG.holdThreshold + ATTACK_2_CONFIG.maxChargeTime,
                pendingAttack2HoldT + rawDt
            );
            if (attack2JustReleased) {
                if (startAttack2Variant(worldMove, pendingAttack2HoldT)) {
                    attackBufferT = 0;
                    bufferedAttackType = null;
                } else {
                    resetPendingAttack2();
                }
            }
        }
        if (attackBufferT > 0) {
            attackBufferT = Math.max(0, attackBufferT - dt);
            if (attackBufferT <= 0) bufferedAttackType = null;
        }
        if (queuedAttackT > 0) {
            queuedAttackT = Math.max(0, queuedAttackT - dt);
            if (queuedAttackT <= 0) queuedAttackType = null;
        }
        const rollPressed = keys.ShiftLeft || !!(gp && gp.buttons[1] && gp.buttons[1].pressed);
        const rollJustPressed = rollPressed && !rollHeld;
        if (rollJustPressed && !isBlocking) startRoll(worldMove);
        rollHeld = rollPressed;

        if (playerKnockback.lengthSq() > 0.0001) {
            playerPivot.position.addScaledVector(playerKnockback, dt);
            playerKnockback.multiplyScalar(Math.max(0, 1 - rawDt * 10));
        }

        if (isRolling) {
            const rollProgress = 1 - (rollT / ROLL_DURATION);
            const rollSpeed = 30 * Math.pow(1 - rollProgress, 2) + 4;
            playerPivot.position.addScaledVector(rollDirection, rollSpeed * dt);
            rotateModelToward(playerProceduralContext, rollDirection, 0.45);
            playerModel.rotation.x = 0;
            playerModel.position.y = 0;
            playerModel.scale.setScalar(1);
            trailMat.opacity = Math.max(trailMat.opacity, 0.95);
            rollT = Math.max(0, rollT - dt);
            if (rollT <= 0) {
                isRolling = false;
                playerModel.rotation.x = 0;
                playerModel.position.y = 0;
                playerModel.scale.setScalar(1);
                resetWeaponToIdle();
            }
        } else if (isBlocking && playerHitStunT <= 0 && playerHp > 0) {
            playerModel.rotation.x = 0;
            playerModel.position.y = 0;
            playerModel.scale.setScalar(1);
            if (worldMove.lengthSq() > 0.01) {
                lastMoveWorld.copy(worldMove).normalize();
                playerPivot.position.add(worldMove.clone().multiplyScalar(BLOCK_MOVE_SPEED * dt));
                rotateModelToward(playerProceduralContext, lastMoveWorld, 0.24);
            }
        } else if (pendingAttack2 && playerHitStunT <= 0 && playerHp > 0) {
            playerModel.rotation.x = 0;
            playerModel.position.y = 0;
            playerModel.scale.setScalar(1);
            rotateModelToward(playerProceduralContext, getAttackIntent(playerProceduralContext, worldMove), 0.3);
        } else if (worldMove.lengthSq() > 0.01 && !isAttacking && playerHitStunT <= 0 && playerHp > 0) {
            playerModel.rotation.x = 0;
            playerModel.position.y = 0;
            playerModel.scale.setScalar(1);
            lastMoveWorld.copy(worldMove).normalize();
            playerPivot.position.add(worldMove.clone().multiplyScalar(16 * dt));
            rotateModelToward(playerProceduralContext, lastMoveWorld, 0.35);
        } else if (!isAttacking) {
            playerModel.rotation.x = 0;
            playerModel.position.y = 0;
            playerModel.scale.setScalar(1);
        }

        updatePlayerProcedural(dt, THREE.MathUtils.clamp(worldMove.length(), 0, 1));

        if (!isAttacking && !isRolling && attackBufferT > 0 && bufferedAttackType && playerHitStunT <= 0 && playerHp > 0) {
            if (startAttack(bufferedAttackType, worldMove)) {
                attackBufferT = 0;
                bufferedAttackType = null;
            }
        }

        for (const echoStalker of enemies) {
            updateEnemy({
                echoStalker,
                dt,
                elapsedTime: clock.elapsedTime,
                playerPivot,
                enemyKnockback: echoStalker.enemyKnockback,
                hitPlayer: () => hitPlayer(echoStalker)
            });
        }
        cleanupDeadEnemies();
        maybeStartNextWave();

        // --- ANIMATION ENGINE ---
        if (isAttacking) {
            if (currentAttackType === 'attack1' && attackStartedFromBridge) {
                attackBridgeBlendT = Math.min(ATTACK_1_BRIDGE_BLEND_TIME, attackBridgeBlendT + dt);
            }
            if (currentAttackType === 'attack1') {
                attackT += dt * 1.9;
            } else {
                attackT += dt * ATTACK_2_CONFIG.playbackRate;
            }

            const attackChargeRatio = currentAttackType === 'attack2' ? getAttack2ChargeRatio(attack2ChargeT) : 0;
            const t = getAttackProgress(currentAttackType);
            const attackBlend = THREE.MathUtils.clamp(t * 4.5, 0, 1);
            const attackWindowT = currentAttackType === 'attack1' ? t : attackT;

            if (currentAttackType === 'attack2' && attackIntent.lengthSq() > 0.01) {
                const prevRootLunge = getAttack2RootLungeOffset(previousAttackT, attackChargeRatio);
                const nextRootLunge = getAttack2RootLungeOffset(attackWindowT, attackChargeRatio);
                const rootLungeDelta = nextRootLunge - prevRootLunge;
                if (rootLungeDelta > 0) {
                    playerPivot.position.addScaledVector(attackIntent, rootLungeDelta);
                }
            }

            if (currentAttackType === 'attack1') {
                setAttack1WeaponTargets(t, attack1WeaponReturnPos, attack1WeaponReturnRot);
                weaponPivot.position.lerpVectors(
                    attackEntryWeaponPos,
                    attackTargetWeaponPos.set(attack1WeaponReturnPos.x, attack1WeaponReturnPos.y, attack1WeaponReturnPos.z),
                    attackBlend
                );
                weaponPivot.rotation.x = THREE.MathUtils.lerp(attackEntryWeaponRot.x, attack1WeaponReturnRot.x, attackBlend);
                weaponPivot.rotation.y = THREE.MathUtils.lerp(attackEntryWeaponRot.y, attack1WeaponReturnRot.y, attackBlend);
                weaponPivot.rotation.z = THREE.MathUtils.lerp(attackEntryWeaponRot.z, attack1WeaponReturnRot.z, attackBlend);
                trailMat.opacity = THREE.MathUtils.lerp(ATTACK_1_CONFIG.trailOpacity, 0.04, easeInOutCubic(THREE.MathUtils.smoothstep(t, 0.5, 1.0)));
            } else {
                setAttack2WeaponTargets(t, attack2WeaponReturnPos, attack2WeaponReturnRot, attackChargeRatio, attack2IsCharging);
                weaponPivot.position.lerpVectors(
                    attackEntryWeaponPos,
                    attackTargetWeaponPos.set(attack2WeaponReturnPos.x, attack2WeaponReturnPos.y, attack2WeaponReturnPos.z),
                    attackBlend
                );
                weaponPivot.rotation.x = THREE.MathUtils.lerp(attackEntryWeaponRot.x, attack2WeaponReturnRot.x, attackBlend);
                weaponPivot.rotation.y = THREE.MathUtils.lerp(attackEntryWeaponRot.y, attack2WeaponReturnRot.y, attackBlend);
                weaponPivot.rotation.z = THREE.MathUtils.lerp(attackEntryWeaponRot.z, attack2WeaponReturnRot.z, attackBlend);
                trailMat.opacity = attack2IsCharging
                    ? THREE.MathUtils.lerp(trailMat.opacity, 0.06, 0.25)
                    : THREE.MathUtils.lerp(ATTACK_2_CONFIG.trailOpacity, 0.03, easeInOutCubic(THREE.MathUtils.smoothstep(t, 0.42, 1.0)));
            }

            const shouldEvaluateHit = shouldEvaluateAttackHit(currentAttackType, attackWindowT, previousAttackT, attackChargeRatio);
            if (shouldEvaluateHit && !attackHitConnected) {
                base.getWorldPosition(attackBasePos);
                tip.getWorldPosition(attackTipPos);
                const swingMidY = (attackBasePos.y + attackTipPos.y) * 0.5;
                let bestTarget = null;
                let bestHitDistance = Infinity;
                let bestTargetDistanceSq = Infinity;

                for (const echoStalker of getActiveEnemies()) {
                    const { enemyCore } = echoStalker;
                    enemyCore.getWorldPosition(enemyCenter);
                    const hitDistance = pointToSegmentDistanceXZ(enemyCenter, attackBasePos, attackTipPos);
                    const verticalDelta = Math.abs(enemyCenter.y - swingMidY);
                    let passesHit = false;

                    if (currentAttackType === 'attack1') {
                        passesHit = hitDistance < ATTACK_1_CONFIG.hitRange && verticalDelta < 1.0;
                    } else {
                        attackToEnemy.subVectors(enemyCenter, playerPivot.position).setY(0);
                        attackRight.set(attackIntent.z, 0, -attackIntent.x);
                        const forwardDistance = attackToEnemy.dot(attackIntent);
                        const lateralDistance = Math.abs(attackToEnemy.dot(attackRight));
                        passesHit =
                            hitDistance < getAttack2HitRange(attackChargeRatio)
                            && verticalDelta < ATTACK_2_CONFIG.verticalRange
                            && forwardDistance >= ATTACK_2_CONFIG.minForward + 0.06 * attackChargeRatio
                            && lateralDistance <= getAttack2MaxLateral(attackChargeRatio);
                    }

                    if (passesHit) {
                        const targetDistanceSq = enemyCenter.distanceToSquared(playerPivot.position);
                        if (
                            hitDistance < bestHitDistance
                            || (hitDistance === bestHitDistance && targetDistanceSq < bestTargetDistanceSq)
                        ) {
                            bestTarget = echoStalker;
                            bestHitDistance = hitDistance;
                            bestTargetDistanceSq = targetDistanceSq;
                        }
                    }
                }

                if (bestTarget) hitEnemy(bestTarget, currentAttackType, attackChargeRatio);
            }

            previousAttackT = attackWindowT;

            if (currentAttackType === 'attack2' && canBridgeAttack2IntoAttack1(attackWindowT, attackChargeRatio)) {
                if (startAttack('attack1', worldMove, { fromBridge: true, preserveIntent: true })) {
                    attackBufferT = 0;
                    bufferedAttackType = null;
                }
            } else if (
                (currentAttackType === 'attack1' && attackT >= ATTACK_1_END_T)
                || (currentAttackType === 'attack2' && attackT >= getAttack2TotalTime(attackChargeRatio))
            ) {
                resetAttackState();
            }
        } else {
            trailMat.opacity = THREE.MathUtils.lerp(trailMat.opacity, 0, 0.1);
        }

        let attackCarry = 0;
        if (isAttacking) {
            const attackProgress = getAttackProgress(currentAttackType);
            if (currentAttackType === 'attack1') {
                const attack1Carry = getAttack1CarryOffset(attackProgress);
                if (attackStartedFromBridge) {
                    const carryBlend = THREE.MathUtils.smoothstep(attackBridgeBlendT, 0, ATTACK_1_BRIDGE_BLEND_TIME);
                    attackCarry = THREE.MathUtils.lerp(attackEntryCarry, attack1Carry, carryBlend);
                } else {
                    attackCarry = attack1Carry;
                }
            } else {
                attackCarry = getAttack2CarryOffset(attackProgress, getAttack2ChargeRatio(attack2ChargeT), attack2IsCharging);
            }
        }
        playerForward.set(0, 0, 1).applyAxisAngle(moveAxis, playerModel.rotation.y).normalize();
        playerModel.position.x = playerForward.x * attackCarry;
        playerModel.position.z = playerForward.z * attackCarry;

        playerFlashT = Math.max(0, playerFlashT - rawDt);
        blockFlashT = Math.max(0, blockFlashT - rawDt);
        const playerFlashMix = playerFlashT > 0 ? Math.min(1, playerFlashT / 0.28) : 0;
        const blockFlashMix = blockFlashT > 0 ? Math.min(1, blockFlashT / 0.18) : 0;
        bodyMat.color.copy(playerBaseColor).lerp(playerHitColor, playerFlashMix * 0.95);
        bodyMat.emissive.copy(playerBaseColor).lerp(playerHitColor, playerFlashMix * 0.55);
        limbMat.color.copy(bodyMat.color);
        limbMat.emissive.copy(bodyMat.emissive);
        const rollGlow = isRolling ? 1 : 0;
        const blockGlow = isBlocking ? 1 : 0;
        bodyMat.emissiveIntensity = 0.4 + playerFlashMix * 1.25 + rollGlow * 1.35 + blockGlow * 0.55 + blockFlashMix * 0.8;
        limbMat.emissiveIntensity = 0.34 + playerFlashMix * 0.9 + rollGlow * 0.9 + blockGlow * 0.42 + blockFlashMix * 0.6;
        shadow.material.opacity = isRolling ? 0.18 : (isBlocking ? 0.34 : 0.5);

        damageTintT = Math.max(0, damageTintT - rawDt);
        damageTint.style.opacity = damageTintT > 0 ? `${0.4 * (damageTintT / 0.1)}` : '0';

        impactBurstT = Math.max(0, impactBurstT - rawDt);
        if (impactBurstT > 0) {
            const burstAlpha = impactBurstT / 0.12;
            hitBurst.visible = true;
            hitBurst.quaternion.copy(camera.quaternion);
            hitBurst.scale.setScalar(1 + (1 - burstAlpha) * 1.8);
            hitBurst.material.opacity = burstAlpha * 0.95;
        } else {
            hitBurst.visible = false;
        }

        const showAttack1Debug = attack1DebugEnabled && attack1DebugState.active;
        anatomicalLeftHandDebugMarker.visible = showAttack1Debug;
        anatomicalRightHandDebugMarker.visible = showAttack1Debug;
        anatomicalLeftFootDebugMarker.visible = showAttack1Debug;
        anatomicalRightFootDebugMarker.visible = showAttack1Debug;
        renderAttack1DebugOverlay({
            element: attack1DebugEl,
            visible: showAttack1Debug,
            toggleKey: ATTACK1_DEBUG_TOGGLE_KEY,
            debugState: attack1DebugState
        });

        updateTrail();
        cameraOrbit.position.copy(playerPivot.position);
        pLight.position.copy(playerPivot.position).add(new THREE.Vector3(0, 5, 0));
        desiredLookTarget.copy(playerPivot.position);
        desiredLookTarget.y += 1.6;
        if (isAttacking && attackIntent.lengthSq() > 0.01) {
            desiredLookTarget.addScaledVector(attackIntent, 2.4);
        } else if (worldMove.lengthSq() > 0.01 && lastMoveWorld.lengthSq() > 0.01) {
            desiredLookTarget.addScaledVector(lastMoveWorld, 2.4);
        }
        lookTarget.lerp(desiredLookTarget, 0.1);
        camera.lookAt(lookTarget);
        updateHeartPickups(clock.elapsedTime, rawDt);

        for (const echoStalker of enemies) {
            const { enemy, enemyPivot, enemyHpRoot } = echoStalker;
            enemyHpRoot.visible = enemyPivot.visible && enemy.state !== 'dead';
            if (!enemyHpRoot.visible) continue;
            enemyHpRoot.position.copy(enemyPivot.position);
            enemyHpRoot.position.y += 3.05;
            enemyHpRoot.quaternion.copy(camera.quaternion);
        }

        renderer.render(scene, camera);
    }

    return { frame };
}
