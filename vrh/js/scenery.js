/*
 * Scenery System
 * Handles the neon mountain sign display and theming elements
 * Shows different signs based on player's current phase/level
 * Sign progression: top (start) -> middle (Grid 2) -> bottom (Grid 3/final slide) -> finish (win)
 */

AFRAME.registerSystem('scenery', {
    init: function () {
        this.currentSignIndex = 0; // 0 = top/start, 1 = middle, 2 = bottom, 3 = finish
        this.signTransitioning = false;
        this.fadeSpeed = 2.0; // Fade duration in seconds
        this.currentFade = { active: false, from: null, to: null, progress: 0 };
        this.hasLeftOriginalSign = false; // Track if we've left sign 0
        this.finishAreaCreated = false;
        this.confettiActive = false;
        this.confettiParticles = [];

        // Hard mode tracking
        this.hardMode = false;

        if (this.sceneEl.hasLoaded) {
            this.createScenery();
        } else {
            this.sceneEl.addEventListener('loaded', this.createScenery.bind(this));
        }

        // Listen for mode changes
        this.sceneEl.addEventListener('mode-change', (evt) => {
            this.hardMode = evt.detail.hardMode;
        });

        // Listen for phase changes to update signs
        this.sceneEl.addEventListener('phase-change', (evt) => {
            this.onPhaseChange(evt.detail);

            // Create and show finish area debris field on final slide
            if (evt.detail.isFinal && evt.detail.targetY !== undefined) {
                this.hardMode = evt.detail.hardMode || false;
                this.createFinishArea(evt.detail.targetY);
                console.log("Finish area created and visible!");
            }
        });

        this.sceneEl.addEventListener('game-start', (evt) => {
            // Game started - keep top sign visible initially
            this.hardMode = evt.detail?.hardMode || false;
            this.setSignVisibility(0);
            this.hasLeftOriginalSign = false;

            // Remove finish area at game start (will be recreated on final slide)
            if (this.finishArea && this.finishArea.parentNode) {
                this.finishArea.parentNode.removeChild(this.finishArea);
                this.finishArea = null;
            }
        });

        // Listen for win to trigger confetti and show finish sign
        this.sceneEl.addEventListener('final-slide-complete', () => {
            this.startConfetti();
            // Transition to finish sign
            this.transitionToSign(3);
        });
    },

    createScenery: function () {
        console.log("Creating Scenery - Neon Mountain Signs");

        const rig = document.querySelector('#rig');
        if (!rig) return;

        // Create simple sign display positioned UP and LEFT of the player
        this.signContainer = document.createElement('a-entity');
        this.signContainer.setAttribute('id', 'neon-signs');
        this.signContainer.setAttribute('position', '-8 2.5 -10'); // Left but not too far
        this.signContainer.setAttribute('rotation', '0 25 0'); // Angled toward player

        // Create sign planes (stacked, only one visible at a time)
        this.signs = [];

        // Sign 0 - Top/Start sign (sign.png) - mountains with "YOU" arrow
        const sign1 = this.createSignPlane('assets/sign.png', 0);
        sign1.setAttribute('visible', true); // Start visible
        this.signs.push(sign1);

        // Sign 1 - Middle sign (middlesign.jpeg) - shown during Grid 2
        const sign2 = this.createSignPlane('assets/middlesign.jpeg', 1);
        sign2.setAttribute('visible', false);
        this.signs.push(sign2);

        // Sign 2 - Bottom sign (bottomsign.jpeg) - shown during Grid 3 AND final slide
        const sign3 = this.createSignPlane('assets/bottomsign.jpeg', 2);
        sign3.setAttribute('visible', false);
        this.signs.push(sign3);

        // Sign 3 - Finish/Win sign (finishsign.jpeg) - shown when player wins!
        const sign4 = this.createSignPlane('assets/finishsign.jpeg', 3);
        sign4.setAttribute('visible', false);
        this.signs.push(sign4);

        rig.appendChild(this.signContainer);

        // Finish area will be created dynamically when final slide starts
        this.finishArea = null;
    },

    createFinishArea: function (winnerHeight) {
        // Remove old finish area if exists
        if (this.finishArea && this.finishArea.parentNode) {
            this.finishArea.parentNode.removeChild(this.finishArea);
        }

        // Calculate finish position based on actual player trajectory
        // Player slides at 20 degrees angle from startHeight to winnerHeight
        // The final slide goes from phase 5 height (-180) down to winnerHeight (-380)
        // For hard mode: drop = 200 units, at 20 degrees: Z_offset = drop / tan(20°) = 200 / 0.364 = ~550

        const slideAngle = 20 * (Math.PI / 180);
        const lastPhaseHeight = -180; // Phase 5 height
        const dropDistance = lastPhaseHeight - winnerHeight; // Should be 200 for hard mode

        // Calculate Z offset based on slide geometry
        const zOffset = dropDistance / Math.tan(slideAngle);

        // Get the Z position at phase 5 to calculate final Z
        // Each phase moves the player forward in Z as they descend
        // Starting Z is 0, and we accumulate Z offset through all slides
        // Phase heights: [300, 180, 60, -60, -180] means 5 slides of 120m each
        // Plus final slide of 200m to -380
        const phaseHeights = [300, 180, 60, -60, -180];
        let accumulatedZ = 0;
        for (let i = 0; i < phaseHeights.length - 1; i++) {
            const phaseDrop = phaseHeights[i] - phaseHeights[i + 1];
            accumulatedZ -= phaseDrop / Math.tan(slideAngle);
        }

        // Add the final slide Z offset
        accumulatedZ -= zOffset;

        // Get rig's current X position (player may have moved during gameplay)
        const rig = document.querySelector('#rig');
        const rigX = rig ? rig.object3D.position.x : 0;

        const finishX = rigX;
        const finishY = winnerHeight;
        const finishZ = accumulatedZ;

        console.log(`Creating finish area at X=${finishX}, Y=${finishY}, Z=${finishZ} (calculated from slide trajectory)`);

        this.finishArea = document.createElement('a-entity');
        this.finishArea.setAttribute('id', 'finish-area');
        this.finishArea.setAttribute('position', `${finishX} ${finishY} ${finishZ}`);
        this.finishArea.setAttribute('visible', true); // Make sure it's visible!

        // Scattered neon polyhedra around the finish area
        const shapes = ['tetrahedron', 'octahedron', 'dodecahedron', 'icosahedron'];
        const colors = ['#00ffff', '#ff00ff', '#00ff00', '#ffff00', '#ff6600', '#ff0066'];

        // Spread out shapes - start further from center, fewer shapes
        const numShapes = 35;
        const baseRadius = 12; // Increased from 4 - keeps debris away from player
        const maxRadius = 35;  // Increased spread

        // Create scattered shapes around the perimeter - SURROUNDING the finish
        // Avoid the front zone where the menu appears (roughly -45 to 45 degrees from forward)
        for (let i = 0; i < numShapes; i++) {
            let angle = (i / numShapes) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;

            // Skip the front zone (where menu is) - angles from -0.5 to 0.5 radians
            // Front is negative Z direction, so angle around PI/2 to -PI/2
            const normalizedAngle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            if (normalizedAngle > Math.PI * 1.6 || normalizedAngle < Math.PI * 0.4) {
                // In front zone - push to sides
                angle += Math.PI * 0.5;
            }

            const radius = baseRadius + Math.random() * (maxRadius - baseRadius);
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            const y = Math.random() * 8 - 2; // Slightly less vertical spread

            const shape = shapes[Math.floor(Math.random() * shapes.length)];
            const color = colors[Math.floor(Math.random() * colors.length)];
            const scale = 0.8 + Math.random() * 2;

            this.createNeonShape(this.finishArea, shape, { x, y, z }, scale, color);
        }

        // Add bigger dramatic shapes further out - reduced count
        const numBigShapes = 12;
        for (let i = 0; i < numBigShapes; i++) {
            const angle = (i / numBigShapes) * Math.PI * 2;
            const radius = 30 + Math.random() * 20; // Further out
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            const y = Math.random() * 15 - 5;

            const shape = shapes[Math.floor(Math.random() * shapes.length)];
            const color = colors[Math.floor(Math.random() * colors.length)];
            const scale = 3 + Math.random() * 4;

            this.createNeonShape(this.finishArea, shape, { x, y, z }, scale, color);
        }

        // Add glowing point lights for atmosphere - fewer lights
        const lightColors = ['#00ffff', '#ff00ff', '#ffff00'];
        const numLights = 6;
        for (let i = 0; i < numLights; i++) {
            const angle = (i / numLights) * Math.PI * 2;
            const radius = 20; // Further out
            const light = document.createElement('a-entity');
            light.setAttribute('light', {
                type: 'point',
                color: lightColors[i % lightColors.length],
                intensity: 2,
                distance: 40
            });
            light.setAttribute('position', {
                x: Math.cos(angle) * radius,
                y: 3,
                z: Math.sin(angle) * radius
            });
            this.finishArea.appendChild(light);
        }

        this.sceneEl.appendChild(this.finishArea);
    },

    createNeonShape: function (parent, shape, position, scale, color) {
        const container = document.createElement('a-entity');
        container.setAttribute('position', position);

        // Random rotation for variety
        container.setAttribute('rotation', {
            x: Math.random() * 360,
            y: Math.random() * 360,
            z: Math.random() * 360
        });

        // Black center fill
        const fill = document.createElement('a-entity');
        fill.setAttribute('geometry', {
            primitive: shape,
            radius: scale * 0.9
        });
        fill.setAttribute('material', {
            color: '#000000',
            shader: 'flat'
        });
        container.appendChild(fill);

        // Glowing wireframe edges
        const wireframe = document.createElement('a-entity');
        wireframe.setAttribute('geometry', {
            primitive: shape,
            radius: scale
        });
        wireframe.setAttribute('material', {
            color: color,
            emissive: color,
            emissiveIntensity: 2.5,
            wireframe: true
        });
        container.appendChild(wireframe);

        parent.appendChild(container);
        return container;
    },

    startConfetti: function () {
        console.log("🎉 CONFETTI TIME!");
        this.confettiActive = true;
        this.confettiStartTime = Date.now();
        this.confettiDuration = 10000; // 10 seconds of confetti

        const rig = document.querySelector('#rig');
        if (!rig) return;

        // Create confetti container attached to rig so it follows player
        this.confettiContainer = document.createElement('a-entity');
        this.confettiContainer.setAttribute('id', 'confetti-container');
        rig.appendChild(this.confettiContainer);

        // Spawn initial batch of confetti
        this.spawnConfettiBurst(150);
    },

    spawnConfettiBurst: function (count) {
        if (!this.confettiContainer) return;

        const colors = [
            '#ff0000', '#ff6600', '#ffff00', '#00ff00',
            '#00ffff', '#0066ff', '#ff00ff', '#ff66ff',
            '#ffffff', '#ffcc00'
        ];

        for (let i = 0; i < count; i++) {
            const confetti = document.createElement('a-entity');

            // Random position above player
            const x = (Math.random() - 0.5) * 6;
            const y = 3 + Math.random() * 4; // 3-7 meters above
            const z = (Math.random() - 0.5) * 6 - 5; // In front of player

            confetti.setAttribute('position', { x, y, z });

            // Random rotation
            confetti.setAttribute('rotation', {
                x: Math.random() * 360,
                y: Math.random() * 360,
                z: Math.random() * 360
            });

            // Random shape - mix of rectangles and squares
            const isSquare = Math.random() > 0.5;
            const size = 0.05 + Math.random() * 0.1;

            if (isSquare) {
                confetti.setAttribute('geometry', {
                    primitive: 'box',
                    width: size,
                    height: size * 0.1,
                    depth: size
                });
            } else {
                confetti.setAttribute('geometry', {
                    primitive: 'box',
                    width: size * 1.5,
                    height: size * 0.05,
                    depth: size * 0.5
                });
            }

            // Random bright color with glow
            const color = colors[Math.floor(Math.random() * colors.length)];
            confetti.setAttribute('material', {
                color: color,
                emissive: color,
                emissiveIntensity: 1,
                shader: 'flat',
                side: 'double'
            });

            // Store physics properties
            confetti.confettiData = {
                velocityY: -1 - Math.random() * 2, // Fall speed
                velocityX: (Math.random() - 0.5) * 2,
                velocityZ: (Math.random() - 0.5) * 2,
                rotSpeedX: (Math.random() - 0.5) * 10,
                rotSpeedY: (Math.random() - 0.5) * 10,
                rotSpeedZ: (Math.random() - 0.5) * 10,
                wobble: Math.random() * Math.PI * 2,
                wobbleSpeed: 2 + Math.random() * 4
            };

            this.confettiContainer.appendChild(confetti);
            this.confettiParticles.push(confetti);
        }
    },

    updateConfetti: function (dt) {
        if (!this.confettiActive) return;

        const elapsed = Date.now() - this.confettiStartTime;

        // Keep spawning new confetti periodically
        if (elapsed < this.confettiDuration && this.confettiParticles.length < 300) {
            if (Math.random() < 0.3) { // 30% chance each frame to spawn more
                this.spawnConfettiBurst(5);
            }
        }

        // Update existing confetti
        for (let i = this.confettiParticles.length - 1; i >= 0; i--) {
            const confetti = this.confettiParticles[i];
            const data = confetti.confettiData;

            if (!data) continue;

            const pos = confetti.object3D.position;
            const rot = confetti.object3D.rotation;

            // Update wobble
            data.wobble += data.wobbleSpeed * dt;

            // Apply physics
            pos.y += data.velocityY * dt;
            pos.x += data.velocityX * dt + Math.sin(data.wobble) * 0.02;
            pos.z += data.velocityZ * dt + Math.cos(data.wobble) * 0.02;

            // Slow down horizontal movement over time
            data.velocityX *= 0.99;
            data.velocityZ *= 0.99;

            // Rotate
            rot.x += data.rotSpeedX * dt;
            rot.y += data.rotSpeedY * dt;
            rot.z += data.rotSpeedZ * dt;

            // Remove if fallen too far
            if (pos.y < -5) {
                if (confetti.parentNode) {
                    confetti.parentNode.removeChild(confetti);
                }
                this.confettiParticles.splice(i, 1);
            }
        }

        // Stop confetti after duration
        if (elapsed > this.confettiDuration + 5000) {
            this.confettiActive = false;
            // Clean up remaining confetti
            this.confettiParticles.forEach(c => {
                if (c.parentNode) c.parentNode.removeChild(c);
            });
            this.confettiParticles = [];
        }
    },

    createSignPlane: function (src, index) {
        const plane = document.createElement('a-plane');
        plane.setAttribute('width', 6);
        plane.setAttribute('height', 4.5);
        plane.setAttribute('position', { x: 0, y: 0, z: 0 });
        plane.setAttribute('material', {
            src: src,
            transparent: true,
            opacity: 1,
            shader: 'flat',
            emissive: '#ffffff',
            emissiveIntensity: 0.3  // Slight glow
        });
        plane.setAttribute('class', `sign-${index}`);
        plane.signIndex = index;

        this.signContainer.appendChild(plane);
        return plane;
    },

    onPhaseChange: function (detail) {
        const phase = detail.newPhase;
        const currentPhase = detail.currentPhase || 1;
        const totalPhases = detail.totalPhases || 5;

        // Determine which sign to show based on phase transitions
        let targetSign = this.currentSignIndex;

        if (phase === 'WIN' || phase === 'GAME_OVER') {
            // Keep current sign (finish sign handled by final-slide-complete)
            return;
        }

        if (phase === 'GRID' || phase === 'SLIDE') {
            // HARD MODE: 5 phases
            // Sign 0 (top): Phases 1-2
            // Sign 1 (middle): Phases 3-4
            // Sign 2 (bottom): Phase 5 and final slide
            if (detail.isFinal) {
                targetSign = 2;
                this.hasLeftOriginalSign = true;
            } else if (currentPhase >= 5) {
                targetSign = 2;
                this.hasLeftOriginalSign = true;
            } else if (currentPhase >= 3) {
                targetSign = 1;
                this.hasLeftOriginalSign = true;
            } else {
                // Phases 1-2, stay on top sign
                if (!this.hasLeftOriginalSign) {
                    targetSign = 0;
                }
            }
        }

        // Never go back to sign 0 after leaving it
        if (this.hasLeftOriginalSign && targetSign === 0) {
            targetSign = Math.max(this.currentSignIndex, 1);
        }

        if (targetSign !== this.currentSignIndex) {
            console.log(`Sign transition: ${this.currentSignIndex} -> ${targetSign} (Phase ${currentPhase}/${totalPhases})`);
            this.transitionToSign(targetSign);
        }
    },

    transitionToSign: function (targetIndex) {
        if (this.signTransitioning) return;

        // Prevent going backwards (except to finish sign which is always allowed)
        if (targetIndex < this.currentSignIndex && targetIndex !== 3) {
            console.log(`Blocked regression from sign ${this.currentSignIndex} to ${targetIndex}`);
            return;
        }

        console.log(`Transitioning sign from ${this.currentSignIndex} to ${targetIndex}`);

        this.currentFade = {
            active: true,
            from: this.currentSignIndex,
            to: targetIndex,
            progress: 0
        };
        this.signTransitioning = true;

        // Make target sign visible but transparent
        if (this.signs[targetIndex]) {
            this.signs[targetIndex].setAttribute('visible', true);
            this.signs[targetIndex].setAttribute('material', 'opacity', 0);
        }
    },

    setSignVisibility: function (index) {
        this.signs.forEach((sign, i) => {
            sign.setAttribute('visible', i === index);
            if (i === index) {
                sign.setAttribute('material', 'opacity', 1);
            }
        });
        this.currentSignIndex = index;
    },

    tick: function (time, timeDelta) {
        const dt = timeDelta / 1000;

        // Update confetti physics
        this.updateConfetti(dt);

        // Handle sign fading
        if (!this.currentFade.active || !this.signs) return;

        this.currentFade.progress += dt / this.fadeSpeed;

        if (this.currentFade.progress >= 1) {
            // Fade complete
            this.currentFade.progress = 1;
            this.currentFade.active = false;
            this.signTransitioning = false;

            // Hide old sign
            if (this.signs[this.currentFade.from]) {
                this.signs[this.currentFade.from].setAttribute('visible', false);
            }
            // Ensure new sign is fully visible
            if (this.signs[this.currentFade.to]) {
                this.signs[this.currentFade.to].setAttribute('material', 'opacity', 1);
            }

            this.currentSignIndex = this.currentFade.to;

            // Mark that we've left the original sign
            if (this.currentFade.from === 0) {
                this.hasLeftOriginalSign = true;
            }
        } else {
            // Interpolate opacity
            const t = this.currentFade.progress;

            // Fade out old sign
            if (this.signs[this.currentFade.from]) {
                this.signs[this.currentFade.from].setAttribute('material', 'opacity', 1 - t);
            }
            // Fade in new sign
            if (this.signs[this.currentFade.to]) {
                this.signs[this.currentFade.to].setAttribute('material', 'opacity', t);
            }
        }
    }
});
