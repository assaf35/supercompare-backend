// הרץ: node debug_login.js
// יפתח דפדפן נראה ויציג מה קורה
const puppeteer = require('puppeteer');

const BASE = 'https://url.publishedprices.co.il';
const username = 'RamiLevi';

(async () => {
  const browser = await puppeteer.launch({
    headless: false, // נראה את הדפדפן!
    args: ['--no-sandbox', '--ignore-certificate-errors'],
    defaultViewport: { width: 1280, height: 800 }
  });

  const page = await browser.newPage();

  // הצג כל בקשת רשת
  page.on('request', req => {
    if (req.url().includes('publishedprices')) {
      console.log(`→ ${req.method()} ${req.url().replace(BASE, '')}`);
    }
  });

  page.on('response', async res => {
    if (res.url().includes('publishedprices')) {
      const status = res.status();
      const url = res.url().replace(BASE, '');
      console.log(`← ${status} ${url}`);
      
      if (url.includes('dir')) {
        try {
          const text = await res.text();
          console.log(`   DIR response: ${text.substring(0, 300)}`);
        } catch(e) {}
      }
    }
  });

  console.log('עובר לדף login...');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  
  console.log('ממלא username...');
  await page.waitForSelector('input', { timeout: 10000 });
  
  // הצג את כל ה-inputs בדף
  const inputInfo = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).map(i => ({
      type: i.type, name: i.name, id: i.id, placeholder: i.placeholder
    }));
  });
  console.log('Inputs:', JSON.stringify(inputInfo));

  // מלא username
  await page.type('input[name="username"], input[type="text"]', username);
  
  console.log('לוחץ Sign in...');
  
  // הצג כפתורים
  const btnInfo = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button, input[type="submit"]')).map(b => ({
      type: b.type, text: b.textContent?.trim(), id: b.id, class: b.className
    }));
  });
  console.log('Buttons:', JSON.stringify(btnInfo));

  await page.click('button[type="submit"], .btn-primary, button');
  
  console.log('מחכה 10 שניות...');
  await new Promise(r => setTimeout(r, 10000));
  
  const url = page.url();
  console.log('URL נוכחי:', url);
  
  const cookies = await page.cookies();
  console.log('Cookies:', cookies.map(c => `${c.name}=${c.value.substring(0,20)}`).join(', '));

  console.log('\nהדפדפן נשאר פתוח 30 שניות לבדיקה...');
  await new Promise(r => setTimeout(r, 30000));
  
  await browser.close();
})().catch(console.error);
