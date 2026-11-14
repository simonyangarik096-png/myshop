document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('cartWrap')) return;
  if (!API.user()) {
    window.location.href = '/login.html';
    return;
  }
  loadCart();
});

async function loadCart() {
  const wrap = document.getElementById('cartWrap');
  try {
    const data = await API.get('/api/cart');

    if (data.items.length === 0) {
      wrap.innerHTML = `<div class="empty">${t('cart.empty')}. <a href="/">${t('nav.shop')}</a></div>`;
      return;
    }

    wrap.innerHTML = `
      <div class="cart-list">
        ${data.items.map(it => `
          <div class="cart-item" data-id="${it.id}">
            <img src="${it.image_path || 'https://via.placeholder.com/80'}" alt="${escapeHtml(it.title)}" />
            <div>
              <div class="cart-item-title">${escapeHtml(it.title)}</div>
              <div class="cart-item-shop">${escapeHtml(it.shop_name)}</div>
              <div style="color:var(--primary);font-weight:600;margin-top:4px">${Number(it.price).toFixed(2)} ֏</div>
            </div>
            <div class="cart-item-qty">
              <button class="btn btn-outline btn-sm" data-dec>−</button>
              <input type="number" value="${it.qty}" min="1" max="${it.stock}" data-qty />
              <button class="btn btn-outline btn-sm" data-inc>+</button>
            </div>
            <button class="btn btn-danger btn-sm cart-item-remove" data-remove>${t('cart.remove')}</button>
          </div>
        `).join('')}
      </div>

      <div class="cart-summary">
        <div class="cart-summary-row">
          <span>${t('cart.total')}:</span>
          <span>${Number(data.total).toFixed(2)} ֏</span>
        </div>
        <button class="btn btn-primary btn-block" id="btnCheckout">${t('cart.checkout')} →</button>
      </div>
    `;

    // Event listeners
    wrap.querySelectorAll('.cart-item').forEach(item => {
      const id = item.dataset.id;
      const qtyInput = item.querySelector('[data-qty]');

      item.querySelector('[data-inc]').addEventListener('click', () => {
        qtyInput.value = parseInt(qtyInput.value) + 1;
        updateQty(id, parseInt(qtyInput.value));
      });
      item.querySelector('[data-dec]').addEventListener('click', () => {
        const v = Math.max(1, parseInt(qtyInput.value) - 1);
        qtyInput.value = v;
        updateQty(id, v);
      });
      qtyInput.addEventListener('change', () => {
        const v = Math.max(1, parseInt(qtyInput.value) || 1);
        qtyInput.value = v;
        updateQty(id, v);
      });
      item.querySelector('[data-remove]').addEventListener('click', async () => {
        await API.del('/api/cart/' + id);
        loadCart();
      });
    });

    document.getElementById('btnCheckout').addEventListener('click', showCheckout);
  } catch (e) {
    wrap.innerHTML = `<div class="empty">${t('common.error')}: ${e.message}</div>`;
  }
}

async function updateQty(id, qty) {
  try {
    await API.put('/api/cart/' + id, { qty });
    loadCart();
  } catch (e) {
    alert(e.message);
    loadCart();
  }
}

async function showCheckout() {
  const wrap = document.getElementById('cartWrap');
  const data = await API.get('/api/cart');

  wrap.innerHTML = `
    <h2 style="margin:20px 0">${t('order.title')}</h2>
    <form id="checkoutForm" class="checkout-grid">
      <div>
        <div class="form-group">
          <label>${t('order.customerName')}</label>
          <input type="text" id="customer_name" required />
        </div>
        <div class="form-group">
          <label>${t('order.phone')}</label>
          <input type="tel" id="phone" required />
        </div>
        <div class="form-group">
          <label>${t('order.address')}</label>
          <textarea id="address" rows="3" required></textarea>
        </div>
        <div class="form-group">
          <label>${t('order.note')}</label>
          <textarea id="note" rows="2"></textarea>
        </div>
      </div>
      <div>
        <div class="form-group">
          <label>${t('order.payment')}</label>
          <select id="payment_method">
            <option value="cod">${t('order.cod')}</option>
            <option value="transfer">${t('order.transfer')}</option>
          </select>
        </div>
        <div class="cart-summary">
          <div class="cart-summary-row">
            <span>${t('cart.total')}:</span>
            <span>${Number(data.total).toFixed(2)} ֏</span>
          </div>
          <button type="submit" class="btn btn-primary btn-block">${t('order.submit')}</button>
          <p id="msg" class="form-error"></p>
        </div>
      </div>
    </form>
  `;

  document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('msg');
    msg.textContent = '';

    try {
      await API.post('/api/orders', {
        payment_method: document.getElementById('payment_method').value,
        customer_name: document.getElementById('customer_name').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        address: document.getElementById('address').value.trim(),
        note: document.getElementById('note').value.trim()
      });
      wrap.innerHTML = `<div class="empty">✅ ${t('status.new')} #<br><a href="/">${t('nav.home')}</a></div>`;
    } catch (err) {
      msg.textContent = err.message;
    }
  });
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}