import { useMemo, useState } from "react";
import "./App.css";

const makePlayers = () => Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: `Player ${i + 1}` }));
const shuffle = (items) => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
const generateSchedule = (players) => {
  const games = [];
  for (let round = 1; round <= 5; round++) {
    const ids = shuffle(players.map((p) => p.id));
    for (let court = 0; court < 3; court++) games.push({
      id: games.length + 1, round, court: court + 1,
      players: ids.slice(court * 4, court * 4 + 4), scoreA: "", scoreB: "", completed: false
    });
  }
  return games;
};

export default function App() {
  const [players, setPlayers] = useState(makePlayers);
  const [schedule, setSchedule] = useState(() => generateSchedule(makePlayers()));
  const [editingGame, setEditingGame] = useState(null);
  const nameOf = (id) => players.find((p) => p.id === id)?.name || "Unknown";
  const appearances = useMemo(() => {
    const counts = Object.fromEntries(players.map((p) => [p.id, 0]));
    schedule.forEach((g) => g.players.forEach((id) => counts[id]++));
    return counts;
  }, [players, schedule]);
  const rankings = useMemo(() => players.map((player) => {
    let wins = 0, losses = 0, pointsFor = 0, pointsAgainst = 0;
    schedule.forEach((game) => {
      if (!game.completed || !game.players.includes(player.id)) return;
      const teamA = game.players.slice(0, 2).includes(player.id);
      const own = Number(teamA ? game.scoreA : game.scoreB);
      const against = Number(teamA ? game.scoreB : game.scoreA);
      pointsFor += own; pointsAgainst += against;
      if (own > against) wins++; else losses++;
    });
    const played = wins + losses;
    return { ...player, wins, losses, played, winRate: played ? wins / played * 100 : 0, differential: pointsFor - pointsAgainst };
  }).sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || b.differential - a.differential || a.name.localeCompare(b.name)), [players, schedule]);
  const completed = schedule.filter((g) => g.completed).length;

  function updateScore(gameId, field, value) {
    if (value !== "" && !/^\d+$/.test(value)) return;
    setSchedule((old) => old.map((g) => {
      if (g.id !== gameId) return g;
      const next = { ...g, [field]: value };
      next.completed = next.scoreA !== "" && next.scoreB !== "" && Number(next.scoreA) !== Number(next.scoreB);
      return next;
    }));
  }
  function updateMatchup(gameId, slot, value) {
    const id = Number(value);
    setSchedule((old) => old.map((g) => {
      if (g.id !== gameId) return g;
      const next = [...g.players], other = next.indexOf(id);
      if (other !== -1 && other !== slot) [next[slot], next[other]] = [next[other], next[slot]];
      else next[slot] = id;
      return { ...g, players: next };
    }));
  }

  return <main className="app-shell">
    <header className="hero">
      <div className="brand-mark">🏓</div>
      <div className="hero-copy"><p className="eyebrow">DOUBLES · ROUND SCHEDULER</p><h1>Pickleball Match Picker</h1><p className="subtitle">Random teams, editable matchups, and live player rankings.</p></div>
      <button className="button primary" onClick={() => { setSchedule(generateSchedule(players)); setEditingGame(null); }}>↻ Randomize schedule</button>
    </header>
    <section className="stats-grid">
      <div className="stat-card"><span>Players</span><strong>12</strong><small>Active roster</small></div>
      <div className="stat-card"><span>Total games</span><strong>15</strong><small>3 courts × 5 rounds</small></div>
      <div className="stat-card"><span>Games recorded</span><strong>{completed}<small> / 15</small></strong><small>Results entered</small></div>
    </section>
    <section className="section-card">
      <div className="section-title"><div><p className="section-kicker">SETUP</p><h2>Player roster</h2><p>Edit names here. Match cards and rankings update automatically.</p></div><span className="pill">12 players</span></div>
      <div className="player-grid">{players.map((p) => <label className="player-field" key={p.id}><span className="player-index">{String(p.id).padStart(2, "0")}</span><input value={p.name} maxLength={32} onChange={(e) => setPlayers((old) => old.map((x) => x.id === p.id ? { ...x, name: e.target.value } : x))} aria-label={`Name for player ${p.id}`}/><span className="appearances">{appearances[p.id]}×</span></label>)}</div>
      <p className="note">Each player starts with 5 scheduled appearances. Manual edits may change this count.</p>
    </section>
    <section className="schedule-section">
      <div className="section-title"><div><p className="section-kicker">ON THE COURT</p><h2>Match schedule</h2><p>Enter final scores to update the rankings.</p></div><span className="pill">5 rounds · 3 courts</span></div>
      {[1,2,3,4,5].map((round) => <section className="round-section" key={round}>
        <div className="round-heading"><span>{String(round).padStart(2,"0")}</span><h3>Round {round}</h3><i/></div>
        <div className="games-grid">{schedule.filter((g) => g.round === round).map((game) => <article className="game-card" key={game.id}>
          <div className="game-head"><div><small>GAME {String(game.id).padStart(2,"0")}</small><h4>Court {game.court}</h4></div><button className="button quiet" onClick={() => setEditingGame(editingGame === game.id ? null : game.id)}>{editingGame === game.id ? "Done editing" : "✎ Edit teams"}</button></div>
          <div className="teams"><div className="team team-a"><small>TEAM A</small><strong>{nameOf(game.players[0])}</strong><strong>{nameOf(game.players[1])}</strong></div><span className="versus">VS</span><div className="team team-b"><small>TEAM B</small><strong>{nameOf(game.players[2])}</strong><strong>{nameOf(game.players[3])}</strong></div></div>
          {editingGame === game.id && <div className="editor"><b>Edit the four player slots</b>{game.players.map((id, slot) => <label key={slot}>{slot < 2 ? "Team A" : "Team B"} · Player {(slot % 2)+1}<select value={id} onChange={(e) => updateMatchup(game.id, slot, e.target.value)}>{players.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label>)}<p>Choosing a player already in this game swaps positions. Otherwise, it replaces the selected slot.</p></div>}
          <div className="score-area"><small>FINAL SCORE</small><div className="score-inputs"><input type="number" min="0" value={game.scoreA} placeholder="0" onChange={(e) => updateScore(game.id,"scoreA",e.target.value)} aria-label={`Game ${game.id} Team A score`}/><span>:</span><input type="number" min="0" value={game.scoreB} placeholder="0" onChange={(e) => updateScore(game.id,"scoreB",e.target.value)} aria-label={`Game ${game.id} Team B score`}/></div><p className={game.scoreA !== "" && game.scoreB !== "" && Number(game.scoreA) === Number(game.scoreB) ? "warning" : ""}>{game.completed ? "✓ Result recorded in rankings" : game.scoreA !== "" && game.scoreB !== "" ? "Scores are tied. Enter a winner." : "Enter both scores to record result"}</p>{(game.scoreA !== "" || game.scoreB !== "") && <button className="clear" onClick={() => setSchedule((old) => old.map((g) => g.id === game.id ? {...g, scoreA:"", scoreB:"", completed:false} : g))}>Clear score</button>}</div>
        </article>)}</div>
      </section>)}
    </section>
    <section className="section-card rankings">
      <div className="section-title"><div><p className="section-kicker">LEADERBOARD</p><h2>Player rankings</h2><p>Standings update automatically as valid scores are entered.</p></div><span className="trophy">🏆</span></div>
      <div className="table-wrap"><table><thead><tr><th>Rank</th><th>Player</th><th>Played</th><th>Wins</th><th>Losses</th><th>Win %</th><th>Point diff.</th></tr></thead><tbody>{rankings.map((p, i) => <tr key={p.id}><td><span className={`rank rank-${i+1}`}>{i+1}</span></td><td className="rank-name">{p.name || `Player ${p.id}`}</td><td>{p.played}</td><td className="wins">{p.wins}</td><td>{p.losses}</td><td>{p.winRate.toFixed(0)}%</td><td className={p.differential > 0 ? "positive" : p.differential < 0 ? "negative" : ""}>{p.differential > 0 ? "+" : ""}{p.differential}</td></tr>)}</tbody></table></div>
      <p className="note">Tie-break order: wins, win percentage, then point differential. Unplayed games do not affect rankings.</p>
    </section>
    <footer className="footer"><span>Pickleball Match Picker</span><span>12 players · 5 rounds · 15 games</span></footer>
  </main>;
}
