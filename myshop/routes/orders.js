const express = require('express');
const { db } = require('../db');
const { authRequired } = require('../auth');

const router = express.Router();
router.use(authRequired);

router.post('/', async (req, res) => {
  const { payment_method, customer_name, phone, address, note } = req.body || {};

  if (!payment_method || !['transfer', 'cod'].includes(payment_method)) {
    return res.status(400).json({ error: 'payment_method must be transfer or cod' });
  }
  if (!customer_name || !phone || !address) {
    return res.status(400).json({ error: 'customer_name, phone, address required' });
  }

  const cartRes = await db.execute({
    sql: `SELECT ci.id AS cart_id, ci.qty, p.id AS product_id, p.title, p.price, p.stock,
                 p.shop_id, s.status AS shop_status
          FROM cart_items ci
          JOIN products p ON p.id = ci.product_id
          JOIN shops s ON s.id = p.shop_id
          WHERE ci.user_id = ?`,
    args: [req.user.id]
  });
  const cartItems = cartRes.rows;

  if (cartItems.length === 0) return res.status(400).json({ error: 'Cart is empty' });

  for (const it of cartItems) {
    if (it.shop_status !== 'approved') {
      return res.status(400).json({ error: `Product "${it.title}" is no longer available` });
    }
    if (it.qty > it.stock) {
      return res.status(400).json({ error: `Not enough stock for "${it.title}"` });
    }
  }

  const total = cartItems.reduce((s, it) => s + it.price * it.qty, 0);
  const totalRounded = Math.round(total * 100) / 100;

  const orderInfo = await db.execute({
    sql: `INSERT INTO orders (user_id, status, total, payment_method, customer_name, phone, address, note)
          VALUES (?, 'new', ?, ?, ?, ?, ?, ?)`,
    args: [req.user.id, totalRounded, payment_method, customer_name, phone, address, note || null]
  });
  const orderId = Number(orderInfo.lastInsertRowid);

  for (const it of cartItems) {
    await db.execute({
      sql: `INSERT INTO order_items (order_id, product_id, shop_id, title_snapshot, price_snapshot, qty)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [orderId, it.product_id, it.shop_id, it.title, it.price, it.qty]
    });
    await db.execute({
      sql: 'UPDATE products SET stock = stock - ? WHERE id = ?',
      args: [it.qty, it.product_id]
    });
  }

  await db.execute({
    sql: 'DELETE FROM cart_items WHERE user_id = ?',
    args: [req.user.id]
  });

  const orderRes = await db.execute({
    sql: 'SELECT * FROM orders WHERE id = ?',
    args: [orderId]
  });
  res.status(201).json({ order: orderRes.rows[0] });
});

router.get('/', async (req, res) => {
  const ordersRes = await db.execute({
    sql: 'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
    args: [req.user.id]
  });
  const orders = ordersRes.rows;
  for (const o of orders) {
    const itemsRes = await db.execute({
      sql: 'SELECT * FROM order_items WHERE order_id = ?',
      args: [o.id]
    });
    o.items = itemsRes.rows;
  }
  res.json({ orders });
});

router.get('/:id', async (req, res) => {
  const orderRes = await db.execute({
    sql: 'SELECT * FROM orders WHERE id = ? AND user_id = ?',
    args: [req.params.id, req.user.id]
  });
  const order = orderRes.rows[0];
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const itemsRes = await db.execute({
    sql: 'SELECT * FROM order_items WHERE order_id = ?',
    args: [order.id]
  });
  order.items = itemsRes.rows;
  res.json({ order });
});

router.get('/seller/list', async (req, res) => {
  const shopRes = await db.execute({
    sql: "SELECT * FROM shops WHERE user_id = ? AND status = 'approved'",
    args: [req.user.id]
  });
  const shop = shopRes.rows[0];
  if (!shop) return res.status(403).json({ error: 'You need an approved shop' });

  const result = await db.execute({
    sql: `SELECT oi.*, o.status AS order_status, o.customer_name, o.phone, o.address,
                 o.payment_method, o.created_at AS order_created_at, o.id AS order_id
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
          WHERE oi.shop_id = ?
          ORDER BY o.created_at DESC`,
    args: [shop.id]
  });
  res.json({ items: result.rows });
});

router.put('/:id/status', async (req, res) => {
  const { status } = req.body || {};
  const allowed = ['confirmed', 'shipped', 'delivered', 'cancelled'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
  }

  const orderRes = await db.execute({
    sql: 'SELECT * FROM orders WHERE id = ?',
    args: [req.params.id]
  });
  const order = orderRes.rows[0];
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const shopRes = await db.execute({
    sql: "SELECT * FROM shops WHERE user_id = ? AND status = 'approved'",
    args: [req.user.id]
  });
  const shop = shopRes.rows[0];
  if (!shop) return res.status(403).json({ error: 'You need an approved shop' });

  const hasItem = await db.execute({
    sql: 'SELECT 1 FROM order_items WHERE order_id = ? AND shop_id = ? LIMIT 1',
    args: [order.id, shop.id]
  });
  if (hasItem.rows.length === 0) {
    return res.status(403).json({ error: 'This order has no items from your shop' });
  }

  await db.execute({
    sql: 'UPDATE orders SET status = ? WHERE id = ?',
    args: [status, order.id]
  });
  res.json({ ok: true, order_id: order.id, status });
});

module.exports = router;