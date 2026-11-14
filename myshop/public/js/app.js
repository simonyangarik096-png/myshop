// ========== API helper ==========
const API = {
  token() {
    return localStorage.getItem('token');
  },
  user() {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  },
  setAuth(token, user) {
    if (token) localStorage.setItem('token', token);
    if (user) localStorage.setItem('user', JSON.stringify(user));
    updateNavbar();
  },
  clearAuth() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    updateNavbar();
  },
  async req(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (API.token()) headers['Authorization'] = 'Bearer ' + API.token();
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }
    const res = await fetch(path, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  },
  get(path) { return API.req(path); },
  post(path, body) { return API.req(path, { method: 'POST', body }); },
  put(path, body) { return API.req(path, { method: 'PUT', body }); },
  del(path) { return API.req(path, { method: 'DELETE' }); }
};

// ========== Navbar-ի թարմացում ==========
function updateNavbar() {
  const user = API.user();
  const btnLogin = document.getElementById('btnLogin');
  const btnLogout = document.getElementById('btnLogout');
  const navDashboard = document.getElementById('navDashboard');
  const navAdmin = document.getElementById('navAdmin');

  if (user) {
    if (btnLogin) btnLogin.style.display = 'none';
    if (btnLogout) btnLogout.style.display = 'inline-block';
    if (navDashboard) navDashboard.style.display = user.role === 'maker' || user.role === 'reseller' ? 'inline-block' : 'none';
    if (navAdmin) navAdmin.style.display = user.role === 'admin' ? 'inline-block' : 'none';
  } else {
    if (btnLogin) btnLogin.style.display = 'inline-block';
    if (btnLogout) btnLogout.style.display = 'none';
    if (navDashboard) navDashboard.style.display = 'none';
    if (navAdmin) navAdmin.style.display = 'none';
  }
}

// Logout
document.addEventListener('DOMContentLoaded', () => {
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      API.clearAuth();
      window.location.href = '/';
    });
  }
  updateNavbar();

  // Գլխավոր էջի կատալոգ
  if (document.getElementById('productsGrid')) {
    initCatalog();
  }
});

// ========== Կատալոգ ==========
let currentFilters = { type: '', category: '', q: '', page: 1 };

async function initCatalog() {
  // Filter chips
  document.querySelectorAll('.chip[data-type]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilters.type = chip.dataset.type;
      currentFilters.page = 1;
      loadProducts();
    });
  });

  // Search
  const searchInput = document.getElementById('searchInput');
  const btnSearch = document.getElementById('btnSearch');
  if (btnSearch) {
    btnSearch.addEventListener('click', () => {
      currentFilters.q = searchInput.value.trim();
      currentFilters.page = 1;
      loadProducts();
    });
  }
  if (searchInput) {
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        currentFilters.q = searchInput.value.trim();
        currentFilters.page = 1;
        loadProducts();
      }
    });
  }

  // Category
  const catSel = document.getElementById('categorySelect');
  if (catSel) {
    catSel.addEventListener('change', () => {
      currentFilters.category = catSel.value;
      currentFilters.page = 1;
      loadProducts();
    });
  }

  loadProducts();
}

async function loadProducts() {
  const grid = document.getElementById('productsGrid');
  const pag = document.getElementById('pagination');
  if (!grid) return;
  grid.innerHTML = `<div class="loading">${t('common.loading')}</div>`;
  if (pag) pag.innerHTML = '';

  const params = new URLSearchParams();
  if (currentFilters.type) params.set('type', currentFilters.type);
  if (currentFilters.category) params.set('category', currentFilters.category);
  if (currentFilters.q) params.set('q', currentFilters.q);
  params.set('page', currentFilters.page);
  params.set('limit', 12);

  try {
    const data = await API.get('/api/products?' + params.toString());
    if (data.products.length === 0) {
      grid.innerHTML = `<div class="empty">${t('common.empty')}</div>`;
      return;
    }
    grid.innerHTML = data.products.map(p => productCard(p)).join('');
    renderPagination(data.pagination);
  } catch (e) {
    grid.innerHTML = `<div class="empty">${t('common.error')}: ${e.message}</div>`;
  }
}

function productCard(p) {
  const img = p.image_path || 'https://via.placeholder.com/300x200?text=No+Image';
  const badge = p.shop_type === 'maker'
    ? `<span class="product-badge badge-maker">${t('filter.makers')}</span>`
    : `<span class="product-badge badge-reseller">${t('filter.resellers')}</span>`;
  return `
    <a href="/product.html?id=${p.id}" class="product-card">
      <img src="${img}" alt="${escapeHtml(p.title)}" class="product-image" loading="lazy" />
      <div class="product-body">
        <div class="product-title">${escapeHtml(p.title)}</div>
        <div class="product-shop">${badge}${escapeHtml(p.shop_name)}</div>
        <div class="product-price">${Number(p.price).toFixed(2)} ֏</div>
      </div>
    </a>
  `;
}

function renderPagination(p) {
  const pag = document.getElementById('pagination');
  if (!pag || p.pages <= 1) return;
  let html = '';
  if (p.page > 1) {
    html += `<button data-page="${p.page - 1}">‹</button>`;
  }
  for (let i = 1; i <= p.pages; i++) {
    html += `<button data-page="${i}" class="${i === p.page ? 'active' : ''}">${i}</button>`;
  }
  if (p.page < p.pages) {
    html += `<button data-page="${p.page + 1}">›</button>`;
  }
  pag.innerHTML = html;
  pag.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      currentFilters.page = parseInt(b.dataset.page);
      loadProducts();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}