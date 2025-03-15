

<h1 align="center">
    <img width="120" height="120" src="doc/picture/yun-jin-512x512.png" alt="雲菫アイコン"><br>
    Mihoyo AutoSign Hub miHoYo自動サインインシステム
</h1>
<p align="center">
    <img src="https://img.shields.io/github/license/mastersamasama/Mihoyo-AutoSign-Hub?style=flat-square&color=20b2aa" alt="ライセンス">
    <img src="https://img.shields.io/github/stars/mastersamasama/Mihoyo-AutoSign-Hub?style=flat-square&color=ff69b4" alt="スター数">
    <img src="https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js" alt="Nodeバージョン">
    <br>
    <b>日本語</b>　
    <a href="/readme.md">English</a>　
    <a href="/readme_zh-cn.md">简体中文</a>
</p>


<p align="center">
  <a href="#特徴">特徴</a> •
  <a href="#クイックスタート">クイックスタート</a> •
  <a href="#設定ガイド">設定ガイド</a> •
  <a href="#プラグインエコシステム">プラグインエコシステム</a> •
  <a href="#セキュリティ注意事項">セキュリティ注意事項</a>
</p>

---

## 🌟 特徴

- **自動チェックイン** - 原神、崩壊：スターレイルなどmiHoYoゲーム対応
- **スマートアップデート** - プラグイン自動更新機能（ローカルモード切替可能）
- **マルチアカウント管理** - 複数アカウント同時管理
- **プラグインアーキテクチャ** - 開発者向け拡張可能設計（[開発者向けドキュメント](doc/pm_development_ja-jp.md)）
- **リアルタイム通知** - Discord/Webhook通知統合
- **クラウドデプロイ** - [Vercel Functions](https://vercel.com/docs/functions)の定期実行（[Cron Jobs](https://vercel.com/docs/cron-jobs/quickstart)）を無料で利用

---

## 🚀 クイックスタート

### 環境準備
1. [Node.js 18+](https://nodejs.org/) をインストール
2. [Vercelアカウント](https://vercel.com/signup) を作成

### デプロイ手順
```bash
# リポジトリをクローン
git clone https://github.com/mastersamasama/Mihoyo-AutoSign-Hub.git
cd Mihoyo-AutoSign-Hub

# 依存関係をインストール
pnpm install

# Vercelにデプロイ
vercel deploy --prod
```

### ローカルテスト

```bash
vercel dev
```

---

## ⚙️ 設定ガイド

### コア設定（config.ts）
```typescript
import { GlobalConfig } from './types/common.js';
const myLanguage = 'ja-jp';
export const getConfig = (): GlobalConfig => ({
    plugin_repo: "https://github.com/mastersamasama/Mihoyo-AutoSign-Hub/raw/main/api/plugins",
    middleware_repo: "https://github.com/mastersamasama/Mihoyo-AutoSign-Hub/raw/main/api/middlewares",
    plugins: [
        {
            name: 'genshin',
            modulePath: "@official/genshin.js",
            options: {
                users: [{
                    cookies: 'mi18nLang=ja;_H...' // ****変更: ログイン情報を含むCookie
                }],
                lang: myLanguage,
            }
        },
        {
            name: 'star rail',
            modulePath: "@official/starrail.js",
            options: {
                users: [{
                    cookies: 'mi18nLang=ja;_H...' // ****変更: ログイン情報を含むCookie
                }],
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
            target: ['*'],
            options: {
                webhook: 'https://discord.com/api/webhooks/...', // ****変更: Discord Webhook URL
                language: 'ja', // サポート言語: 'en', 'ja', 'zh-cn', 'zh-tw', 'ko'
                tag_filter: [0], 
                mentionUsers: [], // オプション: 失敗時にメンションするユーザーID
            }
        }
    ]
});
```

### パラメータ説明表
| パラメータ      | 必須 | 説明                           | 取得方法ガイド                                               |
| --------------- | ---- | ------------------------------ | ------------------------------------------------------------ |
| cookies         | ✅    | ログイン状態を含むCookie文字列 | [Cookie取得ガイド](doc/how_to_get_cookies_ja-jp.md)          |
| discord webhook | ⚠️    | Discord通知URL                 | [Discord Webhookガイド](https://support.discord.com/hc/ja/articles/228383668) |
| discord uid     | ❌    | ユーザーID（メンション用）     | [DiscordユーザーID確認方法](https://support.discord.com/hc/ja/articles/4407571667351) |

---

## 🔌 プラグインエコシステム

### 公式プラグインリスト
| プラグイン名       | 機能説明                 | メンテナンス状況 |
| ------------------ | ------------------------ | ---------------- |
| 原神チェックイン   | デイリー報酬自動受取     | ✅ メンテナンス中 |
| 崩壊：スターレイル | デイリー補給品自動受取   | ✅ アクティブ     |
| 崩壊3rd            | ヴァルキリーデイリー補給 | 🚧 開発中         |

<details>
<summary>📘 詳細設定説明（クリックで展開）</summary>

### グローバル設定パラメータ
| パラメータ        | 説明                          | デフォルト  | 例                                                           |
| ----------------- | ----------------------------- | ----------- | ------------------------------------------------------------ |
| `plugin_repo`     | 公式プラグインリポジトリURL   | -           | `https://.../plugins`                                        |
| `middleware_repo` | 公式ミドルウェアリポジトリURL | -           | `https://.../middlewares`                                    |
| `pathResolvers`   | パス解決ルール                | `@official` | `{ '@custom/': (path) => 'https://custom.domain/' + path.slice(9) }` |
| `plugins`         | プラグイン設定リスト          | 必須        | -                                                            |
| `middlewares`     | ミドルウェア設定リスト        | オプション  | -                                                            |

### プラグイン設定詳細
| パラメータ   | 型     | 説明               | 例                                                      |
| ------------ | ------ | ------------------ | ------------------------------------------------------- |
| `name`       | string | プラグイン識別子   | `'genshin'`                                             |
| `modulePath` | string | プラグインの場所   | `'@official/genshin.js'`                                |
| `options`    | object | プラグイン固有設定 | `{ users: [{ cookies: 'your_token' }], lang: 'zh-cn' }` |

⚠️ セキュリティ注意：サードパーティプラグイン使用時は信頼性を確認してください

### ミドルウェア設定詳細
| パラメータ   | 型       | 説明                     | 例                        |
| ------------ | -------- | ------------------------ | ------------------------- |
| `name`       | string   | ミドルウェア識別子       | `'discord-notify'`        |
| `modulePath` | string   | ミドルウェアの場所       | `'@official/notify.js'`   |
| `target`     | string[] | 適用対象プラグインリスト | `['genshin', 'starrail']` |
| `options`    | object   | ミドルウェア固有設定     | Webhook設定例             |

</details><br>

[全プラグインリストを確認](doc/plugin_list.md)｜[開発者向けドキュメント](doc/pm_development_ja-jp.md)

---

## 🔒 セキュリティ注意事項

1. **機密情報の保護**
   - Cookieを公開しないでください
   - [Vercel環境変数](https://vercel.com/docs/cli/env)を活用

   ```bash
   # Vercel環境変数設定例
   vercel env add
   ? 変数名を入力: DISCORD_WEBHOOK
   ? 変数の値を入力: https://discord.com/api/webhooks/XXXX/....
   ? 環境を選択: Production, Preview, Development
   ✅  vercel-project-name に環境変数を追加 [404ms]
   ```

2. **定期的な更新**
   - セキュリティパッチ適用のため自動更新を推奨

   ```typescript
   // 自動更新無効化例
   modulePath: "./plugins/plugin.js"
   ```

---

## 🙌 貢献ガイド

以下の方法でプロジェクトに参加できます：
- 新規プラグインの開発（[開発ガイド](doc/pm_development_ja-jp.md)）
- 多言語サポートの改善
- Issue報告による問題提起

[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](CONTRIBUTING_JA.md)

---

## 📚 参考プロジェクト

- [Hoyolab-auto-sign](https://github.com/canaria3406/hoyolab-auto-sign)
- [Hoyolab daily check-in script](https://www.reddit.com/r/Genshin_Impact/comments/rohk7w/quick_tutorial_for_building_your_own_hoyolab/)