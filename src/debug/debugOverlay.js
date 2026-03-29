export function renderAttack1DebugOverlay({ element, visible, toggleKey, debugState }) {
    element.style.display = visible ? 'block' : 'none';
    if (visible) {
        const status = debugState.active ? 'capturing attack pose' : 'idle';
        element.textContent =
`ATTACK 1 DEBUG
toggle: ${toggleKey}
status: ${status}
note: raw rig left/right names are inverted
rawMap: leftHand->anatomicalRightHand | rightHand->anatomicalLeftHand
rawMap: leftFoot->anatomicalRightFoot | rightFoot->anatomicalLeftFoot
colors: anatomicalLeftHand blue | anatomicalRightHand red | anatomicalLeftFoot green | anatomicalRightFoot yellow
hitboxes: player cyan | enemy pink
weaponParent: ${debugState.weaponParent || 'n/a'}
strikeHand: ${debugState.strikeHand || 'n/a'}
counterHand: ${debugState.counterHand || 'n/a'}
stepFoot: ${debugState.stepFoot || 'n/a'}
braceFoot: ${debugState.braceFoot || 'n/a'}
strikeVals: ${debugState.strikeVals || 'n/a'}
counterVals: ${debugState.counterVals || 'n/a'}
stepVals: ${debugState.stepVals || 'n/a'}
braceVals: ${debugState.braceVals || 'n/a'}`;
    }
}
