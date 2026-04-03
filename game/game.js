/** * SETUP & CONSTANTS
 */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('scoreDisplay');

// 물리 상수
const GRAVITY = 0.6;
const FRICTION = 0.8;
const TERMINAL_VELOCITY = 12;

/**
 * INPUT HANDLING
 * 키 입력을 추적하여 부드러운 연속 이동을 보장합니다.
 */
const keys = {
    ArrowLeft: false,
    ArrowRight: false,
    Space: false
};

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.code)) keys[e.code] = true;
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.code)) keys[e.code] = false;
});

/**
 * HELPER FUNCTIONS
 */
// AABB (Axis-Aligned Bounding Box) 충돌 감지 함수
function checkAABB(rect1, rect2) {
    return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y
    );
}

/**
 * ENTITY CLASSES (엔티티 클래스)
 */
class Platform {
    constructor(x, y, width, height, color = '#27ae60') {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

class Coin {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 20;
        this.collected = false;
        // 원을 그리기 위한 중심점 계산
        this.cx = x + this.width / 2;
        this.cy = y + this.height / 2;
        this.radius = 10;
    }

    draw(ctx) {
        if (this.collected) return;
        ctx.fillStyle = '#f1c40f'; // 골드 색상
        ctx.beginPath();
        ctx.arc(this.cx, this.cy, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f39c12';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

class Enemy {
    constructor(x, y, patrolDistance) {
        this.startX = x;
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 30;
        this.patrolDistance = patrolDistance;
        this.speed = 2;
        this.direction = 1; // 1: 오른쪽, -1: 왼쪽
    }

    update() {
        this.x += this.speed * this.direction;
        
        // 정찰 범위를 벗어나면 방향 전환
        if (this.x > this.startX + this.patrolDistance) {
            this.direction = -1;
        } else if (this.x < this.startX) {
            this.direction = 1;
        }
    }

    draw(ctx) {
        ctx.fillStyle = '#e74c3c'; // 붉은색
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // 디테일(눈) 추가
        ctx.fillStyle = 'black';
        ctx.fillRect(this.x + 5, this.y + 5, 5, 5);
        ctx.fillRect(this.x + 20, this.y + 5, 5, 5);
    }
}

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 30;
        
        this.vx = 0; // X축 속도
        this.vy = 0; // Y축 속도
        this.speed = 5;
        this.jumpPower = -12;
        
        this.isGrounded = false;
    }

    update(platforms) {
        // 1. 수평 이동 입력 처리
        if (keys.ArrowLeft) this.vx -= 1;
        if (keys.ArrowRight) this.vx += 1;
        
        // 마찰력 적용
        this.vx *= FRICTION;

        // 2. 수평 이동 및 충돌 해결 (X축 먼저)
        this.x += this.vx;
        for (let plat of platforms) {
            if (checkAABB(this, plat)) {
                // 오른쪽으로 이동 중 벽에 부딪힘
                if (this.vx > 0) { 
                    this.x = plat.x - this.width;
                    this.vx = 0;
                } 
                // 왼쪽으로 이동 중 벽에 부딪힘
                else if (this.vx < 0) { 
                    this.x = plat.x + plat.width;
                    this.vx = 0;
                }
            }
        }

        // 3. 중력 및 점프 입력 처리 (Y축)
        this.vy += GRAVITY;
        if (this.vy > TERMINAL_VELOCITY) this.vy = TERMINAL_VELOCITY;
        
        if (keys.Space && this.isGrounded) {
            this.vy = this.jumpPower;
            this.isGrounded = false;
        }

        // 4. 수직 이동 및 충돌 해결
        this.y += this.vy;
        this.isGrounded = false; 
        
        for (let plat of platforms) {
            if (checkAABB(this, plat)) {
                // 떨어지다가 바닥에 닿음
                if (this.vy > 0) { 
                    this.y = plat.y - this.height;
                    this.vy = 0;
                    this.isGrounded = true;
                } 
                // 점프하다가 천장에 닿음
                else if (this.vy < 0) { 
                    this.y = plat.y + plat.height;
                    this.vy = 0;
                }
            }
        }

        // 맵 아래로 떨어지면 게임 오버
        if (this.y > canvas.height + 200) {
            gameState = 'GAMEOVER';
        }
    }

    draw(ctx) {
        ctx.fillStyle = '#3498db'; // 플레이어 파란색
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

/**
 * GAME STATE & INITIALIZATION (게임 상태 및 초기화)
 */
let player;
let platforms = [];
let enemies = [];
let coins = [];
let score = 0;
let gameState = 'PLAYING'; // PLAYING, GAMEOVER, WON
let cameraX = 0;

function initLevel() {
    score = 0;
    scoreDisplay.innerText = score;
    gameState = 'PLAYING';
    
    player = new Player(100, 300);
    
    // 플랫폼 생성
    platforms = [
        new Platform(0, 400, 1500, 50, '#27ae60'),
        new Platform(1650, 400, 800, 50, '#27ae60'), // 점프 구간
        new Platform(300, 320, 100, 20),
        new Platform(500, 240, 100, 20),
        new Platform(700, 160, 100, 20),
        new Platform(1000, 280, 150, 20),
        new Platform(1300, 200, 100, 20),
        new Platform(850, 250, 40, 150), // 벽 장애물
        new Platform(2300, 350, 200, 20, '#9b59b6') // 도착 지점
    ];

    // 적 생성
    enemies = [
        new Enemy(400, 370, 200),
        new Enemy(1050, 250, 100),
        new Enemy(1800, 370, 300)
    ];

    // 코인 생성
    coins = [
        new Coin(340, 280),
        new Coin(540, 200),
        new Coin(740, 120),
        new Coin(1100, 350),
        new Coin(1340, 160),
        new Coin(1900, 350),
        new Coin(2000, 350)
    ];
}

/**
 * MAIN GAME LOOP (메인 게임 루프)
 */
function update() {
    if (gameState !== 'PLAYING') return;

    player.update(platforms);
    enemies.forEach(enemy => enemy.update());

    // 적 충돌 처리
    for (let enemy of enemies) {
        if (checkAABB(player, enemy)) {
            gameState = 'GAMEOVER';
        }
    }

    // 코인 수집 처리
    for (let i = coins.length - 1; i >= 0; i--) {
        let coin = coins[i];
        if (checkAABB(player, coin)) {
            coins.splice(i, 1);
            score += 10;
            scoreDisplay.innerText = score;
        }
    }

    // 승리 조건 (보라색 플랫폼 도착)
    if (player.x > 2350) {
        gameState = 'WON';
    }

    // 카메라 위치 업데이트 (플레이어 따라가기)
    cameraX = Math.max(0, player.x - canvas.width / 3);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-cameraX, 0);

    platforms.forEach(plat => plat.draw(ctx));
    coins.forEach(coin => coin.draw(ctx));
    enemies.forEach(enemy => enemy.draw(ctx));
    player.draw(ctx);

    ctx.restore();

    // 오버레이 텍스트 그리기
    if (gameState === 'GAMEOVER') {
        drawOverlay('GAME OVER', 'Press F5 to Restart', 'rgba(231, 76, 60, 0.8)');
    } else if (gameState === 'WON') {
        drawOverlay('YOU WIN!', `Final Score: ${score} - Press F5 to Restart`, 'rgba(46, 204, 113, 0.8)');
    }
}

function drawOverlay(title, subtitle, bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 20);
    
    ctx.font = '24px sans-serif';
    ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 30);
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

// 게임 시작
initLevel();
loop();