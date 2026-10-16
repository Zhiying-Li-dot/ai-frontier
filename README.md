# AI Frontier · AI 前沿雷达

持续追踪 AI 与 AI 安全技术，把来源、研究分析和原文证据放在一起，帮助读者理解技术变化及其局限。

- **网站**：<https://zhiying-li-dot.github.io/ai-frontier/>
- **正式代码仓库**：<https://github.com/Zhiying-Li-dot/ai-frontier>
- **运行与部署记录**：[GitHub Actions](https://github.com/Zhiying-Li-dot/ai-frontier/actions)

这是部署在 GitHub Pages 上的公开静态网站。前端使用 React + Vite，GitHub Actions 定时发现来源、更新公开数据并部署，无需自购云服务器。

## 当前能做什么

| 能力 | 当前状态 |
| --- | --- |
| 定时发现公开技术资料 | 已接入 11 个 RSS/Atom 入口，记录题录、来源、发布时间及检查状态 |
| 阅读研究档案 | 展示已核查的简介、方法、结果、局限、分析与原文证据 |
| 区分待精读与已核查内容 | 新发现先进入待精读列表，不自动成为正式研究介绍 |
| 检索与浏览 | 支持关键词、主题、来源和时间筛选，以及每日、论文、演变、周回顾等视图 |
| 收藏、已读和备注 | 保存在当前浏览器，可导出或清除，不跨设备同步 |
| 研究内容版本记录 | 保存研究档案快照，可在阅读界面查看历史版本 |
| 自动调用模型精读论文 | **尚未接入**；当前工作流不调用模型、不读取模型密钥 |
| 对话、个人适配与 RSI | **尚未实现**；仍处于产品讨论阶段 |

初始版本包含 3 份已核查研究档案：1 份论文全文精读和 2 份官方原始技术材料。后续数量以网站和仓库中的实际数据为准。

RSI 指 Recursive Self-Improvement（递归自我改进）。目前不宣称产品具备这项能力，也不把普通偏好记录或定时抓取称为 RSI。

## 数据从哪里来，存到哪里

当前来源包括 arXiv 的 cs.AI、cs.CL、cs.LG、cs.CR、cs.MA、cs.CV，以及 OpenAI、Google DeepMind、Google Research、Alignment Forum 和 LessWrong。实际入口定义在 [`lib/feeds.ts`](lib/feeds.ts)。当前仅检查这些配置过的入口，不是对全网所有平台的持续抓取。

```text
公开 RSS / Atom
    ↓ 定时发现、去重
cloud-data/state.json：研究状态、题录、待精读队列、来源检查与运行记录
    ↓ 质量校验、筛选公开字段、生成版本快照
public/data/research.json + public/data/versions/
    ↓ Vite 构建 → GitHub Pages 部署
网站读取静态 JSON，展示研究内容
```

| 数据 | 保存位置 | 说明 |
| --- | --- | --- |
| 抓取题录、待精读队列、研究状态 | [`cloud-data/state.json`](cloud-data/state.json) | 提交到公开仓库；不是私有数据库 |
| 网站展示的介绍、分析、局限与证据 | [`public/data/research.json`](public/data/research.json) | 构建时从研究状态生成，网站公开可访问 |
| 研究档案历史快照 | [`public/data/versions/`](public/data/versions/) | 按内容哈希保存，保留已有版本 |
| 收藏、已读、备注 | 读者浏览器的 localStorage | 使用 `frontier-pages-v1` 存储键；不上传至仓库或服务器 |
| PDF / 网页全文 | 当前没有完整归档 | 保存来源链接、定位和必要短引文，不等于保存原文全文 |

没有独立数据库、用户账号或私有资料空间。不要把密钥、个人资料、聊天记录或未获授权的材料放进 `cloud-data/` 或 `public/`；它们会随仓库或网站公开。

## 本地开发

需要 **Node.js 24 或以上版本**，以及 Git 和 npm。

```bash
git clone https://github.com/Zhiying-Li-dot/ai-frontier.git
cd ai-frontier
npm ci --ignore-scripts
npm run build
npx vite --host 127.0.0.1
```

打开终端显示的本地地址。先执行构建，是为了从已有研究状态生成页面需要的公开 JSON；不会调用模型或抓取新来源。

| 命令 | 作用 |
| --- | --- |
| `npx vite --host 127.0.0.1` | 启动本地开发服务，修改界面后自动刷新 |
| `npm test` | 检查数据公开规则、版本归档、来源解析和浏览器存储等行为 |
| `npm run build` | 校验并生成公开数据，再构建网站到 `dist/` |
| `npx vite preview --host 127.0.0.1` | 在本地预览已构建的 `dist/` |
| `npm run discover` | 实际请求配置的来源，更新本地 `cloud-data/state.json`；不调用模型 |

手动执行 `discover` 后，再执行 `npm run build`，网站数据才会同步更新。本地命令不会自行提交或发布到 GitHub。

## 目录说明

```text
src/                         页面、阅读交互、样式和浏览器存储
lib/feeds.ts                 来源配置、RSS/Atom 解析与安全访问校验
lib/research.ts              研究数据结构与发布质量校验
lib/seed-data.json           初始研究档案
cloud/state.ts              研究状态与来源发现逻辑
cloud-data/state.json        持久化的公开研究状态
scripts/discover.ts         来源发现入口
scripts/public-data.ts      公开数据字段筛选
scripts/archive.ts          研究档案版本归档
scripts/build-data.ts       生成网站数据
public/data/                网站可直接读取的研究 JSON 与历史快照
tests/                      行为测试
.github/workflows/site.yml  定时发现、测试、构建、保存数据与 Pages 部署
```

修改研究内容时，以 `cloud-data/state.json` 为数据入口；`public/data/` 是生成物，不宜单独手改。已核查论文需要方法、结果、局限、原文证据，以及正文、主要图表和核心附录的阅读覆盖记录；具体校验见 `lib/research.ts`。结构校验无法代替实际阅读和事实核查。

## 怎样一起开发

**朋友长期协作**：由仓库所有者在 Settings → Collaborators 邀请 GitHub 账号；接受邀请后，在独立分支开发并提交 Pull Request（合并请求）。

**其他贡献者**：先 Fork 到自己的账号，再克隆自己的副本、创建分支，将修改推送到自己的仓库，最后向本仓库的 `main` 提交 Pull Request。

提交前执行：

```bash
npm test
npm run build
```

合并请求请说明改了什么、为什么修改、如何验证；界面变化附截图。提交前拉取最新 `main`，保留自动更新的研究数据。代码合并到正式仓库 `main` 后会触发发布；Fork、开发分支和提出合并请求不会自动更新本网站。

目前发布工作流不监听 `pull_request`，因此提交合并请求本身不会自动运行这套测试，也没有自动生成的预览站点。上述本地检查仍需开发者执行。

## 自动更新与部署

工作流位于 [`.github/workflows/site.yml`](.github/workflows/site.yml)，触发条件为：

- 推送到 `main`；仅修改 `cloud-data/**` 和 `public/data/**` 时不重复触发。
- 定时检查：每 4 小时的第 13 分钟、每天北京时间 09:00、每周五北京时间 18:00。
- 在 Actions 中手动选择 **Research and publish Pages → Run workflow**。

每次执行依次安装锁定依赖、运行测试、发现来源、构建网站、将研究数据提交回 `main`，最后部署 Pages。来源发现成功或构建成功，都不代表完成了论文精读。GitHub 定时任务可能延迟，不保证准点执行。

自行 Fork 并部署时，在自己的仓库中配置 Settings → Pages → Source 为 **GitHub Actions**，检查并启用对应工作流和所需写入权限，再手动运行一次。仓库地址与网站地址需换成自己的；不能假定 Fork 会自动开启定时任务和 Pages。

当前工作流不需要模型 API Key，也不产生模型调用费用。以后接入 AI 精读，需要实现调用、证据校验和费用控制；仅添加一个 Secret 不会启用自动阅读。密钥应由可信工作流通过 GitHub Secrets 注入，不能写进前端或公开 JSON。

## 公开范围与历史仓库

- 正式开发和部署以 **`Zhiying-Li-dot/ai-frontier`** 为准；它由原 `ai-frontier-pages` 改名而来，保留原有提交历史。
- 早期私有仓库 `ai-frontier-research` 保留历史代码与数据，其定时工作流已停用，不是当前网站的数据后台；参与当前项目无需获得它的权限。
- 本站无账号、邀请制访问、跨设备个人记录同步或站内对话服务。GitHub Pages 提供公开访问，国内不同网络的可达性需要实际测试。
- 当前不采集姓名、邮箱、手机号或用户上传，不安装第三方统计。GitHub 作为托管方会按其政策记录访问 IP，见 [GitHub Pages 说明](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)。

## 许可证与内容引用

目前尚未选定项目自己的开源许可证，不应仅因仓库公开就推定获得任意再发布或商业使用授权。第三方依赖声明见 [`public/third-party-notices.txt`](public/third-party-notices.txt)；引用论文和技术资料时，请保留来源并遵守原作者的许可条件。
