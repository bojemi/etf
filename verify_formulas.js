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
  for (const etf of etfs) {
    const data = await fetchData(etf.secid);
    const index = data.findIndex(d => d.date === date);
    
    const min30 = calculateMin(data, index, 30);
    const openCalc = (data[index].close / min30 - 1) * 100;
    
    const max3 = calculateMax(data, index, 3);
    const stopCalc = (data[index].close / max3 - 1) * 100;
    
    console.log(`${etf.name}:`);
    console.log(`  开仓涨幅: Target=${etf.targetOpen}%, Calc=${openCalc.toFixed(2)}%`);
    console.log(`  止盈条件: Target=${etf.targetStop}%, Calc=${stopCalc.toFixed(2)}%`);
  }
};

run();
