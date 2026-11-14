const express = require('express');
const { db } = require('../db');
const { authRequired } = require('../auth');

const router = express.Router();

router.post('/apply', authRequired, async (req, res) => {
  try {
    const { type, name, description, phone } = req.body || {};

    if (!type || !name) return res.status(400).json({ error: 'type and name required' });
    if (!['maker', 'reseller'].includes(type)) {
      return res.status(400).json({ error: 'type must be maker or reseller' });
    }
    if (req.user.role === 'admin') {
      return res.status(400).json({ error: 'Admin cannot apply as seller' });
    }

    const existing = await db.execute({
      sql: 'SELECT id, status FROM shops WHERE user_id = ?',
      args: [req.user.id]
    });
    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: 'You already have a shop application',
        shop_id: existing.rows[0].id,
        status: existing.rows[0].status
      });
    }

    const info = await db.execute({
      sql: 'INSERT INTO shops (user_id, type, name, description, phone, status) VALUES (?, ?, ?, ?, ?, ?)',
      args: [req.user.id, type, name, description || null, phone || null, 'pending']
    });

    if (req.user.role === 'buyer') {
      await db.execute({
        sql: 'UPDATE users SET role = ? WHERE id = ?',
        args: [type, req.user.id]
      });
    }

    const shopRes = await db.execute({
      sql: 'SELECT * FROM shops WHERE id = ?',
      args: [Number(info.lastInsertRowid)]
    });
    res.status(201).json({ shop: shopRes.rows[0] });
  } catch (err) {
    console.error('apply error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', authRequired, async (req, res) => {
  const result = await db.execute({
    sql: 'SELECT * FROM shops WHERE user_id = ?',
    args: [req.user.id]
  });
  if (result.rows.length === 0) return res.status(404).json({ error: 'No shop application' });
  res.json({ shop: result.rows[0] });
});

router.get('/:id', async (req, res) => {
  const shopRes = await db.execute({
    sql: "SELECT id, type, name, description, phone, created_at FROM shops WHERE id = ? AND status = 'approved'",
    args: [req.params.id]
  });
  if (shopRes.rows.length === 0) {
    return res.status(404).json({ error: 'Shop not found or not approved' });
  }
  const shop = shopRes.rows[0];
  const productsRes = await db.execute({
    sql: 'SELECT id, title, price, stock, image_path FROM products WHERE shop_id = ? ORDER BY created_at DESC',
    args: [shop.id]
  });
  res.json({ shop, products: productsRes.rows });
});

router.get('/', async (req, res) => {
  const { type } = req.query;
  let sql = "SELECT id, type, name, description, created_at FROM shops WHERE status = 'approved'";
  const args = [];
  if (type && ['maker', 'reseller'].includes(type)) {
    sql += ' AND type = ?';
    args.push(type);
  }
  sql += ' ORDER BY created_at DESC LIMIT 100';
  const result = await db.execute({ sql, args });
  res.json({ shops: result.rows });
});

module.exports = router;