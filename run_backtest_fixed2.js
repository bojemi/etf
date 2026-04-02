const fs = require('fs');

const rawData = JSON.parse(fs.readFileSync('./backtest_data.json', 'utf8'));
const etfNames = Object.keys(rawData);

const START_DATE = '2020-02-28';
const END_DATE = '2026-03-06';
let allDatesSet = new Set();

etfNames.forEach(name => {
  rawData[name].data.forEach(k => {
    if (k.date >= START_DATE && k.date <= END_DATE) {
      allDatesSet.add(k.date);
    }
  });
});
const allDates = Array.from(allDatesSet).sort();

const calcMA = (data, index, period) => {
  if (index < period - 1) return null;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[index - i].close;
  return sum / period;
};

const calcMin = (data, index, period) => {
  if (index < period) return null;
  let min = Infinity;
  for (let i = 1; i <= period; i++) {
    if (data[index - i].close < min) min = data[index - i].close;
  }
  return min;
};

const calcMax = (data, index, period) => {
  if (index < period) return null;
  let max = -Infinity;
  for (let i = 1; i <= period; i++) {
    if (data[index - i].close > max) max = data[index - i].close;
  }
  return max;
};

let capital = 1000000;
let position = null;
let trades = [];
let equityCurve = [];

for (const today of allDates) {
  let dailyStats = [];

  for (const name of etfNames) {
    const etfData = rawData[name].data;
    const index = etfData.findIndex(d => d.date === today);
    if (index === -1) continue;

    const close = etfData[index].close;
    const ma3 = calcMA(etfData, index, 3);
    const ma28 = calcMA(etfData, index, 28);
    const min30 = calcMin(etfData, index, 30);
    const max15 = calcMax(etfData, index, 15);
    const max3 = calcMax(etfData, index, 3);

    if (ma3 && ma28 && min30 && max15 && max3) {
      dailyStats.push({
        name,
        close,
        momentum: ma3 / ma28 - 1,
        openRebound: close / min30 - 1,
        stopLoss: close / max15 - 1,
        takeProfit: close / max3 - 1
      });
    }
  }

  if (dailyStats.length === 0) {
    let currentEquity = capital;
    if (position) {
      const etfData = rawData[position.name].data;
      let lastClose = position.buy_price;
      for (let i = etfData.length - 1; i >= 0; i--) {
        if (etfData[i].date <= today) {
          lastClose = etfData[i].close;
          break;
        }
      }
      currentEquity = position.shares * lastClose;
    }
    equityCurve.push({ date: today, equity: currentEquity });
    continue;
  }

  dailyStats.sort((a, b) => b.momentum - a.momentum);
  const topEtf = dailyStats[0];
  let soldToday = false;

  // --- 卖出逻辑 ---
  if (position) {
    const heldStats = dailyStats.find(s => s.name === position.name);
    if (heldStats) {
      const isNotTop1 = topEtf.name !== position.name;
      const triggerStopLoss = heldStats.stopLoss < -0.085;
      const triggerTakeProfit = heldStats.takeProfit > 0.05;

      if (isNotTop1 || triggerStopLoss || triggerTakeProfit) {
        if (position.buy_date !== today) { // T+1
          let reason = isNotTop1 ? '排名非第1' : (triggerStopLoss ? '触发止损(<-8.5%)' : '触发止盈(>5%)');
          capital = position.shares * heldStats.close;
          const profitPct = (heldStats.close / position.buy_price - 1) * 100;
          
          trades.push({ type: 'SELL', date: today, name: position.name, price: heldStats.close, reason, profit: profitPct });
          position = null;
          soldToday = true;
        }
      }
    }
  }

  // --- 买入逻辑 ---
  if (!position) {
    if (topEtf.openRebound > 0.015) {
      const shares = capital / topEtf.close;
      position = { name: topEtf.name, shares: shares, buy_date: today, buy_price: topEtf.close };
      trades.push({ type: 'BUY', date: today, name: topEtf.name, price: topEtf.close, reason: '动量第1且开仓涨幅>1.5%' });
    }
  }

  let currentEquity = capital;
  if (position) {
    const heldStats = dailyStats.find(s => s.name === position.name);
    if (heldStats) {
      currentEquity = position.shares * heldStats.close;
    } else {
      const etfData = rawData[position.name].data;
      let lastClose = position.buy_price;
      for (let i = etfData.length - 1; i >= 0; i--) {
        if (etfData[i].date <= today) {
          lastClose = etfData[i].close;
          break;
        }
      }
      currentEquity = position.shares * lastClose;
    }
  }
  equityCurve.push({ date: today, equity: currentEquity });
}

const finalEquity = equityCurve[equityCurve.length - 1].equity;
const totalReturn = (finalEquity / 1000000 - 1) * 100;

let maxEquity = 0;
let maxDrawdown = 0;
equityCurve.forEach(point => {
  if (point.equity > maxEquity) maxEquity = point.equity;
  const drawdown = (maxEquity - point.equity) / maxEquity;
  if (drawdown > maxDrawdown) maxDrawdown = drawdown;
});

const years = allDates.length / 252;
const annualizedReturn = (Math.pow(finalEquity / 1000000, 1 / years) - 1) * 100;

const sellTrades = trades.filter(t => t.type === 'SELL');
const winTrades = sellTrades.filter(t => t.profit > 0);
const winRate = sellTrades.length > 0 ? (winTrades.length / sellTrades.length) * 100 : 0;

console.log(`================ 回测结果 ================`);
console.log(`期末净值: ${finalEquity.toFixed(2)} 元`);
console.log(`总收益率: ${totalReturn.toFixed(2)}%`);
console.log(`年化收益: ${annualizedReturn.toFixed(2)}%`);
console.log(`最大回撤: ${(maxDrawdown * 100).toFixed(2)}%`);
console.log(`交易总数: ${sellTrades.length} 次 (完整买卖)`);
console.log(`交易胜率: ${winRate.toFixed(2)}%`);
console.log(`==========================================\n`);

console.log(`最近 10 笔交易记录:`);
const recentTrades = trades.slice(-20);
recentTrades.forEach(t => {
  if (t.type === 'BUY') {
    console.log(`[${t.date}] 买入 ${t.name} @ ${t.price.toFixed(3)} (${t.reason})`);
  } else {
    console.log(`[${t.date}] 卖出 ${t.name} @ ${t.price.toFixed(3)} (${t.reason}) | 盈亏: ${t.profit > 0 ? '+' : ''}${t.profit.toFixed(2)}%`);
  }
});
