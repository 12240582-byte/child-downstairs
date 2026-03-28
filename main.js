// 取得 Canvas 和 Context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 遊戲狀態與時間追蹤
let lastTime = 0;
let isGameOver = false;
let score = 0;

// 鍵盤狀態追蹤
const keys = {
    ArrowLeft: false,
    ArrowRight: false,
    ArrowUp: false,
    Space: false
};

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.code)) {
        keys[e.code] = true;
    }
    // 重新開始遊戲
    if (e.code === 'Space' && isGameOver) {
        init();
    }
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.code)) {
        keys[e.code] = false;
    }
});

// 平台管理
const platforms = [];
let platformSpawnTimer = 0;
const platformSpawnInterval = 1050; 

// --- 新增類別：金幣 ---
class Coin {
    constructor(platform) {
        this.platform = platform;
        this.radius = 8;
        this.width = this.radius * 2;
        this.height = this.radius * 2;
        this.offsetX = Math.random() * (platform.width - 20) + 10;
        this.collected = false;
    }

    update() {
        this.x = this.platform.x + this.offsetX - this.radius;
        this.y = this.platform.y - this.radius - 10;
    }

    draw(ctx) {
        if (this.collected) return;
        ctx.beginPath();
        ctx.arc(this.x + this.radius, this.y + this.radius, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#f1c40f'; // 金色
        ctx.fill();
        ctx.strokeStyle = '#d35400';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.closePath();
        
        // 閃光效果
        ctx.fillStyle = '#fff';
        ctx.fillRect(this.x + this.radius - 2, this.y + this.radius - 4, 4, 3);
    }
}

// --- 新增類別：小恐龍 ---
class Dinosaur {
    constructor(platform) {
        this.platform = platform;
        this.width = 24;
        this.height = 24;
        this.offsetX = Math.random() * (platform.width - this.width);
        this.speed = 55; // 在平台上巡邏的速度 (原 40)
        this.dir = Math.random() < 0.5 ? 1 : -1;
    }

    update(deltaTime) {
        const dt = deltaTime / 1000;
        // 巡邏移動
        this.offsetX += this.speed * this.dir * dt;
        
        // 平台邊緣轉向
        if (this.offsetX <= 0) {
            this.offsetX = 0;
            this.dir = 1;
        } else if (this.offsetX + this.width >= this.platform.width) {
            this.offsetX = this.platform.width - this.width;
            this.dir = -1;
        }

        this.x = this.platform.x + this.offsetX;
        this.y = this.platform.y - this.height;
    }

    draw(ctx) {
        ctx.fillStyle = '#27ae60'; // 綠色小恐龍
        // 身體
        ctx.fillRect(this.x, this.y, this.width, this.height);
        // 頭部
        if (this.dir === 1) {
            ctx.fillRect(this.x + this.width - 5, this.y - 10, 10, 15);
        } else {
            ctx.fillRect(this.x - 5, this.y - 10, 10, 15);
        }
        // 背刺
        ctx.fillStyle = '#16a085';
        for(let i=0; i<3; i++) {
            ctx.beginPath();
            ctx.moveTo(this.x + i*10, this.y);
            ctx.lineTo(this.x + i*10 + 5, this.y - 5);
            ctx.lineTo(this.x + i*10 + 10, this.y);
            ctx.fill();
        }
    }
}

class Platform {
    constructor(x, width) {
        this.x = x;
        this.y = canvas.height;
        this.width = width;
        this.height = 15;
        this.vy = -115; // 向上移動速度 (原 -100)
        this.color = '#2ecc71';
        this.healed = false; // 舊的補血邏輯，我們保留供參考或棄用
        
        this.item = null;
        this.enemy = null;

        // 調整機率：15% 金幣，35% 恐龍 (恐龍變多了！)
        let rand = Math.random();
        if (rand < 0.15) {
            this.item = new Coin(this);
        } else if (rand < 0.5) {
            this.enemy = new Dinosaur(this);
        }
    }

    update(deltaTime) {
        const dt = deltaTime / 1000;
        const speedMultiplier = 1 + (score / 1500); 
        this.y += (this.vy * speedMultiplier) * dt;
        
        if (this.item) this.item.update();
        if (this.enemy) this.enemy.update(deltaTime);
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.strokeStyle = '#27ae60';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        
        if (this.item) this.item.draw(ctx);
        if (this.enemy) this.enemy.draw(ctx);
    }
}

function spawnPlatform() {
    let width = Math.random() * 80 + 80;
    let x = Math.random() * (canvas.width - width);
    platforms.push(new Platform(x, width));
}

// 玩家類別
class Player {
    constructor() {
        this.width = 30;
        this.height = 30;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = 100; 
        this.vx = 0;
        this.vy = 0;
        this.speed = 300; 
        this.gravity = 1500; 
        this.jumpPower = -600; // 跳躍力量
        this.color = '#3498db';
        this.hearts = 5;
        this.invincibleTimer = 0;
        this.isGrounded = false;
    }

    update(deltaTime) {
        const dt = deltaTime / 1000;
        
        if (this.invincibleTimer > 0) {
            this.invincibleTimer -= dt;
        }

        // 左右移動
        if (keys.ArrowLeft) {
            this.vx = -this.speed;
        } else if (keys.ArrowRight) {
            this.vx = this.speed;
        } else {
            this.vx = 0;
        }

        // 跳躍邏輯
        if ((keys.ArrowUp || keys.Space) && this.isGrounded) {
            this.vy = this.jumpPower;
            this.isGrounded = false;
        }

        this.x += this.vx * dt;
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;

        this.vy += this.gravity * dt;
        this.y += this.vy * dt;

        let onPlatform = false;

        // 碰撞偵測
        for (let p of platforms) {
            // 檢查玩家與平台的碰撞
            if (this.vy >= -200) { // 稍微放寬，讓向上跳躍後也能安全降落
                if (this.x < p.x + p.width && this.x + this.width > p.x) {
                    let prevBottom = this.y + this.height - (this.vy * dt);
                    let currentPlatformVy = p.vy * (1 + (score / 1500));
                    let prevPlatformTop = p.y - (currentPlatformVy * dt);
                    
                    if (prevBottom <= prevPlatformTop + 15 && this.y + this.height >= p.y) {
                        this.y = p.y - this.height;
                        this.vy = currentPlatformVy;
                        this.isGrounded = true;
                        onPlatform = true;
                    }
                }
            }
            
            // 檢查玩家與金幣的碰撞
            if (p.item && !p.item.collected) {
                if (this.x < p.item.x + p.item.width && this.x + this.width > p.item.x &&
                    this.y < p.item.y + p.item.height && this.y + this.height > p.item.y) {
                    p.item.collected = true;
                    this.hearts = Math.min(5, this.hearts + 1); // 金幣加愛心
                }
            }

            // 檢查玩家與恐龍的碰撞
            if (p.enemy && this.invincibleTimer <= 0) {
                if (this.x < p.enemy.x + p.enemy.width && this.x + this.width > p.enemy.x &&
                    this.y < p.enemy.y + p.enemy.height && this.y + this.height > p.enemy.y) {
                    this.hearts--;
                    this.invincibleTimer = 1.5; // 1.5 秒無敵時間
                    if (this.hearts <= 0) gameOver();
                }
            }
        }

        if (!onPlatform) {
            this.isGrounded = false;
        }
    }

    draw(ctx) {
        // 無敵時間閃爍效果
        if (this.invincibleTimer > 0 && Math.floor(Date.now() / 100) % 2 === 0) {
            return;
        }

        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        ctx.strokeStyle = '#2980b9';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        
        // 眼睛
        ctx.fillStyle = '#fff';
        if (this.vx >= 0) {
            ctx.fillRect(this.x + 18, this.y + 6, 8, 8);
        } else {
            ctx.fillRect(this.x + 4, this.y + 6, 8, 8);
        }
    }
}

let player;

function drawCeiling(ctx) {
    ctx.fillStyle = '#7f8c8d';
    for (let i = 0; i < canvas.width; i += 20) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + 10, 20);
        ctx.lineTo(i + 20, 0);
        ctx.fill();
    }
    ctx.fillRect(0, 0, canvas.width, 5);
}

function init() {
    isGameOver = false;
    score = 0;
    player = new Player();
    platforms.length = 0; 
    platformSpawnTimer = 0;
    
    platforms.push(new Platform(player.x - 20, 100));
    platforms[0].y = player.y + 150; 
    platforms[0].item = null; // 初始平台不要隨機出東西
    platforms[0].enemy = null;

    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function gameOver() {
    isGameOver = true;
}

function update(deltaTime) {
    if (isGameOver) return;
    
    const dt = deltaTime / 1000;
    score += dt * 10;

    platformSpawnTimer += deltaTime;
    let currentSpawnInterval = Math.max(700, platformSpawnInterval - score * 0.5); 
    if (platformSpawnTimer >= currentSpawnInterval) {
        spawnPlatform();
        platformSpawnTimer = 0;
    }

    for (let i = platforms.length - 1; i >= 0; i--) {
        platforms[i].update(deltaTime);
        if (platforms[i].y + platforms[i].height < 0) {
            platforms.splice(i, 1);
        }
    }

    player.update(deltaTime);
    
    if (player.y > canvas.height) {
        player.hearts = 0;
        gameOver();
    }
    
    if (player.y <= 20) { 
        player.y = 20;
        // 卡在針刺每秒扣 1.5 顆心 (大約 0.6 秒扣一顆)
        if (player.invincibleTimer <= 0) {
            player.hearts--;
            player.invincibleTimer = 0.5;
            if (player.hearts <= 0) gameOver();
        }
    }
}

// 繪製愛心 UI
function drawHearts(ctx) {
    const startX = canvas.width - 150;
    const startY = 25;
    const size = 20;

    for (let i = 0; i < 5; i++) {
        const x = startX + i * 25;
        const y = startY;
        
        ctx.beginPath();
        // 繪製簡單的心形
        ctx.moveTo(x + size/2, y + size/4);
        ctx.bezierCurveTo(x + size/2, y, x, y, x, y + size/2);
        ctx.bezierCurveTo(x, y + size*0.75, x + size/2, y + size, x + size/2, y + size);
        ctx.bezierCurveTo(x + size/2, y + size, x + size, y + size*0.75, x + size, y + size/2);
        ctx.bezierCurveTo(x + size, y, x + size/2, y, x + size/2, y + size/4);
        
        if (i < player.hearts) {
            ctx.fillStyle = '#e74c3c'; // 實心紅
            ctx.fill();
        } else {
            ctx.strokeStyle = '#fff'; // 空心白框
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }
}

function drawUI(ctx) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('地下: ' + Math.floor(score/10) + ' 層', 15, 45); 
    
    drawHearts(ctx);
}

function drawGameOver(ctx) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 45px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2 - 40);
    
    ctx.fillStyle = '#fff';
    ctx.font = '24px Arial';
    ctx.fillText('最終成績: ' + Math.floor(score/10) + ' 層', canvas.width / 2, canvas.height / 2 + 10);
    
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 20px Arial';
    ctx.fillText('按下 [ 空白鍵 ] 浴火重生', canvas.width / 2, canvas.height / 2 + 70);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    for (let p of platforms) {
        p.draw(ctx);
    }
    player.draw(ctx);
    drawCeiling(ctx);
    drawUI(ctx);
    
    if (isGameOver) {
        drawGameOver(ctx);
    }
}

function gameLoop(timestamp) {
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    const safeDeltaTime = Math.min(deltaTime, 32);
    update(safeDeltaTime);
    draw();
    if (!isGameOver) {
        requestAnimationFrame(gameLoop);
    } 
}

window.onload = () => {
    lastTime = performance.now();
    init();
};
