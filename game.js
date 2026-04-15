/**
 * Atari Survival Game - Basic Implementation
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const menuOverlay = document.getElementById('menu-overlay');
const startButton = document.getElementById('start-button');
const ui = document.getElementById('ui');
const scoreElement = document.getElementById('score');

// Game constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLAYER_SIZE = 20;
const ENEMY_SIZE = 20;
const BULLET_SIZE = 6;

// Set canvas size
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// Game State
let gameState = 'MENU';
let score = 0;

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = PLAYER_SIZE;
        this.height = PLAYER_SIZE;
        this.color = '#0000ff'; // Blue
        this.speed = 5;
    }

    update(keys) {
        let dx = 0;
        let dy = 0;

        if (keys['w'] || keys['ArrowUp'] || keys['W']) dy -= 1;
        if (keys['s'] || keys['ArrowDown'] || keys['S']) dy += 1;
        if (keys['a'] || keys['ArrowLeft'] || keys['A']) dx -= 1;
        if (keys['d'] || keys['ArrowRight'] || keys['D']) dx += 1;

        if (dx !== 0 && dy !== 0) {
            const length = Math.sqrt(dx * dx + dy * dy);
            dx /= length;
            dy /= length;
        }

        this.x += dx * this.speed;
        this.y += dy * this.speed;

        // Arena boundaries
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > CANVAS_WIDTH) this.x = CANVAS_WIDTH - this.width;
        if (this.y < 0) this.y = 0;
        if (this.y + this.height > CANVAS_HEIGHT) this.y = CANVAS_HEIGHT - this.height;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.fillStyle = '#6666ff';
        ctx.fillRect(this.x + 4, this.y + 4, this.width - 8, this.height - 8);
    }
}

class Bullet {
    constructor(x, y, dx, dy) {
        this.x = x;
        this.y = y;
        this.width = BULLET_SIZE;
        this.height = BULLET_SIZE;
        this.dx = dx;
        this.dy = dy;
        this.speed = 10;
        this.active = true;
    }

    update() {
        this.x += this.dx * this.speed;
        this.y += this.dy * this.speed;

        // Remove if off screen
        if (this.x < 0 || this.x > CANVAS_WIDTH || this.y < 0 || this.y > CANVAS_HEIGHT) {
            this.active = false;
        }
    }

    draw(ctx) {
        ctx.fillStyle = '#ffff00'; // Yellow
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = ENEMY_SIZE;
        this.height = ENEMY_SIZE;
        this.color = '#ff0000'; // Red
        this.speed = 2;
        this.active = true;
    }

    update(targetX, targetY) {
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 0) {
            this.x += (dx / dist) * this.speed;
            this.y += (dy / dist) * this.speed;
        }
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.fillStyle = '#ff6666';
        ctx.fillRect(this.x + 4, this.y + 4, this.width - 8, this.height - 8);
    }
}

// Game instances
let player;
let bullets = [];
let enemies = [];
const keys = {};

// Input handling
window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    
    // Shoot on Space
    if (gameState === 'PLAYING' && e.code === 'Space') {
        shoot();
    }
});
window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

function shoot() {
    // Shooting direction based on current movement or default to up
    let dx = 0;
    let dy = 0;

    if (keys['w'] || keys['ArrowUp'] || keys['W']) dy -= 1;
    if (keys['s'] || keys['ArrowDown'] || keys['S']) dy += 1;
    if (keys['a'] || keys['ArrowLeft'] || keys['A']) dx -= 1;
    if (keys['d'] || keys['ArrowRight'] || keys['D']) dx += 1;

    // If standing still, shoot up
    if (dx === 0 && dy === 0) dy = -1;

    // Normalize
    const length = Math.sqrt(dx * dx + dy * dy);
    dx /= length;
    dy /= length;

    bullets.push(new Bullet(
        player.x + PLAYER_SIZE / 2 - BULLET_SIZE / 2,
        player.y + PLAYER_SIZE / 2 - BULLET_SIZE / 2,
        dx,
        dy
    ));
}

function spawnEnemy() {
    if (gameState !== 'PLAYING') return;

    // Spawn on random edges
    let x, y;
    const side = Math.floor(Math.random() * 4);
    if (side === 0) { // Top
        x = Math.random() * CANVAS_WIDTH;
        y = -ENEMY_SIZE;
    } else if (side === 1) { // Bottom
        x = Math.random() * CANVAS_WIDTH;
        y = CANVAS_HEIGHT;
    } else if (side === 2) { // Left
        x = -ENEMY_SIZE;
        y = Math.random() * CANVAS_HEIGHT;
    } else { // Right
        x = CANVAS_WIDTH;
        y = Math.random() * CANVAS_HEIGHT;
    }

    enemies.push(new Enemy(x, y));
    
    // Schedule next spawn with increasing difficulty
    const nextSpawn = Math.max(500, 2000 - (score / 10));
    setTimeout(spawnEnemy, nextSpawn);
}

function checkCollisions() {
    // Bullet vs Enemy
    bullets.forEach(bullet => {
        enemies.forEach(enemy => {
            if (bullet.active && enemy.active &&
                bullet.x < enemy.x + enemy.width &&
                bullet.x + bullet.width > enemy.x &&
                bullet.y < enemy.y + enemy.height &&
                bullet.y + bullet.height > enemy.y) {
                
                bullet.active = false;
                enemy.active = false;
                score += 100;
                updateScore();
            }
        });
    });

    // Enemy vs Player
    enemies.forEach(enemy => {
        if (enemy.active &&
            player.x < enemy.x + enemy.width &&
            player.x + player.width > enemy.x &&
            player.y < enemy.y + enemy.height &&
            player.y + player.height > enemy.y) {
            
            gameOver();
        }
    });

    // Clean up
    bullets = bullets.filter(b => b.active);
    enemies = enemies.filter(e => e.active);
}

function updateScore() {
    scoreElement.innerText = `SCORE: ${score.toString().padStart(4, '0')}`;
}

function gameOver() {
    gameState = 'GAMEOVER';
    menuOverlay.style.display = 'flex';
    menuOverlay.querySelector('h1').innerText = 'GAME OVER';
    startButton.innerText = 'RESTART';
    ui.style.display = 'none';
}

function startGame() {
    player = new Player(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    bullets = [];
    enemies = [];
    score = 0;
    updateScore();
    gameState = 'PLAYING';
    menuOverlay.style.display = 'none';
    ui.style.display = 'block';
    spawnEnemy();
}

startButton.addEventListener('click', startGame);

function gameLoop() {
    // Clear
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameState === 'PLAYING') {
        player.update(keys);
        bullets.forEach(bullet => bullet.update());
        enemies.forEach(enemy => enemy.update(player.x, player.y));
        checkCollisions();

        // Draw
        player.draw(ctx);
        bullets.forEach(bullet => bullet.draw(ctx));
        enemies.forEach(enemy => enemy.draw(ctx));
    } else if (gameState === 'MENU' || gameState === 'GAMEOVER') {
        // Just draw a space background or something subtle
    }

    requestAnimationFrame(gameLoop);
}

gameLoop();
