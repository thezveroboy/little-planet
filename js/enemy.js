import * as THREE from 'three';
import { makeGlowTexture } from './sky.js?v=47';
import { WEAPON_TYPES, AMMO_TYPES, fireProjectile } from './weapons.js?v=47';
import { playGunshot, playReload, playReloadEnd, playPickup } from './sound.js?v=47';
import { generateEnemyName } from './namegen.js?v=47';

function mulberry32(a) {
    return function() {
        let t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

function buildAstronaut(rng) {
    const g = new THREE.Group();
    const suit = 0xeeeeee;
    const suitD = 0xcccccc;
    const skin = 0xffccaa;
    const visor = 0x88ccff;
    const acc = 0xff8833;

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.5, 8), new THREE.MeshStandardMaterial({ color: suit, roughness: 0.7 }));
    torso.position.y = 0.25;
    g.add(torso);

    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 6, 12), new THREE.MeshStandardMaterial({ color: suitD, roughness: 0.6 }));
    belt.position.y = 0.05;
    belt.rotation.x = Math.PI / 2;
    g.add(belt);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshStandardMaterial({ color: skin, roughness: 0.5 }));
    head.position.y = 0.55;
    g.add(head);

    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.25 }));
    helmet.position.y = 0.55;
    g.add(helmet);

    const visorM = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshStandardMaterial({ color: visor, roughness: 0.2, metalness: 0.6, transparent: true, opacity: 0.5 }));
    visorM.position.set(0, 0.56, -0.1);
    visorM.scale.set(1, 0.6, 0.3);
    g.add(visorM);

    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, 0.1), new THREE.MeshStandardMaterial({ color: suitD, roughness: 0.8 }));
    pack.position.set(0, 0.25, -0.25);
    g.add(pack);

    for (let side = -1; side <= 1; side += 2) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.35, 6), new THREE.MeshStandardMaterial({ color: suit, roughness: 0.7 }));
        arm.position.set(side * 0.28, 0.35, 0);
        arm.rotation.z = side * 0.3;
        g.add(arm);

        const glove = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), new THREE.MeshStandardMaterial({ color: suitD, roughness: 0.8 }));
        glove.position.set(side * 0.32, 0.15, 0);
        g.add(glove);

        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.35, 6), new THREE.MeshStandardMaterial({ color: suit, roughness: 0.7 }));
        leg.position.set(side * 0.1, -0.2, 0);
        g.add(leg);

        const boot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.12), new THREE.MeshStandardMaterial({ color: suitD, roughness: 0.9 }));
        boot.position.set(side * 0.1, -0.38, 0.03);
        g.add(boot);
    }

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 4), new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.5 }));
    antenna.position.set(0, 0.65, 0.05);
    g.add(antenna);
    const antBall = new THREE.Mesh(new THREE.SphereGeometry(0.015, 4, 4), new THREE.MeshStandardMaterial({ color: acc, emissive: acc, emissiveIntensity: 0.3 }));
    antBall.position.set(0, 0.7, 0.05);
    g.add(antBall);

    g.scale.set(1.6, 1.6, 1.6);
    return g;
}

function makeWhiteGlow() {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.15, 'rgba(255,255,255,0.8)');
    g.addColorStop(0.4, 'rgba(200,220,255,0.3)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
}
const _glowTex = makeWhiteGlow();

function blockedByObstacles(pos, plants, enemies, selfPos, ship) {
    for (const p of plants) {
        if (!p.userData.collisionRadius) continue;
        if (pos.distanceTo(p.position) < 0.6 + p.userData.collisionRadius) return true;
    }
    for (const e of enemies) {
        if (!e.alive) continue;
        if (e.position.distanceTo(selfPos) < 0.01) continue;
        if (pos.distanceTo(e.position) < 0.8 + 0.6) return true;
    }
    if (ship && pos.distanceTo(ship.pos) < 0.6 + ship.collisionRadius) return true;
    return false;
}

export class Enemy {
    constructor(planet, scene, seed, index, plants, enemies, ship, weaponPickups, removePickupFn, dropWeaponFn, enemyProjectiles, logFn) {
        this.planet = planet;
        this.scene = scene;
        this.plants = plants || [];
        this.enemies = enemies || [];
        this.ship = ship || null;
        this.pickups = weaponPickups || [];
        this.removePickupFn = removePickupFn || null;
        this.dropWeaponFn = dropWeaponFn || null;
        this.enemyProjectiles = enemyProjectiles || [];
        this.logFn = logFn || null;
        this.player = null;
        this.rng = mulberry32(seed + 1111 + index * 777);
        this.name = generateEnemyName(seed + 1111 + index * 777);

        this.prefAmmo = AMMO_TYPES[this.rng() * AMMO_TYPES.length | 0].id;
        this.prefType = WEAPON_TYPES[this.rng() * WEAPON_TYPES.length | 0].id;
        this.weapon = null;
        this.handWeapon = null;
        this.targetPickup = null;
        this.seeTimer = 0;
        this.combatTarget = null;
        this.fireTimer = 0;
        this.magAmmo = 0;
        this.reloadTimer = 0;
        this.dodgeTimer = 0;
        this.dodgeDir = new THREE.Vector3();
        this.strafeTimer = 0;
        this.strafeDir = 1;

        this.hp = 2 * (15 + (this.rng() * 66 | 0));
        this.maxHp = this.hp;
        this.alive = true;
        this.moveTimer = 0;
        this.moveDir = new THREE.Vector3();
        this.moveDuration = 2 + this.rng() * 3;
        this.speed = 10 + this.rng() * 8;
        this.jumpTimer = 3 + this.rng() * 4;
        this.jumpVel = 0;
        this.grounded = true;
        this.gravity = 28;
        this.jumpSpeed = 11;
        this.deadFallTimer = 0;
        this.deadFallVel = 0;

        let d, h, tries = 0;
        do {
            d = new THREE.Vector3(
                (this.rng() - 0.5) * 2,
                (this.rng() - 0.5) * 2,
                (this.rng() - 0.5) * 2
            ).normalize();
            h = this.planet.getHeight(d);
            if (++tries > 500) break;
        } while (h - this.planet.baseRadius < 0.5 || h - this.planet.baseRadius > 12);
        this.position = d.clone().multiplyScalar(h + 0.8);

        this.mesh = buildAstronaut(this.rng);
        this.mesh.position.copy(this.position);
        const up = this.position.clone().normalize();
        this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
        scene.add(this.mesh);

        const spriteMat = new THREE.SpriteMaterial({ map: _glowTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
        this.glow = new THREE.Sprite(spriteMat);
        this.glow.scale.set(6, 6, 1);
        this.glow.position.copy(this.position.clone().add(up.clone().multiplyScalar(1.5)));
        scene.add(this.glow);

        this.hpLabel = this.makeHpLabel();
        this.hpLabel.position.copy(this.position.clone().add(up.clone().multiplyScalar(2.8)));
        scene.add(this.hpLabel);

        this.baseOrient = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0), up
        );
    }

    update(dt) {
        if (!this.alive) {
            if (this.deadFallTimer > 0) {
                this.deadFallTimer -= dt;
                this.deadFallVel -= this.gravity * dt;
                const oldDist = this.position.length();
                const dir2 = this.position.clone().normalize();
                const newPos = dir2.clone().multiplyScalar(oldDist + this.deadFallVel * dt);
                const sh = this.planet.getHeight(dir2);
                const minDist = sh + 0.2;
                if (newPos.length() <= minDist) {
                    this.mesh.position.copy(dir2.multiplyScalar(minDist));
                    this.deadFallTimer = 0;
                } else {
                    this.mesh.position.copy(newPos);
                    this.position.copy(newPos);
                    this.glow.position.copy(newPos.clone().add(dir2.clone().multiplyScalar(1.5)));
                }
            }
            return;
        }

        const up = this.position.clone().normalize();

        const oldBaseUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.baseOrient);
        const delta = new THREE.Quaternion().setFromUnitVectors(oldBaseUp, up);
        this.baseOrient.copy(delta.multiply(this.baseOrient));

        this.moveTimer -= dt;
        if (this.moveTimer <= 0) {
            this.moveTimer = this.moveDuration;
            this.moveDuration = 2 + this.rng() * 3;
            const theta = this.rng() * Math.PI * 2;
            const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.baseOrient);
            const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.baseOrient);
            this.moveDir = fwd.multiplyScalar(Math.cos(theta)).add(right.multiplyScalar(Math.sin(theta))).normalize();
        }

        this.jumpTimer -= dt;
        const wantJump = this.jumpTimer <= 0 && this.grounded;
        if (wantJump) {
            this.jumpVel = this.jumpSpeed;
            this.grounded = false;
            this.jumpTimer = 3 + this.rng() * 4;
        }

        if (!this.grounded) {
            this.jumpVel -= this.gravity * dt;
        }

        if (this.grounded) {
            const dir = this.position.clone().normalize();
            const sh = this.planet.getHeight(dir);
            this.position.copy(dir.multiplyScalar(sh + 0.8));

            const oldPos = this.position.clone();
            const tangentPos = this.position.clone();
            tangentPos.add(this.moveDir.clone().multiplyScalar(this.speed * dt));
            const newDir = tangentPos.clone().normalize();
            const newSH = this.planet.getHeight(newDir);
            const candidate = newDir.multiplyScalar(newSH + 0.8);
            if (!blockedByObstacles(candidate, this.plants, this.enemies, this.position, this.ship)) {
                this.position.copy(candidate);
            } else {
                const up2 = this.position.clone().normalize();
                const right = new THREE.Vector3().crossVectors(this.moveDir, up2).normalize();
                const speed2 = this.speed * dt;
                const slideDirs = [
                    right.clone(),
                    right.clone().negate(),
                    this.moveDir.clone().add(right).normalize(),
                    this.moveDir.clone().add(right.clone().negate()).normalize(),
                ];
                for (const sd of slideDirs) {
                    let clear = true;
                    const steps = 4;
                    for (let st = 1; st <= steps; st++) {
                        const s = sd.clone().multiplyScalar(speed2 * st / steps);
                        const sp = this.position.clone().add(s);
                        const sdir = sp.clone().normalize();
                        const sc = sdir.multiplyScalar(this.planet.getHeight(sdir) + 0.8);
                        if (blockedByObstacles(sc, this.plants, this.enemies, this.position, this.ship)) {
                            clear = false;
                            break;
                        }
                    }
                    if (clear) {
                        const s = sd.clone().multiplyScalar(speed2 * 0.9);
                        const sp = this.position.clone().add(s);
                        const sdir = sp.clone().normalize();
                        this.position.copy(sdir.multiplyScalar(this.planet.getHeight(sdir) + 0.8));
                        break;
                    }
                }
            }
        } else {
            const oldDir = this.position.clone().normalize();
            const oldDist = this.position.length();
            const newPos = oldDir.clone().multiplyScalar(oldDist);
            newPos.add(oldDir.clone().multiplyScalar(this.jumpVel * dt));

            const newDir2 = newPos.clone().normalize();
            const newDist = newPos.length();
            const sh = this.planet.getHeight(newDir2);
            const minDist = sh + 0.8;

            if (this.jumpVel <= 0 && newDist <= minDist) {
                this.position.copy(newDir2.multiplyScalar(minDist));
                this.jumpVel = 0;
                this.grounded = true;
            } else {
                this.position.copy(newPos);
            }
        }

        this.seeTimer -= dt;
        if (this.seeTimer <= 0) {
            this.seeTimer = 0.4;
            this.scanPickups();
            this.combatScan();
        }

        if (this.weapon) {
            for (const p of this.enemyProjectiles) {
                if (p.owner === this || !p.vel) continue;
                const dTo = this.position.distanceTo(p.mesh.position);
                if (dTo < 14 && p.vel.dot(this.position.clone().sub(p.mesh.position)) > 0) {
                    if (this.dodgeTimer <= 0) this.triggerDodge(p.vel);
                    break;
                }
            }
        }
        this.dodgeTimer = Math.max(0, this.dodgeTimer - dt);

        const inCombat = !!(this.weapon && this.combatTarget && (this.combatTarget === this.player ? this.player.hp > 0 : this.combatTarget.alive));
        if (inCombat) {
            this.combatTick(dt);
        } else if (this.ship && !this.ship.explored && this.position.distanceTo(this.ship.pos) < 55) {
            const dirTo = this.ship.pos.clone().sub(this.position);
            const upV = this.position.clone().normalize();
            const tangent = dirTo.clone().sub(upV.clone().multiplyScalar(dirTo.dot(upV)));
            if (tangent.lengthSq() > 0.0001) {
                this.moveDir.copy(tangent.normalize());
                this.moveTimer = 0.5;
            }
        } else if (this.targetPickup) {
            if (this.pickups.indexOf(this.targetPickup) < 0) {
                this.targetPickup = null;
            } else if (this.position.distanceTo(this.targetPickup.pos) < 2.4) {
                const t = this.targetPickup;
                this.targetPickup = null;
                this.grabPickup(t);
            } else {
                const dirTo = this.targetPickup.pos.clone().sub(this.position);
                const upV = this.position.clone().normalize();
                const tangent = dirTo.clone().sub(upV.clone().multiplyScalar(dirTo.dot(upV)));
                if (tangent.lengthSq() > 0.0001) {
                    this.moveDir.copy(tangent.normalize());
                    this.moveTimer = 0.5;
                }
            }
        }

        this.mesh.position.copy(this.position);
        const newUp = this.position.clone().normalize();
        this.glow.position.copy(this.position.clone().add(newUp.clone().multiplyScalar(1.5)));
        this.hpLabel.position.copy(this.position.clone().add(newUp.clone().multiplyScalar(2.8)));

        this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), newUp);

        let faceDir = this.moveDir;
        if (inCombat && this.combatTarget) {
            const dirTo = this.combatTarget.position.clone().sub(this.position);
            const upV = this.position.clone().normalize();
            const tangent = dirTo.clone().sub(upV.clone().multiplyScalar(dirTo.dot(upV)));
            if (tangent.lengthSq() > 0.0001) faceDir = tangent.normalize();
        }
        if (faceDir.lengthSq() > 0.0001) {
            const invQ = this.mesh.quaternion.clone().invert();
            const localMove = faceDir.clone().applyQuaternion(invQ);
            localMove.y = 0;
            if (localMove.lengthSq() > 0.0001) {
                localMove.normalize();
                const yaw = Math.atan2(localMove.x, -localMove.z);
                const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
                this.mesh.quaternion.multiply(qYaw);
            }
        }
    }

    rateWeapon(w) {
        let r = 0;
        if (w.ammo.id === this.prefAmmo) r += 3;
        if (w.type.id === this.prefType) r += 3;
        r += w.stats.damage * 0.005;
        return r;
    }

    scanPickups() {
        let best = null, bestDist = 45;
        for (const p of this.pickups) {
            const d = this.position.distanceTo(p.pos);
            if (d >= bestDist) continue;
            if (this.weapon) {
                if (this.rateWeapon(p.data) <= this.rateWeapon(this.weapon) + 0.4) continue;
            }
            best = p;
            bestDist = d;
        }
        this.targetPickup = best;
    }

    combatScan() {
        if (!this.weapon) { this.combatTarget = null; return; }
        let best = null, bestD = 45;
        if (this.player && this.player.hp > 0) {
            const d = this.position.distanceTo(this.player.position);
            if (d < bestD) { bestD = d; best = this.player; }
        }
        for (const e of this.enemies) {
            if (e === this || !e.alive) continue;
            const d = this.position.distanceTo(e.position);
            if (d < bestD) { bestD = d; best = e; }
        }
        this.combatTarget = best;
    }

    combatTick(dt) {
        if (this.dodgeTimer > 0) {
            this.moveDir.copy(this.dodgeDir);
            this.moveTimer = 0.4;
        } else {
            this.strafeTimer -= dt;
            if (this.strafeTimer <= 0) {
                this.strafeTimer = 1.2 + this.rng() * 2.2;
                this.strafeDir = this.rng() < 0.5 ? 1 : -1;
            }
            const dist = this.position.distanceTo(this.combatTarget.position);
            const dirTo = this.combatTarget.position.clone().sub(this.position);
            const upV = this.position.clone().normalize();
            const tangent = dirTo.clone().sub(upV.clone().multiplyScalar(dirTo.dot(upV)));
            if (dist > 30) {
                if (tangent.lengthSq() > 0.0001) {
                    this.moveDir.copy(tangent.normalize());
                    this.moveTimer = 0.4;
                }
            } else if (dist < 7) {
                if (tangent.lengthSq() > 0.0001) {
                    this.moveDir.copy(tangent.normalize().negate());
                    this.moveTimer = 0.3;
                }
            } else {
                if (tangent.lengthSq() > 0.0001) {
                    const right = new THREE.Vector3().crossVectors(tangent.normalize(), upV).normalize();
                    this.moveDir.copy(right.multiplyScalar(this.strafeDir));
                    this.moveTimer = 0.3;
                } else {
                    this.moveDir.set(0, 0, 0);
                }
            }
        }

        this.fireTimer -= dt;
        if (this.fireTimer <= 0) {
            if (this.reloadTimer > 0) {
                this.reloadTimer -= dt;
                if (this.reloadTimer <= 0) {
                    playReloadEnd(this.weapon.type.id, this.position);
                }
            } else if (this.magAmmo <= 0) {
                this.magAmmo = this.weapon.stats.magSize;
                this.reloadTimer = this.weapon.stats.reloadTime;
                playReload(this.weapon.type.id, this.weapon.ammo.id, this.weapon.stats.reloadTime, this.position);
            } else {
                this.fireAt(this.combatTarget);
                this.magAmmo--;
                this.fireTimer = this.weapon.stats.fireInterval;
            }
        }
    }

    fireAt(target) {
        if (!this.weapon) return;
        const up = this.position.clone().normalize();
        const muzzle = this.position.clone().add(up.clone().multiplyScalar(1.05));
        const aim = target.position.clone().sub(muzzle).normalize();
        const projs = fireProjectile(this.weapon, muzzle, aim, this.scene);
        for (const p of projs) p.owner = this;
        this.enemyProjectiles.push(...projs);
        playGunshot(this.weapon.type.id, this.weapon.ammo.id, this.position);
    }

    triggerDodge(vel) {
        this.dodgeTimer = 0.5 + this.rng() * 0.4;
        const up = this.position.clone().normalize();
        const side = new THREE.Vector3().crossVectors(vel, up);
        if (side.lengthSq() < 0.0001) side.set(1, 0, 0);
        side.normalize();
        if (this.rng() < 0.5) side.negate();
        this.dodgeDir = side;
    }

    grabPickup(p) {
        const had = !!this.weapon;
        if (this.weapon) {
            if (this.dropWeaponFn) this.dropWeaponFn(this.weapon, this.position);
        }
        this.weapon = p.data;
        this.attachHeldWeapon(p.data);
        playPickup(had, this.position);
        if (this.logFn) {
            const w = p.data;
            this.logFn(`${this.name} ${had ? 'swapped to' : 'picked up'} ${w.name} (${w.type.name})`, 'enemy');
        }
        if (this.removePickupFn) this.removePickupFn(p);
    }

    attachHeldWeapon(data) {
        if (this.handWeapon) this.mesh.remove(this.handWeapon);
        const wm = data.mesh.clone();
        wm.scale.set(2.2, 2.2, 2.2);
        wm.position.set(0.3, 0.24, -0.06);
        wm.rotation.z = -0.45;
        wm.rotation.x = 0.2;
        this.mesh.add(wm);
        this.handWeapon = wm;
        this.magAmmo = data.stats.magSize;
        this.reloadTimer = 0;
        this.fireTimer = 0.3 + this.rng() * 0.7;
    }

    dropHeldWeapon() {
        if (!this.weapon) return null;
        const w = this.weapon;
        this.weapon = null;
        if (this.handWeapon) {
            this.mesh.remove(this.handWeapon);
            this.handWeapon = null;
        }
        return w;
    }

    makeHpLabel() {
        const c = document.createElement('canvas');
        c.width = 160; c.height = 56;
        const ctx = c.getContext('2d');
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.roundRect(4, 4, 152, 48, 6);
        ctx.fill();
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(this.name, 80, 18);
        ctx.font = 'bold 22px monospace';
        ctx.fillStyle = '#ff4444';
        ctx.fillText(`${this.hp}/${this.maxHp}`, 80, 40);
        const tex = new THREE.CanvasTexture(c);
        tex.needsUpdate = true;
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: true });
        const s = new THREE.Sprite(mat);
        s.scale.set(3.5, 1.2, 1);
        return s;
    }

    updateHpLabel() {
        if (!this.hpLabel) return;
        const mat = this.hpLabel.material;
        const tex = mat.map;
        const c = tex.image;
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.roundRect(4, 4, 152, 48, 6);
        ctx.fill();
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(this.name, 80, 18);
        ctx.font = 'bold 22px monospace';
        ctx.fillStyle = '#ff4444';
        ctx.fillText(`${this.hp}/${this.maxHp}`, 80, 40);
        tex.needsUpdate = true;
    }

    takeDamage(damage) {
        if (!this.alive) return false;
        this.hp -= damage;
        this.updateHpLabel();
        if (this.hp <= 0) {
            this.alive = false;
            this.die();
            return true;
        }
        return false;
    }

    die() {
        if (this.hpLabel.parent) this.hpLabel.parent.remove(this.hpLabel);
        this.hpLabel.material.dispose();
        this.hpLabel.material.map.dispose();

        this.deadFallTimer = 2;
        this.deadFallVel = -5;

        this.glow.material.map = makeGlowTexture(0xff3333, 0.05, 0.3, 0.6);
        this.glow.material.needsUpdate = true;
        this.glow.scale.set(3, 3, 1);

        this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.position.clone().normalize());
        this.mesh.rotateX(Math.PI / 2);

        this.mesh.traverse(c => {
            if (c.isMesh) {
                c.material = c.material.clone();
                c.material.color.setHex(0x888888);
                c.material.emissive = new THREE.Color(0x000000);
            }
        });

        const eyeMat = new THREE.SpriteMaterial({
            map: makeGlowTexture(0xff2222, 0.05, 0.15, 0.45),
            blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
        });
        const eyeGlow = new THREE.Sprite(eyeMat);
        eyeGlow.scale.set(0.5, 0.5, 1);
        eyeGlow.position.set(0, 0.56, -0.08);
        this.mesh.add(eyeGlow);
    }
}
