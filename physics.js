const { Engine, Render, Runner, Bodies, Composite, Constraint, Mouse, MouseConstraint, Vector, Events } = Matter;

export class PhysicsEngine {
    constructor(canvas, onWin, onFail) {
        this.engine = Engine.create();
        this.world = this.engine.world;
        this.canvas = canvas;
        this.onWin = onWin;
        this.onFail = onFail;
        this.beams = [];
        this.nodes = [];
        this.weight = null;
        this.targetBar = null;
        this.simulationRunning = false;
        this.ground = null;

        // Custom renderer logic for technical look
        this.setupRenderer();
        
        // Runner
        this.runner = Runner.create();
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
        this.weight = null;
        this.targetBar = null;
        this.simulationRunning = false;
        this.engine.timing.timeScale = 1;
        Runner.stop(this.runner);
    }

    loadLevel(level) {
        this.clearWorld();
        this.currentLevel = level;

        // Add Anchors (Static nodes)
        level.anchors.forEach(anchor => {
            const node = Bodies.circle(anchor.x, anchor.y, 10, {
                isStatic: true,
                render: { fillStyle: '#00f2ff', strokeStyle: '#00f2ff', lineWidth: 2 }
            });
            node.isAnchor = true;
            node.label = anchor.id;
            this.nodes.push(node);
            Composite.add(this.world, node);
        });

        // Add Target Bar (Physics body, usually static in build mode, dynamic in play)
        this.targetBar = Bodies.rectangle(level.bar.x, level.bar.y, level.bar.width, level.bar.height, {
            isStatic: true,
            label: 'bar',
            render: { fillStyle: '#fff', opacity: 0.8 }
        });
        Composite.add(this.world, this.targetBar);

        // Add Weight (Static until play)
        this.weight = Bodies.circle(level.weight.x, level.weight.y, level.weight.radius, {
            isStatic: true,
            mass: level.weight.mass,
            label: 'weight',
            render: { fillStyle: '#ff4757', strokeStyle: '#fff', lineWidth: 2 }
        });
        Composite.add(this.world, this.weight);

        // Add Ground (invisible trigger)
        this.ground = Bodies.rectangle(window.innerWidth/2, level.groundY + 50, window.innerWidth, 100, {
            isStatic: true,
            isSensor: true,
            label: 'ground'
        });
        Composite.add(this.world, this.ground);
        
        this.setupCollisionEvents();
    }

    addBeam(p1, p2) {
        // Find or create nodes at endpoints
        const node1 = this.getOrCreateNode(p1);
        const node2 = this.getOrCreateNode(p2);

        // Don't add if already connected
        if (this.areConnected(node1, node2)) return null;

        const beam = Constraint.create({
            bodyA: node1,
            bodyB: node2,
            stiffness: 0.9,
            damping: 0.1,
            render: {
                strokeStyle: '#888',
                lineWidth: 8,
                type: 'line'
            }
        });
        
        beam.isBeam = true;
        this.beams.push(beam);
        Composite.add(this.world, beam);
        return beam;
    }

    getOrCreateNode(point) {
        // Snap to existing nodes within 20px
        const existing = this.nodes.find(n => Vector.magnitude(Vector.sub(n.position, point)) < 25);
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
        Matter.Body.setStatic(this.targetBar, false);
        Matter.Body.setStatic(this.weight, false);

        Runner.run(this.runner, this.engine);
        
        // Start stress monitoring
        this.simulationInterval = setInterval(() => this.updateStress(), 1000/60);
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

            // Color based on stress
            if (stress > 0.15) {
                beam.render.strokeStyle = '#ff4757';
            } else if (stress > 0.05) {
                beam.render.strokeStyle = '#ffa502';
            } else {
                beam.render.strokeStyle = '#2ed573';
            }

            // Break if over limit
            if (stress > 0.3) {
                this.breakBeam(beam);
            }
        });
    }

    breakBeam(beam) {
        Composite.remove(this.world, beam);
        this.beams = this.beams.filter(b => b !== beam);
    }

    setupCollisionEvents() {
        Events.on(this.engine, 'collisionStart', (event) => {
            event.pairs.forEach(pair => {
                const labels = [pair.bodyA.label, pair.bodyB.label];
                
                // Weight hits ground -> Fail
                if (labels.includes('weight') && labels.includes('ground')) {
                    this.onFail();
                }
                
                // Weight hits bar
                if (labels.includes('weight') && labels.includes('bar')) {
                    // Success if weight stays on bar for 3 seconds?
                    // Simplified: if it hits the bar and some time passes without hitting ground
                    setTimeout(() => {
                        if (this.simulationRunning && !labels.includes('ground')) {
                             // Check if weight is still above ground
                             if (this.weight.position.y < this.currentLevel.groundY) {
                                this.onWin();
                             }
                        }
                    }, 2500);
                }
            });
        });
    }
}
