// Inline tests for api/plugins/redeem.js — pure-function unit asserts + optional DRY RUN.
//
//   node api/redeem.test.mjs                          # unit tests only
//   node --env-file=.env.local api/redeem.test.mjs    # + DRY RUN (real roles+codes, NO redeem)
//
// DRY RUN resolves game roles and fetches/unions the code list, then prints what WOULD be
// redeemed — it never calls the redeem endpoint, so no code is consumed.

import assert from "node:assert/strict";
import { __test, checkin } from "./plugins/redeem.js";

const { normCode, isValidCode, mergeCodes, classify, pickCookie, servableCount, cooldownMsFrom } = __test;

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
