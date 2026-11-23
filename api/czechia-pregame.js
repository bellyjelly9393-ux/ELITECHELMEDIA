const seed = require('../data/wjr/czechia-pregame.json');
const feed = 'https://raw.githubusercontent.com/bellyjelly9393-ux/ELITECHELMEDIA/wjr-pregame-data/data/wjr/czechia-pregame.json';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }
  let snapshot = seed;
  let usingSeed = true;
  try {
    const response = await fetch(feed + '?minute=' + Math.floor(Date.now() / 60000), {
      redirect: 'error',
      signal: AbortSignal.timeout(4000),
    });
    if (response.ok) {
      const raw = await response.text();
      if (raw.length > 0 && raw.length <= 256000) {
        const data = JSON.parse(raw);
        if (data?.schema === seed.schema && data.season === seed.season && Array.isArray(data.games) && data.games.length) {
          snapshot = data;
          usingSeed = false;
        }
      }
    }
  } catch {
    // The checked-in schedule allows already-issued fixture links to open during a data-feed outage.
  }

  res.setHeader('Cache-Control', usingSeed ? 'no-store' : 'public, max-age=0, s-maxage=45');
  return res.status(200).json({ ...snapshot, usingSeed });
};
