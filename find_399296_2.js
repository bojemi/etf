const https = require('https');

const fetchData = (secid) => {
  return new Promise((resolve, reject) => {
    const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&fields1=f1&fields2=f51,f53&klt=101&fqt=1&end=20500101&lmt=100`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json && json.data && json.data.klines) {
            const klines = json.data.klines.map(k => {
              const parts = k.split(',');
              return { date: parts[0], close: parseFloat(parts[1]) };
            });
            resolve(klines);
          } else {
            resolve([]);
          }
        } catch (e) {
          resolve([]);
        }
      });
    }).on('error', reject);
  });
};

const calculateMA = (data, index, period) => {
  if (index < period - 1) return null;
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[index - i].close;
  }
  return sum / period;
};

const run = async () => {
  const data = await fetchData('0.399296'); // SZSE index
  if (!data || data.length === 0) {
    console.log("No data found for 0.399296");
    return;
  }

  const target = 3.47;
  const datesToCheck = data.slice(-1).map(d => d.date); // Today only
  
  const xs = [1, 2, 3, 4, 5];
  const ys = Array.from({length: 16}, (_, i) => i + 15); // 15 to 30

  for (const date of datesToCheck) {
    let bestMatches = [];
    const index = data.findIndex(d => d.date === date);
    if (index === -1) continue;

    for (const x of xs) {
      for (const y of ys) {
        const maX = calculateMA(data, index, x);
        const maY = calculateMA(data, index, y);

        if (maX && maY) {
          const momentum = (maX / maY - 1) * 100;
          const error = Math.abs(momentum - target);
          bestMatches.push({ x, y, calc: momentum.toFixed(2), error });
        }
      }
    }

    bestMatches.sort((a, b) => a.error - b.error);
    console.log(`\nDate: ${date} - Top 10 matches for target ${target}%:`);
    for (let i = 0; i < 10; i++) {
      console.log(`  MA(${bestMatches[i].x}) / MA(${bestMatches[i].y}) - 1 = ${bestMatches[i].calc}% (Error: ${bestMatches[i].error.toFixed(4)})`);
    }
  }
};

run();
