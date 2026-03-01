export const samples = [
    {
        id: 'rectangle',
        name: 'Rectangle',
        description: 'Basic rectangular room, 23\'6" x 13\'0"',
        walls: [[0, 0], [500, 0], [500, 277], [0, 277]],
        dimensions: ['23\' 6"', '13\' 0"'],
        expectedScale: 1.773,
    },
    {
        id: 'l-shape',
        name: 'L-Shape',
        description: 'L-shaped room, outer 30\'x20\', notch 12\'x10\'',
        walls: [[0, 0], [720, 0], [720, 240], [432, 240], [432, 480], [0, 480]],
        dimensions: ['30\' 0"', '20\' 0"', '12\' 0"', '10\' 0"'],
        expectedScale: 2.0,
    },
    {
        id: 'u-shape',
        name: 'U-Shape',
        description: 'U-shaped room, outer 25\'x18\', center notch 10\'x8\'',
        walls: [[0, 0], [450, 0], [450, 324], [315, 324], [315, 180], [135, 180], [135, 324], [0, 324]],
        dimensions: ['25\' 0"', '18\' 0"', '10\' 0"', '8\' 0"'],
        expectedScale: 1.5,
    },
    {
        id: 'compound',
        name: 'Compound',
        description: 'Room with fractional dimensions, 15\'6.5" x 10\'3"',
        walls: [[0, 0], [373, 0], [373, 246], [0, 246]],
        dimensions: ['15\' 6 1/2"', '10\' 3"'],
        expectedScale: 2.0,
    },
    {
        id: 'metric',
        name: 'Metric',
        description: 'European apartment, 7.5m x 4.2m',
        walls: [[0, 0], [443, 0], [443, 248], [0, 248]],
        dimensions: ['7.5m', '4.2m'],
        expectedScale: 1.5,
    },
];
//# sourceMappingURL=samples.js.map