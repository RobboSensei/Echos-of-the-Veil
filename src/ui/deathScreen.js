function ensureDeathScreenStyles() {
    if (document.getElementById('death-screen-styles')) return;

    const style = document.createElement('style');
    style.id = 'death-screen-styles';
    style.textContent = `
        .death-screen {
            position: fixed;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(5, 7, 12, 0.76);
            backdrop-filter: blur(4px);
            opacity: 0;
            pointer-events: none;
            transition: opacity 160ms ease;
            z-index: 30;
        }

        .death-screen.is-visible {
            opacity: 1;
            pointer-events: auto;
        }

        .death-screen__panel {
            min-width: 320px;
            max-width: 420px;
            padding: 28px 26px;
            border: 1px solid rgba(255, 255, 255, 0.14);
            border-radius: 18px;
            background:
                linear-gradient(180deg, rgba(14, 21, 29, 0.96), rgba(8, 12, 17, 0.96));
            box-shadow:
                0 18px 48px rgba(0, 0, 0, 0.42),
                inset 0 1px 0 rgba(255, 255, 255, 0.06);
            text-align: center;
        }

        .death-screen__title {
            margin: 0 0 8px;
            font-size: 34px;
            letter-spacing: 0.08em;
            color: #f3f7fb;
        }

        .death-screen__subtitle {
            margin: 0 0 22px;
            font-size: 13px;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: rgba(201, 222, 234, 0.68);
        }

        .death-screen__actions {
            display: grid;
            gap: 12px;
        }

        .death-screen__button {
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 12px;
            padding: 14px 16px;
            background: rgba(20, 31, 40, 0.92);
            color: #f7fbff;
            font: inherit;
            letter-spacing: 0.04em;
        }

        .death-screen__button--stat {
            color: rgba(208, 233, 244, 0.9);
            cursor: default;
        }

        .death-screen__button--restart {
            cursor: pointer;
            background: linear-gradient(180deg, rgba(48, 106, 129, 0.98), rgba(26, 69, 88, 0.98));
            box-shadow: 0 10px 30px rgba(10, 36, 48, 0.38);
        }

        .death-screen__button--restart:hover {
            filter: brightness(1.08);
        }
    `;

    document.head.appendChild(style);
}

export function createDeathScreen({ onRestart }) {
    ensureDeathScreenStyles();
    let confirmHeld = false;

    const overlay = document.createElement('div');
    overlay.className = 'death-screen';

    const panel = document.createElement('div');
    panel.className = 'death-screen__panel';

    const title = document.createElement('h2');
    title.className = 'death-screen__title';
    title.textContent = 'Game Over';

    const subtitle = document.createElement('p');
    subtitle.className = 'death-screen__subtitle';
    subtitle.textContent = 'The Veil Closes';

    const actions = document.createElement('div');
    actions.className = 'death-screen__actions';

    const statButton = document.createElement('button');
    statButton.type = 'button';
    statButton.className = 'death-screen__button death-screen__button--stat';
    statButton.disabled = true;

    const restartButton = document.createElement('button');
    restartButton.type = 'button';
    restartButton.className = 'death-screen__button death-screen__button--restart';
    restartButton.textContent = 'Restart';
    restartButton.addEventListener('click', () => {
        if (onRestart) onRestart();
    });

    actions.append(statButton, restartButton);
    panel.append(title, subtitle, actions);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    function show({ defeatedEnemyCount = 0 } = {}) {
        statButton.textContent = `Enemies Defeated: ${defeatedEnemyCount}`;
        overlay.classList.add('is-visible');
        confirmHeld = false;
        restartButton.focus({ preventScroll: true });
    }

    function hide() {
        overlay.classList.remove('is-visible');
        confirmHeld = false;
    }

    function isVisible() {
        return overlay.classList.contains('is-visible');
    }

    function confirm() {
        if (!isVisible()) return;
        restartButton.click();
    }

    function update({ confirmPressed = false } = {}) {
        if (!isVisible()) {
            confirmHeld = false;
            return;
        }

        if (confirmPressed && !confirmHeld) {
            confirm();
        }

        confirmHeld = confirmPressed;
    }

    return {
        confirm,
        show,
        hide,
        isVisible,
        update
    };
}
