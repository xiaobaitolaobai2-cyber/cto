# 在线预览部署：GitHub Pages（最小可用首页）

本仓库包含一个可即时预览的静态原型页面，首页包括：
- 项目标题与视图切换占位（“排班管理 / 我的排班”）
- 7 x 48 的网格占位（7 天、每半小时一列），用于演示排班网格
- 基础样式与脚本（纯前端，无构建步骤）

## 访问预览

优先使用 GitHub Pages 官方域名：
- https://xiaobaitolaobai2-cyber.github.io/cto/

如果仓库权限限制导致 Pages 无法启用，可使用代理回退（渲染 main 分支 docs/index.html）：
- https://htmlpreview.github.io/?https://raw.githubusercontent.com/xiaobaitolaobai2-cyber/cto/main/docs/index.html

合并到 main 后 1–3 分钟内，预览应自动更新。

## 项目结构

- docs/               部署产物目录（被 GitHub Actions 上传并发布）
  - index.html        最小可用首页
  - assets/
    - styles.css      基础样式
    - app.js          脚本入口（渲染视图与网格）
    - schedule.js     7x48 网格渲染骨架
    - state.js        示例数据与本地存储（可选）
    - ui.js           轻量 DOM 工具函数
- .github/workflows/pages.yml  GitHub Pages 自动部署工作流

根目录也保留了一份 index.html 与 assets/ 以便本地直接打开预览；线上以 docs/ 为发布源。

## 本地预览

直接双击打开 docs/index.html 即可，或使用任意静态服务器：

- Python: `python3 -m http.server 8080` 然后访问 http://localhost:8080/docs/
- Node: `npx http-server -p 8080` 然后访问 http://localhost:8080/docs/

## 部署说明（GitHub Actions）

工作流会在推送到 main 分支时自动执行：
- 打包 docs/ 目录为构建工件
- 部署到 GitHub Pages（环境：github-pages）

无需构建步骤，新增或修改 docs/ 下的静态文件即可触发在线预览更新。
