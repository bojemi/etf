'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Activity, DollarSign, Percent, TrendingUp, AlertTriangle, Calendar, RefreshCcw, Shield } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { runBacktest } from '@/lib/backtest';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const formatCurrency = (val: number) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(val);
const formatPercent = (val: number) => `${val.toFixed(2)}%`;

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-neutral-900 border border-neutral-700 p-4 rounded-xl shadow-2xl text-sm min-w-[200px]">
        <p className="text-neutral-400 mb-3 font-mono">{label}</p>
        <div className="mb-3">
          <p className="text-xs text-neutral-500 mb-1">当日净值</p>
          <p className="text-emerald-400 font-mono font-bold text-xl">
            {formatCurrency(data.equity)}
          </p>
        </div>
        <div className="space-y-2 border-t border-neutral-800 pt-3">
          {data.trades && data.trades.length > 0 ? (
            data.trades.map((t: any, i: number) => (
              <div key={i} className="flex flex-col gap-1">
                <span className={cn(
                  "text-xs font-semibold px-2 py-0.5 rounded w-fit",
                  t.type === 'BUY' ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                )}>
                  {t.type === 'BUY' ? '买入' : '卖出'} {t.name}
                </span>
                <span className="font-mono text-neutral-300">成交价: {t.price.toFixed(3)}</span>
              </div>
            ))
          ) : data.position ? (
            <div className="flex items-center gap-2 text-blue-400">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span>持仓中: {data.position}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-neutral-500">
              <div className="w-2 h-2 rounded-full bg-neutral-600"></div>
              <span>当前空仓</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export default function BacktestDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [initialCapital, setInitialCapital] = useState("1000000");
  const [hoveredTrade, setHoveredTrade] = useState<any>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const fetchData = async (isBackground = false) => {
    if (isBackground) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const result = await runBacktest(parseFloat(initialCapital));
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      if (isBackground) {
        setIsRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchData(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Activity className="w-8 h-8 animate-pulse text-emerald-500" />
          <p className="text-neutral-400 font-mono text-sm">QUANT-ARCHITECT-OS: RUNNING BACKTEST ENGINE...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-50 flex items-center justify-center">
        <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-lg max-w-md text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-red-400 mb-2">Engine Failure</h2>
          <p className="text-neutral-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const { metrics, yearlyMetrics, equityCurve, trades } = data;

  const chartData = selectedYear ? equityCurve.filter((d: any) => d.date.startsWith(selectedYear)) : equityCurve;
  const activeMetrics = selectedYear ? yearlyMetrics.find((y: any) => y.year === selectedYear) : metrics;
  const peakDate = activeMetrics?.maxDrawdownPeak;
  const troughDate = activeMetrics?.maxDrawdownTrough;
  const filteredTrades = selectedYear ? trades.filter((t: any) => t.date.startsWith(selectedYear)) : trades;

  const emptyPeriods: {start: string, end: string}[] = [];
  let currentEmptyStart = null;
  for (let i = 0; i < chartData.length; i++) {
    if (chartData[i].position === null) {
      if (!currentEmptyStart) currentEmptyStart = chartData[i].date;
    } else {
      if (currentEmptyStart) {
        emptyPeriods.push({ start: currentEmptyStart, end: chartData[i-1].date });
        currentEmptyStart = null;
      }
    }
  }
  if (currentEmptyStart) {
    emptyPeriods.push({ start: currentEmptyStart, end: chartData[chartData.length - 1].date });
  }

  const emptyTrades = emptyPeriods.map(ep => ({
    type: 'EMPTY',
    date: ep.end,
    startDate: ep.start,
    endDate: ep.end,
  }));

  const combinedTrades = [...filteredTrades, ...emptyTrades].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    if (a.type === 'EMPTY') return -1;
    if (b.type === 'EMPTY') return 1;
    return 0;
  });

  let plan = "";
  if (data.latestStats && data.latestStats.length > 0 && equityCurve && equityCurve.length > 0) {
    const currentPosition = equityCurve[equityCurve.length - 1].position;
    const top1 = data.latestStats[0];
    
    if (currentPosition) {
      const heldStat = data.latestStats.find((s: any) => s.name === currentPosition);
      if (heldStat) {
        const currentVsMax15 = heldStat.close / heldStat.max15 - 1;
        const takeProfitCond = heldStat.close / heldStat.prevClose - 1;
        
        let triggerSell = false;
        let sellReason = "";
        if (currentVsMax15 < -0.085) {
          triggerSell = true;
          sellReason = "触发止损";
        } else if (takeProfitCond > 0.05) {
          triggerSell = true;
          sellReason = "触发止盈";
        } else if (top1.name !== currentPosition) {
          triggerSell = true;
          sellReason = "排名非第1";
        }
        
        if (triggerSell) {
          if (top1.name !== currentPosition && top1.isTraded && top1.openRebound > 0.015) {
            plan = `卖出 ${currentPosition} (${sellReason})，买入 ${top1.name}`;
          } else {
            plan = `卖出 ${currentPosition} (${sellReason})，空仓观望`;
          }
        } else {
          plan = `继续持有 ${currentPosition}`;
        }
      }
    } else {
      if (top1 && top1.isTraded && top1.openRebound > 0.015) {
        plan = `买入 ${top1.name}`;
      } else {
        plan = "空仓观望";
      }
    }
  }

  const nowStr = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="border-b border-neutral-800 pb-6">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-100 flex items-center gap-3">
            <Activity className="w-8 h-8 text-emerald-500" />
            ETF 均线动量轮动策略
          </h1>
          <p className="text-neutral-400 mt-2 font-mono text-sm">
            QUANT-ARCHITECT-OS v1.0 | BACKTEST PERIOD: 2020-02-28 TO today
          </p>
        </header>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard 
            title="初始金额 (Initial Capital)" 
            value="" 
            icon={<DollarSign className="w-5 h-5 text-neutral-400" />}
            trend="neutral"
            isInput={true}
            inputValue={initialCapital}
            onInputChange={(e) => setInitialCapital(e.target.value)}
            onInputBlur={() => fetchData(false)}
          />
          <MetricCard 
            title="期末净值 (Final Equity)" 
            value={formatCurrency(metrics.finalEquity)} 
            icon={<DollarSign className="w-5 h-5 text-emerald-500" />}
            trend="up"
          />
          <MetricCard 
            title="总收益率 (Total Return)" 
            value={formatPercent(metrics.totalReturn)} 
            icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
            trend="up"
          />
          <MetricCard 
            title="年化收益 (Annualized)" 
            value={formatPercent(metrics.annualizedReturn)} 
            icon={<Percent className="w-5 h-5 text-emerald-500" />}
            trend="up"
          />
          <MetricCard 
            title="最大回撤 (Max Drawdown)" 
            value={formatPercent(metrics.maxDrawdown * 100)} 
            icon={<ArrowDownRight className="w-5 h-5 text-red-500" />}
            trend="down"
          />
          <MetricCard 
            title="交易胜率 (Win Rate)" 
            value={formatPercent(metrics.winRate)} 
            icon={<Activity className="w-5 h-5 text-blue-500" />}
            trend="neutral"
          />
          <MetricCard 
            title="交易总数 (Total Trades)" 
            value={metrics.totalTrades.toString()} 
            icon={<Activity className="w-5 h-5 text-neutral-400" />}
            trend="neutral"
          />
          <MetricCard 
            title="空仓总天数 (Empty Days)" 
            value={metrics.emptyDays.toString()} 
            icon={<Shield className="w-5 h-5 text-blue-500" />}
            trend="neutral"
          />
        </div>

        {/* Current Indicators Table */}
        {data.latestStats && data.latestStats.length > 0 && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-500" />
                实盘监控 (Current Indicators)
              </h2>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowInstructions(!showInstructions)}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  查看说明
                </button>
                <div className="bg-neutral-800 border border-neutral-700 px-4 py-2 rounded-md text-sm font-mono text-neutral-300">
                  数据更新时间: {nowStr}, 14:30调仓计划: <span className="text-blue-400 font-bold">{plan}</span>
                </div>
                <button 
                  onClick={() => fetchData(true)}
                  disabled={isRefreshing}
                  className="bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCcw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                  {isRefreshing ? '刷新中...' : '刷新'}
                </button>
              </div>
            </div>

            {showInstructions && (
              <div className="mb-6 bg-neutral-950 border border-neutral-800 p-6 rounded-lg text-sm text-neutral-300 space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-neutral-100 mb-4">交易规则 (Trading Rules)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-lg">
                      <h4 className="text-emerald-400 font-bold mb-2 flex items-center justify-between">
                        买入规则 (BUY)
                        <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-300">【同时满足 (且)】</span>
                      </h4>
                      <ul className="list-disc list-inside text-neutral-300 space-y-1 text-xs">
                        <li>当前为空仓状态</li>
                        <li>标的均线动量涨幅排名全市场第 1</li>
                        <li>该标的开仓涨幅 &gt; 1.5%</li>
                        <li>该标的属于可交易品种</li>
                      </ul>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg">
                      <h4 className="text-red-400 font-bold mb-2 flex items-center justify-between">
                        卖出规则 (SELL)
                        <span className="text-[10px] bg-red-500/20 px-2 py-0.5 rounded text-red-300">【满足其一 (或)】</span>
                      </h4>
                      <ul className="list-disc list-inside text-neutral-300 space-y-1 text-xs">
                        <li><strong>止损：</strong>现价跌破近15日高点的 -8.5%</li>
                        <li><strong>止盈：</strong>单日涨幅超过 +5%</li>
                        <li><strong>轮动：</strong>均线动量涨幅排名跌出第 1 名</li>
                        <li className="text-neutral-500 mt-2 list-none">注：满足以上任意一条即在收盘前卖出</li>
                      </ul>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
                      <h4 className="text-blue-400 font-bold mb-2 flex items-center justify-between">
                        空仓规则 (EMPTY)
                        <span className="text-[10px] bg-blue-500/20 px-2 py-0.5 rounded text-blue-300">【满足其一 (或)】</span>
                      </h4>
                      <ul className="list-disc list-inside text-neutral-300 space-y-1 text-xs">
                        <li>卖出原有持仓后，如果排名第 1 的标的开仓涨幅 &lt; 1.5%</li>
                        <li>或者排名第 1 的标的为“不交易”品种</li>
                        <li>此时保持空仓，规避市场主跌浪</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-neutral-800">
                  <h3 className="text-base font-semibold text-neutral-100 mb-4">指标计算公式</h3>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p><strong className="text-emerald-400">1. 均线动量涨幅</strong></p>
                      <p className="font-mono text-xs bg-neutral-900 p-2 rounded">MA(3) / MA(28) - 1</p>
                      <p className="text-xs text-neutral-400">MA(3) 包含 T 日、T-1 日、T-2 日的收盘价平均；MA(28) 包含 T 日到 T-27 日的收盘价平均。用于衡量标的近期的强势程度，排名第 1 的标的为候选买入对象。</p>
                    </div>
                    <div className="space-y-1">
                      <p><strong className="text-emerald-400">2. 开仓涨幅</strong></p>
                      <p className="font-mono text-xs bg-neutral-900 p-2 rounded">T日收盘价 / 过去60个交易日的最低收盘价 - 1</p>
                      <p className="text-xs text-neutral-400">寻找过去 60 天（包含 T 日）的最低价。只有当开仓涨幅 &gt; 1.5% 时，才允许开仓买入，用于过滤掉长期阴跌的标的。</p>
                    </div>
                    <div className="space-y-1">
                      <p><strong className="text-emerald-400">3. 止损条件</strong></p>
                      <p className="font-mono text-xs bg-neutral-900 p-2 rounded">T日收盘价 / 过去15个交易日的最高收盘价 - 1 &lt; -8.5%</p>
                      <p className="text-xs text-neutral-400">寻找过去 15 天（包含 T 日）的最高价。如果现价距离近 15 日高点回撤超过 8.5%，则无条件止损卖出。</p>
                    </div>
                    <div className="space-y-1">
                      <p><strong className="text-emerald-400">4. 止盈条件</strong></p>
                      <p className="font-mono text-xs bg-neutral-900 p-2 rounded">T日收盘价 / T-1日收盘价 - 1 &gt; 5%</p>
                      <p className="text-xs text-neutral-400">如果单日涨幅超过 5%，说明情绪高潮，直接止盈卖出。</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-neutral-400 uppercase bg-neutral-950/50 border-b border-neutral-800">
                  <tr>
                    <th className="px-4 py-3 font-medium">序号</th>
                    <th className="px-4 py-3 font-medium">名称</th>
                    <th className="px-4 py-3 font-medium">代码</th>
                    <th className="px-4 py-3 font-medium text-right">均线动量涨幅</th>
                    <th className="px-4 py-3 font-medium text-right">开仓涨幅</th>
                    <th className="px-4 py-3 font-medium text-right">现价</th>
                    <th className="px-4 py-3 font-medium text-right">近15日高点</th>
                    <th className="px-4 py-3 font-medium text-right">现价vs近15日高点涨幅</th>
                    <th className="px-4 py-3 font-medium text-right">止盈条件</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/50">
                  {data.latestStats.map((stat: any, idx: number) => {
                    const currentVsMax15 = stat.close / stat.max15 - 1;
                    const takeProfitCond = stat.close / stat.prevClose - 1;
                    return (
                      <tr key={stat.name} className="hover:bg-neutral-800/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-neutral-400">{idx + 1}</td>
                        <td className="px-4 py-3 font-medium text-neutral-200">
                          {stat.name}
                          {!stat.isTraded && <span className="ml-2 text-[10px] bg-neutral-800 text-neutral-500 px-1.5 py-0.5 rounded">(不交易)</span>}
                        </td>
                        <td className="px-4 py-3 font-mono text-blue-400">{stat.code}</td>
                        <td className="px-4 py-3 text-right font-mono">
                          <span className={stat.momentum > 0 ? "text-emerald-400" : "text-red-400"}>
                            {stat.momentum > 0 ? '+' : ''}{formatPercent(stat.momentum * 100)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          <span className={stat.openRebound > 0 ? "text-emerald-400" : "text-red-400"}>
                            {stat.openRebound > 0 ? '+' : ''}{formatPercent(stat.openRebound * 100)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-neutral-300">{stat.close.toFixed(3)}</td>
                        <td className="px-4 py-3 text-right font-mono text-neutral-400">{stat.max15.toFixed(3)}</td>
                        <td className="px-4 py-3 text-right font-mono">
                          <span className={currentVsMax15 > 0 ? "text-emerald-400" : "text-red-400"}>
                            {currentVsMax15 > 0 ? '+' : ''}{formatPercent(currentVsMax15 * 100)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          <span className={takeProfitCond > 0 ? "text-emerald-400" : "text-red-400"}>
                            {takeProfitCond > 0 ? '+' : ''}{formatPercent(takeProfitCond * 100)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Yearly Metrics Table */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-500" />
            年度表现 (Yearly Performance)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-neutral-400 uppercase bg-neutral-950/50 border-b border-neutral-800">
                <tr>
                  <th className="px-4 py-3 font-medium">年份</th>
                  <th className="px-4 py-3 font-medium text-right">期末净值</th>
                  <th className="px-4 py-3 font-medium text-right">年收益率</th>
                  <th className="px-4 py-3 font-medium text-right">年化收益</th>
                  <th className="px-4 py-3 font-medium text-right">最大回撤</th>
                  <th className="px-4 py-3 font-medium text-right">空仓天数</th>
                  <th className="px-4 py-3 font-medium text-right">交易胜率</th>
                  <th className="px-4 py-3 font-medium text-right">交易总数</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {yearlyMetrics.map((ym: any) => (
                  <tr 
                    key={ym.year} 
                    onClick={() => setSelectedYear(selectedYear === ym.year ? null : ym.year)}
                    className={cn(
                      "transition-colors cursor-pointer",
                      selectedYear === ym.year 
                        ? "bg-neutral-800/80 border-l-2 border-purple-500" 
                        : "hover:bg-neutral-800/30"
                    )}
                  >
                    <td className="px-4 py-3 font-mono text-neutral-200 font-semibold">{ym.year}</td>
                    <td className="px-4 py-3 text-right font-mono text-neutral-300">{formatCurrency(ym.endEquity)}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className={ym.totalReturn > 0 ? "text-emerald-400" : "text-red-400"}>
                        {ym.totalReturn > 0 ? '+' : ''}{formatPercent(ym.totalReturn)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className={ym.annualizedReturn > 0 ? "text-emerald-400" : "text-red-400"}>
                        {ym.annualizedReturn > 0 ? '+' : ''}{formatPercent(ym.annualizedReturn)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-red-400">
                      {formatPercent(ym.maxDrawdown * 100)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-blue-400">
                      {ym.emptyDays}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-neutral-300">
                      {formatPercent(ym.winRate)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-neutral-300">
                      {ym.totalTrades}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Equity Curve Chart */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              资金曲线 (Equity Curve) {selectedYear && `- ${selectedYear}年`}
            </h2>
            {selectedYear && (
              <button 
                onClick={() => setSelectedYear(null)}
                className="flex items-center gap-1 text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors bg-neutral-800 px-3 py-1.5 rounded-md"
              >
                <RefreshCcw className="w-3 h-3" />
                显示全部年份
              </button>
            )}
          </div>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#525252" 
                  tick={{ fill: '#737373', fontSize: 12 }}
                  tickFormatter={(val) => val.substring(0, 7)} // Show YYYY-MM
                  minTickGap={30}
                />
                <YAxis 
                  stroke="#525252" 
                  tick={{ fill: '#737373', fontSize: 12 }}
                  tickFormatter={(val) => `¥${(val / 10000).toFixed(0)}w`}
                  domain={['auto', 'auto']}
                />
                <Tooltip content={<CustomTooltip />} />
                {emptyPeriods.map((ep, idx) => (
                  <ReferenceArea 
                    key={`empty-${idx}`}
                    x1={ep.start} 
                    x2={ep.end} 
                    strokeOpacity={0} 
                    fill="#3b82f6" 
                    fillOpacity={0.1} 
                  />
                ))}
                {peakDate && troughDate && (
                  <ReferenceArea 
                    x1={peakDate} 
                    x2={troughDate} 
                    strokeOpacity={0.3} 
                    fill="#ef4444" 
                    fillOpacity={0.15} 
                  />
                )}
                <Line 
                  type="monotone" 
                  dataKey="equity" 
                  stroke="#10b981" 
                  strokeWidth={2} 
                  dot={false} 
                  activeDot={{ r: 6, fill: '#10b981', stroke: '#052e16', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {(peakDate && troughDate) || emptyPeriods.length > 0 ? (
            <div className="mt-4 text-xs text-neutral-500 flex flex-col gap-2 bg-neutral-950 p-3 rounded-lg border border-neutral-800">
              {peakDate && troughDate && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500/20 border border-red-500/50 rounded-sm shrink-0"></div>
                  <span>
                    红色高亮区域为该时段内的最大回撤区间 (<span className="font-mono">{peakDate}</span> 至 <span className="font-mono">{troughDate}</span>)，
                    回撤幅度: <strong className="text-red-400 font-mono">-{formatPercent(activeMetrics?.maxDrawdown * 100)}</strong>，
                    回撤金额: <strong className="text-red-400 font-mono">-{formatCurrency(activeMetrics?.maxDrawdownAmount)}</strong>
                  </span>
                </div>
              )}
              {emptyPeriods.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500/20 border border-blue-500/50 rounded-sm shrink-0"></div>
                  <span>蓝色高亮区域为策略空仓阶段（无持仓）</span>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Trade History */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-500" />
            交易日志 (Trade Log) {selectedYear && `- ${selectedYear}年`}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-neutral-400 uppercase bg-neutral-950/50 border-b border-neutral-800">
                <tr>
                  <th className="px-4 py-3 font-medium">日期</th>
                  <th className="px-4 py-3 font-medium">类型</th>
                  <th className="px-4 py-3 font-medium">标的</th>
                  <th className="px-4 py-3 font-medium text-right">价格</th>
                  <th className="px-4 py-3 font-medium">触发原因</th>
                  <th className="px-4 py-3 font-medium text-right">盈亏(%)</th>
                  <th className="px-4 py-3 font-medium text-right">盈亏金额</th>
                  <th className="px-4 py-3 font-medium text-right">交易后资金</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {combinedTrades.map((trade: any, idx: number) => {
                  if (trade.type === 'EMPTY') {
                    return (
                      <tr key={`empty-${idx}`} className="bg-blue-500/5 border-y border-blue-500/10">
                        <td colSpan={8} className="px-4 py-3 text-center text-blue-400 text-xs font-medium">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500/50"></div>
                            空仓阶段：{trade.startDate === trade.endDate ? trade.startDate : `${trade.startDate} 至 ${trade.endDate}`}
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr 
                      key={idx} 
                      className="hover:bg-neutral-800/30 transition-colors"
                      onMouseEnter={(e) => {
                        setHoveredTrade(trade);
                        setMousePos({ x: e.clientX, y: e.clientY });
                      }}
                      onMouseMove={(e) => {
                        setMousePos({ x: e.clientX, y: e.clientY });
                      }}
                      onMouseLeave={() => setHoveredTrade(null)}
                    >
                      <td className="px-4 py-3 font-mono text-neutral-300">{trade.date}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "px-2 py-1 rounded text-xs font-semibold",
                          trade.type === 'BUY' ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                        )}>
                          {trade.type === 'BUY' ? '买入' : '卖出'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-neutral-200">{trade.name}</td>
                      <td className="px-4 py-3 text-right font-mono text-neutral-300">{trade.price.toFixed(3)}</td>
                      <td className="px-4 py-3 text-neutral-400 text-xs">{trade.reason}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        {trade.type === 'SELL' ? (
                          <span className={trade.profit > 0 ? "text-emerald-400" : "text-red-400"}>
                            {trade.profit > 0 ? '+' : ''}{trade.profit.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-neutral-600">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {trade.type === 'SELL' ? (
                          <span className={trade.profitAmount > 0 ? "text-emerald-400" : "text-red-400"}>
                            {trade.profitAmount > 0 ? '+' : ''}{formatCurrency(trade.profitAmount)}
                          </span>
                        ) : (
                          <span className="text-neutral-600">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-neutral-300">
                        {formatCurrency(trade.capitalAfter)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-center text-xs text-neutral-500">
            共 {filteredTrades.length} 笔交易记录
          </div>
        </div>

      </div>

      {hoveredTrade && hoveredTrade.dailyStats && (
        <div 
          className="fixed z-50 bg-neutral-900 border border-neutral-700 p-4 rounded-xl shadow-2xl text-xs pointer-events-none w-[600px]"
          style={{ 
            top: Math.min(mousePos.y + 15, typeof window !== 'undefined' ? window.innerHeight - 300 : 0),
            left: Math.min(mousePos.x + 15, typeof window !== 'undefined' ? window.innerWidth - 620 : 0)
          }}
        >
          <h4 className="text-neutral-200 font-semibold mb-2 border-b border-neutral-800 pb-2">
            {hoveredTrade.date} 当日全市场指标快照
          </h4>
          <table className="w-full text-left">
            <thead className="text-neutral-500">
              <tr>
                <th className="pb-2">排名</th>
                <th className="pb-2">标的</th>
                <th className="pb-2 text-right">均线动量</th>
                <th className="pb-2 text-right">开仓涨幅</th>
                <th className="pb-2 text-right">现价/15日高</th>
                <th className="pb-2 text-right">单日涨幅</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50">
              {hoveredTrade.dailyStats.map((stat: any, i: number) => {
                const currentVsMax15 = stat.close / stat.max15 - 1;
                const takeProfitCond = stat.close / stat.prevClose - 1;
                const isTarget = stat.name === hoveredTrade.name;
                return (
                  <tr key={stat.name} className={isTarget ? "bg-blue-500/10" : ""}>
                    <td className="py-1.5 text-neutral-400">{i + 1}</td>
                    <td className="py-1.5 font-medium text-neutral-300">
                      {stat.name}
                      {!stat.isTraded && <span className="text-[10px] text-neutral-500 ml-1">(不交易)</span>}
                    </td>
                    <td className="py-1.5 text-right font-mono">
                      <span className={stat.momentum > 0 ? "text-emerald-400" : "text-red-400"}>
                        {stat.momentum > 0 ? '+' : ''}{(stat.momentum * 100).toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-1.5 text-right font-mono">
                      <span className={stat.openRebound > 0 ? "text-emerald-400" : "text-red-400"}>
                        {stat.openRebound > 0 ? '+' : ''}{(stat.openRebound * 100).toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-1.5 text-right font-mono">
                      <span className={currentVsMax15 > 0 ? "text-emerald-400" : "text-red-400"}>
                        {currentVsMax15 > 0 ? '+' : ''}{(currentVsMax15 * 100).toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-1.5 text-right font-mono">
                      <span className={takeProfitCond > 0 ? "text-emerald-400" : "text-red-400"}>
                        {takeProfitCond > 0 ? '+' : ''}{(takeProfitCond * 100).toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}

function MetricCard({ title, value, icon, trend, isInput, inputValue, onInputChange, onInputBlur }: { title: string, value: string, icon: React.ReactNode, trend: 'up' | 'down' | 'neutral', isInput?: boolean, inputValue?: string, onInputChange?: (e: any) => void, onInputBlur?: () => void }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-neutral-400">{title}</span>
        <div className="p-2 bg-neutral-950 rounded-lg border border-neutral-800">
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        {isInput ? (
          <input 
            type="number" 
            value={inputValue} 
            onChange={onInputChange} 
            onBlur={onInputBlur}
            className="text-2xl font-bold text-neutral-100 font-mono tracking-tight bg-transparent border-b border-neutral-700 outline-none focus:border-emerald-500 w-full"
          />
        ) : (
          <span className="text-2xl font-bold text-neutral-100 font-mono tracking-tight">{value}</span>
        )}
      </div>
    </div>
  );
}
