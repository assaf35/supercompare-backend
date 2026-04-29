// src/utils/chains.js
// רשימת כל רשתות השיווק הישראליות + ה-URL של קובצי המחירים שלהן
// לפי חוק המזון (שקיפות מחירים) — כל רשת מחויבת לפרסם

const CHAINS = [
  {
    id: '7290027600007',
    name: 'שופרסל',
    priceUrl: 'https://prices.shufersal.co.il/',
    type: 'shufersal'
  },
  {
    id: '7290058140886',
    name: 'רמי לוי',
    priceUrl: 'https://url.publishedprices.co.il/login/user/RamiLevi',
    type: 'publishedprices'
  },
  {
    id: '7290055700007',
    name: 'מגה',
    priceUrl: 'https://url.publishedprices.co.il/login/user/mega',
    type: 'publishedprices'
  },
  {
    id: '7290696200003',
    name: 'ויקטורי',
    priceUrl: 'https://matrixcatalog.co.il/NBCompetitionRegulations.aspx',
    type: 'victory'
  },
  {
    id: '7290103152017',
    name: 'יוחננוף',
    priceUrl: 'https://www.yohananof.co.il/prices/',
    type: 'yohananof'
  },
  {
    id: '7290873900009',
    name: 'אושר עד',
    priceUrl: 'https://osherad.co.il/prices/',
    type: 'osherad'
  },
  {
    id: '7290785400000',
    name: 'יינות ביתן',
    priceUrl: 'https://www.ybitan.co.il/pirce-list',
    type: 'ybitan'
  },
  {
    id: '7290633800006',
    name: 'מחסני השוק',
    priceUrl: 'https://url.publishedprices.co.il/login/user/TivTaam',
    type: 'publishedprices'
  },
  {
    id: '7290492000005',
    name: 'טיב טעם',
    priceUrl: 'https://url.publishedprices.co.il/login/user/TivTaam',
    type: 'publishedprices'
  }
];

// פורמטים אחידים לשמות רשתות
const CHAIN_NAME_MAP = {
  'שופרסל דיל': 'שופרסל',
  'שופרסל אקספרס': 'שופרסל',
  'שופרסל אונליין': 'שופרסל',
  'BE': 'שופרסל',
  'שופרסל': 'שופרסל',
  'רמי לוי שיווק השקמה': 'רמי לוי',
  'רמי לוי': 'רמי לוי',
  'מגה בעש': 'מגה',
  'מגה': 'מגה',
};

module.exports = { CHAINS, CHAIN_NAME_MAP };
