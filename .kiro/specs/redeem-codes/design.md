# Design — Auto Gift-Code Redemption

## Decision records

- **D1 — One data-driven redeem module, registered per game.** A single self-contained `@official`
  module `api/plugins/redeem.js` holds the logic once; per-game differences live in a `GAMES` data
  table (biz / arGate / redeem host·path·method·extra-params / source-keys), code sources in a
  `SOURCES` table, retcodes in a `RETCODE` table. `config.ts` registers it **twice**
  (`genshin-redeem`, `starrail-redeem`) differing only by `options.game`. Keeps per-game plugin
  *entries* (names, cookies, independent runs) with **zero code duplication** — add a game = one
  `GAMES` row + one config entry; add a code source = one `SOURCES` row. _Revised from two
  near-identical files for reuse/readability (user request)._
- **D2 — Dedup: stateless `-2017` backstop by default; `added_at` window + KV optional.**
  ennead/seriaati have no per-code date, but **hashblen exposes `added_at`** (Unix ts) — though
  with no active/expired flag (full history). Since the *active* list is tiny (~8 Genshin / ~5 SR),
  the **default is stateless "all sign"**: attempt every sanitized active-union code each run and
  let HoYoLAB `-2017`/`-2018` skip already-redeemed (never a double grant). Optional dedup knobs
  (off by default): (a) `added_at` freshness window via hashblen — skip codes older than WINDOW
  (caveat: misses long-standing/permanent codes + skipped-run gaps; WINDOW must be ≥ 2× cron
  interval); (b) KV processed-set. _Revised after live API investigation._
- **D3 — Code source: UNION of ennead (validity) + hashblen (recency/`added_at`) + seriaati
  (fallback), deduped + sanitized** (R7/R8). Default redeem = attempt the active union with
  `-2017` backstop ("all sign"); `added_at` drives newest-first ordering + an optional window.
- **D4 — Reuse `GENSHIN_COOKIES` / `STARRAIL_COOKIES`.** Same cookie string; must contain
  `cookie_token_v2`+`account_mid_v2`+`account_id_v2`. No new cookie env vars.
- **D5 — Throttle 5.5 s, sequential, per-run cap (default 8)** (R5).

## Code-source & freshness investigation (why no release-date filter)

Live findings (2026-06):

| Source | Shape | Per-code date? | Notes |
|---|---|---|---|
| ennead `/mihoyo/<game>/codes` | `{active:[{code,rewards}], inactive:[…]}` | **No** | ~8 active (Genshin) / ~5 (SR); `inactive` historically dirty (`{{ZH`, trailing space, `A / B`) |
| seriaati `/codes?game=<slug>` | `{codes:[{id,code,status,game,rewards}], game}` | **No** | `status` OK/NOT_OK (validated active-only); `id` = auto-increment ≈ discovery order |
| hashblen `db.hashblen.com/codes` | `{genshin:[…], hsr:[…], zzz:[…]}` each `{code,description,added_at}` | **Yes — `added_at` (Unix)** | **No** active/expired flag; full history; SR key = `hsr` |

**Conclusion (revised):** ennead/seriaati give **validity** (active flag) but no date; **hashblen
gives `added_at`** (a real timestamp) but no validity flag and the full history. A *pure*
time-window therefore can't stand alone — it would (a) miss long-standing/permanent codes
(`GENSHINGIFT`/`STARRAILGIFT` have `added_at` months old), (b) miss anything if a daily run is
skipped, (c) attempt expired codes. So:
- **Code list = UNION of sources** (R8): ennead `active` (validity) ∪ hashblen recent ∪ seriaati
  (fallback), deduped + sanitized — for max coverage. Codes carry `added_at` where hashblen has it.
- **Default redeem = "all sign" the active union** with `-2017` backstop (stateless, never
  double-grants; the ~8-code list keeps it cheap). _"if no time → all sign."_
- **`added_at` powers newest-first ordering** (so the per-run cap keeps the freshest) and an
  **optional** freshness-window dedup (`REDEEM_WINDOW_H`, default off; codes with no `added_at`
  are always attempted = "if no time then all sign").

## Endpoints

| Purpose | Method | URL | Key params |
|---|---|---|---|
| Genshin redeem | GET | `https://sg-hk4e-api.hoyoverse.com/common/apicdkey/api/webExchangeCdkey` | `uid, region, lang=en, cdkey, game_biz=hk4e_global, sLangKey=en-us` |
| Star Rail redeem | POST | `https://sg-hkrpg-api.hoyoverse.com/common/apicdkey/api/webExchangeCdkeyRisk` | `uid, region, lang=en, cdkey, game_biz=hkrpg_global, t=<ms>` |
| Game roles (uid/region/level) | GET | `https://api-account-os.hoyolab.com/account/binding/api/getUserGameRolesByCookie?game_biz=<biz>` | cookie auth → `data.list[].{game_uid,region,level,nickname}` |
| Codes — validity | GET | `https://api.ennead.cc/mihoyo/{genshin\|starrail}/codes` | `{active:[{code,rewards}], inactive}` — read `active` (currently-valid set) |
| Codes — recency | GET | `https://db.hashblen.com/codes` | `{genshin:[…], hsr:[…], zzz:[…]}` each `{code,description,added_at}` — Unix `added_at`, NO active flag (SR key = `hsr`) |
| Codes — fallback | GET | `https://hoyo-codes.seria.moe/codes?game={genshin\|hkrpg}` | `{codes:[{id,code,status,game,rewards}]}` validated active-only |

All requests send `Cookie` (trimmed to the 5 redeem tokens) + a browser `User-Agent` +
`Referer: https://act.hoyolab.com`. Params go in the **query string** for every call (Star Rail
is POST-with-query-params, no body).

## Retcode → action

| retcode | meaning | action |
|---|---|---|
| `0` | success | record processed; result `redeemed` |
| `-2017` / `-2018` | already redeemed | record processed; result `already` (NOT a failure) |
| `-2001` | code expired | record processed (permanent); result `expired` |
| `-2003` | code invalid | record processed (permanent); result `invalid` |
| `-2016` / `-1004` | cooldown / too frequent | backoff 6 s, retry once; else leave for next run |
| `-1071` / `-100` / `-10001` | cookie/login invalid | abort account; result `cookie_expired` |
| other | unknown | result `failed` w/ message; do NOT record (retry next run) |

## Components — `api/plugins/redeem.js` (data tables + thin layers)

**Data tables** (where per-game / per-source variance lives):
- `GAMES{}` — `biz`, `arGate`, `redeem.{host,path,method,extra()}`, `src.{ennead,hashblen,seriaati}`.
- `SOURCES[]` — each `{name, url(game), pick(json,game), fallback?}`. Add a source = one row.
- `RETCODE{}` — retcode → `{ok,done,already,permanent,cooldown,cookieDead,label}`.

**Pure** (unit-tested inline in `api/redeem.test.mjs`):
- `normCode` / `isValidCode` — trim + upper-case + `/^[A-Z0-9]+$/` (R7).
- `mergeCodes(lists)` — union by code; keep first non-empty reward + any `added_at`; newest-first,
  undated treated as newest (always attempted). (R7/R8)
- `classify(retcode)` — table lookup → action flags (R6).
- `pickCookie(raw)` — keep only the 5 redeem token keys.

**IO:**
- `fetchJson(url, opts)` — one wrapper: UA + `AbortController` timeout + `res.ok` guard.
- `fetchCodes(game)` — loops `SOURCES` via `allSettled`, fallback row, then `mergeCodes`. (R8)
- `getRole(game, cookie)` — roles endpoint → `{uid,region,level}`; throws `{cookieDead}` on retcode≠0/empty. (R2)
- `redeemCode(game, role, cookie, code, lang)` — builds the per-game request from `GAMES`; network error → `{retcode:null}`.
- `makeStore(kv)` — strategy: falsy creds → no-op stub (stateless `-2017` path); else Upstash REST `{has,add}`. (R4)

**Orchestration:**
- `redeemForUser(game, user, config, store)` — role → AR gate → `fetchCodes` → optional window →
  KV delta → cap → sequential redeem (throttle + cooldown-retry). `config.dryRun` → plan only, no redeem.
- `checkin(config)` — PluginModule export; reads `config.game`; per-user try/catch; **never throws** (R10).

## Data flow (`checkin`)

```
for each user in config.users (sequential):
  role = getGameRole(user.cookies, GAME_BIZ)          # R2; CookieError → report+continue
  if GENSHIN and role.level < 10: report "AR<10"; continue   # R3
  active = fetchActiveCodes(GAME)                     # union(ennead,hashblen,seriaati), sanitized, newest-first (R7/R8)
  processedKey = `redeem:${GAME_BIZ}:${role.uid}`
  todo = active
  if REDEEM_WINDOW_H:                                 # OPTIONAL freshness dedup (default off)
    todo = todo.filter(c => !c.added_at || now - c.added_at <= WINDOW)   # no added_at → always attempt ("all sign")
  todo = todo.filter(c => !await kv.sIsMember(processedKey, c.code))     # KV stub→noop by default (all-sign); KV set → skip done (R4)
  todo = todo.slice(0, config.maxPerRun ?? 8)        # R5 cap
  for each c in todo (sequential):
    r = redeemOne({uid:role.uid, region:role.region, cookie, lang}, c.code)
    cls = classifyRetcode(r.retcode)
    if cls.cookieExpired: report; break               # abort this account
    if cls.cooldown: await 6s; r = redeemOne(...); cls = classify(...)   # retry once
    if cls.processed: await kv.sAdd(processedKey, c.code)
    push result {code, reward:c.reward, status, retcode}
    await sleep(5500)                                  # R5 throttle
return results   # never throws (R10)
```

## Config integration (`api/config.ts`)

Add two `plugins[]` entries (reuse cookies; KV creds read **non-throwing** from `process.env`
so KV stays optional):

```ts
{
  name: 'genshin-redeem',
  modulePath: '@official/genshin-redeem.js',
  options: {
    users: [{ cookies: getSecret?.('GENSHIN_COOKIES') }],
    lang: myLanguage,
    maxPerRun: 8,
    source: { primary: 'ennead', fallback: 'seriaati' },
    kv: { url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN }, // optional
  }
},
// star-rail-redeem analogous (game_biz hkrpg_global)
```

`discord-notify` already targets `['*']`, so it reports redeem results automatically. Redeem
results are shaped `{retcode, message, code, reward, data}` so the existing `tag_filter`
(`[0, -5003]`) and embed builder render them; extend `tag_filter` to also silence `-2017`
(already redeemed) if desired.

## Error handling & isolation (R10)
- Per-account and per-code `try/catch`; `checkin` returns a results array and never throws.
- Cookie errors abort only the current account.
- The pipeline-level resilience already added (`runHooks` try/catch + per-plugin catch in
  `execute()`) contains any residual failure so check-in plugins are unaffected.

## Vercel
- `vercel.json`: `functions["api/index.ts"].maxDuration ≥ 60` (Pro up to 300), `regions:["sin1"]`.
- Redeem runs in the same daily cron as check-in (sequential after the check-in plugins); the
  R5 per-run cap keeps total time bounded. _Optional later:_ split redeem to its own cron path.

## Testing (see tasks T6)
- **Pure units inline:** `sanitizeCodes` (junk/whitespace/slash cases), `classifyRetcode` (all
  branches), region/biz mapping.
- **`api/test.ts` DRY_RUN path:** resolve roles + fetch+sanitize codes + compute KV delta, but
  **skip the actual redeem call** — exercises the whole chain without consuming codes. Real
  redemption gated behind an explicit `REDEEM_LIVE=1` flag.
- Local unit test imports the **local** plugin file directly (bypassing the remote resolver) to
  test the pure helpers.

## Correctness properties
- **Idempotent:** two runs never double-grant (KV delta + `-2017` backstop).
- **Bounded:** ≤ `maxPerRun` redeem calls per run; ≥ 5.5 s spacing.
- **Safe:** dirty/invalid codes never sent; cookies/KV tokens never logged.
