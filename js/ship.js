import * as THREE from 'three';

const SHIP_PALETTES = [
    [0x8899aa, 0xccddee, 0x556677],
    [0xaa6633, 0xddaa66, 0x664422],
    [0x779966, 0xaacc88, 0x445533],
    [0x664466, 0xaa88aa, 0x443344],
    [0x666677, 0x9999aa, 0x444455],
    [0x995544, 0xcc8877, 0x663322],
    [0x555566, 0x888899, 0x333344],
    [0x884422, 0xcc7733, 0x552211],
];

const SHIP_NAMES = [
    'Stardrift', 'Cometfall', 'Nightwing', 'Dustrunner', 'Solarwind', 'Emberwing',
    'Lostlight', 'Halcyon', 'Icarus-3', 'Aurora', 'Wanderer', 'Odyssey',
    'Vega-9', 'Nightfall', 'Starfall', 'Bluebird',
];

function mulberry32(a) {
    return function() {
        let t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

function makeMat(color) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.5 });
}

function makeDarkMat(color) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.1 });
}

function makeGlassMat() {
    return new THREE.MeshStandardMaterial({
        color: 0x88ccff, roughness: 0.1, metalness: 0.2,
        emissive: 0x224466, emissiveIntensity: 0.4,
    });
}

export function generateCrashedShip(seed) {
    const rng = mulberry32(seed + 12121);
    const palette = SHIP_PALETTES[rng() * SHIP_PALETTES.length | 0];
    const name = SHIP_NAMES[rng() * SHIP_NAMES.length | 0];
    const style = rng();
    const g = new THREE.Group();
    const c0 = palette[0], c1 = palette[1], c2 = palette[2];
    const finCount = rng() * 3 | 0;
    const engineCount = 1 + (rng() * 3 | 0);
    const broken = rng() < 0.5;

    if (style < 0.4) {
        const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 3.2, 10), makeMat(c0));
        hull.rotation.z = Math.PI / 2;
        g.add(hull);
        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.1, 10), makeMat(c1));
        nose.rotation.z = Math.PI / 2;
        nose.position.x = 2.1;
        g.add(nose);
        const win = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), makeGlassMat());
        win.position.set(0.35, 0.6, 0);
        g.add(win);
        for (let i = 0; i < finCount; i++) {
            const fin = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 1.1), makeMat(c2));
            fin.position.set(-1.2, 0, (i - (finCount - 1) / 2) * 0.9);
            fin.rotation.y = (rng() - 0.5) * 0.3;
            g.add(fin);
        }
        for (let i = 0; i < engineCount; i++) {
            const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.5, 8), makeDarkMat(0x222222));
            eng.rotation.z = Math.PI / 2;
            eng.position.set(-2, (i - (engineCount - 1) / 2) * 0.35, 0);
            g.add(eng);
        }
        if (broken) {
            const brokenFin = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 1.2), makeMat(c2));
            brokenFin.position.set(1.8, -0.35, 0.7);
            brokenFin.rotation.set(0.5, 0.3, -0.4);
            g.add(brokenFin);
        }
    } else if (style < 0.7) {
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.1, 0.35, 14), makeMat(c0));
        g.add(disc);
        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 12), makeGlassMat());
        dome.scale.set(1, 0.7, 1);
        dome.position.y = 0.4;
        g.add(dome);
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.1, 12), makeMat(c1));
        band.position.y = 0.1;
        g.add(band);
        for (let i = 0; i < engineCount; i++) {
            const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.4, 6), makeDarkMat(0x222222));
            eng.position.set(0, -0.3, (i - (engineCount - 1) / 2) * 0.6);
            g.add(eng);
        }
        if (broken) {
            const piece = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), makeMat(c1));
            piece.position.set(1.5, 0.2, -0.5);
            g.add(piece);
        }
    } else {
        const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, 1.1), makeMat(c0));
        g.add(body);
        const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 10), makeGlassMat());
        canopy.scale.set(1, 0.6, 1);
        canopy.position.set(0.6, 0.65, 0);
        g.add(canopy);
        const wing1 = new THREE.Mesh(new THREE.BoxGeometry(1, 0.06, 0.9), makeMat(c1));
        wing1.position.set(-0.8, 0, 0.9);
        g.add(wing1);
        const wing2 = new THREE.Mesh(new THREE.BoxGeometry(1, 0.06, 0.9), makeMat(c1));
        wing2.position.set(-0.8, 0, -0.9);
        g.add(wing2);
        for (let i = 0; i < engineCount; i++) {
            const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.5, 6), makeDarkMat(0x222222));
            eng.rotation.x = Math.PI / 2;
            eng.position.set(-1.5, -0.2, (i - (engineCount - 1) / 2) * 0.5);
            g.add(eng);
        }
        if (broken) {
            const missing = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.8), makeMat(c1));
            missing.position.set(-0.2, -0.3, 1.6);
            missing.rotation.set(0.6, 0.4, 0.2);
            g.add(missing);
        }
    }

    const scorch = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.06, 2.2), makeDarkMat(0x111111));
    scorch.position.y = -0.6;
    scorch.rotation.y = rng() * Math.PI;
    g.add(scorch);

    const lean = new THREE.Group();
    lean.rotation.z = 0.2 + rng() * 0.4;
    lean.rotation.y = rng() * Math.PI * 2;
    lean.scale.setScalar(2.5 + rng() * 2);
    lean.add(g);

    return { mesh: lean, name, palette };
}
