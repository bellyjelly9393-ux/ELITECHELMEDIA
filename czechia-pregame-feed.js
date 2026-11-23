(() => {
  'use strict';

  const easternDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const easternTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC', hour: 'numeric', minute: '2-digit',
  });
  const positions = new Set(['LW', 'C', 'RW', 'LD', 'RD', 'G']);
  const aliases = { germany: 'lg-923918', usa: 'lg-923923', sweden: 'lg-923926' };

  function roster(players) {
    if (!Array.isArray(players)) return [];
    return players.filter(player => positions.has(player?.position) &&
      typeof player.gamertag === 'string' && player.gamertag.trim() && player.gamertag.length <= 80)
      .slice(0, 6).map(player => ({
        position: player.position,
        name: player.gamertag,
        ...(typeof player.jerseyNumber === 'string' && /^\d{1,2}$/.test(player.jerseyNumber)
          ? { jersey: player.jerseyNumber } : {}),
      }));
  }

  async function load() {
    const response = await fetch('/api/czechia-pregame', { signal: AbortSignal.timeout(6500) });
    if (!response.ok) throw new Error('The Czechia schedule is unavailable');
    const data = await response.json();
    if (data?.schema !== 'lgwjc-czechia-pregame-v1' || !Array.isArray(data.games)) {
      throw new Error('The Czechia schedule could not be read');
    }
    const games = data.games.filter(game => Number.isSafeInteger(game?.id) && game.id > 0 &&
      /^2026-\d{2}-\d{2}$/.test(game.date) && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(game.time) &&
      typeof game.opponent === 'string' && game.opponent.length > 0 && game.opponent.length <= 40)
      .map(game => {
        const scheduled = new Date(game.date + 'T' + game.time + ':00Z');
        return {
          key: 'lg-' + game.id, date: game.date, time: easternTime.format(scheduled) + ' ET',
          opponent: game.opponent, opponentId: game.opponentId, lineupDate: game.lineupDate,
          source: 'https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=game&gameid=' + game.id,
          czech: roster(game.czech), away: roster(game.away),
        };
      });
    return { games, usingSeed: data.usingSeed === true };
  }

  window.ECMCzechiaPregame = { load, today: () => easternDate.format(new Date()), aliases };
})();
