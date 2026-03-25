export function renderAttack1DebugOverlay({ element, visible, toggleKey, debugState }) {
    element.style.display = visible ? 'block' : 'none';
    if (visible) {
        element.textContent =
`ATTACK 1 DEBUG
toggle: ${toggleKey}
note: raw rig left/right names are inverted
rawMap: leftHand->anatomicalRightHand | rightHand->anatomicalLeftHand
rawMap: leftFoot->anatomicalRightFoot | rightFoot->anatomicalLeftFoot
colors: anatomicalLeftHand blue | anatomicalRightHand red | anatomicalLeftFoot green | anatomicalRightFoot yellow
weaponParent: ${debugState.weaponParent}
strikeHand: ${debugState.strikeHand}
counterHand: ${debugState.counterHand}
stepFoot: ${debugState.stepFoot}
braceFoot: ${debugState.braceFoot}
strikeVals: ${debugState.strikeVals}
counterVals: ${debugState.counterVals}
stepVals: ${debugState.stepVals}
braceVals: ${debugState.braceVals}`;
    }
}
