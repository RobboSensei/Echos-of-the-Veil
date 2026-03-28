import * as THREE from 'three';
import {
    ATTACK_2_CONFIG,
    WEAPON_IDLE_X,
    WEAPON_IDLE_Y,
    WEAPON_IDLE_Z
} from '../core/constants.js';
import { easeInOutCubic, easeOutCubic } from '../utils/easing.js';

export function getAttack2ChargeRatio(rawChargeT = 0) {
    if (rawChargeT <= 0 || ATTACK_2_CONFIG.maxChargeTime <= 0) return 0;
    return THREE.MathUtils.clamp(rawChargeT / ATTACK_2_CONFIG.maxChargeTime, 0, 1);
}

export function getAttack2SelectedChargeT(holdT = 0) {
    if (holdT <= ATTACK_2_CONFIG.holdThreshold) return 0;
    return THREE.MathUtils.clamp(holdT - ATTACK_2_CONFIG.holdThreshold, 0, ATTACK_2_CONFIG.maxChargeTime);
}

export function getAttack2ActiveStartTime(chargeRatio = 0) {
    return ATTACK_2_CONFIG.startupTime + ATTACK_2_CONFIG.chargeStartupBonus * chargeRatio;
}

export function getAttack2ActiveEndTime(chargeRatio = 0) {
    return getAttack2ActiveStartTime(chargeRatio) + ATTACK_2_CONFIG.activeTime;
}

export function getAttack2RecoveryTime(chargeRatio = 0) {
    return ATTACK_2_CONFIG.recoveryTime + ATTACK_2_CONFIG.recoveryBonus * chargeRatio;
}

export function getAttack2TotalTime(chargeRatio = 0) {
    return getAttack2ActiveEndTime(chargeRatio) + getAttack2RecoveryTime(chargeRatio);
}

export function getAttack2DisplayT(rawT, chargeRatio = 0) {
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

export function getAttack2MotionT(rawT) {
    return THREE.MathUtils.clamp(rawT, 0, 1);
}

export function getAttack2ChargePoseBlend(rawT, chargeRatio, isCharging = false) {
    if (chargeRatio <= 0) return 0;
    if (isCharging) {
        const chargeT = THREE.MathUtils.smoothstep(rawT, 0.05, ATTACK_2_CONFIG.displayStartupEnd * 0.94);
        return chargeRatio * easeInOutCubic(chargeT);
    }
    return chargeRatio * (1 - THREE.MathUtils.smoothstep(rawT, 0.62, 0.88));
}

export function getAttack2ChargeLaneT(rawT) {
    const laneT = THREE.MathUtils.smoothstep(rawT, 0.22, ATTACK_2_CONFIG.displayStartupEnd * 0.98);
    return easeInOutCubic(laneT);
}

export function getAttack2Damage(chargeRatio = 0) {
    return ATTACK_2_CONFIG.tapDamage * THREE.MathUtils.lerp(1, ATTACK_2_CONFIG.maxDamageScale, chargeRatio);
}

export function getAttack2HitStun(chargeRatio = 0) {
    return ATTACK_2_CONFIG.tapHitStun + ATTACK_2_CONFIG.holdHitStunBonus * chargeRatio;
}

export function getAttack2Knockback(chargeRatio = 0) {
    return ATTACK_2_CONFIG.tapKnockback + ATTACK_2_CONFIG.holdKnockbackBonus * chargeRatio;
}

export function getAttack2HitRange(chargeRatio = 0) {
    return ATTACK_2_CONFIG.tapHitRange + ATTACK_2_CONFIG.holdHitRangeBonus * chargeRatio;
}

export function getAttack2CarryPeak(chargeRatio = 0) {
    return ATTACK_2_CONFIG.tapCarryPeak + ATTACK_2_CONFIG.holdCarryBonus * chargeRatio;
}

export function getAttack2MaxLateral(chargeRatio = 0) {
    return ATTACK_2_CONFIG.maxLateral - 0.06 * chargeRatio;
}

export function setAttack2WeaponTargets(rawT, posTarget, rotTarget, chargeRatio = 0, isCharging = false) {
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

export function getAttack2CarryOffset(rawT, chargeRatio = 0, isCharging = false) {
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

export function getAttack2PendingPoseTime(holdT = 0, chargeT = getAttack2SelectedChargeT(holdT)) {
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

export function getAttack2RootLungeOffset(rawT, chargeRatio = 0) {
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

export function applyAttack2Pose(rawT, bodyBob, blend, playerRig, includeWeaponPose = false, chargeRatio = 0, isCharging = false) {
    const {
        body,
        eyeL,
        eyeR,
        weaponPivot,
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
    } = playerRig;

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

    let strikeHandX;
    let strikeHandY;
    let strikeHandZ;
    let bodyYaw;
    let bodyLean;
    let bodyDrop;
    let stepFootX;
    let stepFootY;
    let stepFootZ;
    let braceFootX;
    let braceFootY;
    let braceFootZ;
    let stepFootYaw;
    let braceFootYaw;
    let counterHandX;
    let counterHandY;
    let counterHandZ;
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
