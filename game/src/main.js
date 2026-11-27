// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, and the renderer paints what is there. The game moves between
// five screens: title, play, paused, caught and escaped.
//
// ?seed=N fixes the random pattern. ?shot=start|play|caught|escaped (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CAUGHT, EVENT_CORN, EVENT_DASH, EVENT_ESCAPED, EVENT_FEATHER, EVENT_HIT, EVENT_PIE } from './world.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';
import { ACTION_CONFIRM, ACTION_DASH, ACTION_JUMP, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import * as sfx from './audio.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, performance.now() / 1000);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Outrun the farmer!');
    sfx.gobble();
  }

  function endGame(caught) {
    screen = caught ? SCREEN_OVER : SCREEN_WIN;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (caught) {
      sfx.caught();
      announce(`Caught at ${Math.floor(world.state.distanceM)} metres. Score ${world.state.score}. Best ${best}.`);
    } else {
      sfx.escaped();
      announce(`Escaped! Score ${world.state.score}. Best ${best}.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = sfx.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    return actions;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    const ctl = {
      jump: Boolean(actions & ACTION_JUMP),
      duck: input.duckHeld(),
      dash: Boolean(actions & ACTION_DASH),
    };
    if (screen === SCREEN_TITLE) {
      while (accumulator >= STEP) {
        world.step(STEP, { jump: false, duck: false, dash: false }, true);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        const events = world.step(STEP, ctl, false);
        ctl.jump = false;
        ctl.dash = false;
        accumulator -= STEP;
        if (events & EVENT_HIT) {
          sfx.hit();
          announce(world.state.lives === 1 ? 'Hit. 1 life left.' : `Hit. ${world.state.lives} lives left.`);
        }
        if (events & EVENT_CORN) sfx.pickup();
        if (events & EVENT_FEATHER) sfx.feather();
        if (events & EVENT_PIE) sfx.pickup();
        if (events & EVENT_DASH) sfx.dash();
        if (events & EVENT_CAUGHT) {
          endGame(true);
          break;
        }
        if (events & EVENT_ESCAPED) {
          endGame(false);
          break;
        }
      }
      if (screen === SCREEN_PLAY) sfx.musicTick(now / 1000);
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, now / 1000);
  }

  // Leaving the tab pauses a running game rather than letting the farmer catch up unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Gobble Dash. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
