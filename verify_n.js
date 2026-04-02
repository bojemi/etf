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
          return { date: parts[0], close: parseFloat(parts[1]) };
        });
        resolve(klines);
      });
    });
  });
};

const calculateMin = (data, index, period) => {
  let min = Infinity;
  for (let i = 0; i < period; i++) {
    if (data[index - i].close < min) min = data[index - i].close;
  }
  return min;
};

const calculateMax = (data, index, period) => {
  let max = -Infinity;
  for (let i = 0; i < period; i++) {
    if (data[index - i].close > max) max = data[index - i].close;
  }
  return max;
};

const run = async () => {
  const date = '2026-03-26';
  const data = await fetchData(etfs[0].secid);
  const index = data.findIndex(d => d.date === date);
  
  for (let n = 15; n <= 40; n++) {
    const minP = calculateMin(data, index, n);
    const openCalc = (data[index].close / minP - 1) * 100;
    console.log(`N=${n}, Calc=${openCalc.toFixed(2)}%`);
  }
};

run();
