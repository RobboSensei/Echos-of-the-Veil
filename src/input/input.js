export function createInput({ keys = {}, onKeyDown, onKeyUp } = {}) {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return { keys };

    function handleKeyDown(e) {
        keys[e.code] = true;
        if (onKeyDown) onKeyDown(e);
    }

    function handleKeyUp(e) {
        keys[e.code] = false;
        if (onKeyUp) onKeyUp(e);
    }
}
