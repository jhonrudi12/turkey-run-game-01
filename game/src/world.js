// Gobble Dash rules and state, with no drawing and no browser in it: the turkey,
// the farmer closing in behind it, obstacles, falling carving knives, pickups,
// particles, distance to the forest and the win/lose conditions. step() advances
// one fixed step and returns what happened as bit flags.
import {
  FARMER, FIELD, GOAL_M, KNIFE_FALL, LIVES, MAX_LIVES, OBSTACLE, PX_PER_M,
  RUN, SCORE, TURKEY,
} from './config.js';

export const EVENT_HIT = 1;
export const EVENT_CORN = 2;
export const EVENT_FEATHER = 4;
export const EVENT_PIE = 8;
export const EVENT_CAUGHT = 16;
export const EVENT_ESCAPED = 32;
export const EVENT_DASH = 64;

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function hash(i) {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function createWorld(random) {
  const state = {
    score: 0, bonus: 0, lives: LIVES, distanceM: 0, elapsed: 0, speed: RUN.baseSpeed,
    scrollX: 0, gap: FARMER.startGap, dashCd: 0, dashTime: 0, invuln: 0, featherTime: 0,
    turkey: { y: FIELD.groundY, vy: 0, ducking: false, onGround: true, phase: 0 },
    farmerPhase: 0, obstacles: [], falling: [], pickups: [], particles: [],
    clouds: [], spawnTimer: 1, featherTimer: 38, pieTimer: 68, dustTimer: 0,
    over: null, shake: 0, msg: '', msgTime: 0, slow: false,
  };
  for (let i = 0; i < 6; i += 1) {
    state.clouds.push({ x: random() * FIELD.width, y: 40 + random() * 140, s: 0.6 + random() * 0.9, v: 10 + random() * 18 });
  }

  function turkeyRect() {
    // The turkey's y is its FEET, so ducking (a shorter body) never sinks it.
    const h = state.turkey.ducking ? TURKEY.duckHeight : TURKEY.height;
    return { x: TURKEY.x, y: state.turkey.y - h, w: TURKEY.width, h };
  }

  function addParticles(x, y, n, color, speed, up) {
    for (let i = 0; i < n; i += 1) {
      if (state.particles.length > 140) return;
      state.particles.push({
        x, y, vx: (random() - 0.5) * speed, vy: -random() * up,
        life: 0.5 + random() * 0.5, maxLife: 1, size: 2 + random() * 4, color,
      });
    }
  }

  function setMsg(text) {
    state.msg = text;
    state.msgTime = 1.6;
  }

  function spawnObstacle(kind, x) {
    const spec = OBSTACLE[kind];
    const ob = { kind, x, w: spec.w, h: spec.h, life: kind === 'knife' ? KNIFE_FALL.stickTime : Infinity };
    if (kind === 'branch') ob.y = FIELD.groundY - OBSTACLE.branch.top;
    else if (kind === 'puddle') ob.y = FIELD.groundY - spec.h;
    else ob.y = FIELD.groundY - spec.h;
    state.obstacles.push(ob);
    return ob;
  }

  function spawnCornArc(cx, topY) {
    const ys = [topY + 40, topY, topY + 40];
    for (let i = 0; i < 3; i += 1) {
      state.pickups.push({ kind: 'corn', x: cx - 44 + i * 44, y: ys[i], w: 26, h: 26, bob: random() * 6 });
    }
  }

  function spawnFeature() {
    const p = Math.min(1, state.distanceM / GOAL_M);
    // Keep every new feature a fair jump away from the rightmost hazard already
    // on screen (a falling knife counts at its landing spot): a jump covers
    // ~255 px, so 430 px of room always leaves a landing zone.
    let rightmost = 0;
    for (const o of state.obstacles) rightmost = Math.max(rightmost, o.x + o.w);
    for (const k of state.falling) rightmost = Math.max(rightmost, k.x);
    const x = Math.max(FIELD.width + 40 + random() * 120, rightmost + 430);
    const roll = random();
    if (roll < 0.2) {
      const ob = spawnObstacle('fence', x);
      if (random() < 0.45) spawnCornArc(ob.x + ob.w / 2 - 13, FIELD.groundY - 190);
    } else if (roll < 0.36) {
      const ob = spawnObstacle('bale', x);
      if (random() < 0.45) spawnCornArc(ob.x + ob.w / 2 - 13, FIELD.groundY - 210);
    } else if (roll < 0.5) {
      spawnObstacle('branch', x);
    } else if (roll < 0.62) {
      const ob = spawnObstacle('oven', x);
      if (random() < 0.4) spawnCornArc(ob.x + ob.w / 2 - 13, FIELD.groundY - 200);
    } else if (roll < 0.72) {
      spawnObstacle('puddle', x);
    } else if (roll < 0.86) {
      // Knives fall at the right edge, like every other hazard, so they land a
      // fair distance ahead of the turkey instead of on top of it.
      const n = 1 + Math.floor(random() * (p > 0.4 ? 3 : 2));
      for (let i = 0; i < n; i += 1) {
        state.falling.push({ x: x + i * 90, y: -90 - i * 70, vy: KNIFE_FALL.speed });
      }
    } else {
      for (let i = 0; i < 4; i += 1) {
        state.pickups.push({ kind: 'corn', x: x + i * 52, y: FIELD.groundY - 34 - (i % 2) * 44, w: 26, h: 26, bob: random() * 6 });
      }
    }
    // A second, spaced obstacle keeps late game busy but always jumpable.
    if (p > 0.35 && random() < 0.4) spawnObstacle(random() < 0.5 ? 'fence' : 'branch', x + 420 + random() * 140);
  }

  function reset() {
    state.score = 0;
    state.bonus = 0;
    state.lives = LIVES;
    state.distanceM = 0;
    state.elapsed = 0;
    state.scrollX = 0;
    state.speed = RUN.baseSpeed;
    state.gap = FARMER.startGap;
    state.dashCd = 0;
    state.dashTime = 0;
    state.invuln = 0;
    state.featherTime = 0;
    state.turkey.y = FIELD.groundY;
    state.turkey.vy = 0;
    state.turkey.ducking = false;
    state.turkey.onGround = true;
    state.obstacles = [];
    state.falling = [];
    state.pickups = [];
    state.particles = [];
    state.spawnTimer = 1;
    state.featherTimer = 38;
    state.pieTimer = 68;
    state.over = null;
    state.shake = 0;
    state.msg = '';
    state.msgTime = 0;
  }

  function step(dt, ctl, harmless) {
    let events = 0;
    if (state.over) return events;
    state.elapsed += dt;
    const p = Math.min(1, state.distanceM / GOAL_M);
    const t = state.turkey;

    // Dash: a burst of speed, brief invulnerability, and room from the farmer.
    if (ctl.dash && state.dashCd <= 0 && !harmless) {
      state.dashTime = RUN.dashTime;
      state.dashCd = RUN.dashCooldown;
      state.gap = Math.min(170, state.gap + FARMER.dashGain);
      state.invuln = Math.max(state.invuln, 0.6);
      events |= EVENT_DASH;
      addParticles(TURKEY.x + 10, FIELD.groundY - 8, 10, '#d8cbb0', 260, 60);
    }
    if (state.dashTime > 0) state.dashTime -= dt;
    if (state.dashCd > 0) state.dashCd -= dt;
    if (state.invuln > 0) state.invuln -= dt;
    if (state.featherTime > 0) state.featherTime -= dt;
    if (state.msgTime > 0) state.msgTime -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 2);

    // Jump / duck.
    t.ducking = ctl.duck && t.onGround;
    if (ctl.jump && t.onGround) {
      t.vy = -TURKEY.jumpV;
      t.onGround = false;
      t.ducking = false;
    }
    t.vy += TURKEY.gravity * dt;
    t.y += t.vy * dt;
    if (t.y >= FIELD.groundY) {
      t.y = FIELD.groundY;
      t.vy = 0;
      t.onGround = true;
    } else t.onGround = false;
    t.phase += dt * (t.onGround ? state.speed / 34 : 6);

    // Scroll speed, with mud slowing the turkey down.
    const rect = turkeyRect();
    state.slow = state.obstacles.some((o) => o.kind === 'puddle' && o.x < rect.x + rect.w && o.x + o.w > rect.x && t.onGround);
    let speed = Math.min(RUN.maxSpeed, RUN.baseSpeed + state.distanceM * RUN.speedPerM);
    if (state.slow) speed *= 0.55;
    if (state.dashTime > 0) speed *= RUN.dashMult;
    state.speed = speed;
    state.scrollX += speed * dt;
    state.distanceM = state.scrollX / PX_PER_M;

    // The farmer never stops closing in.
    if (!harmless) {
      state.gap -= FARMER.gain * dt;
      if (state.gap <= FARMER.catchGap) {
        state.over = 'caught';
        return EVENT_CAUGHT;
      }
    }
    state.farmerPhase += dt * (speed / 40);

    // Spawning.
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnFeature();
      state.spawnTimer = (1.05 + random() * 0.55) * (1 - 0.25 * p);
    }
    state.featherTimer -= dt;
    if (state.featherTimer <= 0) {
      state.pickups.push({ kind: 'feather', x: FIELD.width + 60, y: FIELD.groundY - 210, w: 30, h: 30, bob: 0 });
      state.featherTimer = 45;
    }
    state.pieTimer -= dt;
    if (state.pieTimer <= 0) {
      state.pickups.push({ kind: 'pie', x: FIELD.width + 60, y: FIELD.groundY - 30, w: 30, h: 26, bob: 0 });
      state.pieTimer = 80;
    }

    // Move everything left with the world.
    const dx = speed * dt;
    for (const o of state.obstacles) o.x -= dx;
    for (const pk of state.pickups) pk.x -= dx;
    for (const c of state.clouds) {
      c.x -= c.v * dt;
      if (c.x < -160) {
        c.x = FIELD.width + random() * 120;
        c.y = 40 + random() * 140;
      }
    }
    state.obstacles = state.obstacles.filter((o) => o.x + o.w > -80 && (o.life === Infinity || (o.life -= dt) > 0));
    state.pickups = state.pickups.filter((pk) => pk.x + pk.w > -60);

    // Falling knives: telegraph, fall, stick in the dirt as an obstacle.
    for (let i = state.falling.length - 1; i >= 0; i -= 1) {
      const k = state.falling[i];
      k.y += k.vy * dt;
      k.x -= dx * 0.4;
      if (k.y >= FIELD.groundY - OBSTACLE.knife.h) {
        state.falling.splice(i, 1);
        spawnObstacle('knife', k.x);
      }
    }

    // Dust while running, embers from ovens, fireflies late in the run.
    state.dustTimer -= dt;
    if (state.dustTimer <= 0 && t.onGround) {
      state.dustTimer = 0.09;
      state.particles.push({
        x: TURKEY.x + 8, y: FIELD.groundY - 4, vx: -60 - random() * 60, vy: -20 - random() * 30,
        life: 0.4, maxLife: 0.4, size: 3 + random() * 3, color: '#cbb98f',
      });
    }
    if (p > 0.7 && random() < dt * 6) {
      state.particles.push({
        x: 200 + random() * 1000, y: 380 + random() * 220, vx: (random() - 0.5) * 20, vy: -8 - random() * 14,
        life: 1.6, maxLife: 1.6, size: 2.5, color: '#ffe98a',
      });
    }
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 30 * dt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }

    if (harmless) return events;

    // Collisions with obstacles.
    for (let i = state.obstacles.length - 1; i >= 0; i -= 1) {
      const o = state.obstacles[i];
      if (o.kind === 'puddle') continue;
      // A few forgiving pixels: the drawing is chunkier than the hitbox.
      const ob = { x: o.x + 4, y: o.y + 3, w: o.w - 8, h: o.h - 3 };
      if (!overlaps(rect, ob)) continue;
      if (state.featherTime > 0) {
        // Golden feather power: smash straight through.
        state.obstacles.splice(i, 1);
        state.bonus += 50;
        addParticles(o.x + o.w / 2, o.y + 10, 8, '#ffd94d', 300, 160);
        continue;
      }
      if (state.invuln > 0) continue;
      state.obstacles.splice(i, 1);
      state.lives -= 1;
      state.gap = Math.max(0, state.gap - FARMER.stumble);
      state.invuln = RUN.invulnAfterHit;
      state.shake = 0.45;
      events |= EVENT_HIT;
      addParticles(TURKEY.x + 30, t.y - 30, 12, '#e8e0d0', 340, 220);
      if (state.lives <= 0) {
        state.over = 'caught';
        return events | EVENT_CAUGHT;
      }
    }

    // Pickups.
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const pk = state.pickups[i];
      const pr = { x: pk.x - 8, y: pk.y - 8, w: pk.w + 16, h: pk.h + 16 };
      if (!overlaps(rect, pr)) continue;
      state.pickups.splice(i, 1);
      if (pk.kind === 'corn') {
        state.bonus += SCORE.corn;
        state.gap = Math.min(170, state.gap + FARMER.cornGain);
        events |= EVENT_CORN;
        addParticles(pk.x + 13, pk.y + 13, 6, '#f2c94c', 200, 120);
      } else if (pk.kind === 'feather') {
        state.bonus += SCORE.feather;
        state.featherTime = RUN.featherTime;
        events |= EVENT_FEATHER;
        setMsg('GOLDEN FEATHER — unstoppable!');
      } else {
        if (state.lives < MAX_LIVES) {
          state.lives += 1;
          setMsg('Pumpkin pie — +1 life!');
        } else state.bonus += SCORE.pie;
        events |= EVENT_PIE;
      }
    }

    // Score and the win.
    state.score = Math.floor(state.distanceM) * SCORE.perMetre + state.bonus;
    if (state.distanceM >= GOAL_M) {
      state.over = 'escaped';
      state.bonus += SCORE.escaped;
      state.score = Math.floor(state.distanceM) * SCORE.perMetre + state.bonus;
      return events | EVENT_ESCAPED;
    }
    return events;
  }

  reset();
  return { state, reset, step, turkeyRect, hash };
}
