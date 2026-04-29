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
const GITHUB_OWNER = 'assaf35';
const GITHUB_REPO = 'supercompare-data';
const DB_PATH = path.join(__dirname, '../data/supercompare.db');

// ─── Download DB from GitHub Releases ────────────────────────────────────────
async function downloadDbFromGitHub() {
  if (!GITHUB_TOKEN) {
    console.log('⚠️  No GITHUB_TOKEN');
    return false;
  }

  return new Promise((resolve) => {
    console.log('⬇️  Getting DB download URL from GitHub Releases...');

    const req = https.request({
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tags/latest-db`,
      method: 'GET',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'User-Agent': 'supercompare-backend',
        'Accept': 'application/vnd.github.v3+json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', async () => {
        try {
          const release = JSON.parse(data);
          const asset = (release.assets || []).find(a => a.name === 'supercompare.db');

          if (!asset) {
            console.log('⚠️  No DB asset found in release');
            resolve(false);
            return;
          }

          console.log(`  📦 Found DB asset (${(asset.size / 1024 / 1024).toFixed(2)} MB)`);

          // Download the asset
          const downloaded = await downloadFile(asset.url);
          if (downloaded) {
            fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
            fs.writeFileSync(DB_PATH, downloaded);
            console.log(`✅ DB downloaded! (${(downloaded.length / 1024 / 1024).toFixed(2)} MB)`);
            resolve(true);
          } else {
            resolve(false);
          }
        } catch(e) {
          console.error('❌ Error:', e.message);
          resolve(false);
        }
      });
    });

    req.on('error', (e) => { console.error('❌', e.message); resolve(false); });
    req.end();
  });
}

function downloadFile(url) {
  return new Promise((resolve) => {
    const req = https.request(url, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'User-Agent': 'supercompare-backend',
        'Accept': 'application/octet-stream'
      }
    }, (res) => {
      // Follow redirect
      if (res.statusCode === 302 || res.statusCode === 301) {
        const redirectUrl = new URL(res.headers.location);
        const req2 = https.get(redirectUrl, (res2) => {
          const chunks = [];
          res2.on('data', c => chunks.push(c));
          res2.on('end', () => resolve(Buffer.concat(chunks)));
        });
        req2.on('error', () => resolve(null));
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', () => resolve(null));
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

cron.schedule('0 3 * * *', async () => {
  console.log('⏰ Cron: daily update...');
  await updateAllPrices();
}, { timezone: 'Asia/Jerusalem' });

app.listen(PORT, () => {
  console.log(`🚀 SuperCompare Backend running on port ${PORT}`);

  setTimeout(async () => {
    console.log('📦 Downloading DB from GitHub Releases...');
    const downloaded = await downloadDbFromGitHub();

    const db = await getDb();
    const count = db.exec('SELECT COUNT(*) FROM prices')[0]?.values[0]?.[0] || 0;
    console.log(`✅ ${count} prices in database`);

    if (count === 0 && !downloaded) {
      console.log('📦 Empty DB — starting price update...');
      updateAllPrices().catch(console.error);
    }
  }, 2000);
});