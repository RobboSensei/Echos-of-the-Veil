export function startLoop(frame) {
    function animate() {
        requestAnimationFrame(animate);
        frame();
    }

    animate();
}
