/**
 * Atari Survival - Final Build with all Mechanics (1-7)
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const menuOverlay = document.getElementById('menu-overlay');
const startButton = document.getElementById('start-button');
const ui = document.getElementById('ui');
const scoreElement = document.getElementById('score');
const ammoElement = document.getElementById('ammo');
const livesElement = document.getElementById('lives-ui');
const dashStatusElement = document.getElementById('dash-status');

// Constants & Modifiable Settings
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLAYER_SIZE = 20;
const ENEMY_SIZE = 20;
const BULLET_SIZE = 6;
const MAX_AMMO = 10;
const INITIAL_REGEN_TIME = 2000;
const INITIAL_DASH_COOLDOWN = 5000;
const DASH_DURATION = 200;
const DASH_SPEED_MULT = 3.5;

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// Game State
let gameState = 'MENU';
let score = 0;
let mouseX = 0;
let mouseY = 0;
let ammo = MAX_AMMO;
let lastRegenTime = 0;
let lives = 3;
let currentRegenTime = INITIAL_REGEN_TIME;
let currentDashCooldown = INITIAL_DASH_COOLDOWN;

class SlowZone {
    constructor(x, y, w, h, color) {
        this.x = x; this.y = y; this.width = w; this.height = h; this.color = color;
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(this.x, this.y, this.width, this.height);
    }
    contains(px, py) {
        return px > this.x && px < this.x + this.width && py > this.y && py < this.y + this.height;
    }
}

class PowerUp {
    constructor() {
        this.reset();
    }
    reset() {
        this.x = Math.random() * (CANVAS_WIDTH - 15);
        this.y = Math.random() * (CANVAS_HEIGHT - 15);
        this.size = 15;
        this.timer = 7000; // 7 seconds
        
        // 70% chance for advantage
        const isAdvantage = Math.random() < 0.7;
        this.color = isAdvantage ? '#ffd700' : '#8b0000'; // Gold vs Dark Red
        
        const types = isAdvantage ? 
            ['+5A', '+10A', '+SPD', '+LIFE', '-REG', '-DSH'] : 
            ['-3A', '-5A', '-SPD', '-LIFE', '+REG', '+DSH'];
        
        this.type = types[Math.floor(Math.random() * types.length)];
    }
    update(dt) {
        this.timer -= dt;
        if (this.timer <= 0) this.reset();
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(this.x, this.y, this.size, this.size);
        
        // Small indicator of expiration
        ctx.fillStyle = '#fff';
        ctx.fillRect(this.x, this.y + this.size + 2, (this.timer/7000) * this.size, 2);
    }
}

class Player {
    constructor(x, y) {
        this.reset(x, y);
    }
    reset(x, y) {
        this.x = x; this.y = y;
        this.width = PLAYER_SIZE; this.height = PLAYER_SIZE;
        this.baseSpeed = 4; this.speed = 4;
        this.angle = 0; this.recoilX = 0; this.recoilY = 0;
        this.invulnerable = 0;
        this.isDashing = false; this.dashTimer = 0; this.dashCooldownTimer = 0;
        this.dashDirX = 0; this.dashDirY = 0;
    }
    update(keys, deltaTime, zones) {
        if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= deltaTime;

        if (this.isDashing) {
            this.dashTimer -= deltaTime;
            this.x += this.dashDirX * this.baseSpeed * DASH_SPEED_MULT;
            this.y += this.dashDirY * this.baseSpeed * DASH_SPEED_MULT;
            if (this.dashTimer <= 0) this.isDashing = false;
        } else {
            let isSlowed = false;
            for (let z of zones) { if (z.contains(this.x + 10, this.y + 10)) { isSlowed = true; break; } }
            this.speed = isSlowed ? this.baseSpeed * 0.4 : this.baseSpeed;

            let dx = 0, dy = 0;
            if (keys['w'] || keys['ArrowUp'] || keys['W']) dy -= 1;
            if (keys['s'] || keys['ArrowDown'] || keys['S']) dy += 1;
            if (keys['a'] || keys['ArrowLeft'] || keys['A']) dx -= 1;
            if (keys['d'] || keys['ArrowRight'] || keys['D']) dx += 1;

            if (dx !== 0 || dy !== 0) {
                const len = Math.sqrt(dx*dx + dy*dy);
                dx /= len; dy /= len;
                this.x += dx * this.speed + this.recoilX;
                this.y += dy * this.speed + this.recoilY;
                
                if ((keys['Shift'] || keys['ShiftLeft']) && this.dashCooldownTimer <= 0) {
                    this.isDashing = true; this.dashTimer = DASH_DURATION;
                    this.dashCooldownTimer = currentDashCooldown;
                    this.dashDirX = dx; this.dashDirY = dy;
                }
            }
            this.recoilX *= 0.8; this.recoilY *= 0.8;
        }

        this.x = Math.max(0, Math.min(CANVAS_WIDTH - this.width, this.x));
        this.y = Math.max(0, Math.min(CANVAS_HEIGHT - this.height, this.y));

        this.angle = Math.atan2(mouseY - (this.y + 10), mouseX - (this.x + 10));
        if (this.invulnerable > 0) this.invulnerable--;

        if (ammo < MAX_AMMO) {
            lastRegenTime += deltaTime;
            if (lastRegenTime >= currentRegenTime) { ammo++; lastRegenTime = 0; updateUI(); }
        }
    }
    draw(ctx) {
        if (this.invulnerable > 0 && Math.floor(Date.now() / 100) % 2 === 0) return;
        ctx.save();
        ctx.translate(this.x + 10, this.y + 10);
        ctx.rotate(this.angle);
        ctx.fillStyle = '#1e90ff'; ctx.fillRect(10, -5, 8, 10);
        ctx.rotate(-this.angle);
        ctx.fillStyle = this.isDashing ? '#add8e6' : '#0000ff';
        ctx.fillRect(-10, -10, 20, 20);
        ctx.fillStyle = '#6666ff'; ctx.fillRect(-6, -6, 12, 12);
        ctx.restore();
    }
}

class Bullet {
    constructor(x, y, angle) {
        this.x = x; this.y = y; this.dx = Math.cos(angle); this.dy = Math.sin(angle);
        this.speed = 12; this.active = true; this.bounces = 0;
    }
    update() {
        this.x += this.dx * this.speed; this.y += this.dy * this.speed;
        if (this.x < 0 || this.x > CANVAS_WIDTH - 6) { this.dx *= -1; this.bounces++; this.x = this.x < 0 ? 0 : CANVAS_WIDTH-6; }
        if (this.y < 0 || this.y > CANVAS_HEIGHT - 6) { this.dy *= -1; this.bounces++; this.y = this.y < 0 ? 0 : CANVAS_HEIGHT-6; }
        if (this.bounces > 2) this.active = false;
    }
    draw(ctx) { ctx.fillStyle = '#ffff00'; ctx.fillRect(this.x, this.y, 6, 6); }
}

class Enemy {
    constructor(x, y) {
        this.x = x; this.y = y; this.speed = 0.8; this.active = true; this.hp = 2; // Hit twice to die
        this.kbX = 0; this.kbY = 0;
    }
    update(tx, ty) {
        const dx = tx - this.x, dy = ty - this.y, dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 0) { this.x += (dx/dist)*this.speed + this.kbX; this.y += (dy/dist)*this.speed + this.kbY; }
        this.kbX *= 0.85; this.kbY *= 0.85;
    }
    draw(ctx) {
        ctx.fillStyle = '#f00'; ctx.fillRect(this.x, this.y, 20, 20);
        ctx.fillStyle = '#f66'; ctx.fillRect(this.x+4, this.y+4, 12, 12);
    }
}

let player = new Player(400, 300);
let currentPowerUp = new PowerUp();
let bullets = [], enemies = [], slowZones = [
    new SlowZone(150, 100, 100, 60, '#0f0'), new SlowZone(600, 400, 80, 120, '#a2f'),
    new SlowZone(300, 450, 150, 50, '#0f0'), new SlowZone(500, 150, 60, 60, '#a2f')
];
const keys = {};

window.onkeydown = (e) => keys[e.key] = true;
window.onkeyup = (e) => keys[e.key] = false;
window.onmousemove = (e) => {
    const r = canvas.getBoundingClientRect();
    mouseX = (e.clientX - r.left) * (800 / r.width);
    mouseY = (e.clientY - r.top) * (600 / r.height);
};
window.onmousedown = (e) => { if (gameState === 'PLAYING' && e.button === 0 && ammo > 0) {
    bullets.push(new Bullet(player.x+7, player.y+7, player.angle));
    ammo--; player.recoilX -= Math.cos(player.angle)*3; player.recoilY -= Math.sin(player.angle)*3;
    updateUI();
}};

function applyPowerUp(type) {
    switch(type) {
        case '+5A': ammo = Math.min(MAX_AMMO, ammo + 5); break;
        case '+10A': ammo = MAX_AMMO; break;
        case '+SPD': player.baseSpeed += 0.5; break;
        case '+LIFE': lives++; break;
        case '-REG': currentRegenTime = Math.max(500, currentRegenTime - 300); break;
        case '-DSH': currentDashCooldown = Math.max(1000, currentDashCooldown - 500); break;
        case '-3A': ammo = Math.max(0, ammo - 3); break;
        case '-5A': ammo = Math.max(0, ammo - 5); break;
        case '-SPD': player.baseSpeed = Math.max(1.5, player.baseSpeed - 0.5); break;
        case '-LIFE': lives--; break;
        case '+REG': currentRegenTime += 400; break;
        case '+DSH': currentDashCooldown += 1000; break;
    }
    updateUI();
}

function updateUI() {
    scoreElement.innerText = "SCORE: " + score.toString().padStart(4, '0');
    ammoElement.innerText = "AMMO: " + ammo + "/10";
    ammoElement.style.color = ammo === 0 ? '#f00' : (ammo < 3 ? '#fa0' : '#fff');
    livesElement.innerText = "LIVES: " + "❤️".repeat(Math.max(0, lives));
    const cd = player.dashCooldownTimer;
    dashStatusElement.innerText = cd > 0 ? (cd/1000).toFixed(1) + "s" : "READY";
    dashStatusElement.style.color = cd > 0 ? '#f00' : '#0f0';
}

function spawn() {
    if (gameState !== 'PLAYING') return;
    const side = Math.floor(Math.random()*4);
    let x, y;
    if (side === 0) { x = Math.random()*800; y = -20; }
    else if (side === 1) { x = Math.random()*800; y = 600; }
    else if (side === 2) { x = -20; y = Math.random()*600; }
    else { x = 800; y = Math.random()*600; }
    enemies.push(new Enemy(x, y));
    setTimeout(spawn, Math.max(500, 2000 - score/10));
}

function gameLoop(ts) {
    const dt = ts - (gameLoop.last || ts); gameLoop.last = ts;
    ctx.clearRect(0,0,800,600);
    if (gameState === 'PLAYING') {
        slowZones.forEach(z => z.draw(ctx));
        currentPowerUp.update(dt);
        currentPowerUp.draw(ctx);
        
        player.update(keys, dt, slowZones);
        bullets.forEach(b => b.update());
        enemies.forEach(e => e.update(player.x, player.y));
        
        // Pick PowerUp
        if (player.x < currentPowerUp.x + 15 && player.x + 20 > currentPowerUp.x &&
            player.y < currentPowerUp.y + 15 && player.y + 20 > currentPowerUp.y) {
            applyPowerUp(currentPowerUp.type);
            currentPowerUp.reset();
        }

        bullets.forEach(b => enemies.forEach(e => {
            if (b.active && e.active && b.x < e.x+20 && b.x+6 > e.x && b.y < e.y+20 && b.y+6 > e.y) {
                b.active = false; e.hp -= 1; // Bullet damage
                e.kbX += b.dx*10; e.kbY += b.dy*10;
                if (e.hp <= 0) { e.active = false; score += 100; updateUI(); }
            }
        }));

        enemies.forEach(e => {
            if (e.active && player.invulnerable === 0 && !player.isDashing &&
                player.x < e.x+20 && player.x+20 > e.x && player.y < e.y+20 && player.y+20 > e.y) {
                lives--; player.invulnerable = 60; updateUI();
                if (lives <= 0) { gameState = 'GAMEOVER'; menuOverlay.style.display = 'flex'; menuOverlay.querySelector('h1').innerText = 'GAME OVER'; ui.style.display = 'none'; }
            }
        });

        bullets = bullets.filter(b => b.active);
        enemies = enemies.filter(e => e.active);
        
        player.draw(ctx); bullets.forEach(b => b.draw(ctx)); enemies.forEach(e => e.draw(ctx));
        updateUI();
    }
    requestAnimationFrame(gameLoop);
}

startButton.onclick = () => {
    player.reset(400, 300); bullets = []; enemies = []; score = 0; ammo = MAX_AMMO; lives = 3;
    currentRegenTime = INITIAL_REGEN_TIME; currentDashCooldown = INITIAL_DASH_COOLDOWN;
    currentPowerUp.reset();
    gameState = 'PLAYING'; menuOverlay.style.display = 'none'; ui.style.display = 'flex';
    updateUI(); spawn();
};

gameLoop(0);
