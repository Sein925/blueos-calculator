# 打赏名单管理后台

图形化编辑 `donors.json`，支持三种存储后端：

- **Vercel KV**（推荐生产）：Vercel 自带 Redis 数据库，零配置 Token
- **GitHub Contents API**（兼容）：仍然把数据写回仓库
- **本地文件**（开发）：`pnpm start` 直接读写 `src/assets/data/donors.json`

存储优先级：**Vercel KV → GitHub → 本地文件**
（即：只要设了 `KV_REST_API_URL` / `KV_REST_API_TOKEN`，就走 KV）

如果同时设置了 `KV_*` 与 `GITHUB_*`，保存时**既写 KV 也推 GitHub**（保持手环 app 那边的 `donors.json` 与云端 KV 一致）。

## 目录结构

```
tools/donors-admin/
├── api/              # Vercel Serverless Functions
│   ├── auth.js
│   ├── donors.js
│   └── health.js
├── lib/              # 共享逻辑（校验/鉴权/存储抽象）
│   ├── auth.js
│   ├── donors.js
│   └── store.js
├── public/           # 静态前端（已适配移动端）
│   ├── app.js
│   ├── index.html
│   └── style.css
├── server.js         # 本地开发用的 Express
├── vercel.json       # Vercel 配置（不要修改）
├── .env.example      # 环境变量样例
└── package.json
```

## 本地开发

```bash
cd tools/donors-admin
pnpm install
pnpm start
```

打开 http://localhost:4310，使用控制台打印的 Token 登录。默认读写 `src/assets/data/donors.json`。

## 部署到 Vercel（推荐：Vercel KV）

### 1. 创建 Vercel KV 数据库

1. 进入 Vercel 项目 → **Storage** 标签
2. 点 **Create Database** → 选 **KV**（Upstash Redis）
3. 名字随意（例 `donors-kv`），区域选离你最近的
4. 点 **Create**
5. 切到 **`.env.local`** 标签，把里面的环境变量复制出来
   - 至少要 `KV_REST_API_URL` 和 `KV_REST_API_TOKEN`

> 创建后 Vercel 会**自动**把这些变量注入到项目的 **Production / Preview / Development** 三个环境，不需要你手动到 Settings 加。

### 2. 在 Vercel 创建项目

1. 打开 https://vercel.com/new
2. **Import** 你的 `blueos-calculator` 仓库
3. **Root Directory** 点 Edit，改成 `tools/donors-admin`（关键：避免把整个手环 app 都上传）
4. **Framework Preset** 选 `Other`
5. 点 **Deploy**

### 3. 配置登录 Token

部署完成后到 **Project Settings → Environment Variables**，添加：

| 名称 | 值 | 说明 |
|------|----|----|
| `ADMIN_TOKEN` | 一个长随机字符串 | 前端登录用，自己定（如 `openssl rand -hex 16`） |

> `KV_*` 系列环境变量在第 1 步创建 KV 数据库后 Vercel 会自动注入，无需手动添加。

保存后到 **Deployments** 重新部署一次让环境变量生效。

### 4. （可选）启用 GitHub 同步

如果你希望保存时也自动把 `donors.json` 推到 GitHub（让手环 app 的 `donors.json` 与云端保持同步），再多加几个环境变量：

| 名称 | 值 | 说明 |
|------|----|----|
| `GITHUB_TOKEN` | Fine-grained PAT（Contents: R/W） | 见下 |
| `GITHUB_REPO` | `你的用户名/blueos-calculator` | |
| `GITHUB_BRANCH` | `main` | 可省略 |
| `GITHUB_FILE_PATH` | `src/assets/data/donors.json` | 可省略 |
| `COMMIT_MESSAGE` | `chore(donors): update donors list [skip ci]` | 可省略 |

生成 Fine-grained PAT：
1. 打开 https://github.com/settings/personal-access-tokens/new
2. **Repository access** → **Only select repositories** → 选 `blueos-calculator`
3. **Permissions → Repository permissions → Contents** → **Read and Write**
4. 生成，复制

### 5. 访问

打开 Vercel 给的域名，输入 `ADMIN_TOKEN` 登录。

- 顶部会显示当前存储模式：
  - `☁ Vercel KV`：纯 KV
  - `☁ KV + GitHub`：KV 主存，同时推 GitHub
  - `☁ your-name/repo@main`：纯 GitHub
  - `💾 本地文件`：仅本地开发
- 修改后点 **保存到 donors.json** → 数据进入 Vercel KV
- 若启用了 GitHub 同步，仓库的 `src/assets/data/donors.json` 也会被 commit 一次

## API 文档

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET  | `/api/donors`  | 否 | 读取完整名单（返回 `{ ok, data }`，`data` 即 donors.json 的数组内容）|
| PUT  | `/api/donors`  | **Admin Token** | 整体覆盖写入 |
| POST | `/api/auth`    | 否 | 校验 Token |
| GET  | `/api/health`  | 否 | 健康检查 + 当前存储信息 |

PUT/POST 请求需在 Header `X-Token` 或 body `token` 中携带 `ADMIN_TOKEN`。

### curl 示例

```bash
# 读取（返回与 donors.json 等价的数据）
curl https://your-app.vercel.app/api/donors
# => {"ok":true,"data":[{"a":"10.00","n":["*饭"]}, ...]}

# 写入
curl -X PUT https://your-app.vercel.app/api/donors \
  -H "Content-Type: application/json" \
  -H "X-Token: $ADMIN_TOKEN" \
  -d '{"data":[{"a":"10.00","n":["*饭"]}]}'

# 健康检查
curl https://your-app.vercel.app/api/health
# => {"ok":true,"storage":{"mode":"kv","key":"donors:data","githubSync":false}}
```

## 数据格式

```json
[
  { "a": "10.00", "n": ["*饭"] },
  { "a": "6.88", "n": ["用户A", "用户B", "用户C"] }
]
```

- `a`：金额（数字字符串，保留 2 位小数）
- `n`：该金额下的支持者数组（保存时会去空白/去空名/金额归一化）

## 安全建议

- **不要**把 `ADMIN_TOKEN` / `GITHUB_TOKEN` 提交到仓库（`tools/donors-admin/.env` 已在仓库根 `.gitignore` 范围之外）
- Vercel KV 凭据由 Vercel 自动注入，前端/浏览器**永远拿不到**
- Fine-grained PAT 只授予 `blueos-calculator` 单仓库 + Contents 写入
- 提交信息里的 `[skip ci]` 关键字可避免手环项目 CI 被频繁触发

## 常见问题

**Q: Vercel KV 里的数据会丢吗？**
A: Vercel KV（基于 Upstash Redis）默认 256MB 持久存储，不会因为函数冷启动丢失。Vercel Hobby 计划有每月 30 万次请求额度，对本项目绰绰有余。

**Q: 不启用 GitHub 同步，手环 app 怎么拿到最新名单？**
A: 需要单独为手环 app 增加一个从 API 拉取名单的机制（带 Token）。或者保持 GitHub 同步开启，最简单。

**Q: 想彻底用 KV 不再用 GitHub？**
A: 不设 `GITHUB_TOKEN` 即可。前端标签会显示 `☁ Vercel KV`。
