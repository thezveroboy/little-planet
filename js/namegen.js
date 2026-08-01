const cons = ['b','c','d','f','g','h','j','k','l','m','n','p','r','s','t','v','w','x','z',
              'th','sh','ch','ph','gr','kr','br','tr','str','qu','kh','vh'];
const vows = ['a','e','i','o','u','ae','ee','oo','ai','ou','ia','io','ao','ea'];
const endings = ['ia','is','on','ar','os','an','in','us','or','ax','ix','ox','um','a','i','o','e'];

function mulberry32(a) {
    return function() {
        let t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

export function generatePlanetName(seed) {
    const rng = mulberry32(seed + 9999);
    const syl = 1 + Math.floor(rng() * 2);
    let name = '';
    for (let i = 0; i < syl; i++) {
        if (rng() > 0.25) name += cons[Math.floor(rng() * cons.length)];
        name += vows[Math.floor(rng() * vows.length)];
    }
    if (rng() > 0.4) name += cons[Math.floor(rng() * cons.length)];
    if (rng() > 0.5) name += endings[Math.floor(rng() * endings.length)];
    return name.charAt(0).toUpperCase() + name.slice(1);
}

const ENEMY_CODENAMES = [
    'Nova', 'Orion', 'Vega', 'Raptor', 'Phantom', 'Viper', 'Falcon', 'Titan',
    'Comet', 'Pulsar', 'Kestrel', 'Mantis', 'Onyx', 'Raven', 'Scorpio', 'Talon',
    'Wraith', 'Yukon', 'Zenith', 'Zephyr', 'Bastion', 'Cipher', 'Drake', 'Ember',
];

export function generateEnemyName(seed) {
    const rng = mulberry32(seed + 6666);
    const a = ENEMY_CODENAMES[rng() * ENEMY_CODENAMES.length | 0];
    const num = 1 + (rng() * 99 | 0);
    return `${a}-${num}`;
}

export function formatName(name) {
    return name.replace(/([sz])$/, '$z').replace(/x$/, 'x');
}
