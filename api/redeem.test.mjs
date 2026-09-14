// Inline tests for api/plugins/redeem.js — pure-function unit asserts + optional DRY RUN.
//
//   node api/redeem.test.mjs                          # unit tests only
//   node --env-file=.env.local api/redeem.test.mjs    # + DRY RUN (real roles+codes, NO redeem)
//
// DRY RUN resolves game roles and fetches/unions the code list, then prints what WOULD be
// redeemed — it never calls the redeem endpoint, so no code is consumed.

import assert from "node:assert/strict";
import { __test, checkin } from "./plugins/redeem.js";

const { normCode, isValidCode, mergeCodes, classify, pickCookie, servableCount, cooldownMsFrom, isFresh, maxDatedSeq, RECENT_MS } = __test;

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };

console.log("redeem.js unit tests");

test("normCode trims + upper-cases", () => {
  assert.equal(normCode("  ps ca "), "PS CA");          // internal space preserved (rejected later)
  assert.equal(normCode({ code: " genshingift " }), "GENSHINGIFT");
});

test("isValidCode rejects junk, keeps clean codes", () => {
  assert.equal(isValidCode("GENSHINGIFT"), true);
  assert.equal(isValidCode("PSCA8NL4ZSPD"), true);
  assert.equal(isValidCode("{{ZH"), false);
  assert.equal(isValidCode("BJLHLMVGCN / 5OZ2HDP95I"), false); // slash + spaces
  assert.equal(isValidCode(""), false);
});

test("mergeCodes unions, dedupes, sanitizes, sorts newest-first (undated LAST)", () => {
  const merged = mergeCodes([
    [{ code: "abc", reward: "R1" }, { code: "OLD", added_at: 1000 }],
    [{ code: "ABC", reward: "R1b", added_at: 5000 }, { code: "new", added_at: 9000 }, { code: "UNDATED" }, { code: "{{ZH" }],
  ]);
  // undated sorts last: a freshly announced code always carries an added_at, so an
  // undated one is old — it must not steal a slot from the codes we are racing for.
  assert.deepEqual(merged.map((c) => c.code), ["NEW", "ABC", "OLD", "UNDATED"]); // junk dropped
  const abc = merged.find((c) => c.code === "ABC");
  assert.equal(abc.added_at, 5000);  // timestamp picked up from the dated source
  assert.equal(abc.reward, "R1");    // first non-empty reward wins
});

test("mergeCodes is deterministic when several codes are undated", () => {
  const order = () => mergeCodes([[{ code: "AA" }, { code: "BB" }, { code: "CC", added_at: 7 }]]).map((c) => c.code);
  assert.deepEqual(order(), ["CC", "AA", "BB"]); // no Infinity-Infinity=NaN comparator
  assert.deepEqual(order(), order());
});

test("mergeCodes puts vouched-active codes ahead of unvouched newer ones", () => {
  const merged = mergeCodes([[{ code: "ACTIVE", added_at: 100, vouched: true }, { code: "NEWER", added_at: 999 }]]);
  assert.deepEqual(merged.map((c) => c.code), ["ACTIVE", "NEWER"]);
});

test("a code fresh enough to be racing for outranks an older vouched one", () => {
  // Regression for the 2026-09-12 starvation: the three 6.1 livestream codes were
  // in hashblen (recency) hours before ennead (validity) listed them, so under
  // vouched-first they sorted behind codes redeemed weeks earlier and fell past
  // the per-run cap. Freshness must win that comparison.
  const now = Date.parse("2026-09-12T16:20:00Z");
  const agoH = (h) => Math.floor(now / 1000) - h * 3600;
  const merged = mergeCodes(
    [
      [{ code: "OLDVOUCHED", added_at: agoH(720), vouched: true }], // ennead: a month old
      [{ code: "LIVESTREAM", added_at: agoH(4) }],                  // hashblen only, 4h old
    ],
    now
  );
  assert.deepEqual(merged.map((c) => c.code), ["LIVESTREAM", "OLDVOUCHED"]);
});

test("past the freshness window, vouched decides again", () => {
  const now = Date.parse("2026-09-12T16:20:00Z");
  const agoH = (h) => Math.floor(now / 1000) - h * 3600;
  const merged = mergeCodes(
    [[{ code: "VOUCHED", added_at: agoH(200), vouched: true }, { code: "STALE", added_at: agoH(80) }]],
    now
  );
  assert.deepEqual(merged.map((c) => c.code), ["VOUCHED", "STALE"]); // 80h > RECENT_MS
  assert.equal(RECENT_MS, 48 * 3600_000);                 // two protected runs at one/day
  assert.equal(isFresh({ added_at: agoH(49) }, now), false);
  assert.equal(isFresh({ added_at: agoH(47) }, now), true);
  assert.equal(isFresh({}, now), false); // undated is never fresh
});

test("replay of the 2026-09-12 Genshin run: all three livestream codes now fit", () => {
  // Real source data. ennead had vouched only REKVIEM by 16:20Z; hashblen carried
  // added_at for all three. Under the old order 2 of 3 landed inside a 6-code cap.
  const now = Date.parse("2026-09-12T16:20:00Z");
  const ennead = ["2BJ64QRZ7RT8", "BALLETCOLLAB", "Y1INABQB6DEX", "YOAL3V36XHS7", "YOALM27HLJA1", "REKVIEM"]
    .map((code) => ({ code, vouched: true }));
  const hashblen = [
    { code: "2BJ64QRZ7RT8", added_at: 1785518032 },
    { code: "BALLETCOLLAB", added_at: 1786886669 },
    { code: "Y1INABQB6DEX", added_at: 1786934071 },
    { code: "YOAL3V36XHS7", added_at: 1788397513 },
    { code: "REKVIEM", added_at: 1789214763 },
    { code: "VESNA0923", added_at: 1789216548 },
    { code: "PRIMADONNA", added_at: 1789217402 },
  ];
  const top6 = mergeCodes([ennead, hashblen], now).slice(0, servableCount(48000)).map((c) => c.code);
  for (const c of ["REKVIEM", "VESNA0923", "PRIMADONNA"]) assert.ok(top6.includes(c), `${c} starved`);
});

test("a code newer than everything dated is fresh even with no date of its own", () => {
  // Dates come from hashblen alone. When it lags, the new code arrives carrying
  // only seriaati's monotonic id — higher than the id of every code we DO have a
  // date for, therefore newer than all of them. Without this rule it would be
  // "undated == old" and sort to the bottom, which is the original starvation.
  const now = Date.parse("2026-09-12T16:20:00Z");
  const agoH = (h) => Math.floor(now / 1000) - h * 3600;
  const merged = mergeCodes(
    [
      [{ code: "DATEDNEWEST", added_at: agoH(240), vouched: true, seq: 796 }], // hashblen + seriaati
      [{ code: "LAGGED", vouched: true, seq: 803 }],                           // seriaati only
    ],
    now
  );
  assert.deepEqual(merged.map((c) => c.code), ["LAGGED", "DATEDNEWEST"]);
});

test("the sequence rule stays inert while hashblen is current", () => {
  const now = Date.parse("2026-09-12T16:20:00Z");
  const agoH = (h) => Math.floor(now / 1000) - h * 3600;
  const codes = [
    { code: "NEWDATED", added_at: agoH(4), vouched: true, seq: 803 },
    { code: "OLDSEQONLY", vouched: true, seq: 790 },   // below the dated high-water mark
  ];
  assert.equal(maxDatedSeq(codes), 803);
  assert.equal(isFresh(codes[1], now, 803), false);    // not newer than everything dated
  assert.deepEqual(mergeCodes([codes], now).map((c) => c.code), ["NEWDATED", "OLDSEQONLY"]);
});

test("a total date outage still orders newest-first by sequence", () => {
  const now = Date.parse("2026-09-12T16:20:00Z");
  const merged = mergeCodes([[{ code: "OLDER", seq: 776 }, { code: "NEWER", seq: 803 }, { code: "NOSEQ" }]], now);
  assert.equal(maxDatedSeq(merged), null);             // nothing dated → rule inert, no crash
  assert.deepEqual(merged.map((c) => c.code), ["NEWER", "OLDER", "NOSEQ"]);
});

test("inside the fresh drop the NEWEST code leads, vouched does not jump the queue", () => {
  // The three 2026-09-12 codes were announced in one livestream. ennead had listed
  // REKVIEM (the oldest of the three) and not the other two, so a vouched-first
  // comparison inside the drop put the oldest at the head of the batch. Among
  // codes of the same drop `vouched` records aggregator lag, not validity.
  const now = Date.parse("2026-09-12T16:20:00Z");
  const order = mergeCodes(
    [[
      { code: "REKVIEM", added_at: 1789214763, vouched: true },  // 12:06Z, vouched
      { code: "VESNA0923", added_at: 1789216548 },               // 12:35Z
      { code: "PRIMADONNA", added_at: 1789217402 },              // 12:50Z, newest
    ]],
    now
  ).map((c) => c.code);
  assert.deepEqual(order, ["PRIMADONNA", "VESNA0923", "REKVIEM"]);
});

test("vouched still decides inside the backlog, where codes differ by weeks", () => {
  const now = Date.parse("2026-09-12T16:20:00Z");
  const agoH = (h) => Math.floor(now / 1000) - h * 3600;
  const order = mergeCodes(
    [[{ code: "NEWERDEAD", added_at: agoH(200) }, { code: "OLDERLIVE", added_at: agoH(900), vouched: true }]],
    now
  ).map((c) => c.code);
  assert.deepEqual(order, ["OLDERLIVE", "NEWERDEAD"]); // a slot here should buy something
});

test("a code past the window lands at the FRONT of the backlog, not behind it", () => {
  // Why a bounded window is survivable on a once-a-day cron: once a code leaves the
  // fresh tier it is still the newest vouched code in the backlog, so it keeps a
  // slot as long as the backlog is shorter than the cap.
  const now = Date.parse("2026-09-14T16:20:00Z");
  const agoH = (h) => Math.floor(now / 1000) - h * 3600;
  const order = mergeCodes(
    [[
      { code: "MISSED", added_at: agoH(72), vouched: true },
      { code: "OLD1", added_at: agoH(240), vouched: true },
      { code: "OLD2", added_at: agoH(700), vouched: true },
    ]],
    now
  ).map((c) => c.code);
  assert.equal(order[0], "MISSED");
});

test("servableCount matches what the throttle can actually space out", () => {
  // 2.6s per call + 5.5s mandatory spacing → one code, then one per 8.1s.
  assert.equal(servableCount(16000), 2);   // the old shared-invocation budget
  assert.equal(servableCount(2600), 1);
  assert.equal(servableCount(0), 0);       // no budget → attempt nothing, defer all
  assert.equal(servableCount(-5000), 0);   // already past the deadline
});

test("servableCount agrees with the measured 48s concurrent run", () => {
  // Live run (2026-08-01, both games concurrent): codes landed at 2.5 / 11.0 / 19.1
  // / 27.1 / 35.3 / 43.3s — 6 fit, and the 7th was rate-limited exactly as the
  // formula says it would be. The prediction must match that, not exceed it: an
  // over-promise is what makes the tail fire un-spaced and get dropped.
  assert.equal(servableCount(48000), 6);
});

test("classify maps retcodes to actions", () => {
  assert.equal(classify(0).done, true);
  assert.equal(classify(-2017).already, true);
  assert.equal(classify(-2001).permanent, true);
  assert.equal(classify(-1004).cooldown, true);
  assert.equal(classify(-1071).cookieDead, true);
  assert.equal(classify(99999).unknown, true);
});

test("classify settles -1065 (the retcode a bad cdkey actually returns)", () => {
  // Measured live: an unrecognised code answers -1065 "Invalid redemption code",
  // not -2003. Left unmapped it would be retried on every run, forever.
  assert.equal(classify(-1065).permanent, true);
  assert.equal(classify(-1065).done, true);
  assert.equal(classify(-1065).unknown, undefined);
});

test("cooldownMsFrom uses the wait HoYoLAB states, and falls back when absent", () => {
  assert.equal(cooldownMsFrom("Redemption in cooldown. Please try again in 4 second(s)."), 4800);
  assert.equal(cooldownMsFrom("Please try again in 1 second(s)."), 1800);
  assert.equal(cooldownMsFrom("no number here"), 6000);   // fixed fallback
  assert.equal(cooldownMsFrom(undefined), 6000);
  assert.equal(cooldownMsFrom("try again in 9999 second(s)"), 12000); // clamped
});

test("pickCookie keeps only redeem token keys", () => {
  const raw = "ltoken_v2=AAA; cookie_token_v2=BBB; account_mid_v2=CCC; account_id_v2=DDD; junk=x";
  const out = pickCookie(raw);
  assert.equal(/ltoken_v2|junk/.test(out), false);
  assert.equal(out.includes("cookie_token_v2=BBB"), true);
  assert.equal(out.includes("account_mid_v2=CCC"), true);
});

console.log(`\n${n} unit assertions passed\n`);

// ───────────── optional DRY RUN ─────────────
const cookies = {
  genshin: process.env.GENSHIN_REDEEM_COOKIES || process.env.GENSHIN_COOKIES,
  starrail: process.env.STARRAIL_REDEEM_COOKIES || process.env.STARRAIL_COOKIES,
};
if (cookies.genshin || cookies.starrail) {
  console.log("DRY RUN (real roles + codes, NO redeem calls, nothing consumed)");
  for (const game of ["genshin", "starrail"]) {
    if (!cookies[game]) continue;
    try {
      const res = await checkin({ game, users: [{ cookies: cookies[game] }], lang: "en", dryRun: true, maxPerRun: 50 });
      console.log(`  ${game}: ${res.length} item(s)`);
      for (const r of res) console.log(`    - ${r.code ?? "-"} [${r.status}] ${r.reward ?? r.message ?? ""}`);
    } catch (e) {
      console.log(`  ${game}: FAILED ${e?.message || e}`);
    }
  }
} else {
  console.log("(DRY RUN skipped — no *_COOKIES in env. Run: node --env-file=.env.local api/redeem.test.mjs)");
}
