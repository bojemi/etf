const https = require('https');
const fs = require('fs');

// 剔除不交易的标的（国证2000、上证指数、中证A100）后的6个回测标的
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

const fetchData = (secid) => {
  return new Promise((resolve, reject) => {
    // 获取过去约8年的数据 (lmt=2000)，包含开盘、收盘、最高、最低，用于完整回测
    const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&fields1=f1&fields2=f51,f52,f53,f54,f55&klt=101&fqt=1&end=20500101&lmt=2000`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (!json.data || !json.data.klines) {
            resolve([]);
            return;
          }
          const klines = json.data.klines.map(k => {
            const parts = k.split(',');
            return { 
              date: parts[0], 
              open: parseFloat(parts[1]),
              close: parseFloat(parts[2]),
              high: parseFloat(parts[3]),
              low: parseFloat(parts[4])
            };
          });
          resolve(klines);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
};

const run = async () => {
  console.log('开始获取回测历史数据...');
  const backtestData = {};
  
  for (const etf of targetEtfs) {
    console.log(`正在获取 [${etf.name}] (${etf.code}) 的历史数据...`);
    try {
      const data = await fetchData(etf.secid);
      backtestData[etf.name] = {
        code: etf.code,
        secid: etf.secid,
        data: data
      };
      console.log(`  成功获取 ${data.length} 条K线数据 (起始日期: ${data[0]?.date}, 结束日期: ${data[data.length-1]?.date})`);
    } catch (e) {
      console.error(`  获取 [${etf.name}] 数据失败:`, e.message);
    }
  }

  const outputPath = './backtest_data.json';
  fs.writeFileSync(outputPath, JSON.stringify(backtestData, null, 2));
  console.log(`\n所有数据获取完毕，已成功保存至 ${outputPath}`);
};

run();
