// Inline tests for api/plugins/redeem.js — pure-function unit asserts + optional DRY RUN.
//
//   node api/redeem.test.mjs                          # unit tests only
//   node --env-file=.env.local api/redeem.test.mjs    # + DRY RUN (real roles+codes, NO redeem)
//
// DRY RUN resolves game roles and fetches/unions the code list, then prints what WOULD be
// redeemed — it never calls the redeem endpoint, so no code is consumed.

import assert from "node:assert/strict";
import { __test, checkin } from "./plugins/redeem.js";

const { normCode, isValidCode, mergeCodes, classify, pickCookie } = __test;

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

test("mergeCodes unions, dedupes, sanitizes, sorts newest-first (undated first)", () => {
  const merged = mergeCodes([
    [{ code: "abc", reward: "R1" }, { code: "OLD", added_at: 1000 }],
    [{ code: "ABC", reward: "R1b", added_at: 5000 }, { code: "new", added_at: 9000 }, { code: "FRESH" }, { code: "{{ZH" }],
  ]);
  assert.deepEqual(merged.map((c) => c.code), ["FRESH", "NEW", "ABC", "OLD"]); // undated→Infinity first; junk dropped
  const abc = merged.find((c) => c.code === "ABC");
  assert.equal(abc.added_at, 5000);  // timestamp picked up from the dated source
  assert.equal(abc.reward, "R1");    // first non-empty reward wins
});

test("classify maps retcodes to actions", () => {
  assert.equal(classify(0).done, true);
  assert.equal(classify(-2017).already, true);
  assert.equal(classify(-2001).permanent, true);
  assert.equal(classify(-1004).cooldown, true);
  assert.equal(classify(-1071).cookieDead, true);
  assert.equal(classify(99999).unknown, true);
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
const cookies = { genshin: process.env.GENSHIN_COOKIES, starrail: process.env.STARRAIL_COOKIES };
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
