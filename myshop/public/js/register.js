document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registerForm');
  const msg = document.getElementById('msg');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    msg.className = 'form-error';

    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;

    try {
      const data = await API.post('/api/auth/register', { name, email, password, role });
      API.setAuth(data.token, data.user);

      // Ուղղորդում
      if (role === 'maker' || role === 'reseller') {
        window.location.href = '/dashboard.html';
      } else {
        window.location.href = '/';
      }
    } catch (err) {
      msg.textContent = err.message;
    }
  });
});