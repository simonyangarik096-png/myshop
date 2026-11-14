const express = require('express');
const { db } = require('../db');
const { authRequired } = require('../auth');

const router = express.Router();
router.use(authRequired);

router.get('/', async (req, res) => {
  const result = await db.execute({
    sql: `SELECT ci.id, ci.qty, ci.product_id,
                 p.title, p.price, p.stock, p.image_path,
                 s.id AS shop_id, s.name AS shop_name, s.type AS shop_type
          FROM cart_items ci
          JOIN products p ON p.id = ci.product_id
          JOIN shops s ON s.id = p.shop_id
          WHERE ci.user_id = ? AND s.status = 'approved'
          ORDER BY ci.id DESC`,
    args: [req.user.id]
  });
  const items = result.rows;
  const total = items.reduce((s, it) => s + it.price * it.qty, 0);
  res.json({ items, total: Math.round(total * 100) / 100 });
});

router.post('/', async (req, res) => {
  const { product_id, qty } = req.body || {};
  const qtyNum = parseInt(qty) || 1;
  if (!product_id) return res.status(400).json({ error: 'product_id required' });
  if (qtyNum < 1) return res.status(400).json({ error: 'qty must be >= 1' });

  const pRes = await db.execute({
    sql: `SELECT p.*, s.status AS shop_status FROM products p
          JOIN shops s ON s.id = p.shop_id WHERE p.id = ?`,
    args: [product_id]
  });
  const product = pRes.rows[0];
  if (!product || product.shop_status !== 'approved') {
    return res.status(404).json({ error: 'Product not available' });
  }

  const existRes = await db.execute({
    sql: 'SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?',
    args: [req.user.id, product_id]
  });
  const existing = existRes.rows[0];

  const newQty = (existing ? existing.qty : 0) + qtyNum;
  if (newQty > product.stock) {
    return res.status(400).json({ error: `Only ${product.stock} in stock` });
  }

  if (existing) {
    await db.execute({
      sql: 'UPDATE cart_items SET qty = ? WHERE id = ?',
      args: [newQty, existing.id]
    });
  } else {
    await db.execute({
      sql: 'INSERT INTO cart_items (user_id, product_id, qty) VALUES (?, ?, ?)',
      args: [req.user.id, product_id, qtyNum]
    });
  }
  res.json({ ok: true });
});

router.put('/:id', async (req, res) => {
  const { qty } = req.body || {};
  const qtyNum = parseInt(qty);
  if (!qtyNum || qtyNum < 1) return res.status(400).json({ error: 'qty >= 1' });

  const itemRes = await db.execute({
    sql: `SELECT ci.*, p.stock FROM cart_items ci
          JOIN products p ON p.id = ci.product_id
          WHERE ci.id = ? AND ci.user_id = ?`,
    args: [req.params.id, req.user.id]
  });
  const item = itemRes.rows[0];
  if (!item) return res.status(404).json({ error: 'Cart item not found' });
  if (qtyNum > item.stock) return res.status(400).json({ error: `Only ${item.stock} in stock` });

  await db.execute({
    sql: 'UPDATE cart_items SET qty = ? WHERE id = ?',
    args: [qtyNum, item.id]
  });
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  const info = await db.execute({
    sql: 'DELETE FROM cart_items WHERE id = ? AND user_id = ?',
    args: [req.params.id, req.user.id]
  });
  if (info.rowsAffected === 0) return res.status(404).json({ error: 'Cart item not found' });
  res.json({ ok: true });
});

router.delete('/', async (req, res) => {
  await db.execute({
    sql: 'DELETE FROM cart_items WHERE user_id = ?',
    args: [req.user.id]
  });
  res.json({ ok: true });
});

module.exports = router;