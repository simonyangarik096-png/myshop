document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('dashWrap')) return;

  const user = API.user();
  if (!user) {
    window.location.href = '/login.html';
    return;
  }
  if (user.role === 'admin') {
    window.location.href = '/admin.html';
    return;
  }
  if (user.role === 'buyer') {
    renderApplyForm();
    return;
  }
  initDashboard();
});

// ============ ԲՈՒՅԵՐ — ՎԱՃԱՌՈՂ ԴԱՌՆԱԼՈՒ ՀԱՅՏ ============
function renderApplyForm() {
  const wrap = document.getElementById('dashWrap');
  wrap.innerHTML = `
    <form class="form-card" id="applyForm" style="max-width:520px">
      <h2 data-i18n="dashboard.applyShop">Վաճառող դառնալ</h2>

      <div class="form-group">
        <label data-i18n="auth.role">Տիպ</label>
        <select id="type">
          <option value="maker" data-i18n="auth.roleMaker">Արտադրող</option>
          <option value="reseller" data-i18n="auth.roleReseller">Վերավաճառող</option>
        </select>
      </div>

      <div class="form-group">
        <label>Խանութի անվանում</label>
        <input type="text" id="shopName" required />
      </div>

      <div class="form-group">
        <label>Նկարագրություն</label>
        <textarea id="shopDesc" rows="3"></textarea>
      </div>

      <div class="form-group">
        <label>Հեռախոս</label>
        <input type="tel" id="shopPhone" />
      </div>

      <button type="submit" class="btn btn-primary btn-block">Ուղարկել հայտը</button>
      <p id="msg" class="form-error"></p>
    </form>
  `;

  document.getElementById('applyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('msg');
    msg.textContent = '';
    try {
      await API.post('/api/sellers/apply', {
        type: document.getElementById('type').value,
        name: document.getElementById('shopName').value.trim(),
        description: document.getElementById('shopDesc').value.trim(),
        phone: document.getElementById('shopPhone').value.trim()
      });
      // Թարմացնել localStorage-ը (դերը փոխվել է)
      const me = await API.get('/api/auth/me');
      localStorage.setItem('user', JSON.stringify(me.user));
      updateNavbar();
      initDashboard();
    } catch (err) {
      msg.textContent = err.message;
    }
  });
}

// ============ ՎԱՃԱՌՈՂԻ ՎԱՀԱՆԱԿ ============
async function initDashboard() {
  const wrap = document.getElementById('dashWrap');

  try {
    // 1. Ստանալ խանութի վիճակը
    let shop = null;
    try {
      const s = await API.get('/api/sellers/me');
      shop = s.shop;
    } catch {
      // չկա հայտ
    }

    if (!shop) {
      renderApplyForm();
      return;
    }

    if (shop.status === 'pending') {
      wrap.innerHTML = `<div class="empty">⏳ Հայտը սպասում է հաստատման։<br><a href="/">${t('nav.home')}</a></div>`;
      return;
    }
    if (shop.status === 'rejected') {
      wrap.innerHTML = `<div class="empty">❌ Հայտը մերժվել է։<br><a href="/">${t('nav.home')}</a></div>`;
      return;
    }

    // Հաստատված է
    renderTabs(shop);
  } catch (e) {
    wrap.innerHTML = `<div class="empty">${t('common.error')}: ${e.message}</div>`;
  }
}

function renderTabs(shop) {
  const wrap = document.getElementById('dashWrap');
  wrap.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:20px">
      <h2>${escapeHtml(shop.name)}</h2>
      <p style="color:var(--muted)">${shop.type === 'maker' ? t('filter.makers') : t('filter.resellers')} · ${escapeHtml(shop.description || '')}</p>
      <a href="/shop.html?seller=${shop.id}" target="_blank">→ Հանրային էջ</a>
    </div>

    <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap">
      <button class="btn btn-primary" id="tabProducts" data-i18n="dashboard.myProducts">Իմ ապրանքները</button>
      <button class="btn btn-outline" id="tabOrders" data-i18n="dashboard.orders">Պատվերները</button>
      <button class="btn btn-outline" id="tabAdd" data-i18n="dashboard.addProduct">Ավելացնել ապրանք</button>
    </div>

    <div id="tabContent"></div>
  `;

  document.getElementById('tabProducts').addEventListener('click', () => {
    setActiveTab('tabProducts');
    renderMyProducts();
  });
  document.getElementById('tabOrders').addEventListener('click', () => {
    setActiveTab('tabOrders');
    renderMyOrders();
  });
  document.getElementById('tabAdd').addEventListener('click', () => {
    setActiveTab('tabAdd');
    renderAddProduct();
  });

  renderMyProducts();
}

function setActiveTab(activeId) {
  ['tabProducts', 'tabOrders', 'tabAdd'].forEach(id => {
    const b = document.getElementById(id);
    if (!b) return;
    b.className = id === activeId ? 'btn btn-primary' : 'btn btn-outline';
  });
}

// ============ ԻՄ ԱՊՐԱՆՔՆԵՐԸ ============
async function renderMyProducts() {
  const el = document.getElementById('tabContent');
  el.innerHTML = `<div class="loading">${t('common.loading')}</div>`;
  try {
    const data = await API.get('/api/products/mine/list');
    if (data.products.length === 0) {
      el.innerHTML = `<div class="empty">${t('common.empty')}</div>`;
      return;
    }
    el.innerHTML = `
      <div class="products-grid">
        ${data.products.map(p => `
          <div class="product-card" style="position:relative">
            <img src="${p.image_path || 'https://via.placeholder.com/300x200'}" class="product-image" alt="" />
            <div class="product-body">
              <div class="product-title">${escapeHtml(p.title)}</div>
              <div class="product-shop">${Number(p.price).toFixed(2)} ֏ · ${t('product.stock')}: ${p.stock}</div>
              <div style="display:flex;gap:6px;margin-top:8px">
                <button class="btn btn-outline btn-sm" data-edit="${p.id}">✏️</button>
                <button class="btn btn-danger btn-sm" data-del="${p.id}">🗑️</button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    el.querySelectorAll('[data-del]').forEach(b => {
      b.addEventListener('click', async () => {
        if (!confirm('Ջնջե՞լ ապրանքը')) return;
        try {
          await API.del('/api/products/' + b.dataset.del);
          renderMyProducts();
        } catch (e) { alert(e.message); }
      });
    });
    el.querySelectorAll('[data-edit]').forEach(b => {
      b.addEventListener('click', () => renderEditProduct(parseInt(b.dataset.edit)));
    });
  } catch (e) {
    el.innerHTML = `<div class="empty">${t('common.error')}: ${e.message}</div>`;
  }
}

// ============ ԱՎԵԼԱՑՆԵԼ ԱՊՐԱՆՔ ============
async function renderAddProduct() {
  const el = document.getElementById('tabContent');
  el.innerHTML = `
    <form class="form-card" id="productForm" style="max-width:520px">
      <h2>Ավելացնել ապրանք</h2>
      <div class="form-group">
        <label>Անվանում</label>
        <input type="text" id="pTitle" required />
      </div>
      <div class="form-group">
        <label>Նկարագրություն</label>
        <textarea id="pDesc" rows="3"></textarea>
      </div>
      <div class="form-group">
        <label>Գին (֏)</label>
        <input type="number" id="pPrice" step="0.01" min="0" required />
      </div>
      <div class="form-group">
        <label>Պաշար</label>
        <input type="number" id="pStock" min="0" value="0" required />
      </div>
      <div class="form-group">
        <label>Կատեգորիա</label>
        <select id="pCategory">
          <option value="">—</option>
          <option value="1">Հագուստ</option>
          <option value="2">Սնունդ</option>
          <option value="3">Ձեռագործ</option>
          <option value="4">Էլեկտրոնիկա</option>
        </select>
      </div>
      <div class="form-group">
        <label>Նկար (պարտադիր)</label>
        <input type="file" id="pImage" accept="image/*" required />
      </div>
      <button type="submit" class="btn btn-primary btn-block">Ավելացնել</button>
      <p id="msg" class="form-error"></p>
    </form>
  `;

  document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('msg');
    msg.textContent = '';
    msg.className = 'form-error';

    const fd = new FormData();
    fd.append('title', document.getElementById('pTitle').value.trim());
    fd.append('description', document.getElementById('pDesc').value.trim());
    fd.append('price', document.getElementById('pPrice').value);
    fd.append('stock', document.getElementById('pStock').value);
    const cat = document.getElementById('pCategory').value;
    if (cat) fd.append('category_id', cat);
    const img = document.getElementById('pImage').files[0];
    if (!img) { msg.textContent = 'Նկարը պարտադիր է'; return; }
    fd.append('image', img);

    try {
      await API.req('/api/products', { method: 'POST', body: fd });
      msg.className = 'form-success';
      msg.textContent = '✓ Ավելացվեց';
      setActiveTab('tabProducts');
      renderMyProducts();
    } catch (err) {
      msg.textContent = err.message;
    }
  });
}

// ============ ԽՄԲԱԳՐԵԼ ԱՊՐԱՆՔ ============
async function renderEditProduct(id) {
  const el = document.getElementById('tabContent');
  el.innerHTML = `<div class="loading">${t('common.loading')}</div>`;
  try {
    const data = await API.get('/api/products/' + id);
    const p = data.product;
    el.innerHTML = `
      <form class="form-card" id="editForm" style="max-width:520px">
        <h2>Խմբագրել ապրանք</h2>
        <div class="form-group"><label>Անվանում</label><input type="text" id="eTitle" value="${escapeAttr(p.title)}" required /></div>
        <div class="form-group"><label>Նկարագրություն</label><textarea id="eDesc" rows="3">${escapeHtml(p.description || '')}</textarea></div>
        <div class="form-group"><label>Գին</label><input type="number" id="ePrice" step="0.01" min="0" value="${p.price}" required /></div>
        <div class="form-group"><label>Պաշար</label><input type="number" id="eStock" min="0" value="${p.stock}" required /></div>
        <div class="form-group"><label>Կատեգորիա</label>
          <select id="eCategory">
            <option value="">—</option>
            <option value="1">Հագուստ</option><option value="2">Սնունդ</option>
            <option value="3">Ձեռագործ</option><option value="4">Էլեկտրոնիկա</option>
          </select>
        </div>
        <div class="form-group"><label>Նոր նկար (ըստ ցանկության)</label><input type="file" id="eImage" accept="image/*" /></div>
        <button type="submit" class="btn btn-primary btn-block">Պահպանել</button>
        <p id="msg" class="form-error"></p>
      </form>
    `;
    if (p.category_id) document.getElementById('eCategory').value = String(p.category_id);

    document.getElementById('editForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('msg');
      const fd = new FormData();
      fd.append('title', document.getElementById('eTitle').value.trim());
      fd.append('description', document.getElementById('eDesc').value.trim());
      fd.append('price', document.getElementById('ePrice').value);
      fd.append('stock', document.getElementById('eStock').value);
      const cat = document.getElementById('eCategory').value;
      if (cat) fd.append('category_id', cat);
      const img = document.getElementById('eImage').files[0];
      if (img) fd.append('image', img);

      try {
        await API.req('/api/products/' + id, { method: 'PUT', body: fd });
        setActiveTab('tabProducts');
        renderMyProducts();
      } catch (err) { msg.textContent = err.message; }
    });
  } catch (e) {
    el.innerHTML = `<div class="empty">${t('common.error')}: ${e.message}</div>`;
  }
}

// ============ ԻՄ ՊԱՏՎԵՐՆԵՐԸ ============
async function renderMyOrders() {
  const el = document.getElementById('tabContent');
  el.innerHTML = `<div class="loading">${t('common.loading')}</div>`;
  try {
    const data = await API.get('/api/orders/seller/list');
    if (data.items.length === 0) {
      el.innerHTML = `<div class="empty">${t('common.empty')}</div>`;
      return;
    }
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px">
        ${data.items.map(it => `
          <div class="cart-item" style="grid-template-columns:1fr auto">
            <div>
              <div class="cart-item-title">${escapeHtml(it.title_snapshot)} × ${it.qty}</div>
              <div class="cart-item-shop">#${it.order_id} · ${escapeHtml(it.customer_name)} · ${escapeHtml(it.phone)}</div>
              <div class="cart-item-shop">${escapeHtml(it.address)}</div>
              <div style="margin-top:6px">
                <span class="product-badge ${badgeClass(it.order_status)}">${t('status.' + it.order_status)}</span>
              </div>
            </div>
            <div>
              <select data-status="${it.order_id}" style="padding:6px;border:1px solid var(--border);border-radius:6px">
                ${['confirmed','shipped','delivered','cancelled'].map(s => `
                  <option value="${s}" ${it.order_status === s ? 'selected' : ''}>${t('status.' + s)}</option>
                `).join('')}
              </select>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    el.querySelectorAll('[data-status]').forEach(sel => {
      sel.addEventListener('change', async () => {
        try {
          await API.put('/api/orders/' + sel.dataset.status + '/status', { status: sel.value });
          renderMyOrders();
        } catch (e) { alert(e.message); }
      });
    });
  } catch (e) {
    el.innerHTML = `<div class="empty">${t('common.error')}: ${e.message}</div>`;
  }
}

function badgeClass(s) {
  return {
    new: 'badge-reseller', confirmed: 'badge-reseller',
    shipped: 'badge-maker', delivered: 'badge-maker',
    cancelled: 'badge-reseller'
  }[s] || '';
}

// ============ Utils ============
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }