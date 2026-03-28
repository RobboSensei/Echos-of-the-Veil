import * as THREE from 'three';

// Shared context shape:
// { camera, cameraForward, moveAxis, playerModel, attackIntent, lastMoveWorld,
//   weaponPivot, anatomicalLeftHand, anatomicalRightHand, anatomicalLeftFoot,
//   anatomicalRightFoot, leftHand, rightHand, leftFoot, rightFoot,
//   debug: { attack1DebugValidated } }

export function getFlatCameraForward(context) {
    const { camera, cameraForward } = context;
    camera.getWorldDirection(cameraForward);
    cameraForward.y = 0;
    if (cameraForward.lengthSq() < 0.0001) cameraForward.set(0, 0, -1);
    return cameraForward.normalize();
}

export function getAttackIntent(context, worldMove) {
    const {
        attackIntent,
        lastMoveWorld,
        moveAxis,
        playerModel
    } = context;

    // mutates context.lastMoveWorld and context.attackIntent
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

export function rotateModelToward(context, direction, blend) {
    const { playerModel } = context;
    const targetYaw = Math.atan2(direction.x, direction.z);
    const delta = THREE.MathUtils.euclideanModulo(targetYaw - playerModel.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
    playerModel.rotation.y += delta * blend;
}

export function getWeaponParentLabel(context) {
    const { weaponPivot, anatomicalLeftHand, anatomicalRightHand } = context;
    if (weaponPivot.parent === anatomicalLeftHand) return 'anatomicalLeftHand';
    if (weaponPivot.parent === anatomicalRightHand) return 'anatomicalRightHand';
    return 'other';
}

export function validateAnatomicalCombatRig(context) {
    const {
        anatomicalLeftFoot,
        anatomicalLeftHand,
        anatomicalRightFoot,
        anatomicalRightHand,
        debug,
        leftFoot,
        leftHand,
        rightFoot,
        rightHand,
        weaponPivot
    } = context;

    if (debug.attack1DebugValidated) return;
    debug.attack1DebugValidated = true;
    if (
        anatomicalLeftHand !== rightHand ||
        anatomicalRightHand !== leftHand ||
        anatomicalLeftFoot !== rightFoot ||
        anatomicalRightFoot !== leftFoot
    ) {
        console.warn('[ATTACK 1 DEBUG] Anatomical mapping no longer matches the known inverted raw rig.');
    }
    if (weaponPivot.parent !== anatomicalLeftHand) {
        console.warn(`[ATTACK 1 DEBUG] Weapon parent drifted from anatomicalLeftHand. Current parent: ${getWeaponParentLabel(context)}`);
    }
}
