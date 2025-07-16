document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const refToken = urlParams.get('ref');
  const storedToken = localStorage.getItem('referralToken');
  const storedUsername = localStorage.getItem('username');

  if (refToken && refToken === storedToken && storedUsername) {
    document.getElementById('username').textContent = storedUsername;
    document.getElementById('referral-link').href = `https://fillsteam.ru/?ref=${refToken}`;
    document.getElementById('referral-link').textContent = `https://fillsteam.ru/?ref=${refToken}`;
  } else {
    document.getElementById('username').textContent = 'Не авторизован';
    document.getElementById('referral-link').textContent = 'Не сгенерирована';
  }

  window.TelegramLoginWidget = {
    dataOnauth: (user) => handleTelegramAuth(user)
  };
});

function generateReferralToken() {
  return btoa(`${Math.random().toString(36).substr(2)}:${Date.now()}`);
}

function handleTelegramAuth(user) {
  const referralToken = generateReferralToken();
  localStorage.setItem('referralToken', referralToken);
  localStorage.setItem('username', user.username || 'No username');
  document.getElementById('username').textContent = user.username || 'No username';
  document.getElementById('referral-link').href = `https://fillsteam.ru/?ref=${referralToken}`;
  document.getElementById('referral-link').textContent = `https://fillsteam.ru/?ref=${referralToken}`;
}
