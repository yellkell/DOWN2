/*
 * Grid Spawner System
 * Spawns neon-edged obstacles from below.
 * NO blue panel - removed the glass floor visual.
 */

AFRAME.registerSystem('grid-spawner', {
    init: function () {
        this.gridSize = 2;
        this.totalSize = 1.5;
        this.cellSize = this.totalSize / this.gridSize;

        this.projectiles = [];
        this.timer = 0;
        this.isActive = false; // Start inactive until game begins

        // Base difficulty settings (will be modified by hard mode)
        this.baseSpawnInterval = 1500;
        this.baseSpeed = 15.0;
        this.spawnInterval = this.baseSpawnInterval;
        this.spawnY = -60;
        this.targetY = 3;
        this.speed = this.baseSpeed;

        // Hard mode settings
        this.hardMode = false;
        this.currentPhase = 1;
        this.totalPhases = 3;
        this.spawnChance = 0.6; // Base chance to spawn in each cell

        // Kill zone settings
        this.killZoneSize = this.totalSize + 0.4;
        this.killZoneHeight = 5;

        if (this.sceneEl.hasLoaded) {
            this.setup();
        } else {
            this.sceneEl.addEventListener('loaded', this.setup.bind(this));
        }

        // Listen for mode changes
        this.sceneEl.addEventListener('mode-change', (evt) => {
            this.hardMode = evt.detail.hardMode;
            this.updateDifficulty();
            console.log(`Grid spawner: Mode set to ${this.hardMode ? 'HARD' : 'NORMAL'}`);
        });

        this.sceneEl.addEventListener('phase-change', (evt) => {
            if (evt.detail.newPhase === 'SLIDE') {
                this.isActive = false;
                this.clearProjectiles();
            } else if (evt.detail.newPhase === 'GRID') {
                this.hardMode = evt.detail.hardMode || false;
                this.currentPhase = evt.detail.currentPhase || 1;
                this.totalPhases = evt.detail.totalPhases || 3;
                this.updateDifficulty();
                this.isActive = true;
            } else if (evt.detail.newPhase === 'WIN' || evt.detail.newPhase === 'GAME_OVER') {
                this.isActive = false;
            }
        });

        this.sceneEl.addEventListener('game-start', (evt) => {
            this.hardMode = evt.detail?.hardMode || false;
            this.currentPhase = evt.detail?.currentPhase || 1;
            this.totalPhases = evt.detail?.totalPhases || 3;
            this.updateDifficulty();
            this.isActive = true;
        });
    },

    updateDifficulty: function () {
        // Progressive difficulty
        // Phase progress: 0.2, 0.4, 0.6, 0.8, 1.0 for 5 phases
        const phaseProgress = this.currentPhase / this.totalPhases;

        // Spawn interval decreases (faster spawns) as phases progress
        // Phase 1: 1400ms, Phase 5: 900ms
        this.spawnInterval = Math.floor(1400 - (phaseProgress * 500));

        // Speed increases as phases progress
        // Phase 1: 16, Phase 5: 22
        this.speed = 16 + (phaseProgress * 6);

        // Spawn chance increases (more projectiles per wave)
        // Phase 1: 0.65, Phase 5: 0.85 (but never impossible - always 1 safe spot)
        this.spawnChance = 0.65 + (phaseProgress * 0.2);

        console.log(`Difficulty - Phase ${this.currentPhase}/${this.totalPhases}: interval=${this.spawnInterval}ms, speed=${this.speed.toFixed(1)}, spawnChance=${this.spawnChance.toFixed(2)}`);
    },

    setup: function () {
        console.log("Grid Spawner Setup");
        const gridFloor = document.querySelector('#grid-floor');
        if (gridFloor) {
            this.container = document.createElement('a-entity');
            gridFloor.appendChild(this.container);

            // Just simple grid lines - NO blue panel
            this.createGridLines(this.container);

            // Create floor-level kill zone border (visible danger line on floor)
            this.createKillZoneFloorLine(this.container);
        }
    },

    createKillZoneFloorLine: function (parent) {
        // Floor-level danger line around the grid - sleek thin lines
        const killZoneHalf = this.killZoneSize / 2;
        const lineThickness = 0.03; // Thinner, more elegant
        const lineColor = '#ff2200';

        const floorBorders = [
            // Front line
            { pos: { x: 0, y: 0.01, z: killZoneHalf }, w: this.killZoneSize + lineThickness, d: lineThickness },
            // Back line
            { pos: { x: 0, y: 0.01, z: -killZoneHalf }, w: this.killZoneSize + lineThickness, d: lineThickness },
            // Left line
            { pos: { x: -killZoneHalf, y: 0.01, z: 0 }, w: lineThickness, d: this.killZoneSize },
            // Right line
            { pos: { x: killZoneHalf, y: 0.01, z: 0 }, w: lineThickness, d: this.killZoneSize }
        ];

        floorBorders.forEach(border => {
            const floorLine = document.createElement('a-box');
            floorLine.setAttribute('position', border.pos);
            floorLine.setAttribute('width', border.w);
            floorLine.setAttribute('height', 0.01);
            floorLine.setAttribute('depth', border.d);
            floorLine.setAttribute('material', {
                color: lineColor,
                emissive: lineColor,
                emissiveIntensity: 1.5,
                shader: 'flat'
            });
            parent.appendChild(floorLine);
        });

        // Add corner hexagons instead of ugly circles
        const corners = [
            { x: -killZoneHalf, z: killZoneHalf },
            { x: killZoneHalf, z: killZoneHalf },
            { x: -killZoneHalf, z: -killZoneHalf },
            { x: killZoneHalf, z: -killZoneHalf }
        ];

        corners.forEach(corner => {
            // Hexagon marker using cylinder with 6 segments
            const hexMarker = document.createElement('a-cylinder');
            hexMarker.setAttribute('position', { x: corner.x, y: 0.02, z: corner.z });
            hexMarker.setAttribute('radius', 0.04);
            hexMarker.setAttribute('height', 0.01);
            hexMarker.setAttribute('segments-radial', 6); // Makes it a hexagon
            hexMarker.setAttribute('rotation', '0 30 0'); // Rotate for flat edge forward
            hexMarker.setAttribute('material', {
                color: '#ff4400',
                emissive: '#ff4400',
                emissiveIntensity: 2,
                shader: 'flat'
            });
            parent.appendChild(hexMarker);
        });
    },

    createGridLines: function (parent) {
        // Grid cross lines only - no floor panel
        const lineH = document.createElement('a-box');
        lineH.setAttribute('width', this.totalSize);
        lineH.setAttribute('height', 0.02);
        lineH.setAttribute('depth', 0.02);
        lineH.setAttribute('material', 'color: #00ffff; emissive: #00ffff; emissiveIntensity: 1');
        parent.appendChild(lineH);

        const lineV = document.createElement('a-box');
        lineV.setAttribute('width', 0.02);
        lineV.setAttribute('height', 0.02);
        lineV.setAttribute('depth', this.totalSize);
        lineV.setAttribute('material', 'color: #00ffff; emissive: #00ffff; emissiveIntensity: 1');
        parent.appendChild(lineV);

        // Outer frame
        const frameSize = this.totalSize / 2 + 0.01;
        const edges = [
            { pos: { x: -frameSize, y: 0, z: 0 }, w: 0.02, d: this.totalSize },
            { pos: { x: frameSize, y: 0, z: 0 }, w: 0.02, d: this.totalSize },
            { pos: { x: 0, y: 0, z: -frameSize }, w: this.totalSize, d: 0.02 },
            { pos: { x: 0, y: 0, z: frameSize }, w: this.totalSize, d: 0.02 }
        ];
        edges.forEach(e => {
            const edge = document.createElement('a-box');
            edge.setAttribute('position', e.pos);
            edge.setAttribute('width', e.w);
            edge.setAttribute('height', 0.02);
            edge.setAttribute('depth', e.d);
            edge.setAttribute('material', 'color: #00ffff; emissive: #00ffff; emissiveIntensity: 0.8');
            parent.appendChild(edge);
        });
    },


    // Check if player's head position is outside the kill zone (INVISIBLE - no visual border)
    isOutsideKillZone: function (headWorldPos) {
        if (!this.container) return false;

        // Get grid floor world position
        const gridFloor = document.querySelector('#grid-floor');
        if (!gridFloor) return false;

        const gridWorldPos = new THREE.Vector3();
        gridFloor.object3D.getWorldPosition(gridWorldPos);

        // Calculate relative position of head to grid center
        const relativeX = headWorldPos.x - gridWorldPos.x;
        const relativeZ = headWorldPos.z - gridWorldPos.z;

        // Check if outside kill zone boundary
        const halfSize = this.killZoneSize / 2;

        return Math.abs(relativeX) > halfSize || Math.abs(relativeZ) > halfSize;
    },

    clearProjectiles: function () {
        this.projectiles.forEach(p => {
            if (p.container && p.container.parentNode) {
                p.container.parentNode.removeChild(p.container);
            }
        });
        this.projectiles = [];
    },

    tick: function (time, timeDelta) {
        if (!this.isActive) return;

        this.timer += timeDelta;
        if (this.timer > this.spawnInterval) {
            this.timer = 0;
            this.spawnWave();
        }

        const dtSec = timeDelta / 1000;
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            const pos = proj.container.object3D.position;
            pos.y += this.speed * dtSec;

            proj.container.object3D.rotation.x += 1.5 * dtSec;
            proj.container.object3D.rotation.z += 1.0 * dtSec;

            if (pos.y > this.targetY) {
                if (proj.container.parentNode) proj.container.parentNode.removeChild(proj.container);
                this.projectiles.splice(i, 1);
            }
        }
    },

    spawnWave: function () {
        const safeQuad = Math.floor(Math.random() * 4);

        // In hard mode later phases, occasionally have 2 safe spots for variety
        // This prevents the game from feeling too relentless
        let secondSafeQuad = -1;
        if (this.hardMode && this.currentPhase >= 3 && Math.random() < 0.25) {
            // 25% chance for a second safe spot in hard mode phase 3+
            do {
                secondSafeQuad = Math.floor(Math.random() * 4);
            } while (secondSafeQuad === safeQuad);
        }

        for (let r = 0; r < 2; r++) {
            for (let c = 0; c < 2; c++) {
                const idx = r * 2 + c;
                // Always keep at least one safe quadrant
                if (idx === safeQuad) continue;
                if (idx === secondSafeQuad) continue;

                // Use dynamic spawn chance (higher in hard mode later phases)
                if (Math.random() > this.spawnChance) continue;
                this.spawnProjectile(r, c);
            }
        }
    },

    spawnProjectile: function (row, col) {
        const x = (col * this.cellSize) - (this.totalSize / 2) + (this.cellSize / 2);
        const z = (row * this.cellSize) - (this.totalSize / 2) + (this.cellSize / 2);

        const shapes = ['tetrahedron', 'octahedron', 'dodecahedron', 'icosahedron'];
        const shape = shapes[Math.floor(Math.random() * shapes.length)];

        // Colors - aggressive palette with hot pink and orange
        const colors = ['#ff0066', '#ff00ff', '#ff3300', '#ffff00', '#00ffff'];
        const color = colors[Math.floor(Math.random() * colors.length)];

        // Scale increases slightly as phases progress
        const baseScale = 0.3 + Math.random() * 0.2;
        const phaseBonus = (this.currentPhase / this.totalPhases) * 0.08;
        const scale = baseScale + phaseBonus;

        const container = document.createElement('a-entity');
        container.setAttribute('position', { x: x, y: this.spawnY, z: z });
        container.classList.add('obstacle');

        const fill = document.createElement('a-entity');
        fill.setAttribute('geometry', { primitive: shape, radius: scale * 0.9 });
        fill.setAttribute('material', { color: '#000000', shader: 'flat' });
        container.appendChild(fill);

        const wireframe = document.createElement('a-entity');
        wireframe.setAttribute('geometry', { primitive: shape, radius: scale });
        wireframe.setAttribute('material', {
            color: color,
            emissive: color,
            emissiveIntensity: 2,
            wireframe: true
        });
        container.appendChild(wireframe);

        this.container.appendChild(container);
        this.projectiles.push({ container: container, radius: scale });
    },

    getProjectiles: function () {
        return this.projectiles;
    }
});
