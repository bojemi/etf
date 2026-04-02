const https = require('https');
https.get('https://raw.githubusercontent.com/akfamily/akshare/master/akshare/fund/fund_em.py', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const lines = data.split('\n');
    let inEtfSpot = false;
    lines.forEach(line => {
      if (line.includes('def fund_etf_spot_em')) inEtfSpot = true;
      if (line.includes('def ') && !line.includes('def fund_etf_spot_em')) inEtfSpot = false;
      if (inEtfSpot) console.log(line);
    });
  });
});
