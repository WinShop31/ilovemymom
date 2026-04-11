// Проверка на мобильное устройство
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

if (isMobile) {
    document.getElementById('mobile-warning').classList.add('active');
    document.getElementById('menu').classList.add('hidden');
    throw new Error('Mobile not supported yet');
}

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let scene, camera, renderer, controls;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let canJump = false;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let playerHeight = 1.7;
let players = {}; // Локальные и удалённые игроки
let myPeerId = null;
let peer = null;
let connections = []; // Активные P2P соединения
let bullets = [];
let lastTime = performance.now();

// ===== ИНИЦИАЛИЗАЦИЯ PEERJS =====
function initPeer() {
    // Генерируем случайный ID для стабильности
    const randomId = 'fps_' + Math.random().toString(36).substr(2, 9);
    
    peer = new Peer(randomId, {
        debug: 0,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        }
    });

    peer.on('open', (id) => {
        myPeerId = id;
        document.getElementById('my-peer-id').textContent = id;
        console.log('My peer ID:', id);
    });

    peer.on('connection', (conn) => {
        setupConnection(conn);
    });

    peer.on('error', (err) => {
        console.warn('Peer error:', err.type);
        // Игнорируем временные ошибки подключения
        if (err.type === 'unavailable-id' || err.type === 'network') {
            console.log('Попытка переподключения...');
            setTimeout(() => {
                if (peer && peer.disconnected) {
                    peer.reconnect();
                }
            }, 1000);
        }
    });

    peer.on('disconnected', () => {
        console.log('Отключено от сервера PeerJS. Переподключение...');
        setTimeout(() => {
            if (peer && !peer.destroyed) {
                peer.reconnect();
            }
        }, 2000);
    });
}

function setupConnection(conn) {
    connections.push(conn);

    conn.on('open', () => {
        console.log('Connected to:', conn.peer);
        updatePlayerCount();
        
        // Отправляем свою позицию новому игроку
        sendMyState(conn);
    });

    conn.on('data', (data) => {
        handleData(conn.peer, data);
    });

    conn.on('close', () => {
        removePlayer(conn.peer);
        connections = connections.filter(c => c.peer !== conn.peer);
        updatePlayerCount();
    });

    // Создаём визуальное представление удалённого игрока
    if (!players[conn.peer]) {
        createRemotePlayer(conn.peer);
    }
}

function sendMyState(conn) {
    const data = {
        type: 'state',
        position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        rotation: { x: camera.rotation.x, y: camera.rotation.y }
    };
    conn.send(data);
}

function broadcastState() {
    const data = {
        type: 'state',
        position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        rotation: { x: camera.rotation.x, y: camera.rotation.y }
    };
    connections.forEach(conn => {
        if (conn.open) {
            conn.send(data);
        }
    });
}

function handleData(peerId, data) {
    if (data.type === 'state') {
        updateRemotePlayer(peerId, data.position, data.rotation);
    } else if (data.type === 'bullet') {
        spawnRemoteBullet(data.position, data.direction);
    }
}

function updatePlayerCount() {
    const count = 1 + connections.length; // 1 = я сам
    document.getElementById('player-count').textContent = count;
}

function createRemotePlayer(peerId) {
    const geometry = new THREE.CapsuleGeometry(0.3, 1, 4, 8);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 1, 5);
    scene.add(mesh);

    players[peerId] = {
        mesh: mesh,
        position: new THREE.Vector3(0, 1, 5),
        rotation: new THREE.Euler(0, 0, 0)
    };
}

function updateRemotePlayer(peerId, position, rotation) {
    if (!players[peerId]) {
        createRemotePlayer(peerId);
    }
    const player = players[peerId];
    player.position.set(position.x, position.y, position.z);
    player.rotation.set(rotation.x, rotation.y, 0);
    player.mesh.position.copy(player.position);
    player.mesh.rotation.y = player.rotation.y;
}

function removePlayer(peerId) {
    if (players[peerId]) {
        scene.remove(players[peerId].mesh);
        players[peerId].mesh.geometry.dispose();
        players[peerId].mesh.material.dispose();
        delete players[peerId];
    }
}

function connectToPeer() {
    const peerId = document.getElementById('peer-id-input').value.trim();
    if (!peerId || peerId === myPeerId) return;
    
    if (!peer || !myPeerId) {
        alert('Ещё не подключился к серверу. Подожди пару секунд...');
        return;
    }

    try {
        const conn = peer.connect(peerId, {
            reliable: true
        });
        setupConnection(conn);
        console.log('Подключаюсь к:', peerId);
    } catch (err) {
        console.error('Ошибка подключения:', err);
        alert('Не удалось подключиться. Проверь ID и попробуй снова.');
    }
}

// ===== THREE.JS СЦЕНА =====
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

    // Мой игрок (виден другим, не мне)
    players['me'] = { mesh: null, position: camera.position.clone() };
}

function createMap() {
    // Пол
    const floorGeometry = new THREE.PlaneGeometry(100, 100);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x4a4a4a,
        roughness: 0.8,
        metalness: 0.2
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Сетка на полу
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

    // Платформы
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
    return box;
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

    // Клавиатура
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

    // Стрельба
    document.addEventListener('mousedown', (event) => {
        if (event.button === 0 && controls.isLocked) {
            shoot();
        }
    });
}

// ===== СТРЕЛЬБА =====
function shoot() {
    const bulletGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);

    bullet.position.copy(camera.position);
    
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    
    bullet.userData.velocity = direction.multiplyScalar(50);
    bullet.userData.life = 2; // секунды
    
    scene.add(bullet);
    bullets.push(bullet);

    // Отправляем другим игрокам
    const data = {
        type: 'bullet',
        position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        direction: { x: direction.x, y: direction.y, z: direction.z }
    };
    connections.forEach(conn => {
        if (conn.open) {
            conn.send(data);
        }
    });
}

function spawnRemoteBullet(position, direction) {
    const bulletGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);

    bullet.position.set(position.x, position.y, position.z);
    
    const dir = new THREE.Vector3(direction.x, direction.y, direction.z);
    bullet.userData.velocity = dir.multiplyScalar(50);
    bullet.userData.life = 2;
    
    scene.add(bullet);
    bullets.push(bullet);
}

function updateBullets(delta) {
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
}

// ===== ИГРОВОЙ ЦИКЛ =====
function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - lastTime) / 1000;
    lastTime = time;

    if (controls.isLocked) {
        // Физика движения
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 9.8 * 2.0 * delta; // Гравитация

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        const speed = 100.0;
        if (moveForward || moveBackward) velocity.z -= direction.z * speed * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * speed * delta;

        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);
        camera.position.y += velocity.y * delta;

        // Проверка пола
        if (camera.position.y < playerHeight) {
            camera.position.y = playerHeight;
            velocity.y = 0;
            canJump = true;
        }

        // Границы карты
        camera.position.x = Math.max(-48, Math.min(48, camera.position.x));
        camera.position.z = Math.max(-48, Math.min(48, camera.position.z));

        // Отправляем свою позицию каждые 50мс
        if (Math.floor(time / 50) !== Math.floor((time - delta * 1000) / 50)) {
            broadcastState();
        }
    }

    updateBullets(delta);
    renderer.render(scene, camera);
}

// ===== ПОДКЛЮЧЕНИЕ =====
function init() {
    initPeer();
    initScene();
    setupControls();

    document.getElementById('connect-form').addEventListener('submit', (e) => {
        e.preventDefault();
        connectToPeer();
        document.getElementById('peer-id-input').value = '';
    });

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Показываем игру
    document.getElementById('menu').classList.remove('hidden');
    document.getElementById('game-container').classList.remove('hidden');

    animate();
}

init();
