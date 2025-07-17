window.TelegramLoginWidget = {
  dataOnauth: (user) => {
    console.log('Получены данные от Telegram:', user); // Отладка
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
      console.log('Ответ от API:', data); // Отладка
      if (data.message) {
        document.getElementById('status').textContent = data.message;
      } else {
        document.getElementById('status').textContent = 'Ошибка: нет данных';
      }
    })
    .catch(error => {
      console.error('Ошибка авторизации:', error);
      document.getElementById('status').textContent = `Ошибка: ${error.message}`;
    });
  }
};
