window.TelegramLoginWidget = {
  dataOnauth: (user) => {
    // Отладка на странице
    document.getElementById('debug').textContent = 'Получены данные: ' + JSON.stringify(user);
    if (!user || !user.id || !user.hash) {
      document.getElementById('status').textContent = 'Ошибка: недействительные данные';
      document.getElementById('debug').textContent += ' (Данные некорректны)';
      return;
    }

    fetch('https://v0-testapi.vercel.app/api/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      return response.json();
    })
    .then(data => {
      document.getElementById('status').textContent = data.message || 'Успешно, но без сообщения';
      document.getElementById('debug').textContent += ' | Ответ: ' + JSON.stringify(data);
    })
    .catch(error => {
      document.getElementById('status').textContent = `Ошибка: ${error.message}`;
      document.getElementById('debug').textContent += ' | Ошибка: ' + error.message;
    });
  }
};
