const https = require('https');

// 目标数据 (基于截图)
const etfs = [
  { name: '创成长', code: '159967', indexSecid: '0.399296', indexName: '创成长' },
  { name: '黄金ETF', code: '518880', indexSecid: '1.518880', indexName: '黄金ETF' },
  { name: '国证2000', code: '159628', indexSecid: '0.399303', indexName: '国证2000' },
  { name: '中证1000', code: '512100', indexSecid: '1.000852', indexName: '中证1000' },
  { name: '恒生ETF', code: '159920', indexSecid: '0.159920', indexName: '恒生ETF' },
  { name: '纳指ETF', code: '513100', indexSecid: '1.513100', indexName: '纳指ETF' },
  { name: '上证指数', code: '510210', indexSecid: '1.000001', indexName: '上证指数' },
  { name: '科创100', code: '588220', indexSecid: '1.000698', indexName: '科创100' },
  { name: '中证A100', code: '512910', indexSecid: '1.000903', indexName: '中证A100' }
];

console.log('================================================================================');
console.log('ETF标的与对应计算指数映射表');
console.log('================================================================================\n');

console.log(String('序号').padEnd(4) + ' | ' + 
            String('ETF名称').padEnd(10) + ' | ' + 
            String('ETF代码').padEnd(8) + ' | ' + 
            String('计算所用指数/标的名称').padEnd(20) + ' | ' + 
            String('计算所用东方财富Secid').padEnd(20));
console.log('-'.repeat(80));

etfs.forEach((etf, index) => {
  console.log(String(index + 1).padEnd(4) + ' | ' + 
              String(etf.name).padEnd(10) + ' | ' + 
              String(etf.code).padEnd(8) + ' | ' + 
              String(etf.indexName).padEnd(20) + ' | ' + 
              String(etf.indexSecid).padEnd(20));
});
console.log('-'.repeat(80));
