'use server';

import { defaultEtfs } from './constants';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const fetchWithRetry = async (url: string, retries = 5, delayMs = 1000) => {
  let currentDelay = delayMs;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Connection': 'keep-alive'
        },
        timeout: 10000
      });
      return res.data;
    } catch (err: any) {
      if (i === retries - 1) throw err;
      console.warn(`Fetch failed (attempt ${i + 1}/${retries}) for ${url}. Error: ${err.message}. Retrying in ${currentDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, currentDelay));
      currentDelay *= 2;
    }
  }
};

const getBeijingTime = () => {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 8));
};

const getTencentCode = (eastmoneySecid: string) => {
  const parts = eastmoneySecid.split('.');
  if (parts.length !== 2) return eastmoneySecid;
  const prefix = parts[0] === '0' ? 'sz' : 'sh';
  return prefix + parts[1];
};

const CACHE_DIR = path.join(process.cwd(), 'data');
const CACHE_FILE = path.join(CACHE_DIR, 'etf_cache.json');
const START_DATE = '2020-02-28';

function getCache() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  if (fs.existsSync(CACHE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    } catch (e) {
      console.error("Failed to parse cache file", e);
    }
  }
  return {};
}

function saveCache(cache: any) {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
}

export async function syncEtfData(etf: any) {
  const cache = getCache();
  let cacheUpdated = false;
  const bjTime = getBeijingTime();
  const todayStr = bjTime.toISOString().split('T')[0];

  const fetchAndMerge = async (tencentCode: string) => {
    let cachedData = cache[tencentCode] || [];
    let fetchStartDate = START_DATE;
    
    if (cachedData.length > 0) {
      const lastDate = cachedData[cachedData.length - 1][0];
      if (lastDate >= todayStr) return; // Already up to date
      fetchStartDate = lastDate;
    }

    const url = `http://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${tencentCode},day,${fetchStartDate},${todayStr},2000,qfq`;
    const json = await fetchWithRetry(url);
    
    let newData: any[] = [];
    if (json && json.data && json.data[tencentCode]) {
      newData = json.data[tencentCode].qfqday || json.data[tencentCode].day || [];
    }

    if (newData.length > 0) {
      const newDataMap = new Map(newData.map((k: any) => [k[0], k]));
      const mergedData = [];
      for (const k of cachedData) {
        if (!newDataMap.has(k[0])) {
          mergedData.push(k);
        }
      }
      for (const k of newData) {
        mergedData.push(k);
      }
      mergedData.sort((a, b) => a[0].localeCompare(b[0]));
      
      cache[tencentCode] = mergedData;
      cacheUpdated = true;
    } else if (cachedData.length === 0) {
      throw new Error(`无法获取代码 ${tencentCode} 的数据，请检查代码是否正确（注意：0代表深交所，1代表上交所）。`);
    }
  };

  try {
    const calcTencentCode = getTencentCode(etf.calcSecid);
    await fetchAndMerge(calcTencentCode);
    
    if (etf.calcSecid !== etf.tradeSecid) {
      const tradeTencentCode = getTencentCode(etf.tradeSecid);
      await fetchAndMerge(tradeTencentCode);
    }

    if (cacheUpdated) {
      saveCache(cache);
    }
    return { success: true };
  } catch (err: any) {
    console.error(`Failed to sync data for ${etf.name}:`, err);
    return { success: false, error: err.message };
  }
}

export async function getCacheInfo(etfs: any[]) {
  const cache = getCache();
  const info: any[] = [];
  
  for (const [code, data] of Object.entries(cache)) {
    const records = data as any[];
    if (records.length > 0) {
      let description = "未知数据";
      let relatedName = "";
      let type = "";

      for (const etf of etfs) {
        const calcCode = getTencentCode(etf.calcSecid);
        const tradeCode = getTencentCode(etf.tradeSecid);

        if (code === calcCode && code === tradeCode) {
          relatedName = etf.name;
          type = "指数与交易同标的";
          break;
        } else if (code === calcCode) {
          relatedName = etf.name;
          type = "计算指数";
          break;
        } else if (code === tradeCode) {
          relatedName = etf.name;
          type = "交易ETF";
          break;
        }
      }

      if (relatedName) {
        description = `${relatedName} (${type})`;
      } else {
        description = `未知 (${code})`;
      }

      info.push({
        code,
        description,
        startDate: records[0][0],
        endDate: records[records.length - 1][0],
        count: records.length
      });
    }
  }
  
  return info;
}

export interface BacktestParams {
  maFast?: number;
  maSlow?: number;
  minPeriod?: number;
  maxShort?: number;
  maxLong?: number;
  stopLossPct?: number;
  takeProfitPct?: number;
  reboundPct?: number;
}

export async function runBacktest(
  initialCapital: number, 
  customEtfs?: any[], 
  takeProfitStrategy: '3day_high' | 'daily_surge' = '3day_high',
  params?: BacktestParams
) {
  const p = {
    maFast: params?.maFast || 3,
    maSlow: params?.maSlow || 28,
    minPeriod: params?.minPeriod || 30,
    maxShort: params?.maxShort || 3,
    maxLong: params?.maxLong || 15,
    stopLossPct: params?.stopLossPct || 0.085,
    takeProfitPct: params?.takeProfitPct || 0.05,
    reboundPct: params?.reboundPct || 0.015
  };

  const etfsToUse = customEtfs && customEtfs.length > 0 ? customEtfs : defaultEtfs;
  const rawData: any = {};
  const cache = getCache();
  
  const bjTime = getBeijingTime();
  const todayStr = bjTime.toISOString().split('T')[0];
  const END_DATE = todayStr;

  for (const etf of etfsToUse) {
    const calcTencentCode = getTencentCode(etf.calcSecid);
    const calcRawData = cache[calcTencentCode] || [];
    
    let calcData = calcRawData.map((k: any) => ({
      date: k[0],
      open: parseFloat(k[1]),
      close: parseFloat(k[2]),
      high: parseFloat(k[3]),
      low: parseFloat(k[4])
    }));

    let tradeData = calcData;
    if (etf.calcSecid !== etf.tradeSecid) {
      const tradeTencentCode = getTencentCode(etf.tradeSecid);
      const tradeRawData = cache[tradeTencentCode] || [];
      
      tradeData = tradeRawData.map((k: any) => ({
        date: k[0],
        open: parseFloat(k[1]),
        close: parseFloat(k[2]),
        high: parseFloat(k[3]),
        low: parseFloat(k[4])
      }));
    }

    if (calcData.length > 0 && tradeData.length > 0) {
      rawData[etf.name] = { code: etf.code, calcData, tradeData };
    }
  }

  const etfNames = Object.keys(rawData);
  if (etfNames.length === 0) {
    throw new Error("Failed to fetch any ETF data. Please check your network connection or sync data first.");
  }

  let allDatesSet = new Set<string>();

  etfNames.forEach(name => {
    rawData[name].calcData.forEach((k: any) => {
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

  const calcMinExcludeToday = (data: any[], index: number, period: number) => {
    if (index < period) return null;
    let min = Infinity;
    for (let i = 1; i <= period; i++) {
      if (data[index - i].close < min) min = data[index - i].close;
    }
    return min;
  };

  const calcMaxExcludeToday = (data: any[], index: number, period: number, field: string = 'close') => {
    if (index < period) return null;
    let max = -Infinity;
    for (let i = 1; i <= period; i++) {
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
      const calcEtfData = rawData[name].calcData;
      const tradeEtfData = rawData[name].tradeData;
      const calcIndex = calcEtfData.findIndex((d: any) => d.date === today);
      const tradeIndex = tradeEtfData.findIndex((d: any) => d.date === today);
      if (calcIndex === -1 || tradeIndex === -1) {
        if (today === allDates[allDates.length - 1]) {
          console.log(`Skipping ${name} on ${today} due to missing data: calcIndex=${calcIndex}, tradeIndex=${tradeIndex}`);
        }
        continue;
      }

      const calcClose = calcEtfData[calcIndex].close;
      const tradeClose = tradeEtfData[tradeIndex].close;
      
      const ma3 = calcMA(calcEtfData, calcIndex, p.maFast);
      const ma28 = calcMA(calcEtfData, calcIndex, p.maSlow);
      const min30 = calcMinExcludeToday(calcEtfData, calcIndex, p.minPeriod);
      const max3 = calcMaxExcludeToday(calcEtfData, calcIndex, p.maxShort);
      const max15 = calcMaxExcludeToday(calcEtfData, calcIndex, p.maxLong);

      if (ma3 && ma28 && min30 && max3 && max15) {
        dailyStats.push({
          name,
          code: rawData[name].code,
          close: tradeClose,
          calcClose: calcClose,
          prevClose: tradeIndex > 0 ? tradeEtfData[tradeIndex - 1].close : tradeClose,
          momentum: ma3 / ma28 - 1,
          openRebound: calcClose / min30 - 1,
          takeProfit: calcClose / max3 - 1,
          max15: max15,
          isTraded: etfsToUse.find((e: any) => e.name === name)?.traded || false
        });
      } else {
        console.log(`Skipping ${name} on ${today} due to missing indicators: ma3=${ma3}, ma28=${ma28}, min30=${min30}, max3=${max3}, max15=${max15}`);
      }
    }

    if (dailyStats.length === 0) {
      let currentEquity = capital;
      if (position) {
        const tradeEtfData = rawData[position.name].tradeData;
        let lastClose = position.buy_price;
        for (let i = tradeEtfData.length - 1; i >= 0; i--) {
          if (tradeEtfData[i].date <= today) {
            lastClose = tradeEtfData[i].close;
            break;
          }
        }
        currentEquity = position.shares * lastClose;
      }
      equityCurve.push({ date: today, equity: currentEquity, trades: [], position: position ? position.name : null });
      continue;
    }

    dailyStats.sort((a, b) => b.momentum - a.momentum);
    
    // 仅将参与交易的标的纳入轮动排序和计算
    const tradedStats = dailyStats.filter(s => s.isTraded);
    const topTradedEtf = tradedStats.length > 0 ? tradedStats[0] : null;

    let dailyTrades: any[] = [];

    // --- 卖出逻辑 ---
    let soldToday = null;
    if (position) {
      const heldStats = dailyStats.find(s => s.name === position.name);
      if (heldStats) {
        const isNotTop1 = topTradedEtf ? topTradedEtf.name !== position.name : false;
        
        const stopLossPrice = heldStats.max15 * (1 - p.stopLossPct);
        const triggerStopLoss = heldStats.calcClose < stopLossPrice;
        
        let triggerTakeProfit = false;
        let takeProfitReason = '';
        if (takeProfitStrategy === 'daily_surge') {
          triggerTakeProfit = (heldStats.close / heldStats.prevClose - 1) > p.takeProfitPct;
          takeProfitReason = `触发止盈(当日收盘涨幅>${(p.takeProfitPct*100).toFixed(1)}%)`;
        } else {
          triggerTakeProfit = heldStats.takeProfit > p.takeProfitPct;
          takeProfitReason = `触发止盈(现价较近3日高点涨幅>${(p.takeProfitPct*100).toFixed(1)}%)`;
        }

        if (isNotTop1 || triggerStopLoss || triggerTakeProfit) {
          if (position.buy_date !== today) { // T+1
            let sellPrice = heldStats.close;
            let reason = '';

            if (triggerStopLoss) {
              reason = '触发止损(15日高点回撤<-8.5%)';
            } else if (triggerTakeProfit) {
              reason = takeProfitReason;
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
    if (!position && topTradedEtf) {
      const bestToBuy = topTradedEtf;
      if (bestToBuy.name !== soldToday) {
        if (bestToBuy.openRebound > p.reboundPct) {
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
        const tradeEtfData = rawData[position.name].tradeData;
        let lastClose = position.buy_price;
        for (let i = tradeEtfData.length - 1; i >= 0; i--) {
          if (tradeEtfData[i].date <= today) {
            lastClose = tradeEtfData[i].close;
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
