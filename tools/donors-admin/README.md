# 打赏名单管理后台

图形化编辑打赏名单，**仅使用 Vercel KV**（基于 Upstash Redis）作为存储后端。

- **Vercel KV**（唯一存储）：数据存于云端 KV，跨部署持久
- 管理端：Vercel 上的 Serverless Functions + 静态前端
- 手表 app：构建时打包本地 `donors.json` 作为兜底，运行时可通过 API 拉取最新

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
│   └── store.js      # 仅 Vercel KV
├── public/           # 静态前端（已适配移动端）
│   ├── app.js
│   ├── index.html
│   └── style.css
├── vercel.json       # Vercel 配置
├── .env.example      # 环境变量样例
└── package.json
```

KV 中的 key：

| Key | 内容 |
|-----|------|
| `donors:data` | 主数据 `Array<{ a, n }>` |
| `donors:meta` | 元信息 `{ updatedAt, count }` |

## 本地开发

> ⚠️ 存储层只支持 Vercel KV，本地无法直接通过文件读写。
> 推荐使用 Vercel CLI 在本地模拟：

```bash
cd tools/donors-admin
pnpm install
pnpm dlx vercel login              # 首次登录
pnpm dlx vercel link                # 关联 Vercel 项目
pnpm dlx vercel env pull .env.local # 拉取 KV 环境变量到本地
pnpm dev                            # 启动 vercel dev（自带本地 KV）
```

打开 http://localhost:3000，使用 `.env.local` 里的 `ADMIN_TOKEN` 登录。

## 部署到 Vercel

### 1. 创建 Vercel KV 数据库

1. 进入 Vercel 项目 → **Storage** 标签
2. 点 **Create Database** → 选 **KV**
3. 名字随意（例 `donors-kv`），区域选离你最近的
4. 创建后 Vercel 会**自动注入** `KV_REST_API_URL` / `KV_REST_API_TOKEN` 三个环境

### 2. 创建项目（如尚未创建）

1. 打开 https://vercel.com/new
2. **Import** 你的仓库
3. **Root Directory** 改成 `tools/donors-admin`（关键：避免把整个手环 app 都上传）
4. **Framework Preset** 选 `Other`
5. 点 **Deploy**

### 3. 配置登录 Token

**Project → Settings → Environment Variables**，添加：

| 名称 | 值 | 说明 |
|------|----|----|
| `ADMIN_TOKEN` | 一个长随机字符串 | 前端登录用，自己定（如 `openssl rand -hex 16`）|

`KV_*` 系列变量在第 1 步创建后 Vercel 已自动注入。

保存后到 **Deployments** 重新部署一次让环境变量生效。

### 4. 访问

打开 Vercel 给的域名，输入 `ADMIN_TOKEN` 登录。

- 顶栏显示 `☁ Vercel KV`
- 修改后点 **保存到 donors.json** → 数据写入 KV，同时更新 `donors:meta.updatedAt`

## API 文档

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET  | `/api/donors`  | 否 | 读取名单（**默认按金额降序 + 过滤 < 1 元**；?all=1 拿全量） |
| PUT  | `/api/donors`  | **Admin Token** | 整体覆盖写入 |
| POST | `/api/auth`    | 否 | 校验 Token |
| GET  | `/api/health`  | 否 | 健康检查 + 当前存储信息 |

PUT/POST 请求需在 Header `X-Token` 或 body `token` 中携带 `ADMIN_TOKEN`。

### GET /api/donors 查询参数

| 参数 | 默认 | 说明 |
|------|------|------|
| `?all=1` | — | 跳过排序与过滤，返回原始全量数据（管理端 / 手表 app 拉取用）|
| `?minAmount=N` | `1` | 自定义金额阈值，仅返回 `a >= N` 的条目（与 `?all=1` 互斥）|

响应体：

```json
{
  "ok": true,
  "data": [...],
  "meta": {
    "total": 15,
    "returned": 12,
    "filtered": 3,
    "minAmount": 1,
    "updatedAt": "2024-01-01T12:34:56.789Z"
  }
}
```

> 写入（PUT）**不应用任何过滤**，KV 中始终保留完整名单。

### curl 示例

```bash
# 读取（默认：按金额降序，过滤 < 1 元）
curl https://your-app.vercel.app/api/donors

# 读取全量（手表 app 拉取用）
curl https://your-app.vercel.app/api/donors?all=1

# 健康检查
curl https://your-app.vercel.app/api/health
# => {"ok":true,"storage":{"mode":"kv","key":"donors:data","metaKey":"donors:meta"}}

# 写入
curl -X PUT https://your-app.vercel.app/api/donors \
  -H "Content-Type: application/json" \
  -H "X-Token: $ADMIN_TOKEN" \
  -d '{"data":[{"a":"10.00","n":["*饭"]}, {"a":"0.10","n":["小额支持者"]}]}'
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

## 手表 app 集成

`src/pages/About/Donate/index.ux` 已经改造：

1. **首次进入页面**自动调用 `GET /api/donors?all=1` 拉取最新数据
2. **页面右上角的「刷新数据」按钮**也可手动触发
3. 拉取成功后显示 **「数据更新于 YYYY-MM-DD HH:MM」**（来自 KV meta）
4. 网络失败时回退到构建时打包的 `src/assets/data/donors.json`

需要在手表 app 顶部修改 `API_BASE` 常量为你的 Vercel 域名（参考 [index.ux](file:///e:/Code/BlueOSProjects/blueos-calculator/src/pages/About/Donate/index.ux) 第 60 行）：

```js
const API_BASE = 'https://donors-admin-xxx.vercel.app'  // ← 改成实际域名
```

## 安全建议

- **不要**把 `ADMIN_TOKEN` 提交到仓库
- Vercel KV 凭据由 Vercel 自动注入，前端/浏览器**永远拿不到**
- 由于手表 app 内置 `API_BASE` 是公开的，建议给 KV API 加一层只读保护：
  - 当前 API 是**完全公开可读**（任何人拿到域名就能读到全量名单）
  - 如果名单敏感，可以加一个 `?key=...` 参数，由 `READ_TOKEN` 环境变量控制
  - 或者在 Vercel 项目里启用 **Vercel Authentication**（需要 Pro 计划）
