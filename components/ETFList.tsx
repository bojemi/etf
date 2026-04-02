"use client";

import { useState, useMemo } from "react";
import { Play, Loader2, Search, ArrowUpDown, AlertCircle } from "lucide-react";
import { motion } from "motion/react";

const getCategory = (name: string) => {
  // 按照金融机构（如Wind、同花顺、申万行业）的标准ETF分类体系
  const clusters = [
    // ================= 1. 跨境型 (Cross-border) =================
    // 港股细分
    { keys: /恒生科技|港股科技|香港科技/i, name: "跨境-港股科技" },
    { keys: /恒生互联网|港股通互联网|中概互联|中国互联网|中概/i, name: "跨境-中概互联网" },
    { keys: /港股通医药|香港医药|恒生医疗/i, name: "跨境-港股医药" },
    { keys: /港股红利|港股通红利|恒生红利/i, name: "跨境-港股红利" },
    { keys: /恒生(?!科技|互联网|医疗|红利)|港股(?!科技|通互联网|创新药|通医药|红利)|香港(?!科技|医药)/i, name: "跨境-港股宽基" },
    // 海外细分
    { keys: /纳斯达克|纳指/i, name: "跨境-美股纳斯达克" },
    { keys: /标普/i, name: "跨境-美股标普500" },
    { keys: /道琼斯/i, name: "跨境-美股道琼斯" },
    { keys: /日经|日本/i, name: "跨境-日本股市" },
    { keys: /德国|DAX|法国|CAC|欧洲/i, name: "跨境-欧洲股市" },
    { keys: /亚太|越南|沙特|印度/i, name: "跨境-新兴市场" },

    // ================= 2. 规模宽基指数 (Broad Market) =================
    { keys: /沪深300|300ETF/i, name: "宽基-沪深300" },
    { keys: /中证500|500ETF/i, name: "宽基-中证500" },
    { keys: /中证1000|1000ETF/i, name: "宽基-中证1000" },
    { keys: /中证2000|2000ETF/i, name: "宽基-中证2000" },
    { keys: /上证50|50ETF/i, name: "宽基-上证50" },
    { keys: /科创50|科创板50/i, name: "宽基-科创50" },
    { keys: /科创100/i, name: "宽基-科创100" },
    { keys: /创业板50|创50/i, name: "宽基-创业板50" },
    { keys: /创业板指|创业板(?!50)|创指/i, name: "宽基-创业板" },
    { keys: /科创创业50|双创50/i, name: "宽基-双创50" },
    { keys: /中证A500|A500/i, name: "宽基-A500" },
    { keys: /中证A50|A50/i, name: "宽基-A50" },
    { keys: /国证2000|微盘/i, name: "宽基-小微盘" },

    // ================= 3. 行业/主题指数 (Industry/Theme) =================
    // TMT (科技、媒体和通信)
    { keys: /半导体|芯片|集成电路/i, name: "TMT-半导体/芯片" },
    { keys: /人工智能|AI|机器视觉/i, name: "TMT-人工智能" }, // 独立出AI
    { keys: /云计算|大数据|数据安全/i, name: "TMT-云计算/大数据" }, // 独立出云和大数据
    { keys: /计算机|软件|信创/i, name: "TMT-计算机/软件" },
    { keys: /通信|5G|物联网/i, name: "TMT-通信/5G" },
    { keys: /消费电子|电子|苹果产业链/i, name: "TMT-消费电子" },
    { keys: /游戏|电竞|动漫/i, name: "TMT-游戏" },
    { keys: /传媒|影视/i, name: "TMT-传媒" },

    // 新能源与环保
    { keys: /新能源车|新能车|新能源汽车|智能车|汽车|智能驾驶/i, name: "新能源-汽车/智能驾驶" },
    { keys: /电池|锂电/i, name: "新能源-电池" },
    { keys: /光伏|风电/i, name: "新能源-光伏/风电" },
    { keys: /环保|绿电|电力|新能源(?!车|汽车)/i, name: "新能源-环保/电力" },

    // 医药医疗
    { keys: /创新药/i, name: "医药-创新药" },
    { keys: /中药/i, name: "医药-中药" },
    { keys: /医疗器械/i, name: "医药-医疗器械" },
    { keys: /医药|医疗|生物药|生物科技|疫苗|卫生/i, name: "医药-综合" },

    // 大消费
    { keys: /白酒|酒/i, name: "消费-白酒" },
    { keys: /食品饮料/i, name: "消费-食品饮料" },
    { keys: /家电/i, name: "消费-家电" },
    { keys: /旅游|酒店/i, name: "消费-旅游" },
    { keys: /农业|养殖|畜牧/i, name: "消费-农业" },
    { keys: /消费/i, name: "消费-综合" },

    // 金融地产
    { keys: /券商|证券(?!投资)|非银/i, name: "金融-券商" },
    { keys: /银行/i, name: "金融-银行" },
    { keys: /保险/i, name: "金融-保险" },
    { keys: /金融/i, name: "金融-综合" },
    { keys: /房地产|地产/i, name: "地产" },

    // 周期与制造
    { keys: /机器人|自动化/i, name: "制造-机器人" },
    { keys: /工业母机|机床/i, name: "制造-工业母机" },
    { keys: /军工|国防|航空航天|大飞机/i, name: "制造-军工" },
    { keys: /煤炭/i, name: "周期-煤炭" },
    { keys: /钢铁/i, name: "周期-钢铁" },
    { keys: /有色|金属|矿业/i, name: "周期-有色金属" },
    { keys: /稀土/i, name: "周期-稀土" },
    { keys: /化工|材料/i, name: "周期-化工/材料" },
    { keys: /建材|基建|基础设施/i, name: "周期-基建/建材" },
    { keys: /物流|快递/i, name: "周期-物流" },

    // ================= 4. 策略/风格 (Smart Beta) =================
    { keys: /红利|股息/i, name: "策略-红利/股息" },
    { keys: /央企|国企|中字头/i, name: "策略-央国企" },
    { keys: /创投|专精特新/i, name: "策略-创投/专精特新" },
    { keys: /低波|质量|价值|基本面/i, name: "策略-低波/价值" },

    // ================= 5. 商品与债券 (Commodity & Bond) =================
    { keys: /黄金|上海金/i, name: "商品-黄金" },
    { keys: /豆粕|能源化工|有色期货/i, name: "商品-期货" },
    { keys: /国债/i, name: "债券-国债" },
    { keys: /地方债|城投债/i, name: "债券-地方债" },
    { keys: /信用债|公司债/i, name: "债券-信用债" },
    { keys: /可转债/i, name: "债券-可转债" },
    { keys: /活跃券|政金债|债券/i, name: "债券-综合" }
  ];

  for (const cluster of clusters) {
    if (cluster.keys.test(name)) {
      return cluster.name;
    }
  }

  // 2. Fallback: clean up the name if no cluster matched
  let cat = name;
  const companies = [
    "华夏", "易方达", "华泰柏瑞", "南方", "嘉实", "广发", "富国", "招商", "博时", "汇添富", 
    "鹏华", "银华", "工银瑞信", "工银", "交银施罗德", "交银", "建信", "中欧", "景顺长城", "天弘", 
    "国泰", "华安", "华宝", "平安", "大成", "万家", "兴全", "兴证全球", "中银", "民生加银", 
    "海富通", "国联安", "长城", "诺安", "信达澳亚", "泰康", "前海开源", "中加", "摩根", "华商", 
    "富安达", "红土创新", "长安", "财通", "诺德", "泓德", "中庚", "睿远", "泉果", "国寿安保", 
    "创金合信", "鹏扬", "蜂巢", "同泰", "惠升", "中泰", "华润元大", "中信建投", "中信保诚", "太平", 
    "浙商", "渤海汇金", "国海富兰克林", "长信", "天治", "大摩", "华富", "金鹰", "宝盈", "融通", 
    "长盛", "银河", "泰信", "嘉合", "东方", "光大保德信", "新华", "汇丰晋信", "金元顺安", "农银汇理", 
    "国金", "浦银安盛", "圆信永丰", "中海", "东吴", "红塔红土", "先锋", "德邦", "国融", "恒越", 
    "东方红", "上投摩根", "华泰", "国泰君安", "海通", "申万宏源", "国信", "中金", "光大", "安信", 
    "兴业", "长江", "方正", "西南", "华西", "西部", "东北", "东兴", "天风", "第一创业", "太平洋", 
    "华创", "国联", "华林", "南京", "中原"
  ];
  
  companies.sort((a, b) => b.length - a.length);
  for (const company of companies) {
    cat = cat.replace(new RegExp(company, 'g'), '');
  }
  
  cat = cat.replace(/中证|国证|上证|深证|沪深|恒生|标普|纳斯达克|纳指|道琼斯|MSCI|CES|富时|中创/gi, '');
  cat = cat.replace(/ETF|LOF|联接|发起式|增强|指数|A|C|E|I|份额|（.*?）|\(.*?\)|主题|全指|行业|公司|回报|混合|股票|债券|型|基金|证券投资/gi, '');
  return cat.trim() || name;
};

interface ETF {
  code: string;
  name: string;
  market: number;
  yesterdayTurnover?: number;
  latestPrice?: number;
  category?: string;
}

export default function ETFList() {
  const [etfs, setEtfs] = useState<ETF[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [strictMode, setStrictMode] = useState(true);

  const fetchETFList = async () => {
    try {
      const baseUrl =
        "https://push2.eastmoney.com/api/qt/clist/get?pz=100&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=f3&fs=b:MK0021,b:MK0022,b:MK0023,b:MK0024&fields=f12,f13,f14";
      
      // Fetch first page to get total count
      const firstRes = await fetch(`${baseUrl}&pn=1`);
      const firstJson = await firstRes.json();
      
      if (!firstJson?.data?.diff) {
        throw new Error("Failed to fetch ETF list");
      }
      
      const total = firstJson.data.total;
      const totalPages = Math.ceil(total / 100);
      let allEtfs: any[] = [...firstJson.data.diff];
      
      // Fetch remaining pages concurrently
      const promises = [];
      for (let i = 2; i <= totalPages; i++) {
        promises.push(
          fetch(`${baseUrl}&pn=${i}`).then(res => res.json())
        );
      }
      
      const remainingResults = await Promise.all(promises);
      remainingResults.forEach(res => {
        if (res?.data?.diff) {
          allEtfs = allEtfs.concat(res.data.diff);
        }
      });

      return allEtfs.map((item: any) => ({
        code: item.f12,
        market: item.f13,
        name: item.f14,
      }));
    } catch (err) {
      console.error(err);
      throw new Error("获取ETF列表失败");
    }
  };

  const fetchETFData = async (market: number, code: string) => {
    try {
      const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${market}.${code}&fields1=f1&fields2=f51,f53,f57&klt=101&fqt=1&end=20500101&lmt=2`;
      const res = await fetch(url);
      const json = await res.json();
      const klines = json?.data?.klines;
      if (klines && klines.length > 0) {
        // Get today's date in Beijing time (UTC+8)
        const today = new Date(new Date().getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        let targetKline = klines[klines.length - 1]; // Default to the latest
        let latestKline = klines[klines.length - 1]; // Always use the latest for price
        
        if (klines.length === 2) {
          const latestDate = klines[1].split(',')[0];
          if (latestDate === today) {
            // If the latest kline is today, we want the previous one (yesterday) for turnover
            targetKline = klines[0];
          } else {
            // If the latest kline is NOT today (e.g., weekend/holiday), it is the last trading day
            targetKline = klines[1];
          }
        }
        
        const turnoverParts = targetKline.split(",");
        const latestParts = latestKline.split(",");
        
        return {
          turnover: parseFloat(turnoverParts[2]) || 0,
          price: parseFloat(latestParts[1]) || 0
        };
      }
      return { turnover: 0, price: 0 };
    } catch (err) {
      return { turnover: 0, price: 0 };
    }
  };

  const startFetching = async () => {
    setLoading(true);
    setError(null);
    setEtfs([]);
    setProgress({ current: 0, total: 0 });

    try {
      const list = await fetchETFList();
      setProgress({ current: 0, total: list.length });

      const batchSize = 50;
      const results: ETF[] = [];

      for (let i = 0; i < list.length; i += batchSize) {
        const batch = list.slice(i, i + batchSize);
        const batchPromises = batch.map(async (etf: ETF) => {
          const data = await fetchETFData(etf.market, etf.code);
          return { ...etf, yesterdayTurnover: data.turnover, latestPrice: data.price };
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        setProgress({ current: Math.min(i + batchSize, list.length), total: list.length });
        
        // Update state progressively so user sees data coming in
        setEtfs((prev) => {
            const newEtfs = [...prev, ...batchResults];
            return newEtfs.sort((a, b) => (b.yesterdayTurnover || 0) - (a.yesterdayTurnover || 0));
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedEtfs = useMemo(() => {
    let result = etfs;

    if (strictMode) {
      // 1. Filter > 5亿 (500,000,000) and exclude cash-like ETFs
      result = result.filter(etf => {
        const isCashLike = /货币|理财|现金|保证金|日利|添益|快线/.test(etf.name);
        return !isCashLike && (etf.yesterdayTurnover || 0) >= 500000000;
      });
      
      // 2. Group by category and keep max
      const categoryMap = new Map<string, ETF>();
      result.forEach(etf => {
        const cat = getCategory(etf.name);
        etf.category = cat;
        const existing = categoryMap.get(cat);
        if (!existing || (etf.yesterdayTurnover || 0) > (existing.yesterdayTurnover || 0)) {
          categoryMap.set(cat, etf);
        }
      });
      result = Array.from(categoryMap.values());
    } else {
      result.forEach(etf => {
        etf.category = getCategory(etf.name);
      });
    }

    if (search) {
      result = result.filter(
        (etf) =>
          etf.code.includes(search) ||
          etf.name.toLowerCase().includes(search.toLowerCase()) ||
          (etf.category && etf.category.includes(search))
      );
    }
    result = [...result].sort((a, b) => {
      const valA = a.yesterdayTurnover || 0;
      const valB = b.yesterdayTurnover || 0;
      return sortOrder === "desc" ? valB - valA : valA - valB;
    });
    return result;
  }, [etfs, search, sortOrder, strictMode]);

  const formatCurrency = (value: number) => {
    if (value >= 100000000) {
      return (value / 100000000).toFixed(2) + " 亿";
    } else if (value >= 10000) {
      return (value / 10000).toFixed(2) + " 万";
    }
    return value.toFixed(2);
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-6 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">A股场内ETF行情</h1>
          <p className="text-gray-500 mt-1">快速获取所有开放式基金ETF代码、名称及昨日成交额</p>
        </div>
        <button
          onClick={startFetching}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Play className="w-5 h-5" />
          )}
          {loading ? "获取中..." : "开始获取数据"}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-3 border border-red-100">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {loading && progress.total > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm font-medium text-gray-600">
            <span>获取进度</span>
            <span>
              {progress.current} / {progress.total}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <motion.div
              className="bg-blue-600 h-2.5 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(progress.current / progress.total) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      {etfs.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="搜索代码、名称或类别..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors">
                <input 
                  type="checkbox" 
                  checked={strictMode} 
                  onChange={(e) => setStrictMode(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm text-blue-900 font-medium">仅显示同类龙头 (成交额&gt;5亿，排除现金)</span>
              </label>
              <div className="text-sm text-gray-500 flex items-center sm:border-l sm:pl-4">
                共 {filteredAndSortedEtfs.length} 只
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4">代码</th>
                    <th className="px-6 py-4">名称</th>
                    <th className="px-6 py-4">提取类别</th>
                    <th className="px-6 py-4">最新价格 (元)</th>
                    <th className="px-6 py-4">
                      <button
                        onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
                        className="flex items-center gap-1 hover:text-gray-900 transition-colors"
                      >
                        昨日成交额 (元)
                        <ArrowUpDown className="w-4 h-4" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAndSortedEtfs.map((etf) => (
                    <motion.tr
                      key={etf.code}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 font-mono text-gray-900">{etf.code}</td>
                      <td className="px-6 py-4 font-medium text-gray-900">{etf.name}</td>
                      <td className="px-6 py-4 text-gray-500">
                        <span className="px-2 py-1 bg-gray-100 rounded-md text-xs">{etf.category}</span>
                      </td>
                      <td className="px-6 py-4 font-medium text-blue-600">
                        {etf.latestPrice ? etf.latestPrice.toFixed(3) : '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {formatCurrency(etf.yesterdayTurnover || 0)}
                      </td>
                    </motion.tr>
                  ))}
                  {filteredAndSortedEtfs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        没有找到匹配的ETF
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
