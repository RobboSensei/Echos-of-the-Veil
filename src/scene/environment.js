import * as THREE from 'three';

const FOG_COLOR = 0x121a22;
const FOG_DENSITY = 0.016;
const ARENA_RADIUS = 18;
const BASE_PLANE_SIZE = 240;
const TAU = Math.PI * 2;

const environmentState = {
    elapsed: 0,
    shardStates: [],
    veilMaterial: null,
    veilBaseEmissiveIntensity: 0
};

export function applySceneFog(scene) {
    scene.background = new THREE.Color(FOG_COLOR);
    scene.fog = new THREE.FogExp2(FOG_COLOR, FOG_DENSITY);
}

export function getSurfaceHeight(x, z) {
    return 0;
}

export function setupEnvironment(scene) {
    resetEnvironmentState();

    const environmentGroup = new THREE.Group();
    environmentGroup.name = 'environmentGroup';

    const materials = createMaterials();
    environmentState.veilMaterial = materials.veil;
    environmentState.veilBaseEmissiveIntensity = materials.veil.emissiveIntensity;
    addFillLight(environmentGroup);
    buildCombatFloor(environmentGroup, materials);
    buildBrokenPaths(environmentGroup, materials);
    buildStructuralForms(environmentGroup, materials);
    buildMidgroundRemnants(environmentGroup, materials);
    buildFarSilhouettes(environmentGroup, materials);

    scene.add(environmentGroup);

    return { environmentGroup };
}

export function updateEnvironment(delta) {
    if (!Number.isFinite(delta) || delta <= 0 || environmentState.shardStates.length === 0) {
        return;
    }

    environmentState.elapsed += delta;

    const t = environmentState.elapsed;

    if (environmentState.veilMaterial) {
        environmentState.veilMaterial.emissiveIntensity =
            environmentState.veilBaseEmissiveIntensity + Math.sin(t * 0.045 * TAU + 0.35) * 0.05;
    }

    for (const shardState of environmentState.shardStates) {
        const driftXTime = t * shardState.driftXFrequency * TAU;
        const driftYTime = t * shardState.driftFrequency * TAU;
        const driftZTime = t * shardState.driftZFrequency * TAU;

        shardState.mesh.position.x =
            shardState.baseX + Math.sin(driftXTime + shardState.phase * 1.07) * shardState.driftXAmplitude;

        shardState.mesh.position.y =
            shardState.baseY + Math.sin(driftYTime + shardState.phase) * shardState.driftAmplitude;

        shardState.mesh.position.z =
            shardState.baseZ + Math.cos(driftZTime + shardState.phase * 1.23) * shardState.driftZAmplitude;

        shardState.mesh.rotation.x =
            shardState.baseRotX +
            Math.sin(t * shardState.rotFreqX * TAU + shardState.phase * 0.97) * (shardState.rotSpeedX / shardState.rotFreqX);

        shardState.mesh.rotation.y =
            shardState.baseRotY +
            Math.cos(t * shardState.rotFreqY * TAU + shardState.phase * 1.19) * (shardState.rotSpeedY / shardState.rotFreqY);

        shardState.mesh.rotation.z =
            shardState.baseRotZ +
            Math.sin(t * shardState.rotFreqZ * TAU + shardState.phase * 1.41) * (shardState.rotSpeedZ / shardState.rotFreqZ);
    }
}

function resetEnvironmentState() {
    environmentState.elapsed = 0;
    environmentState.shardStates.length = 0;
    environmentState.veilMaterial = null;
    environmentState.veilBaseEmissiveIntensity = 0;
}

function createMaterials() {
    return {
        baseGround: new THREE.MeshStandardMaterial({
            color: 0x0f151c,
            roughness: 0.93,
            metalness: 0.02
        }),
        stage: new THREE.MeshStandardMaterial({
            color: 0x1e2832,
            roughness: 0.86,
            metalness: 0.05,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1
        }),
        overlay: new THREE.MeshStandardMaterial({
            color: 0x2a3642,
            roughness: 0.82,
            metalness: 0.06,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -2
        }),
        seam: new THREE.MeshStandardMaterial({
            color: 0x1b232c,
            roughness: 0.92,
            metalness: 0.03,
            polygonOffset: true,
            polygonOffsetFactor: -3,
            polygonOffsetUnits: -3
        }),
        outerDetail: new THREE.MeshStandardMaterial({
            color: 0x23303a,
            roughness: 0.88,
            metalness: 0.04,
            polygonOffset: true,
            polygonOffsetFactor: -2.4,
            polygonOffsetUnits: -2.4
        }),
        edgeShard: new THREE.MeshStandardMaterial({
            color: 0x26323d,
            roughness: 0.9,
            metalness: 0.04,
            flatShading: true
        }),
        stone: new THREE.MeshStandardMaterial({
            color: 0x33414e,
            roughness: 0.84,
            metalness: 0.06,
            flatShading: true
        }),
        silhouette: new THREE.MeshStandardMaterial({
            color: 0x232c37,
            roughness: 0.88,
            metalness: 0.03,
            flatShading: true
        }),
        veil: new THREE.MeshStandardMaterial({
            color: 0x7c8993,
            emissive: 0x2f6f78,
            emissiveIntensity: 0.48,
            roughness: 0.56,
            metalness: 0.1,
            flatShading: true
        })
    };
}

function addFillLight(environmentGroup) {
    const fillLight = new THREE.HemisphereLight(0x344454, 0x090c11, 0.14);
    fillLight.position.set(0, 30, 0);
    environmentGroup.add(fillLight);
}

function buildCombatFloor(environmentGroup, materials) {
    const floorGroup = new THREE.Group();
    floorGroup.name = 'combatFloor';

    const basePlane = new THREE.Mesh(
        new THREE.PlaneGeometry(BASE_PLANE_SIZE, BASE_PLANE_SIZE),
        materials.baseGround
    );
    basePlane.rotation.x = -Math.PI / 2;
    floorGroup.add(basePlane);

    const stageDisc = new THREE.Mesh(
        new THREE.CircleGeometry(ARENA_RADIUS, 64),
        materials.stage
    );
    stageDisc.rotation.x = -Math.PI / 2;
    stageDisc.position.y = 0;
    stageDisc.renderOrder = 1;
    floorGroup.add(stageDisc);

    buildStageEdgeFragments(floorGroup, materials);

    const ringConfigs = [
        { inner: 4.34, outer: 4.66, thetaStart: Math.PI * 0.12, thetaLength: Math.PI * 1.82 },
        { inner: 8.8, outer: 9.18, thetaStart: -Math.PI * 0.08, thetaLength: Math.PI * 1.68 },
        { inner: 13.2, outer: 13.8, thetaStart: Math.PI * 0.54, thetaLength: Math.PI * 1.78 }
    ];

    for (const config of ringConfigs) {
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(config.inner, config.outer, 64, 1, config.thetaStart, config.thetaLength),
            materials.overlay
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0;
        ring.renderOrder = 2;
        floorGroup.add(ring);
    }

    const seamConfigs = [
        { width: 0.22, length: 28, x: 0.0, z: 0.0, angle: 0.0 },
        { width: 0.22, length: 23, x: 0.0, z: 0.0, angle: Math.PI / 2 },
        { width: 0.18, length: 18, x: -1.4, z: 1.0, angle: Math.PI / 4 },
        { width: 0.18, length: 15, x: 1.2, z: -1.6, angle: -Math.PI / 4 }
    ];

    for (const config of seamConfigs) {
        const seam = new THREE.Mesh(
            new THREE.PlaneGeometry(config.width, config.length),
            materials.seam
        );
        seam.rotation.x = -Math.PI / 2;
        seam.rotation.z = config.angle;
        seam.position.set(config.x, 0, config.z);
        seam.renderOrder = 3;
        floorGroup.add(seam);
    }

    buildOuterAnnulusDetails(floorGroup, materials);

    environmentGroup.add(floorGroup);
}

function buildStageEdgeFragments(parent, materials) {
    const fragmentGroup = new THREE.Group();
    fragmentGroup.name = 'stageEdgeFragments';

    const fragmentConfigs = [
        { angle: -0.42, radius: 18.55, width: 3.8, depth: 1.8, rotation: 0.24 },
        { angle: 0.96, radius: 18.45, width: 3.3, depth: 1.5, rotation: -0.18 },
        { angle: 1.42, radius: 18.7, width: 3.9, depth: 1.9, rotation: 0.12 },
        { angle: 2.12, radius: 18.5, width: 3.4, depth: 1.6, rotation: -0.26 },
        { angle: 2.78, radius: 18.75, width: 4.2, depth: 1.7, rotation: 0.17 },
        { angle: -1.08, radius: 18.62, width: 3.5, depth: 1.4, rotation: -0.19 },
        { angle: -1.58, radius: 18.4, width: 3.0, depth: 1.5, rotation: 0.16 },
        { angle: -2.96, radius: 18.68, width: 4.0, depth: 1.9, rotation: -0.14 }
    ];

    for (const config of fragmentConfigs) {
        const fragment = new THREE.Mesh(
            new THREE.BoxGeometry(config.width, 0.08, config.depth),
            materials.edgeShard
        );
        fragment.position.set(
            Math.cos(config.angle) * config.radius,
            0.04,
            Math.sin(config.angle) * config.radius
        );
        fragment.rotation.y = config.angle + config.rotation;
        fragment.renderOrder = 1;
        fragmentGroup.add(fragment);
    }

    parent.add(fragmentGroup);
}

function buildOuterAnnulusDetails(parent, materials) {
    const detailGroup = new THREE.Group();
    detailGroup.name = 'outerAnnulusDetails';

    const sectorConfigs = [
        { inner: 14.7, outer: 15.18, thetaStart: 0.92, thetaLength: 0.58 },
        { inner: 15.85, outer: 16.36, thetaStart: 2.06, thetaLength: 0.62 },
        { inner: 16.65, outer: 17.24, thetaStart: -1.36, thetaLength: 0.52 }
    ];

    for (const config of sectorConfigs) {
        const sector = new THREE.Mesh(
            new THREE.RingGeometry(config.inner, config.outer, 48, 1, config.thetaStart, config.thetaLength),
            materials.outerDetail
        );
        sector.rotation.x = -Math.PI / 2;
        sector.position.y = 0.006;
        sector.renderOrder = 2;
        detailGroup.add(sector);
    }

    const sliverConfigs = [
        { width: 0.18, length: 3.6, angle: 1.18, radius: 15.55, rotation: 0.34 },
        { width: 0.14, length: 2.8, angle: 2.54, radius: 16.7, rotation: -0.28 },
        { width: 0.12, length: 3.1, angle: -1.1, radius: 16.15, rotation: 0.22 }
    ];

    for (const config of sliverConfigs) {
        const sliver = new THREE.Mesh(
            new THREE.PlaneGeometry(config.width, config.length),
            materials.outerDetail
        );
        sliver.rotation.x = -Math.PI / 2;
        sliver.rotation.z = config.angle + config.rotation;
        sliver.position.set(
            Math.cos(config.angle) * config.radius,
            0.008,
            Math.sin(config.angle) * config.radius
        );
        sliver.renderOrder = 2;
        detailGroup.add(sliver);
    }

    parent.add(detailGroup);
}

function buildBrokenPaths(environmentGroup, materials) {
    const pathGroup = new THREE.Group();
    pathGroup.name = 'brokenPaths';

    const eastPathSegments = [
        { width: 2.8, length: 8.0, x: 15.2, z: 5.8, angle: 0.26 },
        { width: 2.2, length: 6.4, x: 21.4, z: 6.8, angle: 0.26 },
        { width: 1.6, length: 4.6, x: 26.8, z: 7.8, angle: 0.29 }
    ];

    const northwestSegments = [
        { width: 2.5, length: 7.6, x: -11.8, z: -14.8, angle: -0.78 },
        { width: 2.0, length: 5.8, x: -16.8, z: -19.8, angle: -0.78 },
        { width: 1.3, length: 4.2, x: -20.8, z: -24.1, angle: -0.72 }
    ];

    addPathSegments(pathGroup, eastPathSegments, materials.overlay);
    addPathSegments(pathGroup, northwestSegments, materials.overlay);

    environmentGroup.add(pathGroup);
}

function addPathSegments(parent, segments, material) {
    for (const config of segments) {
        const slab = new THREE.Mesh(
            new THREE.PlaneGeometry(config.width, config.length),
            material
        );
        slab.rotation.x = -Math.PI / 2;
        slab.rotation.z = config.angle;
        slab.position.set(config.x, 0, config.z);
        slab.renderOrder = 2;
        parent.add(slab);
    }
}

function buildStructuralForms(environmentGroup, materials) {
    const structuresGroup = new THREE.Group();
    structuresGroup.name = 'structuralForms';

    structuresGroup.add(createMonolithCluster(materials));
    structuresGroup.add(createBrokenSpine(materials));
    structuresGroup.add(createVeilShardCluster(materials));

    environmentGroup.add(structuresGroup);
}

function createMonolithCluster(materials) {
    const group = new THREE.Group();
    group.name = 'monolithCluster';
    group.position.set(-18, 0, -12);

    const mainMonolith = new THREE.Mesh(
        new THREE.CylinderGeometry(0.9, 1.3, 10.5, 6),
        materials.stone
    );
    mainMonolith.position.set(-0.1, 5.25, -0.2);
    mainMonolith.rotation.set(0.05, -0.12, -0.14);
    mainMonolith.scale.set(0.96, 1.08, 0.93);
    group.add(mainMonolith);

    const sideMonolith = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 6.8, 1.0),
        materials.stone
    );
    sideMonolith.position.set(2.65, 3.28, -1.9);
    sideMonolith.rotation.set(-0.04, 0.31, 0.19);
    sideMonolith.scale.set(0.92, 1.03, 0.86);
    group.add(sideMonolith);

    const brokenBase = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 2.2, 1.6),
        materials.silhouette
    );
    brokenBase.position.set(-2.25, 1.0, 1.15);
    brokenBase.rotation.set(-0.05, -0.44, 0.24);
    brokenBase.scale.set(1.12, 0.92, 1.05);
    group.add(brokenBase);

    const fallenFragment = new THREE.Mesh(
        new THREE.BoxGeometry(1.45, 0.55, 0.9),
        materials.stone
    );
    fallenFragment.position.set(1.0, 0.28, 1.95);
    fallenFragment.rotation.set(0.06, 0.62, -0.17);
    group.add(fallenFragment);

    return group;
}

function createBrokenSpine(materials) {
    const group = new THREE.Group();
    group.name = 'brokenSpine';
    group.position.set(21, 0, -6);

    const tallSlab = new THREE.Mesh(
        new THREE.BoxGeometry(1.3, 8.2, 2.6),
        materials.stone
    );
    tallSlab.position.set(0.15, 4.12, -0.1);
    tallSlab.rotation.set(-0.04, -0.31, 0.31);
    tallSlab.scale.set(0.94, 1.05, 0.91);
    group.add(tallSlab);

    const rearSlab = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 5.6, 2.0),
        materials.silhouette
    );
    rearSlab.position.set(-2.05, 2.82, -1.9);
    rearSlab.rotation.set(0.03, 0.38, -0.24);
    rearSlab.scale.set(0.92, 1.08, 1.0);
    group.add(rearSlab);

    const stump = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 1.8, 2.1),
        materials.stone
    );
    stump.position.set(1.95, 0.88, 1.45);
    stump.rotation.set(0.0, 0.58, 0.07);
    stump.scale.set(1.06, 0.88, 0.98);
    group.add(stump);

    const fallenFragment = new THREE.Mesh(
        new THREE.BoxGeometry(1.55, 0.48, 0.95),
        materials.silhouette
    );
    fallenFragment.position.set(-0.55, 0.24, 1.95);
    fallenFragment.rotation.set(0.02, -0.36, -0.12);
    group.add(fallenFragment);

    return group;
}

function createVeilShardCluster(materials) {
    const group = new THREE.Group();
    group.name = 'veilShardCluster';
    group.position.set(8, 0, -20);

    const anchor = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 1.25, 3.8, 5),
        materials.silhouette
    );
    anchor.position.set(0.15, 1.9, -0.1);
    anchor.rotation.set(0.0, 0.16, -0.19);
    anchor.scale.set(0.98, 1.04, 0.92);
    group.add(anchor);

    const support = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 3.2, 1.1),
        materials.stone
    );
    support.position.set(-1.85, 1.52, 1.25);
    support.rotation.set(0.05, -0.42, 0.29);
    support.scale.set(0.93, 1.0, 0.88);
    group.add(support);

    const shardGeo = new THREE.OctahedronGeometry(0.72, 0);
    const shardConfigs = [
        {
            x: 0.95,
            y: 5.02,
            z: -0.45,
            scale: [0.92, 1.28, 0.88],
            rot: [0.18, 0.54, -0.27],
            phase: 0.15,
            driftAmplitude: 0.043,
            driftFrequency: 0.24,
            driftXAmplitude: 0.024,
            driftZAmplitude: 0.02,
            driftXFrequency: 0.15,
            driftZFrequency: 0.18,
            rotSpeedX: 0.0028,
            rotSpeedY: 0.0038,
            rotSpeedZ: 0.003,
            rotFreqX: 0.18,
            rotFreqY: 0.22,
            rotFreqZ: 0.16
        },
        {
            x: -0.35,
            y: 5.92,
            z: 1.05,
            scale: [0.62, 1.02, 0.6],
            rot: [-0.08, 0.18, 0.4],
            phase: 1.28,
            driftAmplitude: 0.052,
            driftFrequency: 0.2,
            driftXAmplitude: 0.032,
            driftZAmplitude: 0.027,
            driftXFrequency: 0.13,
            driftZFrequency: 0.16,
            rotSpeedX: 0.0034,
            rotSpeedY: 0.0049,
            rotSpeedZ: 0.0037,
            rotFreqX: 0.15,
            rotFreqY: 0.2,
            rotFreqZ: 0.17
        },
        {
            x: 1.85,
            y: 4.38,
            z: 1.08,
            scale: [0.52, 0.82, 0.48],
            rot: [0.28, -0.36, 0.14],
            phase: 2.34,
            driftAmplitude: 0.037,
            driftFrequency: 0.28,
            driftXAmplitude: 0.022,
            driftZAmplitude: 0.024,
            driftXFrequency: 0.17,
            driftZFrequency: 0.2,
            rotSpeedX: 0.0026,
            rotSpeedY: 0.0041,
            rotSpeedZ: 0.0029,
            rotFreqX: 0.21,
            rotFreqY: 0.24,
            rotFreqZ: 0.19
        },
        {
            x: -1.28,
            y: 4.72,
            z: -1.15,
            scale: [0.46, 0.72, 0.44],
            rot: [-0.2, 0.64, -0.15],
            phase: 3.18,
            driftAmplitude: 0.047,
            driftFrequency: 0.22,
            driftXAmplitude: 0.028,
            driftZAmplitude: 0.022,
            driftXFrequency: 0.14,
            driftZFrequency: 0.17,
            rotSpeedX: 0.003,
            rotSpeedY: 0.0044,
            rotSpeedZ: 0.0032,
            rotFreqX: 0.17,
            rotFreqY: 0.19,
            rotFreqZ: 0.15
        }
    ];

    for (const config of shardConfigs) {
        const shard = new THREE.Mesh(shardGeo, materials.veil);
        shard.position.set(config.x, config.y, config.z);
        shard.scale.set(config.scale[0], config.scale[1], config.scale[2]);
        shard.rotation.set(config.rot[0], config.rot[1], config.rot[2]);
        registerShardState(shard, config);
        group.add(shard);
    }

    return group;
}

function registerShardState(mesh, config) {
    environmentState.shardStates.push({
        mesh,
        baseX: config.x,
        baseY: config.y,
        baseZ: config.z,
        baseRotX: config.rot[0],
        baseRotY: config.rot[1],
        baseRotZ: config.rot[2],
        phase: config.phase,
        driftAmplitude: config.driftAmplitude,
        driftFrequency: config.driftFrequency,
        driftXAmplitude: config.driftXAmplitude,
        driftZAmplitude: config.driftZAmplitude,
        driftXFrequency: config.driftXFrequency,
        driftZFrequency: config.driftZFrequency,
        rotSpeedX: config.rotSpeedX,
        rotSpeedY: config.rotSpeedY,
        rotSpeedZ: config.rotSpeedZ,
        rotFreqX: config.rotFreqX,
        rotFreqY: config.rotFreqY,
        rotFreqZ: config.rotFreqZ
    });
}

function buildMidgroundRemnants(environmentGroup, materials) {
    const remnantGroup = new THREE.Group();
    remnantGroup.name = 'midgroundRemnants';

    const remnantConfigs = [
        {
            x: -25.5,
            z: -24.5,
            pieces: [
                { geometry: [1.8, 0.92, 1.1], position: [0.0, 0.46, 0.0], rotation: [0.03, 0.48, 0.08], material: materials.stone },
                { geometry: [1.1, 0.44, 0.8], position: [1.2, 0.22, -0.65], rotation: [0.0, -0.26, -0.05], material: materials.silhouette }
            ]
        },
        {
            x: 27.8,
            z: -13.5,
            pieces: [
                { geometry: [1.6, 1.08, 0.92], position: [0.0, 0.54, 0.0], rotation: [-0.02, -0.32, 0.06], material: materials.silhouette },
                { geometry: [1.0, 0.38, 1.2], position: [-1.1, 0.19, 0.72], rotation: [0.01, 0.41, -0.07], material: materials.stone }
            ]
        },
        {
            x: 10.5,
            z: -31.0,
            pieces: [
                { geometry: [1.4, 0.74, 1.05], position: [0.0, 0.37, 0.0], rotation: [0.04, 0.18, 0.05], material: materials.stone },
                { geometry: [0.92, 0.32, 0.72], position: [0.95, 0.16, -0.78], rotation: [0.0, -0.34, -0.05], material: materials.silhouette }
            ]
        }
    ];

    for (const config of remnantConfigs) {
        const group = new THREE.Group();
        group.position.set(config.x, 0, config.z);

        for (const piece of config.pieces) {
            const remnant = new THREE.Mesh(
                new THREE.BoxGeometry(piece.geometry[0], piece.geometry[1], piece.geometry[2]),
                piece.material
            );
            remnant.position.set(piece.position[0], piece.position[1], piece.position[2]);
            remnant.rotation.set(piece.rotation[0], piece.rotation[1], piece.rotation[2]);
            group.add(remnant);
        }

        remnantGroup.add(group);
    }

    environmentGroup.add(remnantGroup);
}

function buildFarSilhouettes(environmentGroup, materials) {
    const silhouetteGroup = new THREE.Group();
    silhouetteGroup.name = 'farSilhouettes';

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const configs = [
        { x: -58, z: -42, sx: 8, sy: 18, sz: 5, ry: 0.24, rz: -0.04 },
        { x: -46, z: -68, sx: 10, sy: 24, sz: 6, ry: -0.12, rz: 0.03 },
        { x: -74, z: -14, sx: 12, sy: 14, sz: 8, ry: 0.18, rz: -0.02 },
        { x: -64, z: 24, sx: 9, sy: 10, sz: 7, ry: -0.22, rz: 0.02 },
        { x: 42, z: -58, sx: 11, sy: 22, sz: 7, ry: 0.14, rz: 0.05 },
        { x: 62, z: -36, sx: 9, sy: 16, sz: 6, ry: -0.28, rz: -0.03 },
        { x: 78, z: 10, sx: 14, sy: 12, sz: 10, ry: 0.08, rz: 0.01 },
        { x: 18, z: -84, sx: 16, sy: 20, sz: 9, ry: -0.18, rz: 0.04 }
    ];

    const silhouettes = new THREE.InstancedMesh(geometry, materials.silhouette, configs.length);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const euler = new THREE.Euler();

    configs.forEach((config, index) => {
        position.set(config.x, config.sy * 0.5, config.z);
        euler.set(0, config.ry, config.rz);
        quaternion.setFromEuler(euler);
        scale.set(config.sx, config.sy, config.sz);
        matrix.compose(position, quaternion, scale);
        silhouettes.setMatrixAt(index, matrix);
    });

    silhouettes.instanceMatrix.needsUpdate = true;
    silhouetteGroup.add(silhouettes);
    environmentGroup.add(silhouetteGroup);
}
