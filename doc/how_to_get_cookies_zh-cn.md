# **如何获取米哈游游戏Cookies**

⚠️ **重要安全提醒**
 🔐 Cookies相当于您的账户密码！
 🚫 **切勿与任何人分享您的Cookies**
 ⏳ Cookies将在以下情况下失效：

- **手动登出**
- **更改密码**
- **长时间未活动**

------

## **✅ 安全获取Cookies的方法**

### **推荐的浏览器设置**

```diff
+ 使用无痕/隐私浏览模式  
+ 在操作前关闭所有其他网页标签  
- 避免使用普通浏览模式  
- 获取Cookies后请勿主动登出  
```

------

## 📋 **前置准备**

- **Chrome/Firefox/Edge浏览器**
- **已登录的HoYoLAB账号**

------

## 🛠 **详细操作指南**

### **1. 访问每日签到页面**

1. 打开HoYoLAB每日签到
2. 选择您的游戏
3. **先不要点击签到！！！** —— 我们需要捕获签到请求

------

### **2. 打开浏览器开发者工具**

| 浏览器      | 快捷键                  |
| ----------- | ----------------------- |
| Chrome/Edge | `F12` 或 `Ctrl+Shift+I` |
| Firefox     | `Ctrl+Shift+C`          |
| Safari      | `开发 > 显示Web检查器`  |

![inspector](picture/inspector.png)

------

### **3. 监听网络请求**

1. 切换到 **Network（网络）** 选项卡
2. 勾选 **Preserve log（保持日志）**

![inspector](picture/network_inspect.png)

------

### **4. 触发签到请求**

1. **点击签到按钮**

2. 在网络请求中寻找符合以下规则的请求：

   ```text
   /sign?lang=
   ```

------

### **5. 提取Cookies**

1. **点击签到相关的请求**
2. **进入“Headers（请求头）”选项卡**
3. **找到“Request Headers（请求头）”下的“Cookie”字段**
4. **复制完整的Cookies内容**

![sign](picture/cookies.png)

------

## 🛠 **获取Cookies后的配置步骤**

1. 将Cookies粘贴到配置文件中：

   ```typescript
   // /api/config.ts
   {
     plugins: [
       {
         name: 'genshin',
         modulePath: "@official/genshin.js",
         options: {
           users: [{
             cookies: 'PASTE_COOKIES_HERE' // ← 在此处粘贴Cookies
           }]
         }
       }
     ]
   }
   ```

2. **通用Cookies说明：**

   ```diff
   + 一个Cookies可适用于所有米哈游游戏  
   + 适用于以下游戏：  
     - 原神  
     - 崩坏：星穹铁道  
     - 绝区零  
     - 以及其他米哈游游戏  
   - 无需为每款游戏单独获取Cookies  
   ```

