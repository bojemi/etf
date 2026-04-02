export const targetEtfs = [
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

export async function runBacktest(initialCapital: number) {
  const rawData: any = {};
  
  const getBeijingTime = () => {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * 8));
  };
  const bjTime = getBeijingTime();
  const todayStr = bjTime.toISOString().split('T')[0];

  const lmt = 2000; 
  
  await Promise.all(targetEtfs.map(async (etf) => {
    try {
      const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${etf.secid}&fields1=f1&fields2=f51,f52,f53,f54,f55&klt=101&fqt=1&end=20500101&lmt=${lmt}`;
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      if (json.data && json.data.klines) {
        const fetchedData = json.data.klines.map((k: string) => {
          const parts = k.split(',');
          return {
            date: parts[0],
            open: parseFloat(parts[1]),
            close: parseFloat(parts[2]),
            high: parseFloat(parts[3]),
            low: parseFloat(parts[4])
          };
        });
        rawData[etf.name] = { code: etf.code, secid: etf.secid, data: fetchedData };
      }
    } catch (err) {
      console.error(`Failed to fetch data for ${etf.name}:`, err);
    }
  }));

  const etfNames = Object.keys(rawData);
  if (etfNames.length === 0) {
    throw new Error("Failed to fetch any ETF data. Please check your network connection.");
  }

  const START_DATE = '2020-02-28';
  const END_DATE = todayStr;
  let allDatesSet = new Set<string>();

  etfNames.forEach(name => {
    rawData[name].data.forEach((k: any) => {
      if (k.date >= START_DATE && k.date <= END_DATE) {
        allDatesSet.add(k.date);
      }
    });
  });
  const allDates = Array.from(allDatesSet).sort();

  const calcMA = (data: any[], index: number, period: number) => {
    if (index < period - 1) return null;
    let sum = 0;
    for (let i = 0; i < period; i++) sum += data[index - i].close;
    return sum / period;
  };

  const calcMin = (data: any[], index: number, period: number) => {
    if (index < period - 1) return null;
    let min = Infinity;
    for (let i = 0; i < period; i++) {
      if (data[index - i].close < min) min = data[index - i].close;
    }
    return min;
  };

  const calcMax = (data: any[], index: number, period: number, field: string = 'close') => {
    if (index < period - 1) return null;
    let max = -Infinity;
    for (let i = 0; i < period; i++) {
      if (data[index - i][field] > max) max = data[index - i][field];
    }
    return max;
  };

  let capital = initialCapital;
  let position: any = null;
  let trades: any[] = [];
  let equityCurve: any[] = [];
  let latestStats: any[] = [];

  for (const today of allDates) {
    let dailyStats: any[] = [];

    for (const name of etfNames) {
      const etfData = rawData[name].data;
      const index = etfData.findIndex((d: any) => d.date === today);
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
          code: rawData[name].code,
          close,
          open,
          high,
          low,
          prevClose,
          momentum: ma3 / ma28 - 1,
          openRebound: close / min60 - 1,
          max15: max15,
          isTraded: targetEtfs.find(e => e.name === name)?.traded || false
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
      equityCurve.push({ date: today, equity: currentEquity, trades: [], position: position ? position.name : null });
      continue;
    }

    dailyStats.sort((a, b) => b.momentum - a.momentum);
    const topEtf = dailyStats[0];
    let dailyTrades: any[] = [];

    // --- 卖出逻辑 ---
    let soldToday = null;
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
            const profitAmount = capital - oldCapital;
            
            const tradeObj = { 
              type: 'SELL', 
              date: today, 
              name: position.name, 
              price: sellPrice, 
              reason, 
              profit: profitPct,
              profitAmount: profitAmount,
              capitalAfter: capital,
              dailyStats: [...dailyStats]
            };
            trades.push(tradeObj);
            dailyTrades.push(tradeObj);
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
            buy_price: bestToBuy.close,
            highest_price: bestToBuy.close
          };
          const tradeObj = { 
            type: 'BUY', 
            date: today, 
            name: bestToBuy.name, 
            price: bestToBuy.close, 
            reason: `动量最高且开仓涨幅: ${(bestToBuy.openRebound * 100).toFixed(2)}%`,
            capitalAfter: capital,
            dailyStats: [...dailyStats]
          };
          trades.push(tradeObj);
          dailyTrades.push(tradeObj);
        }
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
    // If we sold today and didn't buy anything, we are empty at the end of the day
    const isPositionEmpty = position === null;
    equityCurve.push({ date: today, equity: currentEquity, trades: dailyTrades, position: isPositionEmpty ? null : position.name });
    
    if (today === allDates[allDates.length - 1]) {
      latestStats = dailyStats;
    }
  }

  if (equityCurve.length === 0) {
    throw new Error("No data available for backtest. Please check your network connection or API limits.");
  }

  const finalEquity = equityCurve[equityCurve.length - 1].equity;
  const totalReturn = (finalEquity / initialCapital - 1) * 100;

  let maxEquity = 0;
  let maxDrawdown = 0;
  let maxDrawdownAmount = 0;
  let overallPeakDate = '';
  let overallTroughDate = '';
  let currentOverallPeakDate = '';
  let totalEmptyDays = 0;

  equityCurve.forEach(point => {
    if (point.position === null) {
      totalEmptyDays++;
    }
    if (point.equity > maxEquity) {
      maxEquity = point.equity;
      currentOverallPeakDate = point.date;
    }
    const drawdown = (maxEquity - point.equity) / maxEquity;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownAmount = maxEquity - point.equity;
      overallPeakDate = currentOverallPeakDate;
      overallTroughDate = point.date;
    }
  });

  const years = allDates.length / 252;
  const annualizedReturn = (Math.pow(finalEquity / initialCapital, 1 / years) - 1) * 100;

  const sellTrades = trades.filter(t => t.type === 'SELL');
  const winTrades = sellTrades.filter(t => t.profit > 0);
  const winRate = sellTrades.length > 0 ? (winTrades.length / sellTrades.length) * 100 : 0;

  // Calculate yearly metrics
  const yearsSet = new Set(allDates.map(d => d.substring(0, 4)));
  const yearsList = Array.from(yearsSet).sort();
  
  const yearlyMetrics = [];
  let previousYearEndEquity = initialCapital;

  for (const year of yearsList) {
    const yearEquityCurve = equityCurve.filter(p => p.date.startsWith(year));
    if (yearEquityCurve.length === 0) continue;

    const yearTrades = trades.filter(t => t.date.startsWith(year) && t.type === 'SELL');
    const yearWinTrades = yearTrades.filter(t => t.profit > 0);
    const yearWinRate = yearTrades.length > 0 ? (yearWinTrades.length / yearTrades.length) * 100 : 0;

    const yearEndEquity = yearEquityCurve[yearEquityCurve.length - 1].equity;
    const yearReturn = (yearEndEquity / previousYearEndEquity - 1) * 100;

    let yearMaxEquity = previousYearEndEquity; // Start max equity from previous year's end to catch early drawdowns
    let yearMaxDrawdown = 0;
    let yearMaxDrawdownAmount = 0;
    let yearPeakDate = '';
    let yearTroughDate = '';
    let currentYearPeakDate = '';
    let yearEmptyDays = 0;

    yearEquityCurve.forEach(point => {
      if (point.position === null) {
        yearEmptyDays++;
      }
      if (point.equity > yearMaxEquity) {
        yearMaxEquity = point.equity;
        currentYearPeakDate = point.date;
      }
      const drawdown = (yearMaxEquity - point.equity) / yearMaxEquity;
      if (drawdown > yearMaxDrawdown) {
        yearMaxDrawdown = drawdown;
        yearMaxDrawdownAmount = yearMaxEquity - point.equity;
        yearPeakDate = currentYearPeakDate || yearEquityCurve[0].date;
        yearTroughDate = point.date;
      }
    });

    const tradingDays = yearEquityCurve.length;
    const yearAnnualizedReturn = tradingDays > 0 ? (Math.pow(yearEndEquity / previousYearEndEquity, 252 / tradingDays) - 1) * 100 : 0;

    yearlyMetrics.push({
      year,
      endEquity: yearEndEquity,
      totalReturn: yearReturn,
      annualizedReturn: yearAnnualizedReturn,
      maxDrawdown: yearMaxDrawdown,
      maxDrawdownAmount: yearMaxDrawdownAmount,
      maxDrawdownPeak: yearPeakDate,
      maxDrawdownTrough: yearTroughDate,
      totalTrades: yearTrades.length,
      winRate: yearWinRate,
      emptyDays: yearEmptyDays
    });

    previousYearEndEquity = yearEndEquity;
  }

  return {
    metrics: {
      finalEquity,
      totalReturn,
      annualizedReturn,
      maxDrawdown,
      maxDrawdownAmount,
      maxDrawdownPeak: overallPeakDate,
      maxDrawdownTrough: overallTroughDate,
      totalTrades: sellTrades.length,
      winRate,
      emptyDays: totalEmptyDays
    },
    yearlyMetrics,
    equityCurve,
    trades: trades.reverse(), // Newest first
    latestStats
  };
}
