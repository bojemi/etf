const fs = require('fs');

const rawData = JSON.parse(fs.readFileSync('./backtest_data.json', 'utf8'));
const etfNames = Object.keys(rawData);

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
  if (index < period - 1) return null;
  let min = Infinity;
  for (let i = 0; i < period; i++) {
    if (data[index - i].close < min) min = data[index - i].close;
  }
  return min;
};

const calcMax = (data, index, period, field = 'close') => {
  if (index < period - 1) return null;
  let max = -Infinity;
  for (let i = 0; i < period; i++) {
    if (data[index - i][field] > max) max = data[index - i][field];
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
    const open = etfData[index].open;
    const high = etfData[index].high;
    const low = etfData[index].low;
    const prevClose = index > 0 ? etfData[index - 1].close : close;
    
    const ma3 = calcMA(etfData, index, 3);
    const ma28 = calcMA(etfData, index, 28);
    const min60 = calcMin(etfData, index, 60);
    const max15 = calcMax(etfData, index, 15, 'close');

    if (ma3 && ma28 && min60 && max15) {
      dailyStats.push({
        name,
        close,
        open,
        high,
        low,
        prevClose,
        momentum: ma3 / ma28 - 1,
        openRebound: close / min60 - 1,
        max15,
        isTraded: targetEtfs.find(e => e.name === name)?.traded || false
      });
    }
  }

  if (dailyStats.length === 0) {
    equityCurve.push({ date: today, equity: capital });
    continue;
  }

  dailyStats.sort((a, b) => b.momentum - a.momentum);
  const topEtf = dailyStats[0];
  let soldToday = null;

  // --- 卖出逻辑 ---
  if (position) {
    const heldStats = dailyStats.find(s => s.name === position.name);
    if (heldStats) {
      const isNotTop1 = topEtf.name !== position.name;
      
      const stopLossPrice = heldStats.max15 * (1 - 0.085);
      const triggerStopLoss = heldStats.close < stopLossPrice;
      
      const takeProfitPrice = heldStats.prevClose * 1.05;
      const triggerTakeProfit = heldStats.close > takeProfitPrice;

      if (isNotTop1 || triggerStopLoss || triggerTakeProfit) {
        if (position.buy_date !== today) { // T+1
          let sellPrice = heldStats.close;
          let reason = '';

          if (triggerStopLoss) {
            reason = '触发止损(15日高点回撤<-8.5%)';
          } else if (triggerTakeProfit) {
            reason = '触发止盈(单日涨幅>5%)';
          } else {
            reason = '排名非第1';
          }

          const oldCapital = capital;
          capital = position.shares * sellPrice;
          const profitPct = (sellPrice / position.buy_price - 1) * 100;
          
          trades.push({ 
            type: 'SELL', 
            date: today, 
            name: position.name, 
            price: sellPrice, 
            reason, 
            profit: profitPct,
            capitalAfter: capital
          });
          soldToday = position.name;
          position = null;
        }
      }
    }
  }

  // --- 买入逻辑 ---
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
        trades.push({ 
          type: 'BUY', 
          date: today, 
          name: bestToBuy.name, 
          price: bestToBuy.close, 
          reason: `动量最高且开仓涨幅: ${(bestToBuy.openRebound * 100).toFixed(2)}%`
        });
      }
    }
  }

  let currentEquity = capital;
  if (position) {
    const heldStats = dailyStats.find(s => s.name === position.name);
    if (heldStats) {
      currentEquity = position.shares * heldStats.close;
    }
  }
  equityCurve.push({ date: today, equity: currentEquity });
}

// 计算最大回撤
let maxEquity = 0;
let maxDrawdown = 0;
for (const p of equityCurve) {
  if (p.equity > maxEquity) maxEquity = p.equity;
  const drawdown = (maxEquity - p.equity) / maxEquity;
  if (drawdown > maxDrawdown) maxDrawdown = drawdown;
}

const totalReturn = (capital / 1000000 - 1) * 100;
const years = (new Date(END_DATE) - new Date(START_DATE)) / (1000 * 60 * 60 * 24 * 365);
const annualizedReturn = (Math.pow(capital / 1000000, 1 / years) - 1) * 100;

console.log('================ 方案C 回测结果 ================');
console.log(`期末净值: ${capital.toFixed(2)} 元`);
console.log(`总收益率: ${totalReturn.toFixed(2)}%`);
console.log(`年化收益: ${annualizedReturn.toFixed(2)}%`);
console.log(`最大回撤: ${(maxDrawdown * 100).toFixed(2)}%`);
console.log(`交易总数: ${trades.length} 次 (完整买卖)`);
const winningTrades = trades.filter(t => t.type === 'SELL' && t.profit > 0).length;
const sellTradesCount = trades.filter(t => t.type === 'SELL').length;
console.log(`交易胜率: ${sellTradesCount > 0 ? ((winningTrades / sellTradesCount) * 100).toFixed(2) : 0}%`);
console.log('==========================================\n');

console.log('前 10 笔交易记录:');
const firstTrades = trades.slice(0, 10);
for (const t of firstTrades) {
  if (t.type === 'BUY') {
    console.log(`[${t.date}] 买入 ${t.name} @ ${t.price.toFixed(3)} (${t.reason})`);
  } else {
    console.log(`[${t.date}] 卖出 ${t.name} @ ${t.price.toFixed(3)} (${t.reason}) | 盈亏: ${t.profit > 0 ? '+' : ''}${t.profit.toFixed(2)}%`);
  }
}
