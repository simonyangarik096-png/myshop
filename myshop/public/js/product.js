document.addEventListener('DOMContentLoaded', async () => {
  const wrap = document.getElementById('productWrap');
  if (!wrap) return;

  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) {
    wrap.innerHTML = `<div class="empty">${t('common.error')}: No product ID</div>`;
    return;
  }

  try {
    const data = await API.get('/api/products/' + id);
    const p = data.product;
    const img = p.image_path || 'https://via.placeholder.com/500x400?text=No+Image';
    const badge = p.shop_type === 'maker'
      ? `<span class="product-badge badge-maker">${t('filter.makers')}</span>`
      : `<span class="product-badge badge-reseller">${t('filter.resellers')}</span>`;

    wrap.innerHTML = `
      <div class="product-detail">
        <div class="product-detail-img">
          <img src="${img}" alt="${escapeHtml(p.title)}" />
        </div>
        <div class="product-detail-info">
          <h1>${escapeHtml(p.title)}</h1>
          <div class="product-shop">${badge}<a href="/shop.html?seller=${p.shop_id}">${escapeHtml(p.shop_name)}</a></div>
          <div class="product-price" style="font-size:28px;margin:16px 0">${Number(p.price).toFixed(2)} ֏</div>
          <p style="color:var(--muted);margin-bottom:8px">${t('product.stock')}: ${p.stock}</p>
          <p style="margin:16px 0">${escapeHtml(p.description || '')}</p>

          <div class="form-group" style="max-width:120px">
            <label>Qty</label>
            <input type="number" id="qty" value="1" min="1" max="${p.stock}" />
          </div>

          <button class="btn btn-primary" id="btnAdd" ${p.stock < 1 ? 'disabled' : ''}>
            🛒 ${t('product.addToCart')}
          </button>

          <p id="msg" class="form-error"></p>
        </div>
      </div>
    `;

    document.getElementById('btnAdd').addEventListener('click', async () => {
      const qty = parseInt(document.getElementById('qty').value) || 1;
      const msg = document.getElementById('msg');
      msg.textContent = '';
      msg.className = 'form-error';

      if (!API.user()) {
        window.location.href = '/login.html';
        return;
      }

      try {
        await API.post('/api/cart', { product_id: p.id, qty });
        msg.className = 'form-success';
        msg.textContent = '✓';
        msg.textContent = '✓ Added';
      } catch (err) {
        msg.textContent = err.message;
      }
    });
  } catch (e) {
    wrap.innerHTML = `<div class="empty">${t('common.error')}: ${e.message}</div>`;
  }
});

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}