const https = require('https');

const testSecids = [
  '0.399296', // 创成长
  '1.000903', // 中证A100 (原中证100)
  '1.000001', // 上证指数
  '1.000698', // 科创100
  '1.000852', // 中证1000
  '0.399303', // 国证2000
  '100.NDX',  // 纳斯达克100
  '124.HSI',  // 恒生指数 (maybe 100.HSI or 116.HSI or 124.HSI)
  '116.HSI',
  '100.HSI',
  '8.Au9999', // 黄金
  '113.Au9999',
  '10.Au9999'
];

const fetchData = (secid) => {
  return new Promise((resolve) => {
    const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&fields1=f1&fields2=f51,f53&klt=101&fqt=1&end=20500101&lmt=1`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json && json.data && json.data.klines) {
            resolve(`${secid}: OK`);
          } else {
            resolve(`${secid}: Not Found`);
          }
        } catch (e) {
          resolve(`${secid}: Error`);
        }
      });
    }).on('error', () => resolve(`${secid}: Request Error`));
  });
};

const run = async () => {
  for (const secid of testSecids) {
    console.log(await fetchData(secid));
  }
};

run();
