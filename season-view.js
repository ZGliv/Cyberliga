export function mountSeason({ sportId, content, brand }) {
  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const state = { source: 'loading', seasonId: null, completedGames: 0 };
  let selected = '', generation = 0, detailGeneration = 0;
  const picker = byId('season-picker'), dialog = byId('fixture-dialog');
  const club = id => content.getTeam(id, sportId);
  const name = item => brand.displayName(club(item.publicId) || { name:item.name, city:item.city });
  const date = value => new Date(value).toLocaleString(undefined, { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
  function status(text, note) { byId('season-status').textContent = text; byId('season-note').textContent = note; }
  async function load() {
    const version = ++generation;
    try {
      const response = await fetch('/api/seasons?' + new URLSearchParams({ sport:sportId, ...(selected ? { season:selected } : {}) }));
      if (!response.ok) throw new Error('Saved history is temporarily unavailable. Retrying shortly.');
      const data = await response.json();
      if (version !== generation) return;
      if (!data.persisted) {
        state.source = 'unavailable'; status('Not connected', data.message || 'Saved league history is not connected.');
        byId('season-content').hidden = true; return;
      }
      Object.assign(state, { source:data.source, seasonId:data.season?.id, completedGames:data.summary.completedGames, delayed:data.delayed });
      status(data.catchingUp ? 'Catching up' : data.delayed ? 'Saved history' : 'Scheduled simulation', (data.catchingUp ? 'Recording missed rounds in bounded batches. The table will update shortly. ' : data.delayed ? 'Showing the last saved results. ' : '') + data.simulationNote);
      picker.disabled = false;
      const options = data.seasons.filter(item => item.starts_at <= Date.parse(data.observedAt));
      picker.innerHTML = '<option value="">Current season</option>' + options.map(item => `<option value="${esc(item.id)}">Season ${item.number} · ${date(item.starts_at)}</option>`).join('');
      picker.value = selected;
      byId('season-content').hidden = false;
      byId('season-table-caption').textContent = `Season ${data.season?.number || '—'} · ${data.summary.completedGames} completed games`;
      byId('season-standings').innerHTML = data.standings.map(row => `<tr><td>${row.rank}</td><th scope="row"><a href="league.html?${new URLSearchParams({ sport:sportId, team:row.team.publicId })}#club-dossier">${esc(name(row.team))}</a></th><td>${row.played}</td><td>${row.wins}</td><td>${row.draws}</td><td>${row.losses}</td><td>${row.scoreDifference > 0 ? '+' : ''}${row.scoreDifference}</td><td><strong>${row.points}</strong></td></tr>`).join('');
      byId('season-rules').textContent = data.rules;
      byId('season-leaders').innerHTML = data.leaders.length ? data.leaders.map((athlete, i) => `<a class="season-leader" href="player.html?${new URLSearchParams({ sport:sportId, team:athlete.teamId, player:athlete.publicId })}"><span>${i + 1}</span><div><strong>${esc(athlete.displayName)}</strong><small>${esc(athlete.teamCode)} · ${esc(athlete.role)}</small></div><b>${athlete.points}<small>points</small></b></a>`).join('') : '<p class="season-empty">Athlete totals appear after the first completed round.</p>';
      byId('season-updated').textContent = 'Saved ' + date(data.observedAt);
      const fixtures = [...data.fixtures].sort((a,b) => Date.parse(b.startsAt) - Date.parse(a.startsAt) || a.channel - b.channel);
      byId('season-results').innerHTML = fixtures.map(item => `<button type="button" class="season-result" data-fixture="${esc(item.fixtureId)}"><span class="season-result-meta">R${item.roundNumber} · ${item.status === 'live' ? 'In progress' : item.status === 'final' ? 'Final' : 'Scheduled'}<time>${date(item.startsAt)}</time></span><span>${esc(name(item.homeTeam))}<b>${item.status === 'scheduled' ? '—' : item.homeScore}</b></span><span>${esc(name(item.awayTeam))}<b>${item.status === 'scheduled' ? '—' : item.awayScore}</b></span><small>Match report ↗</small></button>`).join('');
    } catch (error) {
      if (version !== generation) return;
      state.source = 'unavailable'; status('Connection lost', error.message);
      // Keep previous saved rows visible, explicitly stale, during network failure.
    }
  }
  picker.addEventListener('change', () => { selected = picker.value; load(); });
  byId('fixture-close').addEventListener('click', () => { detailGeneration++; dialog.close(); });
  dialog.addEventListener('cancel', () => { detailGeneration++; });
  byId('season-results').addEventListener('click', async event => {
    const button = event.target.closest('[data-fixture]'); if (!button) return;
    const version = ++detailGeneration;
    byId('fixture-title').textContent = 'Loading match…'; byId('fixture-note').textContent = ''; byId('fixture-events').innerHTML = ''; dialog.showModal();
    try {
      const response = await fetch('/api/seasons?' + new URLSearchParams({ sport:sportId, season:state.seasonId, fixture:button.dataset.fixture }));
      if (!response.ok) throw new Error('This match report could not load. Close and try again.');
      const data = await response.json(); if (version !== detailGeneration) return;
      const match = data.fixture; if (!match) throw new Error('This saved match is unavailable.');
      byId('fixture-title').textContent = `${name(match.homeTeam)} ${match.status === 'scheduled' ? 'vs' : match.homeScore + '–' + match.awayScore} ${name(match.awayTeam)}`;
      byId('fixture-note').textContent = `Round ${match.roundNumber} · ${match.status} · ${date(match.startsAt)}. Recorded by ${data.engineVersion}.`;
      const athletes = new Map(data.teams.flatMap(team => team.athletes.map(athlete => [athlete.publicId, athlete.displayName])));
      byId('fixture-events').innerHTML = match.events.length ? match.events.map(item => `<li><time>${Math.floor(item.elapsedMs / 60000)}:${String(Math.floor(item.elapsedMs / 1000) % 60).padStart(2, '0')}</time><span>${esc(item.kind.replaceAll('_',' '))}${item.athleteId ? ' · ' + esc(athletes.get(item.athleteId) || 'Athlete') : ''}${item.payload?.points ? ` · +${item.payload.points}` : ''}</span>${item.payload?.scoreAfter ? `<b>${item.payload.scoreAfter.home}–${item.payload.scoreAfter.away}</b>` : ''}</li>`).join('') : '<li>This fixture has not started.</li>';
    } catch (error) { if (version === detailGeneration) byId('fixture-note').textContent = error.message; }
  });
  load();
  const timer = setInterval(() => { if (!document.hidden && !dialog.open) load(); }, 15_000);
  window.addEventListener('pagehide', () => clearInterval(timer), { once:true });
  return { state };
}
