const express = require('express');
const { db } = require('../db');
const { authRequired, requireRole } = require('../auth');

const router = express.Router();
router.use(authRequired, requireRole('admin'));

router.get('/stats', async (req, res) => {
  const users = await db.execute('SELECT COUNT(*) AS c FROM users');
  const pending = await db.execute("SELECT COUNT(*) AS c FROM shops WHERE status = 'pending'");
  const approved = await db.execute("SELECT COUNT(*) AS c FROM shops WHERE status = 'approved'");
  const products = await db.execute('SELECT COUNT(*) AS c FROM products');
  const orders = await db.execute('SELECT COUNT(*) AS c FROM orders');

  res.json({
    stats: {
      users: users.rows[0].c,
      shops_pending: pending.rows[0].c,
      shops_approved: approved.rows[0].c,
      products: products.rows[0].c,
      orders: orders.rows[0].c
    }
  });
});

router.get('/shops', async (req, res) => {
  const { status } = req.query;
  let sql = `SELECT s.*, u.email AS user_email, u.name AS user_name
             FROM shops s JOIN users u ON u.id = s.user_id`;
  const args = [];
  if (status && ['pending', 'approved', 'rejected'].includes(status)) {
    sql += ' WHERE s.status = ?';
    args.push(status);
  }
  sql += ' ORDER BY s.created_at DESC';
  const result = await db.execute({ sql, args });
  res.json({ shops: result.rows });
});

router.post('/shops/:id/approve', async (req, res) => {
  const shopRes = await db.execute({
    sql: 'SELECT * FROM shops WHERE id = ?',
    args: [req.params.id]
  });
  const shop = shopRes.rows[0];
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  if (shop.status === 'approved') return res.status(400).json({ error: 'Already approved' });

  await db.execute({ sql: "UPDATE shops SET status = 'approved' WHERE id = ?", args: [shop.id] });
  await db.execute({ sql: 'UPDATE users SET role = ? WHERE id = ?', args: [shop.type, shop.user_id] });

  res.json({ ok: true, shop_id: shop.id, status: 'approved' });
});

router.post('/shops/:id/reject', async (req, res) => {
  const shopRes = await db.execute({
    sql: 'SELECT * FROM shops WHERE id = ?',
    args: [req.params.id]
  });
  if (shopRes.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });

  await db.execute({
    sql: "UPDATE shops SET status = 'rejected' WHERE id = ?",
    args: [req.params.id]
  });
  res.json({ ok: true, shop_id: Number(req.params.id), status: 'rejected' });
});

router.get('/users', async (req, res) => {
  const result = await db.execute(
    'SELECT id, email, name, role, status, lang, created_at FROM users ORDER BY created_at DESC'
  );
  res.json({ users: result.rows });
});

router.post('/users/:id/block', async (req, res) => {
  const userRes = await db.execute({
    sql: 'SELECT id, role FROM users WHERE id = ?',
    args: [req.params.id]
  });
  const user = userRes.rows[0];
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role === 'admin') return res.status(400).json({ error: 'Cannot block admin' });

  await db.execute({
    sql: "UPDATE users SET status = 'blocked' WHERE id = ?",
    args: [user.id]
  });
  res.json({ ok: true, user_id: user.id, status: 'blocked' });
});

router.post('/users/:id/unblock', async (req, res) => {
  const userRes = await db.execute({
    sql: 'SELECT id FROM users WHERE id = ?',
    args: [req.params.id]
  });
  if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });

  await db.execute({
    sql: "UPDATE users SET status = 'active' WHERE id = ?",
    args: [req.params.id]
  });
  res.json({ ok: true, user_id: Number(req.params.id), status: 'active' });
});

module.exports = router;