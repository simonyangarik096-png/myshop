require('dotenv').config();
const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Սխեմայի ստեղծում (միայն առաջին գործարկման ժամանակ)
async function initSchema() {
  const stmts = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'buyer',
      status TEXT NOT NULL DEFAULT 'active',
      lang TEXT NOT NULL DEFAULT 'hy',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS shops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      phone TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      name_hy TEXT NOT NULL,
      name_ru TEXT NOT NULL,
      name_en TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER NOT NULL,
      category_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL CHECK (price >= 0),
      stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
      image_path TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      qty INTEGER NOT NULL DEFAULT 1 CHECK (qty > 0),
      UNIQUE(user_id, product_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      total REAL NOT NULL,
      payment_method TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      shop_id INTEGER NOT NULL,
      title_snapshot TEXT NOT NULL,
      price_snapshot REAL NOT NULL,
      qty INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id)`,
    `CREATE INDEX IF NOT EXISTS idx_products_cat ON products(category_id)`,
    `CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`,
    `CREATE INDEX IF NOT EXISTS idx_cart_user ON cart_items(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_shops_status ON shops(status)`
  ];

  for (const sql of stmts) {
    await db.execute(sql);
  }

  // Սկզբնական կատեգորիաներ
  const catCount = await db.execute('SELECT COUNT(*) AS c FROM categories');
  if (catCount.rows[0].c === 0) {
    await db.execute({
      sql: 'INSERT INTO categories (slug, name_hy, name_ru, name_en) VALUES (?, ?, ?, ?)',
      args: ['clothes', 'Հագուստ', 'Одежда', 'Clothes']
    });
    await db.execute({
      sql: 'INSERT INTO categories (slug, name_hy, name_ru, name_en) VALUES (?, ?, ?, ?)',
      args: ['food', 'Սնունդ', 'Еда', 'Food']
    });
    await db.execute({
      sql: 'INSERT INTO categories (slug, name_hy, name_ru, name_en) VALUES (?, ?, ?, ?)',
      args: ['handmade', 'Ձեռագործ', 'Ручная работа', 'Handmade']
    });
    await db.execute({
      sql: 'INSERT INTO categories (slug, name_hy, name_ru, name_en) VALUES (?, ?, ?, ?)',
      args: ['electronics', 'Էլեկտրոնիկա', 'Электроника', 'Electronics']
    });
  }

  // Սկզբնական admin
  const adminExists = await db.execute("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (adminExists.rows.length === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    await db.execute({
      sql: "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'admin')",
      args: ['admin@shop.local', hash, 'Admin']
    });
    console.log('✅ Ստեղծվեց admin՝ admin@shop.local / admin123');
  }
}

module.exports = { db, initSchema };