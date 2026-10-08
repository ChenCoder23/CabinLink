# 柜联 · CabinLink

一个登录后共享照片和文件的轻量网站。创建者建立“智能柜”和主题，通过分享链接邀请已登录用户上传、浏览和下载内容；管理操作由独立的管理链接或创建者账号完成。

## 功能

- 创建智能柜，生成独立的分享链接和管理链接
- 登录后通过分享链接查看、下载并上传照片或文件
- 使用主题整理不同批次的资料
- 图片网格预览，普通文件下载
- 创建者可创建、重命名、删除主题和文件，或关闭智能柜
- 可自行注册账号密码，或使用邮箱验证码登录；两种登录方式可绑定至同一账号
- 在“我的智能柜”中查看自己创建的空间
- 单文件最大 1 GB，单智能柜默认容量 10 GB
- 支持手机与桌面端界面

## 技术栈

- React / Vinext / TypeScript
- Cloudflare Worker 运行时
- D1（元数据）与 R2（文件对象）接口；本地 Docker 部署使用 Wrangler 本地持久化存储
- Drizzle ORM migrations
- Tailwind CSS 与 shadcn/ui

## 本地运行

需要 Node.js 22 或更新版本。

```bash
npm ci
npm run dev
```

打开终端提示的本地地址，通常为 `http://localhost:5173`。

邮箱验证码需要 Resend API Key、已验证发件域名，以及三个环境变量：`RESEND_API_KEY`、`RESEND_FROM_EMAIL`、`EMAIL_CODE_SECRET`。将 `.env.example` 复制为本地 `.env` 并填入实际值；密钥不要提交到仓库。未配置邮件服务时，账号密码注册和登录仍可使用。

## 常用命令

```bash
# 静态检查
npm run lint

# 生产构建
npm run build

# 修改数据库结构后生成迁移
npm run db:generate
```

## Docker 部署

项目提供 `Dockerfile` 和 `docker/start.sh`。容器启动时会自动应用 `drizzle/` 下尚未执行的 D1 迁移，并将本地持久化数据存放在挂载目录中。

```bash
docker build -t cabinlink:latest .
docker run -d --name cabinlink --restart unless-stopped -p 80:80 -v cabinlink_data:/data cabinlink:latest
```

使用邮箱登录的 Docker 部署还需通过容器环境变量传入上述三个值。启动脚本将它们作为 Worker Secret 读取；请使用部署平台的密钥管理功能，不要把密钥写入镜像。旧数据库会自动应用新增迁移，已有账号和智能柜保持可用。

> 生产环境建议在反向代理层配置 HTTPS。Cookie 在 HTTPS 下应增加 `Secure` 属性。

## 上传 GitHub 前的安全检查

本仓库的 `.gitignore` 已排除私钥、证书、环境变量、本地数据库、Wrangler 状态、构建产物和 `.secrets/`。

上传前请执行：

```bash
git status --ignored
git check-ignore -v .secrets/cabinlink_deploy
git grep -nE "BEGIN .*PRIVATE KEY|password[[:space:]]*[:=]|secret[[:space:]]*[:=]" || true
```

不要提交或粘贴以下内容：

- SSH 私钥、服务器密码、云厂商密钥
- `.env` 文件、R2/D1 生产凭据、真实管理链接
- `node_modules/`、`dist/`、`.wrangler/` 或运行时数据目录

若凭据曾被发送到公开渠道或提交到 Git 历史，请立即在对应服务中撤销并重新生成，而不是只删除文件。

## 项目结构

```text
app/          页面与 API 路由
components/   智能柜工作台和 UI 组件
db/           Drizzle 数据库定义
drizzle/      数据库迁移
lib/          鉴权、链接和复制工具
docker/       容器启动脚本
```

## 使用说明

1. 注册账号密码或使用邮箱验证码登录后创建智能柜，便于在“我的智能柜”中统一管理。
2. 创建主题，例如“旅行照片”或“项目资料”。
3. 将分享链接发送给协作成员；成员登录后即可使用。
4. 仅将管理链接留给创建者；它拥有修改和删除权限。
