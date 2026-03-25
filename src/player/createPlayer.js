import * as THREE from 'three';

export function createPlayer({ scene }) {
    const playerPivot = new THREE.Group();
    const playerModel = new THREE.Group();
    scene.add(playerPivot);
    playerPivot.add(playerModel);

    const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(0.6, 32),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    playerPivot.add(shadow);

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.0, 4, 8), new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 0.4 }));
    body.position.y = 1.0;
    playerModel.add(body);
    const bodyMat = body.material;
    const limbMat = bodyMat.clone();
    limbMat.emissiveIntensity = 0.34;
    limbMat.transparent = true;
    limbMat.opacity = 0.84;
    const handGeo = new THREE.SphereGeometry(0.16, 20, 16);
    const footGeo = new THREE.CapsuleGeometry(0.12, 0.12, 4, 12);
    const leftHand = new THREE.Mesh(handGeo, limbMat);
    const rightHand = new THREE.Mesh(handGeo, limbMat);
    const leftFoot = new THREE.Mesh(footGeo, limbMat);
    const rightFoot = new THREE.Mesh(footGeo, limbMat);
    leftHand.scale.set(0.84, 0.96, 1.02);
    rightHand.scale.set(0.92, 0.82, 1.22);
    leftFoot.rotation.x = Math.PI / 2;
    rightFoot.rotation.x = Math.PI / 2;
    leftFoot.scale.set(1.14, 0.66, 1.82);
    rightFoot.scale.copy(leftFoot.scale);
    playerModel.add(leftHand, rightHand, leftFoot, rightFoot);

    const BODY_HOME_Y = 1.0;
    const FOOT_BASE_ROT_X = Math.PI / 2;
    const EYE_L_HOME = new THREE.Vector3(0.2, 0.4, 0.45);
    const EYE_R_HOME = new THREE.Vector3(-0.2, 0.4, 0.45);
    const LEFT_HAND_HOME = new THREE.Vector3(-0.56, 0.98, 0.08);
    const RIGHT_HAND_HOME = new THREE.Vector3(0.44, 0.97, -0.07);
    const LEFT_HAND_IDLE = new THREE.Vector3(-0.58, 0.74, 0.03);
    const RIGHT_HAND_IDLE = new THREE.Vector3(0.63, 0.88, 0.14);
    const LEFT_FOOT_HOME = new THREE.Vector3(-0.24, 0.17, 0.12);
    const RIGHT_FOOT_HOME = new THREE.Vector3(0.24, 0.17, -0.02);
    leftHand.position.copy(LEFT_HAND_HOME);
    rightHand.position.copy(RIGHT_HAND_HOME);
    leftFoot.position.copy(LEFT_FOOT_HOME);
    rightFoot.position.copy(RIGHT_FOOT_HOME);

    // Source of truth: the legacy raw rig names are inverted relative to actual anatomy.
    // Combat/gameplay code must use these corrected anatomical references, not the raw names.
    // Keep raw leftHand/rightHand/leftFoot/rightFoot usage contained to this mapping layer.
    const anatomicalLeftHand = rightHand;
    const anatomicalRightHand = leftHand;
    const anatomicalLeftFoot = rightFoot;
    const anatomicalRightFoot = leftFoot;
    const ANATOMICAL_LEFT_HAND_HOME = RIGHT_HAND_HOME;
    const ANATOMICAL_RIGHT_HAND_HOME = LEFT_HAND_HOME;
    const ANATOMICAL_LEFT_HAND_IDLE = RIGHT_HAND_IDLE;
    const ANATOMICAL_RIGHT_HAND_IDLE = LEFT_HAND_IDLE;
    const ANATOMICAL_LEFT_FOOT_HOME = RIGHT_FOOT_HOME;
    const ANATOMICAL_RIGHT_FOOT_HOME = LEFT_FOOT_HOME;

    function makeLimbDebugMarker(color) {
        const marker = new THREE.Mesh(
            new THREE.SphereGeometry(0.095, 12, 12),
            new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false })
        );
        marker.renderOrder = 20;
        marker.visible = false;
        return marker;
    }

    const anatomicalLeftHandDebugMarker = makeLimbDebugMarker(0x3f7bff);
    const anatomicalRightHandDebugMarker = makeLimbDebugMarker(0xff4a4a);
    const anatomicalLeftFootDebugMarker = makeLimbDebugMarker(0x43ff66);
    const anatomicalRightFootDebugMarker = makeLimbDebugMarker(0xffeb3b);
    anatomicalLeftHand.add(anatomicalLeftHandDebugMarker);
    anatomicalRightHand.add(anatomicalRightHandDebugMarker);
    anatomicalLeftFoot.add(anatomicalLeftFootDebugMarker);
    anatomicalRightFoot.add(anatomicalRightFootDebugMarker);

    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    eyeL.position.copy(EYE_L_HOME);
    const eyeR = eyeL.clone();
    eyeR.position.copy(EYE_R_HOME);
    body.add(eyeL, eyeR);

    // WEAPON RIG
    const weaponPivot = new THREE.Group();
    weaponPivot.position.set(0.01, -0.01, 0.04);
    anatomicalLeftHand.add(weaponPivot);

    const sword = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 2.95), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff }));
    sword.position.z = 1.475;
    weaponPivot.add(sword);

    // Trail Markers
    const tip = new THREE.Object3D(); tip.position.z = 2.95; weaponPivot.add(tip);
    const base = new THREE.Object3D(); base.position.z = 0.08; weaponPivot.add(base);

    return {
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
    };
}
