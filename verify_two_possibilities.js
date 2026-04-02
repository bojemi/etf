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

  console.log('--- 验证两种可能性 ---');
  for (const etf of etfs) {
    const data = allData[etf.name];
    const index = data.findIndex(d => d.date === date);
    if (index === -1) continue;

    // 可能性 1: 当日涨跌幅 (现价 / 昨收 - 1)
    const calc1 = (data[index].close / data[index - 1].close - 1) * 100;

    // 可能性 2: 现价 / 近3日最高收盘价 - 1 (不包含当日，即 T-1, T-2, T-3)
    const max3 = calculateMax(data, index - 1, 3);
    const calc2 = (data[index].close / max3 - 1) * 100;

    console.log(`${etf.name}:`);
    console.log(`  目标值: ${etf.targetStop}%`);
    console.log(`  可能1 (当日涨幅): ${calc1.toFixed(2)}%`);
    console.log(`  可能2 (近3日高点回撤-不含当日): ${calc2.toFixed(2)}%`);
    console.log('------------------------');
  }
};

run();
