document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const refToken = urlParams.get('ref');
  const storedToken = localStorage.getItem('referralToken');

  if (refToken && refToken === storedToken) {
    fetchUserData(refToken);
  } else {
    document.getElementById('username').textContent = 'Не авторизован';
    document.getElementById('referral-link').textContent = 'Не сгенерирована';
  }

  window.TelegramLoginWidget = {
    dataOnauth: (user) => handleTelegramAuth(user)
  };
});

async function handleTelegramAuth(user) {
  try {
    const response = await fetch('https://aboba.qwertyuiop19818.workers.dev/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    const data = await response.json();
    
    localStorage.setItem('referralToken', data.referralToken);
    document.getElementById('username').textContent = data.username || 'No username';
    document.getElementById('referral-link').href = `https://fillsteam.ru/?ref=${data.referralToken}`;
    document.getElementById('referral-link').textContent = `https://fillsteam.ru/?ref=${data.referralToken}`;
  } catch (error) {
    console.error('Ошибка авторизации:', error);
    document.getElementById('username').textContent = 'Ошибка авторизации';
  }
}

async function fetchUserData(token) {
  try {
    const response = await fetch(`https://aboba.qwertyuiop19818.workers.dev/user?token=${token}`);
    const data = await response.json();
    if (data.username) {
      document.getElementById('username').textContent = data.username;
      document.getElementById('referral-link').href = `https://fillsteam.ru/?ref=${token}`;
      document.getElementById('referral-link').textContent = `https://fillsteam.ru/?ref=${token}`;
    } else {
      localStorage.removeItem('referralToken');
      document.getElementById('username').textContent = 'Токен недействителен';
    }
  } catch (error) {
    console.error('Ошибка получения данных:', error);
    document.getElementById('username').textContent = 'Ошибка';
  }
}
