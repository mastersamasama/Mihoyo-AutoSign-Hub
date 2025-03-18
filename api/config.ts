import { getSecret } from './util.js';
import { GlobalConfig } from './types/common.js';

const myLanguage = 'zh-tw';

export const getConfig = (): GlobalConfig => ({
    plugin_repo: "https://github.com/mastersamasama/Mihoyo-AutoSign-Hub/raw/main/api/plugins",
    middleware_repo: "https://github.com/mastersamasama/Mihoyo-AutoSign-Hub/raw/main/api/middlewares",
    plugins: [
        {
            name: 'genshin',
            modulePath: "@official/genshin.js",
            options: {
                users: [
                    {
                        cookies: getSecret?.('GENSHIN_COOKIES')
                    },
                ],
                lang: myLanguage,
            }
        },
        {
            name: 'star rail',
            modulePath: "@official/starrail.js",
            options: {
                users: [
                    {
                        cookies: getSecret?.('STARRAIL_COOKIES')
                    },
                ],
                lang: myLanguage,
            }
        }
    ],
    middlewares: [
        {
            name: 'cookies-tidy',
            modulePath: '@official/cookies-tidy.js',
        },
        {
            name: 'discord-notify',
            modulePath: '@official/discord-notify.js',
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