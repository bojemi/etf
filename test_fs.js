const https = require('https');
https.get('https://raw.githubusercontent.com/akfamily/akshare/master/akshare/fund/fund_em.py', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const lines = data.split('\n');
    lines.forEach((line, i) => {
      if (line.includes('def fund_etf_fund_daily_em')) {
        console.log(lines.slice(i, i+30).join('\n'));
      }
    });
  });
});
