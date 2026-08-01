// @official redeem plugin — ONE data-driven module, registered once per game in config.ts
// (genshin-redeem / starrail-redeem differ only by options.game). Reuses the account cookies.
// Design: .kiro/specs/redeem-codes/. Game/source/retcode differences live in data tables below.

export const meta = {
  name: "hoyo-redeem",
  version: "0.0.1",
  author: "mastersamasama",
  date: "2026-06-08",
  contact: "https://github.com/mastersamasama/Mihoyo-AutoSign-Hub/issues",
  description: "Auto-redeem HoYoLAB gift codes (data-driven, per game)",
  support: "os",
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";

// ───────────── data: per-game descriptors ─────────────
const GAMES = {
  genshin: {
    biz: "hk4e_global",
    arGate: 10, // Genshin web redemption requires Adventure Rank >= 10
    redeem: {
      host: "https://sg-hk4e-api.hoyoverse.com",
      path: "/common/apicdkey/api/webExchangeCdkey",
      method: "GET",
      extra: () => ({ sLangKey: "en-us" }),
    },
    src: { ennead: "genshin", hashblen: "genshin", seriaati: "genshin" },
  },
  starrail: {
    biz: "hkrpg_global",
    arGate: 0,
    redeem: {
      host: "https://sg-hkrpg-api.hoyoverse.com",
      path: "/common/apicdkey/api/webExchangeCdkeyRisk",
      method: "POST",
      extra: () => ({ t: Date.now() }),
    },
    src: { ennead: "starrail", hashblen: "hsr", seriaati: "hkrpg" },
  },
};

// ───────────── data: code sources (add one = one row) ─────────────
const SOURCES = [
  {
    name: "ennead", // validity (active flag), no date
    url: (g) => `https://api.ennead.cc/mihoyo/${g.src.ennead}/codes`,
    pick: (j) => (j?.active ?? []).map((e) => ({ code: e.code, reward: (e.rewards || []).join("; "), vouched: true })),
  },
  {
    name: "hashblen", // recency (added_at Unix), no validity flag
    url: () => "https://db.hashblen.com/codes",
    pick: (j, g) => (j?.[g.src.hashblen] ?? []).map((e) => ({ code: e.code, reward: e.description || "", added_at: e.added_at })),
  },
  {
    name: "seriaati", // validated active-only (fallback)
    url: (g) => `https://hoyo-codes.seria.moe/codes?game=${g.src.seriaati}`,
    pick: (j) => (j?.codes ?? []).filter((c) => c.status === "OK").map((c) => ({ code: c.code, reward: c.rewards || "", vouched: true })),
    fallback: true,
  },
];

// ───────────── data: retcode → action ─────────────
const RETCODE = {
  0: { ok: true, done: true, label: "redeemed" },
  "-2017": { done: true, already: true, label: "already" },
  "-2018": { done: true, already: true, label: "already" },
  "-2001": { done: true, permanent: true, label: "expired" },
  "-2003": { done: true, permanent: true, label: "invalid" },
  // Observed live (2026-08-01): an unrecognised cdkey answers -1065 "Invalid
  // redemption code", NOT the -2003 the spec assumed. Without this row it fell
  // through to `unknown`/failed, so a permanently bad code was never recorded as
  // settled and would be re-attempted on every run forever.
  "-1065": { done: true, permanent: true, label: "invalid" },
  "-2016": { cooldown: true, label: "cooldown" },
  "-1004": { cooldown: true, label: "cooldown" },
  "-1071": { cookieDead: true, label: "cookie_expired" },
  "-100": { cookieDead: true, label: "cookie_expired" },
  "-10001": { cookieDead: true, label: "cookie_expired" },
};
const classify = (rc) => RETCODE[String(rc)] ?? { unknown: true, label: "failed" };

// ───────────── pure utils ─────────────
const normCode = (c) => String(c?.code ?? c ?? "").trim().toUpperCase();
const isValidCode = (c) => /^[A-Z0-9]+$/.test(c);

function mergeCodes(lists) {
  const out = new Map();
  for (const item of lists.flat()) {
    const code = normCode(item);
    if (!code || !isValidCode(code)) continue; // drop junk / spaces / slashes
    const prev = out.get(code) ?? { code, reward: "", added_at: undefined, vouched: false };
    out.set(code, {
      code,
      reward: prev.reward || item.reward || "",
      added_at: prev.added_at ?? item.added_at,
      vouched: prev.vouched || !!item.vouched, // a validity source (ennead/seriaati) confirmed it active
    });
  }
  // vouched-active first so a limited per-run time budget is spent on likely-valid
  // codes; then newest-first.
  //
  // Undated codes sort LAST, not first. They were once treated as "newest" so an
  // undated code would always be attempted, but a per-run cap turns "first" into
  // "steals the scarcest slot": an ennead-only code with no hashblen entry (i.e.
  // old enough that hashblen never recorded it) was jumping ahead of the freshly
  // announced version codes and starving them every run. A genuinely new code
  // always carries an added_at, so undated == old. (`?? 0` also avoids
  // Infinity - Infinity = NaN, which made the comparator non-deterministic
  // whenever two codes were undated.)
  return [...out.values()].sort(
    (a, b) => Number(b.vouched) - Number(a.vouched) || (b.added_at ?? 0) - (a.added_at ?? 0)
  );
}

const REDEEM_COOKIE_KEYS = ["cookie_token_v2", "account_mid_v2", "account_id_v2", "cookie_token", "account_id"];
function pickCookie(raw, keys = REDEEM_COOKIE_KEYS) {
  const map = new Map(
    String(raw || "")
      .split(";")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const i = p.indexOf("=");
        return i === -1 ? [p, ""] : [p.slice(0, i).trim(), p.slice(i + 1).trim()];
      })
  );
  return keys.filter((k) => map.get(k)).map((k) => `${k}=${map.get(k)}`).join("; ");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ───────────── http ─────────────
async function fetchJson(url, { method = "GET", headers = {}, body, timeoutMs = 7000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method, headers: { "User-Agent": UA, ...headers }, body, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ───────────── sources → codes (driven by SOURCES table) ─────────────
async function fetchCodes(game) {
  const primary = SOURCES.filter((s) => !s.fallback);
  const settled = await Promise.allSettled(primary.map(async (s) => s.pick(await fetchJson(s.url(game)), game)));
  let lists = settled.filter((r) => r.status === "fulfilled").map((r) => r.value);
  if (lists.length === 0) {
    const fb = SOURCES.find((s) => s.fallback);
    lists = await fetchJson(fb.url(game)).then((j) => [fb.pick(j, game)]).catch(() => []);
  }
  return mergeCodes(lists);
}

// ───────────── hoyolab ─────────────
async function getRole(game, cookie) {
  const url = `https://api-account-os.hoyolab.com/account/binding/api/getUserGameRolesByCookie?game_biz=${game.biz}`;
  const j = await fetchJson(url, { headers: { Cookie: pickCookie(cookie) } });
  const role = j?.data?.list?.find((r) => r.game_biz === game.biz) ?? j?.data?.list?.[0];
  if (j?.retcode !== 0 || !role) {
    const e = new Error(`role lookup failed: ${j?.retcode} ${j?.message}`);
    e.cookieDead = true;
    throw e;
  }
  return { uid: role.game_uid, region: role.region, level: role.level ?? 0, nickname: role.nickname };
}

async function redeemCode(game, role, cookie, code, lang) {
  const r = game.redeem;
  const qs = new URLSearchParams({
    uid: String(role.uid),
    region: role.region,
    lang: lang || "en",
    cdkey: code,
    game_biz: game.biz,
    ...r.extra(),
  });
  try {
    const j = await fetchJson(`${r.host}${r.path}?${qs.toString()}`, {
      method: r.method,
      headers: { Cookie: pickCookie(cookie), Referer: "https://act.hoyolab.com" },
    });
    return { retcode: j?.retcode, message: j?.message };
  } catch (e) {
    return { retcode: null, message: String(e?.message || e) }; // network/timeout → unknown, retry next run
  }
}

// ───────────── dedup store (strategy: KV or stateless no-op) ─────────────
function makeStore(kv) {
  if (!kv?.url || !kv?.token) {
    return { has: async () => false, add: async () => {} }; // default: stateless, rely on -2017
  }
  const cmd = (args) =>
    fetchJson(kv.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${kv.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
  return {
    has: async (key, member) => {
      try { return (await cmd(["SISMEMBER", key, member]))?.result === 1; } catch { return false; }
    },
    add: async (key, member) => { try { await cmd(["SADD", key, member]); } catch { /* best-effort */ } },
  };
}

// ───────────── orchestration ─────────────
// Measured live (2026-08-01), not assumed: the redemption cooldown is 5s, counted
// from the completion of the last ACCEPTED call — a throttled call does not reset
// it. Sleeping 5.5s after each response therefore clears it with 0.5s of margin.
// The window is per game account and independent across Genshin/Star Rail, which
// is why the two redeem plugins may run concurrently (see GlobalConfig.concurrent).
const THROTTLE_MS = 5500;
const COOLDOWN_MS = 6000;

// A -2016 response states the remaining wait outright ("Redemption in cooldown.
// Please try again in 4 second(s)."). Waiting exactly that long beats guessing:
// it neither under-waits into a second rejection nor burns budget over-waiting.
function cooldownMsFrom(message) {
  const m = /(\d+)\s*second/i.exec(String(message ?? ""));
  return m ? Math.min(Number(m[1]) * 1000 + 800, 12000) : COOLDOWN_MS;
}

// One redeem round-trip, MEASURED end-to-end (2026-08-01), not estimated: ~2.6s.
// It is not 0.7s of request time — the 5.5s spacing outlives the HTTP keep-alive,
// so every call re-does the TLS handshake. An earlier 1.5s guess made
// servableCount() over-promise by one code, which is exactly the un-spaced tail
// this whole cap exists to prevent. Observed cadence: 8.1s per code.
const CALL_MS = 2600;

// How many codes a time budget can attempt *with the mandatory spacing between
// them*. Attempting more does not redeem more: the un-spaced tail earns -2016
// (too frequent), and the cooldown retry needs COOLDOWN_MS the budget no longer
// has — so those codes are lost for the whole run rather than deferred to the
// next one. Because the order is deterministic and (without KV) nothing is
// recorded, the same codes lost the race every single day. Derive the cap from
// the budget instead of trusting a configured maxPerRun that may exceed it.
const servableCount = (ms) => Math.max(0, Math.floor((ms - CALL_MS) / (CALL_MS + THROTTLE_MS)) + 1);

// A code this new is one we are actively racing to redeem (a version livestream
// announces its batch all at once) — it must never yield its slot to backlog.
const RECENT_MS = 72 * 3600_000;

async function redeemForUser(game, user, config, store) {
  // Two budgets bound the serverless run:
  //  - runDeadline: absolute per-invocation wall shared by both redeem plugins, so both
  //    games together stay under the 60s function timeout.
  //  - timeBudgetMs: per-game cap on the redeem loop; also sizes the per-run code cap.
  // If we're already out of time (the first game ran long), bail before any network
  // work — those codes are retried next run (idempotent via -2017).
  const runDeadline = config.runDeadline ?? Date.now() + 40000;
  if (Date.now() >= runDeadline) {
    return [{ status: "skipped", message: "run time budget exhausted" }];
  }
  const deadline = Math.min(Date.now() + (config.timeBudgetMs ?? 16000), runDeadline);

  const role = await getRole(game, user.cookies); // CookieError bubbles to checkin's catch
  if (role.level < game.arGate) {
    return [{ status: "skipped", message: `AR ${role.level} < ${game.arGate}`, nickname: role.nickname }];
  }

  const key = `redeem:${game.biz}:${role.uid}`;
  let todo = await fetchCodes(game);

  const windowMs = config.windowHours ? config.windowHours * 3600_000 : null;
  if (windowMs) {
    const now = Date.now();
    todo = todo.filter((c) => !c.added_at || now - c.added_at * 1000 <= windowMs); // undated → always kept
  }
  const keep = [];
  for (const c of todo) if (!(await store.has(key, c.code))) keep.push(c); // KV stub → keeps all (all-sign)

  // Cap by BOTH the configured maximum and what the *remaining* budget can space
  // out — fetchCodes + store.has already spent some of it, so measure now.
  // dryRun does no network work, so it plans the whole configured list.
  const cap = config.dryRun
    ? (config.maxPerRun ?? 8)
    : Math.min(config.maxPerRun ?? 8, servableCount(deadline - Date.now()));
  todo = keep.slice(0, cap);
  const deferred = keep.slice(cap); // reported below, retried next run

  // Without a dedup store the ordering is byte-identical every run, so whatever
  // falls past the cap is deferred *forever* — the same starvation as before,
  // merely moved to the tail. Spend the last slot on a rotating pick from the
  // overflow so the backlog is eventually covered, with no state to keep.
  // Guarded by freshness: a code added within RECENT_MS is never displaced, so
  // on a version-livestream day the newly announced codes keep every slot.
  if (!config.dryRun && deferred.length && todo.length) {
    const last = todo[todo.length - 1];
    const lastIsFresh = last.added_at && Date.now() - last.added_at * 1000 <= RECENT_MS;
    if (!lastIsFresh) {
      const [pick] = deferred.splice(Math.floor(Date.now() / 86400_000) % deferred.length, 1);
      deferred.push(todo.pop());
      todo.push(pick);
    }
  }

  const out = [];
  for (let i = 0; i < todo.length; i++) {
    const c = todo[i];
    if (config.dryRun) {
      out.push({ code: c.code, reward: c.reward, status: "dry-run", added_at: c.added_at });
      continue;
    }
    if (Date.now() > deadline) break; // out of time budget — leftovers retry next run

    let { retcode, message } = await redeemCode(game, role, user.cookies, c.code, config.lang);
    let v = classify(retcode);
    if (v.cooldown) {
      const wait = cooldownMsFrom(message);
      if (Date.now() + wait < deadline) {
        await sleep(wait);
        ({ retcode, message } = await redeemCode(game, role, user.cookies, c.code, config.lang));
        v = classify(retcode);
      }
    }
    if (v.cookieDead) { out.push({ code: c.code, retcode, status: v.label, message }); break; }
    if (v.done) await store.add(key, c.code);
    out.push({ code: c.code, reward: c.reward, retcode, status: v.label, message });
    // throttle between codes, but never sleep past the budget or after the last code
    if (i < todo.length - 1 && Date.now() + THROTTLE_MS < deadline) await sleep(THROTTLE_MS);
  }

  // Report every code we did not get to (cap overflow, deadline break, cookie
  // abort) instead of dropping it. A starved code used to vanish from the run
  // entirely — the notification showed only what succeeded, so nobody could see
  // that a version code had been skipped for days on end.
  const attempted = new Set(out.map((r) => r.code));
  for (const c of [...todo, ...deferred]) {
    if (attempted.has(c.code)) continue;
    out.push({ code: c.code, reward: c.reward, status: "skipped", message: "out of run budget — retried next run" });
  }
  return out;
}

// PluginModule contract — never throws past here (R10)
export const checkin = async (config = {}) => {
  const game = GAMES[config.game];
  if (!game) throw new Error(`Unknown redeem game: ${config.game}`);
  if (!config?.users?.length) throw new Error("No users configured");

  const store = makeStore(config.kv);
  const results = [];
  for (const user of config.users) {
    const res = await redeemForUser(game, user, config, store).catch((e) => [
      { status: e?.cookieDead ? "cookie_expired" : "error", message: String(e?.message || e) },
    ]);
    results.push(...res);
  }
  console.log(`${config.game} redeem:`, results.map((r) => `${r.code ?? "-"}:${r.status}`).join(", "));
  return results;
};

// exported for inline unit tests (api/redeem.test.mjs)
export const __test = { normCode, isValidCode, mergeCodes, classify, pickCookie, servableCount, cooldownMsFrom, fetchCodes, getRole, GAMES, SOURCES };
