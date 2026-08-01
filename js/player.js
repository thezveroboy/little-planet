import * as THREE from 'three';
import { fireProjectile, setProjectileRng } from './weapons.js?v=47';
import { playGunshot, playReload, playReloadEnd } from './sound.js?v=47';

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

export class Player {
    constructor(planet, scene, renderer, plants, enemies, ship) {
        this.planet = planet;
        this.scene = scene;
        this.renderer = renderer;
        this.plants = plants || [];
        this.enemies = enemies || [];
        this.ship = ship || null;
        this.position = new THREE.Vector3();
        this.yaw = 0;
        this.pitch = 0;
        this.eyeHeight = 1.6;
        this.radius = 0.5;
        this.grounded = true;
        this.jumpVel = 0;
        this.jumpPrev = false;

        this.moveSpeed = 22;
        this.jumpSpeed = 13;
        this.gravity = 28;
        this.friction = 5;

        this.keys = {};

        this.hp = 250;
        this.maxHp = 250;

        this.weapon = null;
        this.weaponMesh = new THREE.Group();
        this.ammo = 0;
        this.fireTimer = 0;
        this.reloading = false;
        this.reloadTimer = 0;
        this.projectiles = [];
        this.weaponOffset = new THREE.Vector3(0.15, -0.18, -0.3);
        this.barrelDepth = -0.15;

        const d = new THREE.Vector3(0.3, 0.9, 0.2).normalize();
        const h = this.planet.getHeight(d);
        this.position.copy(d).multiplyScalar(h + this.radius);

        this.baseOrient = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0), this.position.clone().normalize()
        );
    }

    equipWeapon(weaponData) {
        if (this.weaponMesh.parent) {
            this.weaponMesh.parent.remove(this.weaponMesh);
        }
        for (const c of [...this.weaponMesh.children]) this.weaponMesh.remove(c);
        this.weapon = weaponData;
        this.ammo = weaponData.stats.magSize;
        this.reloading = false;
        this.reloadTimer = 0;
        this.fireTimer = 0;

        const fps = weaponData.mesh.clone();
        fps.position.copy(this.weaponOffset);
        fps.scale.multiplyScalar(2);
        this.weaponMesh.add(fps);

        const icon = weaponData.mesh.clone();
        icon.position.set(-0.42, -0.27, -0.4);
        icon.scale.set(0.1125, 0.1125, 0.1125);
        icon.rotation.set(0.1, 0.4, -0.1);
        icon.traverse(c => c.frustumCulled = false);
        this.weaponMesh.add(icon);

        this.weaponMesh.visible = true;
    }

    getWeaponInfo() {
        if (!this.weapon) return null;
        return {
            name: this.weapon.name,
            type: this.weapon.type.name,
            ammoType: this.weapon.ammo.name,
            magSize: this.weapon.stats.magSize,
            ammo: this.ammo,
            reloading: this.reloading,
        };
    }

    update(dt, camera) {
        if (dt <= 0 || !isFinite(dt)) return;

        const up = this.position.clone().normalize();

        const oldBaseUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.baseOrient);
        const delta = new THREE.Quaternion().setFromUnitVectors(oldBaseUp, up);
        this.baseOrient.copy(delta.multiply(this.baseOrient));

        const f0 = new THREE.Vector3(0, 0, -1).applyQuaternion(this.baseOrient);
        const r0 = new THREE.Vector3(1, 0, 0).applyQuaternion(this.baseOrient);

        const cosY = Math.cos(this.yaw), sinY = Math.sin(this.yaw);
        const fwd = f0.clone().multiplyScalar(cosY).add(r0.clone().multiplyScalar(sinY));
        const right = r0.clone().multiplyScalar(cosY).sub(f0.clone().multiplyScalar(sinY));

        const move = new THREE.Vector3();
        if (this.keys['w'] || this.keys['W'] || this.keys['ArrowUp']) move.add(fwd);
        if (this.keys['s'] || this.keys['S'] || this.keys['ArrowDown']) move.sub(fwd);
        if (this.keys['a'] || this.keys['A'] || this.keys['ArrowLeft']) move.sub(right);
        if (this.keys['d'] || this.keys['D'] || this.keys['ArrowRight']) move.add(right);

        const wantJump = (this.keys[' '] || this.keys['Space']) && !this.jumpPrev;
        this.jumpPrev = !!(this.keys[' '] || this.keys['Space']);

        if (this.grounded) {
            if (wantJump) {
                this.jumpVel = this.jumpSpeed;
                this.grounded = false;
            }
        } else {
            this.jumpVel -= this.gravity * dt;
        }

        const hasMove = move.lengthSq() > 0;
        if (hasMove) move.normalize();

        const fric = Math.exp(-this.friction * dt);

        if (this.grounded) {
            this.position.copy(up.multiplyScalar(this.position.length()));
            const dir = this.position.clone().normalize();
            const sh = this.planet.getHeight(dir);
            const targetDist = sh + this.radius;
            this.position.copy(dir.multiplyScalar(targetDist));

            if (hasMove) {
                const oldPos = this.position.clone();
                const tangentPos = this.position.clone();
                tangentPos.add(move.multiplyScalar(this.moveSpeed * dt));

                const newDir = tangentPos.clone().normalize();
                const newSH = this.planet.getHeight(newDir);
                const newTarget = newSH + this.radius;
                const candidate = newDir.multiplyScalar(newTarget);
                if (!blockedByObstacles(candidate, this.plants, this.enemies, this.position, this.ship)) {
                    this.position.copy(candidate);
                } else {
                    const up2 = this.position.clone().normalize();
                    const right = new THREE.Vector3().crossVectors(move, up2).normalize();
                    const speed2 = this.moveSpeed * dt;
                    const slideDirs = [
                        right.clone(),
                        right.clone().negate(),
                        move.clone().add(right).normalize(),
                        move.clone().add(right.clone().negate()).normalize(),
                    ];
                    for (const sd of slideDirs) {
                        let clear = true;
                        const steps = 4;
                        for (let st = 1; st <= steps; st++) {
                            const s = sd.clone().multiplyScalar(speed2 * st / steps);
                            const sp = this.position.clone().add(s);
                            const sdir = sp.clone().normalize();
                            const sc = sdir.multiplyScalar(this.planet.getHeight(sdir) + this.radius);
                            if (blockedByObstacles(sc, this.plants, this.enemies, this.position, this.ship)) {
                                clear = false;
                                break;
                            }
                        }
                        if (clear) {
                            const s = sd.clone().multiplyScalar(speed2 * 0.9);
                            const sp = this.position.clone().add(s);
                            const sdir = sp.clone().normalize();
                            this.position.copy(sdir.multiplyScalar(this.planet.getHeight(sdir) + this.radius));
                            break;
                        }
                    }
                }
            }
        } else {
            const oldDir = this.position.clone().normalize();
            const oldDist = this.position.length();

            let moveDist = 0;
            if (hasMove) {
                moveDist = this.moveSpeed * 0.4 * dt;
            }

            const tangentMove = hasMove ? move.clone().multiplyScalar(moveDist) : new THREE.Vector3();
            const newPos = tangentMove.add(oldDir.clone().multiplyScalar(oldDist));
            newPos.add(oldDir.clone().multiplyScalar(this.jumpVel * dt));

            const newDir = newPos.clone().normalize();
            const newDist = newPos.length();
            const sh = this.planet.getHeight(newDir);
            const minDist = sh + this.radius;

            if (this.jumpVel <= 0 && newDist <= minDist) {
                this.position.copy(newDir.multiplyScalar(minDist));
                this.jumpVel = 0;
                this.grounded = true;
            } else {
                if (newDist < minDist) {
                    this.position.copy(newDir.multiplyScalar(minDist + 0.01));
                } else {
                    this.position.copy(newPos);
                }
            }
        }

        const camUp = this.position.clone().normalize();
        const camFwd0 = new THREE.Vector3(0, 0, -1).applyQuaternion(this.baseOrient);
        const camRight0 = new THREE.Vector3(1, 0, 0).applyQuaternion(this.baseOrient);
        const camFwd = camFwd0.clone().multiplyScalar(cosY).add(camRight0.clone().multiplyScalar(sinY));
        const lookDir = camFwd.multiplyScalar(Math.cos(this.pitch))
            .add(camUp.clone().multiplyScalar(Math.sin(this.pitch))).normalize();

        const eyePos = this.position.clone().add(camUp.multiplyScalar(this.eyeHeight));
        camera.position.copy(eyePos);
        camera.up.copy(camUp);
        camera.lookAt(eyePos.clone().add(lookDir));

        if (!this.weaponMesh.parent && camera) {
            camera.add(this.weaponMesh);
        }

        if (this.fireTimer > 0) this.fireTimer -= dt;
        if (this.reloading) {
            this.reloadTimer -= dt;
            if (this.reloadTimer <= 0) {
                this.ammo = this.weapon.stats.magSize;
                this.reloading = false;
                playReloadEnd(this.weapon.type.id);
            }
        }
        this.updateProjectiles(dt);
    }

    onMouseMove(dx, dy) {
        this.yaw += dx * 0.003;
        this.pitch -= dy * 0.003;
        this.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.pitch));
    }

    tryFire(camera) {
        if (!this.weapon || this.reloading || this.fireTimer > 0) return false;
        if (this.ammo <= 0) return false;
        const barrelLocal = this.weaponOffset.clone().add(new THREE.Vector3(0, 0, this.barrelDepth));
        const origin = barrelLocal.applyQuaternion(camera.quaternion).add(camera.position);
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const projs = fireProjectile(this.weapon, origin, dir, this.scene);
        this.projectiles.push(...projs);
        this.ammo--;
        this.fireTimer = this.weapon.stats.fireInterval;
        playGunshot(this.weapon.type.id, this.weapon.ammo.id);
        return true;
    }

    tryReload() {
        if (!this.weapon || this.reloading || this.ammo === this.weapon.stats.magSize) return;
        this.reloading = true;
        this.reloadTimer = this.weapon.stats.reloadTime;
        playReload(this.weapon.type.id, this.weapon.ammo.id, this.weapon.stats.reloadTime);
    }

    updateProjectiles(dt) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.lifetime -= dt;
            if (p.lifetime <= 0) {
                if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
                if (p.mesh.geometry) p.mesh.geometry.dispose();
                if (p.mesh.material) p.mesh.material.dispose();
                if (p.glow) { if (p.glow.parent) p.glow.parent.remove(p.glow); p.glow.material.dispose(); }
                this.projectiles.splice(i, 1);
                continue;
            }
            if (p.vel) {
                p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
            }
        }
    }

    takeDamage(dmg) {
        if (this.hp <= 0) return false;
        this.hp -= dmg;
        return this.hp <= 0;
    }
}
