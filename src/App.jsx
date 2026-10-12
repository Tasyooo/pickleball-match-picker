import { useEffect, useMemo, useState } from "react";
import "./App.css";

const INITIAL_PLAYERS = () =>
  Array.from({ length: 12 }, (_, index) => ({
    id: index + 1,
    name: "Player " + (index + 1),
  }));

const INITIAL_SETTINGS = {
  courts: 3,
  hours: 2.5,
};

// The first planning estimate is replaced by the average from timed games.
const DEFAULT_AVERAGE_GAME_MINUTES = 15;

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;
  if (hours > 0) return hours + "h " + minutes + "m " + remainingSeconds + "s";
  return minutes + "m " + String(remainingSeconds).padStart(2, "0") + "s";
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function calculateCapacity(players, settings, averageGameMinutes = DEFAULT_AVERAGE_GAME_MINUTES) {
  // Prevent an accidental short timer from making the capacity estimate unrealistic.
  const slotMinutes = Math.max(5, Number(averageGameMinutes) || DEFAULT_AVERAGE_GAME_MINUTES);
  const roundsAvailable = slotMinutes > 0
    ? Math.floor((Number(settings.hours) * 60) / slotMinutes)
    : 0;
  const gamesPerRound = Math.max(0, Math.min(
    Math.floor(Number(settings.courts)),
    Math.floor(players.length / 4)
  ));
  const maximumMatches = roundsAvailable * gamesPerRound;
  const maxGamesPerPlayer = players.length && roundsAvailable > 0
    ? Math.min(roundsAvailable, Math.floor((maximumMatches * 4) / players.length))
    : 0;

  return { slotMinutes, roundsAvailable, gamesPerRound, maximumMatches, maxGamesPerPlayer };
}

function generateSchedule(players, settings, requestedGamesPerPlayer, averageGameMinutes = DEFAULT_AVERAGE_GAME_MINUTES) {
  if (players.length < 4) return [];

  const capacity = calculateCapacity(players, settings, averageGameMinutes);
  const target = Math.max(0, Math.min(
    Math.floor(Number(requestedGamesPerPlayer) || 0),
    capacity.maxGamesPerPlayer
  ));

  if (!target || !capacity.roundsAvailable || !capacity.gamesPerRound) return [];

  const appearanceCounts = Object.fromEntries(players.map((player) => [player.id, 0]));
  const totalMatches = Math.floor((players.length * target) / 4);
  const games = [];
  let remainingMatches = totalMatches;

  for (let round = 1; round <= capacity.roundsAvailable && remainingMatches > 0; round += 1) {
    const eligible = shuffle(players.map((player) => player.id)
      .filter((id) => appearanceCounts[id] < target))
      .sort((a, b) => appearanceCounts[a] - appearanceCounts[b]);

    const gamesThisRound = Math.min(
      capacity.gamesPerRound,
      Math.floor(eligible.length / 4),
      remainingMatches
    );

    if (gamesThisRound <= 0) break;

    const selected = eligible.slice(0, gamesThisRound * 4);

    for (let courtIndex = 0; courtIndex < gamesThisRound; courtIndex += 1) {
      const group = shuffle(selected.slice(courtIndex * 4, courtIndex * 4 + 4));
      games.push({
        id: games.length + 1,
        round,
        court: courtIndex + 1,
        players: group,
        scoreA: "",
        scoreB: "",
        completed: false,
        startedAt: null,
        endedAt: null,
        durationSeconds: null,
      });
      group.forEach((id) => {
        appearanceCounts[id] += 1;
      });
    }

    remainingMatches -= gamesThisRound;
  }

  return games;
}

function App() {
  const [players, setPlayers] = useState(INITIAL_PLAYERS);
  const [settings, setSettings] = useState(INITIAL_SETTINGS);
  const [gamesPerPlayer, setGamesPerPlayer] = useState(5);
  const [schedule, setSchedule] = useState(() =>
    generateSchedule(INITIAL_PLAYERS(), INITIAL_SETTINGS, 5)
  );
  const [editingGame, setEditingGame] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  const averageGameSeconds = useMemo(() => {
    const durations = schedule
      .map((game) => game.durationSeconds)
      .filter((seconds) => Number.isFinite(seconds) && seconds > 0);
    if (durations.length === 0) return null;
    return durations.reduce((sum, seconds) => sum + seconds, 0) / durations.length;
  }, [schedule]);

  const averageGameMinutes = averageGameSeconds === null
    ? DEFAULT_AVERAGE_GAME_MINUTES
    : Math.max(5, averageGameSeconds / 60);

  const hasRunningGames = schedule.some((game) => game.startedAt && !game.endedAt);
  useEffect(() => {
    if (!hasRunningGames) return undefined;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [hasRunningGames]);

  const capacity = useMemo(
    () => calculateCapacity(players, settings, averageGameMinutes),
    [players, settings, averageGameMinutes]
  );
  const effectiveGamesPerPlayer = Math.min(gamesPerPlayer, capacity.maxGamesPerPlayer);
  const playerName = (id) =>
    players.find((player) => player.id === id)?.name || "Removed player";

  const appearances = useMemo(() => {
    const counts = Object.fromEntries(players.map((player) => [player.id, 0]));
    schedule.forEach((game) => game.players.forEach((id) => {
      if (Object.hasOwn(counts, id)) counts[id] += 1;
    }));
    return counts;
  }, [players, schedule]);

  const rankings = useMemo(() => players.map((player) => {
    let wins = 0;
    let losses = 0;
    let pointsFor = 0;
    let pointsAgainst = 0;

    schedule.forEach((game) => {
      if (!game.completed || !game.players.includes(player.id)) return;
      const isTeamA = game.players.slice(0, 2).includes(player.id);
      const ownScore = Number(isTeamA ? game.scoreA : game.scoreB);
      const opponentScore = Number(isTeamA ? game.scoreB : game.scoreA);

      pointsFor += ownScore;
      pointsAgainst += opponentScore;
      if (ownScore > opponentScore) wins += 1;
      else losses += 1;
    });

    const played = wins + losses;
    return {
      ...player,
      wins,
      losses,
      played,
      winRate: played ? (wins / played) * 100 : 0,
      differential: pointsFor - pointsAgainst,
    };
  }).sort((a, b) =>
    b.wins - a.wins ||
    b.winRate - a.winRate ||
    b.differential - a.differential ||
    a.name.localeCompare(b.name)
  ), [players, schedule]);

  const completedGames = schedule.filter((game) => game.completed).length;
  const lastScheduledRound = Math.max(0, ...schedule.map((game) => game.round));

  function regenerate(nextPlayers = players, nextSettings = settings, desiredGames = gamesPerPlayer) {
    const nextCapacity = calculateCapacity(nextPlayers, nextSettings, averageGameMinutes);
    const target = Math.min(desiredGames, nextCapacity.maxGamesPerPlayer);
    setSchedule(generateSchedule(nextPlayers, nextSettings, target, averageGameMinutes));
    setEditingGame(null);
  }

  function addPlayer() {
    if (players.length >= 32) return;
    const id = Math.max(0, ...players.map((player) => player.id)) + 1;
    const nextPlayers = [...players, { id, name: "Player " + id }];
    setPlayers(nextPlayers);
    regenerate(nextPlayers, settings, gamesPerPlayer);
  }

  function removePlayer(id) {
    if (players.length <= 4) return;
    const nextPlayers = players.filter((player) => player.id !== id);
    setPlayers(nextPlayers);
    regenerate(nextPlayers, settings, gamesPerPlayer);
  }

  function updateMatchup(gameId, slot, selectedId) {
    const playerId = Number(selectedId);
    setSchedule((current) => {
      const next = current.map((game) => ({ ...game, players: [...game.players] }));
      const targetGame = next.find((game) => game.id === gameId);
      if (!targetGame) return current;

      const currentId = targetGame.players[slot];
      if (currentId === playerId) return current;

      targetGame.scoreA = "";
      targetGame.scoreB = "";
      targetGame.completed = false;
      targetGame.startedAt = null;
      targetGame.endedAt = null;
      targetGame.durationSeconds = null;

      const sameGameSlot = targetGame.players.indexOf(playerId);
      if (sameGameSlot !== -1) {
        [targetGame.players[slot], targetGame.players[sameGameSlot]] =
          [targetGame.players[sameGameSlot], targetGame.players[slot]];
        return next;
      }

      // Swap players across courts when needed, so nobody is double-booked.
      const otherGame = next.find((game) =>
        game.id !== gameId &&
        game.round === targetGame.round &&
        game.players.includes(playerId)
      );

      if (otherGame) {
        const otherSlot = otherGame.players.indexOf(playerId);
        otherGame.players[otherSlot] = currentId;
        otherGame.scoreA = "";
        otherGame.scoreB = "";
        otherGame.completed = false;
        otherGame.startedAt = null;
        otherGame.endedAt = null;
        otherGame.durationSeconds = null;
      }

      targetGame.players[slot] = playerId;
      return next;
    });
  }

  function updateScore(gameId, field, value) {
    if (value !== "" && (!/^\d+$/.test(value) || Number(value) > 999)) return;

    setSchedule((current) => current.map((game) => {
      if (game.id !== gameId) return game;
      const updated = { ...game, [field]: value };
      updated.completed =
        updated.scoreA !== "" &&
        updated.scoreB !== "" &&
        Number(updated.scoreA) !== Number(updated.scoreB);
      return updated;
    }));
  }

  function clearScore(gameId) {
    setSchedule((current) => current.map((game) =>
      game.id === gameId
        ? { ...game, scoreA: "", scoreB: "", completed: false }
        : game
    ));
  }

  function startGameTimer(gameId) {
    const startedAt = Date.now();
    setNow(startedAt);
    setSchedule((current) => current.map((game) =>
      game.id === gameId
        ? { ...game, startedAt, endedAt: null, durationSeconds: null }
        : game
    ));
  }

  function finishGameTimer(gameId) {
    const endedAt = Date.now();
    setSchedule((current) => current.map((game) => {
      if (game.id !== gameId || !game.startedAt || game.endedAt) return game;
      return {
        ...game,
        endedAt,
        durationSeconds: Math.max(1, Math.round((endedAt - game.startedAt) / 1000)),
      };
    }));
  }

  function clearGameTimer(gameId) {
    setSchedule((current) => current.map((game) =>
      game.id === gameId
        ? { ...game, startedAt: null, endedAt: null, durationSeconds: null }
        : game
    ));
  }

  function updateGameDetail(gameId, field, value) {
    const numericValue = Number(value);
    setSchedule((current) => {
      const next = current.map((game) => ({ ...game, players: [...game.players] }));
      const targetGame = next.find((game) => game.id === gameId);
      if (!targetGame) return current;

      if (field === "round") {
        const collision = next.some((game) =>
          game.id !== gameId &&
          game.round === numericValue &&
          (game.court === targetGame.court ||
            game.players.some((id) => targetGame.players.includes(id)))
        );
        if (collision) return current;
        targetGame.round = numericValue;
        return next;
      }

      if (field === "court") {
        const otherGame = next.find((game) =>
          game.id !== gameId &&
          game.round === targetGame.round &&
          game.court === numericValue
        );
        if (otherGame) otherGame.court = targetGame.court;
        targetGame.court = numericValue;
      }
      return next;
    });
  }

  function resetResults() {
    setSchedule((current) => current.map((game) => ({
      ...game,
      scoreA: "",
      scoreB: "",
      completed: false,
    })));
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div className="brand-mark" aria-hidden="true">🏓</div>
        <div className="hero-copy">
          <p className="eyebrow">DOUBLES · SESSION PLANNER</p>
          <h1>Pickleball Match Picker</h1>
          <p className="subtitle">Plan courts and session time, edit matchups, and track player rankings.</p>
        </div>
        <button className="button button-primary hero-action" onClick={() => regenerate()}>
          ↻ Generate schedule
        </button>
      </header>

      <section className="stats-grid" aria-label="Schedule summary">
        <div className="stat-card"><span className="stat-label">Players</span><strong>{players.length}</strong><span className="stat-note">Editable roster</span></div>
        <div className="stat-card"><span className="stat-label">Scheduled games</span><strong>{schedule.length}</strong><span className="stat-note">{settings.courts} available courts</span></div>
        <div className="stat-card"><span className="stat-label">Results recorded</span><strong>{completedGames}<small> / {schedule.length}</small></strong><span className="stat-note">Rankings update live</span></div>
      </section>

      <section className="section-card settings-card">
        <div className="section-title-row">
          <div>
            <p className="section-kicker">SESSION SETTINGS</p>
            <h2>Courts and playing time</h2>
            <p className="section-description">The maximum games per player is calculated from session hours, available courts, and the average measured game time.</p>
          </div>
          <span className="pill">{capacity.roundsAvailable} rounds available</span>
        </div>

        <div className="settings-grid">
          <label className="setting-field">
            <span>Available hours</span>
            <input type="number" min="0.25" max="24" step="0.25" value={settings.hours} onChange={(event) => setSettings((current) => ({ ...current, hours: Math.max(0.25, Math.min(24, Number(event.target.value) || 0.25)) }))} />
            <small>Total session duration</small>
          </label>
          <label className="setting-field">
            <span>Number of courts</span>
            <input type="number" min="1" max="12" step="1" value={settings.courts} onChange={(event) => setSettings((current) => ({ ...current, courts: Math.max(1, Math.min(12, Math.floor(Number(event.target.value) || 1))) }))} />
            <small>Courts available at once</small>
          </label>
          <label className="setting-field">
            <span>Games per player</span>
            <input type="number" min="1" max={Math.max(1, capacity.maxGamesPerPlayer)} value={capacity.maxGamesPerPlayer ? effectiveGamesPerPlayer : 0} disabled={capacity.maxGamesPerPlayer === 0} onChange={(event) => setGamesPerPlayer(Math.max(1, Math.min(capacity.maxGamesPerPlayer, Math.floor(Number(event.target.value) || 1))))} />
            <small>Can’t exceed the time-based maximum</small>
          </label>
          <div className="capacity-box">
            <span>MAXIMUM GAMES / PLAYER</span>
            <strong>{capacity.maxGamesPerPlayer}</strong>
            <small>Fair rotation estimate</small>
          </div>
          <div className="average-box">
            <span>AVERAGE GAME TIME</span>
            <strong>{averageGameSeconds === null ? "15 min*" : formatDuration(averageGameSeconds)}</strong>
            <small>{averageGameSeconds === null ? "Initial planning estimate" : "Average of " + schedule.filter((game) => Number.isFinite(game.durationSeconds) && game.durationSeconds > 0).length + " timed game(s)"}</small>
          </div>
        </div>

        <div className="capacity-details">
          <div><span>Average time used for planning</span><strong>{capacity.slotMinutes.toFixed(1)} min</strong></div>
          <div><span>Rounds in session</span><strong>{capacity.roundsAvailable}</strong></div>
          <div><span>Games per round</span><strong>{capacity.gamesPerRound}</strong></div>
          <div><span>Session game capacity</span><strong>{capacity.maximumMatches}</strong></div>
        </div>

        <div className="settings-actions">
          <p>Use each game’s timer to calculate an average automatically. Until games are timed, the scheduler uses a 15-minute estimate and a 5-minute minimum for capacity planning. Generating a new schedule clears scores and timers.</p>
          <button className="button button-primary" disabled={capacity.maxGamesPerPlayer === 0} onClick={() => regenerate()}>
            Apply settings & generate
          </button>
        </div>
        {capacity.maxGamesPerPlayer === 0 && <p className="warning-text">There isn’t enough time for a game based on the measured average. Increase the session hours or time another game to update the estimate.</p>}
      </section>

      <section className="section-card roster-card">
        <div className="section-title-row">
          <div>
            <p className="section-kicker">PLAYER SETUP</p>
            <h2>Player roster</h2>
            <p className="section-description">Edit names or add and remove players. Roster changes regenerate the schedule and clear scores.</p>
          </div>
          <button className="button button-quiet" disabled={players.length >= 32} onClick={addPlayer}>＋ Add player</button>
        </div>
        <div className="player-grid">
          {players.map((player) => (
            <div className="player-field" key={player.id}>
              <span className="player-index">{String(player.id).padStart(2, "0")}</span>
              <input
                value={player.name}
                maxLength={32}
                onChange={(event) => setPlayers((current) => current.map((item) =>
                  item.id === player.id ? { ...item, name: event.target.value } : item
                ))}
                aria-label={"Name for player " + player.id}
              />
              <span className="appearance-count">{appearances[player.id] || 0}×</span>
              <button className="remove-player" aria-label={"Remove " + player.name} disabled={players.length <= 4} onClick={() => removePlayer(player.id)}>×</button>
            </div>
          ))}
        </div>
        <p className="roster-footnote">At least 4 players are needed for doubles. The scheduler rotates players fairly and never schedules a player on two courts in the same round.</p>
      </section>

      <section className="schedule-section">
        <div className="section-title-row schedule-title">
          <div>
            <p className="section-kicker">ON THE COURT</p>
            <h2>Match schedule</h2>
            <p className="section-description">Edit each game’s round, court, teams, and score.</p>
          </div>
          <div className="schedule-buttons">
            <button className="button button-quiet" onClick={resetResults} disabled={completedGames === 0}>Clear all scores</button>
            <button className="button button-primary" onClick={() => regenerate()}>↻ Regenerate</button>
          </div>
        </div>

        {schedule.length === 0 && (
          <div className="empty-state">
            <h3>No games scheduled</h3>
            <p>Adjust the session hours, game length, or number of courts, then generate a schedule.</p>
          </div>
        )}

        {Array.from(new Set(schedule.map((game) => game.round))).sort((a, b) => a - b).map((round) => (
          <section className="round-section" key={round}>
            <div className="round-heading"><span className="round-number">{String(round).padStart(2, "0")}</span><h3>Round {round}</h3><span className="round-line" /></div>
            <div className="games-grid">
              {schedule.filter((game) => game.round === round).map((game) => (
                <article className="game-card" key={game.id}>
                  <div className="game-card-header">
                    <div><span className="game-label">GAME {String(game.id).padStart(2, "0")}</span><h4>Court {game.court}</h4></div>
                    <button className="button button-quiet" onClick={() => setEditingGame(editingGame === game.id ? null : game.id)}>
                      {editingGame === game.id ? "Done editing" : "✎ Edit game"}
                    </button>
                  </div>

                  {editingGame === game.id && (
                    <div className="match-editor">
                      <p className="editor-title">Game details and players</p>
                      <div className="game-detail-grid">
                        <label className="edit-field">
                          <span>Round</span>
                          <select value={game.round} onChange={(event) => updateGameDetail(game.id, "round", event.target.value)}>
                            {Array.from({ length: Math.max(capacity.roundsAvailable, lastScheduledRound, game.round, 1) }, (_, i) => i + 1).map((value) => <option value={value} key={value}>Round {value}</option>)}
                          </select>
                        </label>
                        <label className="edit-field">
                          <span>Court</span>
                          <select value={game.court} onChange={(event) => updateGameDetail(game.id, "court", event.target.value)}>
                            {Array.from({ length: Math.max(settings.courts, game.court, 1) }, (_, i) => i + 1).map((value) => <option value={value} key={value}>Court {value}</option>)}
                          </select>
                        </label>
                      </div>
                      {game.players.map((playerId, slot) => (
                        <label className="edit-field" key={slot}>
                          <span>{slot < 2 ? "Team A" : "Team B"} · Player {(slot % 2) + 1}</span>
                          <select value={playerId} onChange={(event) => updateMatchup(game.id, slot, event.target.value)}>
                            {players.map((player) => <option value={player.id} key={player.id}>{player.name || "Player " + player.id}</option>)}
                          </select>
                        </label>
                      ))}
                      <p className="editor-hint">Players selected from another game in this round swap games. Round changes are rejected if they would double-book a player or court.</p>
                    </div>
                  )}

                  <div className="teams-row">
                    <div className="team team-a"><span className="team-label">TEAM A</span><strong>{playerName(game.players[0])}</strong><strong>{playerName(game.players[1])}</strong></div>
                    <span className="versus">VS</span>
                    <div className="team team-b"><span className="team-label">TEAM B</span><strong>{playerName(game.players[2])}</strong><strong>{playerName(game.players[3])}</strong></div>
                  </div>

                  <div className="game-timer">
                    <div className="timer-heading">
                      <span className="score-label">GAME TIMER</span>
                      <strong>
                        {game.durationSeconds !== null && game.durationSeconds !== undefined
                          ? "Recorded: " + formatDuration(game.durationSeconds)
                          : game.startedAt
                            ? "In progress: " + formatDuration((now - game.startedAt) / 1000)
                            : "Not timed yet"}
                      </strong>
                    </div>
                    <div className="timer-actions">
                      {game.startedAt && !game.endedAt
                        ? <button className="button button-quiet" onClick={() => finishGameTimer(game.id)}>Finish & record time</button>
                        : <button className="button button-quiet" onClick={() => startGameTimer(game.id)}>{game.endedAt ? "Retake time" : "Start game timer"}</button>}
                      {(game.startedAt || game.endedAt) && <button className="clear-score" onClick={() => clearGameTimer(game.id)}>Reset timer</button>}
                    </div>
                  </div>

                  <div className="score-area">
                    <span className="score-label">FINAL SCORE</span>
                    <div className="score-inputs">
                      <label><span className="sr-only">Team A score</span><input type="number" min="0" max="999" value={game.scoreA} placeholder="0" onChange={(event) => updateScore(game.id, "scoreA", event.target.value)} aria-label={"Game " + game.id + " Team A score"} /></label>
                      <span className="score-dash">:</span>
                      <label><span className="sr-only">Team B score</span><input type="number" min="0" max="999" value={game.scoreB} placeholder="0" onChange={(event) => updateScore(game.id, "scoreB", event.target.value)} aria-label={"Game " + game.id + " Team B score"} /></label>
                      {game.completed && <span className="result-check" title="Result recorded">✓</span>}
                    </div>
                    {game.scoreA !== "" && game.scoreB !== "" && Number(game.scoreA) === Number(game.scoreB)
                      ? <p className="score-hint warning">Scores are tied. Enter a winner to count the game.</p>
                      : <p className="score-hint">{game.completed ? "Result recorded in rankings" : "Enter both scores to record result"}</p>}
                    {(game.scoreA !== "" || game.scoreB !== "") && <button className="clear-score" onClick={() => clearScore(game.id)}>Clear score</button>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </section>

      <section className="section-card rankings-card">
        <div className="section-title-row">
          <div>
            <p className="section-kicker">LEADERBOARD</p>
            <h2>Player rankings</h2>
            <p className="section-description">Wins first, then win percentage, followed by point differential.</p>
          </div>
          <span className="trophy-mark" aria-hidden="true">🏆</span>
        </div>
        <div className="table-wrap">
          <table className="ranking-table">
            <thead><tr><th>Rank</th><th>Player</th><th>Played</th><th>Wins</th><th>Losses</th><th>Win %</th><th>Point diff.</th></tr></thead>
            <tbody>{rankings.map((player, index) => (
              <tr key={player.id}>
                <td><span className={"rank-badge " + (index < 3 ? "rank-" + (index + 1) : "")}>{index + 1}</span></td>
                <td className="ranking-player">{player.name || "Player " + player.id}</td>
                <td>{player.played}</td><td className="wins-cell">{player.wins}</td><td>{player.losses}</td>
                <td>{player.winRate.toFixed(0)}%</td>
                <td className={player.differential > 0 ? "positive-diff" : player.differential < 0 ? "negative-diff" : ""}>{player.differential > 0 ? "+" : ""}{player.differential}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <p className="ranking-note">Unplayed games do not affect rankings. Tied scores aren’t counted as completed results.</p>
      </section>

      <footer className="app-footer"><span>Pickleball Match Picker</span><span>{players.length} players · {schedule.length} games · {settings.hours} hours available</span><span>*15-minute estimate until game timers are recorded.</span></footer>
    </main>
  );
}

export default App;
