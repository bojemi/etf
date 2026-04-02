const fs = require('fs');

const rawData = JSON.parse(fs.readFileSync('./backtest_data.json', 'utf8'));
const targetEtfs = [
  { name: '创成长', code: '159967', secid: '0.399296', traded: true },
  { name: '黄金ETF', code: '518880', secid: '1.518880', traded: true },
  { name: '中证1000', code: '512100', secid: '1.000852', traded: true },
  { name: '恒生ETF', code: '159920', secid: '0.159920', traded: true },
  { name: '纳指ETF', code: '513100', secid: '1.513100', traded: true },
  { name: '科创100', code: '588220', secid: '1.000698', traded: true },
  { name: '上证指数', code: '510210', secid: '1.000001', traded: false },
  { name: '中证A100', code: '512910', secid: '1.000903', traded: false },
  { name: '国证2000', code: '159628', secid: '0.399303', traded: false }
];
const etfNames = targetEtfs.map(e => e.name);

const START_DATE = '2020-02-28';
const END_DATE = '2026-03-06';

let allDatesSet = new Set();
etfNames.forEach(name => {
  rawData[name].data.forEach(d => {
    if (d.date >= START_DATE && d.date <= END_DATE) {
      allDatesSet.add(d.date);
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

// --- Strategy A Helpers ---
const calcMin30ExcludeToday = (data, index) => {
  if (index < 30) return null;
  let min = Infinity;
  for (let i = 1; i <= 30; i++) {
    if (data[index - i].close < min) min = data[index - i].close;
  }
  return min;
};

const calcMax3ExcludeToday = (data, index) => {
  if (index < 3) return null;
  let max = -Infinity;
  for (let i = 1; i <= 3; i++) {
    if (data[index - i].close > max) max = data[index - i].close;
  }
  return max;
};

// --- Strategy B Helpers ---
const calcMin60IncludeToday = (data, index) => {
  if (index < 59) return null;
  let min = Infinity;
  for (let i = 0; i < 60; i++) {
    if (data[index - i].close < min) min = data[index - i].close;
  }
  return min;
};

const calcMax15IncludeToday = (data, index) => {
  if (index < 14) return null;
  let max = -Infinity;
  for (let i = 0; i < 15; i++) {
    if (data[index - i].close > max) max = data[index - i].close;
  }
  return max;
};

function runBacktest(strategyType) {
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
      const prevClose = index > 0 ? etfData[index - 1].close : close;
      
      const ma3 = calcMA(etfData, index, 3);
      const ma28 = calcMA(etfData, index, 28);
      if (!ma3 || !ma28) continue;

      let stat = {
        name,
        close,
        prevClose,
        momentum: ma3 / ma28 - 1,
        isTraded: targetEtfs.find(e => e.name === name)?.traded || false
      };

      if (strategyType === 'A') {
        const min30 = calcMin30ExcludeToday(etfData, index);
        const max3 = calcMax3ExcludeToday(etfData, index);
        if (min30 && max3) {
          stat.openRebound = close / min30 - 1;
          stat.takeProfitCond = close / max3 - 1;
          dailyStats.push(stat);
        }
      } else {
        const min60 = calcMin60IncludeToday(etfData, index);
        const max15 = calcMax15IncludeToday(etfData, index);
        if (min60 && max15) {
          stat.openRebound = close / min60 - 1;
          stat.max15 = max15;
          dailyStats.push(stat);
        }
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
    let soldToday = null;

    // --- SELL ---
    if (position) {
      const heldStats = dailyStats.find(s => s.name === position.name);
      if (heldStats) {
        const isNotTop1 = topEtf.name !== position.name;
        let triggerSell = false;
        let sellPrice = heldStats.close;

        if (strategyType === 'A') {
          // Old Strategy: Not top 1 OR take profit (>5%)
          const triggerTakeProfit = heldStats.takeProfitCond > 0.05;
          triggerSell = isNotTop1 || triggerTakeProfit;
        } else {
          // Current Strategy: Not top 1 OR stop loss OR take profit
          const stopLossPrice = heldStats.max15 * (1 - 0.085);
          const triggerStopLoss = heldStats.close < stopLossPrice;
          const takeProfitPrice = heldStats.prevClose * 1.05;
          const triggerTakeProfit = heldStats.close > takeProfitPrice;
          triggerSell = isNotTop1 || triggerStopLoss || triggerTakeProfit;
        }

        if (triggerSell && position.buy_date !== today) {
          capital = position.shares * sellPrice;
          trades.push({ type: 'SELL', profit: (sellPrice / position.buy_price - 1) * 100 });
          soldToday = position.name;
          position = null;
        }
      }
    }

    // --- BUY ---
    if (!position) {
      const bestToBuy = topEtf;
      if (bestToBuy.name !== soldToday && bestToBuy.isTraded) {
        if (bestToBuy.openRebound > 0.015) {
          const shares = capital / bestToBuy.close;
          position = { 
            name: bestToBuy.name, 
            shares: shares, 
            buy_date: today, 
            buy_price: bestToBuy.close
          };
          trades.push({ type: 'BUY' });
        }
      }
    }

    let currentEquity = capital;
    if (position) currentEquity = position.shares * dailyStats.find(s => s.name === position.name).close;
    equityCurve.push({ date: today, equity: currentEquity });
  }

  // Calculate stats
  let maxDrawdown = 0;
  let peak = equityCurve[0].equity;
  for (const point of equityCurve) {
    if (point.equity > peak) peak = point.equity;
    const dd = (peak - point.equity) / peak;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const totalReturn = (equityCurve[equityCurve.length - 1].equity / 1000000 - 1) * 100;
  const years = equityCurve.length / 252;
  const annualizedReturn = (Math.pow(equityCurve[equityCurve.length - 1].equity / 1000000, 1 / years) - 1) * 100;
  
  const sellTrades = trades.filter(t => t.type === 'SELL');
  const winningTrades = sellTrades.filter(t => t.profit > 0).length;
  const winRate = sellTrades.length > 0 ? (winningTrades / sellTrades.length) * 100 : 0;

  return {
    totalReturn: totalReturn.toFixed(2),
    annualizedReturn: annualizedReturn.toFixed(2),
    maxDrawdown: (maxDrawdown * 100).toFixed(2),
    winRate: winRate.toFixed(2),
    tradesCount: sellTrades.length
  };
}

console.log("=== Strategy A (Old) ===");
console.log(runBacktest('A'));
console.log("\n=== Strategy B (Current) ===");
console.log(runBacktest('B'));
