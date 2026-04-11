const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCKncbm9S_CfPaDDAzPKbtQ3b_spRPrMPc",
    authDomain: "test-online-game-2dde0.firebaseapp.com",
    databaseURL: "https://test-online-game-2dde0-default-rtdb.firebaseio.com",
    projectId: "test-online-game-2dde0",
    storageBucket: "test-online-game-2dde0.firebasestorage.app",
    messagingSenderId: "1081301043639",
    appId: "1:1081301043639:web:fb8de8e59e6392fbfc4032",
    measurementId: "G-SHTHV4PX53"
};

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

if (isMobile) {
    document.getElementById('mobile-warning').classList.add('active');
    throw new Error('Mobile not supported yet');
}

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
    getDatabase,
    ref,
    set,
    update,
    onValue,
    onDisconnect,
    remove,
    push,
    get,
    onChildAdded
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

let app, db, auth;
try {
    app = initializeApp(FIREBASE_CONFIG);
    db = getDatabase(app);
    auth = getAuth(app);
    console.log('Firebase инициализирован');
} catch (e) {
    console.error('Ошибка Firebase:', e);
    setStatus('❌ Ошибка Firebase. Проверь консоль.');
}

let currentUserId = null;
let authReady = false;

let scene, camera, renderer, controls;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let canJump = false;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let playerHeight = 1.7;
let playerRadius = 0.4;
let bodyOffset = 0.85;
let players = {};
let myId = 'player_' + Math.random().toString(36).substr(2, 9);
let myRoomId = null;
let myHP = 100;
let myMaxHP = 100;
let isDead = false;
let respawnTimer = null;
let killCount = 0;
let deathCount = 0;
let ping = 0;
let inGame = false;
let myNickname = 'Player';
let bullets = [];
let colliders = [];
let lastTime = performance.now();
let playerRef = null;
let playersListener = null;
let pingRef = null;
let lastPingSend = 0;
let roomSeed = 0;
let textureCache = {};
let hpBarContainer = null;
let hpBarOuter = null;
let hpBarInner = null;
let hpText = null;
let killDeathDisplay = null;
let pingDisplay = null;
let ammoDisplay = null;

let myAmmo = 15;
let myMaxAmmo = 15;
let isReloading = false;
let weaponModel = null;
let isFiring = false;
let fireRate = 65;
let lastFireTime = 0;
let lastHealTime = 0;
let muzzleFlash = null;
let muzzleFlashLight = null;
let hitParticles = [];

let audioCtx = null;
let masterVolume = 0.5;
let mouseSensitivity = 1.0;

function loadSettings() {
    const savedVol = localStorage.getItem('fps_volume');
    if (savedVol !== null) masterVolume = parseFloat(savedVol);

    const savedSens = localStorage.getItem('fps_sens');
    if (savedSens !== null) mouseSensitivity = parseFloat(savedSens);

    const volSlider = document.getElementById('volume-slider');
    if (volSlider) {
        volSlider.value = Math.round(masterVolume * 100);
        document.getElementById('volume-value').textContent = Math.round(masterVolume * 100);
    }

    const sensSlider = document.getElementById('sens-slider');
    if (sensSlider) {
        sensSlider.value = Math.round(mouseSensitivity * 10);
        document.getElementById('sens-value').textContent = mouseSensitivity.toFixed(1);
    }
}

function saveSettings() {
    localStorage.setItem('fps_volume', String(masterVolume));
    localStorage.setItem('fps_sens', String(mouseSensitivity));
}

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playShootSound() {
    if (!audioCtx) return;

    const now = audioCtx.currentTime;


    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);
    gain.gain.setValueAtTime(0.4 * masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.15);


    const bufferSize = audioCtx.sampleRate * 0.1;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(2000, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(300, now + 0.1);

    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.3 * masterVolume, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);
    noise.start(now);
}

function playHitSound() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
    gain.gain.setValueAtTime(0.15 * masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
}

function playReloadSound() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.setValueAtTime(600, now + 0.1);
    osc.frequency.setValueAtTime(800, now + 0.2);
    gain.gain.setValueAtTime(0.1 * masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
}

function playDamageSound() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);
    gain.gain.setValueAtTime(0.2 * masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
}

let selectedCardId = null;
let myCards = [];
let inventoryOpen = false;
let killsForCase = 0;
let killsForCaseThreshold = 10;

let botKillCount = 0;
let botKillsForCase = 0;
let botKillsForCaseThreshold = 20;

let isAdmin = false;
let wallhackEnabled = false;
let wallhackCooldown = false;
let outlineMeshes = [];

let bots = [];
let botBullets = [];
let botSpawnTimer = 0;
let botsEnabled = false;
let hasSeenOtherPlayer = false;

const CARD_DEFS = {
    niviesino: {
        id: 'niviesino',
        name: 'Niviesino?',
        rarity: 'common',
        color: '#888888',
        desc: 'Начальная карточка. Без эффектов.',
        buffs: {}
    },
    gav: {
        id: 'gav',
        name: 'GAV',
        rarity: 'rare',
        color: '#4488ff',
        desc: '+5 урон, +5 патроны, -10 HP',
        buffs: { damageBonus: 5, ammoBonus: 5, hpBonus: -10 }
    },
    ziyn: {
        id: 'ziyn',
        name: 'Зiйн Зiйнович',
        rarity: 'rare',
        color: '#4488ff',
        desc: '+5 прыжок, -3 скорость, +5 урон',
        buffs: { jumpBonus: 5, speedBonus: -3, damageBonus: 5 }
    },
    fills: {
        id: 'fills',
        name: 'FILLS',
        rarity: 'legendary',
        color: '#ffaa00',
        desc: '+10 урон, +50 патроны, -5 скорость, +11 HP',
        buffs: { damageBonus: 10, ammoBonus: 50, speedBonus: -5, hpBonus: 11 }
    },
    admin: {
        id: 'admin',
        name: 'ADMIN',
        rarity: 'admin',
        color: '#aa44ff',
        desc: 'Админ-карточка. P — Wallhack. +67 HP, +11 урон, +52 патроны',
        buffs: { hpBonus: 67, damageBonus: 11, ammoBonus: 52 }
    }
};

async function loadCards() {
    if (!currentUserId) return;

    try {
        const snap = await get(ref(db, 'users/' + currentUserId + '/cards'));
        if (snap.exists()) {
            myCards = snap.val();
        }
    } catch(e) {}

    const hasNiviesino = myCards.some(c => c.cardId === 'niviesino');
    if (!hasNiviesino) {
        myCards.push({ cardId: 'niviesino', owned: true });
    }

    try {
        const selSnap = await get(ref(db, 'users/' + currentUserId + '/selectedCard'));
        selectedCardId = selSnap.exists() ? selSnap.val() : 'niviesino';
    } catch(e) {
        selectedCardId = 'niviesino';
    }

    try {
        const nickSnap = await get(ref(db, 'users/' + currentUserId + '/nickname'));
        if (nickSnap.exists()) {
            myNickname = nickSnap.val();
            const nickInput = document.getElementById('nickname-input');
            if (nickInput) nickInput.value = myNickname;
        }
    } catch(e) {}

    try {
        const adminSnap = await get(ref(db, 'users/' + currentUserId + '/isAdmin'));
        if (adminSnap.exists() && adminSnap.val() === true) {
            const hasAdmin = myCards.some(c => c.cardId === 'admin');
            if (!hasAdmin) {
                myCards.push({ cardId: 'admin', owned: true });
                saveCards();
            }
        }
    } catch(e) {}

    try {
        const caseSnap = await get(ref(db, 'users/' + currentUserId + '/cases'));
        const caseCount = caseSnap.exists() ? caseSnap.val() : 0;
        localStorage.setItem('fps_cases', String(caseCount));
    } catch(e) {}

    try {
        const statsSnap = await get(ref(db, 'users/' + currentUserId + '/stats'));
        if (statsSnap.exists()) {
            const stats = statsSnap.val();
            killsForCase = stats.killsForCase || 0;
            botKillsForCase = stats.botKillsForCase || 0;
        }
    } catch(e) {}
}

async function saveCards() {
    if (!currentUserId) return;

    await set(ref(db, 'users/' + currentUserId + '/cards'), myCards);
    await set(ref(db, 'users/' + currentUserId + '/selectedCard'), selectedCardId);

    const caseCount = parseInt(localStorage.getItem('fps_cases') || '0');
    await set(ref(db, 'users/' + currentUserId + '/cases'), caseCount);
}

async function saveCaseCount() {
    if (!currentUserId) return;
    const caseCount = parseInt(localStorage.getItem('fps_cases') || '0');
    await set(ref(db, 'users/' + currentUserId + '/cases'), caseCount);
}

function applyCardBuffs() {
    const card = CARD_DEFS[selectedCardId] || CARD_DEFS['niviesino'];
    const buffs = card.buffs || {};

    isAdmin = (card.id === 'admin');

    myMaxHP = 100 + (buffs.hpBonus || 0);
    myHP = myMaxHP;
    myMaxAmmo = 15 + (buffs.ammoBonus || 0);
    myAmmo = myMaxAmmo;
    mySpeedMult = 1;
    myDamageBonus = buffs.damageBonus || 0;
    myFireRateMult = 1;
    myJumpBonus = buffs.jumpBonus || 0;
    mySpeedBonus = buffs.speedBonus || 0;
}

let mySpeedMult = 1;
let myDamageBonus = 0;
let myFireRateMult = 1;
let myJumpBonus = 0;
let mySpeedBonus = 0;

function setStatus(msg) {
    document.getElementById('status-msg').innerHTML = msg;
}

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function renderInventory() {
    const caseCount = parseInt(localStorage.getItem('fps_cases') || '0');
    document.getElementById('case-count').textContent = caseCount;
    document.getElementById('kills-to-case').textContent = `Игроки: ${killsForCase}/${killsForCaseThreshold} | Боты: ${botKillsForCase}/${botKillsForCaseThreshold}`;
    document.getElementById('open-case-btn').disabled = caseCount <= 0;
    document.getElementById('open-case-btn').style.opacity = caseCount <= 0 ? '0.5' : '1';

    const container = document.getElementById('cards-container');
    container.innerHTML = '';

    for (const entry of myCards) {
        const def = CARD_DEFS[entry.cardId];
        if (!def) continue;

        const isSelected = entry.cardId === selectedCardId;
        const rarityColor = def.rarity === 'admin' ? '#aa44ff' : def.color;
        const card = document.createElement('div');
        card.style.cssText = `
            background: rgba(255,255,255,0.05);
            border: 2px ${isSelected ? 'solid' : 'dashed'} ${rarityColor};
            border-radius: 10px;
            padding: 15px;
            cursor: pointer;
            transition: all 0.2s;
        `;
        const rarityLabel = def.rarity === 'admin' ? 'ADMIN' : def.rarity.toUpperCase();
        card.innerHTML = `
            <div style="color: ${rarityColor}; font-weight: bold; font-size: 16px; margin-bottom: 5px;">${def.name}</div>
            <div style="color: ${rarityColor}; font-size: 11px; margin-bottom: 8px;">${rarityLabel}</div>
            <div style="font-size: 12px; opacity: 0.7; line-height: 1.4;">${def.desc}</div>
            ${isSelected ? '<div style="margin-top: 8px; color: #00ff00; font-size: 12px;">✓ Выбрана</div>' : ''}
        `;
        card.addEventListener('click', () => {
            selectedCardId = entry.cardId;
            saveCards();
            updateCardDisplay();
            renderInventory();
        });
        container.appendChild(card);
    }
}

async function openCase() {
    const caseCount = parseInt(localStorage.getItem('fps_cases') || '0');
    if (caseCount <= 0) return;

    localStorage.setItem('fps_cases', String(caseCount - 1));
    await saveCaseCount();

    const roll = Math.random();
    let cardId;
    if (roll < 0.001) cardId = 'fills';
    else if (roll < 0.35) cardId = 'gav';
    else cardId = 'ziyn';

    const existing = myCards.find(c => c.cardId === cardId);
    if (!existing) {
        myCards.push({ cardId: cardId, owned: true });
        await saveCards();
    }

    renderInventory();
    updateCardDisplay();

    const def = CARD_DEFS[cardId];
    alert(`🎉 Выпала карточка: ${def.name} (${def.rarity})`);
}

function updateCardDisplay() {
    const def = CARD_DEFS[selectedCardId] || CARD_DEFS['niviesino'];
    document.getElementById('current-card-name').textContent = def.name;
    document.getElementById('current-card-name').style.color = def.color;
}

function showToast(msg) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: #0f9b58;
        color: #fff;
        padding: 15px 30px;
        border-radius: 8px;
        font-size: 18px;
        font-weight: bold;
        z-index: 1000;
        box-shadow: 0 4px 15px rgba(0,0,0,0.5);
        animation: toastAnim 3s forwards;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);

    if (!document.getElementById('toast-style')) {
        const style = document.createElement('style');
        style.id = 'toast-style';
        style.textContent = `
            @keyframes toastAnim {
                0% { opacity: 0; transform: translateX(-50%) translateY(20px); }
                10% { opacity: 1; transform: translateX(-50%) translateY(0); }
                80% { opacity: 1; transform: translateX(-50%) translateY(0); }
                100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
            }
        `;
        document.head.appendChild(style);
    }

    setTimeout(() => {
        if (toast.parentNode) toast.remove();
    }, 3000);
}

function updateCaseUI() {
    const el = document.getElementById('kills-to-case');
    if (el) {
        el.textContent = `Игроки: ${killsForCase}/${killsForCaseThreshold} | Боты: ${botKillsForCase}/${botKillsForCaseThreshold}`;
    }
}

async function saveKillsToDB() {
    if (!currentUserId) return;
    try {
        await update(ref(db, 'users/' + currentUserId + '/stats'), {
            killsForCase: killsForCase,
            botKillsForCase: botKillsForCase,
            totalKills: killsForCase + botKillsForCase
        });
    } catch(e) {}
}

let lastStatsSave = 0;
function periodicSaveStats() {
    const now = Date.now();
    if (currentUserId && now - lastStatsSave > 5000) {
        lastStatsSave = now;
        saveKillsToDB();
    }
}

function checkCaseReward() {

    if (killsForCase >= killsForCaseThreshold) {
        killsForCase = 0;
        updateCaseUI();
        saveKillsToDB();
        const caseCount = parseInt(localStorage.getItem('fps_cases') || '0');
        localStorage.setItem('fps_cases', String(caseCount + 1));
        showToast("📦 Получен кейс (Игроки)!");
        if (currentUserId) {
            set(ref(db, 'users/' + currentUserId + '/cases'), caseCount + 1);
        }
    }


    if (botKillsForCase >= botKillsForCaseThreshold) {
        botKillsForCase = 0;
        updateCaseUI();
        saveKillsToDB();
        const caseCount = parseInt(localStorage.getItem('fps_cases') || '0');
        localStorage.setItem('fps_cases', String(caseCount + 1));
        showToast("📦 Получен кейс (Боты)!");
        if (currentUserId) {
            set(ref(db, 'users/' + currentUserId + '/cases'), caseCount + 1);
        }
    }
}

function createOutlineMeshes() {
    if (!scene) return;
    clearOutlineMeshes();


    for (const bot of bots) {
        if (bot.mesh && bot.hp > 0) {
            const outlineGeo = new THREE.CapsuleGeometry(0.4, 1.2, 4, 8);
            const outlineMat = new THREE.MeshBasicMaterial({
                color: 0xff0000,
                transparent: true,
                opacity: 0.25,
                side: THREE.BackSide,
                depthTest: false
            });
            const outline = new THREE.Mesh(outlineGeo, outlineMat);
            outline.position.copy(bot.mesh.position);
            outline.renderOrder = 999;
            scene.add(outline);
            outlineMeshes.push({ mesh: outline, target: bot.mesh, offset: new THREE.Vector3() });
        }
    }


    for (const id in players) {
        if (id !== myId && players[id] && players[id].mesh) {
            const outlineGeo = new THREE.CapsuleGeometry(0.4, 1.2, 4, 8);
            const outlineMat = new THREE.MeshBasicMaterial({
                color: 0x00ff00,
                transparent: true,
                opacity: 0.25,
                side: THREE.BackSide,
                depthTest: false
            });
            const outline = new THREE.Mesh(outlineGeo, outlineMat);
            outline.position.copy(players[id].mesh.position);
            outline.renderOrder = 999;
            scene.add(outline);
            outlineMeshes.push({ mesh: outline, target: players[id].mesh, offset: new THREE.Vector3() });
        }
    }
}

function clearOutlineMeshes() {
    if (!scene || !Array.isArray(outlineMeshes)) return;
    for (const o of outlineMeshes) {
        scene.remove(o.mesh);
        o.mesh.geometry.dispose();
        o.mesh.material.dispose();
    }
    outlineMeshes = [];
}

function updateOutlineMeshes() {
    if (!wallhackEnabled || !scene || !Array.isArray(outlineMeshes) || outlineMeshes.length === 0) return;
    for (const o of outlineMeshes) {
        if (o.target && o.target.position) {
            o.mesh.position.copy(o.target.position).add(o.offset);
        }
    }
}

function findSafeSpawnPoint(rng) {
    for (let attempt = 0; attempt < 20; attempt++) {
        const x = (rng() - 0.5) * 60;
        const z = (rng() - 0.5) * 60;

        let safe = true;
        for (const collider of colliders) {
            if (x > collider.min.x - 1 && x < collider.max.x + 1 &&
                z > collider.min.z - 1 && z < collider.max.z + 1) {
                safe = false;
                break;
            }
        }

        if (safe) return { x, z };
    }
    return { x: 0, z: 0 };
}

function spawnBot(x, z) {
    if (!scene) return;

    const botId = 'bot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    const geometry = new THREE.CapsuleGeometry(0.3, 1, 4, 8);
    const material = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.5, metalness: 0.3 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, playerHeight, z);
    mesh.castShadow = true;
    scene.add(mesh);

    bots.push({
        id: botId,
        mesh: mesh,
        hp: 100,
        maxHp: 100,
        position: new THREE.Vector3(x, playerHeight, z),
        lastShot: 0,
        moveTarget: new THREE.Vector3((Math.random() - 0.5) * 40, playerHeight, (Math.random() - 0.5) * 40),
        respawnTime: 0
    });
}

function updateBots(delta, time) {
    if (!botsEnabled) return;

    for (const bot of bots) {

        if (bot.hp <= 0) {
            if (time - bot.respawnTime > 5000) {
                const spawn = findSafeSpawnPoint(Math.random);
                bot.hp = bot.maxHp;
                bot.position.set(spawn.x, playerHeight, spawn.z);
                bot.mesh.position.copy(bot.position);
                bot.mesh.visible = true;
                bot.lastShot = 0;
            }
            continue;
        }


        const dx = camera.position.x - bot.position.x;
        const dz = camera.position.z - bot.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        let moveX = 0, moveZ = 0;
        if (dist > 5) {
            const speed = 3;
            moveX = (dx / dist) * speed * delta;
            moveZ = (dz / dist) * speed * delta;
        } else if (dist < 3) {
            moveX = -(dx / dist) * 2 * delta;
            moveZ = -(dz / dist) * 2 * delta;
        }


        const newX = bot.position.x + moveX;
        const newZ = bot.position.z + moveZ;

        let canMoveX = true, canMoveZ = true;
        for (const collider of colliders) {
            if (newX > collider.min.x - 0.5 && newX < collider.max.x + 0.5 &&
                bot.position.z > collider.min.z - 0.5 && bot.position.z < collider.max.z + 0.5) {
                canMoveX = false;
            }
            if (newZ > collider.min.z - 0.5 && newZ < collider.max.z + 0.5 &&
                bot.position.x > collider.min.x - 0.5 && bot.position.x < collider.max.x + 0.5) {
                canMoveZ = false;
            }
        }

        if (canMoveX) bot.position.x = newX;
        if (canMoveZ) bot.position.z = newZ;

        bot.position.x = Math.max(-48, Math.min(48, bot.position.x));
        bot.position.z = Math.max(-48, Math.min(48, bot.position.z));
        bot.mesh.position.copy(bot.position);
        bot.mesh.rotation.y = Math.atan2(dx, dz);


        if (time - bot.lastShot > 200 && dist < 40 && checkLineOfSight(bot.position, camera.position)) {
            bot.lastShot = time;
            fireBotBullet(bot);
        }
    }
}

function checkLineOfSight(fromPos, toPos) {
    const dx = toPos.x - fromPos.x;
    const dy = toPos.y - fromPos.y;
    const dz = toPos.z - fromPos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const steps = Math.ceil(dist / 2);
    const stepX = dx / steps;
    const stepY = dy / steps;
    const stepZ = dz / steps;

    let cx = fromPos.x, cy = fromPos.y, cz = fromPos.z;
    for (let i = 0; i < steps; i++) {
        cx += stepX;
        cy += stepY;
        cz += stepZ;
        if (checkCollision({ x: cx, y: cy, z: cz }, 0.5)) {
            return false;
        }
    }
    return true;
}
function fireBotBullet(bot) {
    const direction = new THREE.Vector3();
    direction.subVectors(camera.position, bot.position).normalize();


    direction.x += (Math.random() - 0.5) * 0.15;
    direction.y += (Math.random() - 0.5) * 0.1;
    direction.z += (Math.random() - 0.5) * 0.15;
    direction.normalize();

    const bulletGeo = new THREE.SphereGeometry(0.08, 6, 6);
    const bulletMat = new THREE.MeshBasicMaterial({ color: 0xff4444 });
    const bullet = new THREE.Mesh(bulletGeo, bulletMat);
    bullet.position.copy(bot.position);
    bullet.userData.velocity = direction.multiplyScalar(30);
    bullet.userData.life = 3;
    bullet.userData.botId = bot.id;
    scene.add(bullet);
    botBullets.push(bullet);
}

function updateBotBullets(delta) {
    for (let i = botBullets.length - 1; i >= 0; i--) {
        const bullet = botBullets[i];
        bullet.userData.life -= delta;

        if (bullet.userData.life <= 0) {
            scene.remove(bullet);
            bullet.geometry.dispose();
            bullet.material.dispose();
            botBullets.splice(i, 1);
            continue;
        }

        bullet.position.add(bullet.userData.velocity.clone().multiplyScalar(delta));


        const dx = bullet.position.x - camera.position.x;
        const dy = bullet.position.y - camera.position.y;
        const dz = bullet.position.z - camera.position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < 1) {
            takeDamage(10, bullet.userData.botId);
            scene.remove(bullet);
            bullet.geometry.dispose();
            bullet.material.dispose();
            botBullets.splice(i, 1);
        }
    }
}

function checkPlayerBulletsOnBots() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];

        for (const bot of bots) {
            if (bot.hp <= 0) continue;

            const dx = bullet.position.x - bot.position.x;
            const dy = bullet.position.y - (bot.position.y + 0.5);
            const dz = bullet.position.z - bot.position.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (dist < 0.8) {
                bot.hp -= (15 + myDamageBonus);
                scene.remove(bullet);
                bullet.geometry.dispose();
                bullet.material.dispose();
                bullets.splice(i, 1);

                spawnHitParticles(bullet.position, 0xff0000);
                initAudio();
                playHitSound();

                if (bot.hp <= 0) {
                    bot.hp = 0;
                    bot.mesh.visible = false;
                    bot.respawnTime = performance.now();
                    botKillCount++;
                    botKillsForCase++;
                    updateCaseUI();
                    showToast(`🤖 Бот убит! (${botKillsForCase}/${botKillsForCaseThreshold})`);
                    checkCaseReward();
                }
                break;
            }
        }
    }
}

function countAliveBots() {
    return bots.filter(b => b.hp > 0).length;
}

function updatePlayerCount() {
    const humanPlayers = Object.keys(players).length;
    document.getElementById('player-count').textContent = humanPlayers;
}

let roomListenerActive = false;

function startRoomListener() {
    if (roomListenerActive) return;
    roomListenerActive = true;

    onValue(ref(db, 'public_rooms'), (snapshot) => {
        const rooms = snapshot.val() || {};
        renderRoomList(rooms);
    }, { onlyOnce: false });
}

function renderRoomList(rooms) {
    const container = document.getElementById('room-list');
    if (!container) return;

    const roomKeys = Object.keys(rooms);
    if (roomKeys.length === 0) {
        container.innerHTML = '<div style="opacity: 0.5; padding: 15px;">Нет активных комнат</div>';
        return;
    }

    container.innerHTML = '';
    for (const code of roomKeys) {
        const room = rooms[code];
        const div = document.createElement('div');
        div.style.cssText = `
            padding: 10px 15px;
            background: rgba(255,255,255,0.05);
            border-radius: 8px;
            margin: 5px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        div.innerHTML = `
            <div style="text-align: left;">
                <div style="color: #e94560; font-weight: bold; font-size: 16px;">${code}</div>
                <div style="font-size: 12px; opacity: 0.6;">Хост: ${room.host || 'Unknown'}</div>
            </div>
            <button class="join-room-btn" data-code="${code}" style="
                padding: 8px 20px;
                background: #0f9b58;
                border: none;
                border-radius: 5px;
                color: #fff;
                cursor: pointer;
                font-size: 14px;
            ">Войти</button>
        `;
        container.appendChild(div);
    }

    document.querySelectorAll('.join-room-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const code = btn.getAttribute('data-code');
            joinRoom(code);
        });
    });
}

async function authLogin(email, password) {
    setStatus('<span class="loading"></span> Входим...');
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch(e) {
        setStatus('❌ ' + (e.message || 'Ошибка входа'));
    }
}

async function authRegister(email, password) {
    setStatus('<span class="loading"></span> Регистрируем...');
    try {
        await createUserWithEmailAndPassword(auth, email, password);
        setStatus('✅ Регистрация прошла успешно!');
    } catch(e) {
        setStatus('❌ ' + (e.message || 'Ошибка регистрации'));
    }
}

async function authLogout() {
    await signOut(auth);
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserId = user.uid;
        authReady = true;
        await loadCards();
        updateCardDisplay();
        startRoomListener();


        const isAdminUser = myCards.some(c => c.cardId === 'admin');
        const adminBtn = document.getElementById('admin-grant-btn');
        if (adminBtn) {
            adminBtn.style.display = isAdminUser ? 'inline-block' : 'none';
        }
        document.getElementById('auth-section').innerHTML = `
            <div style="color: #00ff00; font-size: 14px;">✓ ${user.email}</div>
            <button id="logout-btn" style="
                margin-top: 5px;
                padding: 5px 15px;
                background: #555;
                border: none;
                border-radius: 5px;
                color: #fff;
                cursor: pointer;
                font-size: 12px;
            ">Выйти</button>
        `;
        document.getElementById('logout-btn').addEventListener('click', authLogout);
        document.getElementById('game-buttons').style.display = 'block';
    } else {
        currentUserId = null;
        authReady = false;
        myCards = [];
        document.getElementById('auth-section').innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 8px; align-items: center;">
                <input type="email" id="auth-email" placeholder="Email">
                <input type="password" id="auth-pass" placeholder="Пароль">
                <div style="display: flex; gap: 10px;">
                    <button id="login-btn">Войти</button>
                    <button id="register-btn">Регистрация</button>
                </div>
            </div>
        `;
        document.getElementById('login-btn').addEventListener('click', () => {
            const email = document.getElementById('auth-email').value.trim();
            const pass = document.getElementById('auth-pass').value;
            if (email && pass) authLogin(email, pass);
        });
        document.getElementById('register-btn').addEventListener('click', () => {
            const email = document.getElementById('auth-email').value.trim();
            const pass = document.getElementById('auth-pass').value;
            if (email && pass) authRegister(email, pass);
        });
        document.getElementById('game-buttons').style.display = 'none';
    }
});

function createHPBar() {
    hpBarContainer = document.createElement('div');
    hpBarContainer.style.cssText = `
        position: fixed;
        bottom: 60px;
        left: 20px;
        z-index: 100;
        display: flex;
        flex-direction: column;
        gap: 5px;
    `;

    hpBarOuter = document.createElement('div');
    hpBarOuter.style.cssText = `
        width: 200px;
        height: 20px;
        background: rgba(0,0,0,0.6);
        border-radius: 10px;
        overflow: hidden;
        border: 2px solid rgba(255,255,255,0.3);
    `;

    hpBarInner = document.createElement('div');
    hpBarInner.style.cssText = `
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, #00ff00, #00cc00);
        transition: width 0.2s, background 0.2s;
        border-radius: 8px;
    `;

    hpText = document.createElement('div');
    hpText.style.cssText = `
        color: #fff;
        font-size: 12px;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
        text-align: center;
    `;

    hpBarOuter.appendChild(hpBarInner);
    hpBarContainer.appendChild(hpBarOuter);
    hpBarContainer.appendChild(hpText);

    killDeathDisplay = document.createElement('div');
    killDeathDisplay.style.cssText = `
        color: #fff;
        font-size: 14px;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
    `;
    hpBarContainer.appendChild(killDeathDisplay);

    const pingDisplay = document.createElement('div');
    pingDisplay.id = 'ping-display';
    pingDisplay.style.cssText = `
        color: #fff;
        font-size: 12px;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
        margin-top: 3px;
    `;
    hpBarContainer.appendChild(pingDisplay);

    document.body.appendChild(hpBarContainer);
}

function updateHPBar() {
    if (!hpBarInner || !hpText) return;

    const hpPercent = (myHP / myMaxHP) * 100;
    hpBarInner.style.width = hpPercent + '%';

    if (hpPercent > 60) {
        hpBarInner.style.background = 'linear-gradient(90deg, #00ff00, #00cc00)';
    } else if (hpPercent > 30) {
        hpBarInner.style.background = 'linear-gradient(90deg, #ffaa00, #ff8800)';
    } else {
        hpBarInner.style.background = 'linear-gradient(90deg, #ff0000, #cc0000)';
    }

    hpText.textContent = Math.ceil(myHP) + ' / ' + myMaxHP;

    if (killDeathDisplay) {
        killDeathDisplay.textContent = 'Убийства: ' + killCount + ' | Смерти: ' + deathCount;
    }

    const pingEl = document.getElementById('ping-display');
    if (pingEl) {
        let pingColor = '#00ff00';
        if (ping > 200) pingColor = '#ff4444';
        else if (ping > 100) pingColor = '#ffaa00';
        pingEl.textContent = 'Пинг: ' + ping + ' мс | FPS: ' + fps;
        pingEl.style.color = pingColor;
    }
}

function takeDamage(amount, attackerId) {
    if (isDead) return;

    myHP -= amount;
    updateHPBar();
    initAudio();
    playDamageSound();

    document.getElementById('game-container').style.boxShadow = 'inset 0 0 50px rgba(255,0,0,0.5)';
    setTimeout(() => {
        document.getElementById('game-container').style.boxShadow = 'none';
    }, 200);

    if (myHP <= 0) {
        myHP = 0;
        updateHPBar();
        die(attackerId);
    }
}

function die(killerId) {
    if (isDead) return;
    isDead = true;
    deathCount++;
    updateHPBar();

    if (myRoomId && killerId) {
        const deathRef = push(ref(db, 'rooms/' + myRoomId + '/deaths'));
        set(deathRef, {
            victimId: myId,
            shooterId: killerId,
            timestamp: Date.now()
        });
    }

    setStatus('💀 Ты убит! Респавн через 3...');

    if (playerRef) {
        remove(playerRef);
    }

    controls.unlock();

    const deathMsg = document.createElement('div');
    deathMsg.id = 'death-msg';
    deathMsg.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: #ff0000;
        font-size: 48px;
        font-weight: bold;
        text-shadow: 0 0 20px rgba(255,0,0,0.8);
        z-index: 300;
    `;
    deathMsg.textContent = 'ВЫ УБИТЫ';
    document.body.appendChild(deathMsg);

    setTimeout(() => {
        if (deathMsg.parentNode) {
            deathMsg.parentNode.removeChild(deathMsg);
        }
        respawn();
    }, 3000);
}

function respawn() {
    isDead = false;
    myHP = myMaxHP;
    myAmmo = myMaxAmmo;
    isReloading = false;
    updateHPBar();
    updateAmmoDisplay();

    const spawn = findSafeSpawnPoint(Math.random);
    camera.position.set(spawn.x, playerHeight, spawn.z);
    velocity.set(0, 0, 0);

    if (playerRef && myRoomId) {
        set(playerRef, {
            id: myId,
            nickname: myNickname,
            position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
            rotation: { x: camera.rotation.x, y: camera.rotation.y },
            hp: myHP,
            joinedAt: Date.now()
        });
    }

    setStatus('');

    setTimeout(() => {
        controls.lock();
    }, 100);
}

function returnToLobby() {
    if (!inGame) return;
    inGame = false;
    hasSeenOtherPlayer = false;


    if (wallhackEnabled) {
        wallhackEnabled = false;
        clearOutlineMeshes();
    }

    if (window._hitsUnsubscribe) {
        window._hitsUnsubscribe();
        window._hitsUnsubscribe = null;
    }
    if (window._deathsUnsubscribe) {
        window._deathsUnsubscribe();
        window._deathsUnsubscribe = null;
    }

    if (playerRef) {
        remove(playerRef);
        playerRef = null;
    }

    if (myRoomId) {

        const roomRef = ref(db, 'rooms/' + myRoomId);
        get(roomRef).then((snap) => {
            if (snap.exists()) {
                const roomData = snap.val();
                const playerCount = roomData.players ? Object.keys(roomData.players).length : 0;

                if (playerCount === 0) {
                    remove(ref(db, 'public_rooms/' + myRoomId));
                }
            } else {

                remove(ref(db, 'public_rooms/' + myRoomId));
            }
        });
    }

    for (const id in players) {
        if (id !== myId) {
            if (players[id].hpBarBg && players[id].hpBarBg.parentNode) {
                players[id].hpBarBg.parentNode.removeChild(players[id].hpBarBg);
            }
            if (players[id].nicknameEl && players[id].nicknameEl.parentNode) {
                players[id].nicknameEl.parentNode.removeChild(players[id].nicknameEl);
            }
            removePlayer(id);
        }
    }

    for (const bullet of bullets) {
        scene.remove(bullet);
        bullet.geometry?.dispose();
        bullet.material?.dispose();
    }
    bullets = [];

    if (hpBarContainer && hpBarContainer.parentNode) {
        hpBarContainer.parentNode.removeChild(hpBarContainer);
        hpBarContainer = null;
    }

    if (ammoDisplay && ammoDisplay.parentNode) {
        ammoDisplay.parentNode.removeChild(ammoDisplay);
        ammoDisplay = null;
    }

    const floatingEls = document.querySelectorAll('div[style*="position: fixed"]');
    floatingEls.forEach(el => {
        if (el.style.zIndex === '99') {
            el.remove();
        }
    });

    document.getElementById('lobby-btn').classList.remove('active');

    animationRunning = false;

    try { controls.unlock(); } catch(e) {}

    document.getElementById('menu').classList.remove('hidden');
    document.getElementById('game-container').classList.remove('active');

    if (renderer && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
    scene = null;
    renderer = null;


    textureCache = {};

    wallhackEnabled = false;
    wallhackCooldown = false;
    clearOutlineMeshes();
    outlineMeshes = [];

    myRoomId = null;
    killCount = 0;
    deathCount = 0;
    ping = 0;
    myAmmo = myMaxAmmo;
    isReloading = false;
    killsForCase = 0;
    botKillCount = 0;
    frameCount = 0;
    fps = 60;
    fpsLastCheck = performance.now();

    startRoomListener();


    get(ref(db, 'public_rooms')).then((snap) => {
        renderRoomList(snap.val() || {});
    });

    console.log('Вернулся в лобби');
}

function addCollider(objOrBounds) {
    if (objOrBounds.min && objOrBounds.max) {
        colliders.push(objOrBounds);
        return;
    }
    const box = new THREE.Box3().setFromObject(objOrBounds);
    colliders.push({
        mesh: objOrBounds,
        min: box.min,
        max: box.max
    });
}

function checkCollision(position, radius) {
    for (const collider of colliders) {
        const closestX = Math.max(collider.min.x, Math.min(position.x, collider.max.x));
        const closestZ = Math.max(collider.min.z, Math.min(position.z, collider.max.z));

        const dx = position.x - closestX;
        const dz = position.z - closestZ;
        const distXZ = Math.sqrt(dx * dx + dz * dz);

        if (distXZ < radius) {
            return {
                collider: collider,
                overlap: radius - distXZ,
                dx: dx,
                dz: dz,
                distance: distXZ
            };
        }
    }
    return null;
}

function checkStandingOn(position, radius) {
    for (const collider of colliders) {
        const closestX = Math.max(collider.min.x, Math.min(position.x, collider.max.x));
        const closestZ = Math.max(collider.min.z, Math.min(position.z, collider.max.z));

        const dx = position.x - closestX;
        const dz = position.z - closestZ;
        const distXZ = Math.sqrt(dx * dx + dz * dz);

        if (distXZ < radius && position.y >= collider.max.y - 0.3 && position.y <= collider.max.y + 1) {
            return collider.max.y;
        }
    }
    return null;
}

function resolveCollision(position, radius) {
    const collision = checkCollision(position, radius);
    if (collision) {
        const nx = collision.dx / (collision.distance || 1);
        const nz = collision.dz / (collision.distance || 1);
        position.x += nx * collision.overlap;
        position.z += nz * collision.overlap;
        return true;
    }
    return false;
}

function checkBulletCollider(position, radius) {
    for (const collider of colliders) {
        const closestX = Math.max(collider.min.x, Math.min(position.x, collider.max.x));
        const closestY = Math.max(collider.min.y, Math.min(position.y, collider.max.y));
        const closestZ = Math.max(collider.min.z, Math.min(position.z, collider.max.z));

        const dx = position.x - closestX;
        const dy = position.y - closestY;
        const dz = position.z - closestZ;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (distance < radius) {
            return true;
        }
    }
    return false;
}

function checkBulletHit(bulletPos, shooterId) {
    for (const id in players) {
        if (id === shooterId || id === myId) continue;

        const player = players[id];
        if (!player || !player.mesh) continue;

        const dx = bulletPos.x - player.mesh.position.x;
        const dy = bulletPos.y - (player.mesh.position.y + 0.8);
        const dz = bulletPos.z - player.mesh.position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < 0.8) {
            return id;
        }
    }
    return null;
}

async function createRoom() {
    if (!db) {
        setStatus('❌ Сначала настрой Firebase!');
        return;
    }

    if (!currentUserId) {
        setStatus('❌ Войди в аккаунт чтобы играть!');
        return;
    }

    const nickInput = document.getElementById('nickname-input');
    if (nickInput) {
        const nick = nickInput.value.trim();
        if (nick) {
            myNickname = nick.substring(0, 15);
        }
    }
    if (!myNickname || myNickname === 'Player') {
        myNickname = 'Player_' + myId.substring(0, 4);
    }

    const roomCode = generateRoomCode();
    myRoomId = roomCode;
    roomSeed = Math.floor(Math.random() * 1000000);

    setStatus('<span class="loading"></span> Создаю комнату...');

    try {
        await set(ref(db, 'rooms/' + roomCode), {
            created: Date.now(),
            host: myId,
            seed: roomSeed,
            hostNickname: myNickname,
            players: {}
        });

        await set(ref(db, 'public_rooms/' + roomCode), {
            code: roomCode,
            host: myNickname,
            createdAt: Date.now()
        });

        onDisconnect(ref(db, 'rooms/' + roomCode)).remove();

        onDisconnect(ref(db, 'public_rooms/' + roomCode)).remove();

        const spawn = findSafeSpawnPoint(Math.random);

        const playerPath = 'rooms/' + roomCode + '/players/' + myId;
        playerRef = ref(db, playerPath);

        await set(playerRef, {
            id: myId,
            nickname: myNickname,
            position: { x: spawn.x, y: playerHeight, z: spawn.z },
            rotation: { x: 0, y: 0 },
            hp: myMaxHP,
            joinedAt: Date.now()
        });

        onDisconnect(playerRef).remove();

        setupRoomListeners(roomCode);
        startGame(roomCode);

    } catch (e) {
        console.error(e);
        setStatus('❌ Ошибка: ' + e.message);
    }
}

async function joinRoom(roomCode) {
    if (!db) {
        setStatus('❌ Сначала настрой Firebase!');
        return;
    }

    const nickInput = document.getElementById('nickname-input');
    if (nickInput) {
        const nick = nickInput.value.trim();
        if (nick) {
            myNickname = nick.substring(0, 15);
        }
    }
    if (!myNickname || myNickname === 'Player') {
        myNickname = 'Player_' + myId.substring(0, 4);
    }

    roomCode = roomCode.toUpperCase().trim();
    if (!roomCode) return;

    setStatus('<span class="loading"></span> Подключаюсь...');

    try {
        const roomSnap = await get(ref(db, 'rooms/' + roomCode));
        if (!roomSnap.exists()) {
            setStatus('❌ Комната не найдена!');
            return;
        }

        const roomData = roomSnap.val();
        roomSeed = roomData.seed || 12345;
        myRoomId = roomCode;

        const playerCount = roomData.players ? Object.keys(roomData.players).length : 0;

        const spawn = findSafeSpawnPoint(Math.random);

        const playerPath = 'rooms/' + roomCode + '/players/' + myId;
        playerRef = ref(db, playerPath);

        await set(playerRef, {
            id: myId,
            nickname: myNickname,
            position: { x: spawn.x, y: playerHeight, z: spawn.z },
            rotation: { x: 0, y: 0 },
            hp: myMaxHP,
            joinedAt: Date.now()
        });

        onDisconnect(playerRef).remove();

        setupRoomListeners(roomCode);
        startGame(roomCode);

    } catch (e) {
        console.error(e);
        setStatus('❌ Ошибка подключения: ' + e.message);
    }
}

function setupRoomListeners(roomCode) {
    const playersPath = 'rooms/' + roomCode + '/players';
    playersListener = onValue(ref(db, playersPath), (snapshot) => {
        const data = snapshot.val() || {};
        updatePlayers(data);
    });
}

function updatePlayers(data) {
    const currentIds = new Set(Object.keys(data));
    const otherPlayers = Object.keys(data).filter(id => id !== myId);


    if (otherPlayers.length > 0) {
        hasSeenOtherPlayer = true;
    }

    if (hasSeenOtherPlayer) {

        if (botsEnabled) {
            botsEnabled = false;
            for (const bot of bots) {
                if (bot.mesh) bot.mesh.visible = false;
            }
        }
    } else {

        if (!botsEnabled && bots.length > 0) {
            botsEnabled = true;
            for (const bot of bots) {
                const spawn = findSafeSpawnPoint(Math.random);
                bot.hp = bot.maxHp;
                bot.position.set(spawn.x, playerHeight, spawn.z);
                bot.mesh.position.copy(bot.position);
                bot.mesh.visible = true;
                bot.lastShot = 0;
            }
        }
    }


    if (data[myId] && data[myId].pingEcho) {
        const echoTime = data[myId].pingEcho;
        const currentPing = Date.now() - echoTime;
        if (currentPing > 0 && currentPing < 10000) {
            ping = Math.round(ping * 0.6 + currentPing * 0.4);
            updateHPBar();
        }
    }

    for (const id in players) {
        if (id !== myId && !currentIds.has(id)) {
            removePlayer(id);
        }
    }

    for (const id in data) {
        if (id === myId) continue;

        const playerData = data[id];
        if (!players[id]) {
            createRemotePlayer(id, playerData.nickname);
        }

        const player = players[id];
        player.prevPosition = player.position.clone();
        player.targetPosition = new THREE.Vector3(playerData.position.x, playerData.position.y - bodyOffset, playerData.position.z);
        player.lerpAlpha = 0;
        player.lastUpdate = Date.now();

        player.rotation.set(playerData.rotation.x || 0, playerData.rotation.y || 0, 0);
        player.mesh.rotation.y = player.rotation.y;

        if (playerData.nickname) {
            player.nickname = playerData.nickname;
            if (player.nicknameEl) {
                player.nicknameEl.textContent = playerData.nickname;
            }
        }

        if (playerData.hp !== undefined) {
            player.hp = playerData.hp;
            if (player.hpBarFg) {
                const pct = Math.max(0, playerData.hp);
                player.hpBarFg.style.width = pct + '%';
                if (pct < 30) {
                    player.hpBarFg.style.background = '#ff0000';
                } else if (pct < 60) {
                    player.hpBarFg.style.background = '#ffaa00';
                } else {
                    player.hpBarFg.style.background = '#00ff00';
                }
            }
        }
    }

    updatePlayerCount();

    if (myRoomId && currentIds.size <= 1) {
    }
}

let lastBroadcast = 0;

let lastPositionSend = 0;
let lastPositionAck = 0;
let estimatedPing = 0;

function broadcastState() {
    if (!playerRef || isDead) return;

    const sendTime = Date.now();

    update(playerRef, {
        position: {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z
        },
        rotation: {
            x: camera.rotation.x,
            y: camera.rotation.y
        },
        hp: myHP,
        pingEcho: sendTime
    });
}

function spawnHitParticles(position, color) {
    const count = 8;
    for (let i = 0; i < count; i++) {
        const particle = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.08, 0.08),
            new THREE.MeshBasicMaterial({ color: color })
        );
        particle.position.copy(position);
        particle.userData.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5
        );
        particle.userData.life = 0.5;
        scene.add(particle);
        hitParticles.push(particle);
    }
}

function updateHitParticles(delta) {
    for (let i = hitParticles.length - 1; i >= 0; i--) {
        const p = hitParticles[i];
        p.userData.life -= delta;

        if (p.userData.life <= 0) {
            scene.remove(p);
            p.geometry.dispose();
            p.material.dispose();
            hitParticles.splice(i, 1);
            continue;
        }

        p.position.add(p.userData.velocity.clone().multiplyScalar(delta));
        p.material.opacity = p.userData.life * 2;
        p.material.transparent = true;
        p.scale.setScalar(p.userData.life * 2);
    }
}

function shoot() {
    const now = Date.now();
    if (isDead || !controls.isLocked || isReloading) return;
    if (now - lastFireTime < fireRate) return;

    if (myAmmo <= 0) {
        reload();
        return;
    }

    lastFireTime = now;
    myAmmo--;
    updateAmmoDisplay();

    initAudio();
    playShootSound();

    if (muzzleFlash) {
        muzzleFlash.material.opacity = 1;
        muzzleFlashLight.intensity = 2;
        setTimeout(() => {
            muzzleFlash.material.opacity = 0;
            muzzleFlashLight.intensity = 0;
        }, 50);
    }

    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);

    spawnLocalBullet(camera.position.clone(), direction.clone());

    if (weaponModel) {
        weaponModel.position.z += 0.1;
        weaponModel.rotation.x -= 0.1;
    }

    if (myRoomId) {
        const bulletRef = push(ref(db, 'rooms/' + myRoomId + '/bullets'));
        set(bulletRef, {
            position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
            direction: { x: direction.x, y: direction.y, z: direction.z },
            shooterId: myId,
            timestamp: Date.now()
        });

        setTimeout(() => {
            remove(bulletRef);
        }, 3000);
    }
}

function reload() {
    if (isReloading || myAmmo === myMaxAmmo) return;
    isReloading = true;
    updateAmmoDisplay();
    initAudio();
    playReloadSound();

    setTimeout(() => {
        myAmmo = myMaxAmmo;
        isReloading = false;
        updateAmmoDisplay();
    }, 1500);
}

function spawnLocalBullet(position, direction) {
    const bulletGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
    bullet.position.copy(position);
    bullet.userData.velocity = direction.multiplyScalar(50);
    bullet.userData.life = 2;
    scene.add(bullet);
    bullets.push(bullet);
}

function spawnRemoteBullet(position, direction) {
    const bulletGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xff4444 });
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
    bullet.position.set(position.x, position.y, position.z);

    const dir = new THREE.Vector3(direction.x, direction.y, direction.z);
    bullet.userData.velocity = dir.multiplyScalar(50);
    bullet.userData.life = 2;
    scene.add(bullet);
    bullets.push(bullet);
}

function createRemotePlayer(playerId, nickname) {
    if (!scene || !document.body) return;

    const group = new THREE.Group();

    const bodyGeometry = new THREE.CapsuleGeometry(0.3, 1, 4, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x00cc00, roughness: 0.5, metalness: 0.3 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.8;
    body.castShadow = true;
    group.add(body);

    const hpBarBg = document.createElement('div');
    hpBarBg.style.cssText = `
        position: absolute;
        width: 50px;
        height: 6px;
        background: rgba(0,0,0,0.7);
        border-radius: 3px;
        overflow: hidden;
    `;

    const hpBarFg = document.createElement('div');
    hpBarFg.style.cssText = `
        width: 100%;
        height: 100%;
        background: #00ff00;
        transition: width 0.2s;
    `;
    hpBarBg.appendChild(hpBarFg);

    const nicknameEl = document.createElement('div');
    nicknameEl.style.cssText = `
        position: absolute;
        color: #fff;
        font-size: 12px;
        font-weight: bold;
        text-shadow: 0 0 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.5);
        white-space: nowrap;
        text-align: center;
    `;
    nicknameEl.textContent = nickname || 'Player';

    document.body.appendChild(hpBarBg);
    document.body.appendChild(nicknameEl);

    scene.add(group);

    players[playerId] = {
        mesh: group,
        position: new THREE.Vector3(0, 1, 5),
        prevPosition: new THREE.Vector3(0, 1, 5),
        targetPosition: new THREE.Vector3(0, 1, 5),
        lerpAlpha: 1,
        lastUpdate: 0,
        rotation: new THREE.Euler(),
        hp: 100,
        nickname: nickname || 'Player',
        hpBarBg: hpBarBg,
        hpBarFg: hpBarFg,
        nicknameEl: nicknameEl
    };
}

function updateRemotePlayer(playerId, position, rotation, hp, nickname) {
    if (!players[playerId]) return;

    const player = players[playerId];
    player.position.set(position.x, position.y - bodyOffset, position.z);
    player.rotation.set(rotation.x || 0, rotation.y || 0, 0);
    player.mesh.position.copy(player.position);
    player.mesh.rotation.y = player.rotation.y;

    if (nickname) {
        player.nickname = nickname;
        if (player.nicknameEl) {
            player.nicknameEl.textContent = nickname;
        }
    }

    if (hp !== undefined) {
        player.hp = hp;
        if (player.hpBarFg) {
            const pct = Math.max(0, hp);
            player.hpBarFg.style.width = pct + '%';
            if (pct < 30) {
                player.hpBarFg.style.background = '#ff0000';
            } else if (pct < 60) {
                player.hpBarFg.style.background = '#ffaa00';
            } else {
                player.hpBarFg.style.background = '#00ff00';
            }
        }
    }
}

function removePlayer(playerId) {
    if (players[playerId]) {
        scene.remove(players[playerId].mesh);
        if (players[playerId].hpBarBg && players[playerId].hpBarBg.parentNode) {
            players[playerId].hpBarBg.parentNode.removeChild(players[playerId].hpBarBg);
        }
        if (players[playerId].nicknameEl && players[playerId].nicknameEl.parentNode) {
            players[playerId].nicknameEl.parentNode.removeChild(players[playerId].nicknameEl);
        }
        players[playerId].mesh.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
        delete players[playerId];
        updatePlayerCount();
    }
}

function initScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.015);
    scene.background = new THREE.Color(0x87ceeb);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, playerHeight, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.BasicShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const oldCanvas = document.getElementById('game-canvas');
    if (oldCanvas) oldCanvas.remove();

    renderer.domElement.id = 'game-canvas';
    document.getElementById('game-container').appendChild(renderer.domElement);

    controls = new PointerLockControls(camera, document.body);


    document.addEventListener('mousemove', (e) => {
        if (!controls.isLocked) return;
        e.stopImmediatePropagation();

        const euler = new THREE.Euler(0, 0, 0, 'YXZ');
        euler.setFromQuaternion(camera.quaternion);
        euler.y -= e.movementX * 0.002 * mouseSensitivity;
        euler.x -= e.movementY * 0.002 * mouseSensitivity;
        euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
        camera.quaternion.setFromEuler(euler);
    }, true);

    const ambientLight = new THREE.AmbientLight(0x9090c0, 0.5);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x444444, 0.4);
    scene.add(hemiLight);

    const directionalLight = new THREE.DirectionalLight(0xfff5e0, 1.0);
    directionalLight.position.set(30, 50, 20);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.camera.left = -40;
    directionalLight.shadow.camera.right = 40;
    directionalLight.shadow.camera.top = 40;
    directionalLight.shadow.camera.bottom = -40;
    directionalLight.shadow.bias = -0.0001;
    scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0xc0d0ff, 0.3);
    fillLight.position.set(-20, 30, -20);
    scene.add(fillLight);

    generateMap(roomSeed);

    players[myId] = { mesh: null, position: camera.position.clone(), hp: myMaxHP, nickname: myNickname };

    createHPBar();
    updateHPBar();
    createWeaponModel();
}

function createWeaponModel() {
    weaponModel = new THREE.Group();

    const gunBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.12, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3, metalness: 0.8 })
    );
    gunBody.position.set(0, 0, -0.25);
    weaponModel.add(gunBody);

    const barrel = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.04, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.9 })
    );
    barrel.position.set(0, 0.02, -0.6);
    weaponModel.add(barrel);

    const grip = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.15, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.7, metalness: 0.1 })
    );
    grip.position.set(0, -0.12, -0.1);
    grip.rotation.x = 0.3;
    weaponModel.add(grip);

    weaponModel.position.set(0.3, -0.28, -0.5);
    camera.add(weaponModel);
    scene.add(camera);

    muzzleFlash = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0 })
    );
    muzzleFlash.position.set(0, 0.02, -0.75);
    weaponModel.add(muzzleFlash);

    muzzleFlashLight = new THREE.PointLight(0xffaa00, 0, 5);
    muzzleFlashLight.position.copy(muzzleFlash.position);
    weaponModel.add(muzzleFlashLight);

    createAmmoDisplay();
}

function createAmmoDisplay() {
    ammoDisplay = document.createElement('div');
    ammoDisplay.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 30px;
        color: #fff;
        font-size: 36px;
        font-weight: bold;
        font-family: 'Courier New', monospace;
        text-shadow: 2px 2px 6px rgba(0,0,0,0.8);
        z-index: 100;
    `;
    document.body.appendChild(ammoDisplay);
    updateAmmoDisplay();
}

function updateAmmoDisplay() {
    if (!ammoDisplay) return;
    if (isReloading) {
        ammoDisplay.textContent = 'ПЕРЕЗАРЯДКА...';
        ammoDisplay.style.color = '#ffaa00';
    } else {
        ammoDisplay.textContent = myAmmo + ' / ∞';
        ammoDisplay.style.color = myAmmo > 10 ? '#fff' : '#ff4444';
    }
}

function generateTexture(type, size) {
    if (textureCache[type + size]) return textureCache[type + size];

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    switch(type) {
        case 'concrete':
            ctx.fillStyle = '#666677';
            ctx.fillRect(0, 0, size, size);
            for (let i = 0; i < 200; i++) {
                const x = Math.random() * size;
                const y = Math.random() * size;
                const shade = Math.random() * 40 - 20;
                ctx.fillStyle = `rgba(${102+shade},${102+shade},${119+shade},0.3)`;
                ctx.fillRect(x, y, 2 + Math.random() * 3, 2 + Math.random() * 3);
            }
            ctx.strokeStyle = 'rgba(50,50,60,0.3)';
            ctx.lineWidth = 1;
            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                ctx.moveTo(Math.random() * size, Math.random() * size);
                ctx.lineTo(Math.random() * size, Math.random() * size);
                ctx.stroke();
            }
            break;

        case 'concrete_wall':
            ctx.fillStyle = '#777788';
            ctx.fillRect(0, 0, size, size);
            for (let i = 0; i < 150; i++) {
                const x = Math.random() * size;
                const y = Math.random() * size;
                const shade = Math.random() * 30 - 15;
                ctx.fillStyle = `rgba(${119+shade},${119+shade},${136+shade},0.3)`;
                ctx.fillRect(x, y, 2, 2);
            }
            ctx.fillStyle = 'rgba(60,60,70,0.2)';
            for (let y = 0; y < size; y += size / 4) {
                ctx.fillRect(0, y, size, 2);
            }
            break;

        case 'wood':
            ctx.fillStyle = '#8B6914';
            ctx.fillRect(0, 0, size, size);
            for (let y = 0; y < size; y += 4) {
                const shade = Math.random() * 20 - 10;
                ctx.fillStyle = `rgb(${139+shade},${105+shade},${20+shade})`;
                ctx.fillRect(0, y, size, 3);
                ctx.fillStyle = 'rgba(60,40,10,0.3)';
                ctx.fillRect(0, y + 3, size, 1);
            }
            for (let i = 0; i < 3; i++) {
                const x = Math.random() * size;
                ctx.strokeStyle = 'rgba(40,25,5,0.5)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x + (Math.random() - 0.5) * 20, size);
                ctx.stroke();
            }
            break;

        case 'metal':
            ctx.fillStyle = '#556677';
            ctx.fillRect(0, 0, size, size);
            for (let i = 0; i < 100; i++) {
                const x = Math.random() * size;
                const y = Math.random() * size;
                ctx.fillStyle = `rgba(${85+Math.random()*30},${102+Math.random()*30},${119+Math.random()*30},0.3)`;
                ctx.fillRect(x, y, 3, 3);
            }
            ctx.strokeStyle = 'rgba(40,50,60,0.3)';
            ctx.lineWidth = 2;
            ctx.strokeRect(5, 5, size - 10, size - 10);
            break;

        case 'rusty_metal':
            ctx.fillStyle = '#774433';
            ctx.fillRect(0, 0, size, size);
            for (let i = 0; i < 80; i++) {
                const x = Math.random() * size;
                const y = Math.random() * size;
                ctx.fillStyle = `rgba(${119+Math.random()*40},${68+Math.random()*30},${51+Math.random()*20},0.4)`;
                ctx.fillRect(x, y, 4, 4);
            }
            for (let i = 0; i < 30; i++) {
                const x = Math.random() * size;
                const y = Math.random() * size;
                ctx.fillStyle = `rgba(${180+Math.random()*40},${80+Math.random()*40},${40+Math.random()*20},0.5)`;
                ctx.fillRect(x, y, 3, 3);
            }
            break;

        case 'floor_tile':
            ctx.fillStyle = '#444455';
            ctx.fillRect(0, 0, size, size);
            const tileSize = size / 4;
            for (let tx = 0; tx < size; tx += tileSize) {
                for (let ty = 0; ty < size; ty += tileSize) {
                    const shade = Math.random() * 15 - 7;
                    ctx.fillStyle = `rgb(${68+shade},${68+shade},${85+shade})`;
                    ctx.fillRect(tx + 1, ty + 1, tileSize - 2, tileSize - 2);
                }
            }
            ctx.strokeStyle = 'rgba(30,30,40,0.5)';
            ctx.lineWidth = 2;
            for (let i = 0; i <= 4; i++) {
                ctx.beginPath();
                ctx.moveTo(i * tileSize, 0);
                ctx.lineTo(i * tileSize, size);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(0, i * tileSize);
                ctx.lineTo(size, i * tileSize);
                ctx.stroke();
            }
            break;

        case 'sandbag':
            ctx.fillStyle = '#998866';
            ctx.fillRect(0, 0, size, size);
            for (let y = 0; y < size; y += 12) {
                for (let x = 0; x < size; x += 20) {
                    const offset = (Math.floor(y / 12) % 2) * 10;
                    ctx.fillStyle = `rgb(${153+Math.random()*20},${136+Math.random()*15},${102+Math.random()*15})`;
                    ctx.fillRect(x + offset + 1, y + 1, 18, 10);
                    ctx.strokeStyle = 'rgba(60,50,30,0.4)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x + offset + 1, y + 1, 18, 10);
                }
            }
            break;
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    textureCache[type + size] = texture;
    return texture;
}

function createTexturedBox(x, y, z, w, h, d, textureType) {
    const texture = generateTexture(textureType, 256);
    const material = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.8,
        metalness: textureType === 'metal' || textureType === 'rusty_metal' ? 0.5 : 0.1
    });
    const geometry = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = true;
    scene.add(mesh);
    return mesh;
}

function seededRandom(seed) {
    let s = seed;
    return function() {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
    };
}

function generateMap(seed) {
    const rng = seededRandom(seed);
    colliders = [];

    generateRandomMap(rng);
}

function generateRandomMap(rng) {
    const floorGeometry = new THREE.PlaneGeometry(100, 100);
    const floorMaterial = new THREE.MeshStandardMaterial({
        map: generateTexture('floor_tile', 512),
        roughness: 0.7,
        metalness: 0.3
    });
    floorMaterial.map.repeat.set(10, 10);
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const gridHelper = new THREE.GridHelper(100, 50, 0x555566, 0x444455);
    scene.add(gridHelper);

    const wallMat = new THREE.MeshStandardMaterial({ map: generateTexture('concrete_wall', 256), roughness: 0.5, metalness: 0.4 });
    const wall1 = createBox(0, 2.5, -50, 100, 5, 1, wallMat);
    const wall2 = createBox(0, 2.5, 50, 100, 5, 1, wallMat);
    const wall3 = createBox(-50, 2.5, 0, 1, 5, 100, wallMat);
    const wall4 = createBox(50, 2.5, 0, 1, 5, 100, wallMat);
    addCollider(wall1);
    addCollider(wall2);
    addCollider(wall3);
    addCollider(wall4);

    const boxColors = [0x8b5e3c, 0x4a7c59, 0x5c4a7c, 0x7c5c4a, 0x4a5c7c, 0x8b6914];
    const numObjects = 15 + Math.floor(rng() * 10);

    for (let i = 0; i < numObjects; i++) {
        const x = (rng() - 0.5) * 80;
        const z = (rng() - 0.5) * 80;

        if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;

        const w = 1 + rng() * 4;
        const h = 2 + rng() * 4;
        const d = 1 + rng() * 4;
        const color = boxColors[Math.floor(rng() * boxColors.length)];

        const box = createBox(x, h / 2, z, w, h, d, color);
        addCollider(box);
    }

    const numBarrels = 5 + Math.floor(rng() * 5);
    for (let i = 0; i < numBarrels; i++) {
        const x = (rng() - 0.5) * 70;
        const z = (rng() - 0.5) * 70;
        if (Math.abs(x) < 4 && Math.abs(z) < 4) continue;

        const barrelGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.5, 8);
        const barrelMat = new THREE.MeshStandardMaterial({
            color: Math.random() > 0.5 ? 0xcc4400 : 0x4488cc,
            roughness: 0.6,
            metalness: 0.5
        });
        const barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.position.set(x, 0.75, z);
        barrel.castShadow = true;
        barrel.receiveShadow = true;
        barrel.frustumCulled = true;
        scene.add(barrel);
        addCollider(barrel);
    }

    const numWalls = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < numWalls; i++) {
        const x = (rng() - 0.5) * 60;
        const z = (rng() - 0.5) * 60;
        const rotY = rng() * Math.PI;
        const wallW = 4 + rng() * 6;
        const wallH = 2 + rng() * 2;

        const wallGeo = new THREE.BoxGeometry(wallW, wallH, 0.3);
        const wallMatLocal = new THREE.MeshStandardMaterial({
            color: 0x888899,
            roughness: 0.7,
            metalness: 0.2
        });
        const wall = new THREE.Mesh(wallGeo, wallMatLocal);
        wall.position.set(x, wallH / 2, z);
        wall.rotation.y = rotY;
        wall.castShadow = true;
        wall.receiveShadow = true;
        wall.frustumCulled = true;
        scene.add(wall);
        addCollider(wall);
    }

    const numPlatforms = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < numPlatforms; i++) {
        const x = (rng() - 0.5) * 60;
        const z = (rng() - 0.5) * 60;
        const w = 3 + rng() * 5;
        const d = 3 + rng() * 5;
        const plat = createBox(x, 1.5, z, w, 3, d, 0x555566);
        plat.frustumCulled = true;
        addCollider(plat);
    }
}

function createBox(x, y, z, w, h, d, colorOrMaterial) {
    const geometry = new THREE.BoxGeometry(w, h, d);
    const material = (colorOrMaterial instanceof THREE.Material)
        ? colorOrMaterial
        : new THREE.MeshStandardMaterial({ color: colorOrMaterial, roughness: 0.6, metalness: 0.2 });
    const box = new THREE.Mesh(geometry, material);
    box.position.set(x, y, z);
    box.castShadow = true;
    box.receiveShadow = true;
    scene.add(box);
    return box;
}

function setupControls() {
    const blocker = document.getElementById('blocker');

    controls.addEventListener('lock', () => {
        blocker.classList.add('hidden');
    });

    controls.addEventListener('unlock', () => {
        blocker.classList.remove('hidden');
    });

    blocker.addEventListener('click', () => {
        if (!isDead) controls.lock();
    });

    document.addEventListener('keydown', (event) => {
        switch (event.code) {
            case 'KeyW': moveForward = true; break;
            case 'KeyA': moveLeft = true; break;
            case 'KeyS': moveBackward = true; break;
            case 'KeyD': moveRight = true; break;
            case 'Space':
                if (canJump && !isDead) {
                    velocity.y += 10 + myJumpBonus;
                    canJump = false;
                }
                break;
            case 'KeyR':
                reload();
                break;
            case 'KeyP':
                if (isAdmin && !wallhackCooldown && scene) {
                    wallhackEnabled = !wallhackEnabled;
                    wallhackCooldown = true;
                    setTimeout(() => {
                        wallhackCooldown = false;
                    }, 500);
                    if (wallhackEnabled) {
                        setTimeout(() => {
                            if (scene) createOutlineMeshes();
                        }, 100);
                        showToast("👁️ Wallhack включён!");
                    } else {
                        clearOutlineMeshes();
                        showToast("👁️ Wallhack выключен!");
                    }
                }
                break;
        }
    });

    document.addEventListener('keyup', (event) => {
        switch (event.code) {
            case 'KeyW': moveForward = false; break;
            case 'KeyA': moveLeft = false; break;
            case 'KeyS': moveBackward = false; break;
            case 'KeyD': moveRight = false; break;
        }
    });

    document.addEventListener('mousedown', (event) => {
        if (event.button === 0 && controls.isLocked && !isDead) {
            isFiring = true;
        }
    });

    document.addEventListener('mouseup', (event) => {
        if (event.button === 0) {
            isFiring = false;
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.code === 'Escape' && inGame) {
            event.preventDefault();
            returnToLobby();
        }
    });

    document.getElementById('lobby-btn').addEventListener('click', returnToLobby);
}

let frameCount = 0;
let fps = 60;
let fpsLastCheck = performance.now();
let animationRunning = false;

function animate() {
    if (!animationRunning) return;

    requestAnimationFrame(animate);

    if (!scene || !renderer) return;

    const time = performance.now();
    const delta = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;

    frameCount++;
    if (time - fpsLastCheck >= 500) {
        fps = Math.round(frameCount / ((time - fpsLastCheck) / 1000));
        frameCount = 0;
        fpsLastCheck = time;
    }

    if (controls.isLocked && !isDead) {
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 9.8 * 2.0 * delta;

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        const speed = 100.0 + mySpeedBonus;
        if (moveForward || moveBackward) velocity.z -= direction.z * speed * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * speed * delta;

        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);
        camera.position.y += velocity.y * delta;

        const currentPos = camera.position.clone();
        const collision = checkCollision(currentPos, playerRadius);
        if (collision) {
            const nx = collision.dx / (collision.distance || 1);
            const nz = collision.dz / (collision.distance || 1);
            camera.position.x += nx * collision.overlap;
            camera.position.z += nz * collision.overlap;
            velocity.x = 0;
            velocity.z = 0;
        }

        if (camera.position.y < playerHeight) {
            camera.position.y = playerHeight;
            velocity.y = 0;
            canJump = true;
        }

        camera.position.x = Math.max(-48, Math.min(48, camera.position.x));
        camera.position.z = Math.max(-48, Math.min(48, camera.position.z));

        if (time - lastBroadcast > 100) {
            broadcastState();
            lastBroadcast = time;
        }
    }

    if (weaponModel) {
        weaponModel.position.z = THREE.MathUtils.lerp(weaponModel.position.z, -0.5, 0.15);
        weaponModel.rotation.x = THREE.MathUtils.lerp(weaponModel.rotation.x, 0, 0.15);

        if (!isDead) {
            weaponModel.position.y = -0.28 + Math.sin(time * 0.008) * 0.005;
        }
    }

    if (isFiring && controls.isLocked && !isDead) {
        shoot();
    }

    const now = Date.now();
    if (!isDead && now - lastHealTime > 5000 && myHP < myMaxHP) {
        lastHealTime = now;
        myHP = Math.min(myHP + 1, myMaxHP);
        updateHPBar();
    }

    interpolatePlayers(delta);

    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        bullet.userData.life -= delta;

        if (bullet.userData.life <= 0) {
            scene.remove(bullet);
            bullet.geometry.dispose();
            bullet.material.dispose();
            bullets.splice(i, 1);
            continue;
        }

        bullet.position.add(bullet.userData.velocity.clone().multiplyScalar(delta));

        if (checkBulletCollider(bullet.position, 0.1)) {
            spawnHitParticles(bullet.position, 0x888888);
            scene.remove(bullet);
            bullet.geometry.dispose();
            bullet.material.dispose();
            bullets.splice(i, 1);
            continue;
        }

        const hitPlayerId = checkBulletHit(bullet.position, myId);
        if (hitPlayerId) {
            spawnHitParticles(bullet.position, 0xff0000);
            scene.remove(bullet);
            bullet.geometry.dispose();
            bullet.material.dispose();
            bullets.splice(i, 1);

            if (myRoomId) {
                const hitRef = push(ref(db, 'rooms/' + myRoomId + '/hits'));
                set(hitRef, {
                    targetId: hitPlayerId,
                    shooterId: myId,
                    damage: 15 + myDamageBonus,
                    timestamp: Date.now()
                });
                setTimeout(() => remove(hitRef), 1000);
            }
        }
    }

    updateHitParticles(delta);
    updateBots(delta, time);
    updateBotBullets(delta);
    checkPlayerBulletsOnBots();

    if (inGame && scene) {
        updateOutlineMeshes();
    }

    periodicSaveStats();

    if (myRoomId && !isDead && !window._hitsUnsubscribe) {
        const hitsPath = 'rooms/' + myRoomId + '/hits';
        window._hitsUnsubscribe = onChildAdded(ref(db, hitsPath), (snapshot) => {
            const hit = snapshot.val();
            if (hit.targetId === myId && hit.shooterId !== myId) {
                takeDamage(hit.damage, hit.shooterId);
            }
        });
    }

    if (myRoomId && !window._deathsUnsubscribe) {
        const deathsPath = 'rooms/' + myRoomId + '/deaths';
        window._deathsUnsubscribe = onChildAdded(ref(db, deathsPath), (snapshot) => {
            const death = snapshot.val();
            if (death.shooterId === myId) {
                killCount++;
                killsForCase++;
                updateCaseUI();
                checkCaseReward();
                updateHPBar();
            }
            setTimeout(() => remove(snapshot.ref), 2000);
        });
    }

    updateRemoteHPBars();

    renderer.render(scene, camera);
}

function interpolatePlayers(delta) {
    for (const id in players) {
        if (id === myId) continue;
        const player = players[id];
        if (!player || !player.targetPosition) continue;

        player.lerpAlpha += delta * 8;
        if (player.lerpAlpha > 1) player.lerpAlpha = 1;

        player.position.lerpVectors(player.prevPosition, player.targetPosition, player.lerpAlpha);
        player.mesh.position.copy(player.position);
    }
}

function updateRemoteHPBars() {
    if (!renderer || !renderer.domElement) return;

    const canvasOffset = renderer.domElement.getBoundingClientRect();
    const maxDistance = 40;

    for (const id in players) {
        if (id === myId) continue;
        const player = players[id];
        if (!player || !player.mesh) continue;

        const dist = camera.position.distanceTo(player.mesh.position.clone().add(new THREE.Vector3(0, bodyOffset, 0)));
        const visible = dist < maxDistance;
        const opacity = visible ? Math.max(0, 1 - (dist / maxDistance)) : 0;

        const headPos = player.mesh.position.clone();
        headPos.y += 2.2;

        const projected = headPos.clone().project(camera);

        if (projected.z > 1) {
            if (player.hpBarBg) player.hpBarBg.style.display = 'none';
            if (player.nicknameEl) player.nicknameEl.style.display = 'none';
            continue;
        }

        const x = (projected.x * 0.5 + 0.5) * canvasOffset.width + canvasOffset.left;
        const y = (-projected.y * 0.5 + 0.5) * canvasOffset.height + canvasOffset.top;

        if (player.hpBarBg) {
            player.hpBarBg.style.display = visible ? 'block' : 'none';
            player.hpBarBg.style.position = 'fixed';
            player.hpBarBg.style.left = (x - 25) + 'px';
            player.hpBarBg.style.top = (y + 8) + 'px';
            player.hpBarBg.style.zIndex = '99';
            player.hpBarBg.style.opacity = opacity;
        }

        if (player.nicknameEl) {
            player.nicknameEl.style.display = visible ? 'block' : 'none';
            player.nicknameEl.style.position = 'fixed';
            player.nicknameEl.style.left = x + 'px';
            player.nicknameEl.style.transform = 'translateX(-50%)';
            player.nicknameEl.style.top = (y - 16) + 'px';
            player.nicknameEl.style.zIndex = '99';
            player.nicknameEl.style.opacity = opacity;
        }
    }
}

function startGame(roomCode) {
    inGame = true;
    hasSeenOtherPlayer = false;

    const nickInput = document.getElementById('nickname-input');
    if (nickInput && nickInput.value.trim()) {
        myNickname = nickInput.value.trim().substring(0, 15);
        if (currentUserId) {
            set(ref(db, 'users/' + currentUserId + '/nickname'), myNickname);
        }
    }

    document.getElementById('menu').classList.add('hidden');
    document.getElementById('game-container').classList.add('active');
    document.getElementById('room-info').textContent = 'Комната: ' + roomCode + ' | Поделись кодом!';
    document.getElementById('lobby-btn').classList.add('active');

    applyCardBuffs();

    bots = [];
    botBullets = [];
    botSpawnTimer = 0;
    botKillCount = 0;
    botsEnabled = false;

    initScene();
    setupControls();


    const rng = Math.random;
    const spawn1 = findSafeSpawnPoint(rng);
    const spawn2 = findSafeSpawnPoint(rng);
    spawnBot(spawn1.x, spawn1.z);
    spawnBot(spawn2.x, spawn2.z);
    botsEnabled = true;

    window.addEventListener('resize', () => {
        if (!camera || !renderer) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animationRunning = true;
    animate();

    setTimeout(() => {
        try {
            controls.lock();
        } catch (e) {
            console.warn('Pointer lock failed:', e);
        }
    }, 800);
}

function init() {
    document.getElementById('create-room-btn').addEventListener('click', createRoom);

    document.getElementById('join-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const code = document.getElementById('room-code-input').value;
        joinRoom(code);
    });

    document.getElementById('inventory-btn').addEventListener('click', () => {
        document.getElementById('inventory-modal').style.display = 'flex';
        renderInventory();
    });

    document.getElementById('close-inventory-btn').addEventListener('click', () => {
        document.getElementById('inventory-modal').style.display = 'none';
    });

    document.getElementById('open-case-btn').addEventListener('click', openCase);

    document.getElementById('settings-btn').addEventListener('click', () => {
        document.getElementById('settings-modal').style.display = 'flex';
        loadSettings();
    });

    document.getElementById('close-settings-btn').addEventListener('click', () => {
        document.getElementById('settings-modal').style.display = 'none';
        saveSettings();
    });

    document.getElementById('volume-slider').addEventListener('input', (e) => {
        masterVolume = e.target.value / 100;
        document.getElementById('volume-value').textContent = e.target.value;
    });

    document.getElementById('sens-slider').addEventListener('input', (e) => {
        mouseSensitivity = e.target.value / 10;
        document.getElementById('sens-value').textContent = mouseSensitivity.toFixed(1);
    });

    document.getElementById('admin-grant-btn').addEventListener('click', async () => {
        const targetNick = prompt('Введи ник игрока для выдачи админки:');
        if (!targetNick) return;

        try {
            const usersSnap = await get(ref(db, 'users'));
            if (usersSnap.exists()) {
                const users = usersSnap.val();
                for (const uid in users) {
                    if (users[uid].nickname === targetNick) {
                        await set(ref(db, 'users/' + uid + '/isAdmin'), true);
                        showToast(`✅ Админка выдана игроку ${targetNick}!`);
                        return;
                    }
                }
            }
            showToast('❌ Игрок не найден!');
        } catch(e) {
            showToast('❌ Ошибка: ' + e.message);
        }
    });

    loadCards();
    updateCardDisplay();
    loadSettings();
}

init();
