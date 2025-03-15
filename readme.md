<h1 align="center">
    <img width="120" height="120" src="doc/picture/yun-jin-512x512.png" alt="Yun Jin Icon"><br>
    Mihoyo AutoSign Hub
</h1>


<p align="center">
    <img src="https://img.shields.io/github/license/mastersamasama/Mihoyo-AutoSign-Hub?style=flat-square&color=20b2aa" alt="License">
    <img src="https://img.shields.io/github/stars/mastersamasama/Mihoyo-AutoSign-Hub?style=flat-square&color=ff69b4" alt="Stars">
    <img src="https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js" alt="Node Version">
    <br>
    <b>English</b>　
    <a href="/readme_zh-cn.md">简体中文</a>　
    <a href="/readme_ja-jp.md">日本語</a>
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-configuration-guide">Configuration</a> •
  <a href="#-plugin-ecosystem">Plugins</a> •
  <a href="#-security-notes">Security</a>
</p>

---

## 🌟 Features

- **Automated Check-ins** - Supports all MiHoYo games including Genshin Impact and Honkai: Star Rail
- **Smart Updates** - Auto-update plugins (with local mode option)
- **Multi-Account Management** - Manage multiple game accounts simultaneously
- **Plugin Architecture** - Developer-friendly extensibility ([Docs](doc/pm_development_en-us.md))
- **Real-time Notifications** - Discord/webhook integration
- **Cloud Deployment** - Free daily execution via [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs/quickstart)

---

## 🚀 Quick Start

### Environment Setup

1. Install [Node.js 18+](https://nodejs.org/)
2. Create [Vercel Account](https://vercel.com/signup)
3. Install [pnpm package manager](https://pnpm.io/installation)

```shell
npm install -g pnpm@latest-10
```



### Deployment

```bash
# Clone repository
git clone https://github.com/mastersamasama/Mihoyo-AutoSign-Hub.git
cd Mihoyo-AutoSign-Hub

# Install dependencies
pnpm install

#-------> Configure auto sign hub in /api/config.ts [See Configuration Guide]

# Deploy to Vercel
vercel deploy --prod
```

### Local Testing

```bash
vercel dev
```

---

<a id="-configuration-guide"></a>
## ⚙️ Configuration Guide

### Core Configuration ([config.ts](api/config.ts))

Open `api/config.ts` in your editor

```typescript
import { GlobalConfig } from './types/common.js';
const myLanguage = 'en-us';
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
                        cookies: 'mi18nLang=en-us;_H...' // ****change: your auth cookies
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
                        cookies: 'mi18nLang=en-us;_H...' // ****change: your auth cookies
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
        // Remove below section if not using Discord
        {
            name: 'discord-notify',
            modulePath: '@official/discord-notify.js',
            target: ['*'],
            options: {
                webhook: 'https://discord.com/api/webhooks/...', // ****change: your webhook
                language: 'en', // 'en'/'zh-cn'/'zh-tw'/'ja'/'ko'
                tag_filter: [0],
                mentionUsers: [], // Optional user mentions
            }
        }
    ]
});
```

### Parameter Reference

| Parameter         | Required | Description            | Guide                                                        |
| ----------------- | -------- | ---------------------- | ------------------------------------------------------------ |
| `cookies`         | ✅        | Authentication cookies | [Cookie Guide](doc/how_to_get_cookies_en-us.md)              |
| `discord webhook` | ⚠️        | Notification endpoint  | [Discord Docs](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks) |
| `discord uid`     | ❌        | User ID for mentions   | [User ID Guide](https://support.discord.com/hc/en-us/articles/4407571667351) |

---

## 🔌 Plugin Ecosystem

### Official Plugins

| Plugin            | Description                 | Status       |
| ----------------- | --------------------------- | ------------ |
| Genshin Impact    | Daily reward automation     | ✅ Maintained |
| Honkai: Star Rail | Express Crew daily supplies | ✅ Active     |
| Honkai Impact 3   | Valkyrie daily missions     | 🚧 Developing |

<details> <summary>📘 Advanced Configuration</summary>

### Global Parameters

| Parameter         | Description                                     | Default     | Example                                                      |
| ----------------- | ----------------------------------------------- | ----------- | ------------------------------------------------------------ |
| `plugin_repo`     | Plugin repository template URL                  | -           | `https://github.com/.../plugins`                             |
| `middleware_repo` | Middleware repository template URL              | -           | `https://github.com/.../middlewares`                         |
| `pathResolvers`   | Advanced path resolution rules                  | `@official` | `{ '@custom/': (path) => 'https://custom.domain/' + path.slice(9) }` |
| `plugins`         | [Plugin configurations](#plugin-config)         | Required    | -                                                            |
| `middlewares`     | [Middleware configurations](#middleware-config) | Optional    | -                                                            |

### Plugin Configuration

| Parameter    | Type   | Description              | Example                        |
| ------------ | ------ | ------------------------ | ------------------------------ |
| `name`       | string | Unique identifier        | `'genshin'`                    |
| `modulePath` | string | Location specifier       | `'@official/genshin.js'`       |
| `options`    | object | Plugin-specific settings | `{ users: [], lang: 'en-us' }` |

⚠️ Security Note: Verify third-party plugin sources

### Middleware Configuration

| Parameter    | Type     | Description                       | Example                         |
| ------------ | -------- | --------------------------------- | ------------------------------- |
| `name`       | string   | Unique identifier                 | `'discord-notify'`              |
| `modulePath` | string   | Location specifier                | `'@official/discord-notify.js'` |
| `target`     | string[] | Target plugins (`['*']` = global) | `['genshin']`                   |
| `options`    | object   | Middleware-specific settings      | `{ webhook: '...' }`            |

</details><br>

[Complete Plugin List](doc/plugin_list.md)｜[Developer Docs](doc/pm_development_en-us.md)

---

## 🔒 Security Notes

1. **Sensitive Data Protection**
   - Never expose cookies publicly
   - Use [Vercel Environment Variables](https://vercel.com/docs/cli/env) for secrets

   ```bash
   # Set environment variables
   vercel env add
   Vercel CLI XX.X.X
   ? Variable name? DISCORD_WEBHOOK
   ? Value? https://discord.com/api/webhooks/XXXX....
   ? Apply to which environments? Production, Preview, Development
   ✅ Added Environment Variable
   ```

2. **Regular Updates**
   - Enable auto-updates for security patches

   ```typescript
   // Manual update example
   modulePath: "./plugins/plugin.js"
   ```

---

## 🙌 Contribution Guide

We welcome:

- New plugin development ([Guidelines](doc/pm_development_en-us.md))
- Multi-language support improvements
- Issue reporting

[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](CONTRIBUTING.md)

---

## 📚 Inspired By

- [Hoyolab-auto-sign](https://github.com/canaria3406/hoyolab-auto-sign)
- [Hoyolab daily check-in script](https://www.reddit.com/r/Genshin_Impact/comments/rohk7w/quick_tutorial_for_building_your_own_hoyolab/)
