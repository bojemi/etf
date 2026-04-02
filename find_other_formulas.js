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
  return new Promise((resolve, reject) => {
    const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&fields1=f1&fields2=f51,f53,f54,f55&klt=101&fqt=1&end=20500101&lmt=100`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json && json.data && json.data.klines) {
            const klines = json.data.klines.map(k => {
              const parts = k.split(',');
              return { 
                date: parts[0], 
                close: parseFloat(parts[1]),
                high: parseFloat(parts[2]),
                low: parseFloat(parts[3])
              };
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

const calculateMin = (data, index, period) => {
  if (index < period - 1) return null;
  let min = Infinity;
  for (let i = 0; i < period; i++) {
    if (data[index - i].close < min) min = data[index - i].close;
  }
  return min;
};

const calculateMax = (data, index, period) => {
  if (index < period - 1) return null;
  let max = -Infinity;
  for (let i = 0; i < period; i++) {
    if (data[index - i].close > max) max = data[index - i].close;
  }
  return max;
};

const calculateATR = (data, index, period) => {
  if (index < period) return null;
  let sumTR = 0;
  for (let i = 0; i < period; i++) {
    const current = data[index - i];
    const previous = data[index - i - 1];
    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close)
    );
    sumTR += tr;
  }
  return sumTR / period;
};

const calculateStdDev = (data, index, period) => {
  if (index < period) return null;
  let returns = [];
  for (let i = 0; i < period; i++) {
    returns.push(data[index - i].close / data[index - i - 1].close - 1);
  }
  const mean = returns.reduce((a, b) => a + b, 0) / period;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
  return Math.sqrt(variance);
};

const run = async () => {
  const allData = {};
  for (const etf of etfs) {
    allData[etf.name] = await fetchData(etf.secid);
  }

  const date = '2026-03-26';

  // Test "开仓涨幅"
  console.log('--- Testing 开仓涨幅 ---');
  let bestOpenMatches = [];
  
  // 1. MA(x) / MA(y) - 1
  for (let x = 1; x <= 60; x++) {
    for (let y = 1; y <= 60; y++) {
      if (x === y) continue;
      let totalError = 0;
      let validCount = 0;
      for (const etf of etfs) {
        const data = allData[etf.name];
        const index = data.findIndex(d => d.date === date);
        if (index === -1) continue;
        const maX = calculateMA(data, index, x);
        const maY = calculateMA(data, index, y);
        if (maX && maY) {
          const val = (maX / maY - 1) * 100;
          totalError += Math.abs(val - etf.targetOpen);
          validCount++;
        }
      }
      if (validCount === etfs.length) {
        bestOpenMatches.push({ type: 'MA(x)/MA(y)-1', x, y, avgError: totalError / validCount });
      }
    }
  }

  // 2. Price / Min(Price, N) - 1
  for (let n = 2; n <= 60; n++) {
    let totalError = 0;
    let validCount = 0;
    for (const etf of etfs) {
      const data = allData[etf.name];
      const index = data.findIndex(d => d.date === date);
      if (index === -1) continue;
      const minP = calculateMin(data, index, n);
      if (minP) {
        const val = (data[index].close / minP - 1) * 100;
        totalError += Math.abs(val - etf.targetOpen);
        validCount++;
      }
    }
    if (validCount === etfs.length) {
      bestOpenMatches.push({ type: 'Price/Min(N)-1', n, avgError: totalError / validCount });
    }
  }

  // 3. Price / Price[N] - 1
  for (let n = 1; n <= 60; n++) {
    let totalError = 0;
    let validCount = 0;
    for (const etf of etfs) {
      const data = allData[etf.name];
      const index = data.findIndex(d => d.date === date);
      if (index === -1 || index < n) continue;
      const val = (data[index].close / data[index - n].close - 1) * 100;
      totalError += Math.abs(val - etf.targetOpen);
      validCount++;
    }
    if (validCount === etfs.length) {
      bestOpenMatches.push({ type: 'Price/Price[N]-1', n, avgError: totalError / validCount });
    }
  }

  bestOpenMatches.sort((a, b) => a.avgError - b.avgError);
  console.log('Top 5 Open Matches:');
  for (let i = 0; i < 5; i++) console.log(bestOpenMatches[i]);


  // Test "止盈条件"
  console.log('\n--- Testing 止盈条件 ---');
  let bestStopMatches = [];

  // 1. MA(x) / MA(y) - 1
  for (let x = 1; x <= 60; x++) {
    for (let y = 1; y <= 60; y++) {
      if (x === y) continue;
      let totalError = 0;
      let validCount = 0;
      for (const etf of etfs) {
        const data = allData[etf.name];
        const index = data.findIndex(d => d.date === date);
        if (index === -1) continue;
        const maX = calculateMA(data, index, x);
        const maY = calculateMA(data, index, y);
        if (maX && maY) {
          const val = (maX / maY - 1) * 100;
          totalError += Math.abs(val - etf.targetStop);
          validCount++;
        }
      }
      if (validCount === etfs.length) {
        bestStopMatches.push({ type: 'MA(x)/MA(y)-1', x, y, avgError: totalError / validCount });
      }
    }
  }

  // 2. Price / Max(Price, N) - 1
  for (let n = 2; n <= 60; n++) {
    let totalError = 0;
    let validCount = 0;
    for (const etf of etfs) {
      const data = allData[etf.name];
      const index = data.findIndex(d => d.date === date);
      if (index === -1) continue;
      const maxP = calculateMax(data, index, n);
      if (maxP) {
        const val = (data[index].close / maxP - 1) * 100;
        totalError += Math.abs(val - etf.targetStop);
        validCount++;
      }
    }
    if (validCount === etfs.length) {
      bestStopMatches.push({ type: 'Price/Max(N)-1', n, avgError: totalError / validCount });
    }
  }

  // 3. -ATR(N)/Price * M
  for (let n = 5; n <= 30; n++) {
    for (let m = 0.5; m <= 3.0; m += 0.1) {
      let totalError = 0;
      let validCount = 0;
      for (const etf of etfs) {
        const data = allData[etf.name];
        const index = data.findIndex(d => d.date === date);
        if (index === -1) continue;
        const atr = calculateATR(data, index, n);
        if (atr) {
          const val = -(atr / data[index].close) * m * 100;
          totalError += Math.abs(val - etf.targetStop);
          validCount++;
        }
      }
      if (validCount === etfs.length) {
        bestStopMatches.push({ type: '-ATR(N)/Price*M', n, m: m.toFixed(1), avgError: totalError / validCount });
      }
    }
  }

  // 4. -StdDev(N) * M
  for (let n = 5; n <= 30; n++) {
    for (let m = 0.5; m <= 3.0; m += 0.1) {
      let totalError = 0;
      let validCount = 0;
      for (const etf of etfs) {
        const data = allData[etf.name];
        const index = data.findIndex(d => d.date === date);
        if (index === -1) continue;
        const stddev = calculateStdDev(data, index, n);
        if (stddev) {
          const val = -stddev * m * 100;
          totalError += Math.abs(val - etf.targetStop);
          validCount++;
        }
      }
      if (validCount === etfs.length) {
        bestStopMatches.push({ type: '-StdDev(N)*M', n, m: m.toFixed(1), avgError: totalError / validCount });
      }
    }
  }

  bestStopMatches.sort((a, b) => a.avgError - b.avgError);
  console.log('Top 5 Stop Matches:');
  for (let i = 0; i < 5; i++) console.log(bestStopMatches[i]);

};

run();
