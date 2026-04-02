const https = require('https');

const fetchData = (secid) => {
  return new Promise((resolve, reject) => {
    const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&fields1=f1&fields2=f51,f53&klt=101&fqt=1&end=20500101&lmt=100`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json && json.data && json.data.klines) {
            const klines = json.data.klines.map(k => {
              const parts = k.split(',');
              return { date: parts[0], close: parseFloat(parts[1]) };
            });
            resolve(klines);
          } else {
            resolve([]);
          }
        } catch (e) {
          resolve([]);
        }
      });
    }).on('error', reject);
  });
};

const calculateMA = (data, index, period) => {
  if (index < period - 1) return null;
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[index - i].close;
  }
  return sum / period;
};

const run = async () => {
  const data = await fetchData('0.399296'); // SZSE index
  if (!data || data.length === 0) return;

  const target = 3.47;
  const date = data[data.length - 1].date; // Today
  const index = data.length - 1;

  console.log(`Date: ${date}`);
  for (let y = 15; y <= 30; y++) {
    const maY = calculateMA(data, index, y);
    if (maY) {
      const price = data[index].close;
      const mom = (price / maY - 1) * 100;
      console.log(`  Price / MA(${y}) - 1 = ${mom.toFixed(2)}%`);
    }
  }
};

run();
