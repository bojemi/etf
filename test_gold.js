const https = require('https');

const testSecids = [
  '118.AU9999', '113.AU9999', '113.Au9999', '8.Au9999', '10.Au9999', '11.Au9999', '105.AU9999',
  '1.518880'
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
