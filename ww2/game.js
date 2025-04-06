let scene, camera, renderer, player;
let collectibles = [];
let obstacles = [];
let score = 0;
let gameSpeed = 0.1;
const worldSize = 100;

// Game configuration
const GAME_CONFIG = {
    obstacles: {
        minDensity: 0.1, 
        maxDensity: 1.5,  
        get minCount() { return Math.max(1, Math.ceil(worldSize * this.minDensity)); },
        get maxCount() { return Math.floor(worldSize * this.maxDensity); }
    },
    collectibles: {
        density: 0.005,     // 5% of world size
        get count() { return Math.ceil(worldSize * this.density); }
    }
};

let isGameOver = false;
let lives = 3;
let hasShield = false;
let shieldTimer = null;
let powerups = [];
let bullets = [];
let lastShot = 0;
const SHOT_COOLDOWN = 250; // Minimum time between shots in milliseconds

// Movement controls
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    w: false,
    a: false,
    s: false,
    d: false,
    ' ': false // space for boost
};

// Add event listeners for keyboard
document.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = true;
    }
    // Handle shooting with space
    if (e.key === ' ' && !isGameOver) {
        const now = Date.now();
        if (now - lastShot >= SHOT_COOLDOWN) {
            createBullet();
            lastShot = now;
        }
    }
});

document.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = false;
    }
});

// Movement speed and direction
const moveSpeed = 0.2;
const boostMultiplier = 2.0;

function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000033);

    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 8;
    camera.position.y = 4;
    camera.rotation.x = -0.3;

    // Create renderer
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Create player (blue ship)
    player = createPlayer();

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 10, 5);
    scene.add(directionalLight);

    // Create initial objects
    createCollectibles();
    createObstacles();
    createPowerup();

    // Add event listeners
    window.addEventListener('resize', onWindowResize, false);
    document.addEventListener('keydown', onKeyDown);
}

function createCollectibles() {
    const targetCount = GAME_CONFIG.collectibles.count;
    
    // Only create new collectibles if we're below the target count
    const numToCreate = targetCount - collectibles.length;
    
    for (let i = 0; i < numToCreate; i++) {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
        const collectible = new THREE.Mesh(geometry, material);
        
        // Random position ahead of player
        collectible.position.x = Math.random() * 20 - 10;
        collectible.position.y = Math.random() * 10 - 5;
        collectible.position.z = -(Math.random() * 50 + 20);
        
        collectibles.push(collectible);
        scene.add(collectible);
    }
}

function createObstacles() {
    const minObstacles = GAME_CONFIG.obstacles.minCount;
    const maxObstacles = GAME_CONFIG.obstacles.maxCount;
    const currentObstacleCount = obstacles.length;
    
    // Only create new obstacles if below minimum
    if (currentObstacleCount < minObstacles) {
        const numToCreate = minObstacles - currentObstacleCount;
        
        for (let i = 0; i < numToCreate; i++) {
            const geometry = new THREE.BoxGeometry(2, 2, 2);
            const material = new THREE.MeshPhongMaterial({ color: 0xff0000 });
            const obstacle = new THREE.Mesh(geometry, material);
            
            obstacle.position.x = Math.random() * 20 - 10;
            obstacle.position.y = Math.random() * 10 - 5;
            obstacle.position.z = -(Math.random() * 50 + 20);
            
            obstacles.push(obstacle);
            scene.add(obstacle);
        }
    }
}

function createPlayer() {
    // Create airplane body
    const bodyGeometry = new THREE.BoxGeometry(1, 0.4, 2);
    const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x0088ff });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);

    // Create wings
    const wingGeometry = new THREE.BoxGeometry(3, 0.1, 0.8);
    const wingMaterial = new THREE.MeshPhongMaterial({ color: 0x0066cc });
    const wings = new THREE.Mesh(wingGeometry, wingMaterial);
    wings.position.y = 0.1;

    // Create tail
    const tailGeometry = new THREE.BoxGeometry(0.8, 0.3, 0.4);
    const tailMaterial = new THREE.MeshPhongMaterial({ color: 0x0066cc });
    const tail = new THREE.Mesh(tailGeometry, tailMaterial);
    tail.position.z = -0.8;
    tail.position.y = 0.2;

    // Create vertical stabilizer
    const stabilizerGeometry = new THREE.BoxGeometry(0.1, 0.5, 0.6);
    const stabilizerMaterial = new THREE.MeshPhongMaterial({ color: 0x0066cc });
    const stabilizer = new THREE.Mesh(stabilizerGeometry, stabilizerMaterial);
    stabilizer.position.z = -0.8;
    stabilizer.position.y = 0.3;

    // Create nose cone
    const noseGeometry = new THREE.ConeGeometry(0.2, 0.5, 8);
    const noseMaterial = new THREE.MeshPhongMaterial({ color: 0x0088ff });
    const nose = new THREE.Mesh(noseGeometry, noseMaterial);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = 1;

    // Create airplane group
    player = new THREE.Group();
    player.add(body);
    player.add(wings);
    player.add(tail);
    player.add(stabilizer);
    player.add(nose);

    // Rotate the entire plane to face forward
    player.rotation.y = Math.PI;
    
    scene.add(player);
    return player;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(event) {
    if (isGameOver) return;
    
    const speed = 0.5;
    switch(event.key) {
        case 'ArrowLeft':
        case 'a':
            player.position.x -= speed;
            break;
        case 'ArrowRight':
        case 'd':
            player.position.x += speed;
            break;
        case 'ArrowUp':
        case 'w':
            player.position.y += speed;
            break;
        case 'ArrowDown':
        case 's':
            player.position.y -= speed;
            break;
        case ' ': // Spacebar
            const now = Date.now();
            if (now - lastShot >= SHOT_COOLDOWN) {
                createBullet();
                lastShot = now;
            }
            break;
    }
}

function showGameOver() {
    isGameOver = true;
    const gameOverScreen = document.getElementById('gameOver');
    const finalScoreDisplay = document.getElementById('finalScore');
    const restartButton = document.getElementById('restartButton');
    
    gameOverScreen.style.display = 'block';
    finalScoreDisplay.textContent = `Final Score: ${score}`;
    
    restartButton.onclick = () => {
        gameOverScreen.style.display = 'none';
        resetGame();
    };
}

function resetGame() {
    isGameOver = false;
    // Reset score
    score = 0;
    document.getElementById('score').textContent = 'Score: 0';
    
    // Reset player position
    player.position.set(0, 0, 0);
    
    // Reset game speed
    gameSpeed = 0.1;
    
    // Reset lives and shield
    lives = 3;
    hasShield = false;
    if (shieldTimer) clearTimeout(shieldTimer);
    
    // Remove all collectibles, obstacles, and power-ups
    collectibles.forEach(c => scene.remove(c));
    obstacles.forEach(o => scene.remove(o));
    powerups.forEach(p => scene.remove(p));
    collectibles = [];
    obstacles = [];
    powerups = [];
    
    // Clear bullets
    bullets.forEach(b => scene.remove(b));
    bullets = [];
    lastShot = 0;
    
    // Create new objects
    createCollectibles();
    createObstacles();
    createPowerup();
    updateUI();
}

function checkCollisions() {
    const playerBox = new THREE.Box3().setFromObject(player);

    // Check obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];
        const obstacleBox = new THREE.Box3().setFromObject(obstacle);
        if (playerBox.intersectsBox(obstacleBox)) {
            if (hasShield) {
                // Just remove the obstacle if shielded
                scene.remove(obstacle);
                obstacles.splice(i, 1);
                createObstacles();
            } else {
                lives--;
                updateUI();
                
                // Remove the obstacle that was hit
                scene.remove(obstacle);
                obstacles.splice(i, 1);
                createObstacles();
                
                if (lives <= 0) {
                    showGameOver();
                } else {
                    // Flash player to show damage
                    player.visible = false;
                    setTimeout(() => player.visible = true, 100);
                    setTimeout(() => player.visible = false, 200);
                    setTimeout(() => player.visible = true, 300);
                }
                break; // Exit the loop after handling one collision
            }
        }
    }

    // Check collectibles
    collectibles.forEach((collectible, index) => {
        const collectibleBox = new THREE.Box3().setFromObject(collectible);
        if (playerBox.intersectsBox(collectibleBox)) {
            scene.remove(collectible);
            collectibles.splice(index, 1);
            score += 10;
            document.getElementById('score').textContent = `Score: ${score}`;
            createCollectibles();
        }
    });

    // Check power-ups
    powerups.forEach((powerup, index) => {
        const powerupBox = new THREE.Box3().setFromObject(powerup);
        if (playerBox.intersectsBox(powerupBox)) {
            if (powerup.powerupType === 'shield') {
                activateShield();
            } else {  // life powerup
                lives = Math.min(lives + 1, 5);  // Max 5 lives
            }
            scene.remove(powerup);
            powerups.splice(index, 1);
            createPowerup();
            updateUI();
        }
    });
}

function moveObjects() {
    if (isGameOver) return;
    
    // Move collectibles
    collectibles.forEach((collectible) => {
        collectible.position.z += gameSpeed;
        if (collectible.position.z > 5) {
            collectible.position.z = -50;
            collectible.position.x = Math.random() * 20 - 10;
            collectible.position.y = Math.random() * 10 - 5;
        }
    });

    // Move obstacles
    obstacles.forEach((obstacle) => {
        obstacle.position.z += gameSpeed;
        if (obstacle.position.z > 5) {
            obstacle.position.z = -50;
            obstacle.position.x = Math.random() * 20 - 10;
            obstacle.position.y = Math.random() * 10 - 5;
        }
    });

    // Move power-ups
    powerups.forEach((powerup, index) => {
        powerup.position.z += gameSpeed;
        powerup.rotation.y += 0.02;  // Make them spin
        if (powerup.position.z > 5) {
            scene.remove(powerup);
            powerups.splice(index, 1);
            if (powerups.length < 1) createPowerup();
        }
    });

    // Move bullets
    bullets.forEach((bullet, bulletIndex) => {
        bullet.position.z -= 0.8; // Bullets move faster than other objects
        
        // Remove bullets that have gone too far
        if (bullet.position.z < -60) {
            scene.remove(bullet);
            bullets.splice(bulletIndex, 1);
            return;
        }
        
        // Check bullet collisions with obstacles
        obstacles.forEach((obstacle, obstacleIndex) => {
            // Check if any part of the bullet wave hits the obstacle
            const bulletBox = new THREE.Box3().setFromObject(bullet);
            const obstacleBox = new THREE.Box3().setFromObject(obstacle);
            
            if (bulletBox.intersectsBox(obstacleBox)) {
                // Remove both bullet wave and obstacle
                scene.remove(bullet);
                scene.remove(obstacle);
                bullets.splice(bulletIndex, 1);
                obstacles.splice(obstacleIndex, 1);
                
                // Create explosion effect
                createExplosion(obstacle.position);
                
                // Add score for destroying obstacle
                score += 5;
                updateUI();
                
                // Create new obstacle
                createObstacles();
            }
        });
    });

    // Increase game speed gradually
    gameSpeed += 0.0001;
}

function animate() {
    requestAnimationFrame(animate);
    
    updateMovement();
    
    moveObjects();
    if (!isGameOver) {
        checkCollisions();
    }
    renderer.render(scene, camera);
}

function createPowerup() {
    const type = Math.random() < 0.5 ? 'life' : 'shield';
    const geometry = new THREE.SphereGeometry(0.5, 8, 8);
    const material = new THREE.MeshPhongMaterial({ 
        color: type === 'life' ? 0xff69b4 : 0x00ffff,
        emissive: type === 'life' ? 0xff69b4 : 0x00ffff,
        emissiveIntensity: 0.5
    });
    const powerup = new THREE.Mesh(geometry, material);
    
    powerup.position.x = Math.random() * 20 - 10;
    powerup.position.y = Math.random() * 10 - 5;
    powerup.position.z = -(Math.random() * 50 + 20);
    powerup.powerupType = type;
    
    powerups.push(powerup);
    scene.add(powerup);
}

function updateUI() {
    const shieldStatus = hasShield ? "️ SHIELD ACTIVE" : "";
    const heartsDisplay = '1up '.repeat(lives);  // Using simple heart character
    document.getElementById('score').textContent = 
        `Score: ${score}  Lives: ${heartsDisplay}  ${shieldStatus}`;
}

function activateShield() {
    hasShield = true;
    updateUI();
    
    // Create shield visual effect around player
    const shieldGeometry = new THREE.SphereGeometry(2, 16, 16);
    const shieldMaterial = new THREE.MeshPhongMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.3
    });
    const shield = new THREE.Mesh(shieldGeometry, shieldMaterial);
    player.add(shield);
    shield.name = 'shield';

    // Remove shield after 10 seconds
    if (shieldTimer) clearTimeout(shieldTimer);
    shieldTimer = setTimeout(() => {
        hasShield = false;
        player.remove(shield);
        updateUI();
    }, 10000);
}

function createBullet() {
    const bulletGroup = new THREE.Group();
    const wingWidth = 3; // Width of the wings from player model
    const bulletCount = 5; // Number of bullets in the wave
    const spacing = wingWidth / (bulletCount - 1); // Even spacing across wing width
    
    // Create a wave of bullets
    for (let i = 0; i < bulletCount; i++) {
        const geometry = new THREE.SphereGeometry(0.2, 8, 8);
        const material = new THREE.MeshPhongMaterial({ 
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 0.5
        });
        const bulletPart = new THREE.Mesh(geometry, material);
        
        // Position each bullet part across the width of the wings
        bulletPart.position.copy(player.position);
        bulletPart.position.x += (i - (bulletCount - 1) / 2) * spacing;
        bulletPart.position.z -= 1; // Slightly in front of player
        
        // Add slight wave pattern
        bulletPart.position.y += Math.sin(i * Math.PI / 2) * 0.2;
        
        bulletGroup.add(bulletPart);
    }
    
    bullets.push(bulletGroup);
    scene.add(bulletGroup);
}

function createExplosion(position) {
    const particleCount = 20;
    const particles = new THREE.Group();
    
    for (let i = 0; i < particleCount; i++) {
        const geometry = new THREE.SphereGeometry(0.1, 4, 4);
        const material = new THREE.MeshPhongMaterial({ 
            color: 0xff4400,
            emissive: 0xff4400,
            emissiveIntensity: 0.5
        });
        const particle = new THREE.Mesh(geometry, material);
        
        particle.position.copy(position);
        particles.add(particle);
        
        // Random velocity for each particle
        particle.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.3,
            (Math.random() - 0.5) * 0.3,
            (Math.random() - 0.5) * 0.3
        );
    }
    
    scene.add(particles);
    
    // Animate explosion
    let frame = 0;
    const animateExplosion = () => {
        frame++;
        if (frame > 30) { // Remove after 30 frames
            scene.remove(particles);
            return;
        }
        
        particles.children.forEach(particle => {
            particle.position.add(particle.velocity);
            particle.scale.multiplyScalar(0.95); // Shrink particles
        });
        
        requestAnimationFrame(animateExplosion);
    };
    
    animateExplosion();
}

function updateMovement() {
    // Get movement direction from either keyboard or mobile controls
    let moveX = 0;
    let moveY = 0;
    let isBoosting = false;

    // Check keyboard controls
    if (keys.ArrowLeft || keys.a) moveX -= 1;
    if (keys.ArrowRight || keys.d) moveX += 1;
    if (keys.ArrowUp || keys.w) moveY += 1;
    if (keys.ArrowDown || keys.s) moveY -= 1;
    if (keys[' ']) isBoosting = true;

    // Check mobile controls if available
    if (window.mobileControls) {
        const joystickPos = window.mobileControls.getJoystickPosition();
        moveX += joystickPos.x / 50;
        moveY -= joystickPos.y / 50;
        if (window.mobileControls.isBoostPressed) isBoosting = true;
        
        // Handle shooting with mobile button
        if (window.mobileControls.isShootPressed && !isGameOver) {
            const now = Date.now();
            if (now - lastShot >= SHOT_COOLDOWN) {
                createBullet();
                lastShot = now;
            }
        }
    }

    // Normalize diagonal movement
    if (moveX !== 0 && moveY !== 0) {
        const length = Math.sqrt(moveX * moveX + moveY * moveY);
        moveX /= length;
        moveY /= length;
    }

    // Apply movement with boost
    const currentSpeed = isBoosting ? moveSpeed * boostMultiplier : moveSpeed;
    player.position.x += moveX * currentSpeed;
    player.position.y += moveY * currentSpeed;

    // Keep player within screen bounds
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const aspectRatio = screenWidth / screenHeight;
    
    // Calculate visible bounds based on camera position and field of view
    const fov = camera.fov * (Math.PI / 180);
    const visibleHeight = 2 * Math.tan(fov / 2) * Math.abs(camera.position.z);
    const visibleWidth = visibleHeight * aspectRatio;
    
    // Set bounds to keep player visible
    const xBound = visibleWidth / 2 - 1; // 1 unit padding from edge
    const yBound = visibleHeight / 2 - 1; // 1 unit padding from edge
    
    player.position.x = Math.max(-xBound, Math.min(xBound, player.position.x));
    player.position.y = Math.max(-yBound, Math.min(yBound, player.position.y));
}

init();
animate(); 