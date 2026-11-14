const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { signToken, authRequired } = require('../auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role, lang } = req.body || {};

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'email, password, name required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const allowedRoles = ['buyer', 'maker', 'reseller'];
    const finalRole = allowedRoles.includes(role) ? role : 'buyer';
    const finalLang = ['hy', 'ru', 'en'].includes(lang) ? lang : 'hy';

    const exists = await db.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: [email]
    });
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hash = bcrypt.hashSync(password, 10);

    const info = await db.execute({
      sql: 'INSERT INTO users (email, password_hash, name, role, lang) VALUES (?, ?, ?, ?, ?)',
      args: [email, hash, name, finalRole, finalLang]
    });

    const userId = Number(info.lastInsertRowid);
    const userRes = await db.execute({
      sql: 'SELECT id, email, name, role, lang FROM users WHERE id = ?',
      args: [userId]
    });
    const user = userRes.rows[0];

    const token = signToken(user);
    res.status(201).json({ token, user });
  } catch (err) {
    console.error('register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }

    const result = await db.execute({
      sql: 'SELECT * FROM users WHERE email = ?',
      args: [email]
    });
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.status === 'blocked') return res.status(403).json({ error: 'Account blocked' });

    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      lang: user.lang
    };
    const token = signToken(safeUser);
    res.json({ token, user: safeUser });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me
router.get('/me', authRequired, async (req, res) => {
  const result = await db.execute({
    sql: 'SELECT id, email, name, role, lang, created_at FROM users WHERE id = ?',
    args: [req.user.id]
  });
  if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
  res.json({ user: result.rows[0] });
});

module.exports = router;