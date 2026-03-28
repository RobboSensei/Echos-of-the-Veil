import * as THREE from 'three';
import {
    ATTACK_1_CARRY_PEAK,
    WEAPON_IDLE_X,
    WEAPON_IDLE_Y,
    WEAPON_IDLE_Z
} from '../core/constants.js';
import { easeInOutCubic, easeInQuad, easeOutCubic } from '../utils/easing.js';

export function getAttack1MotionT(rawT) {
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

export function setAttack1WeaponTargets(rawT, posTarget, rotTarget) {
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

export function getAttack1CarryOffset(rawT) {
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

export function applyAttack1Pose(rawT, bodyBob, blend, playerRig, includeWeaponPose = false, debugContext = null) {
    const {
        body,
        eyeL,
        eyeR,
        weaponPivot,
        attack1WeaponReturnPos,
        attack1WeaponReturnRot,
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
    const t = getAttack1MotionT(rawT);
    const torsoT = Math.min(t + 0.07, 1);
    const plantT = Math.min(t + 0.05, 1);
    const handReturnBlend = THREE.MathUtils.smoothstep(rawT, 0.70, 1.0);
    const torsoReturnBlend = THREE.MathUtils.smoothstep(rawT, 0.78, 1.0);
    const plantReturnBlend = THREE.MathUtils.smoothstep(rawT, 0.82, 1.0);

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

    if (!debugContext) return;

    const { attack1DebugState, runtimeRoleLabels, getWeaponParentLabel } = debugContext;
    attack1DebugState.active = true;
    attack1DebugState.weaponParent = getWeaponParentLabel();
    attack1DebugState.strikeHand = runtimeRoleLabels.strikeHand;
    attack1DebugState.counterHand = runtimeRoleLabels.counterHand;
    attack1DebugState.stepFoot = runtimeRoleLabels.stepFoot;
    attack1DebugState.braceFoot = runtimeRoleLabels.braceFoot;
    attack1DebugState.strikeVals = `${strikeHandX.toFixed(2)}, ${targetStrikeHandY.toFixed(2)}, ${(strikeHandZ + armDepthPush).toFixed(2)}`;
    attack1DebugState.counterVals = `${(counterHandHome.x + counterHandX).toFixed(2)}, ${(counterHandHome.y + targetCounterHandY).toFixed(2)}, ${(counterHandHome.z + counterHandZ).toFixed(2)}`;
    attack1DebugState.stepVals = `${(stepFootHome.x + stepFootX).toFixed(2)}, ${(stepFootHome.y + stepFootY).toFixed(2)}, ${(stepFootHome.z + stepFootZ).toFixed(2)}`;
    attack1DebugState.braceVals = `${(braceFootHome.x + braceFootX).toFixed(2)}, ${targetBraceFootY.toFixed(2)}, ${(braceFootHome.z + braceFootZ).toFixed(2)}`;
}
