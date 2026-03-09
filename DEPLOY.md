# EAS Hook 部署到 Vercel 详细教程

## 一、前置准备

1. **Vercel 账号**：前往 [vercel.com](https://vercel.com) 注册
2. **企业微信群机器人**：在目标群聊中添加机器人，获取 Webhook URL
3. **EAS 项目**：已有 Expo 项目并配置好 EAS Build

---

## 二、部署到 Vercel

### 方式 A：通过 Vercel 网页（推荐新手）

1. **推送代码到 GitHub**
   - 在项目目录执行 `git init`（若尚未初始化）
   - 创建 GitHub 仓库并推送代码

2. **导入项目**
   - 登录 [Vercel](https://vercel.com) → 点击 **Add New** → **Project**
   - 选择 **Import Git Repository**，连接你的 GitHub 并选择 `eas-hook` 仓库
   - Framework Preset 选 **Other**，Root Directory 保持默认
   - 点击 **Deploy** 先完成首次部署

3. **配置环境变量**
   - 进入项目 → **Settings** → **Environment Variables**
   - 添加以下变量（Production / Preview / Development 按需勾选）：

   | 变量名 | 值 | 说明 |
   |--------|-----|------|
   | `EAS_WEBHOOK_SECRET` | 你自定义的密钥（≥16 字符） | 与 EAS Webhook 创建时一致 |
   | `WECHAT_WEBHOOK_URL` | `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx` | 企业微信群机器人地址 |

4. **重新部署**
   - 在 **Deployments** 中点击最新部署右侧 **⋯** → **Redeploy**
   - 勾选 **Use existing Build Cache** 可加快速度

5. **获取 Webhook 地址**
   - 部署完成后，项目会得到类似 `https://eas-hook-xxx.vercel.app` 的域名
   - Webhook 完整地址：`https://eas-hook-xxx.vercel.app/api/webhook`

---

### 方式 B：通过 Vercel CLI

1. **安装 Vercel CLI**
   ```bash
   pnpm add -g vercel
   ```

2. **登录**
   ```bash
   vercel login
   ```

3. **首次部署**
   ```bash
   cd 项目目录
   vercel
   ```
   - 按提示选择或创建项目
   - 首次会生成预览地址，如 `https://eas-hook-xxx.vercel.app`

4. **配置环境变量**
   ```bash
   vercel env add EAS_WEBHOOK_SECRET
   vercel env add WECHAT_WEBHOOK_URL
   ```
   按提示输入值，并选择应用到 Production。

5. **生产环境部署**
   ```bash
   pnpm deploy
   ```

---

## 三、配置 EAS Webhook

1. **生成并记录密钥**
   - 使用至少 16 字符的随机字符串，例如：
     ```powershell
     # Windows PowerShell
     [Convert]::ToBase64String((1..24 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
     ```
   - 或手动设置，如：`my_super_secret_key_2024`

2. **在 Expo 项目中创建 Webhook**
   ```bash
   cd 你的Expo项目目录
   eas webhook:create --event build --url https://你的项目.vercel.app/api/webhook --secret 上面设置的密钥
   ```

3. **确认密钥一致**
   - `eas webhook:create --secret xxx` 中的 `xxx`
   - 必须与 Vercel 环境变量 `EAS_WEBHOOK_SECRET` 完全一致

---

## 四、获取企业微信 Webhook URL

1. 在企业微信群聊中，点击右上角 **⋯** → **添加群机器人**
2. 新建机器人，设置名称（如「EAS 构建通知」）
3. 复制生成的 Webhook 地址，格式类似：
   ```
   https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ```
4. 将该地址填入 Vercel 环境变量 `WECHAT_WEBHOOK_URL`

---

## 五、验证部署

1. **健康检查**
   ```bash
   curl https://你的项目.vercel.app/api/health
   ```
   应返回 `{"ok":true}`

2. **触发一次 EAS 构建**
   ```bash
   eas build --platform android --profile preview
   ```
   构建成功后，企业微信群应收到带二维码和下载链接的通知。

---

## 六、常见问题

| 问题 | 处理方式 |
|------|----------|
| 签名校验失败 | 检查 `EAS_WEBHOOK_SECRET` 与 `eas webhook:create --secret` 是否完全一致 |
| 企业微信收不到消息 | 检查 `WECHAT_WEBHOOK_URL` 是否正确，机器人是否仍在群内 |
| 部署后 500 错误 | 在 Vercel 项目 → Deployments → 点击部署 → **Functions** 查看日志 |
| 超时 | 免费版函数最长 10 秒，一般足够；若仍超时可考虑升级 Pro |

---

## 七、项目结构

```
eas-hook/
├── api/
│   ├── webhook.js   # EAS Webhook 入口，部署为 /api/webhook
│   └── health.js    # 健康检查，部署为 /api/health
├── vercel.json      # Vercel 配置
├── package.json
└── DEPLOY.md
```
