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
    pick: (j) => (j?.active ?? []).map((e) => ({ code: e.code, reward: (e.rewards || []).join("; ") })),
  },
  {
    name: "hashblen", // recency (added_at Unix), no validity flag
    url: () => "https://db.hashblen.com/codes",
    pick: (j, g) => (j?.[g.src.hashblen] ?? []).map((e) => ({ code: e.code, reward: e.description || "", added_at: e.added_at })),
  },
  {
    name: "seriaati", // validated active-only (fallback)
    url: (g) => `https://hoyo-codes.seria.moe/codes?game=${g.src.seriaati}`,
    pick: (j) => (j?.codes ?? []).filter((c) => c.status === "OK").map((c) => ({ code: c.code, reward: c.rewards || "" })),
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
    const prev = out.get(code) ?? { code, reward: "", added_at: undefined };
    out.set(code, {
      code,
      reward: prev.reward || item.reward || "",
      added_at: prev.added_at ?? item.added_at,
    });
  }
  // newest-first; undated treated as newest (always attempted = "if no time then all sign")
  return [...out.values()].sort((a, b) => (b.added_at ?? Infinity) - (a.added_at ?? Infinity));
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
async function fetchJson(url, { method = "GET", headers = {}, body, timeoutMs = 10000 } = {}) {
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
const THROTTLE_MS = 5500;
const COOLDOWN_MS = 6000;

async function redeemForUser(game, user, config, store) {
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
  todo = keep.slice(0, config.maxPerRun ?? 8);

  const out = [];
  for (const c of todo) {
    if (config.dryRun) {
      out.push({ code: c.code, reward: c.reward, status: "dry-run", added_at: c.added_at });
      continue;
    }
    let { retcode, message } = await redeemCode(game, role, user.cookies, c.code, config.lang);
    let v = classify(retcode);
    if (v.cooldown) {
      await sleep(COOLDOWN_MS);
      ({ retcode, message } = await redeemCode(game, role, user.cookies, c.code, config.lang));
      v = classify(retcode);
    }
    if (v.cookieDead) { out.push({ code: c.code, retcode, status: v.label, message }); break; }
    if (v.done) await store.add(key, c.code);
    out.push({ code: c.code, reward: c.reward, retcode, status: v.label, message });
    await sleep(THROTTLE_MS);
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
export const __test = { normCode, isValidCode, mergeCodes, classify, pickCookie, fetchCodes, getRole, GAMES, SOURCES };
