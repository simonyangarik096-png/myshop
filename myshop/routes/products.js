const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { db } = require('../db');
const { authRequired, requireRole } = require('../auth');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowed.includes(ext)) return cb(new Error('Only images allowed'));
  cb(null, true);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 3 * 1024 * 1024 } });

async function getApprovedShop(userId) {
  const res = await db.execute({
    sql: "SELECT * FROM shops WHERE user_id = ? AND status = 'approved'",
    args: [userId]
  });
  return res.rows[0];
}

// GET /api/products
router.get('/', async (req, res) => {
  const { type, category, q, min_price, max_price, page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  let where = "WHERE s.status = 'approved'";
  const args = [];

  if (type && ['maker', 'reseller'].includes(type)) {
    where += ' AND s.type = ?';
    args.push(type);
  }
  if (category) {
    where += ' AND c.slug = ?';
    args.push(category);
  }
  if (q) {
    where += ' AND (p.title LIKE ? OR p.description LIKE ?)';
    args.push(`%${q}%`, `%${q}%`);
  }
  if (min_price) { where += ' AND p.price >= ?'; args.push(parseFloat(min_price)); }
  if (max_price) { where += ' AND p.price <= ?'; args.push(parseFloat(max_price)); }

  const baseSql = `
    FROM products p
    JOIN shops s ON s.id = p.shop_id
    LEFT JOIN categories c ON c.id = p.category_id
    ${where}
  `;

  const countRes = await db.execute({ sql: `SELECT COUNT(*) AS c ${baseSql}`, args });
  const total = countRes.rows[0].c;

  const productsRes = await db.execute({
    sql: `SELECT p.id, p.title, p.price, p.stock, p.image_path,
                 p.created_at, p.shop_id, s.name AS shop_name, s.type AS shop_type,
                 c.slug AS category_slug, c.name_hy AS category_hy,
                 c.name_ru AS category_ru, c.name_en AS category_en
          ${baseSql}
          ORDER BY p.created_at DESC
          LIMIT ? OFFSET ?`,
    args: [...args, limitNum, offset]
  });

  res.json({
    products: productsRes.rows,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum)
    }
  });
});

router.get('/:id', async (req, res) => {
  const result = await db.execute({
    sql: `SELECT p.*, s.name AS shop_name, s.type AS shop_type,
                 c.slug AS category_slug, c.name_hy AS category_hy,
                 c.name_ru AS category_ru, c.name_en AS category_en
          FROM products p
          JOIN shops s ON s.id = p.shop_id
          LEFT JOIN categories c ON c.id = p.category_id
          WHERE p.id = ? AND s.status = 'approved'`,
    args: [req.params.id]
  });
  if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
  res.json({ product: result.rows[0] });
});

router.post('/', authRequired, requireRole('maker', 'reseller'), upload.single('image'), async (req, res) => {
  try {
    const shop = await getApprovedShop(req.user.id);
    if (!shop) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: 'You need an approved shop first' });
    }

    const { title, description, price, stock, category_id } = req.body || {};
    if (!title || price === undefined) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'title and price required' });
    }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'price must be >= 0' });
    }
    const stockNum = parseInt(stock) || 0;

    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    const info = await db.execute({
      sql: `INSERT INTO products (shop_id, category_id, title, description, price, stock, image_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [shop.id, category_id ? parseInt(category_id) : null, title, description || null, priceNum, stockNum, imagePath]
    });

    const productRes = await db.execute({
      sql: 'SELECT * FROM products WHERE id = ?',
      args: [Number(info.lastInsertRowid)]
    });
    res.status(201).json({ product: productRes.rows[0] });
  } catch (err) {
    console.error('create product error:', err);
    if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', authRequired, requireRole('maker', 'reseller'), upload.single('image'), async (req, res) => {
  try {
    const shop = await getApprovedShop(req.user.id);
    if (!shop) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: 'You need an approved shop first' });
    }

    const existingRes = await db.execute({
      sql: 'SELECT * FROM products WHERE id = ? AND shop_id = ?',
      args: [req.params.id, shop.id]
    });
    const existing = existingRes.rows[0];
    if (!existing) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Product not found or not yours' });
    }

    const { title, description, price, stock, category_id } = req.body || {};
    const newTitle = title !== undefined ? title : existing.title;
    const newDesc = description !== undefined ? description : existing.description;
    const newPrice = price !== undefined ? parseFloat(price) : existing.price;
    const newStock = stock !== undefined ? parseInt(stock) : existing.stock;
    const newCat = category_id !== undefined
      ? (category_id ? parseInt(category_id) : null)
      : existing.category_id;

    let imagePath = existing.image_path;
    if (req.file) {
      if (existing.image_path) {
        const oldPath = path.join(__dirname, '..', existing.image_path.replace(/^\//, ''));
        try { if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath); } catch {}
      }
      imagePath = `/uploads/${req.file.filename}`;
    }

    await db.execute({
      sql: `UPDATE products SET title = ?, description = ?, price = ?, stock = ?, category_id = ?, image_path = ?
            WHERE id = ?`,
      args: [newTitle, newDesc, newPrice, newStock, newCat, imagePath, existing.id]
    });

    const productRes = await db.execute({
      sql: 'SELECT * FROM products WHERE id = ?',
      args: [existing.id]
    });
    res.json({ product: productRes.rows[0] });
  } catch (err) {
    console.error('update product error:', err);
    if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', authRequired, requireRole('maker', 'reseller'), async (req, res) => {
  const shop = await getApprovedShop(req.user.id);
  if (!shop) return res.status(403).json({ error: 'You need an approved shop first' });

  const existingRes = await db.execute({
    sql: 'SELECT * FROM products WHERE id = ? AND shop_id = ?',
    args: [req.params.id, shop.id]
  });
  const existing = existingRes.rows[0];
  if (!existing) return res.status(404).json({ error: 'Product not found or not yours' });

  if (existing.image_path) {
    const imgPath = path.join(__dirname, '..', existing.image_path.replace(/^\//, ''));
    try { if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath); } catch {}
  }

  await db.execute({ sql: 'DELETE FROM products WHERE id = ?', args: [existing.id] });
  res.json({ ok: true, deleted_id: existing.id });
});

router.get('/mine/list', authRequired, requireRole('maker', 'reseller'), async (req, res) => {
  const shop = await getApprovedShop(req.user.id);
  if (!shop) return res.status(403).json({ error: 'You need an approved shop first' });

  const result = await db.execute({
    sql: `SELECT p.*, c.slug AS category_slug
          FROM products p LEFT JOIN categories c ON c.id = p.category_id
          WHERE p.shop_id = ? ORDER BY p.created_at DESC`,
    args: [shop.id]
  });
  res.json({ products: result.rows });
});

module.exports = router;