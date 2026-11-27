// Every pixel of Gobble Dash, drawn with canvas vector art: no image files, no
// network. The farm scrolls past in parallax layers while the day turns to night
// as the turkey nears the forest.
import { FARMER, FIELD, GOAL_M, LIVES, PALETTE, RUN, TURKEY } from './config.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;
export const SCREEN_WIN = 4;

function hex(rgb) {
  return [parseInt(rgb.slice(1, 3), 16), parseInt(rgb.slice(3, 5), 16), parseInt(rgb.slice(5, 7), 16)];
}
function mix(a, b, t) {
  const A = hex(a);
  const B = hex(b);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
}
function skyAt(p) {
  const stops = PALETTE.sky;
  const f = Math.min(0.999, p) * (stops.length - 1);
  const i = Math.floor(f);
  const t = f - i;
  return [mix(stops[i][0], stops[i + 1][0], t), mix(stops[i][1], stops[i + 1][1], t)];
}

function ridge(ctx, baseY, amp, color, scroll, period, phase) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, FIELD.height);
  for (let x = 0; x <= FIELD.width; x += 16) {
    const wx = x + scroll;
    ctx.lineTo(x, baseY + Math.sin(wx / period + phase) * amp + Math.sin(wx / (period * 0.37) + phase * 2) * amp * 0.4);
  }
  ctx.lineTo(FIELD.width, FIELD.height);
  ctx.closePath();
  ctx.fill();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function drawSky(s, time) {
    const p = Math.min(1, s.distanceM / GOAL_M);
    const [top, bot] = skyAt(p);
    const g = ctx.createLinearGradient(0, 0, 0, FIELD.groundY);
    g.addColorStop(0, top);
    g.addColorStop(1, bot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.width, FIELD.groundY);
    // Stars come out late in the run.
    if (p > 0.62) {
      const a = Math.min(1, (p - 0.62) * 3);
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      for (let i = 0; i < 70; i += 1) {
        const sx = (i * 173.3) % FIELD.width;
        const sy = (i * 97.7) % 300;
        const tw = 0.5 + 0.5 * Math.sin(time * 2 + i);
        ctx.globalAlpha = a * tw;
        ctx.fillRect(sx, sy, 2, 2);
      }
      ctx.globalAlpha = 1;
    }
    // Sun by day, moon by night.
    if (p < 0.78) {
      const sx = 120 + p * 980;
      const sy = 150 - Math.sin(p * Math.PI) * 70;
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.arc(sx, sy, 42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,217,77,0.25)';
      ctx.beginPath();
      ctx.arc(sx, sy, 62, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#f4f1de';
      ctx.beginPath();
      ctx.arc(1080, 110, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(180,180,200,0.5)';
      ctx.beginPath();
      ctx.arc(1068, 102, 8, 0, Math.PI * 2);
      ctx.arc(1092, 122, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Clouds.
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const c of s.clouds) {
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, 52 * c.s, 20 * c.s, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x + 30 * c.s, c.y + 6 * c.s, 34 * c.s, 15 * c.s, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x - 32 * c.s, c.y + 7 * c.s, 30 * c.s, 13 * c.s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawFarm(s) {
    const p = Math.min(1, s.distanceM / GOAL_M);
    const scroll = s.scrollX;
    const dusk = p > 0.45 && p < 0.8;
    ridge(ctx, 560, 26, dusk ? '#7a5a78' : '#8fae6b', scroll * 0.25, 420, 1.2);
    ridge(ctx, 600, 20, dusk ? '#5f4a68' : '#6f9a55', scroll * 0.45, 300, 4.1);
    // Barn and silo, every 2600 world px.
    const barnX = 2600 - ((scroll * 0.55) % 2600);
    for (const bx of [barnX - 2600, barnX]) {
      if (bx < -260 || bx > FIELD.width + 60) continue;
      ctx.fillStyle = '#a63a2e';
      ctx.fillRect(bx, 500, 170, 140);
      ctx.fillStyle = '#7e2a20';
      ctx.beginPath();
      ctx.moveTo(bx - 8, 502);
      ctx.lineTo(bx + 85, 440);
      ctx.lineTo(bx + 178, 502);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fff2d8';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(bx + 85, 540);
      ctx.lineTo(bx + 85, 600);
      ctx.moveTo(bx + 55, 570);
      ctx.lineTo(bx + 115, 570);
      ctx.stroke();
      ctx.fillStyle = '#b8c4cc';
      ctx.fillRect(bx + 185, 470, 52, 170);
      ctx.fillStyle = '#8d9aa3';
      ctx.beginPath();
      ctx.ellipse(bx + 211, 470, 26, 14, 0, Math.PI, 0);
      ctx.fill();
    }
    // Trees, every ~700 world px, hash-varied.
    for (let i = 0; i < 4; i += 1) {
      const wx = i * 700 + Math.floor(((Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1 * 260);
      let tx = wx - ((scroll * 0.8) % 2800);
      if (tx < -120) tx += 2800;
      if (tx > FIELD.width + 40) continue;
      ctx.fillStyle = '#5d3a1e';
      ctx.fillRect(tx, 560, 14, 80);
      ctx.fillStyle = dusk ? '#4a5e3a' : '#3f7a34';
      ctx.beginPath();
      ctx.arc(tx + 7, 530, 46, 0, Math.PI * 2);
      ctx.arc(tx - 26, 556, 30, 0, Math.PI * 2);
      ctx.arc(tx + 34, 556, 32, 0, Math.PI * 2);
      ctx.fill();
    }
    // Fence posts whipping past.
    ctx.fillStyle = '#7a5230';
    const off = scroll * 0.95 % 90;
    for (let x = -off; x < FIELD.width; x += 90) {
      ctx.fillRect(x, FIELD.groundY - 44, 8, 44);
    }
    ctx.fillRect(0, FIELD.groundY - 34, FIELD.width, 6);
    // Ground.
    const gg = ctx.createLinearGradient(0, FIELD.groundY, 0, FIELD.height);
    gg.addColorStop(0, PALETTE.groundTop);
    gg.addColorStop(0.18, PALETTE.ground);
    gg.addColorStop(1, PALETTE.dirt);
    ctx.fillStyle = gg;
    ctx.fillRect(0, FIELD.groundY, FIELD.width, FIELD.height - FIELD.groundY);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let i = 0; i < 26; i += 1) {
      const gx = ((i * 211 + Math.floor(scroll)) % 1400) - 60;
      ctx.fillRect(gx, FIELD.groundY + 26 + (i * 37) % 44, 26, 4);
    }
    // Grass tufts.
    ctx.strokeStyle = '#5d8a4a';
    ctx.lineWidth = 2;
    for (let i = 0; i < 30; i += 1) {
      const gx = ((i * 173 + Math.floor(scroll * 1.2)) % 1360) - 40;
      ctx.beginPath();
      ctx.moveTo(gx, FIELD.groundY);
      ctx.lineTo(gx - 4, FIELD.groundY - 9);
      ctx.moveTo(gx + 4, FIELD.groundY);
      ctx.lineTo(gx + 8, FIELD.groundY - 8);
      ctx.stroke();
    }
  }

  function drawTurkey(s, time) {
    const t = s.turkey;
    const h = t.ducking ? TURKEY.duckHeight : TURKEY.height;
    const x = TURKEY.x;
    const y = t.y; // feet
    if (s.invuln > 0 && Math.floor(time * 12) % 2 === 0 && s.featherTime <= 0) return; // blink
    ctx.save();
    ctx.translate(x + TURKEY.width / 2, y);
    if (s.featherTime > 0) {
      ctx.shadowColor = '#ffd94d';
      ctx.shadowBlur = 22;
    }
    const run = Math.sin(t.phase * 2);
    const air = !t.onGround;
    // Tail fan.
    ctx.fillStyle = PALETTE.tail[0];
    for (let i = -2; i <= 2; i += 1) {
      ctx.save();
      ctx.translate(-26, -h + 16);
      ctx.rotate(i * 0.34 + (air ? -0.25 : run * 0.03));
      ctx.fillStyle = PALETTE.tail[Math.abs(i) % PALETTE.tail.length];
      ctx.beginPath();
      ctx.ellipse(-8, -14, 7, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Legs.
    ctx.strokeStyle = '#f2a33c';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    const legSwing = air ? 14 : run * 12;
    ctx.beginPath();
    ctx.moveTo(-6, -8);
    ctx.lineTo(-6 + legSwing, 0);
    ctx.moveTo(8, -8);
    ctx.lineTo(8 - legSwing, 0);
    ctx.stroke();
    // Body.
    ctx.fillStyle = PALETTE.turkey;
    ctx.beginPath();
    ctx.ellipse(2, -h / 2 - 2, 34, h / 2, t.ducking ? -0.12 : -0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.turkeyDark;
    ctx.beginPath();
    ctx.ellipse(-4, -h / 2 + 8, 22, h / 2 - 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Wing.
    const flap = air ? -0.9 + Math.sin(time * 18) * 0.35 : run * 0.12;
    ctx.save();
    ctx.translate(0, -h / 2 - 4);
    ctx.rotate(flap);
    ctx.fillStyle = '#7a4526';
    ctx.beginPath();
    ctx.ellipse(-6, 0, 20, 10, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Head and neck.
    const hx = t.ducking ? 30 : 26;
    const hy = t.ducking ? -h + 12 : -h - 6;
    ctx.fillStyle = PALETTE.turkey;
    ctx.fillRect(hx - 8, hy - 2, 10, 18);
    ctx.fillStyle = PALETTE.head;
    ctx.beginPath();
    ctx.arc(hx + 4, hy - 4, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(hx + 8, hy - 6, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.beak;
    ctx.beginPath();
    ctx.moveTo(hx + 12, hy - 5);
    ctx.lineTo(hx + 24, hy - 1);
    ctx.lineTo(hx + 12, hy + 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.wattle;
    ctx.beginPath();
    ctx.ellipse(hx + 10, hy + 6, 4, 7, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawFarmer(s, time) {
    const fx = TURKEY.x - s.gap - FARMER.width;
    if (fx < -90) return;
    const bob = Math.sin(s.farmerPhase * 2) * 3;
    const close = s.gap < 55;
    ctx.save();
    ctx.translate(fx + FARMER.width / 2, FIELD.groundY + bob * 0.4);
    // Legs.
    ctx.strokeStyle = '#2c2c34';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    const sw = Math.sin(s.farmerPhase * 2) * 14;
    ctx.beginPath();
    ctx.moveTo(-8, -26);
    ctx.lineTo(-8 + sw, 0);
    ctx.moveTo(8, -26);
    ctx.lineTo(8 - sw, 0);
    ctx.stroke();
    // Body: overalls and shirt.
    ctx.fillStyle = PALETTE.farmerPants;
    ctx.fillRect(-14, -52, 28, 28);
    ctx.fillStyle = PALETTE.farmerShirt;
    ctx.fillRect(-15, -72, 30, 22);
    // Arm reaching with the pitchfork when close, else pumping.
    ctx.strokeStyle = '#e8b88a';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(10, -66);
    ctx.lineTo(close ? 34 : 22, close ? -58 : -44);
    ctx.stroke();
    ctx.strokeStyle = '#8a6a42';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(close ? 34 : 22, close ? -58 : -44);
    ctx.lineTo(close ? 52 : 34, -108);
    ctx.stroke();
    ctx.strokeStyle = '#c9ced6';
    ctx.lineWidth = 3;
    for (const dx of [-4, 0, 4]) {
      ctx.beginPath();
      ctx.moveTo((close ? 52 : 34) + dx, -108);
      ctx.lineTo((close ? 56 : 36) + dx, -122);
      ctx.stroke();
    }
    // Head, beard, straw hat.
    ctx.fillStyle = '#e8b88a';
    ctx.beginPath();
    ctx.arc(2, -80, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8e0d0';
    ctx.beginPath();
    ctx.arc(4, -72, 8, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = PALETTE.farmerHat;
    ctx.beginPath();
    ctx.ellipse(2, -88, 20, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-8, -100, 20, 12);
    ctx.restore();
    if (close) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px ' + '"Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('COME BACK HERE!', fx + 30, FIELD.groundY - 130);
    }
  }

  function drawObstacles(s, time) {
    for (const o of s.obstacles) {
      if (o.kind === 'fence') {
        ctx.fillStyle = '#8a5a2e';
        ctx.fillRect(o.x, o.y, 8, o.h);
        ctx.fillRect(o.x + o.w - 8, o.y, 8, o.h);
        ctx.fillStyle = '#a06a35';
        ctx.fillRect(o.x - 4, o.y + 12, o.w + 8, 9);
        ctx.fillRect(o.x - 4, o.y + 32, o.w + 8, 9);
      } else if (o.kind === 'bale') {
        ctx.fillStyle = '#d9a441';
        ctx.beginPath();
        ctx.ellipse(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, o.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#b57f22';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(o.x + o.w / 2, o.y + o.h / 2, o.w / 2 - 9, o.h / 2 - 9, 0, 0, Math.PI * 2);
        ctx.ellipse(o.x + o.w / 2, o.y + o.h / 2, o.w / 2 - 18, o.h / 2 - 18, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (o.kind === 'branch') {
        ctx.strokeStyle = '#5d3a1e';
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(o.x - 14, 0);
        ctx.lineTo(o.x + o.w / 2, o.y + 10);
        ctx.lineTo(o.x + o.w + 14, 0);
        ctx.stroke();
        ctx.fillStyle = '#3f7a34';
        for (const [lx, ly] of [[o.x + 4, o.y + 22], [o.x + 20, o.y + 40], [o.x + 32, o.y + 16]]) {
          ctx.beginPath();
          ctx.arc(lx, ly, 13, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        ctx.arc(o.x + 12, o.y + 48, 5, 0, Math.PI * 2);
        ctx.arc(o.x + 30, o.y + 56, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (o.kind === 'oven') {
        ctx.fillStyle = '#9a4a3a';
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.fillStyle = '#7e382c';
        ctx.fillRect(o.x, o.y, o.w, 12);
        ctx.fillStyle = '#2c2c34';
        ctx.beginPath();
        ctx.arc(o.x + o.w / 2, o.y + o.h - 22, 20, 0, Math.PI * 2);
        ctx.fill();
        const fl = 12 + Math.sin(time * 14 + o.x) * 5;
        ctx.fillStyle = '#ff9a3c';
        ctx.beginPath();
        ctx.moveTo(o.x + o.w / 2 - 14, o.y + o.h - 24);
        ctx.quadraticCurveTo(o.x + o.w / 2, o.y - fl - 6, o.x + o.w / 2 + 14, o.y + o.h - 24);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffd94d';
        ctx.beginPath();
        ctx.moveTo(o.x + o.w / 2 - 8, o.y + o.h - 24);
        ctx.quadraticCurveTo(o.x + o.w / 2, o.y - fl / 2, o.x + o.w / 2 + 8, o.y + o.h - 24);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px "Trebuchet MS", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('OVEN', o.x + o.w / 2, o.y + 16);
      } else if (o.kind === 'knife') {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(o.x + 8, FIELD.groundY + 2, 14, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.knife;
        ctx.beginPath();
        ctx.moveTo(o.x + 2, o.y + o.h);
        ctx.lineTo(o.x + 8, o.y);
        ctx.lineTo(o.x + 14, o.y + o.h);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = PALETTE.knifeHandle;
        ctx.fillRect(o.x + 4, o.y - 12, 8, 12);
      } else if (o.kind === 'puddle') {
        ctx.fillStyle = '#5a8fc7';
        ctx.beginPath();
        ctx.ellipse(o.x + o.w / 2, FIELD.groundY - 4, o.w / 2, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.ellipse(o.x + o.w / 2 - 18, FIELD.groundY - 6, 22, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Falling knives with their ground shadow telegraph.
    for (const k of s.falling) {
      const prog = Math.min(1, (k.y + 90) / FIELD.groundY);
      ctx.fillStyle = `rgba(0,0,0,${0.1 + prog * 0.3})`;
      ctx.beginPath();
      ctx.ellipse(k.x, FIELD.groundY + 2, 10 + prog * 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.knife;
      ctx.beginPath();
      ctx.moveTo(k.x - 8, k.y + 52);
      ctx.lineTo(k.x, k.y);
      ctx.lineTo(k.x + 8, k.y + 52);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = PALETTE.knifeHandle;
      ctx.fillRect(k.x - 4, k.y + 52, 8, 12);
    }
  }

  function drawPickups(s, time) {
    for (const pk of s.pickups) {
      const bob = Math.sin(time * 3 + pk.bob) * 4;
      if (pk.kind === 'corn') {
        ctx.save();
        ctx.translate(pk.x + 13, pk.y + 13 + bob);
        ctx.rotate(0.5);
        ctx.fillStyle = PALETTE.corn;
        ctx.beginPath();
        ctx.ellipse(0, 0, 9, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#d9a41f';
        ctx.lineWidth = 1.5;
        for (const dy of [-7, 0, 7]) {
          ctx.beginPath();
          ctx.moveTo(-7, dy);
          ctx.lineTo(7, dy);
          ctx.stroke();
        }
        ctx.fillStyle = '#3f7a34';
        ctx.beginPath();
        ctx.ellipse(-8, 10, 6, 10, 0.6, 0, Math.PI * 2);
        ctx.ellipse(8, 10, 6, 10, -0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (pk.kind === 'feather') {
        ctx.save();
        ctx.translate(pk.x + 15, pk.y + 15 + bob);
        ctx.shadowColor = '#ffd94d';
        ctx.shadowBlur = 18;
        ctx.fillStyle = PALETTE.feather;
        ctx.beginPath();
        ctx.ellipse(0, 0, 8, 16, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#b57f22';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.lineTo(0, 16);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.save();
        ctx.translate(pk.x + 15, pk.y + 13 + bob * 0.5);
        ctx.fillStyle = '#d9b36c';
        ctx.beginPath();
        ctx.ellipse(0, 4, 16, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.pie;
        ctx.beginPath();
        ctx.ellipse(0, 0, 15, 9, 0, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = '#8a4a1d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-10, -2);
        ctx.lineTo(10, -6);
        ctx.moveTo(-10, -6);
        ctx.lineTo(10, -2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  function drawParticles(s) {
    for (const pt of s.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawHUD(s, best) {
    const p = Math.min(1, s.distanceM / GOAL_M);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(20,16,10,0.55)';
    ctx.fillRect(14, 12, 250, 64);
    ctx.fillStyle = '#fff8e7';
    ctx.font = 'bold 26px "Trebuchet MS", sans-serif';
    ctx.fillText(`SCORE ${s.score}`, 26, 42);
    ctx.font = '16px "Trebuchet MS", sans-serif';
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(`BEST ${Math.max(best, s.score)}`, 26, 64);
    // Distance bar to the forest.
    const bw = 420;
    const bx = (FIELD.width - bw) / 2;
    ctx.fillStyle = 'rgba(20,16,10,0.55)';
    ctx.fillRect(bx - 10, 12, bw + 20, 44);
    ctx.fillStyle = '#3f7a34';
    ctx.fillRect(bx, 26, bw, 10);
    ctx.fillStyle = '#ffd94d';
    ctx.fillRect(bx, 26, bw * p, 10);
    ctx.fillStyle = '#fff8e7';
    ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🌲 FOREST ${Math.floor(s.distanceM)}m / ${GOAL_M}m`, bx + bw / 2, 50);
    // Turkey marker on the bar.
    ctx.fillStyle = '#8a5230';
    ctx.beginPath();
    ctx.arc(bx + bw * p, 31, 7, 0, Math.PI * 2);
    ctx.fill();
    // Lives.
    ctx.textAlign = 'right';
    for (let i = 0; i < LIVES; i += 1) {
      const hx = FIELD.width - 30 - i * 34;
      ctx.fillStyle = i < s.lives ? '#e5534b' : 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.moveTo(hx, 44);
      ctx.bezierCurveTo(hx - 12, 30, hx - 26, 42, hx, 56);
      ctx.bezierCurveTo(hx + 26, 42, hx + 12, 30, hx, 44);
      ctx.fill();
    }
    // Dash meter.
    const dReady = s.dashCd <= 0;
    ctx.fillStyle = 'rgba(20,16,10,0.55)';
    ctx.fillRect(FIELD.width - 164, 62, 150, 22);
    ctx.fillStyle = dReady ? '#7ec8f7' : '#5a6a7a';
    ctx.fillRect(FIELD.width - 160, 66, 142 * (dReady ? 1 : 1 - s.dashCd / RUN.dashCooldown), 14);
    ctx.fillStyle = '#fff8e7';
    ctx.font = 'bold 12px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(dReady ? 'DASH READY' : 'DASH…', FIELD.width - 89, 77);
    // Farmer gap meter.
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(20,16,10,0.55)';
    ctx.fillRect(14, FIELD.height - 52, 250, 38);
    ctx.fillStyle = '#e5534b';
    ctx.font = 'bold 14px "Trebuchet MS", sans-serif';
    ctx.fillText('FARMER', 24, FIELD.height - 28);
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(96, FIELD.height - 40, 140, 12);
    ctx.fillStyle = s.gap < 55 ? '#e5534b' : '#7ec8f7';
    ctx.fillRect(96, FIELD.height - 40, 140 * Math.max(0, s.gap / 170), 12);
    if (s.featherTime > 0) {
      ctx.fillStyle = '#ffd94d';
      ctx.font = 'bold 20px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✦ GOLDEN FEATHER ✦', FIELD.width / 2, 96);
    }
    if (s.msgTime > 0 && s.msg) {
      ctx.fillStyle = '#fff8e7';
      ctx.font = 'bold 24px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(s.msg, FIELD.width / 2, 132);
    }
  }

  function panel(title, lines, accent) {
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = 'rgba(255,248,231,0.97)';
    ctx.beginPath();
    ctx.roundRect(290, 150, 700, 420, 18);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.font = 'bold 54px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, FIELD.width / 2, 235);
    ctx.fillStyle = '#3a2c1c';
    ctx.font = '22px "Trebuchet MS", sans-serif';
    let y = 292;
    for (const line of lines) {
      ctx.fillText(line, FIELD.width / 2, y);
      y += 36;
    }
    ctx.fillStyle = '#8a5a2e';
    ctx.font = 'bold 20px "Trebuchet MS", sans-serif';
    ctx.fillText('Press SPACE or click to play again', FIELD.width / 2, 520);
  }

  function drawTitle(s, best, time) {
    drawSky(s, time);
    drawFarm(s);
    drawObstacles(s, time);
    drawPickups(s, time);
    drawTurkey(s, time);
    drawFarmer(s, time);
    ctx.fillStyle = 'rgba(20,16,10,0.45)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 92px "Trebuchet MS", sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 12;
    ctx.fillText('GOBBLE DASH', FIELD.width / 2, 190);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff8e7';
    ctx.font = 'bold 30px "Trebuchet MS", sans-serif';
    ctx.fillText('The Great Turkey Escape', FIELD.width / 2, 240);
    ctx.font = '21px "Trebuchet MS", sans-serif';
    ctx.fillText('Thanksgiving is coming. The farmer is coming faster.', FIELD.width / 2, 290);
    ctx.fillText('Outrun him 1500m to the forest — jump the fences, slide under the', FIELD.width / 2, 326);
    ctx.fillText('branches, dodge the oven and the carving knives, grab the corn.', FIELD.width / 2, 356);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 22px "Trebuchet MS", sans-serif';
    ctx.fillText('SPACE / CLICK — jump      ↓ — slide      SHIFT — dash      P — pause      M — mute', FIELD.width / 2, 420);
    if (best > 0) {
      ctx.fillStyle = '#fff8e7';
      ctx.font = 'bold 22px "Trebuchet MS", sans-serif';
      ctx.fillText(`Best score: ${best}`, FIELD.width / 2, 462);
    }
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 28px "Trebuchet MS", sans-serif';
    const pulse = 0.7 + 0.3 * Math.sin(time * 3);
    ctx.globalAlpha = pulse;
    ctx.fillText('▶  PRESS SPACE OR CLICK TO START  ◀', FIELD.width / 2, 530);
    ctx.globalAlpha = 1;
  }

  function draw(state, screen, best, time) {
    ctx.save();
    if (state.shake > 0) {
      ctx.translate((Math.random() - 0.5) * state.shake * 22, (Math.random() - 0.5) * state.shake * 14);
    }
    if (screen === SCREEN_TITLE) {
      drawTitle(state, best, time);
    } else if (screen === SCREEN_OVER) {
      drawSky(state, time);
      drawFarm(state);
      drawFarmer(state, time);
      panel('CAUGHT!', [`The farmer got you at ${Math.floor(state.distanceM)}m.`, `Score: ${state.score}   •   Best: ${Math.max(best, state.score)}`, 'The oven was already warm. Better luck next run!'], '#c0392b');
    } else if (screen === SCREEN_WIN) {
      drawSky(state, time);
      drawFarm(state);
      drawTurkey(state, time);
      panel('ESCAPED!', [`You reached the forest — ${GOAL_M}m of freedom!`, `Score: ${state.score}   •   Best: ${Math.max(best, state.score)}`, 'The turkey lives to gobble another day.'], '#3f7a34');
    } else {
      drawSky(state, time);
      drawFarm(state);
      drawObstacles(state, time);
      drawPickups(state, time);
      drawParticles(state);
      drawFarmer(state, time);
      drawTurkey(state, time);
      drawHUD(state, best);
      if (screen === SCREEN_PAUSED) {
        ctx.fillStyle = PALETTE.panel;
        ctx.fillRect(0, 0, FIELD.width, FIELD.height);
        ctx.fillStyle = '#fff8e7';
        ctx.font = 'bold 64px "Trebuchet MS", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', FIELD.width / 2, 340);
        ctx.font = '22px "Trebuchet MS", sans-serif';
        ctx.fillText('Press P or SPACE to keep running', FIELD.width / 2, 396);
      }
    }
    ctx.restore();
  }

  return { draw };
}
