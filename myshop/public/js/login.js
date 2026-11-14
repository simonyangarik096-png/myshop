document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const msg = document.getElementById('msg');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    msg.className = 'form-error';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
      const data = await API.post('/api/auth/login', { email, password });
      API.setAuth(data.token, data.user);

      // Ուղղորդում ըստ դերի
      if (data.user.role === 'admin') {
        window.location.href = '/admin.html';
      } else if (data.user.role === 'maker' || data.user.role === 'reseller') {
        window.location.href = '/dashboard.html';
      } else {
        window.location.href = '/';
      }
    } catch (err) {
      msg.textContent = err.message;
    }
  });
});