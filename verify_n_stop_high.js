const https = require('https');

const etfs = [
  { name: '创成长', secid: '0.399296', targetOpen: 7.74, targetStop: -1.53, price: 6346.66 }
];

const fetchData = (secid) => {
  return new Promise((resolve) => {
    const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&fields1=f1&fields2=f51,f53,f54,f55&klt=101&fqt=1&end=20500101&lmt=100`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const json = JSON.parse(data);
        const klines = json.data.klines.map(k => {
          const parts = k.split(',');
          return { date: parts[0], close: parseFloat(parts[1]), high: parseFloat(parts[2]) };
        });
        resolve(klines);
      });
    });
  });
};

const calculateMaxClose = (data, index, period) => {
  let max = -Infinity;
  for (let i = 0; i < period; i++) {
    if (data[index - i].close > max) max = data[index - i].close;
  }
  return max;
};

const calculateMaxHigh = (data, index, period) => {
  let max = -Infinity;
  for (let i = 0; i < period; i++) {
    if (data[index - i].high > max) max = data[index - i].high;
  }
  return max;
};

const run = async () => {
  const date = '2026-03-26';
  const data = await fetchData(etfs[0].secid);
  const index = data.findIndex(d => d.date === date);
  
  for (let n = 1; n <= 20; n++) {
    const maxC = calculateMaxClose(data, index, n);
    const maxH = calculateMaxHigh(data, index, n);
    const stopCalcC = (data[index].close / maxC - 1) * 100;
    const stopCalcH = (data[index].close / maxH - 1) * 100;
    console.log(`N=${n}, CloseMax=${stopCalcC.toFixed(2)}%, HighMax=${stopCalcH.toFixed(2)}%`);
  }
};

run();
