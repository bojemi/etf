const https = require('https');

const etfs = [
  { name: '创成长', secid: '0.399296', targetOpen: 7.74 },
  { name: '恒生ETF', secid: '0.159920', targetOpen: 2.56 },
  { name: '中证A100', secid: '1.000903', targetOpen: 1.13 },
  { name: '纳指ETF', secid: '1.513100', targetOpen: 2.14 },
  { name: '上证指数', secid: '1.000001', targetOpen: 1.99 },
  { name: '科创100', secid: '1.000698', targetOpen: 1.90 },
  { name: '中证1000', secid: '1.000852', targetOpen: 3.11 },
  { name: '国证2000', secid: '0.399303', targetOpen: 3.52 },
  { name: '黄金ETF', secid: '1.518880', targetOpen: 5.69 }
];

const fetchData = (secid) => {
  return new Promise((resolve) => {
    const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&fields1=f1&fields2=f51,f53&klt=101&fqt=1&end=20500101&lmt=100`;
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

const calculateMin = (data, startIndex, period) => {
  let min = Infinity;
  for (let i = 0; i < period; i++) {
    if (data[startIndex - i].close < min) min = data[startIndex - i].close;
  }
  return min;
};

const run = async () => {
  const date = '2026-03-26';
  const allData = {};
  for (const etf of etfs) {
    allData[etf.name] = await fetchData(etf.secid);
  }

  console.log('--- 验证：开仓涨幅的“近30日”是否包含当日 ---');
  for (const etf of etfs) {
    const data = allData[etf.name];
    const index = data.findIndex(d => d.date === date);
    if (index === -1) continue;

    const currentPrice = data[index].close;

    // 假设 1：包含当日 (T 到 T-29)
    const min30_include_today = calculateMin(data, index, 30);
    const calc_include = (currentPrice / min30_include_today - 1) * 100;

    // 假设 2：不包含当日 (T-1 到 T-30)
    const min30_exclude_today = calculateMin(data, index - 1, 30);
    const calc_exclude = (currentPrice / min30_exclude_today - 1) * 100;

    console.log(`${etf.name}:`);
    console.log(`  目标值: ${etf.targetOpen}%`);
    console.log(`  包含当日计算值: ${calc_include.toFixed(2)}%`);
    console.log(`  不含当日计算值: ${calc_exclude.toFixed(2)}%`);
    console.log('------------------------');
  }
};

run();
