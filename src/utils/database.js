// src/utils/database.js
const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/supercompare.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

let db = null;

async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  // טען DB קיים או צור חדש
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // שמור ל-disk אחרי כל שינוי
  db._save = () => {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  };

  // צור טבלאות
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      barcode         TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      manufacturer    TEXT,
      unit_qty        TEXT,
      quantity        REAL,
      unit_of_measure TEXT,
      updated_at      INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS stores (
      store_key   TEXT PRIMARY KEY,
      chain_id    TEXT NOT NULL,
      store_id    TEXT NOT NULL,
      store_name  TEXT,
      address     TEXT,
      city        TEXT,
      lat         REAL,
      lng         REAL
    );

    CREATE TABLE IF NOT EXISTS prices (
      barcode       TEXT NOT NULL,
      chain_id      TEXT NOT NULL,
      chain_name    TEXT,
      store_id      TEXT NOT NULL,
      price         REAL NOT NULL,
      sale_price    REAL,
      is_sale       INTEGER DEFAULT 0,
      update_date   TEXT,
      updated_at    INTEGER DEFAULT (strftime('%s','now')),
      PRIMARY KEY (barcode, chain_id, store_id)
    );

    CREATE TABLE IF NOT EXISTS update_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      chain_id   TEXT,
      status     TEXT,
      message    TEXT,
      records    INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE INDEX IF NOT EXISTS idx_prices_barcode ON prices(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_name  ON products(name);
  `);

  db._save();
  console.log('✅ Database מוכן');
  return db;
}

// עזר: run עם שמירה
function runAndSave(db, sql, params = []) {
  db.run(sql, params);
  db._save();
}

module.exports = { getDb, runAndSave };
