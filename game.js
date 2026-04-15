/**
 * Atari Survival Game - Step 5: Slow Zones and Life System
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const menuOverlay = document.getElementById('menu-overlay');
const startButton = document.getElementById('start-button');
const ui = document.getElementById('ui');
const scoreElement = document.getElementById('score');
const ammoElement = document.getElementById('ammo');
const livesElement = document.getElementById('lives');

// Game constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLAYER_SIZE = 20;
const ENEMY_SIZE = 20;
const BULLET_SIZE = 6;
const MAX_AMMO = 10;
const REGEN_TIME = 2000; // 2 seconds as requested

// Set canvas size
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

class SlowZone {
    constructor(x, y, w, h, color) {
        this.x = x;
        this.y = y;
        this.width = w;
        this.height = h;
        this.color = color; // Green or Purple
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.4;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Add some "bubbles" or details for poison effect
        ctx.globalAlpha = 0.6;
        for (let i = 0; i < 3; i++) {
            ctx.fillRect(this.x + 5 + i * 15, this.y + 10, 4, 4);
        }
        ctx.globalAlpha = 1.0;
    }

    contains(px, py) {
        return px > this.x && px < this.x + this.width &&
               py > this.y && py < this.y + this.height;
    }
}

class Player {
    constructor(x, y) {
        this.reset(x, y);
    }

    reset(x, y) {
        this.x = x;
        this.y = y;
        this.width = PLAYER_SIZE;
        this.height = PLAYER_SIZE;
        this.color = '#0000ff'; 
        this.baseSpeed = 4;
        this.speed = 4;
        this.angle = 0;
        this.recoilX = 0;
        this.recoilY = 0;
        this.invulnerable = 0; // Frames of invulnerability
    }

    update(keys, mouseX, mouseY, deltaTime, slowZones) {
        let dx = 0;
        let dy = 0;

        // Check for slow zones
        let isSlowed = false;
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        for (let zone of slowZones) {
            if (zone.contains(centerX, centerY)) {
                isSlowed = true;
                break;
            }
        }
        this.speed = isSlowed ? this.baseSpeed * 0.4 : this.baseSpeed;

        if (keys['w'] || keys['ArrowUp'] || keys['W']) dy -= 1;
        if (keys['s'] || keys['ArrowDown'] || keys['S']) dy += 1;
        if (keys['a'] || keys['ArrowLeft'] || keys['A']) dx -= 1;
        if (keys['d'] || keys['ArrowRight'] || keys['D']) dx += 1;

        if (dx !== 0 && dy !== 0) {
            const length = Math.sqrt(dx * dx + dy * dy);
            dx /= length;
            dy /= length;
        }

        this.x += dx * this.speed + this.recoilX;
        this.y += dy * this.speed + this.recoilY;

        this.recoilX *= 0.8;
        this.recoilY *= 0.8;

        if (this.x < 0) this.x = 0;
        if (this.x + this.width > CANVAS_WIDTH) this.x = CANVAS_WIDTH - this.width;
        if (this.y < 0) this.y = 0;
        if (this.y + this.height > CANVAS_HEIGHT) this.y = CANVAS_HEIGHT - this.height;

        this.angle = Math.atan2(mouseY - centerY, mouseX - centerX);

        if (this.invulnerable > 0) this.invulnerable--;

        // Ammo Regeneration
        if (ammo < MAX_AMMO) {
            lastRegenTime += deltaTime;
            if (lastRegenTime >= REGEN_TIME) {
                ammo++;
                lastRegenTime = 0;
                updateAmmoUI();
            }
        } else {
            lastRegenTime = 0;
        }
    }

    draw(ctx) {
        if (this.invulnerable > 0 && Math.floor(Date.now() / 100) % 2 === 0) return;

        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        
        ctx.save();
        ctx.rotate(this.angle);
        ctx.fillStyle = '#1e90ff';
        ctx.fillRect(10, -5, 8, 10);
        ctx.restore();

        ctx.fillStyle = this.color;
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        ctx.fillStyle = '#6666ff';
        ctx.fillRect(-this.width / 2 + 4, -this.height / 2 + 4, this.width - 8, this.height - 8);
        
        ctx.restore();
    }

    applyRecoil(angle, power) {
        this.recoilX -= Math.cos(angle) * power;
        this.recoilY -= Math.sin(angle) * power;
    }
}

class Bullet {
    constructor(x, y, angle) {
        this.x = x;
        this.y = y;
        this.width = BULLET_SIZE;
        this.height = BULLET_SIZE;
        this.angle = angle;
        this.dx = Math.cos(angle);
        this.dy = Math.sin(angle);
        this.speed = 12;
        this.active = true;
        this.bounces = 0;
        this.maxBounces = 2;
    }

    update() {
        this.x += this.dx * this.speed;
        this.y += this.dy * this.speed;

        let bounced = false;
        if (this.x < 0 || this.x + this.width > CANVAS_WIDTH) {
            this.dx *= -1;
            this.x = this.x < 0 ? 0 : CANVAS_WIDTH - this.width;
            bounced = true;
        }
        if (this.y < 0 || this.y + this.height > CANVAS_HEIGHT) {
            this.dy *= -1;
            this.y = this.y < 0 ? 0 : CANVAS_HEIGHT - this.height;
            bounced = true;
        }

        if (bounced) {
            this.bounces++;
            if (this.bounces > this.maxBounces) {
                this.active = false;
            }
        }
    }

    draw(ctx) {
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = ENEMY_SIZE;
        this.height = ENEMY_SIZE;
        this.color = '#ff0000';
        this.speed = 0.8; 
        this.active = true;
        this.hp = 1;
        this.kbX = 0;
        this.kbY = 0;
    }

    update(targetX, targetY) {
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 0) {
            this.x += (dx / dist) * this.speed + this.kbX;
            this.y += (dy / dist) * this.speed + this.kbY;
        }

        this.kbX *= 0.85;
        this.kbY *= 0.85;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.fillStyle = '#ff6666';
        ctx.fillRect(this.x + 4, this.y + 4, this.width - 8, this.height - 8);
    }

    applyKnockback(angle, power) {
        this.kbX += Math.cos(angle) * power;
        this.kbY += Math.sin(angle) * power;
    }
}

let player = new Player(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
let bullets = [];
let enemies = [];
let slowZones = [
    new SlowZone(150, 100, 60, 40, '#00ff00'),
    new SlowZone(600, 400, 50, 80, '#a020f0'),
    new SlowZone(300, 450, 90, 30, '#00ff00'),
    new SlowZone(500, 150, 40, 40, '#a020f0')
];
const keys = {};

// Input
window.addEventListener('keydown', (e) => keys[e.key] = true);
window.addEventListener('keyup', (e) => keys[e.key] = false);
window.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
});
window.addEventListener('mousedown', (e) => {
    if (gameState === 'PLAYING' && e.button === 0) shoot();
});

function shoot() {
    if (ammo <= 0) return;
    ammo--;
    updateAmmoUI();
    const centerX = player.x + PLAYER_SIZE / 2;
    const centerY = player.y + PLAYER_SIZE / 2;
    bullets.push(new Bullet(
        centerX + Math.cos(player.angle) * 15 - BULLET_SIZE / 2,
        centerY + Math.sin(player.angle) * 15 - BULLET_SIZE / 2,
        player.angle
    ));
    player.applyRecoil(player.angle, 3);
}

function spawnEnemy() {
    if (gameState !== 'PLAYING') return;
    let x, y;
    const side = Math.floor(Math.random() * 4);
    if (side === 0) { x = Math.random() * CANVAS_WIDTH; y = -ENEMY_SIZE; }
    else if (side === 1) { x = Math.random() * CANVAS_WIDTH; y = CANVAS_HEIGHT; }
    else if (side === 2) { x = -ENEMY_SIZE; y = Math.random() * CANVAS_HEIGHT; }
    else { x = CANVAS_WIDTH; y = Math.random() * CANVAS_HEIGHT; }
    enemies.push(new Enemy(x, y));
    const nextSpawn = Math.max(600, 1800 - (score / 20));
    setTimeout(spawnEnemy, nextSpawn);
}

function checkCollisions() {
    bullets.forEach(bullet => {
        enemies.forEach(enemy => {
            if (bullet.active && enemy.active &&
                bullet.x < enemy.x + enemy.width &&
                bullet.x + bullet.width > enemy.x &&
                bullet.y < enemy.y + enemy.height &&
                bullet.y + bullet.height > enemy.y) {
                bullet.active = false;
                enemy.hp -= 0.5;
                enemy.applyKnockback(bullet.angle, 10);
                if (enemy.hp <= 0) {
                    enemy.active = false;
                    score += 100;
                    updateScore();
                }
            }
        });
    });

    enemies.forEach(enemy => {
        if (enemy.active && player.invulnerable === 0 &&
            player.x < enemy.x + enemy.width &&
            player.x + player.width > enemy.x &&
            player.y < enemy.y + enemy.height &&
            player.y + player.height > enemy.y) {
            
            lives--;
            updateLivesUI();
            player.invulnerable = 60; // 1 second roughly at 60fps
            player.applyRecoil(Math.atan2(player.y - enemy.y, player.x - enemy.x), -10);
            
            if (lives <= 0) {
                gameOver();
            }
        }
    });

    bullets = bullets.filter(b => b.active);
    enemies = enemies.filter(e => e.active);
}

function updateScore() {
    scoreElement.innerText = `SCORE: ${score.toString().padStart(4, '0')}`;
}

function updateAmmoUI() {
    ammoElement.innerText = `AMMO: ${ammo}/${MAX_AMMO}`;
    if (ammo === 0) ammoElement.style.color = '#ff0000';
    else if (ammo < 3) ammoElement.style.color = '#ffaa00';
    else ammoElement.style.color = '#ffffff';
}

function updateLivesUI() {
    livesElement.innerText = "LIVES: " + "❤️".repeat(lives);
}

function gameOver() {
    gameState = 'GAMEOVER';
    menuOverlay.style.display = 'flex';
    menuOverlay.querySelector('h1').innerText = 'GAME OVER';
    startButton.innerText = 'RESTART';
    ui.style.display = 'none';
}

function startGame() {
    player.reset(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    bullets = [];
    enemies = [];
    score = 0;
    ammo = MAX_AMMO;
    lives = 3;
    lastRegenTime = 0;
    updateScore();
    updateAmmoUI();
    updateLivesUI();
    gameState = 'PLAYING';
    menuOverlay.style.display = 'none';
    ui.style.display = 'block';
    spawnEnemy();
}

startButton.addEventListener('click', startGame);

let lastTimestamp = 0;
function gameLoop(timestamp) {
    const deltaTime = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameState === 'PLAYING') {
        slowZones.forEach(zone => zone.draw(ctx));
        player.update(keys, mouseX, mouseY, deltaTime || 0, slowZones);
        bullets.forEach(bullet => bullet.update());
        enemies.forEach(enemy => enemy.update(player.x, player.y));
        checkCollisions();

        player.draw(ctx);
        bullets.forEach(bullet => bullet.draw(ctx));
        enemies.forEach(enemy => enemy.draw(ctx));
    }
    requestAnimationFrame(gameLoop);
}

gameLoop(0);
