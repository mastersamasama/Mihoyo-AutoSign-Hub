import { getSecret } from './util.js';
import { GlobalConfig } from './types/common.js';

const myLanguage = 'zh-tw';

// Redeem runs on its OWN cron (/api/redeem) and both games run CONCURRENTLY
// (`concurrent: true` below). HoYoLAB's redemption cooldown was measured at 5 s
// per game account and verified independent across Genshin/Star Rail, so the two
// loops do not contend — each therefore gets the near-whole invocation rather
// than half of it (24 s → 48 s), which is what raises the per-run code count.
//
// Sizing, from measurement: ~5.5 s spacing + ~0.7 s round-trip (~2.5 s on the
// first, cold-TLS call) → 6 codes ≈ 2.5 + 5 × 6.2 ≈ 34 s, comfortably inside 48 s
// even with a cooldown retry or two. The plugin still derives its own cap from
// the budget, so REDEEM_MAX_PER_RUN is the binding limit, not a guess.
const REDEEM_BUDGET_MS = 48000;
const REDEEM_RUN_DEADLINE_MS = 52000;
const REDEEM_MAX_PER_RUN = 6;

/** Which half of the pipeline a caller wants. Check-in and redeem run on separate
 *  crons (separate invocations), so each gets the whole 60s function ceiling. */
export type ConfigKind = 'checkin' | 'redeem' | 'all';

const REDEEM_PLUGINS = new Set(['genshin-redeem', 'starrail-redeem']);

export const getConfig = (kind: ConfigKind = 'all'): GlobalConfig => {
    const config = buildConfig();
    if (kind === 'all') return config;
    const wantRedeem = kind === 'redeem';
    return {
        ...config,
        plugins: config.plugins?.filter(p => REDEEM_PLUGINS.has(p.name) === wantRedeem),
        // Only redeem is safe to parallelise — its rate limit is per game account
        // (measured). Check-in keeps its original sequential behaviour.
        concurrent: wantRedeem,
    };
};

const buildConfig = (): GlobalConfig => ({
    plugin_repo: "https://raw.githubusercontent.com/mastersamasama/Mihoyo-AutoSign-Hub/main/api/plugins",
    middleware_repo: "https://raw.githubusercontent.com/mastersamasama/Mihoyo-AutoSign-Hub/main/api/middlewares",
    plugins: [
        {
            name: 'genshin',
            modulePath: "./plugins/genshin.js",
            options: {
                users: [
                    {
                        cookies: getSecret?.('GENSHIN_COOKIES')
                    }
                ],
                lang: myLanguage,
            }
        },
        {
            name: 'starrail',
            modulePath: "./plugins/starrail.js",
            options: {
                users: [
                    {
                        cookies: getSecret?.('STARRAIL_COOKIES')
                    }
                ],
                lang: myLanguage,
            }
        },
        {
            name: 'genshin-redeem',
            modulePath: "./plugins/redeem.js",
            options: {
                game: 'genshin',
                users: [
                    {
                        // redeem uses short-lived cookie_token; keep it separate from the
                        // long-lived check-in cookie. Fall back to GENSHIN_COOKIES if unset.
                        cookies: process.env.GENSHIN_REDEEM_COOKIES ?? getSecret?.('GENSHIN_COOKIES')
                    }
                ],
                lang: myLanguage,
                // Upper bound only — the plugin further caps by what timeBudgetMs can
                // actually space out at 5.5s/code, so it never fires un-throttled calls.
                maxPerRun: REDEEM_MAX_PER_RUN,
                timeBudgetMs: REDEEM_BUDGET_MS,
                // absolute per-invocation deadline shared by BOTH redeem plugins. Computed
                // when getConfig() runs (once per request), so it is correct on warm lambdas.
                runDeadline: Date.now() + REDEEM_RUN_DEADLINE_MS,
                kv: { url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN },
            }
        },
        {
            name: 'starrail-redeem',
            modulePath: "./plugins/redeem.js",
            options: {
                game: 'starrail',
                users: [
                    {
                        cookies: process.env.STARRAIL_REDEEM_COOKIES ?? getSecret?.('STARRAIL_COOKIES')
                    }
                ],
                lang: myLanguage,
                maxPerRun: REDEEM_MAX_PER_RUN,
                timeBudgetMs: REDEEM_BUDGET_MS,
                runDeadline: Date.now() + REDEEM_RUN_DEADLINE_MS,
                kv: { url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN },
            }
        }
    ],
    middlewares: [
        {
            name: 'cookies-tidy',
            modulePath: './middlewares/cookies-tidy.js',
        },
        {
            name: 'discord-notify',
            modulePath: './middlewares/discord-notify.js',
            target: ['*'],  // list of names of plugins to target, '*' means all plugins, default is ['*']
            options: {
                webhook: getSecret?.('DISCORD_WEBHOOK'),
                language: myLanguage, // support 'en', 'zh-cn', 'zh-tw', 'ja', 'ko', default is 'en'
                tag_filter: [0, -5003], // will not mention users when success(0), -5003: already checked in, default is [0]
                mentionUsers: [getSecret?.('DISCORD_UID')], // mention users when checkin failed, default is []
            }
        }
    ]
});