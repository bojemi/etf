const https = require('https');

const etfs = [
  { name: '创成长', secid: '0.399296', target: 2.96 },
  { name: '恒生ETF', secid: '100.HSI', target: -3.39 },
  { name: '中证A100', secid: '1.000903', target: -3.47 },
  { name: '纳指ETF', secid: '100.NDX', target: -3.60 },
  { name: '上证指数', secid: '1.000001', target: -4.23 },
  { name: '科创100', secid: '1.000698', target: -5.18 },
  { name: '中证1000', secid: '1.000852', target: -5.90 },
  { name: '国证2000', secid: '0.399303', target: -6.27 },
  { name: '黄金ETF', secid: '118.AU9999', target: -10.63 }
];

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
  const allData = {};
  for (const etf of etfs) {
    allData[etf.name] = await fetchData(etf.secid);
    console.log(`Fetched ${etf.name}: ${allData[etf.name].length} records`);
  }

  const xs = Array.from({length: 10}, (_, i) => i + 1); // 1 to 10
  const ys = Array.from({length: 21}, (_, i) => i + 15); // 15 to 35

  const baseData = allData['创成长'];
  if (!baseData || baseData.length === 0) return;
  
  // Check the last 10 trading days
  const datesToCheck = baseData.slice(-10).map(d => d.date);

  let bestMatches = [];

  for (const date of datesToCheck) {
    for (const x of xs) {
      for (const y of ys) {
        let totalError = 0;
        let validCount = 0;
        let results = [];

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
          if (index === -1) continue;

          const maX = calculateMA(data, index, x);
          const maY = calculateMA(data, index, y);

          if (maX && maY) {
            const momentum = (maX / maY - 1) * 100;
            const error = Math.abs(momentum - etf.target);
            totalError += error;
            validCount++;
            results.push({ name: etf.name, target: etf.target, calc: momentum.toFixed(2) });
          }
        }

        if (validCount > 0) {
          const avgError = totalError / validCount;
          bestMatches.push({ date, x, y, avgError, results });
        }
      }
    }
  }

  bestMatches.sort((a, b) => a.avgError - b.avgError);
  console.log('Top 3 Matches for the NEW image data using INDICES:');
  for (let i = 0; i < 3; i++) {
    console.log(JSON.stringify(bestMatches[i], null, 2));
  }
};

run();
