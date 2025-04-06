import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

class Game {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: PointerLockControls;
    private moveForward: boolean = false;
    private moveBackward: boolean = false;
    private moveLeft: boolean = false;
    private moveRight: boolean = false;
    private velocity: THREE.Vector3 = new THREE.Vector3();
    private direction: THREE.Vector3 = new THREE.Vector3();
    private blocks: THREE.Mesh[] = [];
    private raycaster: THREE.Raycaster;
    private mouse: THREE.Vector2;
    private canShoot: boolean = true;
    private shootCooldown: number = 500; // milliseconds
    private lastShootTime: number = 0;
    private worldSeed: number = 12345; // Fixed seed for consistent generation
    private chunkSize: number = 16;
    private loadedChunks: Set<string> = new Set();
    private lastChunkX: number = 0;
    private lastChunkZ: number = 0;
    private debug: boolean = true; // Debug flag
    private debugPanel: HTMLDivElement = document.createElement('div'); // Initialize with empty div
    private lastCollision: boolean = false;
    private lastMovement: string = '';

    constructor() {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue background

        // Create camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.y = 2;

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);

        // Create debug panel
        this.createDebugPanel();

        // Setup controls
        this.controls = new PointerLockControls(this.camera, document.body);

        // Setup raycaster for shooting
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Add lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight.position.set(10, 20, 0);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);

        // Create world
        this.createWorld();

        // Event listeners
        document.addEventListener('click', () => {
            this.controls.lock();
        });

        document.addEventListener('keydown', (event) => this.onKeyDown(event));
        document.addEventListener('keyup', (event) => this.onKeyUp(event));
        document.addEventListener('mousedown', (event) => this.onMouseDown(event));
        window.addEventListener('resize', () => this.onWindowResize());

        // Create initial world
        this.generateChunksAroundPlayer();

        // Start animation loop
        this.animate();
    }

    private createDebugPanel() {
        this.debugPanel.style.position = 'fixed';
        this.debugPanel.style.bottom = '10px';
        this.debugPanel.style.left = '10px';
        this.debugPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        this.debugPanel.style.color = 'white';
        this.debugPanel.style.padding = '10px';
        this.debugPanel.style.fontFamily = 'monospace';
        this.debugPanel.style.fontSize = '12px';
        this.debugPanel.style.zIndex = '1000';
        document.body.appendChild(this.debugPanel);
    }

    private updateDebugPanel() {
        if (!this.debug) {
            this.debugPanel.style.display = 'none';
            return;
        }

        this.debugPanel.style.display = 'block';
        const movement = this.moveForward ? 'F' : this.moveBackward ? 'B' : this.moveLeft ? 'L' : this.moveRight ? 'R' : 'None';
        const velocity = `X: ${this.velocity.x.toFixed(2)} Y: ${this.velocity.y.toFixed(2)} Z: ${this.velocity.z.toFixed(2)}`;
        const position = `X: ${this.camera.position.x.toFixed(2)} Y: ${this.camera.position.y.toFixed(2)} Z: ${this.camera.position.z.toFixed(2)}`;
        
        this.debugPanel.innerHTML = `
            Movement: ${movement}<br>
            Velocity: ${velocity}<br>
            Position: ${position}<br>
            Collision: ${this.lastCollision ? 'Yes' : 'No'}<br>
            Last Movement: ${this.lastMovement}<br>
            Controls Locked: ${this.controls.isLocked ? 'Yes' : 'No'}<br>
            Press 'D' to toggle debug
        `;
    }

    private onMouseDown(event: MouseEvent) {
        if (this.controls.isLocked && this.canShoot) {
            this.shoot();
            this.canShoot = false;
            this.lastShootTime = performance.now();
        }
    }

    private shoot() {
        // Update mouse position
        this.mouse.x = 0;
        this.mouse.y = 0;

        // Update raycaster
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Find intersected objects
        const intersects = this.raycaster.intersectObjects(this.blocks);

        if (intersects.length > 0) {
            const hitBlock = intersects[0].object as THREE.Mesh;
            // Create explosion effect
            this.createExplosion(hitBlock.position);
            // Remove the hit block
            this.scene.remove(hitBlock);
            this.blocks = this.blocks.filter(block => block !== hitBlock);
        }
    }

    private createExplosion(position: THREE.Vector3) {
        // Create particle effect
        const particleCount = 10;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = position.x;
            positions[i * 3 + 1] = position.y;
            positions[i * 3 + 2] = position.z;

            velocities[i * 3] = (Math.random() - 0.5) * 2;
            velocities[i * 3 + 1] = Math.random() * 2;
            velocities[i * 3 + 2] = (Math.random() - 0.5) * 2;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({ 
            color: 0xff0000,
            size: 0.1,
            transparent: true,
            opacity: 0.8
        });

        const particles = new THREE.Points(geometry, material);
        this.scene.add(particles);

        // Animate particles
        const animateParticles = () => {
            const positions = particles.geometry.attributes.position.array as Float32Array;
            for (let i = 0; i < particleCount; i++) {
                positions[i * 3] += velocities[i * 3];
                positions[i * 3 + 1] += velocities[i * 3 + 1];
                positions[i * 3 + 2] += velocities[i * 3 + 2];
                velocities[i * 3 + 1] -= 0.1; // Gravity
            }
            particles.geometry.attributes.position.needsUpdate = true;
        };

        // Remove particles after animation
        setTimeout(() => {
            this.scene.remove(particles);
        }, 1000);
    }

    private createWorld() {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        
        // Create materials for different block types
        const materials = {
            dirt: new THREE.MeshStandardMaterial({ 
                color: 0x8B4513,
                roughness: 0.8,
                metalness: 0.2
            }),
            grass: new THREE.MeshStandardMaterial({ 
                color: 0x567D46,
                roughness: 0.8,
                metalness: 0.2
            }),
            stone: new THREE.MeshStandardMaterial({ 
                color: 0x808080,
                roughness: 0.9,
                metalness: 0.1
            }),
            wood: new THREE.MeshStandardMaterial({ 
                color: 0x8B4513,
                roughness: 0.7,
                metalness: 0.3
            })
        };
        
        // Create a larger world (20x20)
        for (let x = -10; x < 10; x++) {
            for (let z = -10; z < 10; z++) {
                // Create ground blocks
                const groundBlock = new THREE.Mesh(geometry, materials.dirt);
                groundBlock.position.set(x, -1, z);
                groundBlock.receiveShadow = true;
                this.scene.add(groundBlock);
                this.blocks.push(groundBlock);

                // Add grass on top of dirt
                const grassBlock = new THREE.Mesh(geometry, materials.grass);
                grassBlock.position.set(x, 0, z);
                grassBlock.receiveShadow = true;
                this.scene.add(grassBlock);
                this.blocks.push(grassBlock);

                // Add some random blocks above ground
                if (Math.random() < 0.2) {
                    const height = Math.floor(Math.random() * 4) + 1;
                    for (let y = 1; y < height; y++) {
                        const block = new THREE.Mesh(geometry, materials.stone);
                        block.position.set(x, y, z);
                        block.castShadow = true;
                        block.receiveShadow = true;
                        this.scene.add(block);
                        this.blocks.push(block);
                    }
                }
            }
        }

        // Add some trees
        for (let i = 0; i < 10; i++) {
            const x = Math.floor(Math.random() * 18) - 9;
            const z = Math.floor(Math.random() * 18) - 9;
            
            // Create tree trunk
            for (let y = 1; y <= 4; y++) {
                const trunk = new THREE.Mesh(geometry, materials.wood);
                trunk.position.set(x, y, z);
                trunk.castShadow = true;
                trunk.receiveShadow = true;
                this.scene.add(trunk);
                this.blocks.push(trunk);
            }

            // Create tree leaves
            for (let y = 4; y <= 6; y++) {
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dz = -1; dz <= 1; dz++) {
                        const leaf = new THREE.Mesh(geometry, materials.grass);
                        leaf.position.set(x + dx, y, z + dz);
                        leaf.castShadow = true;
                        leaf.receiveShadow = true;
                        this.scene.add(leaf);
                        this.blocks.push(leaf);
                    }
                }
            }
        }
    }

    private onKeyDown(event: KeyboardEvent) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.moveForward = true;
                this.lastMovement = 'Forward';
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.moveBackward = true;
                this.lastMovement = 'Backward';
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.moveLeft = true;
                this.lastMovement = 'Left';
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.moveRight = true;
                this.lastMovement = 'Right';
                break;
            case 'Space':
                this.jump();
                this.lastMovement = 'Jump';
                break;
            case 'KeyD':
                this.debug = !this.debug;
                break;
        }
    }

    private jump() {
        // Check if player is on ground (within 0.1 units of ground)
        const groundCheck = new THREE.Vector3(
            this.camera.position.x,
            this.camera.position.y - 1.8, // Check at player's feet
            this.camera.position.z
        );
        
        const ray = new THREE.Raycaster(groundCheck, new THREE.Vector3(0, -1, 0), 0, 0.2);
        const intersects = ray.intersectObjects(this.blocks);
        
        if (intersects.length > 0) {
            this.velocity.y = 8; // Reduced jump height for more control
        }
    }

    private onKeyUp(event: KeyboardEvent) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.moveForward = false;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.moveBackward = false;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.moveLeft = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.moveRight = false;
                break;
        }
    }

    private onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    private generateChunksAroundPlayer() {
        const chunkX = Math.floor(this.camera.position.x / this.chunkSize);
        const chunkZ = Math.floor(this.camera.position.z / this.chunkSize);

        // Only regenerate if we've moved to a new chunk
        if (chunkX !== this.lastChunkX || chunkZ !== this.lastChunkZ) {
            this.lastChunkX = chunkX;
            this.lastChunkZ = chunkZ;

            // Generate chunks in a 3x3 grid around the player
            for (let x = -1; x <= 1; x++) {
                for (let z = -1; z <= 1; z++) {
                    const newChunkX = chunkX + x;
                    const newChunkZ = chunkZ + z;
                    const chunkKey = `${newChunkX},${newChunkZ}`;
                    
                    // Only generate if this chunk hasn't been generated before
                    if (!this.loadedChunks.has(chunkKey)) {
                        this.generateChunk(newChunkX, newChunkZ);
                    }
                }
            }
        }
    }

    private generateChunk(chunkX: number, chunkZ: number) {
        const chunkKey = `${chunkX},${chunkZ}`;
        if (this.loadedChunks.has(chunkKey)) return;

        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const materials = {
            dirt: new THREE.MeshStandardMaterial({ 
                color: 0x8B4513,
                roughness: 0.8,
                metalness: 0.2
            }),
            grass: new THREE.MeshStandardMaterial({ 
                color: 0x567D46,
                roughness: 0.8,
                metalness: 0.2
            }),
            stone: new THREE.MeshStandardMaterial({ 
                color: 0x808080,
                roughness: 0.9,
                metalness: 0.1
            }),
            wood: new THREE.MeshStandardMaterial({ 
                color: 0x8B4513,
                roughness: 0.7,
                metalness: 0.3
            })
        };

        // Generate terrain using noise
        for (let x = 0; x < this.chunkSize; x++) {
            for (let z = 0; z < this.chunkSize; z++) {
                const worldX = chunkX * this.chunkSize + x;
                const worldZ = chunkZ * this.chunkSize + z;
                
                // Check if blocks already exist at this position
                const existingBlocks = this.blocks.filter(block => 
                    block.position.x === worldX && 
                    block.position.z === worldZ
                );

                if (existingBlocks.length === 0) {
                    // Use seeded random for consistent generation
                    const height = this.getTerrainHeight(worldX, worldZ);
                    
                    // Create ground blocks with more gradual transitions
                    for (let y = -1; y <= height; y++) {
                        let material;
                        if (y === height) {
                            material = materials.grass;
                        } else if (y > height - 3) { // Reduced dirt layer thickness
                            material = materials.dirt;
                        } else {
                            // Add some variation to stone layer
                            const stoneNoise = this.noise(worldX * 0.1, worldZ * 0.1);
                            if (stoneNoise > 0.7) {
                                material = materials.dirt; // Occasional dirt pockets
                            } else {
                                material = materials.stone;
                            }
                        }

                        const block = new THREE.Mesh(geometry, material);
                        block.position.set(worldX, y, worldZ);
                        block.castShadow = true;
                        block.receiveShadow = true;
                        this.scene.add(block);
                        this.blocks.push(block);
                    }
                }
            }
        }

        // Generate trees in this chunk
        this.generateTrees(chunkX, chunkZ);

        this.loadedChunks.add(chunkKey);
    }

    private getTerrainHeight(x: number, z: number): number {
        // Improved noise function for more dynamic terrain
        const seed = this.worldSeed;
        const scale = 0.015; // Even smaller scale for much larger features
        const octaves = 8; // More octaves for smoother transitions
        let height = 0;
        let amplitude = 1;
        let frequency = 1;

        for (let i = 0; i < octaves; i++) {
            height += this.noise(x * scale * frequency, z * scale * frequency) * amplitude;
            amplitude *= 0.5;
            frequency *= 2;
        }

        // Add very large-scale variation for open spaces
        const largeScale = this.noise(x * 0.005, z * 0.005) * 8; // Increased scale for more open spaces
        
        // Normalize height to be between 0 and 8 with more gradual variation
        return Math.floor((height + largeScale + 1) * 4);
    }

    private noise(x: number, z: number): number {
        // Simple seeded random function
        const seed = this.worldSeed;
        const X = Math.floor(x) & 255;
        const Z = Math.floor(z) & 255;
        x -= Math.floor(x);
        z -= Math.floor(z);
        const u = this.fade(x);
        const v = this.fade(z);
        const A = this.hash(X) + Z;
        const B = this.hash(X + 1) + Z;
        return this.lerp(
            this.lerp(this.hash(A), this.hash(B), u),
            this.lerp(this.hash(A + 1), this.hash(B + 1), u),
            v
        );
    }

    private fade(t: number): number {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    private lerp(t: number, a: number, b: number): number {
        return a + t * (b - a);
    }

    private hash(n: number): number {
        const seed = this.worldSeed;
        let hash = seed;
        for (let i = 0; i < 5; i++) {
            hash = ((hash << 5) - hash) + n;
            hash = hash & hash;
        }
        return hash / 2147483647;
    }

    private generateTrees(chunkX: number, chunkZ: number) {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const materials = {
            wood: new THREE.MeshStandardMaterial({ 
                color: 0x8B4513,
                roughness: 0.7,
                metalness: 0.3
            }),
            grass: new THREE.MeshStandardMaterial({ 
                color: 0x567D46,
                roughness: 0.8,
                metalness: 0.2
            })
        };

        // Further reduce tree count to 0-1 trees per chunk
        const treeCount = Math.floor(this.hash(chunkX * 1000 + chunkZ));
        
        for (let i = 0; i < treeCount; i++) {
            const x = Math.floor(this.hash(chunkX * 1000 + chunkZ + i) * this.chunkSize);
            const z = Math.floor(this.hash(chunkX * 1000 + chunkZ + i + 1000) * this.chunkSize);
            const worldX = chunkX * this.chunkSize + x;
            const worldZ = chunkZ * this.chunkSize + z;
            const height = this.getTerrainHeight(worldX, worldZ);

            // Check if tree already exists at this position
            const existingTree = this.blocks.some(block => 
                block.position.x === worldX && 
                block.position.z === worldZ &&
                block.position.y > height
            );

            if (!existingTree) {
                // Create tree trunk (slightly taller and thinner)
                for (let y = height + 1; y <= height + 5; y++) {
                    const trunk = new THREE.Mesh(geometry, materials.wood);
                    trunk.position.set(worldX, y, worldZ);
                    trunk.castShadow = true;
                    trunk.receiveShadow = true;
                    this.scene.add(trunk);
                    this.blocks.push(trunk);
                }

                // Create tree leaves (more spread out)
                for (let y = height + 4; y <= height + 7; y++) {
                    for (let dx = -2; dx <= 2; dx++) {
                        for (let dz = -2; dz <= 2; dz++) {
                            // Skip corners for more natural look
                            if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
                            
                            const leaf = new THREE.Mesh(geometry, materials.grass);
                            leaf.position.set(worldX + dx, y, worldZ + dz);
                            leaf.castShadow = true;
                            leaf.receiveShadow = true;
                            this.scene.add(leaf);
                            this.blocks.push(leaf);
                        }
                    }
                }
            }
        }
    }

    private checkCollision(position: THREE.Vector3, direction: THREE.Vector3): boolean {
        // Create a small box around the player for collision detection
        const playerRadius = 0.3; // Half the width of a block
        const playerHeight = 1.8; // Player height in blocks
        
        // Check corners of the player's collision box
        const corners = [
            new THREE.Vector3(position.x + playerRadius, position.y, position.z + playerRadius),
            new THREE.Vector3(position.x + playerRadius, position.y, position.z - playerRadius),
            new THREE.Vector3(position.x - playerRadius, position.y, position.z + playerRadius),
            new THREE.Vector3(position.x - playerRadius, position.y, position.z - playerRadius),
            new THREE.Vector3(position.x + playerRadius, position.y + playerHeight, position.z + playerRadius),
            new THREE.Vector3(position.x + playerRadius, position.y + playerHeight, position.z - playerRadius),
            new THREE.Vector3(position.x - playerRadius, position.y + playerHeight, position.z + playerRadius),
            new THREE.Vector3(position.x - playerRadius, position.y + playerHeight, position.z - playerRadius)
        ];

        // Check each corner for collision with blocks in the specified direction
        for (const corner of corners) {
            const ray = new THREE.Raycaster(corner, direction, 0.1, 3);
            const intersects = ray.intersectObjects(this.blocks);
            
            if (intersects.length > 0) {
                return true;
            }
        }

        return false;
    }

    private animate() {
        requestAnimationFrame(() => this.animate());

        // Update shoot cooldown
        if (!this.canShoot && performance.now() - this.lastShootTime > this.shootCooldown) {
            this.canShoot = true;
        }

        if (this.controls.isLocked) {
            const time = performance.now();
            
            // Reduce velocity for smoother movement (reduced deceleration)
            this.velocity.x -= this.velocity.x * 1.0 * 0.016;
            this.velocity.z -= this.velocity.z * 1.0 * 0.016;
            this.velocity.y -= 9.8 * 0.016; // Gravity

            // Calculate movement direction
            this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
            this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
            this.direction.normalize();

            // Apply movement with increased speed and acceleration
            if (this.moveForward || this.moveBackward) {
                this.velocity.z -= this.direction.z * 400.0 * 0.016; // Doubled speed
            }
            if (this.moveLeft || this.moveRight) {
                this.velocity.x -= this.direction.x * 400.0 * 0.016; // Doubled speed
            }

            // Store current position
            const currentPosition = this.camera.position.clone();

            // Try movement in X and Z separately for better collision handling
            const newPositionX = currentPosition.clone();
            newPositionX.x -= this.velocity.x * 0.016;
            
            const newPositionZ = currentPosition.clone();
            newPositionZ.z -= this.velocity.z * 0.016;
            
            const newPositionY = currentPosition.clone();
            newPositionY.y += this.velocity.y * 0.016;

            // Apply movement with directional collision detection
            if (!this.checkCollision(newPositionX, new THREE.Vector3(Math.sign(this.velocity.x), 0, 0))) {
                this.camera.position.x = newPositionX.x;
            } else {
                this.velocity.x = 0; // Stop horizontal movement on collision
                this.lastCollision = true;
            }
            
            if (!this.checkCollision(newPositionZ, new THREE.Vector3(0, 0, Math.sign(this.velocity.z)))) {
                this.camera.position.z = newPositionZ.z;
            } else {
                this.velocity.z = 0; // Stop horizontal movement on collision
                this.lastCollision = true;
            }
            
            if (!this.checkCollision(newPositionY, new THREE.Vector3(0, Math.sign(this.velocity.y), 0))) {
                this.camera.position.y = newPositionY.y;
            } else {
                if (this.velocity.y < 0) { // Only stop vertical movement if falling
                    this.velocity.y = 0;
                    this.lastCollision = true;
                }
            }

            // Update controls position
            this.controls.moveRight(-this.velocity.x * 0.016);
            this.controls.moveForward(-this.velocity.z * 0.016);

            // Ground collision with smoother landing
            if (this.camera.position.y < 2) {
                this.camera.position.y = 2;
                this.velocity.y = 0;
                this.lastCollision = true;
            }

            // Generate new chunks as player moves
            this.generateChunksAroundPlayer();
        } else {
            this.lastCollision = false;
        }

        // Update debug panel
        this.updateDebugPanel();

        this.renderer.render(this.scene, this.camera);
    }
}

// Start the game
new Game(); 