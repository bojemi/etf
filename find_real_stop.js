const https = require('https');

const etfs = [
  { name: '创成长', secid: '0.399296', targetStop: -1.53 },
  { name: '恒生ETF', secid: '0.159920', targetStop: -1.07 },
  { name: '中证A100', secid: '1.000903', targetStop: -1.37 },
  { name: '纳指ETF', secid: '1.513100', targetStop: -1.04 },
  { name: '上证指数', secid: '1.000001', targetStop: -1.09 },
  { name: '科创100', secid: '1.000698', targetStop: -1.92 },
  { name: '中证1000', secid: '1.000852', targetStop: -1.44 },
  { name: '国证2000', secid: '0.399303', targetStop: -1.55 },
  { name: '黄金ETF', secid: '1.518880', targetStop: -1.98 }
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

const calculateMA = (data, index, period) => {
  if (index < period - 1) return null;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[index - i].close;
  return sum / period;
};

const run = async () => {
  const date = '2026-03-26';
  const allData = {};
  for (const etf of etfs) {
    allData[etf.name] = await fetchData(etf.secid);
  }

  let bestMatches = [];

  // 1. Price / MA(N) - 1
  for (let n = 1; n <= 60; n++) {
    let totalError = 0;
    let validCount = 0;
    for (const etf of etfs) {
      const data = allData[etf.name];
      const index = data.findIndex(d => d.date === date);
      if (index === -1) continue;
      const ma = calculateMA(data, index, n);
      if (ma) {
        const val = (data[index].close / ma - 1) * 100;
        totalError += Math.abs(val - etf.targetStop);
        validCount++;
      }
    }
    if (validCount === etfs.length) {
      bestMatches.push({ type: 'Price/MA(N)-1', n, avgError: totalError / validCount });
    }
  }

  // 2. N-day return: Price / Price[N] - 1
  for (let n = 1; n <= 60; n++) {
    let totalError = 0;
    let validCount = 0;
    for (const etf of etfs) {
      const data = allData[etf.name];
      const index = data.findIndex(d => d.date === date);
      if (index === -1 || index < n) continue;
      const val = (data[index].close / data[index - n].close - 1) * 100;
      totalError += Math.abs(val - etf.targetStop);
      validCount++;
    }
    if (validCount === etfs.length) {
      bestMatches.push({ type: 'Price/Price[N]-1', n, avgError: totalError / validCount });
    }
  }

  bestMatches.sort((a, b) => a.avgError - b.avgError);
  console.log('Top 5 Alternative Matches for 止盈条件:');
  for (let i = 0; i < 5; i++) console.log(bestMatches[i]);
};

run();
