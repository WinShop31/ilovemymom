// ===== FIREBASE КОНФИГ =====
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
// =====================================================

// Проверка на мобильное устройство
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

if (isMobile) {
    document.getElementById('mobile-warning').classList.add('active');
    throw new Error('Mobile not supported yet');
}

// Firebase SDK
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
    get
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// ===== ИНИЦИАЛИЗАЦИЯ FIREBASE =====
let app, db;
try {
    app = initializeApp(FIREBASE_CONFIG);
    db = getDatabase(app);
    console.log('Firebase инициализирован');
} catch (e) {
    console.error('Ошибка Firebase:', e);
    setStatus('❌ Ошибка: вставь свой Firebase конфиг в game.js!');
}

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let scene, camera, renderer, controls;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let canJump = false;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let playerHeight = 1.7;
let players = {};
let myId = 'player_' + Math.random().toString(36).substr(2, 9);
let myRoomId = null;
let bullets = [];
let lastTime = performance.now();
let playerRef = null; // Ссылка на мою позицию в базе
let playersListener = null;
let bulletsListener = null;

// ===== UI ФУНКЦИИ =====
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

// ===== СОЗДАНИЕ/ПОДКЛЮЧЕНИЕ КОМНАТЫ =====
async function createRoom() {
    if (!db) {
        setStatus('❌ Сначала настрой Firebase!');
        return;
    }

    const roomCode = generateRoomCode();
    myRoomId = roomCode;
    
    setStatus('<span class="loading"></span> Создаю комнату...');
    
    try {
        // Создаём комнату в базе
        await set(ref(db, 'rooms/' + roomCode), {
            created: Date.now(),
            host: myId
        });
        
        // Записываем себя в игроки
        const playerPath = 'rooms/' + roomCode + '/players/' + myId;
        playerRef = ref(db, playerPath);
        
        await set(playerRef, {
            id: myId,
            position: { x: 0, y: playerHeight, z: 0 },
            rotation: { x: 0, y: 0 },
            joinedAt: Date.now()
        });
        
        // При отключении — удаляем себя
        onDisconnect(playerRef).remove();
        
        // Запускаем слушатели
        setupRoomListeners(roomCode);
        
        // Переходим в игру
        startGame(roomCode);
        
    } catch (e) {
        console.error(e);
        setStatus('❌ Ошибка создания комнаты: ' + e.message);
    }
}

async function joinRoom(roomCode) {
    if (!db) {
        setStatus('❌ Сначала настрой Firebase!');
        return;
    }

    roomCode = roomCode.toUpperCase().trim();
    if (!roomCode) return;
    
    setStatus('<span class="loading"></span> Подключаюсь...');
    
    try {
        // Проверяем существование комнаты
        const roomSnap = await get(ref(db, 'rooms/' + roomCode));
        if (!roomSnap.exists()) {
            setStatus('❌ Комната не найдена! Проверь код.');
            return;
        }
        
        myRoomId = roomCode;
        
        // Записываем себя
        const playerPath = 'rooms/' + roomCode + '/players/' + myId;
        playerRef = ref(db, playerPath);
        
        await set(playerRef, {
            id: myId,
            position: { x: (Math.random() - 0.5) * 10, y: playerHeight, z: (Math.random() - 0.5) * 10 },
            rotation: { x: 0, y: 0 },
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
    // Слушаем игроков
    const playersPath = 'rooms/' + roomCode + '/players';
    playersListener = onValue(ref(db, playersPath), (snapshot) => {
        const data = snapshot.val() || {};
        updatePlayers(data);
    });
    
    // Слушаем пули
    const bulletsPath = 'rooms/' + roomCode + '/bullets';
    bulletsListener = onValue(ref(db, bulletsPath), (snapshot) => {
        const data = snapshot.val() || {};
        // Пули обрабатываем иначе — только новые
    });
}

function updatePlayers(data) {
    const currentIds = new Set(Object.keys(data));
    
    // Удаляем ушедших
    for (const id in players) {
        if (id !== myId && !currentIds.has(id)) {
            removePlayer(id);
        }
    }
    
    // Обновляем существующих
    for (const id in data) {
        if (id === myId) continue;
        
        const playerData = data[id];
        if (!players[id]) {
            createRemotePlayer(id);
        }
        
        updateRemotePlayer(id, playerData.position, playerData.rotation);
    }
    
    updatePlayerCount();
}

function updatePlayerCount() {
    const count = Object.keys(players).length;
    document.getElementById('player-count').textContent = count;
}

// ===== МУЛЬТИПЛЕЕР =====
function broadcastState() {
    if (!playerRef) return;
    
    update(playerRef, {
        position: { 
            x: camera.position.x, 
            y: camera.position.y, 
            z: camera.position.z 
        },
        rotation: { 
            x: camera.rotation.x, 
            y: camera.rotation.y 
        }
    });
}

function shoot() {
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    
    // Локальная пуля
    spawnLocalBullet(camera.position.clone(), direction.clone());
    
    // Отправляем в базу
    if (myRoomId) {
        const bulletRef = push(ref(db, 'rooms/' + myRoomId + '/bullets'));
        set(bulletRef, {
            position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
            direction: { x: direction.x, y: direction.y, z: direction.z },
            shooterId: myId,
            timestamp: Date.now()
        });
        
        // Удаляем пулю через 3 секунды
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

// ===== ИГРОКИ =====
function createRemotePlayer(playerId) {
    const group = new THREE.Group();
    
    // Тело
    const bodyGeometry = new THREE.CapsuleGeometry(0.3, 1, 4, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.8;
    group.add(body);
    
    // Оружие
    const gunGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.5);
    const gunMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const gun = new THREE.Mesh(gunGeometry, gunMaterial);
    gun.position.set(0.3, 0.5, -0.3);
    group.add(gun);
    
    scene.add(group);
    
    players[playerId] = {
        mesh: group,
        position: new THREE.Vector3(),
        rotation: new THREE.Euler()
    };
}

function updateRemotePlayer(playerId, position, rotation) {
    if (!players[playerId]) return;
    
    const player = players[playerId];
    player.position.set(position.x, position.y, position.z);
    player.rotation.set(rotation.x || 0, rotation.y || 0, 0);
    player.mesh.position.copy(player.position);
    player.mesh.rotation.y = player.rotation.y;
}

function removePlayer(playerId) {
    if (players[playerId]) {
        scene.remove(players[playerId].mesh);
        players[playerId].mesh.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
        delete players[playerId];
        updatePlayerCount();
    }
}

// ===== THREE.JS =====
function initScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 10, 100);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, playerHeight, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.getElementById('game-container').appendChild(renderer.domElement);

    controls = new PointerLockControls(camera, document.body);

    // Освещение
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    createMap();

    // Я — тоже в players
    players[myId] = { mesh: null, position: camera.position.clone() };
}

function createMap() {
    // Пол
    const floorGeometry = new THREE.PlaneGeometry(100, 100);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.8 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const gridHelper = new THREE.GridHelper(100, 50, 0x666666, 0x444444);
    scene.add(gridHelper);

    // Стены
    createWall(0, 2.5, -50, 100, 5, 1);
    createWall(0, 2.5, 50, 100, 5, 1);
    createWall(-50, 2.5, 0, 1, 5, 100);
    createWall(50, 2.5, 0, 1, 5, 100);

    // Препятствия
    createBox(5, 1.5, -10, 3, 3, 3, 0x8b4513);
    createBox(-8, 1.5, -15, 4, 3, 2, 0x556b2f);
    createBox(12, 1, 8, 2, 2, 2, 0x8b4513);
    createBox(-15, 2, 12, 3, 4, 3, 0x556b2f);
    createBox(0, 1, -25, 6, 2, 2, 0x8b4513);
    createBox(20, 1.5, -20, 3, 3, 3, 0x556b2f);
    createBox(-20, 1.5, -5, 2, 3, 4, 0x8b4513);
    createBox(15, 0.5, 15, 5, 1, 5, 0x696969);
    createBox(-10, 0.5, 20, 4, 1, 4, 0x696969);
}

function createWall(x, y, z, w, h, d) {
    const geometry = new THREE.BoxGeometry(w, h, d);
    const material = new THREE.MeshStandardMaterial({ color: 0x808080 });
    const wall = new THREE.Mesh(geometry, material);
    wall.position.set(x, y, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
}

function createBox(x, y, z, w, h, d, color) {
    const geometry = new THREE.BoxGeometry(w, h, d);
    const material = new THREE.MeshStandardMaterial({ color: color });
    const box = new THREE.Mesh(geometry, material);
    box.position.set(x, y, z);
    box.castShadow = true;
    box.receiveShadow = true;
    scene.add(box);
}

// ===== УПРАВЛЕНИЕ =====
function setupControls() {
    const blocker = document.getElementById('blocker');

    controls.addEventListener('lock', () => {
        blocker.classList.add('hidden');
    });

    controls.addEventListener('unlock', () => {
        blocker.classList.remove('hidden');
    });

    blocker.addEventListener('click', () => {
        controls.lock();
    });

    document.addEventListener('keydown', (event) => {
        switch (event.code) {
            case 'KeyW': moveForward = true; break;
            case 'KeyA': moveLeft = true; break;
            case 'KeyS': moveBackward = true; break;
            case 'KeyD': moveRight = true; break;
            case 'Space':
                if (canJump) {
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
        if (event.button === 0 && controls.isLocked) {
            shoot();
        }
    });
}

// ===== ИГРОВОЙ ЦИКЛ =====
let lastBroadcast = 0;

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - lastTime) / 1000;
    lastTime = time;

    if (controls.isLocked) {
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

        if (camera.position.y < playerHeight) {
            camera.position.y = playerHeight;
            velocity.y = 0;
            canJump = true;
        }

        camera.position.x = Math.max(-48, Math.min(48, camera.position.x));
        camera.position.z = Math.max(-48, Math.min(48, camera.position.z));

        // Отправляем позицию 10 раз в секунду
        if (time - lastBroadcast > 100) {
            broadcastState();
            lastBroadcast = time;
        }
    }

    // Обновляем пули
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
    }

    renderer.render(scene, camera);
}

// ===== СТАРТ ИГРЫ =====
function startGame(roomCode) {
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('game-container').classList.add('active');
    document.getElementById('room-info').textContent = 'Комната: ' + roomCode + ' | Поделись кодом с друзьями!';
    
    initScene();
    setupControls();
    
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
    
    // Блокируем курсор через секунду
    setTimeout(() => {
        controls.lock();
    }, 500);
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
function init() {
    document.getElementById('create-room-btn').addEventListener('click', createRoom);
    
    document.getElementById('join-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const code = document.getElementById('room-code-input').value;
        joinRoom(code);
    });
}

init();
