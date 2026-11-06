(() => {
  // Private manager-only UI, backed exclusively by team-scoped RLS views.
  // No worker calls, public feeds, publishing, or VOD evidence mutations.
  let activeRequest = 0;
  let loadedKey = '';
  let loadedAt = 0;
  let currentState = null;
  const panel = () => document.getElementById('vodCoveragePanel');
  const db = () => window.VVHLBackend?.db;
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, character =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));

  function summarize(rows, format) {
    const expected = rows.filter(row => row.participation_status === 'confirmed_played');
    const missing = expected.filter(row => Number(row.verified_marker_count || 0) === 0);
    const unconfirmed = rows.filter(row => row.participation_status === 'unconfirmed');
    const sixes = /^6(s|v6|vs6)?$/i.test(String(format || '').trim()) || /6v6/i.test(String(format || ''));
    const incomplete = sixes && expected.length !== 6;
    return { expected: expected.length, missing: missing.length, unconfirmed: unconfirmed.length, incomplete };
  }

  function render(rows, format) {
    const box = panel();
    if (!box) return;
    const info = summarize(rows, format);
    currentState = { ...info, rows };
    box.hidden = false;
    const notice = !rows.length
      ? 'No verified lineup attached to this game. Confirm participants before using player-specific conclusions.'
      : info.incomplete
        ? 'Sixes coverage is incomplete. Verify all six player slots before considering this review complete.'
        : info.missing
          ? info.missing + ' confirmed participant' + (info.missing === 1 ? '' : 's') + ' without individually attributed markers. Review the clips. A roster mention is not performance evidence.'
          : 'All confirmed participants have at least one attributed marker. Review each marker before using it in a player report.';
    box.innerHTML = '<h3>Verified LG identities · VOD coverage</h3>' +
      '<p class="analysis-note">' + esc(notice) + '</p>' +
      (rows.length ? '<div class="vod-identity-rows">' +
      rows.map(row => {
        const markers = Number(row.verified_marker_count || 0);
        const coverage = markers ? markers + ' attributed markers · verify plays' :
          row.named_in_analysis ? 'Named in analysis · no individual markers' :
            'No individual markers · inspect video';
        const report = row.report_state === 'report_exists' ? 'Report exists' : 'Report missing';
        return '<div class="vod-identity-row"><strong>' + esc(row.display_name) +
          ' · LG ' + esc(row.lg_user_id) + '</strong><small>' +
          esc(row.position || '') + (row.position ? ' · ' : '') +
          esc(row.participation_status.replaceAll('_', ' ')) + '</small><span>' +
          esc(coverage) + '</span><span>' + esc(report) + '</span></div>';
      }).join('') + '</div>' : '') +
      '<p class="analysis-note">Identity and lineup are verified separately from individual on-ice evidence. Unverified performance ratings must stay blank.</p>';
  }

  async function load(reviewId, teamId, gameFormat) {
    const box = panel();
    if (!box) return;
    const key = String(reviewId || '') + '/' + String(teamId || '');
    if (!reviewId || !teamId || !db()) {
      activeRequest++; loadedKey = ''; currentState = null;
      box.hidden = true; box.replaceChildren(); return;
    }
    if (key === loadedKey && Date.now() - loadedAt < 3000) return;
    loadedKey = key; loadedAt = Date.now();
    const seq = ++activeRequest;
    box.hidden = false;
    box.textContent = 'Checking confirmed lineup and VOD evidence…';
    try {
      const {data, error} = await db().from('labs_vod_player_report_status')
        .select('review_id,team_id,lg_user_id,display_name,participation_status,verified_marker_count,named_in_analysis,report_state,position')
        .eq('review_id', reviewId).eq('team_id', teamId).order('display_name');
      if (error) throw error;
      if (seq !== activeRequest) return;
      render(data || [], gameFormat);
    } catch (error) {
      if (seq !== activeRequest) return;
      currentState = null;
      box.innerHTML = '<h3>Identity coverage unavailable</h3><p class="analysis-note">' +
        esc(error.message || 'Unable to check private VOD evidence.') +
        ' Do not assume all players were tracked.</p>';
    }
  }

  window.WildmanVODCoverage = {
    load,
    getState: () => currentState
  };
})();
