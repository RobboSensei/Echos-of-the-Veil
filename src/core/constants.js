import * as THREE from 'three';

export const ATTACK_BUFFER = 0.18;

export const ATTACK_1_CONFIG = {
    activeStart: 0.36,
    activeEnd: 0.54,
    hitRange: 1.6,
    damage: 1.5,
    hitStun: 0.24,
    knockback: 6.5,
    trailOpacity: 0.58
};

export const ATTACK_1_VERTICAL_RANGE = 1.0;

export const ATTACK_2_CONFIG = {
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

export const ATTACK_1_WINDUP_END = 0.35;
export const ATTACK_1_STRIKE_END = 0.5;
export const ATTACK_1_END_T = 0.9;
export const ATTACK_1_CARRY_PEAK = 0.22;
export const ATTACK_1_BRIDGE_BLEND_TIME = 0.09;
export const ATTACK_1_BRIDGE_START_PROGRESS = 0.14;

export const PLAYER_MAX_HP = 5;
export const PLAYER_HURTBOX_RADIUS = 1.55;
export const ENEMY_HURTBOX_RADIUS = 0.5;
export const ENEMY_HURTBOX_HEIGHT = 0.5;

export const ROLL_DURATION = 0.36;
export const ROLL_COOLDOWN = 0.7;
export const ROLL_BUFFER_WINDOW = 0.1;

export const WEAPON_IDLE_X = 0.01;
export const WEAPON_IDLE_Y = -0.01;
export const WEAPON_IDLE_Z = 0.04;

export const playerBaseColor = new THREE.Color(0x00ffff);
export const playerHitColor = new THREE.Color(0xffffff);
export const enemyBaseColor = new THREE.Color(0xff4fd8);
export const enemyTelegraphColor = new THREE.Color(0xffd36b);
export const enemyLungeColor = new THREE.Color(0xff7a3d);
export const enemyHitColor = new THREE.Color(0xffffff);
