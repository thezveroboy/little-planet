import * as THREE from 'three';
import { Noise } from './noise.js?v=47';

function mulberry32(a) {
    return function() {
        let t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

export class Planet {
    constructor(seed, baseRadius = 100, detail = 28) {
        this.seed = seed;
        this.baseRadius = baseRadius;
        this.noise = new Noise(seed);
        this.craters = this._generateCraters();
        this.mesh = this._createMesh(detail);
        this.terrainMesh = this.mesh;
    }

    _generateCraters() {
        const rng = mulberry32(this.seed + 777);
        const count = 8 + Math.floor(rng() * 20);
        const craters = [];
        for (let i = 0; i < count; i++) {
            const theta = rng() * Math.PI * 2;
            const phi = Math.acos(2 * rng() - 1);
            const r = rng() < 0.15 ? 0.2 + rng() * 0.2 : 0.02 + rng() * 0.16;
            craters.push({
                cx: Math.sin(phi) * Math.cos(theta),
                cy: Math.cos(phi),
                cz: Math.sin(phi) * Math.sin(theta),
                radius: r,
                radius2: r * 2,
                depth: (1 + rng() * 12) * (r < 0.2 ? 3 : 8),
                rimHeight: (0.3 + rng() * 3) * (r < 0.2 ? 1 : 2)
            });
        }
        return craters;
    }

    _craterProfile(t, depth, rimHeight) {
        return -depth * Math.exp(-t * t * 5) + rimHeight * Math.exp(-((t - 0.55) ** 2) * 18);
    }

    getHeight(dir) {
        const { x, y, z } = dir;
        let h = this.baseRadius;
        h += this.noise.fbm(x * 0.8, y * 0.8, z * 0.8, 6) * 22;
        h += this.noise.noise3D(x * 2.5, y * 2.5, z * 2.5) * 3;
        for (const c of this.craters) {
            const dot = x * c.cx + y * c.cy + z * c.cz;
            if (dot < Math.cos(c.radius2)) continue;
            const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
            if (angle > c.radius2) continue;
            h += this._craterProfile(angle / c.radius2, c.depth, c.rimHeight);
        }
        return Math.max(h, this.baseRadius * 0.3);
    }

    _createMesh(detail) {
        const geo = new THREE.IcosahedronGeometry(1, detail);
        const pos = geo.attributes.position;
        const dir = new THREE.Vector3();

        let minH = Infinity, maxH = -Infinity;
        const heights = new Float32Array(pos.count);

        for (let i = 0; i < pos.count; i++) {
            dir.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
            const h = this.getHeight(dir);
            heights[i] = h;
            if (h < minH) minH = h;
            if (h > maxH) maxH = h;
            pos.setXYZ(i, dir.x * h, dir.y * h, dir.z * h);
        }

        const range = maxH - minH || 1;
        const colors = new Float32Array(pos.count * 3);

        for (let i = 0; i < pos.count; i++) {
            const t = (heights[i] - minH) / range;
            const r = 0.35 + 0.55 * t;
            const g = 0.25 + 0.45 * t;
            const b = 0.15 + 0.30 * t;
            colors[i * 3] = r;
            colors[i * 3 + 1] = g;
            colors[i * 3 + 2] = b;
        }

        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geo.computeVertexNormals();

        const mat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.8,
            metalness: 0.1,
        });

        return new THREE.Mesh(geo, mat);
    }
}
