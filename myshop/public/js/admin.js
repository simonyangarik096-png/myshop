document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('adminWrap')) return;

  const user = API.user();
  if (!user) {
    window.location.href = '/login.html';
    return;
  }
  if (user.role !== 'admin') {
    window.location.href = '/';
    return;
  }

  initAdmin();
});

async function initAdmin() {
  const wrap = document.getElementById('adminWrap');
  try {
    const { stats } = await API.get('/api/admin/stats');

    wrap.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Օգտատերեր</div>
          <div class="stat-value">${stats.users}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Սպասող հայտեր</div>
          <div class="stat-value" style="color:#f59e0b">${stats.shops_pending}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Հաստատված խանութներ</div>
          <div class="stat-value" style="color:#16a34a">${stats.shops_approved}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Ապրանքներ</div>
          <div class="stat-value">${stats.products}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Պատվերներ</div>
          <div class="stat-value">${stats.orders}</div>
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap">
        <button class="btn btn-primary" id="tabShops">Խանութներ</button>
        <button class="btn btn-outline" id="tabUsers">Օգտատերեր</button>
      </div>

      <div id="adminContent"></div>
    `;

    document.getElementById('tabShops').addEventListener('click', () => {
      setAdminTab('tabShops');
      renderShops();
    });
    document.getElementById('tabUsers').addEventListener('click', () => {
      setAdminTab('tabUsers');
      renderUsers();
    });

    renderShops();
  } catch (e) {
    wrap.innerHTML = `<div class="empty">${t('common.error')}: ${e.message}</div>`;
  }
}

function setAdminTab(activeId) {
  ['tabShops', 'tabUsers'].forEach(id => {
    const b = document.getElementById(id);
    if (!b) return;
    b.className = id === activeId ? 'btn btn-primary' : 'btn btn-outline';
  });
}

// ============ ԽԱՆՈՒԹՆԵՐ ============
async function renderShops() {
  const el = document.getElementById('adminContent');
  el.innerHTML = `<div class="loading">${t('common.loading')}</div>`;
  try {
    const { shops } = await API.get('/api/admin/shops');
    if (shops.length === 0) {
      el.innerHTML = `<div class="empty">${t('common.empty')}</div>`;
      return;
    }
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px">
        ${shops.map(s => `
          <div class="cart-item" style="grid-template-columns:1fr auto auto">
            <div>
              <div class="cart-item-title">${escapeHtml(s.name)}</div>
              <div class="cart-item-shop">${s.user_email} · ${s.type === 'maker' ? t('filter.makers') : t('filter.resellers')}</div>
              <div class="cart-item-shop">${escapeHtml(s.description || '')}</div>
            </div>
            <span class="product-badge ${badgeClass(s.status)}">${t('admin.' + s.status)}</span>
            <div style="display:flex;gap:6px">
              ${s.status === 'pending' || s.status === 'rejected' ? `
                <button class="btn btn-primary btn-sm" data-approve="${s.id}">✓</button>
              ` : ''}
              ${s.status === 'pending' || s.status === 'approved' ? `
                <button class="btn btn-danger btn-sm" data-reject="${s.id}">✕</button>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    el.querySelectorAll('[data-approve]').forEach(b => {
      b.addEventListener('click', async () => {
        try { await API.post('/api/admin/shops/' + b.dataset.approve + '/approve'); renderShops(); }
        catch (e) { alert(e.message); }
      });
    });
    el.querySelectorAll('[data-reject]').forEach(b => {
      b.addEventListener('click', async () => {
        try { await API.post('/api/admin/shops/' + b.dataset.reject + '/reject'); renderShops(); }
        catch (e) { alert(e.message); }
      });
    });
  } catch (e) {
    el.innerHTML = `<div class="empty">${t('common.error')}: ${e.message}</div>`;
  }
}

// ============ ՕԳՏԱՏԵՐԵՐ ============
async function renderUsers() {
  const el = document.getElementById('adminContent');
  el.innerHTML = `<div class="loading">${t('common.loading')}</div>`;
  try {
    const { users } = await API.get('/api/admin/users');
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px">
        ${users.map(u => `
          <div class="cart-item" style="grid-template-columns:1fr auto auto">
            <div>
              <div class="cart-item-title">${escapeHtml(u.name)}</div>
              <div class="cart-item-shop">${escapeHtml(u.email)} · ${u.role}</div>
            </div>
            <span class="product-badge ${u.status === 'active' ? 'badge-maker' : 'badge-reseller'}">
              ${u.status}
            </span>
            <div>
              ${u.role !== 'admin' ? `
                ${u.status === 'active'
                  ? `<button class="btn btn-danger btn-sm" data-block="${u.id}">${t('admin.block')}</button>`
                  : `<button class="btn btn-primary btn-sm" data-unblock="${u.id}">${t('admin.unblock')}</button>`}
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
    el.querySelectorAll('[data-block]').forEach(b => {
      b.addEventListener('click', async () => {
        try { await API.post('/api/admin/users/' + b.dataset.block + '/block'); renderUsers(); }
        catch (e) { alert(e.message); }
      });
    });
    el.querySelectorAll('[data-unblock]').forEach(b => {
      b.addEventListener('click', async () => {
        try { await API.post('/api/admin/users/' + b.dataset.unblock + '/unblock'); renderUsers(); }
        catch (e) { alert(e.message); }
      });
    });
  } catch (e) {
    el.innerHTML = `<div class="empty">${t('common.error')}: ${e.message}</div>`;
  }
}

function badgeClass(s) {
  return {
    pending: 'badge-reseller',
    approved: 'badge-maker',
    rejected: 'badge-reseller'
  }[s] || '';
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}