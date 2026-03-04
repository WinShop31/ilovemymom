// Глобальные переменные
let proxies = [];
let currentProxy = null;

// DOM элементы
const proxyList = document.getElementById('proxy-list');
const proxyCount = document.getElementById('proxy-count');
const emptyState = document.getElementById('empty-state');
const searchInput = document.getElementById('search');
const modal = document.getElementById('modal');
const modalClose = document.getElementById('modal-close');
const modalBody = document.getElementById('modal-body');
const connectBtn = document.getElementById('connect-btn');
const copyBtn = document.getElementById('copy-btn');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');

// Загрузка прокси
async function loadProxies() {
    try {
        const response = await fetch('proxies.json');
        if (!response.ok) {
            throw new Error('Не удалось загрузить proxies.json');
        }
        const data = await response.json();
        proxies = data.proxies || [];
        renderProxies(proxies);
        updateStats();
    } catch (error) {
        console.error('Ошибка загрузки прокси:', error);
        proxies = [];
        renderProxies([]);
        updateStats();
    }
}

// Обновление статистики
function updateStats() {
    proxyCount.textContent = proxies.length;
}

// Рендеринг прокси
function renderProxies(proxiesToRender) {
    if (proxiesToRender.length === 0) {
        proxyList.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    proxyList.style.display = 'grid';
    emptyState.style.display = 'none';

    proxyList.innerHTML = proxiesToRender.map(proxy => `
        <div class="proxy-card" data-id="${proxy.id}">
            <div class="proxy-info">
                <span class="proxy-country">${proxy.country || '🌐'}</span>
                <div class="proxy-details">
                    <h3>${proxy.name || 'Proxy'}</h3>
                    <div class="proxy-meta">
                        <span>${proxy.server || 'unknown'}</span>
                        <span>${proxy.port || '?'}</span>
                        ${proxy.speed ? `<span class="proxy-speed ${proxy.speed.toLowerCase()}">${proxy.speed}</span>` : ''}
                    </div>
                </div>
            </div>
            <span class="proxy-arrow">›</span>
        </div>
    `).join('');

    // Добавляем обработчики кликов
    document.querySelectorAll('.proxy-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = parseInt(card.dataset.id);
            const proxy = proxies.find(p => p.id === id);
            if (proxy) {
                openModal(proxy);
            }
        });
    });
}

// Поиск
function filterProxies(query) {
    const lowerQuery = query.toLowerCase().trim();
    
    if (!lowerQuery) {
        renderProxies(proxies);
        return;
    }

    const filtered = proxies.filter(proxy => 
        proxy.name?.toLowerCase().includes(lowerQuery) ||
        proxy.server?.toLowerCase().includes(lowerQuery) ||
        proxy.port?.includes(lowerQuery) ||
        proxy.country?.toLowerCase().includes(lowerQuery)
    );

    renderProxies(filtered);
}

// Открытие модального окна
function openModal(proxy) {
    currentProxy = proxy;
    
    modalBody.innerHTML = `
        <div class="modal-row">
            <span class="modal-label">Название</span>
            <span class="modal-value">${proxy.name || 'Proxy'}</span>
        </div>
        <div class="modal-row">
            <span class="modal-label">Сервер</span>
            <span class="modal-value">${proxy.server || 'unknown'}</span>
        </div>
        <div class="modal-row">
            <span class="modal-label">Порт</span>
            <span class="modal-value">${proxy.port || '?'}</span>
        </div>
        <div class="modal-row">
            <span class="modal-label">Secret</span>
            <span class="modal-value">${proxy.secret || '—'}</span>
        </div>
        <div class="modal-row">
            <span class="modal-label">Страна</span>
            <span class="modal-value">${proxy.country || '🌐'}</span>
        </div>
    `;

    connectBtn.href = proxy.url;
    
    modal.classList.add('active');
}

// Закрытие модального окна
function closeModal() {
    modal.classList.remove('active');
    currentProxy = null;
}

// Копирование прокси
function copyProxy() {
    if (!currentProxy) return;

    navigator.clipboard.writeText(currentProxy.url)
        .then(() => {
            showToast('✅ Прокси скопирован!');
        })
        .catch(() => {
            showToast('❌ Не удалось скопировать');
        });
}

// Показ уведомления
function showToast(message) {
    toastMessage.textContent = message;
    toast.classList.add('active');
    
    setTimeout(() => {
        toast.classList.remove('active');
    }, 2000);
}

// Обработчики событий
searchInput.addEventListener('input', (e) => {
    filterProxies(e.target.value);
});

modalClose.addEventListener('click', closeModal);

modal.querySelector('.modal-overlay').addEventListener('click', closeModal);

copyBtn.addEventListener('click', copyProxy);

// Закрытие по Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
        closeModal();
    }
});

// Инициализация
document.addEventListener('DOMContentLoaded', loadProxies);
