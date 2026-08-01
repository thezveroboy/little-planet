import * as THREE from 'three';
import { makeGlowTexture } from './sky.js?v=45';

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

let _rngForProjectiles = null;
function setProjectileRng(rngFn) { _rngForProjectiles = rngFn; }
function rng() { return _rngForProjectiles ? _rngForProjectiles() : Math.random(); }

const WEAPON_TYPES = [
    { id: 'pistol',   name: 'Pistol',   fireRate: [2, 4],   magSize: [10, 18],  reload: [1.0, 1.5], weight: [0.6, 1.0], acc: [1.0, 2.5], dmg: [15, 25],  projCount: 1 },
    { id: 'revolver', name: 'Revolver', fireRate: [1, 2],   magSize: [5, 7],    reload: [1.5, 2.5], weight: [0.8, 1.3], acc: [0.5, 1.5], dmg: [35, 55],  projCount: 1 },
    { id: 'rifle',    name: 'Rifle',    fireRate: [0.8, 2], magSize: [8, 15],   reload: [1.5, 2.5], weight: [1.5, 2.5], acc: [0.3, 1.0], dmg: [30, 50],  projCount: 1 },
    { id: 'assault',  name: 'Assault',  fireRate: [6, 10],  magSize: [25, 40],  reload: [2.0, 3.0], weight: [2.0, 3.0], acc: [1.5, 3.5], dmg: [12, 20],  projCount: 1 },
    { id: 'smg',      name: 'SMG',      fireRate: [10, 16], magSize: [30, 50],  reload: [1.5, 2.5], weight: [1.2, 2.0], acc: [2.0, 4.0], dmg: [8, 14],   projCount: 1 },
    { id: 'shotgun',  name: 'Shotgun',  fireRate: [0.6, 1.5], magSize: [4, 8], reload: [2.0, 3.5], weight: [2.0, 3.5], acc: [4.0, 8.0], dmg: [20, 30],  projCount: [6, 12] },
    { id: 'sniper',   name: 'Sniper',   fireRate: [0.4, 1], magSize: [3, 6],   reload: [2.5, 4.0], weight: [2.5, 4.0], acc: [0.1, 0.4], dmg: [60, 100], projCount: 1 },
    { id: 'lmg',      name: 'LMG',      fireRate: [8, 14],  magSize: [60, 120], reload: [4.0, 6.0], weight: [4.0, 6.0], acc: [2.0, 4.0], dmg: [10, 16],  projCount: 1 },
];

const AMMO_TYPES = [
    { id: 'bullet', name: 'Powder Cartridge', color: 0xffcc44, speed: 80, size: 0.06, trail: false, glow: false, laser: false },
    { id: 'laser',  name: 'Laser Charge',     color: 0xff4444, speed: 0,   size: 0,    trail: false, glow: false, laser: true },
    { id: 'plasma', name: 'Plasma Bolt',      color: 0x44ff88, speed: 25, size: 0.15, trail: true,  glow: true,  laser: false },
    { id: 'gauss',  name: 'Gauss Slug',       color: 0x44aaff, speed: 60, size: 0.08, trail: true,  glow: true,  laser: false },
];

const WEAPON_NAMES = [
    'Thunder', 'Venom', 'Fury', 'Storm', 'Blade', 'Viper', 'Cobra', 'Talon',
    'Fang', 'Rage', 'Hammer', 'Anvil', 'Bolt', 'Flash', 'Shadow', 'Ghost',
    'Reaper', 'Scythe', 'Ember', 'Frost', 'Wildfire', 'Ice', 'Steel', 'Iron',
    'Dusk', 'Dawn', 'Eclipse', 'Nova', 'Pulse', 'Quake', 'Shock', 'Blaze',
];

function genWeaponName(seed) {
    const rng = mulberry32(seed + 5555);
    const a = WEAPON_NAMES[rng() * WEAPON_NAMES.length | 0];
    const b = WEAPON_NAMES[rng() * WEAPON_NAMES.length | 0];
    return a + '-' + b;
}

function pick(arr, rng) { return arr[rng() * arr.length | 0]; }

function genColors(rng) {
    const pal = [
        [0x333333, 0x888888, 0xcccccc],
        [0x1a1a2e, 0x16213e, 0x0f3460],
        [0x2d132c, 0x801336, 0xc72c41],
        [0x1b4332, 0x2d6a4f, 0x40916c],
        [0x3e1f47, 0x5c2e6e, 0x7b4b8a],
        [0x4a4a4a, 0x6b6b6b, 0x8a8a8a],
        [0x5c3a21, 0x8b5e34, 0xb88a5e],
        [0x1a1a1a, 0x2b2b2b, 0x4a4a4a],
    ];
    return pal[rng() * pal.length | 0];
}

function makeMat(color) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.4 });
}

function makeEmissiveMat(color) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.6, emissive: color, emissiveIntensity: 0.3 });
}

function buildWeaponMesh(type, colors, rng) {
    const g = new THREE.Group();
    const c0 = colors[0], c1 = colors[1], c2 = colors[2];

    switch (type.id) {
        case 'pistol': {
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.12), makeMat(c0));
            g.add(body);
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.16, 6), makeMat(c1));
            barrel.rotation.x = Math.PI / 2;
            barrel.position.z = -0.13;
            g.add(barrel);
            const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.07, 4), makeMat(c2));
            grip.position.y = -0.08;
            g.add(grip);
            const slide = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.025, 0.1), makeMat(c1));
            slide.position.set(0, 0.055, -0.02);
            g.add(slide);
            break;
        }
        case 'revolver': {
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.1), makeMat(c0));
            g.add(body);
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.18, 8), makeMat(c1));
            barrel.rotation.x = Math.PI / 2;
            barrel.position.z = -0.13;
            g.add(barrel);
            const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.035, 8), makeMat(c2));
            cylinder.rotation.x = Math.PI / 2;
            cylinder.position.y = -0.01;
            g.add(cylinder);
            const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.06, 4), makeMat(c2));
            grip.position.y = -0.07;
            g.add(grip);
            break;
        }
        case 'shotgun': {
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.12), makeMat(c0));
            g.add(body);
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.22, 8), makeMat(c1));
            barrel.rotation.x = Math.PI / 2;
            barrel.position.z = -0.16;
            g.add(barrel);
            const foregrip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.04, 4), makeMat(c2));
            foregrip.position.set(0, -0.06, -0.2);
            g.add(foregrip);
            const stock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.08), makeMat(c2));
            stock.position.z = 0.09;
            g.add(stock);
            break;
        }
        case 'sniper': {
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.18), makeMat(c0));
            g.add(body);
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.3, 6), makeMat(c1));
            barrel.rotation.x = Math.PI / 2;
            barrel.position.z = -0.23;
            g.add(barrel);
            const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.06, 6), makeMat(c2));
            scope.rotation.x = Math.PI / 2;
            scope.position.set(0, 0.05, -0.05);
            g.add(scope);
            const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.06, 4), makeMat(c2));
            grip.position.y = -0.07;
            g.add(grip);
            const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.08), makeMat(c2));
            stock.position.z = 0.12;
            g.add(stock);
            break;
        }
        case 'assault':
        case 'lmg':
        case 'smg':
        case 'rifle':
        default: {
            const isBig = type.id === 'lmg';
            const isSmall = type.id === 'smg';
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.14), makeMat(c0));
            g.add(body);
            const barrelL = isBig ? 0.22 : isSmall ? 0.12 : 0.18;
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, barrelL, 6), makeMat(c1));
            barrel.rotation.x = Math.PI / 2;
            barrel.position.z = -0.12 - barrelL / 2;
            g.add(barrel);
            const mag = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.06, 4), makeMat(c2));
            mag.position.y = -0.06;
            g.add(mag);
            const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.05, 4), makeMat(c2));
            grip.position.y = -0.08;
            g.add(grip);
            if (isBig) {
                const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.1), makeMat(c2));
                stock.position.z = 0.1;
                g.add(stock);
                const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.025, 8), makeMat(c0));
                drum.position.set(0, -0.08, -0.05);
                g.add(drum);
            }
        }
    }
    g.scale.set(0.35, 0.35, 0.35);
    return g;
}

function buildAmmoVisual(ammo) {
    if (ammo.laser) return null;
    const mat = makeEmissiveMat(ammo.color);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(ammo.size, ammo.laser ? 0 : 6, ammo.laser ? 0 : 6), mat);
    return mesh;
}

export function generateWeapon(seed) {
    const rng = mulberry32(seed + 4444);
    const type = pick(WEAPON_TYPES, rng);
    const ammo = pick(AMMO_TYPES, rng);

    const fr = rnd(rng, type.fireRate[0], type.fireRate[1]);
    const stats = {
        fireRate: fr,
        fireInterval: 1 / fr,
        magSize: rndi(rng, type.magSize[0], type.magSize[1]),
        reloadTime: rnd(rng, type.reload[0], type.reload[1]),
        weight: rnd(rng, type.weight[0], type.weight[1]),
        spread: rnd(rng, type.acc[0], type.acc[1]),
        damage: rndi(rng, type.dmg[0], type.dmg[1]),
        projCount: type.projCount.length ? rndi(rng, type.projCount[0], type.projCount[1]) : 1,
    };

    const colors = genColors(rng);
    const mesh = buildWeaponMesh(type, colors, rng);
    const name = genWeaponName(seed);

    return { type, ammo, stats, colors, mesh, name };
}

export function fireProjectile(weapon, origin, direction, scene) {
    const { ammo, stats, type } = weapon;
    const projs = [];
    const count = stats.projCount;

    for (let i = 0; i < count; i++) {
        const s = stats.spread * 0.01;
        const spread = (rng() - 0.5) * 2 * s;
        const spread2 = (rng() - 0.5) * 2 * s;
        const dir = direction.clone();
        const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
        const up = new THREE.Vector3().crossVectors(right, dir).normalize();
        dir.add(right.multiplyScalar(spread)).add(up.multiplyScalar(spread2)).normalize();

        if (ammo.laser) {
            const color = ammo.color;
            const len = 2000;
            const startOff = 0.5;
            const start = origin.clone().add(dir.clone().multiplyScalar(startOff));
            const beam = new THREE.Mesh(
                new THREE.CylinderGeometry(0.15, 0.15, len - startOff, 6, 1),
                new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })
            );
            const mid = start.clone().add(dir.clone().multiplyScalar((len - startOff) / 2));
            beam.position.copy(mid);
            beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
            scene.add(beam);

            const glow = new THREE.Sprite(new THREE.SpriteMaterial({
                map: makeGlowTexture(color, 0.05, 0.25, 0.6),
                blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
            }));
            glow.scale.set(4, 4, 1);
            glow.position.copy(mid);
            scene.add(glow);

            projs.push({ mesh: beam, glow, lifetime: 0.08, origin: start, direction: dir, length: len - startOff, isLaser: true });
        } else {
            const size = ammo.size * (ammo.id === 'plasma' ? 1.5 : 1);
            const glow = new THREE.Sprite(new THREE.SpriteMaterial({
                map: makeGlowTexture(ammo.color, 0.05, 0.2, 0.55),
                blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
            }));
            glow.scale.set(size * 6, size * 6, 1);
            glow.position.copy(origin);
            scene.add(glow);
            const vel = dir.clone().multiplyScalar(ammo.speed);
            projs.push({ mesh: glow, vel, lifetime: 1.5, ammo });
        }
    }
    return projs;
}

export { mulberry32, rnd, setProjectileRng, WEAPON_TYPES, AMMO_TYPES };