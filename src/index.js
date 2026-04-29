// src/index.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cron = require('node-cron');
const { getDb } = require('./utils/database');
const { updateAllPrices } = require('./services/priceUpdater');
const productsRouter = require('./routes/products');

const app = express();
const PORT = process.env.PORT || 3000;

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
  console.log(`🚀 SuperCompare Backend פועל על פורט ${PORT}`);
  const db = await getDb();
  const count = db.exec('SELECT COUNT(*) FROM prices')[0]?.values[0]?.[0] || 0;
  if (count === 0) {
    console.log('📦 אין נתונים — מתחיל עדכון ראשוני...');
    updateAllPrices().catch(console.error);
  } else {
    console.log(`✅ יש ${count} מחירים במאגר`);
  }
});
