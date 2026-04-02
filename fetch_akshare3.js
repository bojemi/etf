const https = require('https');
https.get('https://raw.githubusercontent.com/akfamily/akshare/master/akshare/fund/fund_em.py', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const lines = data.split('\n');
    lines.forEach((line, i) => {
      if (line.includes('etf') && line.includes('fs=')) {
        console.log(line);
      }
    });
  });
});
