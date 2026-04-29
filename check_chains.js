const {getDb} = require('./src/utils/database');
getDb().then(db => {
  const r = db.exec('SELECT DISTINCT chain_id, chain_name FROM prices');
  const rows = r[0]?.values || [];
  rows.forEach(row => console.log(row[0], '|', row[1]));
});
