'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

// ── Power-up Velocidad ────────────────────────────────────────────────────────
const POWERUP_DROP_CHANCE = 0.12;  // probabilidad de drop por asteroide destruido
const POWERUP_DURATION    = 5;     // segundos de empuje duplicado
const POWERUP_RADIUS      = 14;
const TRIPLE_DURATION     = 5;     // segundos de triple shot activo
const TRIPLE_SPREAD       = 0.18;  // ángulo entre balas del abanico (~10°)

// ── Estrella fugaz (cometa) ───────────────────────────────────────────────────
const SHOOTINGSTAR_SPAWN_CHANCE = 0.02;  // probabilidad por segundo de aparecer
const SHOOTINGSTAR_TTL          = 3.5;   // segundos de vida útil
const SHOOTINGSTAR_SPEED        = 240;   // px/s (≈3× más rápido que asteroide tamaño 3)
const SHOOTINGSTAR_POINTS       = 250;   // bonus alto
const SHOOTINGSTAR_RADIUS       = 12;    // tamaño del núcleo
const SHOOTINGSTAR_TRAIL_LEN    = 12;    // muestra de posiciones para la estela

class Asteroid {
  constructor(x, y, size = 3) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Estrella fugaz (cometa con estela) ────────────────────────────────────────
class ShootingStar {
  constructor(x, y, angle) {
    this.x      = x;
    this.y      = y;
    const speed = SHOOTINGSTAR_SPEED + rand(-20, 20);
    this.vx     = Math.cos(angle) * speed;
    this.vy     = Math.sin(angle) * speed;
    this.radius = SHOOTINGSTAR_RADIUS;
    this.ttl    = SHOOTINGSTAR_TTL;
    this.life   = SHOOTINGSTAR_TTL;   // para calcular alpha de desaparición
    this.trail  = [];                  // historial de posiciones recientes
    this.rot    = angle;
    this.dead   = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;

    // Muestra la posición actual para la estela (con wrap, así se rompe la línea
    // al cruzar un borde: guardamos también un flag de salto)
    this.trail.unshift({ x: this.x, y: this.y });
    if (this.trail.length > SHOOTINGSTAR_TRAIL_LEN) this.trail.pop();
  }

  draw() {
    const fade = Math.min(this.ttl / this.life, 1);

    // Estela: segmentos con grosor y alpha decrecientes
    for (let i = 1; i < this.trail.length; i++) {
      const a = this.trail[i - 1];
      const b = this.trail[i];
      // Saltar segmento si cruza un borde (wrap) para no dibujar línea a través
      if (Math.abs(a.x - b.x) > W / 2 || Math.abs(a.y - b.y) > H / 2) continue;
      const t = 1 - i / this.trail.length;
      ctx.strokeStyle = `rgba(255, 240, 160, ${(t * fade * 0.8).toFixed(2)})`;
      ctx.lineWidth   = (t * 3).toFixed(2);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // Núcleo brillante con halo
    const r = this.radius * fade;
    ctx.fillStyle = `rgba(255, 255, 200, ${(fade * 0.25).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r + 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 250, 220, ${fade.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, Math.max(r, 1), 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Power-up (V = Velocidad, T = Triple Shot) ─────────────────────────────────
class PowerUp {
  constructor(x, y, type = 'speed') {
    this.type   = type;   // 'speed' | 'triple'
    this.x      = x;
    this.y      = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(25, 55);
    this.vx     = Math.cos(angle) * speed;
    this.vy     = Math.sin(angle) * speed;
    this.radius = POWERUP_RADIUS;
    this.rot    = 0;
    this.pulse  = 0;
    this.dead   = false;
  }

  update(dt) {
    this.x    = wrap(this.x + this.vx * dt, W);
    this.y    = wrap(this.y + this.vy * dt, H);
    this.rot += 1.6 * dt;
    this.pulse += dt;
  }

  draw() {
    const triple   = this.type === 'triple';
    const haloRGB  = triple ? '255, 0, 255'   : '0, 255, 255';
    const strokeC  = triple ? '#f0f'          : '#0ff';
    const letter   = triple ? 'T'             : 'V';

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);

    const pulse = 1 + Math.sin(this.pulse * 5) * 0.12;
    const r = this.radius * pulse;

    // Halo brillante
    ctx.fillStyle   = `rgba(${haloRGB}, 0.15)`;
    ctx.beginPath();
    ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
    ctx.fill();

    // Hexágono
    ctx.strokeStyle = strokeC;
    ctx.lineWidth   = 2;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else         ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();

    // Letra blanca central (siempre derecha)
    ctx.rotate(-this.rot);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 2.2;
    ctx.beginPath();
    if (triple) {
      // "T" — trazo superior + vertical
      ctx.moveTo(-5, -4);
      ctx.lineTo( 5, -4);
      ctx.moveTo( 0, -4);
      ctx.lineTo( 0,  5);
    } else {
      // "V"
      ctx.moveTo(-5, -4);
      ctx.lineTo( 0,  4);
      ctx.lineTo( 5, -4);
    }
    ctx.stroke();

    ctx.restore();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() { this.reset(); }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12;
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.dead          = false;
    this.speedTimer    = 0;   // power-up Velocidad: >0 = empuje duplicado
    this.tripleTimer   = 0;   // power-up Triple Shot: >0 = dispara 3 balas
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.speedTimer    > 0) this.speedTimer    -= dt;
    if (this.tripleTimer   > 0) this.tripleTimer   -= dt;

    const ROT   = 3.5;   // rad/s
    const THRUST = 260;  // px/s²
    const DRAG   = 0.987;
    const thrustFactor = this.speedTimer > 0 ? 2 : 1;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * thrustFactor * dt;
      this.vy += Math.sin(this.angle) * THRUST * thrustFactor * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;

    if (this.tripleTimer > 0) {
      // Abanico cerrado: centro + dos laterales
      return [
        new Bullet(ox, oy, this.angle - TRIPLE_SPREAD),
        new Bullet(ox, oy, this.angle),
        new Bullet(ox, oy, this.angle + TRIPLE_SPREAD),
      ];
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  draw() {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo( 20,  0);   // nariz
    ctx.lineTo(-12, -9);   // ala izquierda
    ctx.lineTo( -7,  0);   // muesca trasera
    ctx.lineTo(-12,  9);   // ala derecha
    ctx.closePath();
    ctx.stroke();

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8,  4);
      ctx.strokeStyle = this.speedTimer > 0 ? 'rgba(0, 255, 255, 0.9)' : 'rgba(255, 130, 0, 0.85)';
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y) {
    this.x  = x;
    this.y  = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl  = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles, powerups, shootingStars;
let score, lives, level;
let powerupsThisLevel;  // garantiza mínimo 1 power-up por nivel
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3));
  }
}

// Aparece desde un borde con dirección hacia el área de juego
function spawnShootingStar() {
  const side = randInt(0, 3);  // 0:arriba 1:der 2:abajo 3:izq
  let x, y, angle;
  const cx = W / 2, cy = H / 2;
  if (side === 0)      { x = rand(0, W); y = 0; }
  else if (side === 1) { x = W;          y = rand(0, H); }
  else if (side === 2) { x = rand(0, W); y = H; }
  else                 { x = 0;          y = rand(0, H); }
  // Apunta al centro con variación aleatoria
  angle = Math.atan2(cy - y, cx - x) + rand(-0.6, 0.6);
  shootingStars.push(new ShootingStar(x, y, angle));
}

function initGame() {
  ship          = new Ship();
  bullets   = [];
  asteroids = [];
  particles = [];
  powerups  = [];
  shootingStars = [];
  score  = 0;
  lives  = 3;
  level  = 1;
  powerupsThisLevel = 0;
  state  = 'playing';
  spawnAsteroids(4);
}

function nextLevel() {
  level++;
  bullets   = [];
  particles = [];
  powerups  = [];
  shootingStars = [];
  powerupsThisLevel = 0;
  ship.reset();
  spawnAsteroids(3 + level);
}

function explode(x, y, count = 8) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead = true;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    asteroids.forEach(a => a.update(dt));
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }

  ship.update(dt);
  bullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(dt));
  particles.forEach(p => p.update(dt));
  powerups.forEach(pu => pu.update(dt));
  shootingStars.forEach(s => s.update(dt));

  // Spawn por probabilidad (sólo una a la vez)
  if (shootingStars.length === 0 && Math.random() < SHOOTINGSTAR_SPAWN_CHANCE * dt * 60) {
    spawnShootingStar();
  }

  bullets   = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);

  // Bala vs asteroide
  const newAsteroids = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        score += POINTS[a.size];
        explode(a.x, a.y, a.size * 5);
        newAsteroids.push(...a.split());

        // Drop de power-up (Velocidad o Triple Shot, al azar)
        const guaranteed = powerupsThisLevel === 0 && a.size === 3;
        if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
          const type = Math.random() < 0.5 ? 'speed' : 'triple';
          powerups.push(new PowerUp(a.x, a.y, type));
          powerupsThisLevel++;
        }
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  bullets   = bullets.filter(b => !b.dead);

  // Bala vs estrella fugaz (bonus alto, no se divide)
  for (const b of bullets) {
    for (const s of shootingStars) {
      if (!s.dead && !b.dead && dist(b, s) < s.radius) {
        b.dead = true;
        s.dead = true;
        score += SHOOTINGSTAR_POINTS;
        explode(s.x, s.y, 12);
      }
    }
  }
  bullets       = bullets.filter(b => !b.dead);
  shootingStars = shootingStars.filter(s => !s.dead);

  // Nave vs power-up (recogida automática, reinicia el timer correspondiente)
  if (!ship.dead) {
    for (const pu of powerups) {
      if (!pu.dead && dist(ship, pu) < ship.radius + pu.radius) {
        pu.dead = true;
        if (pu.type === 'triple') ship.tripleTimer = TRIPLE_DURATION;
        else                      ship.speedTimer  = POWERUP_DURATION;
      }
    }
    powerups = powerups.filter(pu => !pu.dead);
  }

  // Nave vs asteroide
  if (ship.invincible <= 0) {
    for (const a of asteroids) {
      if (dist(ship, a) < ship.radius + a.radius * 0.82) {
        killShip();
        break;
      }
    }
    // Nave vs estrella fugaz (daña igual que un asteroide)
    if (!ship.dead) {
      for (const s of shootingStars) {
        if (dist(ship, s) < ship.radius + s.radius) {
          killShip();
          break;
        }
      }
    }
  }

  // Nivel completado
  if (asteroids.length === 0) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth   = 1.2;
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.moveTo( 9,  0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-3,  0);
  ctx.lineTo(-6,  5);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

  // Indicadores de power-ups activos (apilados en la parte inferior)
  if (ship && (ship.speedTimer > 0 || ship.tripleTimer > 0)) {
    ctx.textAlign = 'center';
    ctx.font = '14px monospace';
    const both = ship.speedTimer > 0 && ship.tripleTimer > 0;
    let y = H - 18;
    if (both) y = H - 36;
    if (ship.speedTimer > 0) {
      ctx.fillStyle = '#0ff';
      ctx.fillText(`VELOCIDAD  ${ship.speedTimer.toFixed(1)}s`, W / 2, y);
      y = H - 18;
    }
    if (ship.tripleTimer > 0) {
      ctx.fillStyle = '#f0f';
      ctx.fillText(`TRIPLE  ${ship.tripleTimer.toFixed(1)}s`, W / 2, y);
    }
  }
}

function drawOverlay(title, sub) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  shootingStars.forEach(s => s.draw());
  powerups.forEach(pu => pu.draw());
  bullets.forEach(b => b.draw());
  ship.draw();

  drawHUD();

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
