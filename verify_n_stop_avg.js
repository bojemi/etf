const https = require('https');

const etfs = [
  { name: '创成长', secid: '0.399296', targetOpen: 7.74, targetStop: -1.53, price: 6346.66 },
  { name: '恒生ETF', secid: '0.159920', targetOpen: 2.56, targetStop: -1.07, price: 1.485 },
  { name: '中证A100', secid: '1.000903', targetOpen: 1.13, targetStop: -1.37, price: 4361.06 },
  { name: '纳指ETF', secid: '1.513100', targetOpen: 2.14, targetStop: -1.04, price: 1.716 },
  { name: '上证指数', secid: '1.000001', targetOpen: 1.99, targetStop: -1.09, price: 3889.08 },
  { name: '科创100', secid: '1.000698', targetOpen: 1.90, targetStop: -1.92, price: 1486.3 },
  { name: '中证1000', secid: '1.000852', targetOpen: 3.11, targetStop: -1.44, price: 7639.38 },
  { name: '国证2000', secid: '0.399303', targetOpen: 3.52, targetStop: -1.55, price: 10023.52 },
  { name: '黄金ETF', secid: '1.518880', targetOpen: 5.69, targetStop: -1.98, price: 9.45 }
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

const calculateMax = (data, index, period) => {
  let max = -Infinity;
  for (let i = 0; i < period; i++) {
    if (data[index - i].close > max) max = data[index - i].close;
  }
  return max;
};

const run = async () => {
  const date = '2026-03-26';
  const allData = {};
  for (const etf of etfs) {
    allData[etf.name] = await fetchData(etf.secid);
  }

  for (let n = 1; n <= 10; n++) {
    let totalError = 0;
    for (const etf of etfs) {
      const data = allData[etf.name];
      let index = data.findIndex(d => d.date === date);
      if (index === -1) {
        for (let i = data.length - 1; i >= 0; i--) {
          if (data[i].date <= date) {
            index = i;
            break;
          }
        }
      }
      const maxP = calculateMax(data, index, n);
      const stopCalc = (data[index].close / maxP - 1) * 100;
      totalError += Math.abs(stopCalc - etf.targetStop);
    }
    console.log(`N=${n}, AvgError=${(totalError/etfs.length).toFixed(4)}`);
  }
};

run();
