// The screenshot scenes behind ?shot=start|play|caught|escaped. Each one plays the
// real rules forward from a fresh world, steered by a simple autopilot (jump the
// fence, bale, oven and stuck knife; slide under the branch; dash when the farmer
// gets too close), so the frame is what a real game looks like and the same seed
// always gives the same frame.
//
// The good pilot plans its jumps: a jump lasts T_JUMP seconds and the turkey's feet
// follow a parabola, so it only jumps when the parabola clears every obstacle in
// the jump window — including a knife that is about to land in it — and never
// jumps under a low branch.
import { FIELD, GOAL_M, STEP, TURKEY } from './config.js';
import { EVENT_CAUGHT, EVENT_ESCAPED } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 24;
const LIMIT_SECONDS = 420;

const JUMP_V = 980;
const GRAV = 2600;
const T_JUMP = (2 * JUMP_V) / GRAV;
const KNIFE_FALL_SPEED = 950;
const KNIFE_H = 44;

/** Feet height above the ground t seconds into a jump. */
function jumpHeight(t) {
  return JUMP_V * t - (GRAV / 2) * t * t;
}

function obstacleClearance(s, x, w, h, tIn, tOut) {
  if (tOut < 0 || tIn > T_JUMP) return true;
  const a = Math.max(0, tIn);
  const b = Math.min(T_JUMP, tOut);
  const hMin = Math.min(jumpHeight(a), jumpHeight(b));
  return hMin >= h - 3;
}

/** Would a jump started now clear everything in the jump window? */
export function jumpSafe(s) {
  const right = TURKEY.x + TURKEY.width;
  const speed = s.speed;
  for (const o of s.obstacles) {
    if (o.kind === 'puddle') continue;
    const tIn = (o.x - right) / speed;
    const tOut = (o.x + o.w - TURKEY.x) / speed;
    if (o.kind === 'branch') {
      // A jump rises straight into a low branch: never jump while one is in range.
      if (tOut >= 0 && tIn <= T_JUMP) return false;
      continue;
    }
    if (!obstacleClearance(s, o.x, o.w, o.h, tIn, tOut)) return false;
  }
  // A falling knife becomes a stuck knife where it lands; predict it.
  for (const k of s.falling) {
    const tLand = (FIELD.groundY - KNIFE_H - k.y) / KNIFE_FALL_SPEED;
    if (tLand < 0 || tLand > T_JUMP) continue;
    const xLand = k.x - speed * 0.4 * tLand;
    const tIn = tLand + (xLand - right) / speed;
    const tOut = tLand + (xLand + 16 - TURKEY.x) / speed;
    if (!obstacleClearance(s, xLand, 16, KNIFE_H, tIn, tOut)) return false;
  }
  return true;
}

function nearestThreat(s) {
  const tx = TURKEY.x + TURKEY.width;
  let best = null;
  for (const o of s.obstacles) {
    if (o.kind === 'puddle') continue;
    const d = o.x - tx;
    if (d < -40 || d > 520) continue;
    if (!best || d < best.d) best = { kind: o.kind, d, w: o.w };
  }
  for (const k of s.falling) {
    const d = k.x - tx;
    if (d < -40 || d > 520) continue;
    if (!best || d < best.d) best = { kind: 'knife-falling', d, w: 16 };
  }
  return best;
}

/** Good play: jump ground obstacles in time, duck branches, dash from the farmer. */
export function goodPilot(s) {
  const ctl = { jump: false, duck: false, dash: false };
  const t = s.turkey;
  // Duck while any low branch is under or just ahead of the turkey: keep
  // ducking until the branch has fully passed the turkey's left edge.
  for (const o of s.obstacles) {
    if (o.kind !== 'branch') continue;
    if (o.x + o.w > TURKEY.x && o.x < TURKEY.x + TURKEY.width + s.speed * 0.3) ctl.duck = true;
  }
  const threat = nearestThreat(s);
  if (threat) {
    if (threat.kind === 'branch') {
      if (threat.d < s.speed * 0.3) ctl.duck = true;
    } else if (t.onGround && threat.d < s.speed * 0.42 && jumpSafe(s)) {
      ctl.jump = true;
    }
  }
  if (s.gap < 55 && s.dashCd <= 0) ctl.dash = true;
  // Escape hatch: a threat too close to jump gets dashed through instead.
  if (threat && threat.kind !== 'branch' && threat.d < 70 && !jumpSafe(s) && s.dashCd <= 0 && t.onGround) {
    ctl.dash = true;
  }
  return ctl;
}

/** A hurried player: never jumps, never ducks, never dashes. */
function badPilot() {
  return { jump: false, duck: false, dash: false };
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the
 * best score to show. Unknown names stage the title.
 */
export function stageShot(name, world) {
  world.reset();
  const s = world.state;
  if (name !== 'play' && name !== 'caught' && name !== 'escaped') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, { jump: false, duck: false, dash: false }, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const pilot = name === 'caught' ? badPilot : goodPilot;
  const limit = name === 'escaped' ? LIMIT_SECONDS : PLAY_SECONDS;
  for (let i = 0; i < limit / STEP; i += 1) {
    const events = world.step(STEP, pilot(s), false);
    if (events & EVENT_CAUGHT) return { screen: SCREEN_OVER, best: s.score };
    if (events & EVENT_ESCAPED) return { screen: SCREEN_WIN, best: s.score };
  }
  // The play scene is a run in progress; the escaped scene should have finished.
  return { screen: SCREEN_PLAY, best: s.score };
}

export { FIELD, GOAL_M };
