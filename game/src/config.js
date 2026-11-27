// Gobble Dash — the great turkey escape. Every tuning number in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720, groundY: 640 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** How far the turkey must run to reach the forest and escape. */
export const GOAL_M = 1500;
/** Pixels of scroll per metre. */
export const PX_PER_M = 48;

export const TURKEY = {
  x: 230,
  width: 64,
  height: 56,
  duckHeight: 34,
  jumpV: 980,
  gravity: 2600,
};

export const FARMER = {
  width: 58,
  height: 78,
  /** Gap (px) between farmer and turkey at the start of a run. */
  startGap: 150,
  /** Gap at which the farmer grabs the turkey. */
  catchGap: 10,
  /** How fast the farmer closes in when the turkey does nothing (px/s). */
  gain: 1.6,
  /** Gap lost on a stumble. */
  stumble: 48,
  /** Gap won back per corn cob. */
  cornGain: 5,
  /** Gap won back per dash. */
  dashGain: 12,
};

export const LIVES = 3;
export const MAX_LIVES = 3;

export const RUN = {
  baseSpeed: 330,
  /** Extra scroll px/s per metre of distance. */
  speedPerM: 0.21,
  maxSpeed: 640,
  dashMult: 1.6,
  dashTime: 0.5,
  dashCooldown: 4,
  invulnAfterHit: 1.5,
  featherTime: 3,
};

export const SCORE = { perMetre: 10, corn: 100, feather: 500, pie: 500, escaped: 1000 };

export const OBSTACLE = {
  fence: { w: 46, h: 64 },
  bale: { w: 66, h: 88 },
  branch: { w: 40, h: 64, top: 110 }, // hangs from y = groundY - top, bottom = groundY - 46
  oven: { w: 96, h: 76 },
  knife: { w: 16, h: 44 },
  puddle: { w: 120, h: 14 },
};

export const KNIFE_FALL = { speed: 950, stickTime: 1.4 };

export const PALETTE = {
  sky: [
    ['#ffd98a', '#ff9e5e'], // dawn
    ['#7ec8f7', '#cfeeff'], // midday
    ['#ff9a5c', '#c65d7b'], // dusk
    ['#1b2040', '#4a2b5e'], // night
  ],
  groundTop: '#7fb069',
  ground: '#8a5a33',
  dirt: '#6b4423',
  turkey: '#8a5230',
  turkeyDark: '#6b3d22',
  tail: ['#a0522d', '#d2691e', '#e8a33c', '#c0392b'],
  head: '#e8e0d0',
  wattle: '#e5534b',
  beak: '#f2a33c',
  farmerShirt: '#c0392b',
  farmerPants: '#2c4a7c',
  farmerHat: '#d9b36c',
  knife: '#d7dce3',
  knifeHandle: '#5a3a22',
  corn: '#f2c94c',
  feather: '#ffd94d',
  pie: '#b5651d',
  text: '#fff8e7',
  panel: 'rgba(20, 16, 10, 0.72)',
};

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'gobble-dash.best';
export const MUTE_KEY = 'gobble-dash.muted';
