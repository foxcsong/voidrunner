# Cloudflare Pages + D1 部署指南

本项目已全面迁移至 Cloudflare 生态，前端使用 Vite (Pages)，后端使用 Pages Functions，数据库使用 D1。

## 1. 准备工作
- 确保代码已推送到 GitHub 仓库。
- 拥有一个 Cloudflare 账号。

## 2. 初始化 D1 数据库
1. 登录 Cloudflare 控制台，进入 **Workers & Pages > D1**。
2. 点击 **Create database**，选择 **Dashboard**。
3. 数据库名称输入 `void_db`（或你喜欢的名称）。
4. 在数据库详情页点击 **Console**，复制并运行 `cloudflare_d1_setup.sql` 文件的内容：
   ```sql
   -- 在此处粘贴 cloudflare_d1_setup.sql 中的 SQL
   ```

## 3. 创建 Cloudflare Pages 项目
1. 进入 **Workers & Pages > Create application > Pages**。
2. 点击 **Connect to Git**，选择你的仓库。
3. **Build settings**:
   - Framework preset: `Vite`
   - Build command: `npm run build`
   - Build output directory: `dist`
4. 点击 **Save and Deploy**。

## 4. 绑定数据库与环境变量
1. 在 Pages 项目详情页进入 **Settings > Functions**。
2. 找到 **D1 database bindings**，点击 **Add binding**。
   - Variable name: `DB` (必须是大写)
   - D1 database: 选择你刚才创建的 `void_db`。
3. 进入 **Settings > Environment variables**。
   - 点击 **Add variable**。
   - Variable name: `GEMINI_API_KEY`
   - Value: 填入你的 Gemini API Key。
4. **重新部署**：进入 **Deployments**，选择最近的一次部署点右侧的三个点，点击 **Retry deployment**。

## 5. 完成
现在访问你的 Pages URL，即可体验完整的云端存档、英雄榜以及 AI 胜利评价功能！
