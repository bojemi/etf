const https = require('https');

// 目标数据 (基于截图)
const etfs = [
  { name: '创成长', secid: '0.399296', targetMomentum: 2.96, targetOpen: 7.74, targetStop: -1.53 },
  { name: '黄金ETF', secid: '1.518880', targetMomentum: -10.63, targetOpen: 5.69, targetStop: -1.98 },
  { name: '国证2000', secid: '0.399303', targetMomentum: -6.27, targetOpen: 3.52, targetStop: -1.55 },
  { name: '中证1000', secid: '1.000852', targetMomentum: -5.90, targetOpen: 3.11, targetStop: -1.44 },
  { name: '恒生ETF', secid: '0.159920', targetMomentum: -3.39, targetOpen: 2.56, targetStop: -1.07 },
  { name: '纳指ETF', secid: '1.513100', targetMomentum: -3.60, targetOpen: 2.14, targetStop: -1.04 },
  { name: '上证指数', secid: '1.000001', targetMomentum: -4.23, targetOpen: 1.99, targetStop: -1.09 },
  { name: '科创100', secid: '1.000698', targetMomentum: -5.18, targetOpen: 1.90, targetStop: -1.92 },
  { name: '中证A100', secid: '1.000903', targetMomentum: -3.47, targetOpen: 1.13, targetStop: -1.37 }
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

// 1. 均线动量涨幅: MA(3) / MA(28) - 1 (包含当日)
const calculateMA = (data, index, period) => {
  if (index < period - 1) return null;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[index - i].close;
  return sum / period;
};

// 2. 开仓涨幅: 现价 / 近30日最低收盘价 - 1 (不包含当日)
const calculateMin = (data, index, period) => {
  let min = Infinity;
  for (let i = 0; i < period; i++) {
    if (data[index - i].close < min) min = data[index - i].close;
  }
  return min;
};

// 3. 止盈条件: 现价 / 近3日最高收盘价 - 1 (不包含当日)
const calculateMax = (data, index, period) => {
  let max = -Infinity;
  for (let i = 0; i < period; i++) {
    if (data[index - i].close > max) max = data[index - i].close;
  }
  return max;
};

const run = async () => {
  const date = '2026-03-26';
  console.log('================================================================================');
  console.log(`最终公式验证报告 - 数据日期: ${date}`);
  console.log('================================================================================\n');

  for (const etf of etfs) {
    const data = await fetchData(etf.secid);
    const index = data.findIndex(d => d.date === date);
    if (index === -1) {
      console.log(`[Error] 找不到 ${etf.name} 在 ${date} 的数据`);
      continue;
    }

    const currentPrice = data[index].close;

    // 1. 均线动量涨幅
    const ma3 = calculateMA(data, index, 3);
    const ma28 = calculateMA(data, index, 28);
    const calcMomentum = (ma3 / ma28 - 1) * 100;
    const matchMomentum = Math.abs(calcMomentum - etf.targetMomentum) < 0.05 ? '✅ 完美' : '❌ 偏差';

    // 2. 开仓涨幅 (不含当日，从 index-1 开始找 30 天)
    const min30 = calculateMin(data, index - 1, 30);
    const calcOpen = (currentPrice / min30 - 1) * 100;
    const matchOpen = Math.abs(calcOpen - etf.targetOpen) < 0.05 ? '✅ 完美' : '❌ 偏差';

    // 3. 止盈条件 (不含当日，从 index-1 开始找 3 天)
    const max3 = calculateMax(data, index - 1, 3);
    const calcStop = (currentPrice / max3 - 1) * 100;
    const matchStop = Math.abs(calcStop - etf.targetStop) < 0.05 ? '✅ 完美' : '❌ 偏差';

    console.log(`【${etf.name}】`);
    console.log(`  均线动量涨幅 | 截图: ${etf.targetMomentum > 0 ? '+' : ''}${etf.targetMomentum.toFixed(2)}% | 计算: ${calcMomentum > 0 ? '+' : ''}${calcMomentum.toFixed(2)}% | ${matchMomentum}`);
    console.log(`  开仓涨幅     | 截图: +${etf.targetOpen.toFixed(2)}% | 计算: +${calcOpen.toFixed(2)}% | ${matchOpen}`);
    console.log(`  止盈条件     | 截图: ${etf.targetStop.toFixed(2)}% | 计算: ${calcStop.toFixed(2)}% | ${matchStop}`);
    console.log('--------------------------------------------------------------------------------');
  }
};

run();
