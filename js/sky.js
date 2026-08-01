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
        colors: [0x8B7355, 0xA0522D, 0x6B5B4A, 0xCD853F, 0x9C8C73],
        prob: 0.35,
        radiusRange: [8, 45],
        hasRings: false,
    },
    {
        name: 'gas giant',
        colors: [0xD2B48C, 0xDEB887, 0xF5DEB3, 0xCD853F, 0xE8D5B7],
        prob: 0.4,
        radiusRange: [30, 200],
        hasRings: true,
        ringProb: 0.5,
    },
    {
        name: 'ice giant',
        colors: [0x6BB5C0, 0x8FBC8F, 0x87CEEB, 0x5F9EA0, 0xA8D8EA],
        prob: 0.25,
        radiusRange: [20, 90],
        hasRings: true,
        ringProb: 0.3,
    },
];

function makeGasGiantTexture(colors, rng) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 512;
    const ctx = c.getContext('2d');
    const base = new THREE.Color(colors[0]);
    const palette = colors.map(h => new THREE.Color(h));
    for (let y = 0; y < c.height; y++) {
        const v = y / c.height;
        const bandPhase = Math.sin(v * Math.PI * (6 + rng() * 8)) * 0.5 + 0.5;
        const bandIdx = Math.floor(v * (4 + rng() * 4)) % palette.length;
        const col = palette[bandIdx].clone();
        const bright = 0.7 + bandPhase * 0.3 + (rng() - 0.5) * 0.08;
        col.multiplyScalar(bright);
        ctx.fillStyle = `rgb(${col.r*255|0},${col.g*255|0},${col.b*255|0})`;
        ctx.fillRect(0, y, c.width, 1);
    }
    for (let pass = 0; pass < 2; pass++) {
        const xOff = rng() * 50;
        for (let y = 0; y < c.height; y += 1 + rng() * 2 | 0) {
            const x = xOff + Math.sin(y * 0.3) * 30;
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
    const bandCount = 2 + rng() * 2;
    const bandAmp = 0.03 + rng() * 0.03;
    const longAmp = 0.02 + rng() * 0.03;
    const smooth = (x) => x * x * (3 - 2 * x);
    for (let y = 0; y < c.height; y++) {
        const v = y / c.height;
        const bandF = v * bandCount;
        const i0 = Math.floor(bandF) % palette.length;
        const i1 = (i0 + 1) % palette.length;
        const f = smooth(bandF - Math.floor(bandF));
        const col = palette[i0].clone().lerp(palette[i1], f);
        const bright = 1 + Math.sin(v * Math.PI * (3 + rng() * 2)) * longAmp + Math.sin(v * Math.PI * bandCount) * bandAmp + (rng() - 0.5) * 0.02;
        col.multiplyScalar(bright);
        ctx.fillStyle = `rgb(${col.r*255|0},${col.g*255|0},${col.b*255|0})`;
        ctx.fillRect(0, y, c.width, 1);
    }
    for (let pass = 0; pass < 1; pass++) {
        for (let y = 0; y < c.height; y += 2 + rng() * 4 | 0) {
            const x = (rng() * 30) + Math.sin(y * 0.15) * 20;
            const w = 1 + rng() * 3;
            ctx.fillStyle = `rgba(255,255,255,${0.02 + rng() * 0.04})`;
            ctx.fillRect(x, y, w, 1);
        }
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

function makeRingBands(innerR, outerR, colorHex, opacity, rngFn) {
    const col = new THREE.Color(colorHex);
    const mat = new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
    });
    const n = 2 + Math.floor(rngFn() * 5);
    const group = new THREE.Group();
    let t = 0.3;
    for (let i = 0; i < n; i++) {
        const w = 0.04 + rngFn() * 0.14;
        const gap = 0.02 + rngFn() * 0.06;
        if (t + w > 1) break;
        const r0 = innerR + (outerR - innerR) * t;
        const r1 = innerR + (outerR - innerR) * (t + w);
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
        const hasRing = pType.hasRings && this.rng() < pType.ringProb;
        const physRadius = hasRing ? radius * 3.2 : radius;
        const distMin = this.planetRadius + physRadius + 40;
        const { pos } = this._pickFreeDirDist(distMin, distMin + Math.max(radius * 3, 200), physRadius);
        this._bodies.push({ pos, radius: physRadius });

        const color = this._pick(pType.colors);
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

        if (pType.name === 'gas giant') {
            const bandTex = makeGasGiantTexture(pType.colors, this.rng);
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
        } else if (pType.name === 'ice giant') {
            const bandTex = makeIceGiantTexture(pType.colors, this.rng);
            sphereMat.map = bandTex;
            sphereMat.color.setHex(0xffffff);
            sphere.geometry = new THREE.SphereGeometry(radius, 48, 48);
        }

        if (pType.name !== 'gas giant') {
            const atmoColor = pType.name === 'ice giant' ? 0x88ccff : 0xaaccff;
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
            const bands = makeRingBands(innerR, outerR, rStyle.color, rStyle.opacity, this.rng);
            bands.rotation.x = Math.PI * (0.25 + this.rng() * 0.15);
            bands.rotation.z = this.rng() * 0.3;
            group.add(bands);
        }

        this.objects.push(group);
        this._parentPlanet = { group, pos, radius };
        const ringInfo = hasRing ? ' with rings' : '';
        this._planetSummary = `${pType.name}${ringInfo}`;
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
