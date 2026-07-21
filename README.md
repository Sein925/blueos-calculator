# 科学计算器

一款功能强大、界面美观的手表端科学计算器，为用户提供全方位的计算功能，满足日常计算、科学计算和高级数学分析的各种需求。

## 功能特性

- **基础计算**: 支持加减乘除、平方、开方、百分比等基础运算
- **科学计算**: 三角函数、对数、指数、阶乘等科学函数
- **方程求解**: 支持一元一次、一元二次方程求解
- **图形计算**: 函数图像绘制
- **统计计算**: 均值、方差、标准差等统计分析
- **日期计算**: 日期选择和日期差计算
- **随机数生成**: 支持多种随机数生成模式
- **历史记录**: 自动保存计算历史
- **触觉反馈**: 可选的操作振动反馈

## 项目结构

```
├── sign/              # 应用签名证书（须自行生成，已加入 .gitignore）
├── src/
│   ├── assets/        # 公共资源（图片、样式、字体）
│   │   ├── images/    # 图片资源
│   │   └── styles/    # 全局样式（SCSS）
│   ├── components/    # 公共组件
│   ├── pages/         # 页面级代码
│   │   ├── Home/      # 计算器主页
│   │   ├── History/   # 历史记录
│   │   ├── Settings/  # 设置页面
│   │   ├── About/     # 关于页面（包含捐赠、反馈）
│   │   ├── Guide/     # 使用指南
│   │   ├── Welcome/   # 欢迎页面
│   │   └── Advanced/  # 高级功能
│   │       ├── Date/      # 日期计算
│   │       ├── Equation/  # 方程求解
│   │       ├── Graph/     # 图形计算
│   │       ├── Statistics/# 统计计算
│   │       └── Random/    # 随机数生成
│   ├── app.ux         # 应用入口文件
│   ├── global.js      # 全局变量和工具函数
│   ├── app.d.ts       # TypeScript 声明文件
│   └── manifest.json  # 应用配置文件
├── tools/             # 工具脚本
│   └── donors-admin/  # 捐赠管理后台
├── package.json       # 项目依赖配置
├── tsconfig.json      # TypeScript 配置
└── .gitignore         # Git 忽略配置
```

## 技术栈

- **框架**: BlueOS 应用开发框架
- **样式**: SCSS (dart-sass)
- **包管理**: pnpm
- **语言**: TypeScript / JavaScript

## 目标设备

- vivo Watch GT
- vivo Watch GT 2
- vivo Watch 3
- vivo Watch 5

## 快速开始

```bash
# 安装依赖
pnpm install
```

开发和构建请使用 BlueOS Studio 图形化操作：
- 打开 BlueOS Studio
- 导入项目
- 点击「运行」按钮启动开发模式
- 点击「构建」按钮生成生产版本

## 配置说明

### 签名证书

应用签名证书存放在 `sign/` 目录下，包含：
- `certificate.pem` - 证书文件
- `private.pem` - 私钥文件

**⚠️ 重要**: 这些文件包含敏感信息，已加入 `.gitignore`。开发者需要自行生成签名证书。

### 环境变量

捐赠管理后台使用以下环境变量：
- `ADMIN_TOKEN` - 管理页登录 Token
- `UPSTASH_REDIS_REST_URL` - Redis 服务地址
- `UPSTASH_REDIS_REST_TOKEN` - Redis 访问 Token

## 应用配置

应用基本信息在 [manifest.json](src/manifest.json) 中配置：
- **包名**: `com.dasein.calculator`
- **版本**: `1.1.13`
- **图标**: `/assets/images/logo.png`
- **设计宽度**: `466px`

## 许可证

GPL-3.0