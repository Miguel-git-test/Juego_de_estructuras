const archetypes = [
    { name: "PARED", type: "wall" },
    { name: "COCHE", type: "car" },
    { name: "EMBUDO", type: "slope" },
    { name: "TORRE", type: "anchor" },
    { name: "PÉNDULO", type: "tether" },
    { name: "LLUVIA", type: "rain" },
    { name: "CAÑÓN", type: "cannon" },
    { name: "PUENTE", type: "anchor" }
];

function generateLevels() {
    const levels = [];
    for (let i = 1; i <= 100; i++) {
        const arch = archetypes[(i - 1) % archetypes.length];
        const difficulty = i / 100;
        const maxBeams = Math.max(3, 15 - Math.floor(i / 10));
        const mass = 15 + Math.floor(i * 2);
        
        let level = {
            id: i,
            title: `${arch.name} ${Math.ceil(i/archetypes.length)}`,
            hint: `Desafío de dificultad ${Math.ceil(i/10)}.`,
            maxBeams: maxBeams,
            groundY: 650,
            anchors: [],
            environment: [],
            checkpoints: [],
            victoryTimeout: arch.type === 'rain' ? 6000 : 4000
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
                break;
            
            case 'car':
                const carHeight = 30;
                const wheelsRadius = carHeight * 0.6;
                const carY = 650 - wheelsRadius - carHeight/2; // Perfectly on ground
                const distBetween = 200 + (i % 100);
                level.environment = [
                    { id: 'car1', type: 'car', x: 400 - distBetween/2, y: carY, w: 120, h: carHeight },
                    { id: 'car2', type: 'car', x: 400 + distBetween/2, y: carY, w: 120, h: carHeight }
                ];
                level.anchors = [
                    { id: 'a1', x: 400 - distBetween/2, y: carY - 15, attachTo: 'car1' },
                    { id: 'a2', x: 400 + distBetween/2, y: carY - 15, attachTo: 'car2' }
                ];
                if (i > 50) { // Add more anchors later
                    level.anchors.push({ id: 'a3', x: 400 - distBetween/2 + 30, y: carY - 15, attachTo: 'car1' });
                    level.anchors.push({ id: 'a4', x: 400 + distBetween/2 - 30, y: carY - 15, attachTo: 'car2' });
                }
                level.checkpoints = [{ x: 400, y: 400 }];
                level.weight = { x: 400, y: 50, radius: 35, mass: mass };
                level.hint = "¡Une ambos coches! Si la estructura no es sólida, se separarán.";
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
                level.environment = [{ id: 'bucket', type: 'bucket', x: 400, y: 120, w: 220, h: 40, tip: true }];
                level.anchors = [{ id: 'a1', x: 200, y: 550 }, { id: 'a2', x: 600, y: 550 }];
                level.checkpoints = [{ x: 300, y: 400 }, { x: 500, y: 400 }];
                level.weights = Array.from({ length: 25 + Math.floor(i/4) }, (_, j) => ({
                    x: 340 + (j % 6) * 20,
                    y: 20 + Math.floor(j / 6) * 15,
                    radius: 7, mass: 4, color: '#95a5a6'
                }));
                level.hint = "¡Iron Rain! Crea un caparazón sólido para proteger tus cimientos.";
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
