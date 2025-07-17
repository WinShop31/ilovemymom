window.TelegramLoginWidget = {
  dataOnauth: (user) => {
    fetch('https://v0-testapi.vercel.app/api/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    })
    .then(response => response.json())
    .then(data => {
      if (data.message) {
        document.getElementById('status').textContent = data.message;
      } else {
        document.getElementById('status').textContent = 'Ошибка: нет данных';
      }
    })
    .catch(error => {
      console.error('Ошибка авторизации:', error);
      document.getElementById('status').textContent = 'Ошибка сети';
    });
  }
};
