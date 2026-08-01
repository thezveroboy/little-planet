import * as THREE from 'three';

const SPECTRAL = [
    { cls: 'O', color: 0x8b9dff, temp: 35000, radius: 8, name: 'blue giant' },
    { cls: 'B', color: 0x9db4ff, temp: 18000, radius: 4, name: 'blue-white' },
    { cls: 'A', color: 0xc8d8ff, temp: 9000,  radius: 2, name: 'white' },
    { cls: 'F', color: 0xf0f0ff, temp: 6500,  radius: 1.5, name: 'yellow-white' },
    { cls: 'G', color: 0xfff4e8, temp: 5778,  radius: 1, name: 'yellow dwarf' },
    { cls: 'K', color: 0xffcca0, temp: 4300,  radius: 0.8, name: 'orange' },
    { cls: 'M', color: 0xff8855, temp: 3200,  radius: 0.5, name: 'red dwarf' },
    { cls: 'L', color: 0xff7744, temp: 1800,  radius: 0.3, name: 'brown dwarf' },
    { cls: 'T', color: 0xdd6633, temp: 1000,  radius: 0.22, name: 'methane dwarf' },
    { cls: 'Y', color: 0xbb5522, temp: 500,   radius: 0.18, name: 'substellar' },
];

const SPECIAL_STARS = [
    { cls: 'QSR', color: 0xeeeeff, name: 'quasar', brightnessMul: 3, glowMul: 3 },
    { cls: 'PSR', color: 0xaaccff, name: 'pulsar', brightnessMul: 1.5, glowMul: 2 },
    { cls: 'MGN', color: 0xbb88ff, name: 'magnetar', brightnessMul: 2, glowMul: 1.8 },
];

const PLANET_TYPES = [
    {
        name: 'rocky planet',
        prob: 0.35,
        radiusRange: [8, 45],
        hasRings: false,
    },
    {
        name: 'gas giant',
        prob: 0.4,
        radiusRange: [30, 200],
        hasRings: true,
        ringProb: 0.5,
    },
    {
        name: 'ice giant',
        prob: 0.25,
        radiusRange: [20, 90],
        hasRings: true,
        ringProb: 0.3,
    },
];

const GAS_PALETTES = [
    [0xE8D5B7, 0xDEB887, 0xF5DEB3, 0xCD853F, 0xC9A227],
    [0x5FBFAB, 0x8FD4C4, 0x3E8E7E, 0xB5E3D8, 0x2E6E62],
    [0xE8B4B8, 0xF2CDD0, 0xD48A92, 0xC96F79, 0xF0E0E2],
    [0xC8C078, 0xDFD89A, 0xA8A058, 0x8C8748, 0xEDE8C0],
    [0x9FB4C7, 0x7E97AD, 0xC2D2DF, 0x5E788F, 0xDCE6EE],
    [0xF0C8A0, 0xF5D8B8, 0xE0A878, 0xD18E58, 0xF8E4CC],
    [0xB8A8D8, 0x9C88C4, 0xD2C8EA, 0x8068AC, 0xE8E0F5],
];

const ICE_PALETTES = [
    [0x9FD8E8, 0x7FC4D8, 0xBFE8F2, 0x66AFC4, 0xD6F0F5],
    [0xA8E0C8, 0x8CD0B4, 0xC4F0DC, 0x6ABFA0, 0xE0F8EA],
    [0x9FB8E8, 0x8498D8, 0xBBD0F2, 0x6E84C8, 0xE0E8FA],
    [0x8FE0E0, 0x6FC8D0, 0xB0ECEC, 0x54AEB8, 0xE0F6F6],
];

const ROCK_PALETTES = [
    [0x8B7355, 0xA0522D, 0x6B5B4A, 0xCD853F, 0x9C8C73],
    [0x8A8A8A, 0x6E6E6E, 0xA8A8A8, 0x5A5A5A, 0xBEBEBE],
    [0xA8574E, 0x8F3B33, 0xC47A70, 0x7A2E28, 0xD9A094],
    [0xC2A878, 0xB08D5A, 0xD8C090, 0x9C7B48, 0xE8D5A8],
    [0x7A7F8F, 0x606575, 0x9498A8, 0x50555F, 0xB0B4C0],
    [0x6E7F6A, 0x55664F, 0x879A80, 0x44523F, 0xA0B096],
];

const ATMO_COLORS = [0x88bbff, 0x88ffaa, 0xffcc88, 0xff9966, 0xcc8899, 0x99ccff, 0x99ffdd];

const ICE_ATMO_COLORS = [0x88ccff, 0x99ddff, 0x66aaff, 0xaaddff];

function makeGasGiantTexture(colors, rng) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 512;
    const ctx = c.getContext('2d');
    const palette = colors.map(h => new THREE.Color(h));
    const bandCount = 7 + rng() * 9;
    for (let y = 0; y < c.height; y++) {
        const v = y / c.height;
        const bandPhase = Math.sin(v * Math.PI * bandCount) * 0.5 + 0.5;
        const bandIdx = Math.floor(v * (4 + rng() * 4)) % palette.length;
        const col = palette[bandIdx].clone();
        const bright = 0.5 + bandPhase * 0.5 + (rng() - 0.5) * 0.14;
        col.multiplyScalar(bright);
        ctx.fillStyle = `rgb(${col.r*255|0},${col.g*255|0},${col.b*255|0})`;
        ctx.fillRect(0, y, c.width, 1);
    }
    for (let pass = 0; pass < 2; pass++) {
        const xOff = rng() * 50;
        for (let y = 0; y < c.height; y += 1 + rng() * 2 | 0) {
            const x = xOff + Math.sin(y * 0.3 + rng() * 2) * 30;
            const w = 2 + rng() * 6;
            const alpha = 0.05 + rng() * 0.1;
            ctx.fillStyle = `rgba(255,255,255,${alpha})`;
            ctx.fillRect(x, y, w, 1);
        }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.x = 1;
    return tex;
}

function makeIceGiantTexture(colors, rng) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 256;
    const ctx = c.getContext('2d');
    const palette = colors.map(h => new THREE.Color(h));
    const bandCount = 3 + rng() * 3;
    const bandAmp = 0.09 + rng() * 0.11;
    const longAmp = 0.04 + rng() * 0.06;
    const smooth = (x) => x * x * (3 - 2 * x);
    const edge = (x) => Math.pow(x, 0.7);
    for (let y = 0; y < c.height; y++) {
        const v = y / c.height;
        const bandF = v * bandCount;
        const i0 = Math.floor(bandF) % palette.length;
        const i1 = (i0 + 1) % palette.length;
        const f = edge(smooth(bandF - Math.floor(bandF)));
        const col = palette[i0].clone().lerp(palette[i1], f);
        const bright = 1 + Math.sin(v * Math.PI * (3 + rng() * 2)) * longAmp + Math.sin(v * Math.PI * bandCount) * bandAmp + (rng() - 0.5) * 0.03;
        col.multiplyScalar(bright);
        ctx.fillStyle = `rgb(${col.r*255|0},${col.g*255|0},${col.b*255|0})`;
        ctx.fillRect(0, y, c.width, 1);
    }
    for (let pass = 0; pass < 1; pass++) {
        for (let y = 0; y < c.height; y += 2 + rng() * 4 | 0) {
            const x = (rng() * 30) + Math.sin(y * 0.15) * 20;
            const w = 1 + rng() * 3;
            ctx.fillStyle = `rgba(255,255,255,${0.03 + rng() * 0.06})`;
            ctx.fillRect(x, y, w, 1);
        }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
}

function makeRockyTexture(colors, rng, hasWater) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const ctx = c.getContext('2d');
    const land = colors.map(h => new THREE.Color(h));
    const baseLand = land[Math.floor(rng() * land.length)];
    ctx.fillStyle = baseLand.getStyle();
    ctx.fillRect(0, 0, 256, 128);
    if (hasWater) {
        const ocean = new THREE.Color(0x173a5e).lerp(new THREE.Color(0x2e6f9e), rng());
        ctx.fillStyle = ocean.getStyle();
        ctx.fillRect(0, 0, 256, 128);
    }
    const continents = 10 + Math.floor(rng() * 12);
    for (let i = 0; i < continents; i++) {
        const cx = rng() * 256, cy = 14 + rng() * 100;
        const r = 16 + rng() * 42;
        const base = land[Math.floor(rng() * land.length)].clone().multiplyScalar(0.85 + rng() * 0.3);
        for (let layer = 0; layer < 3; layer++) {
            const lr = r * (0.55 + rng() * 0.35);
            const col = base.clone().multiplyScalar(0.8 + rng() * 0.5);
            ctx.fillStyle = col.getStyle();
            const blobs = 6 + Math.floor(rng() * 7);
            ctx.beginPath();
            for (let b = 0; b <= blobs; b++) {
                const a = (b / blobs) * Math.PI * 2;
                const rr = lr * (0.55 + rng() * 0.6);
                const px = cx + Math.cos(a) * rr;
                const py = cy + Math.sin(a) * rr * (0.45 + rng() * 0.2);
                if (b === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
        }
    }
    if (rng() < 0.45) {
        const iceCol = new THREE.Color(0xffffff).multiplyScalar(0.85 + rng() * 0.15);
        ctx.fillStyle = `rgba(${iceCol.r*255|0},${iceCol.g*255|0},${iceCol.b*255|0},${0.6 + rng() * 0.3})`;
        const capH = 5 + rng() * 9;
        ctx.fillRect(0, 0, 256, capH);
        ctx.fillRect(0, 128 - capH, 256, capH);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
}

function makeCloudTexture(rng) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 256, 128);
    const n = 40 + Math.floor(rng() * 50);
    for (let i = 0; i < n; i++) {
        const cx = rng() * 256, cy = 8 + rng() * 112;
        const r = 6 + rng() * 18;
        const a = 0.12 + rng() * 0.35;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, `rgba(255,255,255,${a})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
    }
    for (let i = 0; i < 8 + rng() * 8 | 0; i++) {
        const y = rng() * 128;
        const x0 = rng() * 256;
        const len = 30 + rng() * 90;
        const a = 0.08 + rng() * 0.15;
        const g = ctx.createLinearGradient(x0, y, x0 + len, y);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.5, `rgba(255,255,255,${a})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x0, y - 3, len, 6);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
}

const RING_STYLES = [
    { inner: 1.4, outer: 2.8, color: 0xE8D5B7, opacity: 0.7 },
    { inner: 1.3, outer: 2.5, color: 0x8B7355, opacity: 0.5 },
    { inner: 1.5, outer: 3.0, color: 0xB0C4DE, opacity: 0.6 },
    { inner: 1.6, outer: 2.4, color: 0xCD853F, opacity: 0.4 },
    { inner: 1.2, outer: 2.6, color: 0x6BB5C0, opacity: 0.5 },
];

function mulberry32(a) {
    return function() {
        let t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

export function makeGlowTexture(colorHex, r1, r2, r3) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    const col = new THREE.Color(colorHex);
    const center = 128;
    const g = ctx.createRadialGradient(center, center, 0, center, center, 128);
    g.addColorStop(0, `rgba(${col.r*255|0},${col.g*255|0},${col.b*255|0},1)`);
    g.addColorStop(r1, `rgba(${col.r*255|0},${col.g*255|0},${col.b*255|0},0.8)`);
    g.addColorStop(r2, `rgba(${col.r*255|0},${col.g*255|0},${col.b*255|0},0.3)`);
    g.addColorStop(r3, `rgba(${col.r*255|0},${col.g*255|0},${col.b*255|0},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
}

function makeRingBands(innerR, outerR, colors, opacity, rngFn) {
    const n = 2 + Math.floor(rngFn() * 5);
    const group = new THREE.Group();
    let t = 0.3;
    for (let i = 0; i < n; i++) {
        const w = 0.04 + rngFn() * 0.14;
        const gap = 0.02 + rngFn() * 0.06;
        if (t + w > 1) break;
        const r0 = innerR + (outerR - innerR) * t;
        const r1 = innerR + (outerR - innerR) * (t + w);
        const col = new THREE.Color(colors[Math.floor(rngFn() * colors.length)]);
        col.multiplyScalar(0.7 + rngFn() * 0.5);
        const mat = new THREE.MeshBasicMaterial({
            color: col,
            transparent: true,
            opacity: opacity * (0.7 + rngFn() * 0.35),
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        const geo = new THREE.RingGeometry(r0, r1, 64);
        group.add(new THREE.Mesh(geo, mat));
        t += w + gap;
    }
    return group;
}

export class SkySystem {
    constructor(seed, planetRadius = 100) {
        this.rng = mulberry32(seed + 3333);
        this.planetRadius = planetRadius;
        this.objects = [];
        this.lights = [];
        this.pulsars = [];
        this.clouds = [];
        this.summary = '';
        this._bodies = [{ pos: new THREE.Vector3(0, 0, 0), radius: planetRadius }];
        this._generate();
    }

    _pickFreeDirDist(distMin, distMax, radius) {
        const clearance = 20;
        let best = null, bestMin = -1;
        for (let attempt = 0; attempt < 40; attempt++) {
            const dist = distMin + this.rng() * (distMax - distMin);
            const dir = new THREE.Vector3(this.rng() - 0.5, this.rng() - 0.5, this.rng() - 0.5).normalize();
            const pos = dir.clone().multiplyScalar(dist);
            let minD = Infinity, ok = true;
            for (const b of this._bodies) {
                const d = pos.distanceTo(b.pos);
                if (d < radius + b.radius + clearance) { ok = false; break; }
                if (d < minD) minD = d;
            }
            if (ok) return { pos };
            if (minD > bestMin) { bestMin = minD; best = { pos }; }
        }
        return best || { pos: new THREE.Vector3(0, 0, 1).multiplyScalar(distMin) };
    }

    _pick(arr) {
        return arr[Math.floor(this.rng() * arr.length)];
    }

    _generate() {
        const r = this.rng();
        const hasParentPlanet = this.rng() < 0.45;

        if (r < 0.1) {
            this._genStarWithBH();
        } else if (r < 0.2) {
            this._genBinary();
        } else {
            this._genStar(1);
        }

        let parts = [this._starSummary];
        if (hasParentPlanet) {
            this._genParentPlanet();
            parts.push(`orbiting ${this._planetSummary}`);
        }
        this.summary = parts.join(', ');

        this.objectCount = this.objects.length;
    }

    getSummary() {
        return this.summary;
    }

    getStarData() {
        return this._starData || { type: SPECTRAL[4], pos: new THREE.Vector3(0, 0, 500), radius: 1, isClose: false };
    }

    _genStarWithBH() {
        this._genStar(1);
        this._genBlackHole();
        this._starSummary += ' + black hole';
        this._starData = this._starData || {};
    }

    _genStar(distFactor) {
        const isSpecial = this.rng() < 0.15;
        const type = isSpecial ? this._pick(SPECIAL_STARS) : this._pick(SPECTRAL);
        const isClose = !isSpecial && this.rng() < 0.50 && distFactor === 1;
        const sphereRadius = isClose ? 8 + this.rng() * 190 : 0;
        const physRadius = isClose ? sphereRadius : 1;
        const distBase = isClose ? 80 : (120 + this.rng() * 400) * distFactor;
        const distMin = distBase;
        const distMax = distBase + (isClose ? 220 : 120);
        const { pos } = this._pickFreeDirDist(distMin, distMax, physRadius);
        this._bodies.push({ pos, radius: physRadius });

        const group = new THREE.Group();
        const bMul = type.brightnessMul || 1;
        const gMul = type.glowMul || 1;
        const brightness = isSpecial ? 1 : (10 - SPECTRAL.indexOf(type)) / 9;

        if (isClose) {
            const sphere = new THREE.Mesh(
                new THREE.SphereGeometry(sphereRadius, 24, 24),
                new THREE.MeshBasicMaterial({ color: type.color })
            );
            group.add(sphere);
            const glow = new THREE.Sprite(
                new THREE.SpriteMaterial({
                    map: makeGlowTexture(type.color, 0.05, 0.3, 0.6),
                    blending: THREE.AdditiveBlending,
                    transparent: true, depthWrite: false,
                })
            );
            let gSize = Math.max((80 + brightness * 120) * gMul, sphereRadius * 3);
            const idx = SPECTRAL.indexOf(type);
            if (idx >= 7) {
                gSize *= 1.4;
                glow.material.opacity = 0.7;
            }
            glow.scale.set(gSize, gSize, 1);
            group.add(glow);
        } else {
            const glowSize = (50 + brightness * 110) * gMul;
            const glow = new THREE.Sprite(
                new THREE.SpriteMaterial({
                    map: makeGlowTexture(type.color, 0.05, 0.25, 0.5),
                    blending: THREE.AdditiveBlending,
                    transparent: true, depthWrite: false,
                })
            );
            glow.scale.set(glowSize, glowSize, 1);
            group.add(glow);
            if (type.cls === 'PSR') {
                this.pulsars.push({
                    glow,
                    baseScale: glow.scale.x,
                    freq: 0.1 + this.rng() * 0.3,
                    phase: this.rng() * Math.PI * 2,
                    pos: pos.clone(),
                });
            }
        }

        group.position.copy(pos);
        this.objects.push(group);
        this.lights.push({
            color: type.color,
            intensity: (0.3 + brightness * 0.15) * bMul,
            position: pos.clone(),
        });

        this._starData = { type, pos, radius: sphereRadius || 1, isClose };
        if (!this._starDist || pos.length() < this._starDist) {
            this._starDist = pos.length();
            this._starR = sphereRadius || 1;
        }
        const prefix = isClose ? 'close ' : '';
        this._starSummary = `${prefix}${type.cls} ${type.name}`;
    }

    _genBinary() {
        const pickStar = () => this.rng() < 0.15 ? this._pick(SPECIAL_STARS) : this._pick(SPECTRAL);
        const t1 = pickStar();
        let t2, idx1 = SPECTRAL.indexOf(t1), idx2;
        do {
            t2 = pickStar();
            idx2 = SPECTRAL.indexOf(t2);
        } while (idx1 >= 0 && idx2 >= 0 && Math.abs(idx2 - idx1) > 3);

        const d = 30 + this.rng() * 80;
        const physRadius = d * 0.4 + 40;
        const { pos: center } = this._pickFreeDirDist(100, 450, physRadius);
        this._bodies.push({ pos: center, radius: physRadius });

        const sizeFor = (t) => {
            const idx = SPECTRAL.indexOf(t);
            return idx >= 0 ? 40 + (10 - idx) * 12 : 90;
        };
        const gm = (t) => t.glowMul || 1;

        const s1 = new THREE.Sprite(
            new THREE.SpriteMaterial({
                map: makeGlowTexture(t1.color, 0.05, 0.25, 0.5),
                blending: THREE.AdditiveBlending,
                transparent: true, depthWrite: false,
            })
        );
        s1.position.copy(center.clone().add(new THREE.Vector3(d * 0.4, 0, 0)));
        s1.scale.set(sizeFor(t1) * gm(t1), sizeFor(t1) * gm(t1), 1);

        const s2 = new THREE.Sprite(
            new THREE.SpriteMaterial({
                map: makeGlowTexture(t2.color, 0.05, 0.25, 0.5),
                blending: THREE.AdditiveBlending,
                transparent: true, depthWrite: false,
            })
        );
        s2.position.copy(center.clone().add(new THREE.Vector3(-d * 0.4, 0, 0)));
        s2.scale.set(sizeFor(t2) * gm(t2), sizeFor(t2) * gm(t2), 1);

        if (t1.cls === 'PSR') this.pulsars.push({ glow: s1, baseScale: s1.scale.x, freq: 0.1 + this.rng() * 0.3, phase: this.rng() * Math.PI * 2, pos: s1.position.clone() });
        if (t2.cls === 'PSR') this.pulsars.push({ glow: s2, baseScale: s2.scale.x, freq: 0.1 + this.rng() * 0.3, phase: this.rng() * Math.PI * 2, pos: s2.position.clone() });

        const g1 = new THREE.Group();
        g1.add(s1);
        g1.position.copy(s1.position);
        const g2 = new THREE.Group();
        g2.add(s2);
        g2.position.copy(s2.position);

        this.objects.push(g1);
        this.objects.push(g2);

        const avgColor = new THREE.Color(t1.color).lerp(new THREE.Color(t2.color), 0.5);
        this.lights.push({
            color: avgColor.getHex(),
            intensity: 1.0,
            position: center.clone(),
        });

        this._starDist = center.length();
        this._starR = physRadius;

        this._starSummary = `Binary: ${t1.cls} ${t1.name} + ${t2.cls} ${t2.name}`;
    }

    _genBlackHole() {
        const bhRadius = 6 + this.rng() * 18;
        const { pos } = this._pickFreeDirDist(80, 430, bhRadius);
        this._bodies.push({ pos, radius: bhRadius });

        const group = new THREE.Group();
        group.position.copy(pos);

        const bhSphere = new THREE.Mesh(
            new THREE.SphereGeometry(bhRadius, 20, 20),
            new THREE.MeshBasicMaterial({ color: 0x000000 })
        );
        group.add(bhSphere);

        const glowSize = 40 + this.rng() * 80;
        const glow = new THREE.Sprite(
            new THREE.SpriteMaterial({
                map: makeGlowTexture(0xff8844, 0.05, 0.25, 0.6),
                blending: THREE.AdditiveBlending,
                transparent: true, depthWrite: false,
            })
        );
        glow.scale.set(glowSize, glowSize, 1);
        group.add(glow);

        this.objects.push(group);
        this.lights.push({
            color: 0xff8844,
            intensity: 0.3,
            position: pos.clone(),
        });
    }

    _genParentPlanet() {
        const pType = this._pickWeighted(PLANET_TYPES);
        const radius = pType.radiusRange[0] + this.rng() * (pType.radiusRange[1] - pType.radiusRange[0]);
        let palette;
        if (pType.name === 'gas giant') palette = this._pick(GAS_PALETTES);
        else if (pType.name === 'ice giant') palette = this._pick(ICE_PALETTES);
        else palette = this._pick(ROCK_PALETTES);
        const hasRing = pType.hasRings && this.rng() < pType.ringProb;
        const physRadius = hasRing ? radius * 3.2 : radius;
        const distMin = this.planetRadius + physRadius + 40;
        let distMax = distMin + Math.max(radius * 3, 200);
        if (this._starDist) {
            const maxForStar = this._starDist - physRadius - this._starR - 20;
            if (maxForStar > distMin + 10) distMax = Math.min(distMax, maxForStar);
        }
        const { pos } = this._pickFreeDirDist(distMin, distMax, physRadius);
        this._bodies.push({ pos, radius: physRadius });

        const color = this._pick(palette);
        const group = new THREE.Group();
        group.position.copy(pos);

        const emissiveIntensity = pType.name === 'gas giant' ? 0.08 : 0.04;
        const sphereMat = new THREE.MeshStandardMaterial({
            color: color,
            roughness: pType.name === 'ice giant' ? 0.2 : 0.7,
            metalness: pType.name === 'ice giant' ? 0.05 : 0.1,
            emissive: color,
            emissiveIntensity: emissiveIntensity,
        });
        const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(radius, 32, 32),
            sphereMat
        );
        group.add(sphere);

        let summaryParts = [];
        if (pType.name === 'gas giant') {
            const bandTex = makeGasGiantTexture(palette, this.rng);
            sphereMat.map = bandTex;
            sphereMat.color.setHex(0xffffff);
            sphere.geometry = new THREE.SphereGeometry(radius, 48, 48);

            const bandMat = new THREE.MeshStandardMaterial({
                map: bandTex,
                color: 0xffffff,
                roughness: 0.6,
                metalness: 0.05,
                emissive: color,
                emissiveIntensity: 0.08,
            });
            const band = new THREE.Mesh(
                new THREE.SphereGeometry(radius * 1.001, 48, 48),
                bandMat
            );
            band.scale.y = 0.97 + this.rng() * 0.03;
            group.add(band);
            summaryParts.push('gas giant');
        } else if (pType.name === 'ice giant') {
            const bandTex = makeIceGiantTexture(palette, this.rng);
            sphereMat.map = bandTex;
            sphereMat.color.setHex(0xffffff);
            sphere.geometry = new THREE.SphereGeometry(radius, 48, 48);
            summaryParts.push('ice giant');
        } else {
            const hasWater = this.rng() < 0.55;
            const hasAtmo = this.rng() < 0.75;
            const atmoColor = hasAtmo ? this._pick(ATMO_COLORS) : null;
            const rockTex = makeRockyTexture(palette, this.rng, hasWater);
            sphereMat.map = rockTex;
            sphereMat.color.setHex(0xffffff);
            sphere.geometry = new THREE.SphereGeometry(radius, 48, 48);
            summaryParts.push('rocky planet');
            if (hasWater) summaryParts.push('with oceans');
            if (hasAtmo) {
                summaryParts.push('with atmosphere');
                const atmoMat = new THREE.MeshStandardMaterial({
                    color: atmoColor,
                    transparent: true,
                    opacity: 0.08 + this.rng() * 0.09,
                    roughness: 0.1,
                    metalness: 0,
                    side: THREE.BackSide,
                });
                const atmo = new THREE.Mesh(
                    new THREE.SphereGeometry(radius * 1.045, 32, 32),
                    atmoMat
                );
                group.add(atmo);
                if (this.rng() < 0.6) {
                    const cloudMat = new THREE.MeshStandardMaterial({
                        map: makeCloudTexture(this.rng),
                        transparent: true,
                        opacity: 0.35 + this.rng() * 0.25,
                        depthWrite: false,
                        roughness: 1,
                    });
                    const clouds = new THREE.Mesh(
                        new THREE.SphereGeometry(radius * 1.07, 32, 32),
                        cloudMat
                    );
                    clouds.position.copy(pos);
                    this.objects.push(clouds);
                    this.clouds.push({ mesh: clouds, speed: 0.01 + this.rng() * 0.025 });
                    summaryParts.push('with clouds');
                }
            }
        }

        if (pType.name === 'ice giant') {
            const atmoColor = this._pick(ICE_ATMO_COLORS);
            const atmoMat = new THREE.MeshStandardMaterial({
                color: atmoColor,
                transparent: true,
                opacity: 0.12,
                roughness: 0.1,
                metalness: 0,
                side: THREE.BackSide,
            });
            const atmo = new THREE.Mesh(
                new THREE.SphereGeometry(radius * 1.04, 32, 32),
                atmoMat
            );
            group.add(atmo);
        }

        const glowMat = new THREE.SpriteMaterial({
            map: makeGlowTexture(color, 0.1, 0.35, 0.65),
            blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
            opacity: 0.35,
        });
        const glow = new THREE.Sprite(glowMat);
        glow.scale.set(radius * 2.8, radius * 2.8, 1);
        group.add(glow);

        if (hasRing) {
            const rStyle = this._pick(RING_STYLES);
            const innerR = radius * rStyle.inner;
            const outerR = radius * rStyle.outer;
            const bands = makeRingBands(innerR, outerR, palette, rStyle.opacity, this.rng);
            bands.rotation.x = Math.PI * (0.25 + this.rng() * 0.15);
            bands.rotation.z = this.rng() * 0.3;
            group.add(bands);
        }

        this.objects.push(group);
        this._parentPlanet = { group, pos, radius };
        const ringInfo = hasRing ? ' with rings' : '';
        this._planetSummary = `${summaryParts.join(' ')}${ringInfo}`;
    }

    _pickWeighted(arr) {
        const total = arr.reduce((s, t) => s + t.prob, 0);
        let r = this.rng() * total;
        for (const t of arr) {
            r -= t.prob;
            if (r <= 0) return t;
        }
        return arr[arr.length - 1];
    }

    addToScene(scene) {
        for (const obj of this.objects) scene.add(obj);
    }

    addLights(scene) {
        for (const l of this.lights) {
            const light = new THREE.DirectionalLight(l.color, l.intensity);
            light.position.copy(l.position);
            scene.add(light);
            for (const p of this.pulsars) {
                if (p.pos.distanceTo(l.position) < 1) {
                    p.light = light;
                    p.baseIntensity = l.intensity;
                }
            }
        }
    }
}
