# 打赏名单管理后台

图形化编辑打赏名单，使用 **Upstash Redis**（通过 Vercel Marketplace 集成）作为存储后端。

- **Upstash Redis**（唯一存储）：数据存于云端 Redis，跨部署持久
- 管理端：Vercel 上的 Express Serverless Function + 静态前端
- 手表 app：手动调用 API 拉取最新数据，本地缓存

## 目录结构

```
tools/donors-admin/
├── api/
│   └── index.js          # 单一 Express 入口（接管所有 URL + 静态文件）
├── lib/
│   ├── donors.js         # 校验 + 排序 + 过滤
│   └── store.js          # Upstash Redis 存储抽象
├── public/               # 静态前端（已适配移动端）
│   ├── app.js
│   ├── index.html
│   └── style.css
├── vercel.json
├── .env.example
└── package.json
```

Redis 中的 key：

| Key | 内容 |
|-----|------|
| `donors:data` | 主数据 `Array<{ a, n }>` |
| `donors:meta` | 元信息 `{ updatedAt, count }` |

## 部署到 Vercel

### 1. 安装 Upstash Redis 集成（替代已弃用的 Vercel KV）

1. 进入 Vercel 项目 → **Storage** → **Browse Marketplace**
2. 搜索 **Redis** → 选 **Upstash** → **Install Integration**
3. 选你的 `blueos-calculator` 仓库
4. 创建 Redis 数据库，名字 `donors-redis` 即可
5. 集成会自动注入 `UPSTASH_REDIS_REST_URL` 和 `UPSTASH_REDIS_REST_TOKEN` 到项目环境

> Vercel KV 已被官方弃用，新项目必须用 Marketplace 里的 Upstash 集成。

### 2. 创建项目（如尚未创建）

1. 打开 https://vercel.com/new
2. **Import** 你的仓库
3. **Root Directory** 改成 `tools/donors-admin`（关键：避免把整个手环 app 都上传）
4. **Framework Preset** 选 `Other`
5. 点 **Deploy**

### 3. 配置登录 Token

**Project → Settings → Environment Variables**，添加：

| 名称 | 值 |
|------|----|
| `ADMIN_TOKEN` | 一个长随机字符串（自己定，例 `openssl rand -hex 16`）|

`UPSTASH_REDIS_REST_*` 已在第 1 步由集成自动注入。

保存后到 **Deployments** 重新部署一次让环境变量生效。

### 4. 访问

打开 Vercel 给的域名，输入 `ADMIN_TOKEN` 登录。

## API 文档

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET  | `/` | 否 | 管理端首页 |
| GET  | `/app` | 否 | `app.js` |
| GET  | `/style` | 否 | `style.css` |
| GET  | `/donors` | 否 | 读取名单（默认按金额降序 + 过滤 < 1 元） |
| GET  | `/donors?all=1` | 否 | 全量数据（管理端 / 手表 app 拉取用） |
| PUT  | `/donors` | **Token** | 整体覆盖写入 |
| GET  | `/health` | 否 | 健康检查 + 存储信息 |
| POST | `/auth` | 否 | 校验 Token |

PUT/POST 请求需在 Header `X-Token` 或 body `token` 中携带 `ADMIN_TOKEN`。

### curl 示例

```bash
# 读取（默认：按金额降序，过滤 < 1 元）
curl https://your-app.vercel.app/donors

# 读取全量
curl https://your-app.vercel.app/donors?all=1

# 健康检查
curl https://your-app.vercel.app/health
# => {"ok":true,"storage":{"mode":"upstash-redis","key":"donors:data",...}}

# 写入
curl -X PUT https://your-app.vercel.app/donors \
  -H "Content-Type: application/json" \
  -H "X-Token: $ADMIN_TOKEN" \
  -d '{"data":[{"a":"10.00","n":["*饭"]}]}'

# 校验 Token
curl -X POST https://your-app.vercel.app/auth \
  -H "Content-Type: application/json" \
  -d '{"token":"your-admin-token"}'
```

## 手表 app 集成

`src/pages/About/Donate/index.ux` 改造完成：

- 首次进入页面不自动拉取；**只在用户点「刷新数据」按钮时**从 API 拉取
- 拉取成功后保存到手表本地（`@system.storage`）
- 重新打开 / 回到页面时从本地缓存读

`API_BASE` 改成你的 Vercel 域名（参考 [index.ux](file:///e:/Code/BlueOSProjects/blueos-calculator/src/pages/About/Donate/index.ux) 第 62 行）：

```js
const API_BASE = 'donors.666-114514.eu.org'  // 不要带 https://
```

## 数据格式

```json
[
  { "a": "10.00", "n": ["*饭"] },
  { "a": "6.88", "n": ["用户A", "用户B", "用户C"] }
]
```
