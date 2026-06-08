# Tasks — Auto Gift-Code Redemption

> Contract: ONE data-driven `@official` module `api/plugins/redeem.js` exporting
> `export const checkin = async (config) => results`, registered per game in `config.ts`
> via `options.game`. Pure helpers unit-tested in `api/redeem.test.mjs`. (D1)

## 1. `api/plugins/redeem.js` (new) — R1,R2,R3,R5,R6,R7,R8,R9,R10
- [x] 1.1 Data tables: `GAMES{}` (genshin: GET `webExchangeCdkey`, `hk4e_global`, arGate 10,
      `extra:sLangKey=en-us`; starrail: POST `webExchangeCdkeyRisk`, `hkrpg_global`, arGate 0,
      `extra:t=Date.now()`; src keys ennead/hashblen(`genshin`/`hsr`)/seriaati(`genshin`/`hkrpg`));
      `SOURCES[]` (ennead, hashblen, seriaati-fallback); `RETCODE{}`.
- [x] 1.2 `normCode`/`isValidCode` (R7) + inline test: rejects `{{ZH`, `A / B`, ``; keeps `GENSHINGIFT`.
- [x] 1.3 `classify(retcode)` (R6) + inline test: 0→done, -2017→already, -2001/-2003→permanent,
      -2016/-1004→cooldown, -1071/-100→cookieDead, else→unknown.
- [x] 1.4 `pickCookie(raw)` (5 redeem token keys) + inline test.
- [x] 1.5 `getRole(game,cookie)` (R2): roles endpoint; `{uid,region,level}`; tag `cookieDead` on retcode≠0.
- [x] 1.6 `fetchCodes(game)` (R8): `SOURCES` loop via `allSettled` + fallback row → `mergeCodes`
      (union/dedupe/sanitize/newest-first; undated kept) + inline test.
- [x] 1.7 `makeStore(kv)` (R4) — OPTIONAL default-off: falsy creds → no-op stub (stateless `-2017`);
      else Upstash REST `{has,add}`. No 24h window required (hashblen `added_at` is an *optional* knob).
- [x] 1.8 `redeemCode(game,role,cookie,code,lang)`: per-game request from `GAMES` (`extra()`); network→`{retcode:null}`.
- [x] 1.9 `redeemForUser` + `checkin(config)`: roles → AR gate → window(opt) → KV delta → cap →
      sequential redeem (5.5s + cooldown-retry); `config.dryRun` → plan only; **never throws** (R10).
- [x] **Checkpoint 1**: `node api/redeem.test.mjs` → 5/5 unit asserts green; no cookie/token logging.

## 2. Per-game registration (replaces the old "second plugin file")
- [x] 2.1 `api/config.ts`: register `genshin-redeem` + `starrail-redeem`, both
      `modulePath:'@official/redeem.js'`, differing only by `options.game`; reuse
      `GENSHIN_COOKIES`/`STARRAIL_COOKIES`; `lang`, `maxPerRun:8`, `kv:{url,token}` from
      `process.env.KV_REST_*` (non-throwing → default stateless). (D1, D4, R4)

## 3. Pipeline resilience (enables safe pre-push deploy)
- [x] 3.1 `api/core/pipeline.ts`: wrap per-entry `loadPlugins`/`loadMiddlewares` in try/catch so a
      missing/404 remote module (e.g. `redeem.js` before push) is logged + skipped, not fatal.
- [x] 3.2 Verified: `npm test` real check-in succeeds while both redeem plugins 404-skip.

## 4. Inline tests + DRY RUN — design §Testing
- [x] 4.1 `api/redeem.test.mjs`: unit asserts (normCode/isValidCode/mergeCodes/classify/pickCookie) +
      DRY RUN (real roles+codes, **no redeem call**) gated on `*_COOKIES` env.
- [x] 4.2 `package.json` `"test:redeem": "node api/redeem.test.mjs"`; DRY RUN via
      `node --env-file=.env.local api/redeem.test.mjs`.
- [x] 4.3 DRY RUN run: 5/5 asserts; chain reached roles lookup → surfaced cookie finding (see §8).

## 5. `discord-notify` compatibility — R9  (PENDING)
- [ ] 5.1 Confirm redeem result shape `{code,reward,retcode,status,message}` renders in the embed;
      if not, add a minimal code/reward line. Consider adding `-2017` to `tag_filter`.

## 6. `vercel.json` — Vercel limits/region  (PENDING)
- [ ] 6.1 `functions["api/index.ts"].maxDuration` ≥ 60, `regions:["sin1"]`; keep the daily `crons`.

## 7. Docs — R-non-functional  (PENDING)
- [ ] 7.1 `readme.md` + `doc/plugin_list.*`: the single `redeem.js` registered per game, the
      required cookie keys (`cookie_token_v2`/`account_mid_v2`/`account_id_v2`), optional
      `KV_REST_*`, the Genshin AR≥10 gate, and the 5.5s throttle.

## 8. Final / ship-blockers  (PENDING)
- [ ] 8.1 **Cookie**: DRY RUN returned roles `-100 Login expired` — the current `*_COOKIES` lack a
      valid `cookie_token_v2`. Redeem needs fresh `cookie_token_v2`+`account_mid_v2`+`account_id_v2`
      (shorter-lived than the check-in `ltoken`). Resolve before live redeem.
- [ ] 8.2 **Push**: runtime fetches `@official/redeem.js` from pushed `main` (currently 404). Push
      to activate; then re-run DRY RUN against the remote.
- [ ] 8.3 **Star Rail host**: verify `sg-hkrpg-api...CdkeyRisk` with one live `REDEEM_LIVE` code once
      cookies are valid.

## Status
T1–T4 **done & validated** (5/5 unit asserts; DRY RUN exercised the full chain; check-in unaffected
by the 404 redeem plugins). T5–T7 pending (non-blocking polish). T8 = ship-blockers needing a valid
`cookie_token_v2` + a push.
