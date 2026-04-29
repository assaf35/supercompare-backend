// src/routes/products.js
const express = require('express');
const router = express.Router();
const { getDb } = require('../utils/database');

// ─── פונקציה לנרמול שם רשת ───────────────────────────────────────────────────
function normalizeChainName(name) {
  if (!name) return name;
  if (name.includes('יוחננוף') || name.includes('Yohananof')) return 'יוחננוף';
  if (name.includes('שופרסל') || name.includes('Shufersal')) return 'שופרסל';
  if (name.includes('רמי לוי') || name.includes('Rami')) return 'רמי לוי';
  if (name.includes('מגה') || name.includes('Mega')) return 'מגה';
  if (name.includes('ויקטורי') || name.includes('Victory')) return 'ויקטורי';
  if (name.includes('אושר עד') || name.includes('Osherad')) return 'אושר עד';
  if (name.includes('יינות ביתן')) return 'יינות ביתן';
  return name;
}

// ─── GET /api/v1/products/search?q=חלב ──────────────────────────────────────
router.get('/search', async (req, res) => {
  const { q, limit = 20, offset = 0 } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'נדרש פרמטר q (מינימום 2 תווים)' });
  }

  try {
    const db = await getDb();
    const term = `%${q.trim()}%`;

    const result = db.exec(`
      SELECT
        p.barcode, p.name, p.manufacturer,
        p.unit_qty, p.quantity, p.unit_of_measure,
        MIN(pr.price) as min_price,
        COUNT(DISTINCT pr.chain_name) as chain_count
      FROM products p
      LEFT JOIN prices pr ON p.barcode = pr.barcode
      WHERE p.name LIKE '${term.replace(/'/g,"''")}' 
         OR p.manufacturer LIKE '${term.replace(/'/g,"''")}' 
         OR p.barcode = '${q.trim().replace(/'/g,"''")}'
      GROUP BY p.barcode
      ORDER BY 
  CASE WHEN p.name LIKE '${q.trim().replace(/'/g,"''")}%' THEN 0
       WHEN p.name LIKE '%${q.trim().replace(/'/g,"''")}%' THEN 1
       ELSE 2 END,
  chain_count DESC,
  p.name
LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `);

    const rows = result[0] ? result[0].values.map(row => ({
      itemCode: row[0],
      itemName: row[1],
      manufacturerName: row[2] || '',
      unitQty: row[3] || '',
      quantity: row[4] || 0,
      unitOfMeasure: row[5] || '',
      minPrice: row[6],
      chainCount: row[7]
    })) : [];

    res.json({ found: rows.length, items: rows });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'שגיאת שרת', details: err.message });
  }
});

// ─── GET /api/v1/products/prices/:barcode ────────────────────────────────────
router.get('/prices/:barcode', async (req, res) => {
  const { barcode } = req.params;
  const { lat, lng, radius = 50 } = req.query;

  try {
    const db = await getDb();

    // שלוף את כל המחירים ונרמל בצד JS
    const result = db.exec(`
      SELECT
        pr.chain_id,
        pr.chain_name,
        pr.store_id,
        s.store_name, s.address, s.city, s.lat, s.lng,
        pr.price,
        pr.sale_price, pr.is_sale, pr.update_date
      FROM prices pr
      LEFT JOIN stores s ON s.store_key = pr.chain_id || '-' || pr.store_id
      WHERE pr.barcode = '${barcode.replace(/'/g,"''")}'
      ORDER BY pr.price ASC
    `);

    const prodResult = db.exec(`SELECT name FROM products WHERE barcode = '${barcode.replace(/'/g,"''")}'`);
    const itemName = prodResult[0]?.values[0]?.[0] || '';

    const rows = result[0] ? result[0].values : [];

    // קבץ לפי שם רשת מנורמל — שמור רק את הזול ביותר
    const chainMap = new Map();
    for (const row of rows) {
      const rawChainName = row[1] || getChainName(row[0]);
      const normalizedName = normalizeChainName(rawChainName);

      let distanceKm = null;
      if (lat && lng && row[6] && row[7]) {
        distanceKm = haversineKm(parseFloat(lat), parseFloat(lng), row[6], row[7]);
      }

      const entry = {
        chainId: row[0],
        chainName: normalizedName,
        storeId: row[2],
        storeName: row[3] || '',
        address: row[4] || '',
        city: row[5] || '',
        lat: row[6],
        lng: row[7],
        price: row[8],
        salePrice: row[9],
        isSale: row[10] === 1,
        priceUpdateDate: row[11] || '',
        distanceKm
      };

      // שמור רק את הזול ביותר לכל רשת מנורמלת
      const existing = chainMap.get(normalizedName);
		if (!existing || entry.price < existing.price || 
		(entry.price === existing.price && entry.priceUpdateDate > existing.priceUpdateDate)) {
		chainMap.set(normalizedName, entry);
}
    }

    let prices = Array.from(chainMap.values())
      .filter(p => !lat || !lng || p.distanceKm === null || p.distanceKm <= parseFloat(radius))
      .sort((a, b) => a.price - b.price);

    res.json({ barcode, item_name: itemName, prices });
  } catch (err) {
    console.error('Prices error:', err);
    res.status(500).json({ error: 'שגיאת שרת', details: err.message });
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function getChainName(chainId) {
  const map = {
    '7290027600007': 'שופרסל',
    '7290058140886': 'רמי לוי',
    '7290055700007': 'מגה',
    '7290696200003': 'ויקטורי',
    '7290103152017': 'יוחננוף',
    '7290873900009': 'אושר עד',
    '7290785400000': 'יינות ביתן',
  };
  return map[chainId] || chainId;
}

module.exports = router;