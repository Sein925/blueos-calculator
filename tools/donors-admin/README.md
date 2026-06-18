# 打赏名单管理后台

图形化编辑 `src/assets/data/donors.json`，支持两种运行模式：

- **本地模式**（默认）：Express + 直接读写本地文件
- **GitHub 模式**：Vercel Serverless + GitHub Contents API（前端不接触 Token）

## 目录结构

```
tools/donors-admin/
├── api/              # Vercel Serverless Functions（部署到 Vercel 时使用）
│   ├── auth.js
│   ├── donors.js
│   └── health.js
├── lib/              # 共享逻辑（校验/鉴权/存储抽象）
│   ├── auth.js
│   ├── donors.js
│   └── store.js
├── public/           # 静态前端
│   ├── app.js
│   ├── index.html
│   └── style.css
├── server.js         # 本地开发用的 Express
├── vercel.json       # Vercel 配置
├── .env.example      # 环境变量样例
└── package.json
```

## 本地开发

```bash
cd tools/donors-admin
pnpm install
pnpm start
```

打开 http://localhost:4310，使用控制台打印的 Token 登录。默认读写项目根目录的 `src/assets/data/donors.json`。

如要在本地走 GitHub 模式（便于调试），把 `.env.example` 复制为 `.env` 并填好：

```bash
cp .env.example .env
# 编辑 .env，至少填好 ADMIN_TOKEN / GITHUB_TOKEN / GITHUB_REPO
pnpm start
```

## 部署到 Vercel

### 1. 准备 GitHub Fine-grained PAT

为了「最小权限」，推荐使用 Fine-grained PAT：

1. 打开 https://github.com/settings/personal-access-tokens/new
2. **Repository access**：选 **Only select repositories**，选你的 `blueos-calculator` 仓库
3. **Permissions → Repository permissions → Contents**：勾选 **Read and Write**
4. 生成后复制 Token（只显示一次）

### 2. 在 Vercel 创建项目

1. 打开 https://vercel.com/new
2. **Import** 你的 `blueos-calculator` 仓库
3. **Project Name** 任意
4. **Root Directory** 点 Edit，改成 `tools/donors-admin`（关键：避免把整个手环 app 都上传）
5. **Framework Preset** 选 `Other`
6. **Build & Output Settings** 保持默认（Vercel 会自动识别 `api/` 为 Functions，`public/` 为静态资源）
7. 点 **Deploy**

### 3. 配置环境变量

部署完成后到 **Project Settings → Environment Variables**，添加：

| 名称 | 值 | 说明 |
|------|----|----|
| `ADMIN_TOKEN` | 一个长随机字符串 | 前端登录用，自己定 |
| `GITHUB_TOKEN` | 第 1 步生成的 PAT | 服务端调用 GitHub API |
| `GITHUB_REPO` | `你的用户名/blueos-calculator` | 目标仓库 |
| `GITHUB_BRANCH` | `main` | 默认 main，可改 |
| `GITHUB_FILE_PATH` | `src/assets/data/donors.json` | 默认值，可省略 |
| `COMMIT_MESSAGE` | `chore(donors): update donors list [skip ci]` | 默认值，可省略（`[skip ci]` 避免触发 CI） |

保存后到 **Deployments** 重新部署一次让环境变量生效。

### 4. 访问

打开 Vercel 给你的域名（例如 `https://donors-admin-xxx.vercel.app`），输入 `ADMIN_TOKEN` 登录。

- 顶部会显示当前存储模式：`☁ your-name/blueos-calculator@main`（GitHub 模式）或 `💾 本地文件`（仅本地）
- 修改后点 **保存到 donors.json** → 服务端会通过 GitHub API 直接 commit 一个新版本到 `src/assets/data/donors.json`
- 手环 app 重新构建时就会拿到最新名单

## API 文档

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET  | `/api/donors`  | 否 | 读取完整名单 |
| PUT  | `/api/donors`  | **Admin Token** | 整体覆盖写入 |
| POST | `/api/auth`    | 否 | 校验 Token |
| GET  | `/api/health`  | 否 | 健康检查 + 当前存储信息 |

PUT/POST 请求需在 Header `X-Token` 或 body `token` 中携带 `ADMIN_TOKEN`。

### curl 示例

```bash
# 读取
curl https://your-app.vercel.app/api/donors

# 写入
curl -X PUT https://your-app.vercel.app/api/donors \
  -H "Content-Type: application/json" \
  -H "X-Token: $ADMIN_TOKEN" \
  -d '{"data":[{"a":"10.00","n":["*饭"]}]}'
```

## 数据格式

```json
[
  { "a": "10.00", "n": ["*饭"] },
  { "a": "6.88", "n": ["用户A", "用户B", "用户C"] }
]
```

- `a`：金额（数字字符串，保留 2 位小数）
- `n`：该金额下的支持者数组（每条记录保存后会去空白/去空名/金额归一化）

## 安全建议

- **不要**把 `ADMIN_TOKEN` 或 `GITHUB_TOKEN` 提交到仓库（`.env` 已在 `.gitignore` 范围之外，请确保仓库根 `.gitignore` 也已忽略）
- PAT 使用 Fine-grained + Contents 写入权限，**不要**给整个 `repo` 权限
- 如果不需要外部访问，可以在 Vercel 项目设置里加 **Password Protection**（Hobby 计划不支持，但可使用 Cloudflare Access 等零成本方案）
- 提交信息里的 `[skip ci]` 关键字可避免手环项目 CI 被频繁触发，如不需要可去掉
