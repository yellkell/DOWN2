/*
 * Game State Manager
 * Handles start screen, collision detection, game over, and win states.
 */

AFRAME.registerSystem('game-manager', {
    schema: {
        state: { type: 'string', default: 'START' },
        lives: { type: 'number', default: 1 }
    },

    init: function () {
        console.log("Game Manager Initialized");
        this.timeElapsed = 0;
        this.currentPhase = 1;
        this.gameEnded = false;
        this.gameStarted = false;
        this.playerRadius = 0.1;

        // Game mode - always hard mode now
        this.hardMode = true;

        // Hard mode settings - taller mountain, more phases, LONGER slides (2x drop distance)
        this.hardConfig = {
            gridDuration: 35,           // Slightly longer phases
            totalPhases: 5,             // 5 phases instead of 3
            startHeight: 300,           // Start even higher
            phaseHeights: [300, 180, 60, -60, -180], // 5 levels with 120m drops (2x normal)
            winnerHeight: -380          // Longer final slide
        };

        // Apply hard config as default
        this.applyConfig(this.hardConfig);

        this.el.addEventListener('slide-complete', this.onSlideComplete.bind(this));
        this.el.addEventListener('final-slide-complete', this.onFinalSlideComplete.bind(this));

        if (this.sceneEl.hasLoaded) {
            this.createUI();
        } else {
            this.sceneEl.addEventListener('loaded', this.createUI.bind(this));
        }

        // Get controller references and show pointers initially (for start menu)
        setTimeout(() => {
            this.leftHand = document.querySelector('#left-hand');
            this.rightHand = document.querySelector('#right-hand');
            this.showPointers(); // Start with pointers visible for menu
        }, 100);
    },

    applyConfig: function (config) {
        this.gridDuration = config.gridDuration;
        this.totalPhases = config.totalPhases;
        this.startHeight = config.startHeight;
        this.phaseHeights = config.phaseHeights;
        this.winnerHeight = config.winnerHeight;
    },

    showPointers: function () {
        if (this.leftHand) {
            this.leftHand.setAttribute('laser-controls', 'hand: left');
            this.leftHand.setAttribute('raycaster', 'objects: .clickable; far: 20');
        }
        if (this.rightHand) {
            this.rightHand.setAttribute('laser-controls', 'hand: right');
            this.rightHand.setAttribute('raycaster', 'objects: .clickable; far: 20');
        }
    },

    hidePointers: function () {
        if (this.leftHand) {
            this.leftHand.removeAttribute('laser-controls');
            this.leftHand.setAttribute('raycaster', 'objects: .clickable; far: 0');
        }
        if (this.rightHand) {
            this.rightHand.removeAttribute('laser-controls');
            this.rightHand.setAttribute('raycaster', 'objects: .clickable; far: 0');
        }
    },

    setGameMode: function () {
        // Always hard mode now
        this.hardMode = true;
        this.applyConfig(this.hardConfig);

        // Notify other systems of the mode change
        this.el.emit('mode-change', { hardMode: true });

        console.log(`Game mode set to: HARD`);
        console.log(`Phases: ${this.totalPhases}, Start Height: ${this.startHeight}`);
    },

    createPillOutline: function (width, height, radius, tubeRadius) {
        // Create a pill-shaped outline using THREE.js TubeGeometry for visible thickness
        const points = [];
        const segments = 32;
        const halfW = width / 2;
        const halfH = height / 2;
        const r = Math.min(radius, halfH); // Ensure radius doesn't exceed half height

        // Top-left corner
        for (let i = 0; i <= segments / 4; i++) {
            const angle = Math.PI / 2 + (Math.PI / 2) * (i / (segments / 4));
            points.push(new THREE.Vector3(
                -halfW + r + Math.cos(angle) * r,
                halfH - r + Math.sin(angle) * r,
                0
            ));
        }
        // Bottom-left corner
        for (let i = 0; i <= segments / 4; i++) {
            const angle = Math.PI + (Math.PI / 2) * (i / (segments / 4));
            points.push(new THREE.Vector3(
                -halfW + r + Math.cos(angle) * r,
                -halfH + r + Math.sin(angle) * r,
                0
            ));
        }
        // Bottom-right corner
        for (let i = 0; i <= segments / 4; i++) {
            const angle = -Math.PI / 2 + (Math.PI / 2) * (i / (segments / 4));
            points.push(new THREE.Vector3(
                halfW - r + Math.cos(angle) * r,
                -halfH + r + Math.sin(angle) * r,
                0
            ));
        }
        // Top-right corner
        for (let i = 0; i <= segments / 4; i++) {
            const angle = 0 + (Math.PI / 2) * (i / (segments / 4));
            points.push(new THREE.Vector3(
                halfW - r + Math.cos(angle) * r,
                halfH - r + Math.sin(angle) * r,
                0
            ));
        }
        points.push(points[0].clone()); // Close the loop

        const curve = new THREE.CatmullRomCurve3(points, true);
        const geometry = new THREE.TubeGeometry(curve, 64, tubeRadius, 8, true);
        const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
        return new THREE.Mesh(geometry, material);
    },

    createUI: function () {
        const camera = document.querySelector('#camera');
        const rig = document.querySelector('#rig');
        if (!camera || !rig) return;

        // Player head hitbox (INVISIBLE)
        this.playerHead = document.createElement('a-sphere');
        this.playerHead.setAttribute('radius', this.playerRadius);
        this.playerHead.setAttribute('position', '0 0 0');
        this.playerHead.setAttribute('visible', 'false');
        camera.appendChild(this.playerHead);

        // HUD Text - stylized neon look
        this.hudText = document.createElement('a-text');
        this.hudText.setAttribute('position', '0 2 -8');
        this.hudText.setAttribute('scale', '2.5 2.5 2.5');
        this.hudText.setAttribute('value', '');
        this.hudText.setAttribute('color', '#00ffff');
        this.hudText.setAttribute('align', 'center');
        this.hudText.setAttribute('font', 'mozillavr');
        rig.appendChild(this.hudText);

        // Start Screen Panel - vertically centered layout
        this.startPanel = document.createElement('a-entity');
        this.startPanel.setAttribute('position', '0 1.6 -10'); // At eye level

        const startBg = document.createElement('a-plane');
        startBg.setAttribute('width', '8');
        startBg.setAttribute('height', '7');
        startBg.setAttribute('material', 'color: #000; opacity: 0.85');
        this.startPanel.appendChild(startBg);

        // Title image at top
        const titleImage = document.createElement('a-image');
        titleImage.setAttribute('src', 'assets/drop.png');
        titleImage.setAttribute('position', '0 2.5 0.01');
        titleImage.setAttribute('width', '5');
        titleImage.setAttribute('height', '2');
        titleImage.setAttribute('material', 'transparent: true; alphaTest: 0.5');
        this.startPanel.appendChild(titleImage);

        // Safety warning text
        const warningInfo = document.createElement('a-text');
        warningInfo.setAttribute('value', 'CLEAR A 1.8m x 1.8m SPACE IRL\nCENTER YOURSELF WITHIN IT\nRECENTER VIEW WITH YOUR CONTROLLER\n\nLET\'S GO!');
        warningInfo.setAttribute('position', '0 0.5 0.01');
        warningInfo.setAttribute('scale', '0.65 0.65 0.65');
        warningInfo.setAttribute('color', '#ffffff');
        warningInfo.setAttribute('align', 'center');
        warningInfo.setAttribute('baseline', 'center');
        this.startPanel.appendChild(warningInfo);

        // START button (centered) - HARD mode only
        const hardBtn = document.createElement('a-plane');
        hardBtn.setAttribute('width', '5');
        hardBtn.setAttribute('height', '1.3');
        hardBtn.setAttribute('position', '0 -1.8 0.01');
        hardBtn.setAttribute('material', 'color: #000000; opacity: 0.9');
        hardBtn.setAttribute('class', 'clickable');
        hardBtn.addEventListener('click', () => {
            this.setGameMode();
            this.startGame();
        });
        this.startPanel.appendChild(hardBtn);

        // Button border
        const hardBorder = document.createElement('a-plane');
        hardBorder.setAttribute('width', '5.08');
        hardBorder.setAttribute('height', '1.38');
        hardBorder.setAttribute('position', '0 -1.8 0.005');
        hardBorder.setAttribute('material', 'color: #ff2200; shader: flat');
        this.startPanel.appendChild(hardBorder);

        const hardText = document.createElement('a-text');
        hardText.setAttribute('value', 'HARD MODE');
        hardText.setAttribute('position', '0 -1.8 0.02');
        hardText.setAttribute('scale', '1.4 1.4 1.4');
        hardText.setAttribute('color', '#ff2200');
        hardText.setAttribute('align', 'center');
        hardText.setAttribute('baseline', 'center');
        hardText.setAttribute('font', 'mozillavr');
        this.startPanel.appendChild(hardText);

        rig.appendChild(this.startPanel);

        // Game Over Panel
        this.gameOverPanel = document.createElement('a-entity');
        this.gameOverPanel.setAttribute('position', '0 2 -10');
        this.gameOverPanel.setAttribute('visible', false);

        const goBg = document.createElement('a-plane');
        goBg.setAttribute('width', '8');
        goBg.setAttribute('height', '5');
        goBg.setAttribute('material', 'color: #000; opacity: 0.9');
        this.gameOverPanel.appendChild(goBg);

        // Stylized game over title
        this.goTitle = document.createElement('a-text');
        this.goTitle.setAttribute('value', 'GAME OVER');
        this.goTitle.setAttribute('position', '0 1 0.01');
        this.goTitle.setAttribute('scale', '2.5 2.5 2.5');
        this.goTitle.setAttribute('color', '#ff0000');
        this.goTitle.setAttribute('align', 'center');
        this.goTitle.setAttribute('font', 'mozillavr');
        this.gameOverPanel.appendChild(this.goTitle);

        // Reset button with white pill outline
        const resetBtnOutline = document.createElement('a-entity');
        resetBtnOutline.setAttribute('position', '0 -1.5 0.005');
        resetBtnOutline.object3D.add(this.createPillOutline(3.6, 1.5, 0.6, 0.05));
        this.gameOverPanel.appendChild(resetBtnOutline);

        const resetBtn = document.createElement('a-image');
        resetBtn.setAttribute('src', 'assets/Reset.png');
        resetBtn.setAttribute('width', '3');
        resetBtn.setAttribute('height', '1');
        resetBtn.setAttribute('position', '0 -1.5 0.01');
        resetBtn.setAttribute('material', 'transparent: true; alphaTest: 0.5');
        resetBtn.setAttribute('class', 'clickable');
        resetBtn.addEventListener('click', () => window.location.reload());
        this.gameOverPanel.appendChild(resetBtn);

        rig.appendChild(this.gameOverPanel);


        // Warning texts
        this.warningText = document.createElement('a-text');
        this.warningText.setAttribute('position', '0 0 -8');
        this.warningText.setAttribute('scale', '3 3 3');
        this.warningText.setAttribute('value', 'LOOK DOWN!\nWATCH OUT!');
        this.warningText.setAttribute('color', '#ff0000');
        this.warningText.setAttribute('align', 'center');
        this.warningText.setAttribute('visible', false);
        rig.appendChild(this.warningText);

        // Slide warning - stylized neon look
        this.slideWarning = document.createElement('a-text');
        this.slideWarning.setAttribute('position', '0 0 -8');
        this.slideWarning.setAttribute('scale', '3.5 3.5 3.5');
        this.slideWarning.setAttribute('value', 'LOOK FORWARD!\n↓ SLIDE ↓');
        this.slideWarning.setAttribute('color', '#ff00ff');
        this.slideWarning.setAttribute('align', 'center');
        this.slideWarning.setAttribute('font', 'mozillavr');
        this.slideWarning.setAttribute('visible', false);
        rig.appendChild(this.slideWarning);

        // Rising red warning from below (visual slide warning) with text
        const gridFloor = document.querySelector('#grid-floor');
        if (gridFloor) {
            // Container for warning elements
            this.risingWarning = document.createElement('a-entity');
            this.risingWarning.setAttribute('position', '0 -10 0'); // Start below the grid
            this.risingWarning.setAttribute('visible', false);

            // Red plane
            const warningPlane = document.createElement('a-plane');
            warningPlane.setAttribute('width', '3');
            warningPlane.setAttribute('height', '3');
            warningPlane.setAttribute('rotation', '-90 0 0'); // Flat on ground
            warningPlane.setAttribute('material', {
                color: '#ff0000',
                emissive: '#ff0000',
                emissiveIntensity: 2,
                transparent: true,
                opacity: 0.6,
                shader: 'flat',
                side: 'double'
            });
            this.risingWarning.appendChild(warningPlane);

            // "LOOK UP!" text on the warning
            const lookUpText = document.createElement('a-text');
            lookUpText.setAttribute('value', 'LOOK UP!');
            lookUpText.setAttribute('position', '0 0.1 0');
            lookUpText.setAttribute('rotation', '-90 0 0'); // Flat, readable from above
            lookUpText.setAttribute('scale', '3 3 3');
            lookUpText.setAttribute('color', '#ffffff');
            lookUpText.setAttribute('align', 'center');
            lookUpText.setAttribute('baseline', 'center');
            this.risingWarning.appendChild(lookUpText);

            gridFloor.appendChild(this.risingWarning);
            this.warningRiseActive = false;
            this.warningRiseY = -10; // Start position
        }

        // Load sound effects
        this.beginSound = new Audio('assets/begin.ogg');
        this.awesomeSound = new Audio('assets/awesome.ogg');
        this.gameoverSound = new Audio('assets/gameover.ogg');
        this.dieSound = new Audio('assets/die.ogg');
        this.excellentSound = new Audio('assets/excellent.ogg');

        // Load music playlist
        this.musicTracks = [
            new Audio('assets/Digital Paradisio.mp3'),
            new Audio('assets/Island Circuits.mp3'),
            new Audio('assets/Island Pixelio.mp3'),
            new Audio('assets/Island Pixels.mp3')
        ];
        this.currentTrack = 0;

        this.musicTracks.forEach((track) => {
            track.addEventListener('ended', () => this.playNextTrack());
        });
    },

    playNextTrack: function () {
        this.currentTrack = (this.currentTrack + 1) % this.musicTracks.length;
        this.musicTracks[this.currentTrack].currentTime = 0;
        this.musicTracks[this.currentTrack].play().catch(e => console.log('Music error:', e));
    },

    startMusic: function () {
        // Stop any currently playing track
        this.musicTracks.forEach(track => {
            track.pause();
            track.currentTime = 0;
        });

        // Pick a random track that's NOT the first one (Digital Paradisio)
        this.currentTrack = 1 + Math.floor(Math.random() * (this.musicTracks.length - 1));

        this.musicTracks[this.currentTrack].play().catch(e => console.log('Music error:', e));
    },

    startGame: function () {
        console.log('Game Starting! Mode: HARD');
        this.gameStarted = true;
        this.gameEnded = false;
        this.data.state = 'GRID';
        this.timeElapsed = 0;
        this.currentPhase = 1;

        // Position player at correct starting height based on mode
        const rig = document.querySelector('#rig');
        const gridFloor = document.querySelector('#grid-floor');
        if (rig) {
            rig.object3D.position.y = this.startHeight;
            rig.object3D.position.z = 0;
        }
        if (gridFloor) {
            gridFloor.object3D.position.y = this.startHeight;
            gridFloor.object3D.position.z = 0;
        }

        this.startPanel.setAttribute('visible', false);
        this.gameOverPanel.setAttribute('visible', false);
        
        // Hide pointers since no menu is visible
        this.hidePointers();

        // Show look down warning
        this.warningText.setAttribute('visible', true);
        setTimeout(() => {
            if (this.warningText) this.warningText.setAttribute('visible', false);
        }, 3000);

        // PLAY BEGIN SOUND FIRST
        if (this.beginSound) {
            this.beginSound.currentTime = 0;
            this.beginSound.play().then(() => {
                console.log("Begin sound played!");
            }).catch(e => console.log('Begin sound error:', e));
        }

        // Start music after a short delay
        setTimeout(() => this.startMusic(), 500);

        this.el.emit('game-start', {
            hardMode: this.hardMode,
            currentPhase: this.currentPhase,
            totalPhases: this.totalPhases
        });
    },

    tick: function (time, timeDelta) {
        if (!this.gameStarted || this.gameEnded) return;

        this.checkCollisions();

        if (this.data.state !== 'GRID') return;

        this.timeElapsed += timeDelta / 1000;

        const remaining = Math.max(0, this.gridDuration - this.timeElapsed).toFixed(0);
        const modeIndicator = this.hardMode ? ' [HARD]' : '';
        this.hudText.setAttribute('value', `Phase ${this.currentPhase}/${this.totalPhases}${modeIndicator} | ${remaining}s`);

        const timeUntilSlide = this.gridDuration - this.timeElapsed;

        // Show slide warning 3 seconds before slide
        if (timeUntilSlide <= 3 && timeUntilSlide > 2.5) {
            this.slideWarning.setAttribute('visible', true);

            // Activate rising warning
            if (this.risingWarning && !this.warningRiseActive) {
                this.warningRiseActive = true;
                this.warningRiseY = -10; // Reset to bottom
                this.risingWarning.setAttribute('visible', true);
            }

            // STOP grid spawner from spawning new projectiles and clear existing ones
            const gridSpawner = this.sceneEl.systems['grid-spawner'];
            if (gridSpawner && gridSpawner.isActive) {
                gridSpawner.isActive = false; // Stop spawning
                gridSpawner.clearProjectiles(); // Clear all existing projectiles
                console.log("Cleared projectiles for slide transition");
            }
        }

        // Animate rising warning during last 3 seconds
        if (this.warningRiseActive && timeUntilSlide <= 3 && timeUntilSlide > 0) {
            const dt = timeDelta / 1000;
            // Rise up over 3 seconds from Y=-10 to Y=0 (at grid level)
            this.warningRiseY += (10 / 3) * dt; // Rise 10 units over 3 seconds
            this.warningRiseY = Math.min(this.warningRiseY, 0); // Cap at 0

            // Pulsing opacity effect
            const pulse = 0.4 + Math.sin(time * 0.005) * 0.2; // Pulse between 0.2 and 0.6

            if (this.risingWarning) {
                this.risingWarning.object3D.position.y = this.warningRiseY;
                this.risingWarning.setAttribute('material', 'opacity', pulse);
            }
        }

        if (this.timeElapsed >= this.gridDuration) {
            this.slideWarning.setAttribute('visible', false);

            // Hide rising warning
            if (this.risingWarning) {
                this.risingWarning.setAttribute('visible', false);
                this.warningRiseActive = false;
            }

            this.startSlidePhase();
        }
    },

    checkCollisions: function () {
        if (!this.playerHead || this.gameEnded) return;

        const headWorldPos = new THREE.Vector3();
        this.playerHead.object3D.getWorldPosition(headWorldPos);

        // Check GRID projectiles
        const gridSpawner = this.sceneEl.systems['grid-spawner'];
        if (gridSpawner && this.data.state === 'GRID') {
            const projectiles = gridSpawner.getProjectiles();
            for (let proj of projectiles) {
                if (!proj.container) continue;
                const projPos = new THREE.Vector3();
                proj.container.object3D.getWorldPosition(projPos);
                const distance = headWorldPos.distanceTo(projPos);
                if (distance < this.playerRadius + (proj.radius || 0.3)) {
                    this.gameOver();
                    return;
                }
            }

            // Check KILL ZONE boundary (only during grid phase)
            if (gridSpawner.isOutsideKillZone(headWorldPos)) {
                console.log("Player went outside kill zone!");
                this.gameOver();
                return;
            }
        }

        // Check SLIDE obstacles - use box collision for tall barriers
        const slideMechanic = this.sceneEl.systems['slide-mechanic'];
        if (slideMechanic && this.data.state === 'SLIDE') {
            const obstacles = slideMechanic.getObstacles();
            for (let ob of obstacles) {
                if (!ob || !ob.object3D) continue;
                const obPos = new THREE.Vector3();
                ob.object3D.getWorldPosition(obPos);

                // Box collision - barriers are 0.25 wide, 2.4 tall, 0.15 deep
                const halfWidth = 0.15;
                const halfHeight = 1.2; // Half of 2.4
                const halfDepth = 0.1;

                // Check if head is within the box bounds
                const dx = Math.abs(headWorldPos.x - obPos.x);
                const dy = Math.abs(headWorldPos.y - obPos.y);
                const dz = Math.abs(headWorldPos.z - obPos.z);

                if (dx < halfWidth + this.playerRadius &&
                    dy < halfHeight + this.playerRadius &&
                    dz < halfDepth + this.playerRadius) {
                    this.gameOver();
                    return;
                }
            }
        }
    },

    startSlidePhase: function () {
        if (this.currentPhase >= this.totalPhases) {
            this.startFinalSlide();
            return;
        }

        console.log(`Starting Slide Phase after Grid ${this.currentPhase} (${this.hardMode ? 'HARD' : 'NORMAL'} mode)`);
        this.data.state = 'SLIDE';
        this.hudText.setAttribute('value', this.hardMode ? 'SLIDING DOWN! (HARD)' : 'SLIDING DOWN!');

        this.el.emit('phase-change', {
            newPhase: 'SLIDE',
            targetY: this.phaseHeights[this.currentPhase],
            hardMode: this.hardMode,
            currentPhase: this.currentPhase,
            totalPhases: this.totalPhases
        });
    },

    startFinalSlide: function () {
        console.log(`Starting FINAL slide! (${this.hardMode ? 'HARD' : 'NORMAL'} mode)`);
        this.data.state = 'SLIDE';
        this.hudText.setAttribute('value', this.hardMode ? 'FINAL SLIDE! (HARD)' : 'FINAL SLIDE!');

        this.el.emit('phase-change', {
            newPhase: 'SLIDE',
            targetY: this.winnerHeight,
            isFinal: true,
            hardMode: this.hardMode,
            currentPhase: this.totalPhases,
            totalPhases: this.totalPhases
        });
    },

    onSlideComplete: function () {
        if (this.gameEnded) return;

        this.currentPhase++;
        this.timeElapsed = 0;

        if (this.currentPhase > this.totalPhases) {
            this.startFinalSlide();
        } else {
            console.log(`Starting Grid Phase ${this.currentPhase}`);

            if (this.excellentSound) {
                this.excellentSound.currentTime = 0;
                this.excellentSound.play().catch(e => console.log('Sound error:', e));
            }

            // Show warning again
            this.warningText.setAttribute('visible', true);
            setTimeout(() => {
                if (this.warningText) this.warningText.setAttribute('visible', false);
            }, 2000);

            // Start grid after delay
            setTimeout(() => {
                if (this.beginSound) {
                    this.beginSound.currentTime = 0;
                    this.beginSound.play().catch(e => console.log('Sound error:', e));
                }
                this.data.state = 'GRID';
                this.el.emit('phase-change', {
                    newPhase: 'GRID',
                    hardMode: this.hardMode,
                    currentPhase: this.currentPhase,
                    totalPhases: this.totalPhases
                });
            }, 1000);
        }
    },

    onFinalSlideComplete: function () {
        console.log("YOU WIN!");
        this.gameEnded = true;
        this.data.state = 'WIN';

        this.goTitle.setAttribute('value', 'YOU MADE IT!\nCONGRATZ!');
        this.goTitle.setAttribute('color', '#00ff00');
        this.gameOverPanel.setAttribute('visible', true);
        this.hudText.setAttribute('value', '');
        
        // Show pointers for menu interaction
        this.showPointers();

        if (this.awesomeSound) {
            this.awesomeSound.currentTime = 0;
            this.awesomeSound.play().catch(e => console.log('Sound error:', e));
        }

        this.el.emit('phase-change', { newPhase: 'WIN' });
    },

    gameOver: function () {
        // Prevent multiple calls
        if (this.gameEnded) return;

        console.log(`GAME OVER at phase ${this.currentPhase}/${this.totalPhases}`);

        this.gameEnded = true;
        this.data.state = 'GAME_OVER';

        // Stop any active slide
        const slideMechanic = this.sceneEl.systems['slide-mechanic'];
        if (slideMechanic) {
            slideMechanic.active = false;
        }

        // Stop music
        this.musicTracks.forEach(track => {
            track.pause();
        });

        this.goTitle.setAttribute('value', 'GAME OVER');
        this.goTitle.setAttribute('color', '#ff0000');
        this.gameOverPanel.setAttribute('visible', true);
        this.hudText.setAttribute('value', '');
        
        // Show pointers for menu interaction
        this.showPointers();

        if (this.dieSound) {
            this.dieSound.currentTime = 0;
            this.dieSound.play().catch(e => console.log('Sound error:', e));
        }

        if (this.gameoverSound) {
            this.gameoverSound.currentTime = 0;
            this.gameoverSound.play().catch(e => console.log('Sound error:', e));
        }

        this.el.emit('phase-change', { newPhase: 'GAME_OVER' });
    }
});
