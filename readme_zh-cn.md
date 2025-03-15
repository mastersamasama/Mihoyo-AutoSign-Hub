<h1 align="center">
    <img width="120" height="120" src="doc/picture/yun-jin-512x512.png" alt="云堇图标"><br>
    Mihoyo AutoSign Hub 米哈游智签中枢
</h1>


<p align="center">
    <img src="https://img.shields.io/github/license/mastersamasama/Mihoyo-AutoSign-Hub?style=flat-square&color=20b2aa" alt="许可证">
    <img src="https://img.shields.io/github/stars/mastersamasama/Mihoyo-AutoSign-Hub?style=flat-square&color=ff69b4" alt="星标数">
    <img src="https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js" alt="Node版本">
    <br>
    <b>简体中文</b>　
    <a href="/readme.md">English</a>　
    <a href="/readme_ja-jp.md">日本語</a>
</p>


<p align="center">
  <a href="#特性">特性</a> •
  <a href="#快速开始">快速开始</a> •
  <a href="#配置指南">配置指南</a> •
  <a href="#插件生态">插件生态</a> •
  <a href="#安全提示">安全提示</a>
</p>

---

## 🌟 特性

- **自动化签到** - 支持原神、星穹铁道等米哈游全家桶游戏
- **智能更新** - 自动获取最新插件（可切换为本地模式）
- **多账号管理** - 支持同时管理多个游戏账号
- **插件化架构** - 开发者友好，轻松扩展新功能，欢迎各位开发者pr好用的插件 ([开发文档](doc/pm_development_zh-cn.md))
- **即时通知** - 集成Discord/webhook通知系统
- **云端部署** - 免费使用[Vercel Functions](https://vercel.com/docs/functions)的定时触发([Cron Jobs](https://vercel.com/docs/cron-jobs/quickstart))进行每日签到

---

## 🚀 快速开始

### 环境准备
1. 安装 [Node.js 18+](https://nodejs.org/)
2. 注册 [Vercel 账号](https://vercel.com/signup)

### 部署步骤

```bash
# 克隆仓库
git clone https://github.com/mastersamasama/Mihoyo-AutoSign-Hub.git
cd Mihoyo-AutoSign-Hub

# 安装依赖
pnpm install

# 部署到Vercel
vercel deploy --prod
```



### 本地调试

```bash
vercel dev
```

---

## ⚙️ 配置指南

### 核心配置（config.ts）
```typescript
import { GlobalConfig } from './types/common.js';
const myLanguage = 'zh-cn';
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
                        cookies: 'mi18nLang=zh-tw;_H...' // ****change: cookies that include your login info
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
                        cookies: 'mi18nLang=zh-tw;_H...' // ****change: cookies that include your login info
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
       	// if you don't want to use discord-notify
        // delete form here ---------
        {
            name: 'discord-notify',
            modulePath: '@official/discord-notify.js',
            target: ['*'],
            options: {
                webhook: 'https://discord.com/api/webhooks/...', // ****change: your discord webhook
                language: myLanguage, // support 'en', 'zh-cn', 'zh-tw', 'ja', 'ko', default is 'en'
                tag_filter: [0], 
                mentionUsers: [], // change(optional): @ you in discord when fail
            }
        }
        // --------- to here
    ]
});
```

### 参数说明表

| 参数            | 必填 | 说明                       | 获取指南                                                     |
| --------------- | ---- | -------------------------- | ------------------------------------------------------------ |
| cookies         | ✅    | 包含登录状态的Cookie字符串 | [Cookie获取教程](doc/how_to_get_cookies_zh-cn.md)            |
| discord webhook | ⚠️    | Discord通知地址            | [Discord文档](https://support.discord.com/hc/zh-tw/articles/228383668-%E4%BD%BF%E7%94%A8%E7%B6%B2%E7%B5%A1%E9%89%A4%E6%89%8B-Webhooks) |
| discord uid     | ❌    | 用户ID（用于@通知）        | [Discord用户ID指南](https://support.discord.com/hc/zh-tw/articles/4407571667351) |

---

## 🔌 插件生态

### 官方插件列表

| 插件名称     | 功能描述             | 维护状态 |
| ------------ | -------------------- | -------- |
| 原神签到     | 每日游戏奖励自动领取 | ✅ 维护中 |
| 星穹铁道签到 | 列车乘员每日补给     | ✅ 活跃   |
| 崩坏3签到    | 女武神的日常补给     | 🚧 开发中 |

<details> <summary>📘 高级配置说明（点击展开）</summary>

### 全局配置参数

| 参数              | 说明                                         | 默认值      | 示例值                                                       |
| ----------------- | -------------------------------------------- | ----------- | ------------------------------------------------------------ |
| `plugin_repo`     | 官方插件仓库模板URL，`${filename}`会自动替换 | -           | `https://github.com/.../plugins`                             |
| `middleware_repo` | 官方中间件仓库模板URL                        | -           | `https://github.com/.../middlewares`                         |
| `pathResolvers`   | 高级路径解析规则 (需开发经验)                | `@official` | `{ '@custom/': (path) => 'https://custom.domain/' + path.slice(9) }` |
| `plugins`         | [插件配置列表](#插件配置说明)                | 必填        | -                                                            |
| `middlewares`     | [中间件配置列表](#中间件配置说明)            | 可选        | -                                                            |

### 插件配置说明

| 参数         | 类型   | 说明                                                         | 示例值                                                  |
| ------------ | ------ | ------------------------------------------------------------ | ------------------------------------------------------- |
| `name`       | string | 插件唯一标识                                                 | `'genshin'`                                             |
| `modulePath` | string | 插件位置：<br>- 本地路径：`./plugins/genshin.js`<br>- 官方仓库：`@official/genshin.js`<br>- 自定义URL：`https://...` | `'@official/genshin.js'`                                |
| `options`    | object | 插件专用配置                                                 | `{ users: [{ cookies: 'your_token' }], lang: 'zh-cn' }` |

⚠️ 安全提示：使用第三方插件前请验证来源可靠性

### 中间件配置说明

| 参数         | 类型     | 说明                                                         | 示例值                                                       |
| ------------ | -------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `name`       | string   | 中间件唯一标识                                               | `'discord-notify'`                                           |
| `modulePath` | string   | 中间件位置：<br>- 本地路径：`./middlewares/notify.js`<br>- 官方仓库：`@official/notify.js` | `'@official/discord-notify.js'`                              |
| `target`     | string[] | 作用的目标插件名称列表，`['*']`表示全局应用                  | `['genshin', 'starrail']`                                    |
| `options`    | object   | 中间件专用配置                                               | `{ webhook: 'https://discord.com/...', mentionUsers: ['USER_ID'] }` |

</details><br>



[查看完整插件列表](doc/plugin_list.md)｜[开发者文档](doc/pm_development_zh-cn.md)

---



## 🔒 安全提示

1. **敏感信息保护**
   
   - 不要公开分享你的Cookie
   - 使用[Vercel环境变量](https://vercel.com/docs/cli/env)存储敏感信息
   ```bash
   # vercel环境变量设置
   vercel env add
   Vercel CLI XX.X.X
   ? What's the name of the variable? DISCORD_WEBHOOK
   ? What's the value of DISCORD_WEBHOOK? https://discord.com/api/webhooks/XXXX/....
   ? Add DISCORD_WEBHOOK to which Environments (select multiple)? Production, Preview, Development
   ✅  Added Environment Variable DISCORD_WEBHOOK to Project vercel-project-name [404ms]
   ```
   
3. **定期更新**
   - 建议开启自动更新获取安全补丁
   ```typescript
   // 禁用自动更新示例
   modulePath: "./plugins/plugin.js"
   ```

---

## 🙌 贡献指南

欢迎通过以下方式参与项目：
- 提交新插件（参考[开发文档](doc/pm_development_zh-cn.md)）
- 完善多语言支持
- 提交Issue反馈问题

[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](CONTRIBUTING.md)

---

## 📚 参考项目

- [Hoyolab-auto-sign](https://github.com/canaria3406/hoyolab-auto-sign)
- [Hoyolab daily check-in script](https://www.reddit.com/r/Genshin_Impact/comments/rohk7w/quick_tutorial_for_building_your_own_hoyolab/)