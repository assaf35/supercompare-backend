// src/services/priceUpdater.js
const zlib = require('zlib');
const xml2js = require('xml2js');
const iconv = require('iconv-lite');
const puppeteer = require('puppeteer');
const axios = require('axios');
const { getDb } = require('../utils/database');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
process.env.PUPPETEER_CACHE_DIR = '/opt/render/.cache/puppeteer';

const BASE = 'https://url.publishedprices.co.il';

// מצא את נתיב Chrome אוטומטית
function getChromePath() {
  const possiblePaths = [
    '/opt/render/.cache/puppeteer/chrome/linux-127.0.6533.88/chrome-linux64/chrome',
    '/opt/render/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome',
    process.env.PUPPETEER_EXECUTABLE_PATH,
  ].filter(Boolean);

  const fs = require('fs');
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return undefined; // puppeteer ימצא לבד
}

// ─── כניסה + שליפת קבצים ────────────────────────────────────────────────────
async function getFilesViaPuppeteer(username) {
  console.log(`  🤖 ${username}...`);

  const chromePath = getChromePath();
  if (chromePath) console.log(`  🌐 Chrome: ${chromePath}`);

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: chromePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors',
           '--disable-dev-shm-usage', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();

    let capturedFiles = [];
    page.on('response', async response => {
      if (response.url().includes('/file/json/dir')) {
        try {
          const data = await response.json();
          if (data?.aaData?.length > 0) {
            capturedFiles = data.aaData.map(r => r.DT_RowId || r.fname || r[0]).filter(Boolean);
            console.log(`  📊 תפסתי ${capturedFiles.length} קבצים!`);
          }
        } catch(e) {}
      }
    });

    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 30000 });

    const csrftoken = await page.$eval(
      'input[name="csrftoken"]',
      el => el.value
    ).catch(() => '');
    console.log(`  🛡️  csrftoken: ${csrftoken.substring(0,25)}...`);

    await page.type('#username', username);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
      page.click('#login-button')
    ]);

    await new Promise(r => setTimeout(r, 4000));

    const cookies = await page.cookies();
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    const cftpSID = cookies.find(c => c.name === 'cftpSID')?.value || '';
    console.log(`  🔑 cftpSID: ${cftpSID.substring(0,25)}...`);

    if (capturedFiles.length === 0) {
      console.log(`  📡 שולח בקשת dir...`);

      const payload = [
        'sEcho=1', 'iColumns=5', 'sColumns=%2C%2C%2C%2C',
        'iDisplayStart=0', 'iDisplayLength=10000',
        'mDataProp_0=fname',    'sSearch_0=', 'bRegex_0=false', 'bSearchable_0=true', 'bSortable_0=true',
        'mDataProp_1=typeLabel','sSearch_1=', 'bRegex_1=false', 'bSearchable_1=true', 'bSortable_1=false',
        'mDataProp_2=size',     'sSearch_2=', 'bRegex_2=false', 'bSearchable_2=true', 'bSortable_2=true',
        'mDataProp_3=ftime',    'sSearch_3=', 'bRegex_3=false', 'bSearchable_3=true', 'bSortable_3=true',
        'mDataProp_4=',         'sSearch_4=', 'bRegex_4=false', 'bSearchable_4=true', 'bSortable_4=false',
        'sSearch=', 'bRegex=false', 'iSortingCols=0', 'cd=%2F',
        `csrftoken=${encodeURIComponent(csrftoken)}`
      ].join('&');

      try {
        const res = await axios.post(`${BASE}/file/json/dir`, payload, {
          headers: {
            'Cookie': cookieStr,
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Origin': BASE,
            'Referer': `${BASE}/file`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        console.log(`  📊 סה"כ: ${res.data?.iTotalRecords || 0}`);
        capturedFiles = (res.data?.aaData || []).map(r => r.DT_RowId || r.fname || r[0]).filter(Boolean);
      } catch(e) {
        console.error(`  ❌ dir error: ${e.message}`);
      }
    }

    return { files: capturedFiles, cookie: cookieStr };

  } finally {
    await browser.close();
  }
}

// ─── הורדה ופרסור ───────────────────────────────────────────────────────────
async function downloadAndParse(cookie, filename) {
  const res = await axios.get(`${BASE}/file/d/${filename}`, {
    headers: { 'Cookie': cookie, 'User-Agent': 'Mozilla/5.0', 'Referer': `${BASE}/file` },
    responseType: 'arraybuffer', timeout: 120000
  });
  const buf = Buffer.from(res.data);
  let xml;
  try { xml = zlib.gunzipSync(buf).toString('utf8'); }
  catch { try { xml = buf.toString('utf8'); } catch { xml = iconv.decode(buf, 'win1255'); } }

  const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true, trim: true });
  const result = await parser.parseStringPromise(xml);
  const root = result.Root || result.Prices || result.PriceFull || Object.values(result)[0] || {};
  let items = root.Items?.Item || root.Products?.Product || [];
  if (!Array.isArray(items)) items = items ? [items] : [];

  return {
    chainId: String(root.ChainId || ''), chainName: String(root.ChainName || ''),
    storeId: String(root.StoreId || '001'), storeName: String(root.StoreName || ''),
    address: String(root.Address || ''), city: String(root.City || ''), items
  };
}

// ─── שמירה ───────────────────────────────────────────────────────────────────
async function saveToDb(parsed, chainId, chainName) {
  const db = await getDb();
  let count = 0;

  db.run(
    `INSERT OR REPLACE INTO stores (store_key,chain_id,store_id,store_name,address,city) VALUES(?,?,?,?,?,?)`,
    [`${chainId}-${parsed.storeId}`, chainId, parsed.storeId, parsed.storeName, parsed.address, parsed.city]
  );

  for (const item of parsed.items) {
    const barcode = String(item.ItemCode || '').trim();
    const price = parseFloat(item.ItemPrice || 0);
    if (!barcode || price <= 0) continue;

    db.run(
      `INSERT OR REPLACE INTO products (barcode,name,manufacturer,unit_qty,quantity,unit_of_measure) VALUES(?,?,?,?,?,?)`,
      [barcode, String(item.ItemName||''), String(item.ManufacturerName||''),
       String(item.UnitQty||''), parseFloat(item.Quantity)||0, String(item.UnitOfMeasure||'')]
    );
    db.run(
      `INSERT OR REPLACE INTO prices (barcode,chain_id,chain_name,store_id,price,is_sale,update_date) VALUES(?,?,?,?,?,?,?)`,
      [barcode, chainId, chainName, parsed.storeId, price,
       item.AllowDiscount==='1'?1:0,
       String(item.PriceUpdateDate||new Date().toISOString().split('T')[0])]
    );
    count++;
  }
  db._save();
  return count;
}

// ─── עדכון רשת ───────────────────────────────────────────────────────────────
async function updateChain(chain) {
  console.log(`\n📦 מעדכן ${chain.name}...`);
  let total = 0;

  const { files, cookie } = await getFilesViaPuppeteer(chain.username);
  console.log(`  📁 נמצאו ${files.length} קבצים`);

  const priceFiles = files.filter(f => f && f.toLowerCase().includes('pricefull')).slice(0, 100);
  console.log(`  🎯 מעבד ${priceFiles.length} קבצי PriceFull`);

  for (const f of priceFiles) {
    try {
      const parsed = await downloadAndParse(cookie, f);
      const n = await saveToDb(parsed, parsed.chainId||chain.chainId, parsed.chainName||chain.name);
      total += n;
      if (n > 0) console.log(`  ✅ ${f}: ${n} מחירים`);
    } catch(e) {
      console.error(`  ❌ ${f}: ${e.message}`);
    }
  }
  return total;
}

// ─── עדכון כל הרשתות ────────────────────────────────────────────────────────
async function updateAllPrices() {
  console.log('🚀 מתחיל עדכון מחירים...');
  const db = await getDb();
  let grand = 0;

  const chains = [
    { chainId: '7290058140886', name: 'רמי לוי',  username: 'RamiLevi'  },
    { chainId: '7290103152017', name: 'יוחננוף',  username: 'yohananof' },
    { chainId: '7290873900009', name: 'אושר עד',  username: 'osherad'   },
  ];

  for (const chain of chains) {
    try {
      const n = await updateChain(chain);
      grand += n;
      db.run(`INSERT INTO update_log (chain_id,status,records,message) VALUES(?,?,?,?)`,
        [chain.chainId, n>0?'success':'warning', n, n>0?'OK':'0 records']);
    } catch(e) {
      console.error(`❌ ${chain.name}: ${e.message}`);
      db.run(`INSERT INTO update_log (chain_id,status,message) VALUES(?,?,?)`,
        [chain.chainId, 'error', e.message]);
    }
    db._save();
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n✅ סה"כ ${grand} מחירים`);
}

module.exports = { updateAllPrices };
if (require.main === module) updateAllPrices().catch(console.error);