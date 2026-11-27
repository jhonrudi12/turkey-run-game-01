// Keyboard and pointer input. One-shot presses (jump, dash, pause, mute, confirm)
// are queued as bit flags and taken once by the loop, so a press between two frames
// is never lost and never counted twice. Duck is a held state.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DASH = 4;
export const ACTION_MUTE = 8;
export const ACTION_JUMP = 16;

const JUMP = new Set(['Space', 'ArrowUp', 'KeyW', 'Enter']);
const DUCK = new Set(['ArrowDown', 'KeyS']);
const DASH = new Set(['ShiftLeft', 'ShiftRight', 'KeyX']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  let actions = 0;
  let duck = false;

  window.addEventListener('keydown', (event) => {
    if (JUMP.has(event.code)) {
      if (!event.repeat) actions |= ACTION_JUMP | ACTION_CONFIRM;
    } else if (DUCK.has(event.code)) {
      duck = true;
    } else if (DASH.has(event.code)) {
      if (!event.repeat) actions |= ACTION_DASH;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (DUCK.has(event.code)) duck = false;
  });
  window.addEventListener('blur', () => {
    duck = false;
  });
  target.addEventListener('pointerdown', () => {
    actions |= ACTION_JUMP | ACTION_CONFIRM;
  });

  return {
    duckHeld() {
      return duck;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
