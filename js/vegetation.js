import * as THREE from 'three';

function mulberry32(a) {
    return function() {
        let t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

function rnd(rng, a, b) { return a + rng() * (b - a); }
function rndi(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }

const BIOMES = [
    { name: 'forest', treeChance: 0.5, shrubChance: 0.3, palmChance: 0.2, density: 600, minH: 0, maxH: 10 },
    { name: 'jungle', treeChance: 0.4, palmChance: 0.4, shrubChance: 0.2, density: 800, minH: -1, maxH: 12 },
    { name: 'desert', cactusChance: 0.5, shrubChance: 0.3, spireChance: 0.2, density: 300, minH: 2, maxH: 14 },
    { name: 'tundra', shrubChance: 0.6, fungusChance: 0.4, density: 200, minH: 0, maxH: 8 },
    { name: 'crystal', crystalChance: 0.7, spireChance: 0.3, density: 400, minH: -1, maxH: 10 },
    { name: 'fungal', fungusChance: 0.7, spireChance: 0.3, density: 500, minH: 0, maxH: 10 },
];

function pickBiome(seed, starType) {
    const cls = starType.cls;
    if (cls === 'MGN') return BIOMES[4];
    if (cls === 'QSR' || cls === 'PSR') return BIOMES[4];
    if (cls === 'M' || cls === 'L') return BIOMES[2];
    if (cls === 'T' || cls === 'Y') return BIOMES[3];
    if (cls === 'K') return mulberry32(seed + 1111)() < 0.5 ? BIOMES[2] : BIOMES[0];
    const rng = mulberry32(seed + 1111);
    const idx = rng() < 0.4 ? 0 : rng() < 0.5 ? 1 : rng() < 0.7 ? 5 : 0;
    return BIOMES[idx];
}

function starToColor(starType, rng) {
    const c = new THREE.Color(starType.color);
    if (starType.cls === 'MGN') return new THREE.Color().setHSL(0.75 + rng() * 0.1, 0.8, 0.5 + rng() * 0.3);
    if (starType.cls === 'QSR') return new THREE.Color().setHSL(0.6, 0.3, 0.7 + rng() * 0.3);
    if (starType.cls === 'PSR') return new THREE.Color().setHSL(0.58, 0.6, 0.4 + rng() * 0.3);
    const h = c.getHSL({}).h;
    const plantH = h + 0.25 + rng() * 0.12;
    return new THREE.Color().setHSL(plantH % 1, 0.4 + rng() * 0.4, 0.2 + rng() * 0.3);
}

function crystalColor(starType, rng) {
    const c = new THREE.Color(starType.color);
    const h = c.getHSL({}).h;
    return new THREE.Color().setHSL((h + 0.3 + rng() * 0.4) % 1, 0.7 + rng() * 0.3, 0.5 + rng() * 0.4);
}

function makeMat(color) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05 });
}

function makeCrystalMat(color) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.1, metalness: 0.4, emissive: color, emissiveIntensity: 0.15 });
}

function createTree(color, scale, rng) {
    const g = new THREE.Group();
    const trunkH = rnd(rng, 0.6, 1.4) * scale;
    const trunkR = rnd(rng, 0.03, 0.07) * scale;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(trunkR * 0.6, trunkR, trunkH, 5, 1), makeMat(0x5c4033));
    trunk.position.y = trunkH * 0.5;
    g.add(trunk);

    const crownR = rnd(rng, 0.25, 0.6) * scale;
    const crownH = rnd(rng, 0.2, 0.5) * scale;
    const crown = new THREE.Mesh(new THREE.SphereGeometry(crownR, 5, 4), makeMat(color));
    crown.position.y = trunkH + crownH * 0.3;
    crown.scale.y = rnd(rng, 0.7, 1.3);
    g.add(crown);

    if (rng() < 0.3) {
        const c2 = new THREE.Mesh(new THREE.SphereGeometry(crownR * 0.6, 5, 4), makeMat(color));
        c2.position.set(rnd(rng, -0.3, 0.3) * scale, trunkH + rnd(rng, 0.1, 0.3) * scale, rnd(rng, -0.3, 0.3) * scale);
        g.add(c2);
    }
    return g;
}

function createPalm(color, scale, rng) {
    const g = new THREE.Group();
    const trunkH = rnd(rng, 1.0, 2.0) * scale;
    const trunkR = rnd(rng, 0.03, 0.06) * scale;
    const lean = rnd(rng, -0.15, 0.15);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(trunkR * 0.3, trunkR, trunkH, 6, 1), makeMat(0x6b4c3b));
    trunk.position.y = trunkH * 0.5;
    g.add(trunk);

    const nFronds = rndi(rng, 4, 8);
    for (let i = 0; i < nFronds; i++) {
        const angle = (i / nFronds) * Math.PI * 2 + rng() * 0.3;
        const frondLen = rnd(rng, 0.4, 0.9) * scale;
        const frond = new THREE.Mesh(
            new THREE.ConeGeometry(0.02 * scale, frondLen, 3, 1),
            makeMat(color)
        );
        frond.position.set(0, trunkH, 0);
        frond.rotation.x = 1.0 + rng() * 0.4;
        frond.rotation.y = angle;
        frond.translateY(0.05 * scale);
        g.add(frond);
    }

    g.rotation.z = lean;
    return g;
}

function createCactus(color, scale, rng) {
    const g = new THREE.Group();
    const h = rnd(rng, 0.6, 1.8) * scale;
    const r = rnd(rng, 0.06, 0.14) * scale;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r, h, 7, 1), makeMat(color));
    body.position.y = h * 0.5;
    g.add(body);

    const nArms = rndi(rng, 0, 3);
    for (let i = 0; i < nArms; i++) {
        const armH = rnd(rng, 0.3, 0.7) * scale;
        const armR = r * 0.6;
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(armR * 0.7, armR, armH, 5, 1), makeMat(color));
        const ay = rnd(rng, 0.2, 0.5) * h;
        arm.position.set(rnd(rng, -1, 1) > 0 ? r * 0.8 : -r * 0.8, ay, rnd(rng, -1, 1) * r * 0.5);
        arm.rotation.z = rnd(rng, -0.3, 0.3);
        g.add(arm);
    }
    return g;
}

function createCrystalCluster(color, scale, rng) {
    const g = new THREE.Group();
    const n = rndi(rng, 3, 7);
    for (let i = 0; i < n; i++) {
        const cH = rnd(rng, 0.2, 0.8) * scale;
        const cR = rnd(rng, 0.02, 0.06) * scale;
        const crystal = new THREE.Mesh(new THREE.ConeGeometry(cR, cH, 4, 1), makeCrystalMat(color));
        const theta = rng() * Math.PI * 2;
        const dist = rnd(rng, 0, 0.12) * scale;
        crystal.position.set(Math.cos(theta) * dist, cH * 0.4, Math.sin(theta) * dist);
        crystal.rotation.set(rnd(rng, -0.2, 0.2), rng() * Math.PI * 2, 0);
        g.add(crystal);
    }
    return g;
}

function createFungus(color, scale, rng) {
    const g = new THREE.Group();
    const stemH = rnd(rng, 0.3, 0.8) * scale;
    const stemR = rnd(rng, 0.02, 0.05) * scale;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(stemR * 0.5, stemR, stemH, 5, 1), makeMat(0xe8dcc8));
    stem.position.y = stemH * 0.5;
    g.add(stem);

    const capR = rnd(rng, 0.15, 0.4) * scale;
    const capH = rnd(rng, 0.06, 0.15) * scale;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(capR, 6, 4), makeMat(color));
    cap.position.y = stemH + capH * 0.3;
    cap.scale.y = 0.3 + rng() * 0.3;
    g.add(cap);

    if (rng() < 0.35) {
        const s2 = new THREE.Mesh(new THREE.CylinderGeometry(stemR * 0.4, stemR * 0.7, stemH * 0.6, 5, 1), makeMat(0xe8dcc8));
        s2.position.set(rnd(rng, -0.15, 0.15) * scale, stemH * 0.3, rnd(rng, -0.15, 0.15) * scale);
        g.add(s2);
        const c2 = new THREE.Mesh(new THREE.SphereGeometry(capR * 0.6, 6, 4), makeMat(color));
        c2.position.set(s2.position.x, stemH * 0.6 + capH * 0.2, s2.position.z);
        c2.scale.y = 0.3;
        g.add(c2);
    }
    return g;
}

function createShrub(color, scale, rng) {
    const g = new THREE.Group();
    const n = rndi(rng, 2, 5);
    for (let i = 0; i < n; i++) {
        const r = rnd(rng, 0.08, 0.2) * scale;
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(r, 4, 3), makeMat(color));
        sphere.position.set(rnd(rng, -0.2, 0.2) * scale, r * 0.3, rnd(rng, -0.2, 0.2) * scale);
        sphere.scale.y = rnd(rng, 0.4, 0.8);
        g.add(sphere);
    }
    return g;
}

function createSpire(color, scale, rng) {
    const g = new THREE.Group();
    const h = rnd(rng, 0.8, 2.0) * scale;
    const r = rnd(rng, 0.02, 0.06) * scale;
    const spire = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5, 1), makeCrystalMat(color));
    spire.position.y = h * 0.5;
    g.add(spire);

    if (rng() < 0.4) {
        const r2 = r * rnd(rng, 0.5, 1.0);
        const h2 = h * rnd(rng, 0.3, 0.6);
        const s2 = new THREE.Mesh(new THREE.ConeGeometry(r2, h2, 5, 1), makeCrystalMat(color));
        s2.position.set(rnd(rng, -0.1, 0.1) * scale, h2 * 0.3, rnd(rng, -0.1, 0.1) * scale);
        s2.rotation.z = rnd(rng, -0.2, 0.2);
        g.add(s2);
    }
    return g;
}

function createPlant(type, color, scale, rng) {
    switch (type) {
        case 'tree': return createTree(color, scale, rng);
        case 'palm': return createPalm(color, scale, rng);
        case 'cactus': return createCactus(color, scale, rng);
        case 'crystal': return createCrystalCluster(color, scale, rng);
        case 'fungus': return createFungus(color, scale, rng);
        case 'shrub': return createShrub(color, scale, rng);
        case 'spire': return createSpire(color, scale, rng);
        default: return createShrub(color, scale, rng);
    }
}

function pickType(biome, rng) {
    const r = rng();
    let cumulative = 0;
    for (const key of ['treeChance', 'palmChance', 'cactusChance', 'crystalChance', 'fungusChance', 'shrubChance', 'spireChance']) {
        cumulative += biome[key] || 0;
        if (r < cumulative) return key.replace('Chance', '');
    }
    return 'shrub';
}

function getSurfaceNormal(planet, dir) {
    const eps = 0.01;
    const h0 = planet.getHeight(dir);
    const upRef = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const tangent = new THREE.Vector3().crossVectors(dir, upRef).normalize();
    const bitangent = new THREE.Vector3().crossVectors(dir, tangent).normalize();
    const t1 = new THREE.Vector3().addVectors(dir, tangent.clone().multiplyScalar(eps)).normalize();
    const t2 = new THREE.Vector3().addVectors(dir, bitangent.clone().multiplyScalar(eps)).normalize();
    const h1 = planet.getHeight(t1);
    const h2 = planet.getHeight(t2);
    const p0 = dir.clone().multiplyScalar(h0);
    const p1 = t1.clone().multiplyScalar(h1);
    const p2 = t2.clone().multiplyScalar(h2);
    const e1 = new THREE.Vector3().copy(p1).sub(p0);
    const e2 = new THREE.Vector3().copy(p2).sub(p0);
    return new THREE.Vector3().crossVectors(e1, e2).normalize();
}

function plantRadius(type, scale) {
    switch (type) {
        case 'tree': return scale * 0.4;
        case 'palm': return scale * 0.35;
        case 'cactus': return scale * 0.22;
        case 'crystal': return scale * 0.3;
        case 'fungus': return scale * 0.28;
        case 'shrub': return scale * 0.3;
        case 'spire': return scale * 0.2;
        default: return scale * 0.25;
    }
}

export function breakPlant(plant) {
    plant.userData.collisionRadius = 0;
    const up = plant.position.clone().normalize();
    plant.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
    plant.rotateX(Math.PI / 2);
    plant.rotateZ((Math.random() - 0.5) * 0.5);
    plant.position.add(up.clone().multiplyScalar(-0.2));
    plant.traverse(c => {
        if (c.isMesh) {
            c.material = c.material.clone();
            c.material.color.setHex(0x8B7355);
            c.material.emissive = new THREE.Color(0x000000);
        }
    });
}

export function generateVegetation(planet, starData, seed) {
    const rng = mulberry32(seed + 9999);
    if (rng() < 0.2) return { plants: [], biome: 'barren' };
    const biome = pickBiome(seed, starData.type);
    const count = biome.density;
    const plants = [];

    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const maxSlope = Math.cos(Math.PI / 6);

    let placed = 0;
    let attempts = 0;
    while (placed < count && attempts < count * 10) {
        attempts++;
        const theta = rng() * Math.PI * 2;
        const phi = Math.acos(2 * rng() - 1);
        const dir = new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
        const h = planet.getHeight(dir);
        const elev = h - planet.baseRadius;
        if (elev < biome.minH || elev > biome.maxH) continue;

        const normal = getSurfaceNormal(planet, dir);
        if (normal.dot(dir) < maxSlope) continue;

        const color = biome.name === 'crystal' ? crystalColor(starData.type, rng) : starToColor(starData.type, rng);
        const type = pickType(biome, rng);
        const scale = 1.0 + rng() * 2.5;
        const plant = createPlant(type, color, scale, rng);

        pos.copy(dir).multiplyScalar(h);
        plant.position.copy(pos);
        quat.setFromUnitVectors(up, normal);
        plant.quaternion.copy(quat);
        plant.userData.collisionRadius = plantRadius(type, scale);
        plant.userData.plantType = type;

        plants.push(plant);
        placed++;
    }
    return { plants, biome: biome.name };
}