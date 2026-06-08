# Requirements — Auto Gift-Code Redemption (`redeem-codes`)

## Overview
Add automatic HoYoLAB gift-code redemption for **Genshin Impact** and **Honkai: Star Rail**
to the existing check-in pipeline. Each game gets a dedicated **redeem plugin** that reuses
the account cookies, fetches the current *active* code list, redeems codes not yet processed
for that account (tracked in an external KV store, with HoYoLAB's "already redeemed" as the
correctness backstop), throttled to respect HoYoLAB rate limits, and reports results through
the existing `discord-notify` middleware.

## Scope
- **In:** Genshin + Star Rail global (os) accounts; ennead code source with seriaati fallback;
  Upstash/Vercel KV dedup (optional, degrades to stateless); per-game redeem plugins conforming
  to the `PluginModule` contract.
- **Out:** CN (`mihoyo.com`) accounts; ZZZ / Honkai 3rd / Tears of Themis; captcha solving;
  in-game reward delivery verification.

## EARS requirements

**R1 — Redeem active codes.** WHEN a redeem plugin runs for a configured account, the system
SHALL fetch the current active codes for that game and attempt to redeem each code that has not
already been processed for that account.

**R2 — Resolve account identity.** WHEN redeeming, the system SHALL obtain the account's
`game_uid`, `region`, and `level` from `getUserGameRolesByCookie` BEFORE attempting redemption.
IF the cookie yields no role for the game, THEN the system SHALL skip that account and report a
clear "cookie invalid/expired" result.

**R3 — Genshin AR gate.** IF the game is Genshin AND the account level < 10, THEN the system
SHALL skip redemption for that account and report "AR<10, skipped" (Genshin web redemption
requires Adventure Rank ≥ 10).

**R4 — No double consumption.** The system SHALL NOT re-attempt a code already recorded as
processed for an account when KV is configured. WHERE KV is not configured, the system SHALL
rely on HoYoLAB returning already-redeemed (`-2017`/`-2018`) and SHALL treat that as a
successful skip — never a double grant.

**R5 — Rate limiting & bounded time.** The system SHALL wait ≥ 5.5 s between consecutive redeem
requests and SHALL issue them sequentially (never concurrently). The system SHALL cap redeem
attempts per run to a configurable maximum (default 8), deferring the remainder to the next run.

**R6 — Retcode handling.** WHEN a redeem response returns `0`, `-2017`, or `-2018`, the system
SHALL record the code as processed. WHEN `-2001` (expired) or `-2003` (invalid), the system SHALL
record it as processed (failed-permanent, no retry). WHEN `-2016`/`-1004` (cooldown), the system
SHALL back off and retry once; if still cooling down, leave the code unprocessed for next run.
WHEN a cookie/login retcode (`-1071`/`-100`/`-10001`), the system SHALL abort the account and
report "cookie expired".

**R7 — Code sanitation.** The system SHALL upper-case and trim each code and SHALL reject any
code that is empty, contains spaces or slashes, or does not match `/^[A-Z0-9]+$/`, before
attempting redemption (the ennead list contains junk/whitespace/`A / B` entries).

**R8 — Source union & resilience.** The system SHALL fetch codes from multiple sources — ennead
(active/validity) and hashblen (`added_at` recency), with seriaati as fallback — and SHALL union,
dedupe, and sanitize them. IF any one source fails, the system SHALL proceed with the others.
Codes carry `added_at` where available; codes without `added_at` are always attempted ("all sign").

**R9 — Reporting.** WHEN redemption completes for an account, the system SHALL return a per-code
result (`code`, `reward`, `status`, retcode) so `discord-notify` can report
redeemed / already-claimed / failed codes.

**R10 — Isolation.** The redeem plugins SHALL conform to the existing `PluginModule` contract
(`export const checkin`) and SHALL NOT abort the daily check-in plugins; any redeem failure SHALL
be contained (logged + reported), never thrown out of the plugin.

## Non-functional
- Stateless-safe: no local disk; KV accessed via REST (no persistent socket).
- No new npm runtime deps inside the remote-fetched plugins (use `fetch` only).
- Secrets via env; **never log cookies, KV tokens, or full code lists with rewards tied to UID**.
- Time budget bounded by R5 cap; recommend Vercel `maxDuration ≥ 60s`.

## Open assumptions (verify before ship)
- The user-provided `*_COOKIES` already contain `cookie_token_v2` + `account_mid_v2` +
  `account_id_v2` (required for redeem; `cookie_token_v2` is short-lived and may expire sooner
  than the check-in `ltoken`). If absent → R2/R6 cookie-expired path.
- Star Rail redeem host (`sg-hkrpg-api.hoyoverse.com` + `webExchangeCdkeyRisk`) verified against a
  live request before shipping (host variant is version-dependent per research).
