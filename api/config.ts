import { getSecret } from './util.js';
import { GlobalConfig } from './types/common.js';

const myLanguage = 'zh-tw';

export const getConfig = (): GlobalConfig => ({
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
                maxPerRun: 6,
                timeBudgetMs: 16000, // hard per-game cap so check-in + both redeems fit the 60s function
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
                maxPerRun: 6,
                timeBudgetMs: 16000, // hard per-game cap so check-in + both redeems fit the 60s function
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