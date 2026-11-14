document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('shopWrap')) return;
  const params = new URLSearchParams(window.location.search);
  const sellerId = params.get('seller');
  if (sellerId) {
    renderShopDetail(sellerId);
  } else {
    renderShopsList();
  }
});

// ============ ԽԱՆՈՒԹՆԵՐԻ ՑԱՆԿ ============
async function renderShopsList() {
  const wrap = document.getElementById('shopWrap');
  wrap.innerHTML = `
    <h1 style="margin-bottom:16px">Խանութներ</h1>
    <div class="hero-filters" style="margin-bottom:20px">
      <button class="chip active" data-type="">${t('filter.all')}</button>
      <button class="chip" data-type="maker">${t('filter.makers')}</button>
      <button class="chip" data-type="reseller">${t('filter.resellers')}</button>
    </div>
    <div id="shopsGrid" class="products-grid">
      <div class="loading">${t('common.loading')}</div>
    </div>
  `;

  // chip-երը այստեղ սպիտակ ֆոն ունեն, ուղղենք
  wrap.querySelectorAll('.chip').forEach(c => {
    c.style.borderColor = 'var(--border)';
    c.style.color = 'var(--text)';
    c.addEventListener('click', () => {
      wrap.querySelectorAll('.chip').forEach(x => {
        x.classList.remove('active');
        x.style.background = '';
        x.style.color = 'var(--text)';
      });
      c.classList.add('active');
      c.style.background = 'var(--primary)';
      c.style.color = '#fff';
      loadShops(c.dataset.type);
    });
  });

  loadShops('');
}

async function loadShops(type) {
  const grid = document.getElementById('shopsGrid');
  if (!grid) return;
  grid.innerHTML = `<div class="loading">${t('common.loading')}</div>`;
  try {
    const data = await API.get('/api/sellers' + (type ? '?type=' + type : ''));
    if (data.shops.length === 0) {
      grid.innerHTML = `<div class="empty">${t('common.empty')}</div>`;
      return;
    }
    grid.innerHTML = data.shops.map(s => {
      const badge = s.type === 'maker'
        ? `<span class="product-badge badge-maker">${t('filter.makers')}</span>`
        : `<span class="product-badge badge-reseller">${t('filter.resellers')}</span>`;
      return `
        <a href="/shop.html?seller=${s.id}" class="product-card" style="padding:20px">
          <div style="font-size:36px;margin-bottom:8px">🏪</div>
          <div class="product-title">${escapeHtml(s.name)}</div>
          <div style="margin:6px 0">${badge}</div>
          <div class="product-shop">${escapeHtml(s.description || '')}</div>
        </a>
      `;
    }).join('');
  } catch (e) {
    grid.innerHTML = `<div class="empty">${t('common.error')}: ${e.message}</div>`;
  }
}

// ============ ԱՆՀԱՏԱԿԱՆ ԽԱՆՈՒԹ ============
async function renderShopDetail(id) {
  const wrap = document.getElementById('shopWrap');
  try {
    const data = await API.get('/api/sellers/' + id);
    const s = data.shop;
    const badge = s.type === 'maker'
      ? `<span class="product-badge badge-maker">${t('filter.makers')}</span>`
      : `<span class="product-badge badge-reseller">${t('filter.resellers')}</span>`;

    wrap.innerHTML = `
      <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:24px;margin-bottom:20px">
        <h1>${escapeHtml(s.name)}</h1>
        <div style="margin:8px 0">${badge}</div>
        <p style="color:var(--muted)">${escapeHtml(s.description || '')}</p>
        ${s.phone ? `<p>📞 ${escapeHtml(s.phone)}</p>` : ''}
      </div>
      <h2 style="margin-bottom:16px">${t('dashboard.myProducts')}</h2>
      ${data.products.length === 0
        ? `<div class="empty">${t('common.empty')}</div>`
        : `<div class="products-grid">${data.products.map(p => productCard(p, s)).join('')}</div>`}
    `;
  } catch (e) {
    wrap.innerHTML = `<div class="empty">${t('common.error')}: ${e.message}</div>`;
  }
}

function productCard(p, shop) {
  const img = p.image_path || 'https://via.placeholder.com/300x200?text=No+Image';
  return `
    <a href="/product.html?id=${p.id}" class="product-card">
      <img src="${img}" alt="${escapeHtml(p.title)}" class="product-image" loading="lazy" />
      <div class="product-body">
        <div class="product-title">${escapeHtml(p.title)}</div>
        <div class="product-price">${Number(p.price).toFixed(2)} ֏</div>
      </div>
    </a>
  `;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}