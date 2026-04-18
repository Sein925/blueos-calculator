# BlueOS Calculator - EdgeOne Pages 部署指南

## 前置条件

- ✅ 项目已上传到 GitHub
- ✅ EdgeOne Pages 账户
- ✅ 域名（可选，EdgeOne 会提供默认域名）

## ✅ EdgeOne Pages 边缘函数已配置！

本项目已按照 EdgeOne Pages 边缘函数要求重构：

1. **使用 `./edge-functions` 目录结构**
2. **使用原生 Edge Functions API**（onRequest 等 handlers）
3. **无需 Express 或其他框架**
4. **使用 Web Service Worker API**

## 部署步骤

### 1. 登录 EdgeOne Pages 控制台

访问 EdgeOne Pages 控制台并登录您的账户。

### 2. 创建新项目

1. 点击"新建项目"或"创建应用"
2. 选择"GitHub"作为代码源
3. 授权 EdgeOne 访问您的 GitHub 仓库
4. 选择 `blueos-calculator` 仓库
5. 选择要部署的分支（通常是 `main` 或 `master`）

### 3. 配置构建设置

EdgeOne Pages 会自动识别边缘函数，无需额外配置！

**框架预设：**
选择 `Edge Functions` 或保持默认

**构建命令：**
留空或使用：
```bash
# 无需构建命令，边缘函数会自动被识别
```

### 4. 配置环境变量

在环境变量设置中，添加以下变量（可选）：

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| NODE_ENV | 运行环境 | production |

### 5. 配置数据库

数据库连接信息已在代码中配置：
- 数据库地址：`mysql6.sqlpub.com:3311`
- 数据库名：`blueos_calculator`
- 用户名：`dasein`
- 密码：`NiGrg1RNwfsybSx4`

这些配置在 `edge-functions/_utils/db.js` 中。

### 6. 配置快支付回调地址

在快支付商户后台配置回调地址：

**异步通知地址（notify_url）：**
```
https://your-domain.pages.edgeone.app/api/vip/notify
```

将 `your-domain.pages.edgeone.app` 替换为您的实际域名。

### 7. 开始部署

1. 点击"部署"或"开始构建"按钮
2. 等待构建和部署完成
3. 部署成功后，EdgeOne 会提供一个访问地址

### 8. 验证部署

访问以下地址验证服务是否正常：

```
https://your-domain.pages.edgeone.app/api/health
```

应该返回：
```json
{
  "status": "ok",
  "message": "服务正常"
}
```

## 项目结构说明

```
blueos-calculator/
├── edge-functions/          # 边缘函数目录（重要！）
│   ├── _utils/              # 共享工具函数
│   │   ├── db.js           # 数据库连接
│   │   ├── crypto.js       # 加密/签名工具
│   │   └── kuaizhifu.js    # 快支付配置
│   └── api/                # API 路由
│       ├── health.js       # /api/health
│       └── vip/            # /api/vip/*
│           ├── order.js    # POST /api/vip/order
│           ├── notify.js   # GET /api/vip/notify
│           └── status/
│               └── [device_id].js  # GET /api/vip/status/:device_id
├── src/                   # 前端项目
│   ├── pages/            # 页面
│   ├── components/       # 组件
│   └── manifest.json     # 应用配置
└── DEPLOYMENT.md         # 本部署指南
```

## Edge Functions 路由说明

| 文件路径 | 路由 | 说明 |
|---------|------|------|
| `/edge-functions/api/health.js` | `/api/health` | 健康检查 |
| `/edge-functions/api/vip/order.js` | `/api/vip/order` | 创建VIP订单（POST） |
| `/edge-functions/api/vip/notify.js` | `/api/vip/notify` | 支付异步通知（GET） |
| `/edge-functions/api/vip/status/[device_id].js` | `/api/vip/status/:device_id` | 查询VIP状态（GET） |

## 后端 API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/vip/order` | POST | 创建VIP订单 |
| `/api/vip/notify` | GET | 支付异步通知 |
| `/api/vip/status/:device_id` | GET | 查询VIP状态 |

## 常见问题

### Q: EdgeOne 未识别到边缘函数？

A: 确保以下几点：
1. 函数文件在 `./edge-functions` 目录下
2. 使用正确的 handler 方法（`onRequest`, `onRequestGet`, `onRequestPost` 等）
3. 文件扩展名是 `.js`

### Q: 部署失败怎么办？

A: 检查以下几点：
1. 查看构建日志中的错误信息
2. 确保代码语法正确
3. 检查边缘函数是否正确导出

### Q: 数据库连接失败？

A: 确认：
1. 数据库地址、端口、用户名、密码正确
2. 数据库已创建
3. 网络能访问数据库服务器

### Q: 支付回调不工作？

A: 检查：
1. 回调地址在快支付后台已配置
2. 回调地址可以公网访问
3. 服务器日志查看是否收到回调

### Q: 如何查看日志？

A: 在 EdgeOne Pages 控制台的项目详情中找到"日志"或"监控"选项。

## 更新部署

当您的代码有更新时：

1. 推送代码到 GitHub
2. EdgeOne 会自动检测到更新并重新部署
3. 或者在 EdgeOne 控制台手动触发重新部署

## 本地开发

Edge Functions 使用标准的 Web Service Worker API，可以在本地使用支持的工具进行测试。

## 联系支持

如遇到问题，请：
1. 查看 EdgeOne Pages 官方文档
2. 联系 EdgeOne 技术支持
3. 检查项目 GitHub Issues
