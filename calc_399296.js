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
  if (!data || data.length === 0) {
    console.log("No data found for 0.399296");
    return;
  }

  // Check the last 3 days
  const datesToCheck = data.slice(-3).map(d => d.date);
  
  for (const date of datesToCheck) {
    const index = data.findIndex(d => d.date === date);
    const ma3 = calculateMA(data, index, 3);
    const ma5 = calculateMA(data, index, 5);
    const ma20 = calculateMA(data, index, 20);
    const ma25 = calculateMA(data, index, 25);

    console.log(`Date: ${date}`);
    if (ma5 && ma25) {
      const mom5_25 = (ma5 / ma25 - 1) * 100;
      console.log(`  MA(5)/MA(25) - 1 = ${mom5_25.toFixed(2)}%`);
    }
    if (ma3 && ma25) {
      const mom3_25 = (ma3 / ma25 - 1) * 100;
      console.log(`  MA(3)/MA(25) - 1 = ${mom3_25.toFixed(2)}%`);
    }
    if (ma5 && ma20) {
      const mom5_20 = (ma5 / ma20 - 1) * 100;
      console.log(`  MA(5)/MA(20) - 1 = ${mom5_20.toFixed(2)}%`);
    }
  }
};

run();
