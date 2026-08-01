import * as THREE from 'three';
import { Planet } from './planet.js?v=45';
import { Player } from './player.js?v=45';
import { SkySystem, makeGlowTexture } from './sky.js?v=45';
import { playPickup, playInvestigate, playPlantHit, playEnemyHit, playEnemyDeath, updateListener } from './sound.js?v=45';
import { generateCrashedShip } from './ship.js?v=45';
import { generatePlanetName } from './namegen.js?v=45';
import { generateVegetation, breakPlant } from './vegetation.js?v=45';
import { generateWeapon, setProjectileRng } from './weapons.js?v=45';
import { Enemy } from './enemy.js?v=45';

window.addEventListener('error', (e) => {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:red;color:#fff;padding:10px;z-index:9999;font:bold 14px monospace';
    el.textContent = `ERROR: ${e.message}`;
    document.body.appendChild(el);
});

try {
    const SEED = Math.floor(Math.random() * 2147483647);
    const PLANET_NAME = generatePlanetName(SEED);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050510);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
    scene.add(camera);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    document.body.appendChild(renderer.domElement);

    const planet = new Planet(SEED, 100, 28);
    scene.add(planet.mesh);

    {
        const rng = (function(seed) {
            let a = seed;
            return function() {
                let t = a += 0x6D2B79F5;
                t = Math.imul(t ^ t >>> 15, t | 1);
                t ^= t + Math.imul(t ^ t >>> 7, t | 61);
                return ((t ^ t >>> 14) >>> 0) / 4294967296;
            };
        })(SEED + 7777);

        const SPECTRAL_COLORS = [
            0x8b9dff, 0x9db4ff, 0xc8d8ff, 0xf0f0ff,
            0xfff4e8, 0xffcca0, 0xff8855, 0xcc3355,
        ];
        const NEB_COLORS = [0xff4488, 0x8844ff, 0x4488ff, 0xff8844, 0x44ff88, 0xff6644];

        function makeNebula() {
            const theta = rng() * Math.PI * 2;
            const r = 900 + rng() * 1300;
            const neb = new THREE.Sprite(
                new THREE.SpriteMaterial({
                    map: makeGlowTexture(NEB_COLORS[rng() * NEB_COLORS.length | 0], 0.05, 0.3, 0.7),
                    blending: THREE.AdditiveBlending,
                    transparent: true,
                    depthWrite: false,
                    opacity: 0.12 + rng() * 0.25,
                })
            );
            neb.scale.set(150 + rng() * 500, 150 + rng() * 500, 1);
            neb.position.set(r * Math.cos(theta), (rng() - 0.5) * 200, r * Math.sin(theta));
            return neb;
        }

        function makeStarSprite() {
            const c = document.createElement('canvas');
            c.width = c.height = 64;
            const g = c.getContext('2d');
            const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
            grd.addColorStop(0, 'rgba(255,255,255,1)');
            grd.addColorStop(0.25, 'rgba(255,255,255,0.95)');
            grd.addColorStop(0.55, 'rgba(255,255,255,0.45)');
            grd.addColorStop(0.8, 'rgba(255,255,255,0.12)');
            grd.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = grd;
            g.fillRect(0, 0, 64, 64);
            return new THREE.CanvasTexture(c);
        }

        const skyType = rng();
        let starCount, uniformCount, galaxyCount;
        if (skyType < 0.40) {
            uniformCount = 3000; galaxyCount = 8000 + (rng() * 3000 | 0); starCount = uniformCount + galaxyCount;
        } else if (skyType < 0.70) {
            uniformCount = 2000; galaxyCount = 8000 + (rng() * 3000 | 0); starCount = uniformCount + galaxyCount;
        } else {
            uniformCount = 10000; galaxyCount = 0; starCount = uniformCount;
        }
        const shellR = 1000;
        const shellJitter = 80;
        function placeOnShell(p) {
            const len = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]) || 1;
            const r = shellR + (rng() - 0.5) * shellJitter * 2;
            return [p[0] / len * r, p[1] / len * r, p[2] / len * r];
        }

        const genGalaxyStar = skyType < 0.40 ? function() {
            let r, theta, accept;
            do {
                r = 600 + rng() * 2000;
                theta = rng() * Math.PI * 2;
                const arm = (theta - 2.5 * Math.log(r / 600 + 0.5)) * 3;
                const density = 0.15 + 0.85 * Math.pow(Math.cos(arm) * 0.5 + 0.5, 3);
                accept = rng() < density;
            } while (!accept);
            const y = (rng() - 0.5) * 400 * (1 - (r - 600) / 2000 * 0.7);
            return placeOnShell([r * Math.cos(theta), y, r * Math.sin(theta)]);
        } : (skyType < 0.70 ? function() {
            const flatten = 0.08 + rng() * 0.25;
            const r = 500 + rng() * 2000;
            const theta = rng() * Math.PI * 2;
            const phi = Math.acos(2 * rng() - 1);
            const y = r * Math.cos(phi) * flatten;
            const xy = r * Math.sin(phi);
            return placeOnShell([xy * Math.cos(theta), y, xy * Math.sin(theta)]);
        } : null);

        const genUniformStar = function() {
            const theta = rng() * Math.PI * 2;
            const phi = Math.acos(2 * rng() - 1);
            return placeOnShell([
                Math.sin(phi) * Math.cos(theta),
                Math.cos(phi),
                Math.sin(phi) * Math.sin(theta),
            ]);
        };

        const spriteTex = makeStarSprite();

        const BUCKETS = [
            { min: 0.3, max: 1.4, size: 0.85 },
            { min: 1.4, max: 2.6, size: 2.0 },
            { min: 2.6, max: 4.4, size: 3.5 },
            { min: 4.4, max: 6.6, size: 5.5 },
            { min: 6.6, max: 9.4, size: 8.0 },
            { min: 9.4, max: 12.5, size: 11.0 },
            { min: 12.5, max: 17, size: 14.5 },
        ];
        const buckets = BUCKETS.map(() => ({ positions: [], colors: [] }));

        for (let i = 0; i < starCount; i++) {
            const p = i < uniformCount ? genUniformStar() : genGalaxyStar();

            const spec = SPECTRAL_COLORS[rng() * SPECTRAL_COLORS.length | 0];
            const col = new THREE.Color(spec);
            let size, lum;
            if (rng() < 0.88) {
                size = 0.3 + rng() * 1.2;
                lum = (0.05 + rng() * 0.2) * (0.4 + 0.6 * (size / 1.5));
            } else {
                size = 2 + Math.pow(rng(), 2.5) * 14;
                lum = (0.7 + 0.6 * Math.min(1, size / 6)) * Math.min(1, size / 4);
            }
            let bi = 0;
            for (let b = 0; b < BUCKETS.length; b++) {
                if (size < BUCKETS[b].max) { bi = b; break; }
            }
            buckets[bi].positions.push(p[0], p[1], p[2]);
            buckets[bi].colors.push(col.r * lum, col.g * lum, col.b * lum);
        }

        for (let b = 0; b < BUCKETS.length; b++) {
            const bk = buckets[b];
            if (!bk.positions.length) continue;
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bk.positions), 3));
            geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(bk.colors), 3));
            scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
                size: BUCKETS[b].size,
                sizeAttenuation: true,
                vertexColors: true,
                map: spriteTex,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
            })));
        }

        const nebCount = 3 + rng() * 5 | 0;
        for (let i = 0; i < nebCount; i++) {
            const n = makeNebula();
            scene.add(n);
        }
    }

    const sky = new SkySystem(SEED, planet.baseRadius);
    sky.addToScene(scene);
    sky.addLights(scene);

    const veg = generateVegetation(planet, sky.getStarData(), SEED);
    for (const p of veg.plants) scene.add(p);

    const liveBiomes = ['forest', 'jungle', 'desert'];
    const hasAtmos = liveBiomes.includes(veg.biome);

    if (hasAtmos) {
        const fogColor = veg.biome === 'desert' ? 0xffcc88 : 0x88ccff;
        scene.fog = new THREE.FogExp2(fogColor, 0.001);
    }

    const hemiIntensity = hasAtmos ? 0.40 : 0.25;
    const ambIntensity = hasAtmos ? 0.20 : 0.10;
    const hemiLight = new THREE.HemisphereLight(0x7799cc, 0x554433, hemiIntensity);
    scene.add(hemiLight);

    const ambLight = new THREE.AmbientLight(0x445566, ambIntensity);
    scene.add(ambLight);

    const crashedShip = (function() {
        const rng = (function(seed) { let a = seed; return function() { let t = a += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })(SEED + 12121);
        if (rng() >= 0.65) return null;
        let dir, h, tries = 0;
        do {
            const theta = rng() * Math.PI * 2;
            const phi = Math.acos(2 * rng() - 1);
            dir = new THREE.Vector3(
                Math.sin(phi) * Math.cos(theta),
                Math.cos(phi),
                Math.sin(phi) * Math.sin(theta)
            ).normalize();
            h = planet.getHeight(dir);
            if (++tries > 500) break;
        } while (h - planet.baseRadius < 0 || h - planet.baseRadius > 8);
        const ship = generateCrashedShip(SEED + 12121);
        const sPos = dir.clone().multiplyScalar(h + 1.2);
        ship.mesh.position.copy(sPos);
        ship.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        ship.mesh.renderOrder = 1;
        ship.mesh.traverse(c => { if (c.isMesh) { c.renderOrder = 1; } });
        scene.add(ship.mesh);
        const beaconMat = new THREE.SpriteMaterial({
            map: makeGlowTexture(0xff9944, 0.05, 0.3, 0.6),
            blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
            opacity: 1.0,
        });
        const beacon = new THREE.Sprite(beaconMat);
        beacon.scale.set(16, 16, 1);
        beacon.position.copy(sPos);
        scene.add(beacon);
        const shipBeamMat = new THREE.SpriteMaterial({
            map: makeGlowTexture(0xff9944, 0.05, 0.3, 0.6),
            blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
            opacity: 0.45,
        });
        const shipBeam = new THREE.Sprite(shipBeamMat);
        shipBeam.scale.set(5, 36, 1);
        shipBeam.position.copy(sPos.clone().add(dir.clone().multiplyScalar(18)));
        scene.add(shipBeam);
        return { mesh: ship.mesh, pos: sPos, name: ship.name, beacon, beaconMat, shipBeam, shipBeamMat, explored: false, collisionRadius: 2.6 };
    })();

    const weaponPickups = (function() {
        const rng = (function(seed) { let a = seed; return function() { let t = a += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })(SEED + 8888);
        const count = 3 + Math.floor(rng() * 5);
        const list = [];
        for (let i = 0; i < count; i++) {
            let dir, h, tries = 0;
            do {
                const theta = rng() * Math.PI * 2;
                const phi = Math.acos(2 * rng() - 1);
                dir = new THREE.Vector3(
                    Math.sin(phi) * Math.cos(theta),
                    Math.cos(phi),
                    Math.sin(phi) * Math.sin(theta)
                ).normalize();
                h = planet.getHeight(dir);
                if (++tries > 500) break;
            } while (h - planet.baseRadius < 0 || h - planet.baseRadius > 8);
            let tooClose = true;
            for (let s = 0; s < 20 && tooClose; s++) {
                tooClose = false;
                for (const p of list) {
                    if (dir.distanceTo(p.pos.clone().normalize()) < 0.15) { tooClose = true; break; }
                }
                if (tooClose) {
                    const theta = rng() * Math.PI * 2;
                    const phi = Math.acos(2 * rng() - 1);
                    dir = new THREE.Vector3(
                        Math.sin(phi) * Math.cos(theta),
                        Math.cos(phi),
                        Math.sin(phi) * Math.sin(theta)
                    ).normalize();
                    h = planet.getHeight(dir);
                }
            }
            const weaponData = generateWeapon(SEED + i * 77);
            list.push(buildPickup(weaponData, dir, h));
        }
        return list;
    })();

    function dropEnemyWeapon(data, pos) {
        const dir = pos.clone().normalize();
        const h = planet.getHeight(dir);
        weaponPickups.push(buildPickup(data, dir, h));
    }

    function onEnemyProjHit(e, attacker) {
        const dmg = attacker && attacker.weapon ? attacker.weapon.stats.damage : 10;
        logDamage(attacker ? attacker.name : '?', e.name, dmg);
        playEnemyHit(e.position);
        const died = e.takeDamage(dmg);
        if (died) {
            playEnemyDeath(e.position);
            const w = e.dropHeldWeapon();
            if (w) dropEnemyWeapon(w, e.position);
            enemiesKilled++;
            if (attacker) addLog(`${attacker.name} убил ${e.name}`, 'enemy');
            if (enemiesKilled >= enemies.length) {
                gameWon = true;
                if (victoryPrompt) victoryPrompt.style.display = 'block';
            }
        }
    }

    function onEnemyProjPlayerHit(p) {
        const attacker = p.owner;
        const dmg = attacker && attacker.weapon ? attacker.weapon.stats.damage : 10;
        logDamage(attacker ? attacker.name : '?', 'Вы', dmg);
        playEnemyHit();
        const died = player.takeDamage(dmg);
        if (died) {
            addLog('Вы погибли. Поражение.', 'player');
            gameOver = true;
            gameWon = false;
            const defeatOverlay = document.getElementById('defeatOverlay');
            if (defeatOverlay) defeatOverlay.style.display = 'flex';
            if (victoryPrompt) victoryPrompt.style.display = 'none';
        }
    }

    function investigateShip(by) {
        if (!crashedShip || crashedShip.explored) return;
        crashedShip.explored = true;
        crashedShip.beaconMat.map = makeGlowTexture(0x44ff88, 0.05, 0.3, 0.6);
        crashedShip.beaconMat.needsUpdate = true;
        crashedShip.shipBeamMat.map = makeGlowTexture(0x44ff88, 0.05, 0.3, 0.6);
        crashedShip.shipBeamMat.needsUpdate = true;
        const byPlayer = by === player;
        playInvestigate(byPlayer ? undefined : by.position);
        addLog(`${byPlayer ? 'Вы' : by.name} исследовал${byPlayer ? 'и' : ''} корабль «${crashedShip.name}»`, byPlayer ? 'player' : 'enemy');
        if (byPlayer) {
            score++;
            if (scoreDisplay) scoreDisplay.textContent = `score: ${score}`;
        }
    }

    const enemyProjectiles = [];
    const lastDamageLog = new Map();

    function addLog(text, cls) {
        const panel = document.getElementById('logPanel');
        if (!panel) return;
        const el = document.createElement('div');
        el.className = 'log' + (cls ? ' ' + cls : '');
        el.textContent = text;
        panel.appendChild(el);
        while (panel.children.length > 40) panel.firstChild.remove();
        panel.scrollTop = panel.scrollHeight;
    }

    function logDamage(who, whom, dmg) {
        const key = who + '>' + whom;
        const now = performance.now();
        if (now - (lastDamageLog.get(key) || 0) < 600) return;
        lastDamageLog.set(key, now);
        addLog(`${who} → ${whom}: ${dmg} урона`, who === 'Вы' ? 'player' : 'enemy');
    }

    const enemies = (function() {
        const rng = (function(seed) { let a = seed; return function() { let t = a += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })(SEED + 2222);
        const count = 4 + (rng() * 4 | 0);
        const arr = [];
        for (let i = 0; i < count; i++) {
            const e = new Enemy(planet, scene, SEED, i, veg.plants, arr, crashedShip, weaponPickups, removePickup, dropEnemyWeapon, enemyProjectiles, addLog);
            arr.push(e);
        }
        return arr;
    })();
    let enemiesKilled = 0;
    let gameWon = false;
    let evacuated = false;
    let gameOver = false;

    let score = 0;
    if (sessionStorage.getItem('lp_evac') === '1') {
        score = parseInt(sessionStorage.getItem('lp_score')) || 0;
        sessionStorage.removeItem('lp_evac');
    }

    const player = new Player(planet, scene, renderer, veg.plants, enemies, crashedShip);
    for (const e of enemies) e.player = player;
    setProjectileRng(() => Math.random());

    addLog(`Игра запущена: ${1 + enemies.length} участников (Вы + ${enemies.length} врагов: ${enemies.map(x => x.name).join(', ')})`, 'sys');
    if (crashedShip) addLog(`Найден разбитый корабль «${crashedShip.name}» — дополнительная цель`, 'sys');

    function buildPickup(data, dir, h) {
        const pPos = dir.clone().multiplyScalar(h + 2);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: makeGlowTexture(data.ammo.color, 0.05, 0.3, 0.6),
            blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
        }));
        glow.scale.set(12, 12, 1);
        glow.position.copy(pPos);
        scene.add(glow);
        const beam = new THREE.Sprite(new THREE.SpriteMaterial({
            map: makeGlowTexture(data.ammo.color, 0.05, 0.3, 0.6),
            blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
            opacity: 0.7,
        }));
        beam.scale.set(6, 42, 1);
        beam.position.copy(pPos.clone().add(dir.clone().multiplyScalar(20)));
        scene.add(beam);
        const mesh = data.mesh.clone();
        mesh.position.copy(pPos);
        mesh.scale.multiplyScalar(2.5);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        mesh.renderOrder = 1;
        mesh.traverse(c => { if (c.isMesh) { c.renderOrder = 1; } });
        scene.add(mesh);
        return { pos: pPos, data, mesh, glow, beam };
    }

    function nearestPickup(maxDist) {
        let best = null, bestD = maxDist;
        for (const p of weaponPickups) {
            const d = player.position.distanceTo(p.pos);
            if (d < bestD) { bestD = d; best = p; }
        }
        return best;
    }

    function removePickup(p) {
        scene.remove(p.mesh);
        scene.remove(p.glow);
        scene.remove(p.beam);
        const i = weaponPickups.indexOf(p);
        if (i >= 0) weaponPickups.splice(i, 1);
    }

    function updatePickupUI() {
        const prompt = document.getElementById('pickupPrompt');
        const hud = document.getElementById('weaponHUD');
        if (prompt) {
            const sh = crashedShip;
            if (sh && !sh.explored && player.position.distanceTo(sh.pos) < 9) {
                prompt.textContent = `Press E — investigate ${sh.name}`;
                prompt.style.display = 'block';
            } else {
                const p = nearestPickup(8);
                if (p) {
                    prompt.textContent = player.weapon ? `Press E — swap to ${p.data.name}` : 'Press E to pick up';
                    prompt.style.display = 'block';
                } else {
                    prompt.style.display = 'none';
                }
            }
        }
        if (hud && player.weapon) {
            const info = player.getWeaponInfo();
            document.getElementById('wpnName').textContent = info.name;
            document.getElementById('wpnType').textContent = `${info.type}, ${info.ammoType}`;
            document.getElementById('wpnAmmo').textContent = `${info.ammo}/${info.magSize}`;
            hud.style.display = 'flex';
        } else if (hud) hud.style.display = 'none';
    }

    const victoryPrompt = document.getElementById('victoryPrompt');
    const evacOverlay = document.getElementById('evacOverlay');
    const scoreDisplay = document.getElementById('scoreDisplay');
    const evacScoreEl = document.getElementById('evacScore');

    const planetNameEl = document.getElementById('planetName');
    const skySummaryEl = document.getElementById('skySummary');
    const biomeDisplayEl = document.getElementById('biomeDisplay');
    const seedDisplay = document.getElementById('seedDisplay');
    const titleNameEl = document.getElementById('titlePlanetName');
    const blocker = document.getElementById('blocker');

    if (planetNameEl) planetNameEl.textContent = PLANET_NAME;
    if (skySummaryEl && sky.summary) skySummaryEl.textContent = sky.summary;
    if (biomeDisplayEl) biomeDisplayEl.textContent = veg.biome;
    if (seedDisplay) seedDisplay.textContent = `seed: ${SEED}`;
    if (titleNameEl) titleNameEl.textContent = PLANET_NAME;
    if (scoreDisplay) scoreDisplay.textContent = `score: ${score}`;

    let isLocked = false;
    let ignoreNextMouse = true;
    let mouseDown = false;

    if (blocker) {
        blocker.addEventListener('click', () => {
            ignoreNextMouse = true;
            renderer.domElement.requestPointerLock();
        });
    }

    document.addEventListener('pointerlockchange', () => {
        isLocked = document.pointerLockElement === renderer.domElement;
        if (blocker) blocker.style.display = isLocked ? 'none' : 'flex';
        if (isLocked) ignoreNextMouse = true;
    });

    function keyId(e) {
        const map = { 'KeyW':'w','KeyA':'a','KeyS':'s','KeyD':'d','KeyR':'r','KeyE':'e','Space':' ' };
        return map[e.code] || e.key;
    }

    document.addEventListener('keydown', (e) => {
        const k = keyId(e);
        player.keys[k] = true;
        if (k === 'Escape' && isLocked) document.exitPointerLock();
        if (k === 'e' && !gameOver) {
            const sh = crashedShip;
            if (sh && !sh.explored && player.position.distanceTo(sh.pos) < 9) {
                investigateShip(player);
            } else {
                const p = nearestPickup(8);
                if (p) {
                    if (player.weapon) {
                        const oldData = player.weapon;
                        player.equipWeapon(p.data);
                        addLog(`Вы сменили оружие на ${p.data.name} (${p.data.type.name})`, 'player');
                        const dropDir = p.pos.clone().normalize();
                        const dropH = p.pos.length() - 2;
                        weaponPickups.push(buildPickup(oldData, dropDir, dropH));
                        playPickup(true);
                    } else {
                        player.equipWeapon(p.data);
                        addLog(`Вы подобрали ${p.data.name} (${p.data.type.name})`, 'player');
                        playPickup(false);
                    }
                    removePickup(p);
                }
            }
        }
        if (k === 'r' && player.weapon && !gameOver) player.tryReload();
        if (e.code === 'KeyY' || k === 'y' || k === 'Y' || k === 'у' || k === 'У' || k === 'н' || k === 'Н') {
            if (gameOver) {
                location.reload();
                return;
            }
            if (gameWon) {
                if (!evacuated) {
                    evacuated = true;
                    if (evacOverlay) evacOverlay.style.display = 'flex';
                    if (evacScoreEl) evacScoreEl.textContent = `score: ${score}`;
                    if (victoryPrompt) victoryPrompt.style.display = 'none';
                } else {
                    sessionStorage.setItem('lp_score', score);
                    sessionStorage.setItem('lp_evac', '1');
                    location.reload();
                }
            }
        }
    });

    document.addEventListener('keyup', (e) => {
        player.keys[keyId(e)] = false;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isLocked) return;
        if (ignoreNextMouse) { ignoreNextMouse = false; return; }
        player.onMouseMove(e.movementX, e.movementY);
    });

    document.addEventListener('mousedown', (e) => {
        if (!isLocked || e.button !== 0 || gameOver) return;
        mouseDown = true;
        player.tryFire(camera);
    });
    document.addEventListener('mouseup', (e) => {
        if (e.button !== 0) return;
        mouseDown = false;
    });

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);
        const dt = Math.min(clock.getDelta(), 0.05);
        const tNow = performance.now() * 0.001;
        const camFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
        updateListener(camera.position.x, camera.position.y, camera.position.z, camFwd.x, camFwd.y, camFwd.z, camUp.x, camUp.y, camUp.z);
        for (const p of sky.pulsars) {
            const v = 0.5 + 0.5 * Math.sin(tNow * p.freq * Math.PI * 2 + p.phase);
            p.glow.material.opacity = 0.35 + 0.65 * v;
            p.glow.scale.set(p.baseScale * (0.9 + 0.15 * v), p.baseScale * (0.9 + 0.15 * v), 1);
            if (p.light) p.light.intensity = p.baseIntensity * (0.4 + 0.6 * v);
        }
        const hpEl = document.getElementById('playerHP');
        if (hpEl) hpEl.textContent = `HP: ${Math.max(0, player.hp)}/${player.maxHp}`;
        if (gameOver) {
            renderer.render(scene, camera);
            return;
        }
        player.update(dt, camera);
        if (mouseDown && isLocked) player.tryFire(camera);
        updatePickupUI();

        for (const e of enemies) e.update(dt);
        if (crashedShip && !crashedShip.explored) {
            for (const e of enemies) {
                if (e.alive && e.position.distanceTo(crashedShip.pos) < 9) {
                    investigateShip(e);
                    break;
                }
            }
        }

        for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
            const p = enemyProjectiles[i];
            let hit = false;
            p.lifetime -= dt;
            if (p.lifetime <= 0) {
                hit = true;
            } else if (p.isLaser) {
                for (const e of enemies) {
                    if (e === p.owner || !e.alive) continue;
                    const toE = e.position.clone().sub(p.origin);
                    const proj = toE.dot(p.direction);
                    if (proj >= 0 && proj <= p.length) {
                        const cp = p.origin.clone().add(p.direction.clone().multiplyScalar(Math.max(0, Math.min(p.length, proj))));
                        if (cp.distanceTo(e.position) < 1.2) { hit = true; onEnemyProjHit(e, p.owner); break; }
                    }
                }
            } else {
                p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
                for (const e of enemies) {
                    if (e === p.owner || !e.alive) continue;
                    if (p.mesh.position.distanceTo(e.position) < 1.2) { hit = true; onEnemyProjHit(e, p.owner); break; }
                }
            }
            if (!hit) {
                for (const pl of veg.plants) {
                    if (!pl.userData.collisionRadius) continue;
                    let dist2;
                    if (p.isLaser) {
                        const toP = pl.position.clone().sub(p.origin);
                        const proj = toP.dot(p.direction);
                        if (proj >= 0 && proj <= p.length) {
                            const cp = p.origin.clone().add(p.direction.clone().multiplyScalar(Math.max(0, Math.min(p.length, proj))));
                            dist2 = cp.distanceTo(pl.position);
                        } else { continue; }
                    } else {
                        dist2 = p.mesh.position.distanceTo(pl.position);
                    }
                    if (dist2 < 0.8 + pl.userData.collisionRadius) {
                        playPlantHit(pl.userData.plantType, pl.position);
                        breakPlant(pl);
                        pl.userData.collisionRadius = 0;
                        hit = true;
                        break;
                    }
                }
            }
            if (!hit && player.hp > 0) {
                let pd;
                if (p.isLaser) {
                    const toP = player.position.clone().sub(p.origin);
                    const proj = toP.dot(p.direction);
                    if (proj >= 0 && proj <= p.length) {
                        const cp = p.origin.clone().add(p.direction.clone().multiplyScalar(Math.max(0, Math.min(p.length, proj))));
                        pd = cp.distanceTo(player.position);
                    } else { pd = Infinity; }
                } else {
                    pd = p.mesh.position.distanceTo(player.position);
                }
                if (pd < 1.4) { hit = true; onEnemyProjPlayerHit(p); }
            }
            if (hit) {
                if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
                if (p.mesh.geometry) p.mesh.geometry.dispose();
                if (p.mesh.material) p.mesh.material.dispose();
                if (p.glow) { if (p.glow.parent) p.glow.parent.remove(p.glow); p.glow.material.dispose(); }
                enemyProjectiles.splice(i, 1);
            }
        }

        for (let i = player.projectiles.length - 1; i >= 0; i--) {
            const p = player.projectiles[i];
            let hit = false;
            for (const e of enemies) {
                if (!e.alive) continue;
                let dist;
                if (p.isLaser) {
                    const toEnemy = e.position.clone().sub(p.origin);
                    const proj = toEnemy.dot(p.direction);
                    if (proj >= 0 && proj <= p.length) {
                        const closest = p.origin.clone().add(p.direction.clone().multiplyScalar(Math.max(0, Math.min(p.length, proj))));
                        dist = closest.distanceTo(e.position);
                    } else {
                        continue;
                    }
                } else {
                    dist = p.mesh.position.distanceTo(e.position);
                }
                if (dist < 2.5) {
                    const dmg = player.weapon.stats.damage;
                    logDamage('Вы', e.name, dmg);
                    playEnemyHit(e.position);
                    const died = e.takeDamage(dmg);
                    if (died) {
                        playEnemyDeath(e.position);
                        addLog(`Вы убили ${e.name}`, 'player');
                        const w = e.dropHeldWeapon();
                        if (w) dropEnemyWeapon(w, e.position);
                        enemiesKilled++;
                        score++;
                        if (scoreDisplay) scoreDisplay.textContent = `score: ${score}`;
                        if (enemiesKilled >= enemies.length) {
                            gameWon = true;
                            if (victoryPrompt) victoryPrompt.style.display = 'block';
                        }
                    }
                    if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
                    if (p.mesh.geometry) p.mesh.geometry.dispose();
                    if (p.mesh.material) p.mesh.material.dispose();
                    if (p.glow) { if (p.glow.parent) p.glow.parent.remove(p.glow); p.glow.material.dispose(); }
                    player.projectiles.splice(i, 1);
                    hit = true;
                    break;
                }
            }
            if (!hit) {
                for (const pl of veg.plants) {
                    if (!pl.userData.collisionRadius) continue;
                    let dist2;
                    if (p.isLaser) {
                        const toP = pl.position.clone().sub(p.origin);
                        const proj = toP.dot(p.direction);
                        if (proj >= 0 && proj <= p.length) {
                            const closest = p.origin.clone().add(p.direction.clone().multiplyScalar(Math.max(0, Math.min(p.length, proj))));
                            dist2 = closest.distanceTo(pl.position);
                        } else { continue; }
                    } else {
                        dist2 = p.mesh.position.distanceTo(pl.position);
                    }
                    if (dist2 < 0.8 + pl.userData.collisionRadius) {
                        playPlantHit(pl.userData.plantType);
                        breakPlant(pl);
                        pl.userData.collisionRadius = 0;
                        if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
                        if (p.mesh.geometry) p.mesh.geometry.dispose();
                        if (p.mesh.material) p.mesh.material.dispose();
                        if (p.glow) { if (p.glow.parent) p.glow.parent.remove(p.glow); p.glow.material.dispose(); }
                        player.projectiles.splice(i, 1);
                        hit = true;
                        break;
                    }
                }
            }
            if (hit) continue;
        }

        renderer.render(scene, camera);
    }

    animate();
} catch (err) {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;background:#400;color:#fff;padding:40px;z-index:9999;font:16px monospace;white-space:pre-wrap';
    el.textContent = `FATAL: ${err.message}\n${err.stack}`;
    document.body.appendChild(el);
}
