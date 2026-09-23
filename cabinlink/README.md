# 柜联 · CabinLink

一个无需注册即可共享照片和文件的轻量网站。创建者建立“智能柜”和主题，通过分享链接邀请他人上传、浏览和下载内容；管理操作由独立的管理链接或已登录的创建者账号完成。

## 功能

- 创建智能柜，生成独立的分享链接和管理链接
- 通过分享链接查看、下载并上传照片或文件
- 使用主题整理不同批次的资料
- 图片网格预览，普通文件下载
- 创建者可创建、重命名、删除主题和文件，或关闭智能柜
- 账号登录后可在“我的智能柜”中查看自己创建的空间
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

1. 登录账号后创建智能柜，便于在“我的智能柜”中统一管理。
2. 创建主题，例如“旅行照片”或“项目资料”。
3. 将分享链接发送给协作成员。
4. 仅将管理链接留给创建者；它拥有修改和删除权限。
