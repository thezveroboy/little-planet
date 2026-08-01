let ctx = null;
let noiseBuf = null;

function getCtx() {
    if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
}

function getNoise(ac) {
    if (!noiseBuf) {
        noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
}

export function updateListener(cx, cy, cz, fx, fy, fz, ux, uy, uz) {
    const ac = getCtx();
    if (!ac || !ac.listener) return;
    try {
        ac.listener.positionX.value = cx;
        ac.listener.positionY.value = cy;
        ac.listener.positionZ.value = cz;
        ac.listener.forwardX.value = fx;
        ac.listener.forwardY.value = fy;
        ac.listener.forwardZ.value = fz;
        ac.listener.upX.value = ux;
        ac.listener.upY.value = uy;
        ac.listener.upZ.value = uz;
    } catch (e) {
        try {
            ac.listener.setPosition(cx, cy, cz);
            ac.listener.setOrientation(fx, fy, fz, ux, uy, uz);
        } catch (e2) { }
    }
}

function routePositional(ac, node, pos, ref, max) {
    const pan = ac.createPanner();
    try { pan.panningModel = 'HRTF'; } catch (e) { }
    pan.distanceModel = 'linear';
    pan.refDistance = ref;
    pan.maxDistance = max;
    pan.rolloffFactor = 1;
    try {
        pan.positionX.value = pos.x;
        pan.positionY.value = pos.y;
        pan.positionZ.value = pos.z;
    } catch (e) {
        pan.setPosition(pos.x, pos.y, pos.z);
    }
    node.connect(pan);
    pan.connect(ac.destination);
}

function connectOut(ac, node, pos, ref, max) {
    if (pos) routePositional(ac, node, pos, ref, max);
    else node.connect(ac.destination);
}

const SOUNDS = {
    pistol:   { gain: 0.55, filter: 2600, noiseDur: 0.09, bodyFreq: 170, bodyDur: 0.10, bodyGain: 0.7 },
    revolver: { gain: 0.70, filter: 1500, noiseDur: 0.16, bodyFreq: 105, bodyDur: 0.22, bodyGain: 1.1 },
    rifle:    { gain: 0.60, filter: 2200, noiseDur: 0.10, bodyFreq: 135, bodyDur: 0.13, bodyGain: 0.85 },
    assault:  { gain: 0.45, filter: 2400, noiseDur: 0.07, bodyFreq: 155, bodyDur: 0.08, bodyGain: 0.55 },
    smg:      { gain: 0.35, filter: 3000, noiseDur: 0.05, bodyFreq: 190, bodyDur: 0.05, bodyGain: 0.4 },
    shotgun:  { gain: 0.95, filter: 480,  noiseDur: 0.42, bodyFreq: 72,  bodyDur: 0.45, bodyGain: 1.7 },
    sniper:   { gain: 0.85, filter: 3200, noiseDur: 0.32, bodyFreq: 95,  bodyDur: 0.38, bodyGain: 1.2 },
    lmg:      { gain: 0.65, filter: 1200, noiseDur: 0.12, bodyFreq: 88,  bodyDur: 0.18, bodyGain: 1.0 },
};

export function playGunshot(type, ammoId, pos) {
    const ac = getCtx();
    if (!ac) return;
    const p = SOUNDS[type] || SOUNDS.pistol;
    const t = ac.currentTime;
    const vary = 1 + (Math.random() * 0.14 - 0.07);

    const master = ac.createGain();
    master.gain.value = 0.3;
    connectOut(ac, master, pos, 5, 135);

    const src = ac.createBufferSource();
    src.buffer = getNoise(ac);
    src.loop = true;
    const filt = ac.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = p.filter * vary;
    filt.Q.value = 0.7;
    const gN = ac.createGain();
    gN.gain.setValueAtTime(p.gain, t);
    gN.gain.exponentialRampToValueAtTime(0.001, t + p.noiseDur);
    src.connect(filt);
    filt.connect(gN);
    gN.connect(master);
    src.start(t);
    src.stop(t + p.noiseDur + 0.05);

    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(p.bodyFreq * vary, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, p.bodyFreq * 0.45), t + p.bodyDur);
    const gB = ac.createGain();
    gB.gain.setValueAtTime(p.bodyGain * 0.25, t);
    gB.gain.exponentialRampToValueAtTime(0.001, t + p.bodyDur);
    osc.connect(gB);
    gB.connect(master);
    osc.start(t);
    osc.stop(t + p.bodyDur + 0.05);

    if (type === 'shotgun') {
        const osc2 = ac.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(55 * vary, t);
        osc2.frequency.exponentialRampToValueAtTime(30, t + 0.35);
        const gB2 = ac.createGain();
        gB2.gain.setValueAtTime(0.25, t);
        gB2.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc2.connect(gB2);
        gB2.connect(master);
        osc2.start(t);
        osc2.stop(t + 0.4);
    }

    if (type === 'sniper') {
        const echo = ac.createBufferSource();
        echo.buffer = getNoise(ac);
        echo.loop = true;
        const eFilt = ac.createBiquadFilter();
        eFilt.type = 'bandpass';
        eFilt.frequency.value = 1800;
        eFilt.Q.value = 1.5;
        const gE = ac.createGain();
        gE.gain.setValueAtTime(0.0001, t);
        gE.gain.setValueAtTime(0.25, t + 0.22);
        gE.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
        echo.connect(eFilt);
        eFilt.connect(gE);
        gE.connect(master);
        echo.start(t);
        echo.stop(t + 0.6);
    }

    playAmmoSound(ac, master, ammoId, t);
}

const RELOAD_SEQUENCES = {
    pistol:   [ [0, 2400, 0.35], [0.1, 1900, 0.28] ],
    revolver: [ [0, 1500, 0.3], [0.07, 1400, 0.3], [0.14, 1300, 0.3], [0.21, 1200, 0.3], [0.28, 1100, 0.3], [0.35, 1000, 0.35] ],
    rifle:    [ [0, 2000, 0.32], [0.18, 2400, 0.38] ],
    assault:  [ [0, 2700, 0.28], [0.2, 2200, 0.24] ],
    smg:      [ [0, 3000, 0.22], [0.13, 2500, 0.18] ],
    shotgun:  [ [0, 950, 0.42], [0.24, 720, 0.5] ],
    sniper:   [ [0, 1800, 0.38], [0.22, 1600, 0.42] ],
    lmg:      [ [0, 850, 0.45], [0.32, 950, 0.32] ],
};

const RELOAD_END = {
    pistol:   { tickFreq: 2800, tickGain: 0.3, noteFreq: 520, noteGain: 0.14, noteDur: 0.08 },
    revolver: { tickFreq: 1400, tickGain: 0.35, noteFreq: 330, noteGain: 0.2, noteDur: 0.12 },
    rifle:    { tickFreq: 2400, tickGain: 0.32, noteFreq: 460, noteGain: 0.18, noteDur: 0.1 },
    assault:  { tickFreq: 3000, tickGain: 0.26, noteFreq: 560, noteGain: 0.14, noteDur: 0.07 },
    smg:      { tickFreq: 3400, tickGain: 0.22, noteFreq: 620, noteGain: 0.12, noteDur: 0.06 },
    shotgun:  { tickFreq: 800, tickGain: 0.4, noteFreq: 200, noteGain: 0.26, noteDur: 0.14 },
    sniper:   { tickFreq: 1100, tickGain: 0.42, noteFreq: 240, noteGain: 0.24, noteDur: 0.16 },
    lmg:      { tickFreq: 700, tickGain: 0.4, noteFreq: 180, noteGain: 0.24, noteDur: 0.14 },
};

export function playReloadEnd(type, pos) {
    const ac = getCtx();
    if (!ac) return;
    const now = ac.currentTime;
    const master = ac.createGain();
    master.gain.value = 0.3;
    connectOut(ac, master, pos, 5, 37.5);
    const p = RELOAD_END[type] || RELOAD_END.pistol;

    tick(ac, master, 0, p.tickFreq, p.tickGain);

    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(p.noteFreq, now);
    osc.frequency.exponentialRampToValueAtTime(p.noteFreq * 0.8, now + p.noteDur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.setValueAtTime(p.noteGain, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + p.noteDur);
    osc.connect(g);
    g.connect(master);
    osc.start(now);
    osc.stop(now + p.noteDur + 0.02);
}

export function playPickup(swap, pos) {
    const ac = getCtx();
    if (!ac) return;
    const now = ac.currentTime;
    const master = ac.createGain();
    master.gain.value = 0.3;
    connectOut(ac, master, pos, 5, 30);
    const base = swap ? 300 : 420;

    tick(ac, master, 0, 1800, 0.15);

    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.9, now + 0.14);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.setValueAtTime(0.22, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(g);
    g.connect(master);
    osc.start(now);
    osc.stop(now + 0.18);

    const osc2 = ac.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(base * 2, now + 0.05);
    osc2.frequency.exponentialRampToValueAtTime(base * 3.2, now + 0.15);
    const g2 = ac.createGain();
    g2.gain.setValueAtTime(0.0001, now + 0.05);
    g2.gain.setValueAtTime(0.12, now + 0.08);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc2.connect(g2);
    g2.connect(master);
    osc2.start(now + 0.05);
    osc2.stop(now + 0.24);
}

function repeatNote(ac, master, delay, e) {
    const t0 = ac.currentTime + delay;
    const src = ac.createBufferSource();
    src.buffer = getNoise(ac);
    src.loop = true;
    const filt = ac.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = e.tickFreq;
    filt.Q.value = 1.2;
    const g = ac.createGain();
    g.gain.setValueAtTime(e.tickGain * 0.45, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.04);
    src.connect(filt);
    filt.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + 0.06);

    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(e.noteFreq * 1.03, t0);
    osc.frequency.exponentialRampToValueAtTime(e.noteFreq * 0.85, t0 + 0.06);
    const g2 = ac.createGain();
    g2.gain.setValueAtTime(0.0001, t0);
    g2.gain.setValueAtTime(e.noteGain * 0.5, t0 + 0.01);
    g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.07);
    osc.connect(g2);
    g2.connect(master);
    osc.start(t0);
    osc.stop(t0 + 0.09);
}

export function playInvestigate(pos) {
    const ac = getCtx();
    if (!ac) return;
    const now = ac.currentTime;
    const master = ac.createGain();
    master.gain.value = 0.3;
    connectOut(ac, master, pos, 5, 135);

    tick(ac, master, 0, 900, 0.2);
    tick(ac, master, 0.15, 1100, 0.18);

    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(420, now + 0.4);
    osc.frequency.linearRampToValueAtTime(300, now + 0.6);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.setValueAtTime(0.16, now + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.62);
    osc.connect(g);
    g.connect(master);
    osc.start(now);
    osc.stop(now + 0.65);

    const c1 = ac.createOscillator();
    c1.type = 'sine';
    c1.frequency.setValueAtTime(660, now + 0.6);
    const g1 = ac.createGain();
    g1.gain.setValueAtTime(0.0001, now + 0.6);
    g1.gain.setValueAtTime(0.18, now + 0.63);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    c1.connect(g1);
    g1.connect(master);
    c1.start(now + 0.6);
    c1.stop(now + 0.82);

    const c2 = ac.createOscillator();
    c2.type = 'sine';
    c2.frequency.setValueAtTime(880, now + 0.8);
    const g2 = ac.createGain();
    g2.gain.setValueAtTime(0.0001, now + 0.8);
    g2.gain.setValueAtTime(0.18, now + 0.83);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 1.05);
    c2.connect(g2);
    g2.connect(master);
    c2.start(now + 0.8);
    c2.stop(now + 1.07);
}

function tick(ac, master, delay, freq, gain) {
    const t0 = ac.currentTime + delay;
    const src = ac.createBufferSource();
    src.buffer = getNoise(ac);
    src.loop = true;
    const filt = ac.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = freq;
    filt.Q.value = 1.2;
    const g = ac.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05);
    src.connect(filt);
    filt.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + 0.07);
}

export function playReload(type, ammoId, duration, pos) {
    const ac = getCtx();
    if (!ac) return;
    const now = ac.currentTime;
    const master = ac.createGain();
    master.gain.value = 0.3;
    connectOut(ac, master, pos, 5, 37.5);

    const seq = RELOAD_SEQUENCES[type] || RELOAD_SEQUENCES.pistol;
    for (const [delay, freq, gain] of seq) tick(ac, master, delay, freq, gain);

    const e = RELOAD_END[type] || RELOAD_END.pistol;
    const loopStart = 0.45;
    const loopInterval = 0.35;
    const loopEnd = Math.max(loopStart, duration - 0.2);
    for (let d = loopStart; d < loopEnd; d += loopInterval) {
        repeatNote(ac, master, d, e);
    }

    if (ammoId === 'laser') {
        const osc = ac.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(950, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.3);
        const g = ac.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.setValueAtTime(0.08, now + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        osc.connect(g);
        g.connect(master);
        osc.start(now);
        osc.stop(now + 0.35);
    } else if (ammoId === 'plasma') {
        const src = ac.createBufferSource();
        src.buffer = getNoise(ac);
        src.loop = true;
        const filt = ac.createBiquadFilter();
        filt.type = 'bandpass';
        filt.frequency.value = 260;
        filt.Q.value = 2;
        const g = ac.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.setValueAtTime(0.12, now + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        src.connect(filt);
        filt.connect(g);
        g.connect(master);
        src.start(now);
        src.stop(now + 0.3);
    } else if (ammoId === 'gauss') {
        const osc = ac.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(250, now);
        osc.frequency.exponentialRampToValueAtTime(650, now + 0.25);
        const g = ac.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.setValueAtTime(0.09, now + 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.27);
        osc.connect(g);
        g.connect(master);
        osc.start(now);
        osc.stop(now + 0.3);
    }
}

const PLANT_SOUNDS = {
    tree:    { filter: 450,  noiseDur: 0.30, noiseGain: 0.5,  bodyFreq: 130, bodyDur: 0.35, bodyGain: 0.4 },
    palm:    { filter: 600,  noiseDur: 0.28, noiseGain: 0.4,  bodyFreq: 110, bodyDur: 0.30, bodyGain: 0.3 },
    cactus:  { filter: 240,  noiseDur: 0.18, noiseGain: 0.55, bodyFreq: 160, bodyDur: 0.15, bodyGain: 0.35 },
    crystal: { filter: 2200, noiseDur: 0.45, noiseGain: 0.4,  shatter: true },
    fungus:  { filter: 500,  noiseDur: 0.22, noiseGain: 0.4,  bodyFreq: 90,  bodyDur: 0.30, bodyGain: 0.3 },
    shrub:   { filter: 900,  noiseDur: 0.16, noiseGain: 0.35, bodyFreq: 200, bodyDur: 0.10, bodyGain: 0.2 },
    spire:   { filter: 220,  noiseDur: 0.45, noiseGain: 0.6,  bodyFreq: 75,  bodyDur: 0.50, bodyGain: 0.55 },
};

export function playPlantHit(type, pos) {
    const ac = getCtx();
    if (!ac) return;
    const p = PLANT_SOUNDS[type] || PLANT_SOUNDS.shrub;
    const t = ac.currentTime;
    const vary = 1 + (Math.random() * 0.15 - 0.075);
    const master = ac.createGain();
    master.gain.value = 0.3;
    connectOut(ac, master, pos, 5, 52.5);

    const src = ac.createBufferSource();
    src.buffer = getNoise(ac);
    src.loop = true;
    const filt = ac.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = p.filter * vary;
    filt.Q.value = 0.8;
    const gN = ac.createGain();
    gN.gain.setValueAtTime(p.noiseGain * (0.85 + Math.random() * 0.3), t);
    gN.gain.exponentialRampToValueAtTime(0.001, t + p.noiseDur);
    src.connect(filt);
    filt.connect(gN);
    gN.connect(master);
    src.start(t);
    src.stop(t + p.noiseDur + 0.05);

    if (p.bodyFreq) {
        const osc = ac.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(p.bodyFreq * vary, t);
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, p.bodyFreq * 0.5), t + p.bodyDur);
        const gB = ac.createGain();
        gB.gain.setValueAtTime(p.bodyGain * 0.3, t);
        gB.gain.exponentialRampToValueAtTime(0.001, t + p.bodyDur);
        osc.connect(gB);
        gB.connect(master);
        osc.start(t);
        osc.stop(t + p.bodyDur + 0.05);
    }

    if (p.shatter) {
        for (let i = 0; i < 6; i++) {
            const freq = 1200 + Math.random() * 2600;
            const osc = ac.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t + 0.02);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.7, t + 0.18);
            const g = ac.createGain();
            g.gain.setValueAtTime(0.0001, t + 0.02);
            g.gain.setValueAtTime(0.14, t + 0.04);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
            osc.connect(g);
            g.connect(master);
            osc.start(t + 0.02);
            osc.stop(t + 0.22);
        }
    }
}

export function playEnemyHit(pos) {
    const ac = getCtx();
    if (!ac) return;
    const t = ac.currentTime;
    const master = ac.createGain();
    master.gain.value = 0.3;
    connectOut(ac, master, pos, 5, 60);

    const src = ac.createBufferSource();
    src.buffer = getNoise(ac);
    src.loop = true;
    const filt = ac.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 420;
    filt.Q.value = 1.2;
    const gN = ac.createGain();
    gN.gain.setValueAtTime(0.4, t);
    gN.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    src.connect(filt);
    filt.connect(gN);
    gN.connect(master);
    src.start(t);
    src.stop(t + 0.11);

    const ping = ac.createOscillator();
    ping.type = 'sine';
    ping.frequency.setValueAtTime(1900, t + 0.01);
    ping.frequency.exponentialRampToValueAtTime(1400, t + 0.07);
    const gP = ac.createGain();
    gP.gain.setValueAtTime(0.0001, t + 0.01);
    gP.gain.setValueAtTime(0.13, t + 0.02);
    gP.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    ping.connect(gP);
    gP.connect(master);
    ping.start(t + 0.01);
    ping.stop(t + 0.11);
}

export function playEnemyDeath(pos) {
    const ac = getCtx();
    if (!ac) return;
    const t = ac.currentTime;
    const master = ac.createGain();
    master.gain.value = 0.3;
    connectOut(ac, master, pos, 5, 90);

    const boom = ac.createBufferSource();
    boom.buffer = getNoise(ac);
    boom.loop = true;
    const bFilt = ac.createBiquadFilter();
    bFilt.type = 'lowpass';
    bFilt.frequency.setValueAtTime(500, t);
    bFilt.frequency.exponentialRampToValueAtTime(120, t + 0.7);
    const gB = ac.createGain();
    gB.gain.setValueAtTime(0.55, t);
    gB.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
    boom.connect(bFilt);
    bFilt.connect(gB);
    gB.connect(master);
    boom.start(t);
    boom.stop(t + 0.9);

    const wail = ac.createOscillator();
    wail.type = 'sawtooth';
    wail.frequency.setValueAtTime(300, t);
    wail.frequency.exponentialRampToValueAtTime(52, t + 0.85);
    const wFilt = ac.createBiquadFilter();
    wFilt.type = 'lowpass';
    wFilt.frequency.setValueAtTime(900, t);
    wFilt.frequency.exponentialRampToValueAtTime(200, t + 0.85);
    const gW = ac.createGain();
    gW.gain.setValueAtTime(0.0001, t);
    gW.gain.setValueAtTime(0.22, t + 0.08);
    gW.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    wail.connect(wFilt);
    wFilt.connect(gW);
    gW.connect(master);
    wail.start(t);
    wail.stop(t + 0.95);

    const hiss = ac.createBufferSource();
    hiss.buffer = getNoise(ac);
    hiss.loop = true;
    const hFilt = ac.createBiquadFilter();
    hFilt.type = 'highpass';
    hFilt.frequency.value = 2600;
    const gH = ac.createGain();
    gH.gain.setValueAtTime(0.0001, t);
    gH.gain.setValueAtTime(0.1, t + 0.15);
    gH.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    hiss.connect(hFilt);
    hFilt.connect(gH);
    gH.connect(master);
    hiss.start(t);
    hiss.stop(t + 0.6);

    const thud = ac.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(70, t + 0.12);
    thud.frequency.exponentialRampToValueAtTime(35, t + 0.3);
    const gT = ac.createGain();
    gT.gain.setValueAtTime(0.0001, t + 0.12);
    gT.gain.setValueAtTime(0.35, t + 0.15);
    gT.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    thud.connect(gT);
    gT.connect(master);
    thud.start(t + 0.12);
    thud.stop(t + 0.38);
}

function playAmmoSound(ac, master, ammoId, t) {    if (ammoId === 'laser') {
        const osc = ac.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1400, t);
        osc.frequency.exponentialRampToValueAtTime(280, t + 0.13);
        const g = ac.createGain();
        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        osc.connect(g);
        g.connect(master);
        osc.start(t);
        osc.stop(t + 0.16);
    } else if (ammoId === 'plasma') {
        const src = ac.createBufferSource();
        src.buffer = getNoise(ac);
        src.loop = true;
        const filt = ac.createBiquadFilter();
        filt.type = 'bandpass';
        filt.frequency.value = 340;
        filt.Q.value = 2.5;
        const g = ac.createGain();
        g.gain.setValueAtTime(0.22, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        src.connect(filt);
        filt.connect(g);
        g.connect(master);
        src.start(t);
        src.stop(t + 0.25);
        const osc = ac.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(58, t);
        osc.frequency.linearRampToValueAtTime(46, t + 0.18);
        const g2 = ac.createGain();
        g2.gain.setValueAtTime(0.16, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.connect(g2);
        g2.connect(master);
        osc.start(t);
        osc.stop(t + 0.22);
    } else if (ammoId === 'gauss') {
        const osc = ac.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(420, t);
        osc.frequency.exponentialRampToValueAtTime(1900, t + 0.07);
        const g = ac.createGain();
        g.gain.setValueAtTime(0.1, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
        osc.connect(g);
        g.connect(master);
        osc.start(t);
        osc.stop(t + 0.11);
        const src = ac.createBufferSource();
        src.buffer = getNoise(ac);
        src.loop = true;
        const filt = ac.createBiquadFilter();
        filt.type = 'highpass';
        filt.frequency.value = 3200;
        const g2 = ac.createGain();
        g2.gain.setValueAtTime(0.1, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        src.connect(filt);
        filt.connect(g2);
        g2.connect(master);
        src.start(t);
        src.stop(t + 0.08);
    }
}
