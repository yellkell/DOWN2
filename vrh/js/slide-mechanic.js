/*
 * Slide Mechanic System
 * Rectangle barriers stuck in the slide that player must dodge.
 * Positioned left, center, or right - always dodgeable.
 */

AFRAME.registerSystem('slide-mechanic', {
    init: function () {
        this.active = false;
        this.speed = 20.0;
        this.targetY = 0;
        this.obstacles = [];

        // Hard mode settings
        this.hardMode = false;
        this.currentPhase = 1;
        this.totalPhases = 3;

        // Listen for mode changes
        this.sceneEl.addEventListener('mode-change', (evt) => {
            this.hardMode = evt.detail.hardMode;
            console.log(`Slide mechanic: Mode set to ${this.hardMode ? 'HARD' : 'NORMAL'}`);
        });

        this.sceneEl.addEventListener('phase-change', (evt) => {
            if (evt.detail.newPhase === 'SLIDE') {
                this.targetY = evt.detail.targetY || 0;
                this.isFinalSlide = evt.detail.isFinal || false;
                this.hardMode = evt.detail.hardMode || false;
                this.currentPhase = evt.detail.currentPhase || 1;
                this.totalPhases = evt.detail.totalPhases || 3;
                this.startSlide();
            } else if (evt.detail.newPhase === 'GRID') {
                this.active = false;
                this.clearObstacles();
            } else if (evt.detail.newPhase === 'WIN' || evt.detail.newPhase === 'GAME_OVER') {
                this.active = false;
            }
        });
    },

    startSlide: function () {
        console.log("Slide System Activated");
        this.active = true;
        this.rig = document.querySelector('#rig');
        this.gridFloor = document.querySelector('#grid-floor');

        // Same speed for both modes
        this.currentSpeed = this.speed;

        this.spawnSlideObstacles();
    },

    spawnSlideObstacles: function () {
        if (!this.rig) return;

        const startY = this.rig.object3D.position.y;
        const startZ = this.rig.object3D.position.z;
        const endY = this.targetY;
        const slideAngle = 20;
        const rad = slideAngle * (Math.PI / 180);

        const heightDiff = startY - endY;
        const slideLength = heightDiff / Math.sin(rad);

        // Difficulty scaling based on phase progress
        let spacing, patterns;

        // Progressive difficulty with wider barriers
        // Includes far-left and far-right to prevent edge camping
        const phaseProgress = this.currentPhase / this.totalPhases;

        if (this.isFinalSlide) {
            // FINAL - densest and most challenging, forces movement
            spacing = 12;
            patterns = ['left', 'far-right', 'center', 'far-left', 'right', 'left-center', 'far-right', 'center-right', 'far-left'];
        } else if (phaseProgress <= 0.2) {
            // Phase 1 of 5 - Still learning but can't camp edges
            spacing = 20;
            patterns = ['left', 'center', 'right', 'far-left', 'center', 'far-right'];
        } else if (phaseProgress <= 0.4) {
            // Phase 2 of 5 - Getting harder
            spacing = 16;
            patterns = ['left', 'far-right', 'center', 'far-left', 'right', 'center'];
        } else if (phaseProgress <= 0.6) {
            // Phase 3 of 5 - Challenging
            spacing = 14;
            patterns = ['far-left', 'center-right', 'far-right', 'left-center', 'center', 'far-left'];
        } else if (phaseProgress <= 0.8) {
            // Phase 4 of 5 - Very hard
            spacing = 13;
            patterns = ['left-center', 'far-right', 'center-right', 'far-left', 'center', 'far-right', 'left'];
        } else {
            // Phase 5 of 5 - Maximum challenge before final
            spacing = 12;
            patterns = ['far-left', 'center', 'far-right', 'left-center', 'far-left', 'center-right', 'far-right'];
        }

        const count = Math.floor(slideLength / spacing);
        console.log(`Spawning ${count - 1} barriers (skipping first), spacing: ${spacing}, phase: ${this.currentPhase}/${this.totalPhases}`);

        // Start from i=2 to skip the first obstacle - gives player a moment to adjust
        for (let i = 2; i <= count; i++) {
            const dist = i * spacing;
            const dz = -Math.cos(rad) * dist;
            const dy = -Math.sin(rad) * dist;

            const posY = startY + dy;
            const posZ = startZ + dz;

            const pattern = patterns[i % patterns.length];

            // Spawn barrier(s) based on pattern - positions adjusted for wider hard mode barriers
            const spread = this.hardMode ? 0.35 : 0.4; // Tighter positions in hard mode
            const farSpread = 0.7; // Far edge positions - forces players off the rails

            if (pattern === 'left') {
                this.spawnBarrier(-spread, posY, posZ);
            } else if (pattern === 'center') {
                this.spawnBarrier(0, posY, posZ);
            } else if (pattern === 'right') {
                this.spawnBarrier(spread, posY, posZ);
            } else if (pattern === 'far-left') {
                // Barrier on far left edge - forces players to move right
                this.spawnBarrier(-farSpread, posY, posZ);
            } else if (pattern === 'far-right') {
                // Barrier on far right edge - forces players to move left
                this.spawnBarrier(farSpread, posY, posZ);
            } else if (pattern === 'left-center') {
                // Two barriers leaving only right gap
                this.spawnBarrier(-0.28, posY, posZ);
                this.spawnBarrier(0.12, posY, posZ);
            } else if (pattern === 'center-right') {
                // Two barriers leaving only left gap
                this.spawnBarrier(-0.12, posY, posZ);
                this.spawnBarrier(0.28, posY, posZ);
            }
        }
    },

    spawnBarrier: function (x, y, z) {
        // Aggressive red colors
        const colors = ['#ff0000', '#ff3300', '#ff0066', '#cc0000'];
        const color = colors[Math.floor(Math.random() * colors.length)];

        // Rectangle barrier - wider for challenge
        const width = 0.38;
        const height = 2.8;
        const depth = 0.15;  // Thin barrier

        const container = document.createElement('a-entity');
        // Position so bottom touches slide surface
        container.setAttribute('position', { x: x, y: y + height / 2, z: z });
        container.setAttribute('class', 'slide-obstacle');
        container.setAttribute('data-radius', 0.3);

        // Black fill box
        const fill = document.createElement('a-box');
        fill.setAttribute('width', width * 0.9);
        fill.setAttribute('height', height * 0.9);
        fill.setAttribute('depth', depth * 0.9);
        fill.setAttribute('material', { color: '#000000', shader: 'flat' });
        container.appendChild(fill);

        // Glowing wireframe edges
        const wireframe = document.createElement('a-box');
        wireframe.setAttribute('width', width);
        wireframe.setAttribute('height', height);
        wireframe.setAttribute('depth', depth);
        wireframe.setAttribute('material', {
            color: color,
            emissive: color,
            emissiveIntensity: 2,
            wireframe: true
        });
        container.appendChild(wireframe);

        this.sceneEl.appendChild(container);
        this.obstacles.push(container);
    },

    getObstacles: function () {
        return this.obstacles;
    },

    clearObstacles: function () {
        this.obstacles.forEach(ob => {
            if (ob && ob.parentNode) ob.parentNode.removeChild(ob);
        });
        this.obstacles = [];
    },

    tick: function (time, timeDelta) {
        if (!this.active || !this.rig) return;

        const dt = timeDelta / 1000;
        const rad = 20 * (Math.PI / 180);

        const dy = -Math.sin(rad) * this.currentSpeed * dt;
        const dz = -Math.cos(rad) * this.currentSpeed * dt;

        this.rig.object3D.position.y += dy;
        this.rig.object3D.position.z += dz;

        if (this.gridFloor) {
            this.gridFloor.object3D.position.y = this.rig.object3D.position.y;
            this.gridFloor.object3D.position.z = this.rig.object3D.position.z;
        }

        // Check if reached target
        if (this.rig.object3D.position.y <= this.targetY + 1) {
            console.log("Slide Complete! Final:", this.isFinalSlide);
            this.active = false;
            this.clearObstacles();

            this.rig.object3D.position.y = this.targetY;
            if (this.gridFloor) {
                this.gridFloor.object3D.position.y = this.targetY;
            }

            if (this.isFinalSlide) {
                this.sceneEl.emit('final-slide-complete');
            } else {
                this.sceneEl.emit('slide-complete');
            }
        }
    }
});
