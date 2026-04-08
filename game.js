import { PhysicsEngine } from './physics.js';
import { LEVELS } from './levels.js';

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.currentLevelIndex = 0;
        this.physics = new PhysicsEngine(this.canvas, () => this.handleWin(), () => this.handleFail());
        
        this.tool = 'build'; // 'build', 'delete'
        this.beamsUsed = 0;
        this.drawing = false;
        this.startPoint = null;
        this.mousePoint = { x: 0, y: 0 };

        this.initUI();
        this.loadLevel(0);
        this.animate();

        window.addEventListener('resize', () => this.handleResize());
    }

    initUI() {
        // Toolbar tools
        document.getElementById('btn-build').onclick = () => this.setTool('build');
        document.getElementById('btn-delete').onclick = () => this.setTool('delete');
        
        // Actions
        document.getElementById('btn-play').onclick = () => this.startSimulation();
        document.getElementById('btn-reset').onclick = () => this.retryLevel();
        
        // Modals
        document.getElementById('btn-next-level').onclick = () => this.nextLevel();
        document.getElementById('btn-retry').onclick = () => this.retryLevel();

        // Canvas events
        this.canvas.addEventListener('mousedown', (e) => this.handleStart(e.clientX, e.clientY));
        this.canvas.addEventListener('mousemove', (e) => this.handleMove(e.clientX, e.clientY));
        this.canvas.addEventListener('mouseup', (e) => this.handleEnd(e.clientX, e.clientY));

        this.canvas.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            this.handleStart(touch.clientX, touch.clientY);
        });
        this.canvas.addEventListener('touchmove', (e) => {
            const touch = e.touches[0];
            this.handleMove(touch.clientX, touch.clientY);
        });
        this.canvas.addEventListener('touchend', (e) => {
            this.handleEnd();
        });
    }

    setTool(tool) {
        if (this.physics.simulationRunning) return;
        this.tool = tool;
        document.querySelectorAll('#toolbar button').forEach(b => b.classList.remove('active'));
        document.getElementById(`btn-${tool}`).classList.add('active');
    }

    loadLevel(index) {
        this.currentLevelIndex = index;
        const level = LEVELS[index];
        this.beamsUsed = 0;
        this.updateStats();
        
        document.getElementById('level-title').innerText = `NIVEL ${level.id}: ${level.title}`;
        document.getElementById('level-hint').innerText = level.hint;
        document.getElementById('beams-max').innerText = level.maxBeams;
        
        this.physics.loadLevel(level);
        this.hideModals();
    }

    updateStats() {
        const span = document.getElementById('beams-used');
        span.innerText = this.beamsUsed;
        
        const level = LEVELS[this.currentLevelIndex];
        if (this.beamsUsed >= level.maxBeams) {
            span.parentElement.classList.add('out-of-beams');
        } else {
            span.parentElement.classList.remove('out-of-beams');
        }
    }

    handleStart(x, y) {
        if (this.physics.simulationRunning) return;
        this.mousePoint = { x, y };
        
        if (this.tool === 'build') {
            const level = LEVELS[this.currentLevelIndex];
            if (this.beamsUsed >= level.maxBeams) return;
            
            this.drawing = true;
            this.startPoint = { x, y };
        } else if (this.tool === 'delete') {
            this.deleteAt(x, y);
        }
    }

    handleMove(x, y) {
        this.mousePoint = { x, y };
    }

    handleEnd() {
        if (this.drawing && this.startPoint) {
            const beam = this.physics.addBeam(this.startPoint, this.mousePoint);
            if (beam) {
                this.beamsUsed++;
                this.updateStats();
            }
        }
        this.drawing = false;
        this.startPoint = null;
    }

    deleteAt(x, y) {
        // Find beam near click
        const beam = this.physics.beams.find(b => {
             const midX = (b.bodyA.position.x + b.bodyB.position.x) / 2;
             const midY = (b.bodyA.position.y + b.bodyB.position.y) / 2;
             const dist = Math.hypot(midX - x, midY - y);
             return dist < 30;
        });

        if (beam) {
            this.physics.breakBeam(beam);
            this.beamsUsed--;
            this.updateStats();
        }
    }

    startSimulation() {
        this.physics.startSimulation();
        document.getElementById('btn-play').disabled = true;
        document.getElementById('toolbar').style.opacity = '0.3';
        document.getElementById('toolbar').style.pointerEvents = 'none';
    }

    retryLevel() {
        this.loadLevel(this.currentLevelIndex);
        document.getElementById('btn-play').disabled = false;
        document.getElementById('toolbar').style.opacity = '1';
        document.getElementById('toolbar').style.pointerEvents = 'auto';
    }

    nextLevel() {
        const next = (this.currentLevelIndex + 1) % LEVELS.length;
        this.loadLevel(next);
        document.getElementById('btn-play').disabled = false;
        document.getElementById('toolbar').style.opacity = '1';
        document.getElementById('toolbar').style.pointerEvents = 'auto';
    }

    handleWin() {
        document.getElementById('win-screen').classList.remove('hidden');
    }

    handleFail() {
        document.getElementById('fail-screen').classList.remove('hidden');
    }

    hideModals() {
        document.getElementById('win-screen').classList.add('hidden');
        document.getElementById('fail-screen').classList.add('hidden');
    }

    handleResize() {
        this.physics.render.canvas.width = window.innerWidth;
        this.physics.render.canvas.height = window.innerHeight;
    }

    animate() {
        // Custom drawing for building mode (previews, anchors, etc.)
        if (!this.physics.simulationRunning) {
            const ctx = this.canvas.getContext('2d');
            
            // Matter.js already renders the bodies, but we can draw extras here if needed
            // However, Matter.Render runs its own loop.
            // We'll use Matter.js Events to draw the preview.
            Matter.Events.on(this.physics.render, 'afterRender', () => {
                if (this.drawing && this.startPoint) {
                    ctx.beginPath();
                    ctx.moveTo(this.startPoint.x, this.startPoint.y);
                    ctx.lineTo(this.mousePoint.x, this.mousePoint.y);
                    ctx.strokeStyle = 'rgba(0, 242, 255, 0.5)';
                    ctx.setLineDash([5, 5]);
                    ctx.lineWidth = 4;
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            });
        }
        requestAnimationFrame(() => this.animate());
    }
}

new Game();
