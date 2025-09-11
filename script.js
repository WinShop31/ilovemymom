// Указываем правильные данные
const repoOwner = 'WinShop31'; // Твой логин на GitHub
const repoName = 'ilovemymom'; // Название репозитория

// Функция для получения списка файлов
async function fetchFiles() {
  const loading = document.getElementById('loading');
  const error = document.getElementById('error');
  const fileList = document.getElementById('file-list');

  try {
    loading.style.display = 'block';
    error.style.display = 'none';

    const response = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/files`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        // Раскомментированная строка для токена, замените ВАШ_ТОКЕН на реальный токен
        'Authorization': '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'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ошибка: ${response.status} ${response.statusText}`);
    }

    const files = await response.json();
    console.log('Ответ API:', files); // Для отладки

    if (!Array.isArray(files)) {
      throw new Error('Неверный формат ответа API или папка files пуста');
    }

    loading.style.display = 'none';

    if (files.length === 0) {
      error.style.display = 'block';
      error.textContent = 'Папка files пуста';
      return;
    }

    files.forEach(file => {
      // Предполагаем, что для файла (например, example.zip) есть example.jpg и articles/example.html
      const fileName = file.name.split('.')[0]; // Убираем расширение
      const fileItem = document.createElement('div');
      fileItem.className = 'file-item';
      fileItem.innerHTML = `
        <img src="images/${fileName}.jpg" alt="${fileName}" class="file-image" onerror="this.src='images/placeholder.jpg'">
        <h2>${fileName}</h2>
        <a href="articles/${fileName}.html" class="btn">Подробнее</a>
      `;
      fileList.appendChild(fileItem);
    });
  } catch (err) {
    console.error('Ошибка при загрузке файлов:', err);
    loading.style.display = 'none';
    error.style.display = 'block';
    error.textContent = `Ошибка: ${err.message}. Проверь консоль для деталей.`;
  }
}

// Запускаем функцию при загрузке страницы
document.addEventListener('DOMContentLoaded', fetchFiles);
