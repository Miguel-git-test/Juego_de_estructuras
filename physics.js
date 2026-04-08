const { Engine, Render, Runner, Bodies, Body, Composite, Constraint, Mouse, MouseConstraint, Vector, Events } = Matter;

export class PhysicsEngine {
    constructor(canvas, onWin, onFail) {
        this.engine = Engine.create();
        this.world = this.engine.world;
        this.canvas = canvas;
        this.onWin = onWin;
        this.onFail = onFail;
        this.beams = [];
        this.nodes = [];
        this.brokenBeams = 0;
        this.weights = [];
        this.checkpoints = [];
        this.simulationRunning = false;
        this.ground = null;
        this.extras = []; // Walls, cars, etc.
        this.kings = []; 

        // Custom renderer logic for technical look
        this.setupRenderer();
        
        // Runner
        this.runner = Runner.create();
        
        // Generate procedural wood patterns for different stress levels
        this.woodPatterns = {
            normal: this.createWoodPattern('#a16207', '#713f12').toDataURL(),
            stressed: this.createWoodPattern('#f59e0b', '#78350f').toDataURL(),
            danger: this.createWoodPattern('#f43f5e', '#450a0a').toDataURL()
        };
    }

    createWoodPattern(baseColor, grainColor) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
        // Base wood color
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, 128, 128);
        
        // Add grain lines
        ctx.strokeStyle = grainColor;
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 1;
        for (let i = 0; i < 20; i++) {
            const y = Math.random() * 128;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.bezierCurveTo(40, y + 10, 80, y - 10, 128, y + 5);
            ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
        
        return canvas;
    }

    setupRenderer() {
        this.render = Render.create({
            canvas: this.canvas,
            engine: this.engine,
            options: {
                width: window.innerWidth,
                height: window.innerHeight,
                wireframes: false,
                background: 'transparent'
            }
        });
        Render.run(this.render);
    }

    clearWorld() {
        Composite.clear(this.world);
        this.beams = [];
        this.nodes = [];
        this.weights = [];
        this.checkpoints = [];
        this.simulationRunning = false;
        this.engine.timing.timeScale = 1;
        this.extras = [];
        this.kings = [];
        Runner.stop(this.runner);
    }

    loadLevel(level) {
        this.clearWorld();
        this.currentLevel = level;
        this.brokenBeams = 0;

        // Add Environment (Walls, Slopes, cars)
        if (level.environment) {
            level.environment.forEach(env => {
                let body;
                if (env.type === 'car') {
                    // Refined car: Body + 2 Wheels with axles
                    const carBody = Bodies.rectangle(env.x, env.y, env.w, env.h, { 
                        label: env.id,
                        collisionFilter: { group: Matter.Body.nextGroup(true) },
                        slop: 0.1,
                        frictionStatic: 10,
                        render: { fillStyle: '#34495e' }
                    });
                    
                    const wheelRadius = env.h * 0.6;
                    const wheelY = env.y + env.h/2 + wheelRadius/2;
                    
                    const w1 = Bodies.circle(env.x - env.w/3, wheelY, wheelRadius, { 
                        friction: 0.9,
                        frictionStatic: 10,
                        slop: 0.1,
                        collisionFilter: { group: carBody.collisionFilter.group },
                        render: { fillStyle: '#2c3e50' }
                    });
                    const w2 = Bodies.circle(env.x + env.w/3, wheelY, wheelRadius, { 
                        friction: 0.9,
                        frictionStatic: 10,
                        slop: 0.1,
                        collisionFilter: { group: carBody.collisionFilter.group },
                        render: { fillStyle: '#2c3e50' }
                    });

                    const axle1 = Constraint.create({ 
                        bodyA: carBody, bodyB: w1, 
                        pointA: { x: -env.w/3, y: env.h/2 }, 
                        stiffness: 1, length: 0,
                        render: { visible: false }
                    });
                    const axle2 = Constraint.create({ 
                        bodyA: carBody, bodyB: w2, 
                        pointA: { x: env.w/3, y: env.h/2 }, 
                        stiffness: 1, length: 0,
                        render: { visible: false }
                    });
                    
                    Composite.add(this.world, [carBody, w1, w2, axle1, axle2]);
                    this.extras.push({ id: env.id, body: carBody });
                } else if (env.type === 'bucket') {
                    // U-shaped bucket
                    const bottom = Bodies.rectangle(env.x, env.y + env.h/2, env.w, 10, { render: { fillStyle: '#95a5a6' }});
                    const left = Bodies.rectangle(env.x - env.w/2, env.y, 10, env.h, { render: { fillStyle: '#95a5a6' }});
                    const right = Bodies.rectangle(env.x + env.w/2, env.y, 10, env.h, { render: { fillStyle: '#95a5a6' }});
                    
                    // Constrain them all together to a central static pivot (to allow tipping)
                    const pivot = Bodies.circle(env.x, env.y, 5, { isStatic: true, render: { visible: false } });
                    const bucketBody = Body.create({
                        parts: [bottom, left, right],
                        label: env.id
                    });
                    
                    const axle = Constraint.create({
                        pointA: { x: env.x, y: env.y },
                        bodyB: bucketBody,
                        stiffness: 1,
                        length: 0,
                        render: { visible: false }
                    });
                    
                    Composite.add(this.world, [bucketBody, axle]);
                    this.extras.push({ id: env.id, body: bucketBody });
                } else if (env.type === 'cannon') {
                    // Realistic Cannon: Barrel + Carriage
                    const barrel = Bodies.rectangle(env.x, env.y, env.w, env.h, {
                        isStatic: true,
                        angle: env.angle || 0,
                        label: 'cannon-barrel',
                        render: { 
                            fillStyle: '#1e293b',
                            strokeStyle: '#0f172a',
                            lineWidth: 3
                        }
                    });
                    
                    // Add carriage (wheels/base) for visual realism
                    const carriage = Bodies.rectangle(env.x, env.y + env.h, env.w * 0.8, 24, {
                        isStatic: true,
                        render: { 
                            fillStyle: '#451a03',
                            strokeStyle: '#2d1102',
                            lineWidth: 2
                        }
                    });
                    
                    // Add a wheel
                    const wheel = Bodies.circle(env.x - env.w/3, env.y + env.h + 10, 15, {
                        isStatic: true,
                        render: { 
                            fillStyle: '#1e293b',
                            strokeStyle: '#451a03',
                            lineWidth: 4
                        }
                    });
                    
                    Composite.add(this.world, [barrel, carriage, wheel]);
                } else if (env.type === 'catapult') {
                    // Modern Engineered Catapult
                    const base = Bodies.rectangle(env.x, env.y, env.w, env.h, {
                        isStatic: true,
                        render: { fillStyle: '#451a03' }
                    });
                    const arm = Bodies.rectangle(env.x + 5, env.y - 15, env.w * 1.3, 12, {
                        isStatic: true,
                        angle: env.angle || -0.6,
                        render: { 
                            sprite: {
                                texture: this.woodPatterns.normal,
                                xScale: (env.w * 1.3) / 128,
                                yScale: 12 / 128
                            }
                        }
                    });
                    const pivot = Bodies.circle(env.x, env.y - 5, 6, {
                        isStatic: true,
                        render: { fillStyle: '#94a3b8' } // Steel bolt
                    });
                    Composite.add(this.world, [base, arm, pivot]);
                } else {
                    // Standard static geometry (wall, slope)
                    const body = Bodies.rectangle(env.x, env.y, env.w, env.h, {
                        isStatic: true,
                        angle: env.angle || 0,
                        render: { fillStyle: '#1e293b', strokeStyle: '#334155', lineWidth: 2 }
                    });
                    Composite.add(this.world, body);
                }
            });
        }

        // Add Anchors
        level.anchors.forEach(anchor => {
            let parentBody = null;
            if (anchor.attachTo) {
                const extra = this.extras.find(e => e.id === anchor.attachTo);
                if (extra) parentBody = extra.body;
            }

            const node = Bodies.circle(anchor.x, anchor.y, 10, {
                isStatic: !parentBody, // Static if not attached to a moving car
                render: { fillStyle: '#38bdf8', strokeStyle: '#0f172a', lineWidth: 2 }
            });
            node.isAnchor = true;
            node.label = anchor.id;
            
            if (parentBody) {
                // Attach node to car
                const offset = Vector.sub(node.position, parentBody.position);
                const joint = Constraint.create({
                    bodyA: parentBody,
                    bodyB: node,
                    pointA: offset,
                    stiffness: 1,
                    length: 0,
                    render: { visible: false }
                });
                Composite.add(this.world, joint);
            }

            this.nodes.push(node);
            Composite.add(this.world, node);
        });

        // Add Checkpoints
        if (level.checkpoints) {
            this.checkpoints = level.checkpoints.map(cp => ({
                x: cp.x, y: cp.y, active: false
            }));
        }

        // Add Weights (Single or Multiple)
        const weightDataList = level.weights || (level.weight ? [level.weight] : []);
        
        weightDataList.forEach(wd => {
            const weight = Bodies.circle(wd.x, wd.y, wd.radius, {
                isStatic: true,
                mass: wd.mass,
                label: 'weight',
                render: { 
                    fillStyle: wd.color || '#475569', 
                    strokeStyle: '#0f172a', 
                    lineWidth: 2 
                }
            });
            
            if (wd.tether) {
                // Pendulum support
                const tether = Constraint.create({
                    pointA: { x: wd.tether.x, y: wd.tether.y },
                    bodyB: weight,
                    stiffness: 1,
                    length: wd.tether.length || Vector.magnitude(Vector.sub({x: wd.tether.x, y: wd.tether.y}, weight.position)),
                    render: { strokeStyle: '#aaa', lineWidth: 2 }
                });
                Composite.add(this.world, tether);
            }

            this.weights.push(weight);
            Composite.add(this.world, weight);
            
            // Store initial velocity for simulation start
            if (wd.velocity) {
                weight.initialVelocity = wd.velocity;
            }
        });

        // Add Ground (Physical Solid Ground)
        this.ground = Bodies.rectangle(window.innerWidth/2, level.groundY + 25, window.innerWidth, 50, {
            isStatic: true,
            label: 'ground',
            friction: 1,
            frictionStatic: 10,
            render: { fillStyle: '#2c3e50', strokeStyle: '#34495e', lineWidth: 2 }
        });
        Composite.add(this.world, this.ground);
        
        // Add King (Rey) - Multi-part high-fidelity shape
        if (level.king) {
            const head = Bodies.circle(level.king.x, level.king.y - 10, 15, { isStatic: true, label: 'king' });
            const body = Bodies.rectangle(level.king.x, level.king.y + 15, 30, 40, { isStatic: true, label: 'king' });
            // Crown peaks
            const p1 = Bodies.polygon(level.king.x - 10, level.king.y - 25, 3, 8, { isStatic: true, label: 'king' });
            const p2 = Bodies.polygon(level.king.x, level.king.y - 28, 3, 8, { isStatic: true, label: 'king' });
            const p3 = Bodies.polygon(level.king.x + 10, level.king.y - 25, 3, 8, { isStatic: true, label: 'king' });
            
            const king = Body.create({
                parts: [head, body, p1, p2, p3],
                isStatic: true,
                label: 'king',
                render: { 
                    fillStyle: '#f1c40f', // Gold
                    strokeStyle: '#f39c12',
                    lineWidth: 2
                }
            });
            
            this.kings.push(king);
            Composite.add(this.world, king);
        }

        this.setupCollisionEvents();
    }

    addBeam(p1, p2) {
        // Find or create nodes at endpoints
        const node1 = this.getOrCreateNode(p1);
        const node2 = this.getOrCreateNode(p2);

        // Don't add if nodes are the same or already connected
        if (node1 === node2 || this.areConnected(node1, node2)) return null;

        const length = Vector.magnitude(Vector.sub(node1.position, node2.position));
        const angle = Math.atan2(node2.position.y - node1.position.y, node2.position.x - node1.position.x);
        
        // Physical Collision Hull
        const collisionBody = Bodies.rectangle(
            (node1.position.x + node2.position.x) / 2,
            (node1.position.y + node2.position.y) / 2,
            length,
            14, // Slightly thicker for volume
            {
                collisionFilter: { group: -2, mask: 0xFFFFFFFF ^ 2 },
                render: { 
                    sprite: {
                        texture: this.woodPatterns.normal,
                        xScale: length / 128,
                        yScale: 14 / 128
                    }
                },
                isStatic: true,
                friction: 0.8
            }
        );

        // Pin the hull to the nodes so it transfers forces
        const pin1 = Constraint.create({
            bodyA: node1,
            bodyB: collisionBody,
            pointA: { x: 0, y: 0 },
            pointB: { x: -length/2, y: 0 },
            stiffness: 1,
            length: 0,
            render: { visible: false }
        });

        const pin2 = Constraint.create({
            bodyA: node2,
            bodyB: collisionBody,
            pointA: { x: 0, y: 0 },
            pointB: { x: length/2, y: 0 },
            stiffness: 1,
            length: 0,
            render: { visible: false }
        });

        const beam = Constraint.create({
            bodyA: node1,
            bodyB: node2,
            stiffness: 1,
            damping: 0.05,
            render: { visible: false }
        });
        
        beam.isBeam = true;
        beam.collisionBody = collisionBody;
        this.beams.push(beam);
        Composite.add(this.world, [beam, collisionBody, pin1, pin2]);
        return beam;
    }

    syncBeams() {
        // Only handles color highlighting now, dynamics are handled by constraints
        this.beams.forEach(beam => {
            if (!beam.collisionBody || !this.simulationRunning) return;
            const p1 = beam.bodyA.position;
            const p2 = beam.bodyB.position;
            const dist = Vector.magnitude(Vector.sub(p1, p2));
            
            // Highlight based on stress by swapping textures
            if (this.simulationRunning) {
                const stress = Math.abs(dist - beam.length) / beam.length;
                let newTexture = this.woodPatterns.normal;
                
                if (stress > 0.15) newTexture = this.woodPatterns.danger;
                else if (stress > 0.05) newTexture = this.woodPatterns.stressed;
                
                if (beam.collisionBody.render.sprite.texture !== newTexture) {
                    beam.collisionBody.render.sprite.texture = newTexture;
                }
            }
        });
    }

    getOrCreateNode(point) {
        // Snap to existing nodes within 40px
        const existing = this.findNearestNode(point, 40);
        if (existing) return existing;

        const node = Bodies.circle(point.x, point.y, 8, {
            isStatic: false, // Will be static during build, dynamic during play
            collisionFilter: { group: -1 }, // Nodes don't collide with each other
            render: { fillStyle: '#555', opacity: 0.8 }
        });
        this.nodes.push(node);
        Composite.add(this.world, node);
        return node;
    }

    findNearestNode(point, threshold = 40) {
        let nearest = null;
        let minDist = threshold;

        this.nodes.forEach(node => {
            const dist = Vector.magnitude(Vector.sub(node.position, point));
            if (dist < minDist) {
                minDist = dist;
                nearest = node;
            }
        });

        return nearest;
    }

    areConnected(n1, n2) {
        return this.beams.some(b => 
            (b.bodyA === n1 && b.bodyB === n2) || 
            (b.bodyA === n2 && b.bodyB === n1)
        );
    }

    startSimulation() {
        if (this.simulationRunning) return;
        this.simulationRunning = true;

        // Make everything dynamic
        this.nodes.forEach(n => {
            if (!n.isAnchor) {
                Matter.Body.setStatic(n, false);
            }
        });
        this.beams.forEach(b => {
            if (b.collisionBody) Matter.Body.setStatic(b.collisionBody, false);
        });
        this.weights.forEach(w => {
            Matter.Body.setStatic(w, false);
            if (w.initialVelocity) {
                Matter.Body.setVelocity(w, w.initialVelocity);
            }
        });

        // Set a timer for victory
        const timer = this.currentLevel.victoryTimeout || 4000;
        this.victoryTimeout = setTimeout(() => {
            if (this.simulationRunning) {
                if (this.brokenBeams === 0) this.onWin();
            }
        }, timer);

        // Tipping bucket logic
        this.extras.forEach(extra => {
             if (this.currentLevel.environment.find(e => e.id === extra.id && e.tip)) {
                 Matter.Body.setAngularVelocity(extra.body, 0.15);
             }
        });

        Runner.run(this.runner, this.engine);
        
        // Start stress monitoring and visual sync
        this.simulationInterval = setInterval(() => {
            this.updateStress();
            this.syncBeams();
        }, 1000/60);
    }

    updateStress() {
        if (!this.simulationRunning) {
            clearInterval(this.simulationInterval);
            return;
        }

        this.beams.forEach(beam => {
            const length = Vector.magnitude(Vector.sub(beam.bodyA.position, beam.bodyB.position));
            const delta = Math.abs(length - beam.length);
            const stress = delta / beam.length;

            if (stress > 0.15) {
                beam.render.strokeStyle = '#ff4757';
            } else if (stress > 0.05) {
                beam.render.strokeStyle = '#ffa502';
            } else {
                beam.render.strokeStyle = '#2ed573';
            }

            if (stress > 0.3) {
                this.breakBeam(beam);
                this.brokenBeams++;
                this.onFail("Se ha roto una pieza. ¡La estructura debe ser íntegra!");
            }
        });
    }

    breakBeam(beam) {
        if (beam.collisionBody) {
            Composite.remove(this.world, beam.collisionBody);
        }
        Composite.remove(this.world, beam);
        this.beams = this.beams.filter(b => b !== beam);
    }

    setupCollisionEvents() {
        Events.on(this.engine, 'collisionStart', (event) => {
            const pairs = event.pairs;
            pairs.forEach(pair => {
                const labels = [pair.bodyA.label, pair.bodyB.label];
                if (labels.includes('king') && labels.includes('weight')) {
                    this.onFail("¡El Rey ha sido alcanzado! Misión fallida.");
                }
            });
        });
    }

    updateCheckpoints() {
        let allActive = true;
        this.checkpoints.forEach(cp => {
            const nearest = this.findNearestNode(cp, 25);
            cp.active = !!nearest;
            if (!cp.active) allActive = false;
        });
        return allActive;
    }
}
