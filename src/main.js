import { createGame } from './core/game.js';
import { startLoop } from './core/loop.js';
import { createRuntime } from './core/runtime.js';
import { createDeathScreen } from './ui/deathScreen.js';

const comboTag = document.getElementById('combo-tag');
const snapFill = document.getElementById('snap-fill');
const playerHpFill = document.getElementById('player-hp-fill');
const damageTint = document.getElementById('damage-tint');
const attack1DebugEl = document.getElementById('attack1-debug');

const runtime = createRuntime();
const deathScreen = createDeathScreen({
    onRestart: () => window.location.reload()
});
const game = createGame({
    runtime,
    dom: {
        comboTag,
        snapFill,
        playerHpFill,
        damageTint,
        attack1DebugEl,
        deathScreen
    }
});

startLoop(game.frame);
