import * as THREE from 'three';
import { ATTACK1_DEBUG_TOGGLE_KEY } from '../config/debugFlags.js';
import { renderAttack1DebugOverlay } from '../debug/debugOverlay.js';
import { createInput } from '../input/input.js';
import { createPlayer } from '../player/createPlayer.js';
import { applySceneFog, setupEnvironment, updateEnvironment } from '../scene/environment.js';
import { setupLighting } from '../scene/lighting.js';

export function createGame({ runtime, dom }) {
    const comboTag = dom.comboTag;
    const snapFill = dom.snapFill;
    const playerHpFill = dom.playerHpFill;
    const damageTint = dom.damageTint;
    const attack1DebugEl = dom.attack1DebugEl;

    // --- SCENE SETUP ---
    const clock = runtime.clock;
    const scene = runtime.scene;
    const camera = runtime.camera;
    const lookTarget = new THREE.Vector3(0, 2, 0);
    const desiredLookTarget = new THREE.Vector3();
    const renderer = runtime.renderer;
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

    // --- TEST ENEMY: ECHO-STALKER ---
    const enemyPivot = new THREE.Group();
    scene.add(enemyPivot);
    enemyPivot.position.set(8.5, 0, 2.5);

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
    let isRolling = false;
    let rollT = 0;
    let rollCooldownT = 0;
    let walkTimer = 0;
    let moveAnimT = 0;
    const keys = {};
    const moveAxis = new THREE.Vector3(0, 1, 0);
    const cameraForward = new THREE.Vector3();
    const attackIntent = new THREE.Vector3(0, 0, -1);
    const lastMoveWorld = new THREE.Vector3(0, 0, 0);
    const ATTACK_BUFFER = 0.18;
    const ATTACK_1_CONFIG = {
        activeStart: 0.36,
        activeEnd: 0.54,
        hitRange: 1.6,
        damage: 1.5,
        hitStun: 0.24,
        knockback: 6.5,
        trailOpacity: 0.58
    };
    const ATTACK_2_CONFIG = {
        holdThreshold: 0.15,
        maxChargeTime: 0.24,
        chargeAnchorTime: 0.12,
        playbackRate: 1.72,
        chargeStartupBonus: 0.1,
        startupTime: 0.18,
        activeTime: 0.14,
        recoveryTime: 0.34,
        recoveryBonus: 0.22,
        displayStartupEnd: 0.34,
        displayActiveEnd: 0.56,
        bridgeWindowLead: 0.03,
        bridgeWindowLag: 0.05,
        tapHitRange: 1.18,
        holdHitRangeBonus: 0.14,
        minForward: 0.58,
        maxLateral: 0.8,
        verticalRange: 0.95,
        tapDamage: 1.0,
        maxDamageScale: 1.55,
        tapHitStun: 0.13,
        holdHitStunBonus: 0.08,
        tapKnockback: 3.0,
        holdKnockbackBonus: 1.9,
        tapCarryPeak: 0.11,
        holdCarryBonus: 0.19,
        trailOpacity: 0.36
    };
    const ATTACK_1_WINDUP_END = 0.35;
    const ATTACK_1_STRIKE_END = 0.5;
    const ATTACK_1_END_T = 0.9;
    const ATTACK_1_CARRY_PEAK = 0.22;
    const ATTACK_1_BRIDGE_BLEND_TIME = 0.09;
    const ATTACK_1_BRIDGE_START_PROGRESS = 0.14;
    const PLAYER_MAX_HP = 5;
    const ROLL_DURATION = 0.36;
    const ROLL_COOLDOWN = 0.7;
    const ROLL_BUFFER_WINDOW = 0.1;
    const WEAPON_IDLE_X = 0.01;
    const WEAPON_IDLE_Y = -0.01;
    const WEAPON_IDLE_Z = 0.04;
    const playerBaseColor = new THREE.Color(0x00ffff);
    const playerHitColor = new THREE.Color(0xffffff);
    const enemyBaseColor = new THREE.Color(0xff4fd8);
    const enemyTelegraphColor = new THREE.Color(0xffd36b);
    const enemyLungeColor = new THREE.Color(0xff7a3d);
    const enemyHitColor = new THREE.Color(0xffffff);
    const enemyCenter = new THREE.Vector3();
    const tempVecA = new THREE.Vector3();
    const tempVecB = new THREE.Vector3();
    const tempVecC = new THREE.Vector3();
    const enemyTargetPos = new THREE.Vector3();
    const enemyLookTarget = new THREE.Vector3();
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
    let attack1DebugEnabled = false;
    let attack1DebugValidated = false;
    const enemyKnockback = new THREE.Vector3();
    const playerKnockback = new THREE.Vector3();
    const rollDirection = new THREE.Vector3(0, 0, 1);
    const playerForward = new THREE.Vector3(0, 0, 1);
    const enemy = {
        state: 'orbit',
        angle: Math.atan2(enemyPivot.position.z, enemyPivot.position.x),
        radius: 8.4,
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
    createInput({
        keys,
        onKeyDown: e => {
            if (e.code === ATTACK1_DEBUG_TOGGLE_KEY && !e.repeat) {
                attack1DebugEnabled = !attack1DebugEnabled;
                if (attack1DebugEnabled) validateAnatomicalCombatRig();
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

    function easeInQuad(t) {
        return t * t;
    }

    function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    function easeInOutCubic(t) {
        return t < 0.5
            ? 4 * t * t * t
            : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function getAttack1MotionT(rawT) {
        const t = THREE.MathUtils.clamp(rawT, 0, 1);
        if (t <= 0.15) {
            return THREE.MathUtils.lerp(0, 0.24, easeInQuad(t / 0.15));
        }
        if (t <= 0.35) {
            const strikeT = (t - 0.15) / 0.20;
            return THREE.MathUtils.lerp(0.24, 0.66, 1 - Math.pow(1 - strikeT, 3.8));
        }
        if (t <= 0.74) {
            const followT = (t - 0.35) / 0.39;
            return THREE.MathUtils.lerp(0.66, 0.88, 1 - Math.pow(1 - followT, 1.65));
        }
        return THREE.MathUtils.lerp(0.88, 1, easeInOutCubic((t - 0.74) / 0.26));
    }

    function setAttack1WeaponTargets(rawT, posTarget, rotTarget) {
        const t = THREE.MathUtils.clamp(rawT, 0, 1);
        if (t <= 0.15) {
            const p = easeInOutCubic(t / 0.15);
            posTarget.set(
                THREE.MathUtils.lerp(WEAPON_IDLE_X, 0.014, p),
                THREE.MathUtils.lerp(WEAPON_IDLE_Y, -0.001, p),
                THREE.MathUtils.lerp(WEAPON_IDLE_Z, 0.072, p)
            );
            rotTarget.set(
                THREE.MathUtils.lerp(0, -1.22, p),
                THREE.MathUtils.lerp(0, 1.44, p),
                THREE.MathUtils.lerp(0, -0.22, p)
            );
            return;
        }

        if (t <= 0.35) {
            const p = easeOutCubic((t - 0.15) / 0.20);
            posTarget.set(
                THREE.MathUtils.lerp(0.014, 0.012, p),
                THREE.MathUtils.lerp(-0.001, -0.004, p),
                THREE.MathUtils.lerp(0.072, 0.055, p)
            );
            rotTarget.set(
                THREE.MathUtils.lerp(-1.22, -0.18, p),
                THREE.MathUtils.lerp(1.44, -1.16, p),
                THREE.MathUtils.lerp(-0.22, 0.12, p)
            );
            return;
        }

        if (t <= 0.70) {
            const p = 1 - Math.pow(1 - ((t - 0.35) / 0.35), 1.8);
            posTarget.set(
                THREE.MathUtils.lerp(0.012, 0.014, p),
                THREE.MathUtils.lerp(-0.004, -0.002, p),
                THREE.MathUtils.lerp(0.055, 0.065, p)
            );
            rotTarget.set(
                THREE.MathUtils.lerp(-0.18, -0.52, p),
                THREE.MathUtils.lerp(-1.16, -0.82, p),
                THREE.MathUtils.lerp(0.12, 0.2, p)
            );
            return;
        }

        const p = easeInOutCubic((t - 0.70) / 0.30);
        const oneMinusP = 1 - p;

        const startPosX = 0.014;
        const startPosY = -0.002;
        const startPosZ = 0.065;
        const controlPosX = 0.012;
        const controlPosY = -0.0042;
        const controlPosZ = 0.048;

        const startRotX = -0.52;
        const startRotY = -0.82;
        const startRotZ = 0.2;
        const controlRotX = -0.2;
        const controlRotY = -0.3;
        const controlRotZ = 0.08;

        posTarget.set(
            oneMinusP * oneMinusP * startPosX + 2 * oneMinusP * p * controlPosX + p * p * WEAPON_IDLE_X,
            oneMinusP * oneMinusP * startPosY + 2 * oneMinusP * p * controlPosY + p * p * WEAPON_IDLE_Y,
            oneMinusP * oneMinusP * startPosZ + 2 * oneMinusP * p * controlPosZ + p * p * WEAPON_IDLE_Z
        );
        rotTarget.set(
            oneMinusP * oneMinusP * startRotX + 2 * oneMinusP * p * controlRotX + p * p * 0,
            oneMinusP * oneMinusP * startRotY + 2 * oneMinusP * p * controlRotY + p * p * 0,
            oneMinusP * oneMinusP * startRotZ + 2 * oneMinusP * p * controlRotZ + p * p * 0
        );
    }

    function getAttack1CarryOffset(rawT) {
        const t = THREE.MathUtils.clamp(rawT, 0, 1);
        if (t <= 0.15) return 0;
        if (t <= 0.35) {
            return THREE.MathUtils.lerp(0, ATTACK_1_CARRY_PEAK, easeOutCubic((t - 0.15) / 0.20));
        }
        if (t <= 0.82) {
            const settleT = (t - 0.35) / 0.47;
            return THREE.MathUtils.lerp(ATTACK_1_CARRY_PEAK, ATTACK_1_CARRY_PEAK * 0.88, easeInOutCubic(settleT));
        }
        return THREE.MathUtils.lerp(ATTACK_1_CARRY_PEAK * 0.88, 0, easeInOutCubic((t - 0.82) / 0.18));
    }

    function getAttack2ChargeRatio(rawChargeT = attack2ChargeT) {
        if (rawChargeT <= 0 || ATTACK_2_CONFIG.maxChargeTime <= 0) return 0;
        return THREE.MathUtils.clamp(rawChargeT / ATTACK_2_CONFIG.maxChargeTime, 0, 1);
    }

    function getAttack2SelectedChargeT(holdT = pendingAttack2HoldT) {
        if (holdT <= ATTACK_2_CONFIG.holdThreshold) return 0;
        return THREE.MathUtils.clamp(holdT - ATTACK_2_CONFIG.holdThreshold, 0, ATTACK_2_CONFIG.maxChargeTime);
    }

    function getAttack2ActiveStartTime(chargeRatio = getAttack2ChargeRatio()) {
        return ATTACK_2_CONFIG.startupTime + ATTACK_2_CONFIG.chargeStartupBonus * chargeRatio;
    }

    function getAttack2ActiveEndTime(chargeRatio = getAttack2ChargeRatio()) {
        return getAttack2ActiveStartTime(chargeRatio) + ATTACK_2_CONFIG.activeTime;
    }

    function getAttack2RecoveryTime(chargeRatio = getAttack2ChargeRatio()) {
        return ATTACK_2_CONFIG.recoveryTime + ATTACK_2_CONFIG.recoveryBonus * chargeRatio;
    }

    function getAttack2TotalTime(chargeRatio = getAttack2ChargeRatio()) {
        return getAttack2ActiveEndTime(chargeRatio) + getAttack2RecoveryTime(chargeRatio);
    }

    function getAttack2DisplayT(rawT = attackT, chargeRatio = getAttack2ChargeRatio()) {
        const startupTime = getAttack2ActiveStartTime(chargeRatio);
        const activeEndTime = getAttack2ActiveEndTime(chargeRatio);
        const recoveryTime = getAttack2RecoveryTime(chargeRatio);
        const decisionTime = ATTACK_2_CONFIG.holdThreshold;
        const anticipationPoseEnd = 0.22;
        const clampedT = THREE.MathUtils.clamp(rawT, 0, getAttack2TotalTime(chargeRatio));
        if (clampedT <= decisionTime) {
            return THREE.MathUtils.lerp(0, anticipationPoseEnd, easeOutCubic(clampedT / decisionTime));
        }
        if (clampedT <= startupTime) {
            return THREE.MathUtils.lerp(
                anticipationPoseEnd,
                ATTACK_2_CONFIG.displayStartupEnd,
                easeInOutCubic((clampedT - decisionTime) / Math.max(0.0001, startupTime - decisionTime))
            );
        }
        if (clampedT <= activeEndTime) {
            return THREE.MathUtils.lerp(
                ATTACK_2_CONFIG.displayStartupEnd,
                ATTACK_2_CONFIG.displayActiveEnd,
                (clampedT - startupTime) / ATTACK_2_CONFIG.activeTime
            );
        }
        return THREE.MathUtils.lerp(
            ATTACK_2_CONFIG.displayActiveEnd,
            1,
            (clampedT - activeEndTime) / recoveryTime
        );
    }

    function getAttack2MotionT(rawT) {
        return THREE.MathUtils.clamp(rawT, 0, 1);
    }

    function getAttack2ChargePoseBlend(rawT, chargeRatio, isCharging = false) {
        if (chargeRatio <= 0) return 0;
        if (isCharging) {
            const chargeT = THREE.MathUtils.smoothstep(rawT, 0.05, ATTACK_2_CONFIG.displayStartupEnd * 0.94);
            return chargeRatio * easeInOutCubic(chargeT);
        }
        return chargeRatio * (1 - THREE.MathUtils.smoothstep(rawT, 0.62, 0.88));
    }

    function getAttack2ChargeLaneT(rawT) {
        const laneT = THREE.MathUtils.smoothstep(rawT, 0.22, ATTACK_2_CONFIG.displayStartupEnd * 0.98);
        return easeInOutCubic(laneT);
    }

    function getAttack2Damage(chargeRatio = getAttack2ChargeRatio()) {
        return ATTACK_2_CONFIG.tapDamage * THREE.MathUtils.lerp(1, ATTACK_2_CONFIG.maxDamageScale, chargeRatio);
    }

    function getAttack2HitStun(chargeRatio = getAttack2ChargeRatio()) {
        return ATTACK_2_CONFIG.tapHitStun + ATTACK_2_CONFIG.holdHitStunBonus * chargeRatio;
    }

    function getAttack2Knockback(chargeRatio = getAttack2ChargeRatio()) {
        return ATTACK_2_CONFIG.tapKnockback + ATTACK_2_CONFIG.holdKnockbackBonus * chargeRatio;
    }

    function getAttack2HitRange(chargeRatio = getAttack2ChargeRatio()) {
        return ATTACK_2_CONFIG.tapHitRange + ATTACK_2_CONFIG.holdHitRangeBonus * chargeRatio;
    }

    function getAttack2CarryPeak(chargeRatio = getAttack2ChargeRatio()) {
        return ATTACK_2_CONFIG.tapCarryPeak + ATTACK_2_CONFIG.holdCarryBonus * chargeRatio;
    }

    function getAttack2MaxLateral(chargeRatio = getAttack2ChargeRatio()) {
        return ATTACK_2_CONFIG.maxLateral - 0.06 * chargeRatio;
    }

    function setAttack2WeaponTargets(rawT, posTarget, rotTarget, chargeRatio = getAttack2ChargeRatio(), isCharging = false) {
        const t = THREE.MathUtils.clamp(rawT, 0, 1);
        if (isCharging) {
            const holdT = getAttack2ChargeLaneT(t);
            posTarget.set(
                THREE.MathUtils.lerp(WEAPON_IDLE_X, 0.018, holdT),
                THREE.MathUtils.lerp(WEAPON_IDLE_Y, -0.004, holdT),
                THREE.MathUtils.lerp(WEAPON_IDLE_Z, 0.014, holdT)
            );
            rotTarget.set(
                THREE.MathUtils.lerp(0, -0.56, holdT),
                THREE.MathUtils.lerp(0, 0.42, holdT),
                THREE.MathUtils.lerp(0, 0.02, holdT)
            );
            return;
        }
        if (t <= 0.24) {
            const p = easeInOutCubic(t / 0.24);
            posTarget.set(
                THREE.MathUtils.lerp(WEAPON_IDLE_X, 0.012, p),
                THREE.MathUtils.lerp(WEAPON_IDLE_Y, -0.006, p),
                THREE.MathUtils.lerp(WEAPON_IDLE_Z, 0.058, p)
            );
            rotTarget.set(
                THREE.MathUtils.lerp(0, -0.62, p),
                THREE.MathUtils.lerp(0, 0.78, p),
                THREE.MathUtils.lerp(0, -0.03, p)
            );
        } else if (t <= 0.56) {
            const p = easeOutCubic((t - 0.24) / 0.32);
            posTarget.set(
                THREE.MathUtils.lerp(0.012, 0.01, p),
                THREE.MathUtils.lerp(-0.006, -0.017, p),
                THREE.MathUtils.lerp(0.058, 0.09, p)
            );
            rotTarget.set(
                THREE.MathUtils.lerp(-0.62, -0.26, p),
                THREE.MathUtils.lerp(0.78, -0.02, p),
                THREE.MathUtils.lerp(-0.03, 0.08, p)
            );
        } else if (t <= 0.78) {
            const p = 1 - Math.pow(1 - ((t - 0.56) / 0.22), 1.55);
            posTarget.set(
                THREE.MathUtils.lerp(0.01, 0.011, p),
                THREE.MathUtils.lerp(-0.017, -0.009, p),
                THREE.MathUtils.lerp(0.09, 0.082, p)
            );
            rotTarget.set(
                THREE.MathUtils.lerp(-0.26, -0.46, p),
                THREE.MathUtils.lerp(-0.02, -0.08, p),
                THREE.MathUtils.lerp(0.08, 0.06, p)
            );
        } else {
            const p = easeInOutCubic((t - 0.78) / 0.22);
            const oneMinusP = 1 - p;

            const startPosX = 0.011;
            const startPosY = -0.009;
            const startPosZ = 0.082;
            const controlPosX = 0.011;
            const controlPosY = -0.012;
            const controlPosZ = 0.06;

            const startRotX = -0.46;
            const startRotY = -0.08;
            const startRotZ = 0.06;
            const controlRotX = -0.22;
            const controlRotY = -0.02;
            const controlRotZ = 0.04;

            posTarget.set(
                oneMinusP * oneMinusP * startPosX + 2 * oneMinusP * p * controlPosX + p * p * WEAPON_IDLE_X,
                oneMinusP * oneMinusP * startPosY + 2 * oneMinusP * p * controlPosY + p * p * WEAPON_IDLE_Y,
                oneMinusP * oneMinusP * startPosZ + 2 * oneMinusP * p * controlPosZ + p * p * WEAPON_IDLE_Z
            );
            rotTarget.set(
                oneMinusP * oneMinusP * startRotX + 2 * oneMinusP * p * controlRotX + p * p * 0,
                oneMinusP * oneMinusP * startRotY + 2 * oneMinusP * p * controlRotY + p * p * 0,
                oneMinusP * oneMinusP * startRotZ + 2 * oneMinusP * p * controlRotZ + p * p * 0
            );
        }

        const chargeSupport = getAttack2ChargePoseBlend(t, chargeRatio, isCharging);
        const releaseAccent = chargeRatio * THREE.MathUtils.smoothstep(t, ATTACK_2_CONFIG.displayStartupEnd * 0.92, ATTACK_2_CONFIG.displayActiveEnd * 0.94);
        posTarget.x += 0.008 * chargeSupport - 0.002 * releaseAccent;
        posTarget.y += 0.01 * chargeSupport - 0.012 * releaseAccent;
        posTarget.z += -0.055 * chargeSupport + 0.02 * releaseAccent;
        rotTarget.x += -0.16 * chargeSupport + 0.09 * releaseAccent;
        rotTarget.y += 0.2 * chargeSupport - 0.08 * releaseAccent;
        rotTarget.z += -0.02 * chargeSupport + 0.03 * releaseAccent;
    }

    function getAttack2CarryOffset(rawT, chargeRatio = getAttack2ChargeRatio(), isCharging = false) {
        const t = THREE.MathUtils.clamp(rawT, 0, 1);
        const weightShift = 0.018 + 0.03 * chargeRatio;
        const carryPeak = getAttack2CarryPeak(chargeRatio);
        if (isCharging) {
            return THREE.MathUtils.lerp(weightShift * 0.55, weightShift, THREE.MathUtils.smoothstep(t, 0.18, ATTACK_2_CONFIG.displayStartupEnd));
        }
        if (t <= 0.24) {
            return THREE.MathUtils.lerp(0, weightShift, easeOutCubic(t / 0.24));
        }
        if (t <= 0.58) {
            return THREE.MathUtils.lerp(weightShift, carryPeak, easeOutCubic((t - 0.24) / 0.34));
        }
        if (t <= 0.84) {
            const settleT = (t - 0.58) / 0.26;
            return THREE.MathUtils.lerp(carryPeak, carryPeak * 0.7, easeInOutCubic(settleT));
        }
        return THREE.MathUtils.lerp(carryPeak * 0.7, 0, easeInOutCubic((t - 0.84) / 0.16));
    }

    function getAttackProgress(type, rawT = attackT) {
        if (type === 'attack1') return Math.min(rawT / ATTACK_1_END_T, 1);
        if (type === 'attack2') return getAttack2DisplayT(rawT);
        return 0;
    }

    function getAttackCarryOffset(type, rawT = attackT) {
        if (type === 'attack1') return getAttack1CarryOffset(getAttackProgress(type, rawT));
        if (type === 'attack2') return getAttack2CarryOffset(getAttackProgress(type, rawT), getAttack2ChargeRatio(), attack2IsCharging);
        return 0;
    }

    function getAttack2PendingPoseTime(holdT = pendingAttack2HoldT, chargeT = getAttack2SelectedChargeT(holdT)) {
        const chargeRatio = getAttack2ChargeRatio(chargeT);
        const thresholdT = ATTACK_2_CONFIG.holdThreshold;
        const subtlePreviewT = thresholdT * 0.82;
        if (holdT <= thresholdT) {
            return subtlePreviewT * easeInOutCubic(holdT / Math.max(0.0001, thresholdT));
        }
        const chargeHoldProgress = THREE.MathUtils.clamp(
            (holdT - thresholdT) / Math.max(0.0001, ATTACK_2_CONFIG.maxChargeTime),
            0,
            1
        );
        return THREE.MathUtils.lerp(
            subtlePreviewT,
            Math.max(0, getAttack2ActiveStartTime(chargeRatio) - 0.0001),
            easeInOutCubic(chargeHoldProgress)
        );
    }

    function getAttack2RootLungeOffset(rawT, chargeRatio = getAttack2ChargeRatio()) {
        if (chargeRatio <= 0) return 0;
        const lungeStart = Math.max(0, getAttack2ActiveStartTime(chargeRatio) - 0.015);
        const lungeEnd = getAttack2ActiveEndTime(chargeRatio) + 0.05;
        const lungeDistance = 0.38 * easeOutCubic(chargeRatio);
        if (rawT <= lungeStart) return 0;
        if (rawT >= lungeEnd) return lungeDistance;
        return THREE.MathUtils.lerp(
            0,
            lungeDistance,
            easeOutCubic((rawT - lungeStart) / Math.max(0.0001, lungeEnd - lungeStart))
        );
    }





    function applyAttack1Pose(rawT, bodyBob, blend, includeWeaponPose = false) {
        // Attack 1 uses corrected anatomical references as the only combat-side truth.
        const strikeHand = anatomicalLeftHand;
        const counterHand = anatomicalRightHand;
        const stepFoot = anatomicalLeftFoot;
        const braceFoot = anatomicalRightFoot;
        const strikeHandHome = ANATOMICAL_LEFT_HAND_HOME;
        const counterHandHome = ANATOMICAL_RIGHT_HAND_HOME;
        const stepFootHome = ANATOMICAL_LEFT_FOOT_HOME;
        const braceFootHome = ANATOMICAL_RIGHT_FOOT_HOME;
        const t = getAttack1MotionT(rawT);
        const torsoT = Math.min(t + 0.07, 1);
        const plantT = Math.min(t + 0.05, 1);
        const handReturnBlend = THREE.MathUtils.smoothstep(rawT, 0.70, 1.0);
        const torsoReturnBlend = THREE.MathUtils.smoothstep(rawT, 0.78, 1.0);
        const plantReturnBlend = THREE.MathUtils.smoothstep(rawT, 0.82, 1.0);

        let strikeHandX, strikeHandY, strikeHandZ, bodyYaw, bodyLean, bodyDrop;
        let stepFootX, stepFootY, stepFootZ, braceFootX, braceFootY, braceFootZ, stepFootYaw, braceFootYaw;
        let counterHandX, counterHandY, counterHandZ;
        let armDepthPush = 0;

        if (t < 0.26) {
            const p = Math.pow(t / 0.26, 2.45);
            strikeHandX = THREE.MathUtils.lerp(0.32, 0.94, p);
            strikeHandY = THREE.MathUtils.lerp(0.94, 1.18, p);
            strikeHandZ = THREE.MathUtils.lerp(0.18, -0.08, p);
        } else if (t < 0.58) {
            const p = 1 - Math.pow(1 - ((t - 0.26) / 0.32), 3.25);
            strikeHandX = THREE.MathUtils.lerp(0.94, -0.76, p);
            strikeHandY = THREE.MathUtils.lerp(1.18, 0.9, p);
            strikeHandZ = THREE.MathUtils.lerp(-0.08, 1.0, p);
            armDepthPush = Math.sin(p * Math.PI) * 0.11;
        } else if (t < 0.78) {
            const p = 1 - Math.pow(1 - ((t - 0.58) / 0.20), 1.45);
            strikeHandX = THREE.MathUtils.lerp(-0.76, -0.52, p);
            strikeHandY = THREE.MathUtils.lerp(0.9, 0.82, p);
            strikeHandZ = THREE.MathUtils.lerp(1.0, 0.6, p);
            armDepthPush = THREE.MathUtils.lerp(0.065, 0.03, p);
        } else {
            const p = easeOutCubic((t - 0.78) / 0.22);
            strikeHandX = THREE.MathUtils.lerp(-0.52, ANATOMICAL_LEFT_HAND_IDLE.x, p);
            strikeHandY = THREE.MathUtils.lerp(0.82, ANATOMICAL_LEFT_HAND_IDLE.y, p);
            strikeHandZ = THREE.MathUtils.lerp(0.6, ANATOMICAL_LEFT_HAND_IDLE.z, p);
            armDepthPush = THREE.MathUtils.lerp(0.03, 0, p);
        }

        if (torsoT < 0.26) {
            const p = Math.pow(torsoT / 0.26, 2.15);
            bodyYaw = THREE.MathUtils.lerp(0, 0.74, p);
            bodyLean = THREE.MathUtils.lerp(0, -0.13, p);
            bodyDrop = THREE.MathUtils.lerp(0, 0.055, p);
        } else if (torsoT < 0.58) {
            const p = 1 - Math.pow(1 - ((torsoT - 0.26) / 0.32), 3.0);
            bodyYaw = THREE.MathUtils.lerp(0.74, -0.9, p);
            bodyLean = THREE.MathUtils.lerp(-0.13, 0.18, p);
            bodyDrop = THREE.MathUtils.lerp(0.055, 0.2, p);
        } else if (torsoT < 0.78) {
            const p = 1 - Math.pow(1 - ((torsoT - 0.58) / 0.20), 1.35);
            bodyYaw = THREE.MathUtils.lerp(-0.9, -0.44, p);
            bodyLean = THREE.MathUtils.lerp(0.18, 0.09, p);
            bodyDrop = THREE.MathUtils.lerp(0.2, 0.1, p);
        } else {
            const p = easeOutCubic((torsoT - 0.78) / 0.22);
            bodyYaw = THREE.MathUtils.lerp(-0.44, 0, p);
            bodyLean = THREE.MathUtils.lerp(0.09, 0, p);
            bodyDrop = THREE.MathUtils.lerp(0.1, 0, p);
        }

        if (plantT < 0.26) {
            const p = Math.pow(plantT / 0.26, 2.15);
            stepFootX = THREE.MathUtils.lerp(0, 0.03, p);
            stepFootY = THREE.MathUtils.lerp(0, 0.12, p);
            stepFootZ = THREE.MathUtils.lerp(0, 0.04, p);
            braceFootX = THREE.MathUtils.lerp(0, -0.015, p);
            braceFootY = THREE.MathUtils.lerp(0, 0.01, p);
            braceFootZ = THREE.MathUtils.lerp(0, -0.055, p);
            stepFootYaw = THREE.MathUtils.lerp(0, 0.14, p);
            braceFootYaw = THREE.MathUtils.lerp(0, 0.07, p);
        } else if (plantT < 0.58) {
            const p = 1 - Math.pow(1 - ((plantT - 0.26) / 0.32), 2.65);
            stepFootX = THREE.MathUtils.lerp(0.03, 0.19, p);
            stepFootY = THREE.MathUtils.lerp(0.12, 0, p);
            stepFootZ = THREE.MathUtils.lerp(0.04, 0.35, p);
            braceFootX = THREE.MathUtils.lerp(-0.015, -0.03, p);
            braceFootY = THREE.MathUtils.lerp(0.01, 0, p);
            braceFootZ = THREE.MathUtils.lerp(-0.055, -0.1, p);
            stepFootYaw = THREE.MathUtils.lerp(0.14, -0.16, p);
            braceFootYaw = THREE.MathUtils.lerp(0.07, -0.09, p);
        } else if (plantT < 0.78) {
            const p = 1 - Math.pow(1 - ((plantT - 0.58) / 0.20), 1.35);
            stepFootX = THREE.MathUtils.lerp(0.19, 0.16, p);
            stepFootY = 0;
            stepFootZ = THREE.MathUtils.lerp(0.35, 0.29, p);
            braceFootX = THREE.MathUtils.lerp(-0.03, -0.02, p);
            braceFootY = 0;
            braceFootZ = THREE.MathUtils.lerp(-0.1, -0.05, p);
            stepFootYaw = THREE.MathUtils.lerp(-0.16, -0.08, p);
            braceFootYaw = THREE.MathUtils.lerp(-0.09, -0.15, p);
        } else {
            const p = easeOutCubic((plantT - 0.78) / 0.22);
            stepFootX = THREE.MathUtils.lerp(0.16, 0, p);
            stepFootY = 0;
            stepFootZ = THREE.MathUtils.lerp(0.29, 0, p);
            braceFootX = THREE.MathUtils.lerp(-0.02, 0, p);
            braceFootY = 0;
            braceFootZ = THREE.MathUtils.lerp(-0.05, 0, p);
            stepFootYaw = THREE.MathUtils.lerp(-0.08, 0, p);
            braceFootYaw = THREE.MathUtils.lerp(-0.15, 0, p);
        }

        if (t < 0.26) {
            const p = Math.pow(t / 0.26, 2.2);
            counterHandX = THREE.MathUtils.lerp(-0.015, -0.045, p);
            counterHandY = THREE.MathUtils.lerp(0.17, 0.21, p);
            counterHandZ = THREE.MathUtils.lerp(-0.11, -0.26, p);
        } else if (t < 0.58) {
            const p = 1 - Math.pow(1 - ((t - 0.26) / 0.32), 2.8);
            counterHandX = THREE.MathUtils.lerp(-0.045, -0.075, p);
            counterHandY = THREE.MathUtils.lerp(0.21, 0.09, p);
            counterHandZ = THREE.MathUtils.lerp(-0.26, -0.46, p);
        } else if (t < 0.78) {
            const p = 1 - Math.pow(1 - ((t - 0.58) / 0.20), 1.35);
            counterHandX = THREE.MathUtils.lerp(-0.075, -0.035, p);
            counterHandY = THREE.MathUtils.lerp(0.09, 0.13, p);
            counterHandZ = THREE.MathUtils.lerp(-0.46, -0.32, p);
        } else {
            const p = easeOutCubic((t - 0.78) / 0.22);
            counterHandX = THREE.MathUtils.lerp(-0.05, ANATOMICAL_RIGHT_HAND_IDLE.x - counterHandHome.x, p);
            counterHandY = THREE.MathUtils.lerp(0.15, ANATOMICAL_RIGHT_HAND_IDLE.y - counterHandHome.y, p);
            counterHandZ = THREE.MathUtils.lerp(-0.24, ANATOMICAL_RIGHT_HAND_IDLE.z - counterHandHome.z, p);
        }

        strikeHandX = THREE.MathUtils.lerp(strikeHandX, ANATOMICAL_LEFT_HAND_IDLE.x, handReturnBlend);
        strikeHandY = THREE.MathUtils.lerp(strikeHandY, ANATOMICAL_LEFT_HAND_IDLE.y, handReturnBlend);
        strikeHandZ = THREE.MathUtils.lerp(strikeHandZ, ANATOMICAL_LEFT_HAND_IDLE.z, handReturnBlend);
        armDepthPush = THREE.MathUtils.lerp(armDepthPush, 0, handReturnBlend);
        counterHandX = THREE.MathUtils.lerp(counterHandX, ANATOMICAL_RIGHT_HAND_IDLE.x - counterHandHome.x, handReturnBlend);
        counterHandY = THREE.MathUtils.lerp(counterHandY, ANATOMICAL_RIGHT_HAND_IDLE.y - counterHandHome.y, handReturnBlend);
        counterHandZ = THREE.MathUtils.lerp(counterHandZ, ANATOMICAL_RIGHT_HAND_IDLE.z - counterHandHome.z, handReturnBlend);
        bodyYaw = THREE.MathUtils.lerp(bodyYaw, 0, torsoReturnBlend);
        bodyLean = THREE.MathUtils.lerp(bodyLean, 0, torsoReturnBlend);
        bodyDrop = THREE.MathUtils.lerp(bodyDrop, 0, torsoReturnBlend);
        stepFootX = THREE.MathUtils.lerp(stepFootX, 0, plantReturnBlend);
        stepFootY = THREE.MathUtils.lerp(stepFootY, 0, plantReturnBlend);
        stepFootZ = THREE.MathUtils.lerp(stepFootZ, 0, plantReturnBlend);
        braceFootX = THREE.MathUtils.lerp(braceFootX, 0, plantReturnBlend);
        braceFootY = THREE.MathUtils.lerp(braceFootY, 0, plantReturnBlend);
        braceFootZ = THREE.MathUtils.lerp(braceFootZ, 0, plantReturnBlend);
        stepFootYaw = THREE.MathUtils.lerp(stepFootYaw, 0, plantReturnBlend);
        braceFootYaw = THREE.MathUtils.lerp(braceFootYaw, 0, plantReturnBlend);

        const targetBodyY = BODY_HOME_Y + bodyBob - bodyDrop;
        const targetBodyRotX = 0.1 + bodyDrop * 0.25;
        const targetStrikeHandY = strikeHandY + bodyBob * 0.12 - bodyDrop * 0.15;
        const targetCounterHandY = counterHandY + bodyBob * 0.14;
        const targetBraceFootY = braceFootHome.y + braceFootY + bodyBob * 0.02;

        body.position.y = THREE.MathUtils.lerp(body.position.y, targetBodyY, blend);
        body.rotation.x = THREE.MathUtils.lerp(body.rotation.x, targetBodyRotX, blend);
        body.rotation.y = THREE.MathUtils.lerp(body.rotation.y, bodyYaw, blend);
        body.rotation.z = THREE.MathUtils.lerp(body.rotation.z, bodyLean, blend);
        eyeL.position.y = THREE.MathUtils.lerp(eyeL.position.y, EYE_L_HOME.y + bodyDrop * 0.03, blend);
        eyeR.position.y = THREE.MathUtils.lerp(eyeR.position.y, EYE_R_HOME.y + bodyDrop * 0.03, blend);

        braceFoot.position.x = THREE.MathUtils.lerp(braceFoot.position.x, braceFootHome.x + braceFootX, blend);
        braceFoot.position.y = THREE.MathUtils.lerp(braceFoot.position.y, targetBraceFootY, blend);
        braceFoot.position.z = THREE.MathUtils.lerp(braceFoot.position.z, braceFootHome.z + braceFootZ, blend);
        stepFoot.position.x = THREE.MathUtils.lerp(stepFoot.position.x, stepFootHome.x + stepFootX, blend);
        stepFoot.position.y = THREE.MathUtils.lerp(stepFoot.position.y, stepFootHome.y + stepFootY, blend);
        stepFoot.position.z = THREE.MathUtils.lerp(stepFoot.position.z, stepFootHome.z + stepFootZ, blend);
        braceFoot.rotation.y = THREE.MathUtils.lerp(braceFoot.rotation.y, braceFootYaw, blend);
        stepFoot.rotation.y = THREE.MathUtils.lerp(stepFoot.rotation.y, stepFootYaw, blend);

        strikeHand.position.x = THREE.MathUtils.lerp(strikeHand.position.x, strikeHandX, blend);
        strikeHand.position.y = THREE.MathUtils.lerp(strikeHand.position.y, targetStrikeHandY, blend);
        strikeHand.position.z = THREE.MathUtils.lerp(strikeHand.position.z, strikeHandZ + armDepthPush, blend);
        counterHand.position.x = THREE.MathUtils.lerp(counterHand.position.x, counterHandHome.x + counterHandX, blend);
        counterHand.position.y = THREE.MathUtils.lerp(counterHand.position.y, counterHandHome.y + targetCounterHandY, blend);
        counterHand.position.z = THREE.MathUtils.lerp(counterHand.position.z, counterHandHome.z + counterHandZ, blend);

        strikeHand.rotation.x = THREE.MathUtils.lerp(strikeHand.rotation.x, 0.26 + Math.abs(bodyYaw) * 0.22, blend);
        strikeHand.rotation.y = THREE.MathUtils.lerp(strikeHand.rotation.y, bodyYaw * 0.24, blend);
        strikeHand.rotation.z = THREE.MathUtils.lerp(strikeHand.rotation.z, 0.12 - bodyYaw * 0.18, blend);
        counterHand.rotation.x = THREE.MathUtils.lerp(counterHand.rotation.x, 0.1 + Math.abs(bodyYaw) * 0.05, blend);
        counterHand.rotation.y = THREE.MathUtils.lerp(counterHand.rotation.y, -bodyYaw * 0.1, blend);
        counterHand.rotation.z = THREE.MathUtils.lerp(counterHand.rotation.z, -0.05 + bodyYaw * 0.08, blend);

        if (includeWeaponPose) {
            setAttack1WeaponTargets(rawT, attack1WeaponReturnPos, attack1WeaponReturnRot);
            weaponPivot.scale.setScalar(1);
            weaponPivot.position.x = THREE.MathUtils.lerp(WEAPON_IDLE_X, attack1WeaponReturnPos.x, blend);
            weaponPivot.position.y = THREE.MathUtils.lerp(WEAPON_IDLE_Y, attack1WeaponReturnPos.y, blend);
            weaponPivot.position.z = THREE.MathUtils.lerp(WEAPON_IDLE_Z, attack1WeaponReturnPos.z, blend);
            weaponPivot.rotation.x = THREE.MathUtils.lerp(0, attack1WeaponReturnRot.x, blend);
            weaponPivot.rotation.y = THREE.MathUtils.lerp(0, attack1WeaponReturnRot.y, blend);
            weaponPivot.rotation.z = THREE.MathUtils.lerp(0, attack1WeaponReturnRot.z, blend);
        }

        attack1DebugState.active = true;
        attack1DebugState.weaponParent = getWeaponParentLabel();
        attack1DebugState.strikeHand = ATTACK_1_RUNTIME_ROLE_LABELS.strikeHand;
        attack1DebugState.counterHand = ATTACK_1_RUNTIME_ROLE_LABELS.counterHand;
        attack1DebugState.stepFoot = ATTACK_1_RUNTIME_ROLE_LABELS.stepFoot;
        attack1DebugState.braceFoot = ATTACK_1_RUNTIME_ROLE_LABELS.braceFoot;
        attack1DebugState.strikeVals = `${strikeHandX.toFixed(2)}, ${targetStrikeHandY.toFixed(2)}, ${(strikeHandZ + armDepthPush).toFixed(2)}`;
        attack1DebugState.counterVals = `${(counterHandHome.x + counterHandX).toFixed(2)}, ${(counterHandHome.y + targetCounterHandY).toFixed(2)}, ${(counterHandHome.z + counterHandZ).toFixed(2)}`;
        attack1DebugState.stepVals = `${(stepFootHome.x + stepFootX).toFixed(2)}, ${(stepFootHome.y + stepFootY).toFixed(2)}, ${(stepFootHome.z + stepFootZ).toFixed(2)}`;
        attack1DebugState.braceVals = `${(braceFootHome.x + braceFootX).toFixed(2)}, ${targetBraceFootY.toFixed(2)}, ${(braceFootHome.z + braceFootZ).toFixed(2)}`;
    }

    function applyAttack2Pose(rawT, bodyBob, blend, includeWeaponPose = false, chargeRatio = getAttack2ChargeRatio(), isCharging = false) {
        const strikeHand = anatomicalLeftHand;
        const counterHand = anatomicalRightHand;
        const stepFoot = anatomicalLeftFoot;
        const braceFoot = anatomicalRightFoot;
        const strikeHandHome = ANATOMICAL_LEFT_HAND_HOME;
        const counterHandHome = ANATOMICAL_RIGHT_HAND_HOME;
        const stepFootHome = ANATOMICAL_LEFT_FOOT_HOME;
        const braceFootHome = ANATOMICAL_RIGHT_FOOT_HOME;
        const t = getAttack2MotionT(rawT);
        const torsoT = Math.min(t + 0.03, 1);
        const stepT = Math.min(t + 0.05, 1);
        const handReturnBlend = THREE.MathUtils.smoothstep(rawT, 0.78, 1.0);
        const torsoReturnBlend = THREE.MathUtils.smoothstep(rawT, 0.82, 1.0);
        const stepReturnBlend = THREE.MathUtils.smoothstep(rawT, 0.84, 1.0);
        const chargeCoil = getAttack2ChargePoseBlend(rawT, chargeRatio, isCharging);
        const releaseDrive = chargeRatio * THREE.MathUtils.smoothstep(rawT, ATTACK_2_CONFIG.displayStartupEnd * 0.9, ATTACK_2_CONFIG.displayActiveEnd * 0.94);

        let strikeHandX, strikeHandY, strikeHandZ, bodyYaw, bodyLean, bodyDrop;
        let stepFootX, stepFootY, stepFootZ, braceFootX, braceFootY, braceFootZ, stepFootYaw, braceFootYaw;
        let counterHandX, counterHandY, counterHandZ;
        let armDepthPush = 0;

        if (t < 0.22) {
            const p = Math.pow(t / 0.22, 2.25);
            strikeHandX = THREE.MathUtils.lerp(0.48, 0.42, p);
            strikeHandY = THREE.MathUtils.lerp(0.92, 0.98, p);
            strikeHandZ = THREE.MathUtils.lerp(0.12, 0.08, p);
        } else if (t < 0.56) {
            const p = 1 - Math.pow(1 - ((t - 0.22) / 0.34), 3.1);
            strikeHandX = THREE.MathUtils.lerp(0.42, 0.16, p);
            strikeHandY = THREE.MathUtils.lerp(0.98, 0.64, p);
            strikeHandZ = THREE.MathUtils.lerp(0.08, 1.18, p);
            armDepthPush = Math.sin(p * Math.PI) * 0.16;
        } else if (t < 0.78) {
            const p = 1 - Math.pow(1 - ((t - 0.56) / 0.22), 1.6);
            strikeHandX = THREE.MathUtils.lerp(0.16, 0.18, p);
            strikeHandY = THREE.MathUtils.lerp(0.64, 0.7, p);
            strikeHandZ = THREE.MathUtils.lerp(1.18, 0.92, p);
            armDepthPush = THREE.MathUtils.lerp(0.09, 0.03, p);
        } else {
            const p = easeOutCubic((t - 0.78) / 0.22);
            strikeHandX = THREE.MathUtils.lerp(0.18, ANATOMICAL_LEFT_HAND_IDLE.x, p);
            strikeHandY = THREE.MathUtils.lerp(0.7, ANATOMICAL_LEFT_HAND_IDLE.y, p);
            strikeHandZ = THREE.MathUtils.lerp(0.92, ANATOMICAL_LEFT_HAND_IDLE.z, p);
            armDepthPush = THREE.MathUtils.lerp(0.03, 0, p);
        }

        if (torsoT < 0.22) {
            const p = Math.pow(torsoT / 0.22, 2.05);
            bodyYaw = THREE.MathUtils.lerp(0, 0.1, p);
            bodyLean = THREE.MathUtils.lerp(0, -0.02, p);
            bodyDrop = THREE.MathUtils.lerp(0, 0.05, p);
        } else if (torsoT < 0.56) {
            const p = 1 - Math.pow(1 - ((torsoT - 0.22) / 0.34), 2.85);
            bodyYaw = THREE.MathUtils.lerp(0.1, -0.18, p);
            bodyLean = THREE.MathUtils.lerp(-0.02, 0.05, p);
            bodyDrop = THREE.MathUtils.lerp(0.05, 0.26, p);
        } else if (torsoT < 0.78) {
            const p = 1 - Math.pow(1 - ((torsoT - 0.56) / 0.22), 1.45);
            bodyYaw = THREE.MathUtils.lerp(-0.18, -0.08, p);
            bodyLean = THREE.MathUtils.lerp(0.05, 0.02, p);
            bodyDrop = THREE.MathUtils.lerp(0.26, 0.12, p);
        } else {
            const p = easeOutCubic((torsoT - 0.78) / 0.22);
            bodyYaw = THREE.MathUtils.lerp(-0.08, 0, p);
            bodyLean = THREE.MathUtils.lerp(0.02, 0, p);
            bodyDrop = THREE.MathUtils.lerp(0.12, 0, p);
        }

        if (stepT < 0.22) {
            const p = Math.pow(stepT / 0.22, 2.0);
            stepFootX = THREE.MathUtils.lerp(0, 0.012, p);
            stepFootY = THREE.MathUtils.lerp(0, 0.08, p);
            stepFootZ = THREE.MathUtils.lerp(0, 0.015, p);
            braceFootX = THREE.MathUtils.lerp(0, -0.01, p);
            braceFootY = THREE.MathUtils.lerp(0, 0.01, p);
            braceFootZ = THREE.MathUtils.lerp(0, -0.025, p);
            stepFootYaw = THREE.MathUtils.lerp(0, 0.03, p);
            braceFootYaw = THREE.MathUtils.lerp(0, 0.02, p);
        } else if (stepT < 0.56) {
            const p = 1 - Math.pow(1 - ((stepT - 0.22) / 0.34), 2.55);
            stepFootX = THREE.MathUtils.lerp(0.012, 0.06, p);
            stepFootY = THREE.MathUtils.lerp(0.08, 0, p);
            stepFootZ = THREE.MathUtils.lerp(0.015, 0.28, p);
            braceFootX = THREE.MathUtils.lerp(-0.01, -0.022, p);
            braceFootY = THREE.MathUtils.lerp(0.01, 0, p);
            braceFootZ = THREE.MathUtils.lerp(-0.025, -0.085, p);
            stepFootYaw = THREE.MathUtils.lerp(0.03, -0.03, p);
            braceFootYaw = THREE.MathUtils.lerp(0.02, -0.06, p);
        } else if (stepT < 0.78) {
            const p = 1 - Math.pow(1 - ((stepT - 0.56) / 0.22), 1.4);
            stepFootX = THREE.MathUtils.lerp(0.06, 0.05, p);
            stepFootY = 0;
            stepFootZ = THREE.MathUtils.lerp(0.28, 0.22, p);
            braceFootX = THREE.MathUtils.lerp(-0.022, -0.016, p);
            braceFootY = 0;
            braceFootZ = THREE.MathUtils.lerp(-0.085, -0.045, p);
            stepFootYaw = THREE.MathUtils.lerp(-0.03, -0.01, p);
            braceFootYaw = THREE.MathUtils.lerp(-0.06, -0.08, p);
        } else {
            const p = easeOutCubic((stepT - 0.78) / 0.22);
            stepFootX = THREE.MathUtils.lerp(0.05, 0, p);
            stepFootY = 0;
            stepFootZ = THREE.MathUtils.lerp(0.22, 0, p);
            braceFootX = THREE.MathUtils.lerp(-0.016, 0, p);
            braceFootY = 0;
            braceFootZ = THREE.MathUtils.lerp(-0.045, 0, p);
            stepFootYaw = THREE.MathUtils.lerp(-0.01, 0, p);
            braceFootYaw = THREE.MathUtils.lerp(-0.08, 0, p);
        }

        if (t < 0.22) {
            const p = Math.pow(t / 0.22, 2.0);
            counterHandX = THREE.MathUtils.lerp(-0.01, -0.022, p);
            counterHandY = THREE.MathUtils.lerp(0.17, 0.22, p);
            counterHandZ = THREE.MathUtils.lerp(-0.11, -0.18, p);
        } else if (t < 0.56) {
            const p = 1 - Math.pow(1 - ((t - 0.22) / 0.34), 2.45);
            counterHandX = THREE.MathUtils.lerp(-0.022, -0.04, p);
            counterHandY = THREE.MathUtils.lerp(0.22, 0.13, p);
            counterHandZ = THREE.MathUtils.lerp(-0.18, -0.34, p);
        } else if (t < 0.78) {
            const p = 1 - Math.pow(1 - ((t - 0.56) / 0.22), 1.35);
            counterHandX = THREE.MathUtils.lerp(-0.04, -0.024, p);
            counterHandY = THREE.MathUtils.lerp(0.13, 0.16, p);
            counterHandZ = THREE.MathUtils.lerp(-0.34, -0.24, p);
        } else {
            const p = easeOutCubic((t - 0.78) / 0.22);
            counterHandX = THREE.MathUtils.lerp(-0.024, ANATOMICAL_RIGHT_HAND_IDLE.x - counterHandHome.x, p);
            counterHandY = THREE.MathUtils.lerp(0.15, ANATOMICAL_RIGHT_HAND_IDLE.y - counterHandHome.y, p);
            counterHandZ = THREE.MathUtils.lerp(-0.24, ANATOMICAL_RIGHT_HAND_IDLE.z - counterHandHome.z, p);
        }

        if (isCharging) {
            const holdT = getAttack2ChargeLaneT(rawT);
            strikeHandX = THREE.MathUtils.lerp(0.46, 0.34, holdT);
            strikeHandY = THREE.MathUtils.lerp(0.92, 0.82, holdT);
            strikeHandZ = THREE.MathUtils.lerp(0.12, -0.18, holdT);
            armDepthPush = THREE.MathUtils.lerp(0, -0.08, holdT);
            bodyYaw = THREE.MathUtils.lerp(0.02, 0.34, holdT);
            bodyLean = THREE.MathUtils.lerp(-0.01, -0.06, holdT);
            bodyDrop = THREE.MathUtils.lerp(0.04, 0.1, holdT);
            stepFootX = THREE.MathUtils.lerp(0.008, 0.028, holdT);
            stepFootY = THREE.MathUtils.lerp(0.05, 0.01, holdT);
            stepFootZ = THREE.MathUtils.lerp(0.012, -0.05, holdT);
            braceFootX = THREE.MathUtils.lerp(-0.01, -0.02, holdT);
            braceFootY = THREE.MathUtils.lerp(0.01, 0, holdT);
            braceFootZ = THREE.MathUtils.lerp(-0.02, -0.075, holdT);
            stepFootYaw = THREE.MathUtils.lerp(0.012, 0.024, holdT);
            braceFootYaw = THREE.MathUtils.lerp(0.01, -0.035, holdT);
            counterHandX = THREE.MathUtils.lerp(-0.016, -0.032, holdT);
            counterHandY = THREE.MathUtils.lerp(0.18, 0.18, holdT);
            counterHandZ = THREE.MathUtils.lerp(-0.14, -0.23, holdT);
        } else {
            strikeHandX += 0.055 * chargeCoil - 0.015 * releaseDrive;
            strikeHandY += 0.09 * chargeCoil - 0.09 * releaseDrive;
            strikeHandZ += -0.42 * chargeCoil + 0.18 * releaseDrive;
            armDepthPush += -0.09 * chargeCoil + 0.16 * releaseDrive;
            bodyYaw += 0.34 * chargeCoil - 0.05 * releaseDrive;
            bodyLean += -0.05 * chargeCoil + 0.05 * releaseDrive;
            bodyDrop += 0.05 * chargeCoil + 0.07 * releaseDrive;
            stepFootX += 0.018 * chargeCoil + 0.02 * releaseDrive;
            stepFootY += 0.02 * chargeCoil + 0.025 * releaseDrive;
            stepFootZ += -0.08 * chargeCoil + 0.24 * releaseDrive;
            stepFootYaw -= 0.06 * releaseDrive;
            braceFootZ -= 0.05 * chargeCoil;
            braceFootZ += 0.08 * releaseDrive;
            braceFootYaw += 0.04 * releaseDrive;
            counterHandY += 0.02 * chargeCoil;
            counterHandZ -= 0.06 * chargeCoil;
            strikeHandX = Math.max(strikeHandX, 0.12);
            counterHandX = Math.min(counterHandX, -0.02);
        }

        strikeHandX = THREE.MathUtils.lerp(strikeHandX, ANATOMICAL_LEFT_HAND_IDLE.x, handReturnBlend);
        strikeHandY = THREE.MathUtils.lerp(strikeHandY, ANATOMICAL_LEFT_HAND_IDLE.y, handReturnBlend);
        strikeHandZ = THREE.MathUtils.lerp(strikeHandZ, ANATOMICAL_LEFT_HAND_IDLE.z, handReturnBlend);
        armDepthPush = THREE.MathUtils.lerp(armDepthPush, 0, handReturnBlend);
        counterHandX = THREE.MathUtils.lerp(counterHandX, ANATOMICAL_RIGHT_HAND_IDLE.x - counterHandHome.x, handReturnBlend);
        counterHandY = THREE.MathUtils.lerp(counterHandY, ANATOMICAL_RIGHT_HAND_IDLE.y - counterHandHome.y, handReturnBlend);
        counterHandZ = THREE.MathUtils.lerp(counterHandZ, ANATOMICAL_RIGHT_HAND_IDLE.z - counterHandHome.z, handReturnBlend);
        bodyYaw = THREE.MathUtils.lerp(bodyYaw, 0, torsoReturnBlend);
        bodyLean = THREE.MathUtils.lerp(bodyLean, 0, torsoReturnBlend);
        bodyDrop = THREE.MathUtils.lerp(bodyDrop, 0, torsoReturnBlend);
        stepFootX = THREE.MathUtils.lerp(stepFootX, 0, stepReturnBlend);
        stepFootY = THREE.MathUtils.lerp(stepFootY, 0, stepReturnBlend);
        stepFootZ = THREE.MathUtils.lerp(stepFootZ, 0, stepReturnBlend);
        braceFootX = THREE.MathUtils.lerp(braceFootX, 0, stepReturnBlend);
        braceFootY = THREE.MathUtils.lerp(braceFootY, 0, stepReturnBlend);
        braceFootZ = THREE.MathUtils.lerp(braceFootZ, 0, stepReturnBlend);
        stepFootYaw = THREE.MathUtils.lerp(stepFootYaw, 0, stepReturnBlend);
        braceFootYaw = THREE.MathUtils.lerp(braceFootYaw, 0, stepReturnBlend);

        const targetBodyY = BODY_HOME_Y + bodyBob - bodyDrop;
        const targetBodyRotX = 0.1 + bodyDrop * 0.34;
        const targetStrikeHandY = strikeHandY + bodyBob * 0.12 - bodyDrop * 0.2;
        const targetCounterHandY = counterHandY + bodyBob * 0.12;
        const targetBraceFootY = braceFootHome.y + braceFootY + bodyBob * 0.02;

        body.position.y = THREE.MathUtils.lerp(body.position.y, targetBodyY, blend);
        body.rotation.x = THREE.MathUtils.lerp(body.rotation.x, targetBodyRotX, blend);
        body.rotation.y = THREE.MathUtils.lerp(body.rotation.y, bodyYaw, blend);
        body.rotation.z = THREE.MathUtils.lerp(body.rotation.z, bodyLean, blend);
        eyeL.position.y = THREE.MathUtils.lerp(eyeL.position.y, EYE_L_HOME.y + bodyDrop * 0.03, blend);
        eyeR.position.y = THREE.MathUtils.lerp(eyeR.position.y, EYE_R_HOME.y + bodyDrop * 0.03, blend);

        braceFoot.position.x = THREE.MathUtils.lerp(braceFoot.position.x, braceFootHome.x + braceFootX, blend);
        braceFoot.position.y = THREE.MathUtils.lerp(braceFoot.position.y, targetBraceFootY, blend);
        braceFoot.position.z = THREE.MathUtils.lerp(braceFoot.position.z, braceFootHome.z + braceFootZ, blend);
        stepFoot.position.x = THREE.MathUtils.lerp(stepFoot.position.x, stepFootHome.x + stepFootX, blend);
        stepFoot.position.y = THREE.MathUtils.lerp(stepFoot.position.y, stepFootHome.y + stepFootY, blend);
        stepFoot.position.z = THREE.MathUtils.lerp(stepFoot.position.z, stepFootHome.z + stepFootZ, blend);
        braceFoot.rotation.y = THREE.MathUtils.lerp(braceFoot.rotation.y, braceFootYaw, blend);
        stepFoot.rotation.y = THREE.MathUtils.lerp(stepFoot.rotation.y, stepFootYaw, blend);

        strikeHand.position.x = THREE.MathUtils.lerp(strikeHand.position.x, strikeHandX, blend);
        strikeHand.position.y = THREE.MathUtils.lerp(strikeHand.position.y, targetStrikeHandY, blend);
        strikeHand.position.z = THREE.MathUtils.lerp(strikeHand.position.z, strikeHandZ + armDepthPush, blend);
        counterHand.position.x = THREE.MathUtils.lerp(counterHand.position.x, counterHandHome.x + counterHandX, blend);
        counterHand.position.y = THREE.MathUtils.lerp(counterHand.position.y, counterHandHome.y + targetCounterHandY, blend);
        counterHand.position.z = THREE.MathUtils.lerp(counterHand.position.z, counterHandHome.z + counterHandZ, blend);

        strikeHand.rotation.x = THREE.MathUtils.lerp(strikeHand.rotation.x, 0.32 + Math.abs(bodyYaw) * 0.08, blend);
        strikeHand.rotation.y = THREE.MathUtils.lerp(strikeHand.rotation.y, bodyYaw * 0.12, blend);
        strikeHand.rotation.z = THREE.MathUtils.lerp(strikeHand.rotation.z, 0.06 - bodyYaw * 0.08, blend);
        counterHand.rotation.x = THREE.MathUtils.lerp(counterHand.rotation.x, 0.12 + Math.abs(bodyYaw) * 0.04, blend);
        counterHand.rotation.y = THREE.MathUtils.lerp(counterHand.rotation.y, -bodyYaw * 0.06, blend);
        counterHand.rotation.z = THREE.MathUtils.lerp(counterHand.rotation.z, -0.04 + bodyYaw * 0.04, blend);

        if (includeWeaponPose) {
            setAttack2WeaponTargets(rawT, attack2WeaponReturnPos, attack2WeaponReturnRot, chargeRatio, isCharging);
            weaponPivot.scale.setScalar(1);
            weaponPivot.position.x = THREE.MathUtils.lerp(WEAPON_IDLE_X, attack2WeaponReturnPos.x, blend);
            weaponPivot.position.y = THREE.MathUtils.lerp(WEAPON_IDLE_Y, attack2WeaponReturnPos.y, blend);
            weaponPivot.position.z = THREE.MathUtils.lerp(WEAPON_IDLE_Z, attack2WeaponReturnPos.z, blend);
            weaponPivot.rotation.x = THREE.MathUtils.lerp(0, attack2WeaponReturnRot.x, blend);
            weaponPivot.rotation.y = THREE.MathUtils.lerp(0, attack2WeaponReturnRot.y, blend);
            weaponPivot.rotation.z = THREE.MathUtils.lerp(0, attack2WeaponReturnRot.z, blend);
        }
    }

    function updateEnemyHealthBar() {
        const ratio = THREE.MathUtils.clamp(enemy.health / enemy.maxHealth, 0, 1);
        enemyHpFill.scale.x = ratio;
        enemyHpFill.position.x = -0.85 + 0.85 * ratio;
        enemyHpFill.material.color.set(ratio > 0.5 ? 0xff627f : 0xff3b5c);
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

    function getFlatCameraForward() {
        camera.getWorldDirection(cameraForward);
        cameraForward.y = 0;
        if (cameraForward.lengthSq() < 0.0001) cameraForward.set(0, 0, -1);
        return cameraForward.normalize();
    }

    function getAttackIntent(worldMove) {
        if (worldMove.lengthSq() > 0.01) {
            lastMoveWorld.copy(worldMove).normalize();
            attackIntent.copy(lastMoveWorld);
        } else if (lastMoveWorld.lengthSq() > 0.01) {
            attackIntent.copy(lastMoveWorld);
        } else {
            attackIntent.set(0, 0, 1).applyAxisAngle(moveAxis, playerModel.rotation.y).normalize();
        }
        return attackIntent;
    }

    function rotateModelToward(direction, blend) {
        const targetYaw = Math.atan2(direction.x, direction.z);
        const delta = THREE.MathUtils.euclideanModulo(targetYaw - playerModel.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
        playerModel.rotation.y += delta * blend;
    }

    function getWeaponParentLabel() {
        if (weaponPivot.parent === anatomicalLeftHand) return 'anatomicalLeftHand';
        if (weaponPivot.parent === anatomicalRightHand) return 'anatomicalRightHand';
        return 'other';
    }

    function validateAnatomicalCombatRig() {
        if (attack1DebugValidated) return;
        attack1DebugValidated = true;
        if (
            anatomicalLeftHand !== rightHand ||
            anatomicalRightHand !== leftHand ||
            anatomicalLeftFoot !== rightFoot ||
            anatomicalRightFoot !== leftFoot
        ) {
            console.warn('[ATTACK 1 DEBUG] Anatomical mapping no longer matches the known inverted raw rig.');
        }
        if (weaponPivot.parent !== anatomicalLeftHand) {
            console.warn(`[ATTACK 1 DEBUG] Weapon parent drifted from anatomicalLeftHand. Current parent: ${getWeaponParentLabel()}`);
        }
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
                `[ATTACK 1 DEBUG] strikeHand:${ATTACK_1_RUNTIME_ROLE_LABELS.strikeHand} counterHand:${ATTACK_1_RUNTIME_ROLE_LABELS.counterHand} stepFoot:${ATTACK_1_RUNTIME_ROLE_LABELS.stepFoot} braceFoot:${ATTACK_1_RUNTIME_ROLE_LABELS.braceFoot} weaponParent:${getWeaponParentLabel()}`
            );
        }
        if (!preserveIntent) getAttackIntent(worldMove);
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
        rotateModelToward(rollDirection, 1);
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

    function canBridgeAttack2IntoAttack1(t, chargeRatio = getAttack2ChargeRatio()) {
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
                true,
                previewChargeRatio,
                pendingAttack2HoldT >= ATTACK_2_CONFIG.holdThreshold
            );
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
                applyAttack1Pose(attack1PreviewT, bodyBob, bridgeBlend, false);
                return;
            }

            if (currentAttackType === 'attack2') {
                const previewChargeT = attack2IsCharging
                    ? Math.min(ATTACK_2_CONFIG.maxChargeTime, attack2ChargeT + dt * ATTACK_2_CONFIG.playbackRate)
                    : attack2ChargeT;
                const previewChargeRatio = getAttack2ChargeRatio(previewChargeT);
                const previewPhaseT = Math.min(attackT + dt * ATTACK_2_CONFIG.playbackRate, getAttack2TotalTime(previewChargeRatio));
                const attack2PreviewT = getAttack2DisplayT(previewPhaseT, previewChargeRatio);
                applyAttack2Pose(attack2PreviewT, bodyBob, 1, false, previewChargeRatio, attack2IsCharging);
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

    function startEnemyRecovery() {
        enemy.state = 'recovery';
        enemy.recoveryT = 0.9;
        enemy.attackCooldown = 1.8 + Math.random() * 0.8;
        enemy.playerHitThisLunge = false;
    }

    function killEnemy() {
        enemy.state = 'dead';
        enemy.deadT = 0.28;
        enemy.hitFlashT = 0.16;
        enemyKnockback.set(0, 0, 0);
        updateEnemyHealthBar();
        addSnap(10);
    }

    function hitEnemy(attackType, chargeRatio = 0) {
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
        updateEnemyHealthBar();

        if (enemy.health <= 0) {
            killEnemy();
            return;
        }

        enemy.state = 'hitstun';
        enemy.hitStunT = hitStun;
        enemy.playerHitThisLunge = false;
    }

    function hitPlayer() {
        if (playerHp <= 0 || isRollInvulnerable()) return;
        resetPendingAttack2();
        setPlayerHp(playerHp - 1);
        playerFlashT = 0.28;
        damageTintT = 0.1;
        playerHitStunT = 0.16;
        playerKnockback.copy(enemy.lungeDir).multiplyScalar(8.5);
        if (playerHp <= 0) {
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
        }
    }

    function updateEnemy(dt, elapsedTime) {
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

            if (!enemy.playerHitThisLunge && enemyPivot.position.distanceTo(playerPivot.position) < 1.55) {
                enemy.playerHitThisLunge = true;
                hitPlayer();
            }

            if (enemy.lungeT <= 0) startEnemyRecovery();
        } else if (enemy.state === 'recovery') {
            enemy.recoveryT -= dt;
            if (enemy.recoveryT <= 0) {
                enemy.state = 'orbit';
                enemy.strafeDir *= Math.random() > 0.45 ? 1 : -1;
            }
        } else if (enemy.state === 'hitstun') {
            enemy.hitStunT -= dt;
            enemyPivot.position.addScaledVector(enemyKnockback, dt);
            enemyKnockback.lerp(tempVecA.set(0, 0, 0), Math.min(1, dt * 10));
            if (enemy.hitStunT <= 0) startEnemyRecovery();
        } else if (enemy.state === 'dead') {
            enemy.deadT -= dt;
            enemyPivot.position.addScaledVector(enemyKnockback, dt * 0.4);
            enemyKnockback.lerp(tempVecA.set(0, 0, 0), Math.min(1, dt * 8));
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

    setPlayerHp(PLAYER_MAX_HP);
    setSnapMeter(0);
    updateEnemyHealthBar();
    resetWeaponToIdle();

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
        updateEnvironment(dt);
        if (hitStopT > 0) hitStopT = Math.max(0, hitStopT - rawDt);
        if (playerHitStunT > 0) playerHitStunT = Math.max(0, playerHitStunT - rawDt);
        if (rollCooldownT > 0) rollCooldownT = Math.max(0, rollCooldownT - rawDt);
        const gp = navigator.getGamepads()[0];
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
        if (!isRolling || rollT <= ROLL_BUFFER_WINDOW) {
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
        if (rollJustPressed) startRoll(worldMove);
        rollHeld = rollPressed;

        if (playerKnockback.lengthSq() > 0.0001) {
            playerPivot.position.addScaledVector(playerKnockback, dt);
            playerKnockback.multiplyScalar(Math.max(0, 1 - rawDt * 10));
        }

        if (isRolling) {
            const rollProgress = 1 - (rollT / ROLL_DURATION);
            const rollSpeed = 30 * Math.pow(1 - rollProgress, 2) + 4;
            playerPivot.position.addScaledVector(rollDirection, rollSpeed * dt);
            rotateModelToward(rollDirection, 0.45);
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
        } else if (pendingAttack2 && playerHitStunT <= 0 && playerHp > 0) {
            playerModel.rotation.x = 0;
            playerModel.position.y = 0;
            playerModel.scale.setScalar(1);
            rotateModelToward(getAttackIntent(worldMove), 0.3);
        } else if (worldMove.lengthSq() > 0.01 && !isAttacking && playerHitStunT <= 0 && playerHp > 0) {
            playerModel.rotation.x = 0;
            playerModel.position.y = 0;
            playerModel.scale.setScalar(1);
            lastMoveWorld.copy(worldMove).normalize();
            playerPivot.position.add(worldMove.clone().multiplyScalar(16 * dt));
            rotateModelToward(lastMoveWorld, 0.35);
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

        updateEnemy(dt, clock.elapsedTime);

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

            const attackChargeRatio = currentAttackType === 'attack2' ? getAttack2ChargeRatio() : 0;
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
            if (enemy.state !== 'dead' && enemyPivot.visible && shouldEvaluateHit) {
                enemyCore.getWorldPosition(enemyCenter);
                base.getWorldPosition(attackBasePos);
                tip.getWorldPosition(attackTipPos);
                const hitDistance = pointToSegmentDistanceXZ(enemyCenter, attackBasePos, attackTipPos);
                const swingMidY = (attackBasePos.y + attackTipPos.y) * 0.5;
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
                    hitEnemy(currentAttackType, attackChargeRatio);
                }
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
                attackCarry = getAttack2CarryOffset(attackProgress, getAttack2ChargeRatio(), attack2IsCharging);
            }
        }
        playerForward.set(0, 0, 1).applyAxisAngle(moveAxis, playerModel.rotation.y).normalize();
        playerModel.position.x = playerForward.x * attackCarry;
        playerModel.position.z = playerForward.z * attackCarry;

        playerFlashT = Math.max(0, playerFlashT - rawDt);
        const playerFlashMix = playerFlashT > 0 ? Math.min(1, playerFlashT / 0.28) : 0;
        bodyMat.color.copy(playerBaseColor).lerp(playerHitColor, playerFlashMix * 0.95);
        bodyMat.emissive.copy(playerBaseColor).lerp(playerHitColor, playerFlashMix * 0.55);
        limbMat.color.copy(bodyMat.color);
        limbMat.emissive.copy(bodyMat.emissive);
        const rollGlow = isRolling ? 1 : 0;
        bodyMat.emissiveIntensity = 0.4 + playerFlashMix * 1.25 + rollGlow * 1.35;
        limbMat.emissiveIntensity = 0.34 + playerFlashMix * 0.9 + rollGlow * 0.9;
        shadow.material.opacity = isRolling ? 0.18 : 0.5;

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

        enemyHpRoot.visible = enemyPivot.visible && enemy.state !== 'dead';
        if (enemyHpRoot.visible) {
            enemyHpRoot.position.copy(enemyPivot.position);
            enemyHpRoot.position.y += 3.05;
            enemyHpRoot.quaternion.copy(camera.quaternion);
        }

        renderer.render(scene, camera);
    }

    return { frame };
}
