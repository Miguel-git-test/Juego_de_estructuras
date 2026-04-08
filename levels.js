const archetypes = [
    { name: "PARED", type: "wall" },
    { name: "COCHE", type: "car" },
    { name: "EMBUDO", type: "slope" },
    { name: "TORRE", type: "anchor" },
    { name: "PÉNDULO", type: "tether" },
    { name: "LLUVIA", type: "rain" },
    { name: "PUENTE", type: "anchor" }
];

function generateLevels() {
    const levels = [];
    for (let i = 1; i <= 100; i++) {
        const arch = archetypes[(i - 1) % archetypes.length];
        const difficulty = i / 100;
        const maxBeams = Math.max(3, 15 - Math.floor(i / 10));
        const mass = 10 + Math.floor(i * 1.5);
        
        let level = {
            id: i,
            title: `${arch.name} ${Math.ceil(i/archetypes.length)}`,
            hint: `Desafío de dificultad ${Math.ceil(i/10)}.`,
            maxBeams: maxBeams,
            groundY: 650,
            anchors: [],
            environment: [],
            checkpoints: []
        };

        // Specific logic based on archetype
        switch (arch.type) {
            case 'cannon':
                const side = i % 2 === 0 ? 1 : -1;
                const cannonX = side === 1 ? 50 : 750;
                const cannonY = 200 + (i % 200);
                const angle = side === 1 ? 0.3 : 2.8;
                
                level.environment = [{ type: 'cannon', x: cannonX, y: cannonY, w: 80, h: 40, angle: angle }];
                level.anchors = [{ id: 'a1', x: 400 - 100, y: 550 }, { id: 'a2', x: 400 + 100, y: 550 }];
                level.checkpoints = [{ x: 400 + side * 50, y: cannonY + 50 }];
                level.weights = [{
                    x: cannonX + side * 40, y: cannonY,
                    radius: 20, mass: mass,
                    velocity: { x: side * (10 + i/5), y: -5 + (i%10) }
                }];
                level.hint = "Bloquea el proyectil. ¡La estructura debe pasar por el punto indicado!";
                break;
            
            case 'car':
                const carX = 200 + (i % 40) * 10;
                level.environment = [{ id: 'car', type: 'car', x: carX, y: 550, w: 200, h: 40 }];
                level.anchors = [{ id: 'a1', x: carX - 70, y: 530, attachTo: 'car' }, { id: 'a2', x: carX + 70, y: 530, attachTo: 'car' }];
                level.checkpoints = [{ x: carX, y: 400 }];
                level.weight = { x: carX + Math.sin(i) * 30, y: 50, radius: 30, mass: mass };
                break;

            case 'slope':
                const slopeAngle = 0.2 + (i % 5) * 0.1;
                level.environment = [
                    { type: 'slope', x: 200, y: 550, w: 300, h: 20, angle: -slopeAngle },
                    { type: 'slope', x: 600, y: 550, w: 300, h: 20, angle: slopeAngle }
                ];
                level.anchors = [{ id: 'a1', x: 100, y: 400 }, { id: 'a2', x: 700, y: 400 }];
                level.checkpoints = [{ x: 400, y: 450 }];
                level.weight = { x: 400 + (i%2==0?40:-40), y: 0, radius: 40, mass: mass };
                break;

            case 'tether':
                level.anchors = [{ id: 'a1', x: 300 + Math.sin(i)*50, y: 550 }, { id: 'a2', x: 500 + Math.cos(i)*50, y: 550 }];
                level.checkpoints = [{ x: 400, y: 300 }];
                level.weight = { 
                    x: 100 + (i%20)*5, y: 200, radius: 35, mass: mass,
                    tether: { x: 400, y: -200 }
                };
                break;

            case 'rain':
                level.environment = [{ id: 'bucket', type: 'bucket', x: 400, y: 150, w: 200, h: 40, tip: true }];
                level.anchors = [{ id: 'a1', x: 200, y: 550 }, { id: 'a2', x: 600, y: 550 }];
                level.checkpoints = [{ x: 300, y: 400 }, { x: 500, y: 400 }];
                level.weights = Array.from({ length: 10 + Math.floor(i/5) }, (_, j) => ({
                    x: 350 + (j % 5) * 20,
                    y: 50 + Math.floor(j / 5) * 20,
                    radius: 10, mass: 4, color: '#7f8c8d'
                }));
                break;

            default: // Bridge/Tower/Wall
                const gap = 200 + (i % 300);
                level.anchors = [{ id: 'a1', x: 400 - gap/2, y: 500 }, { id: 'a2', x: 400 + gap/2, y: 500 }];
                level.checkpoints = [{ x: 400, y: 400 - (i%50) }];
                level.weight = { x: 400, y: 50, radius: 30 + (i%20), mass: mass };
                break;
        }

        levels.push(level);
    }
    return levels;
}

export const LEVELS = generateLevels();
