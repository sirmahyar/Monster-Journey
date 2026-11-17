# Cluck Raid

Cluck Raid is a single-player space shooter. A ship on the left fights chickens that enter from the right. The browser runs the whole battle: movement, shots, eggs, gifts, chapters, and bosses.

Scores are the only thing stored on a server. A small Node API writes them to MySQL. The browser never opens the database itself.

This is an original game in the horizontal chicken-shooter style. It does not use the name, art, or text of any commercial game.

## Play

Requires Node.js 20 or newer.

```bash
npm install
```

Copy `.env.example` to `.env` and fill the MySQL settings. Do not commit `.env`. `MYSQL_DATABASE` can stay empty when the database user can see one application database; the server uses that database and creates the `scores` table.

```bash
npm run dev
```

Open `http://127.0.0.1:5173`. The score API listens on `http://127.0.0.1:8787`, and Vite proxies `/api` to it.

```bash
npm test
npm run build
```

`npm run build` writes the static client to `dist/client`. Gameplay does not need the old edge bundle.

## Controls

Arrows or WASD move. Hold the mouse or a finger on the lane to steer and fire. Space also fires. B or Shift uses a bomb. Esc pauses.

Four chapters each have four waves and a boss. Gifts raise the weapon, add a shield, a bomb, a life, or bonus points. A combo multiplies the points from the next kill. Clearing a wave without being hit adds a bonus.

## Scoreboard

`GET /api/scores` returns the top 50 scores.

`POST /api/scores` accepts `{ "name", "score", "chapter", "wave" }`. The name is 1 to 16 letters, numbers, or spaces. The score is an integer from 0 to 9999999. Chapter is 1 to 4. Wave is 1 to 5.

The board does not prove a score was earned in the game. The battle is resolved in the browser, so a client can submit a number directly. The API only rejects malformed names and values outside those ranges. Do not treat the board as a prize ranking.

Queries use parameters. The password stays in the environment, not in the client bundle.

## Database

The API reads:

- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE`

Because the password was pasted into a chat while setting this up, rotate it in the database panel when you can.
