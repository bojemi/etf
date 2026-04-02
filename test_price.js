const https = require('https');
const url = 'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=0.159967&fields1=f1&fields2=f51,f52,f53,f54,f55,f56,f57&klt=101&fqt=1&end=20500101&lmt=2';
https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    console.log(json.data.klines);
  });
});
