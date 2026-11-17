# یورش مرغی (Cluck Raid)

Cluck Raid is a single-player vertical space shooter. Flocks of chickens hold the top of the screen and drop eggs, and your ship at the bottom fires upward. The browser runs the whole battle: movement, shots, eggs, gifts, chapters, and bosses.

Every text in the game is Persian. The UI is right-to-left, numbers use Persian digits, and the [Vazirmatn](https://github.com/rastikerdar/vazirmatn) font (SIL Open Font License 1.1) is bundled from the `vazirmatn` npm package, so it works offline.

Scores are the only thing stored on a server. A small Node API writes them to MySQL. The browser never opens the database itself.

The ship, chickens, and effects are original art. Background music is the soundtrack included with the game.

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

`npm run build` writes the static client to `dist/client`. `npm run build:edge` also writes `dist/edge/game-api.js`, one file that serves that client on ArvanCloud Edge Computing.

```bash
arvan ec deploy -f dist/edge/game-api.js monster
```

The existing application is `https://monster.mahyarrrba3r.arvanedge.ir/`. The edge runtime can serve the page. It cannot open the MySQL connection, so the scoreboard on that URL stays disconnected until the API runs somewhere that can reach the database.

## Sound

Background music plays from `src/client/audio/tracks`. Chicken voices are real recordings cut into `src/client/audio/chickens.mp3`. Shots, explosions, eggshell cracks, and chimes are synthesized with Web Audio.

| Recording | Author | License |
| --- | --- | --- |
| [Hen announcing she's lain an egg](https://commons.wikimedia.org/wiki/File:Hen_announcing_shes_lain_an_egg.ogg) | alys (pdsounds.org) | Public domain |
| [Hens leaving coop](https://commons.wikimedia.org/wiki/File:Hens_leaving_coop.ogg) | alys (pdsounds.org) | Public domain |
| [Small rooster crowing](https://commons.wikimedia.org/wiki/File:Small_rooster_crowing.ogg) | alys (pdsounds.org) | Public domain |
| [Medium rooster crowing](https://commons.wikimedia.org/wiki/File:Medium_rooster_crowing.ogg) | alys (pdsounds.org) | Public domain |
| [Chicks calling (মুরগির বাচ্চার ডাক)](https://commons.wikimedia.org/wiki/File:%E0%A6%AE%E0%A7%81%E0%A6%B0%E0%A6%97%E0%A6%BF%E0%A6%B0_%E0%A6%AC%E0%A6%BE%E0%A6%9A%E0%A7%8D%E0%A6%9A%E0%A6%BE%E0%A6%B0_%E0%A6%A1%E0%A6%BE%E0%A6%95.oga) | Md. Tahmid Hossain | CC0 |

## Controls

Arrows or WASD move. Hold the mouse or a finger on the playfield to steer and fire. Space, J, or Z also fires. B, K, X, or Shift uses a bomb; on touch screens there is a bomb button. P or Esc pauses.

Four chapters each have eight waves, and the last wave of each chapter is a boss. Finishing a chapter unlocks the next weapon: the photon lance, then the ion seeker, then wing missiles that home while you fire. Weapon levels come only from rare power cores, and a destroyed ship drops one level. Other gifts add a shield, a bomb, coolant, or a life. Chained kills raise a score multiplier. Clearing a wave without being hit doubles its bonus.

## Scoreboard

`GET /api/scores` returns the top 50 scores.

The game asks for a pilot name before the first wave and posts the current score at the end of every wave, and again when the run ends. `POST /api/scores` accepts `{ "name", "score", "chapter", "wave" }`. The name is 1 to 16 Persian or English letters, digits, spaces, or zero-width non-joiners. The score is an integer from 0 to 9999999. Chapter is 1 to 4. Wave is 1 to 8.

The `scores` table uses `utf8mb4`. A table created by an older version is converted on startup so Persian names can be stored.

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
