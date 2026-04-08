export const LEVELS = [
    {
        id: 1,
        title: "FUNDAMENTOS",
        hint: "Construye un soporte básico para evitar que el peso caiga al vacío.",
        maxBeams: 5,
        anchors: [
            { id: 'a1', x: 200, y: 500 },
            { id: 'a2', x: 600, y: 500 }
        ],
        bar: { x: 400, y: 400, width: 200, height: 20 },
        weight: { x: 400, y: 100, radius: 30, mass: 10 },
        groundY: 650
    },
    {
        id: 2,
        title: "TRIANGULACIÓN",
        hint: "Los triángulos son la forma más fuerte en ingeniería.",
        maxBeams: 8,
        anchors: [
            { id: 'a1', x: 150, y: 550 },
            { id: 'a2', x: 650, y: 550 }
        ],
        bar: { x: 400, y: 350, width: 250, height: 20 },
        weight: { x: 400, y: 50, radius: 40, mass: 20 },
        groundY: 650
    },
    {
        id: 3,
        title: "EL PUENTE",
        hint: "Crea una estructura que se extienda para alcanzar el centro.",
        maxBeams: 12,
        anchors: [
            { id: 'a1', x: 100, y: 450 },
            { id: 'a2', x: 700, y: 450 }
        ],
        bar: { x: 400, y: 400, width: 300, height: 20 },
        weight: { x: 400, y: 0, radius: 50, mass: 50 },
        groundY: 650
    }
];
