# BlueOS Calculator - EdgeOne 部署指南

## 前置条件

- ✅ 项目已上传到 GitHub
- ✅ EdgeOne Pages 账户
- ✅ 域名（可选，EdgeOne 会提供默认域名）

## ⚠️ EdgeOne Pages 特殊要求

根据 EdgeOne Pages 文档，后端函数必须满足以下要求：

1. **文件名必须是 `[[default]].js` 格式**
2. **使用 ES6 模块语法**（`import/export`）
3. **导出 app 实例**（`export default app`）
4. **不要监听端口**（EdgeOne 会自动处理）
5. **在 package.json 中设置 `"type": "module"`**

本项目已按照这些要求配置！

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

在构建设置页面，配置以下内容：

**根目录：**
```
backend
```

**构建命令：**
```bash
npm install
```

**输出目录：**
```
.
```

**框架预设：**
选择 `Express.js` 或 `Node.js`

### 4. 配置环境变量

在环境变量设置中，添加以下变量（可选）：

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| NODE_ENV | 运行环境 | production |

### 5. 配置数据库

确保数据库连接信息正确：
- 数据库地址：`mysql6.sqlpub.com:3311`
- 数据库名：`blueos_calculator`
- 用户名：`dasein`
- 密码：`NiGrg1RNwfsybSx4`

这些已经配置在 `backend/[[default]].js` 中。

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
├── backend/              # 后端项目
│   ├── [[default]].js    # EdgeOne 函数入口文件（重要！）
│   ├── package.json      # 依赖配置（已配置 type: module）
│   ├── .gitignore        # Git 忽略文件
│   └── README.md         # 后端文档
├── src/                  # 前端项目
│   ├── pages/            # 页面
│   ├── components/       # 组件
│   └── manifest.json     # 应用配置
├── DEPLOYMENT.md         # 本部署指南
└── CHANGELOG.md          # 更新日志
```

## 后端 API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/vip/order` | POST | 创建VIP订单 |
| `/api/vip/notify` | GET | 支付异步通知 |
| `/api/vip/status/:device_id` | GET | 查询VIP状态 |

## 常见问题

### Q: EdgeOne 未识别为函数？

A: 确保以下几点：
1. 文件名必须是 `[[default]].js`
2. package.json 中有 `"type": "module"`
3. 使用 `export default app` 导出
4. 不要调用 `app.listen()`

### Q: 部署失败怎么办？

A: 检查以下几点：
1. 根目录设置为 `backend`
2. 构建命令正确：`npm install`
3. package.json 存在且配置正确
4. 依赖能正常安装

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

如需本地开发测试：

```bash
cd backend
npm install
npm run dev
```

注意：本地开发需要修改代码添加 `app.listen()`，但部署前请移除！

## 联系支持

如遇到问题，请：
1. 查看 EdgeOne Pages 官方文档
2. 联系 EdgeOne 技术支持
3. 检查项目 GitHub Issues
