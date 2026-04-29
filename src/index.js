// src/index.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cron = require('node-cron');
const https = require('https');
const fs = require('fs');
const path = require('path');

const { getDb } = require('./utils/database');
const { updateAllPrices } = require('./services/priceUpdater');
const productsRouter = require('./routes/products');

const app = express();
const PORT = process.env.PORT || 3000;

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_REPO = 'assaf35/supercompare-data';
const DB_PATH = path.join(__dirname, '../data/supercompare.db');

// ─── Download DB from GitHub ──────────────────────────────────────────────────
async function downloadDbFromGitHub() {
  return new Promise((resolve) => {
    console.log('⬇️  Downloading DB from GitHub...');

    const req = https.request({
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_REPO}/contents/supercompare.db`,
      method: 'GET',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'User-Agent': 'supercompare-backend',
        'Accept': 'application/vnd.github.v3+json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.content) {
            const buffer = Buffer.from(json.content, 'base64');
            fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
            fs.writeFileSync(DB_PATH, buffer);
            console.log(`✅ DB downloaded! (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
            resolve(true);
          } else {
            console.log('⚠️  No DB file found on GitHub');
            resolve(false);
          }
        } catch(e) {
          console.error('❌ Error downloading DB:', e.message);
          resolve(false);
        }
      });
    });

    req.on('error', (e) => {
      console.error('❌ GitHub request error:', e.message);
      resolve(false);
    });

    req.end();
  });
}

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());

app.use('/api/v1/products', productsRouter);

app.get('/health', async (req, res) => {
  try {
    const db = await getDb();
    const prodCount = db.exec('SELECT COUNT(*) FROM products')[0]?.values[0]?.[0] || 0;
    const priceCount = db.exec('SELECT COUNT(*) FROM prices')[0]?.values[0]?.[0] || 0;
    res.json({ status: 'ok', products: prodCount, prices: priceCount });
  } catch (err) {
    res.json({ status: 'error', error: err.message });
  }
});

// עדכון מחירים כל יום ב-03:00
cron.schedule('0 3 * * *', async () => {
  console.log('⏰ Cron: עדכון יומי...');
  await updateAllPrices();
}, { timezone: 'Asia/Jerusalem' });

app.listen(PORT, async () => {
  console.log(`🚀 SuperCompare Backend running on port ${PORT}`);

  // Try to download DB from GitHub first
  const dbExists = fs.existsSync(DB_PATH);
  if (!dbExists) {
    const downloaded = await downloadDbFromGitHub();
    if (!downloaded) {
      console.log('📦 No DB available — will start empty');
    }
  }

  const db = await getDb();
  const count = db.exec('SELECT COUNT(*) FROM prices')[0]?.values[0]?.[0] || 0;
  console.log(`✅ ${count} prices in database`);
});