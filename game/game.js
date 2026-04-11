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

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

let app, db;
try {
    app = initializeApp(FIREBASE_CONFIG);
    db = getDatabase(app);
    console.log('Firebase инициализирован');
} catch (e) {
    console.error('Ошибка Firebase:', e);
    setStatus('❌ Ошибка Firebase. Проверь консоль.');
}

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
let hpBarContainer = null;
let hpBarOuter = null;
let hpBarInner = null;
let hpText = null;
let killDeathDisplay = null;

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
    updateHPBar();

    const spawnX = (Math.random() - 0.5) * 40;
    const spawnZ = (Math.random() - 0.5) * 40;
    camera.position.set(spawnX, playerHeight, spawnZ);
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
                if (playerCount <= 1) {
                    remove(roomRef);
                }
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

    myRoomId = null;
    killCount = 0;
    deathCount = 0;
    ping = 0;
    frameCount = 0;
    fps = 60;
    fpsLastCheck = performance.now();

    console.log('Вернулся в лобби');
}

function addCollider(mesh) {
    const box = new THREE.Box3().setFromObject(mesh);
    colliders.push({
        mesh: mesh,
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
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance < radius) {
            return {
                collider: collider,
                overlap: radius - distance,
                dx: dx,
                dz: dz,
                distance: distance
            };
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
            seed: roomSeed
        });

        onDisconnect(ref(db, 'rooms/' + roomCode)).remove();

        const spawnX = (Math.random() - 0.5) * 30;
        const spawnZ = (Math.random() - 0.5) * 30;

        const playerPath = 'rooms/' + roomCode + '/players/' + myId;
        playerRef = ref(db, playerPath);

        await set(playerRef, {
            id: myId,
            nickname: myNickname,
            position: { x: spawnX, y: playerHeight, z: spawnZ },
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

        const spawnX = (Math.random() - 0.5) * 30;
        const spawnZ = (Math.random() - 0.5) * 30;

        const playerPath = 'rooms/' + roomCode + '/players/' + myId;
        playerRef = ref(db, playerPath);

        await set(playerRef, {
            id: myId,
            nickname: myNickname,
            position: { x: spawnX, y: playerHeight, z: spawnZ },
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

function updatePlayerCount() {
    const count = Object.keys(players).length;
    document.getElementById('player-count').textContent = count;
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

function shoot() {
    if (isDead || !controls.isLocked) return;

    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);

    spawnLocalBullet(camera.position.clone(), direction.clone());

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
    const group = new THREE.Group();

    const bodyGeometry = new THREE.CapsuleGeometry(0.3, 1, 4, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x00cc00, roughness: 0.5, metalness: 0.3 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.8;
    body.castShadow = true;
    group.add(body);

    const gunGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.5);
    const gunMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.3, metalness: 0.7 });
    const gun = new THREE.Mesh(gunGeometry, gunMaterial);
    gun.position.set(0.3, 0.5, -0.3);
    group.add(gun);

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

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, playerHeight, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    const oldCanvas = document.getElementById('game-canvas');
    if (oldCanvas) oldCanvas.remove();

    renderer.domElement.id = 'game-canvas';
    document.getElementById('game-container').appendChild(renderer.domElement);

    controls = new PointerLockControls(camera, document.body);

    const ambientLight = new THREE.AmbientLight(0x9090c0, 0.5);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x444444, 0.4);
    scene.add(hemiLight);

    const directionalLight = new THREE.DirectionalLight(0xfff5e0, 1.0);
    directionalLight.position.set(30, 50, 20);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 150;
    directionalLight.shadow.camera.left = -60;
    directionalLight.shadow.camera.right = 60;
    directionalLight.shadow.camera.top = 60;
    directionalLight.shadow.camera.bottom = -60;
    directionalLight.shadow.bias = -0.0001;
    scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0xc0d0ff, 0.3);
    fillLight.position.set(-20, 30, -20);
    scene.add(fillLight);

    generateMap(roomSeed);

    players[myId] = { mesh: null, position: camera.position.clone(), hp: myMaxHP, nickname: myNickname };

    createHPBar();
    updateHPBar();
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

    const floorGeometry = new THREE.PlaneGeometry(100, 100);
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0x3a3a4a,
        roughness: 0.7,
        metalness: 0.3
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const gridHelper = new THREE.GridHelper(100, 50, 0x555566, 0x444455);
    scene.add(gridHelper);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x666680, roughness: 0.5, metalness: 0.4 });
    const wall1 = createBox(0, 2.5, -50, 100, 5, 1, wallMat);
    const wall2 = createBox(0, 2.5, 50, 100, 5, 1, wallMat);
    const wall3 = createBox(-50, 2.5, 0, 1, 5, 100, wallMat);
    const wall4 = createBox(50, 2.5, 0, 1, 5, 100, wallMat);
    addCollider(wall1);
    addCollider(wall2);
    addCollider(wall3);
    addCollider(wall4);

    const boxColors = [0x8b5e3c, 0x4a7c59, 0x5c4a7c, 0x7c5c4a, 0x4a5c7c, 0x8b6914];
    const numObjects = 8 + Math.floor(rng() * 8);

    for (let i = 0; i < numObjects; i++) {
        const x = (rng() - 0.5) * 80;
        const z = (rng() - 0.5) * 80;

        if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;

        const w = 1 + rng() * 4;
        const h = 1 + rng() * 4;
        const d = 1 + rng() * 4;
        const color = boxColors[Math.floor(rng() * boxColors.length)];

        const box = createBox(x, h / 2, z, w, h, d, color);
        addCollider(box);
    }

    const numPlatforms = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < numPlatforms; i++) {
        const x = (rng() - 0.5) * 60;
        const z = (rng() - 0.5) * 60;
        const w = 3 + rng() * 4;
        const d = 3 + rng() * 4;
        const plat = createBox(x, 0.4, z, w, 0.8, d, 0x555566);
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
                    velocity.y += 10;
                    canJump = false;
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
            shoot();
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

        const speed = 100.0;
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

        if (checkCollision(bullet.position, 0.1)) {
            scene.remove(bullet);
            bullet.geometry.dispose();
            bullet.material.dispose();
            bullets.splice(i, 1);
            continue;
        }

        const hitPlayerId = checkBulletHit(bullet.position, myId);
        if (hitPlayerId) {
            scene.remove(bullet);
            bullet.geometry.dispose();
            bullet.material.dispose();
            bullets.splice(i, 1);

            if (myRoomId) {
                const hitRef = push(ref(db, 'rooms/' + myRoomId + '/hits'));
                set(hitRef, {
                    targetId: hitPlayerId,
                    shooterId: myId,
                    damage: 25,
                    timestamp: Date.now()
                });
                setTimeout(() => remove(hitRef), 1000);
            }
        }
    }

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
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('game-container').classList.add('active');
    document.getElementById('room-info').textContent = 'Комната: ' + roomCode + ' | Поделись кодом!';
    document.getElementById('lobby-btn').classList.add('active');

    initScene();
    setupControls();

    window.addEventListener('resize', () => {
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
}

init();
