# Pickleball Match Picker

A React + Vite app for organizing 12 pickleball players into doubles games, editing matchups, recording scores, and tracking rankings.

## Features

- 12 editable player names
- 5 rounds and 3 courts per round (15 games total)
- Every player is scheduled for exactly 5 games initially
- Randomize the schedule
- Edit the four players in any matchup
- Record game scores and rank players live
- Enter actual game durations manually; the app calculates their average without a running timer
- Estimate maximum games per player from available session hours, court count, and observed average game duration (uses a 15-minute estimate until actual durations are entered)
- Live ranking table with wins, losses, win percentage, and point differential
- Responsive layout for desktop and mobile

## Run locally

Requires Node.js 18 or newer.

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Notes

This version keeps the session in React state. Refreshing the page resets names, schedules, scores, and game duration entries. Manual matchup edits can change the number of games played by each player; the player list shows current appearances.
