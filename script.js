// Замени на свои данные
const repoOwner = 'WinShop31'; // Твой логин на GitHub
const repoName = 'ilovemymom'; // Название репозитория

// Функция для получения списка файлов
async function fetchFiles() {
  try {
    const response = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/files`);
    const files = await response.json();
    
    if (!Array.isArray(files)) {
      console.error('Ошибка: файлы не найдены или неверный ответ API');
      return;
    }

    const fileList = document.getElementById('file-list');
    
    files.forEach(file => {
      // Предполагаем, что для каждого файла (например, example.zip) есть example.jpg и articles/fileN.html
      const fileName = file.name.split('.')[0]; // Убираем расширение
      const fileItem = document.createElement('div');
      fileItem.className = 'file-item';
      fileItem.innerHTML = `
        <img src="images/${fileName}.jpg" alt="${fileName}" class="file-image">
        <h2>${fileName}</h2>
        <a href="articles/file1.html" class="btn">Подробнее</a>
      `;
      fileList.appendChild(fileItem);
    });
  } catch (error) {
    console.error('Ошибка при загрузке файлов:', error);
    document.getElementById('file-list').innerHTML = '<p>Ошибка загрузки файлов</p>';
  }
}

// Запускаем функцию при загрузке страницы
document.addEventListener('DOMContentLoaded', fetchFiles);
