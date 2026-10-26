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
| 研究 Agent 阅读 skill | 本机执行器已加载 skill，严格验证八步记录、材料覆盖和证据引用 |
| 真实模型阅读 | 本机工作台手动触发 Codex CLI；论文目前只提取文字，缺图表检查时保留候选；云端不调用模型 |
| 个人适配与反馈 | 本机岗位/目标/深度视图，反馈候选、独立合成样例检查、本人确认、回滚；个人信息仅内存 |
| 对话与递归自我改进 | 尚无自由对话模型；尚未验证个人收益，也没有自动改进策略改进器 |

初始版本包含 3 份已核查研究档案：1 份论文全文精读和 2 份官方原始技术材料。后续数量以网站和仓库中的实际数据为准。

RSI 指 Recursive Self-Improvement（递归自我改进）。目前不宣称产品具备这项能力，也不把普通偏好记录或定时抓取称为 RSI。

## 研究 Agent 与阅读 skill

产品目标是服务不同工种及不同个人：帮助开发者、Agent 工程师、AI 算法工程师、AI 安全算法工程师等理解前沿技术、用于日常工作，并根据各自反馈持续改进解释、选材和建议。

仓库已提供 [`technical-content-reading` skill](skills/technical-content-reading/SKILL.md)，适用于论文、博客、报告、文档、代码仓库和其他技术资料。它按资料类型执行阅读核查，产出统一的来源、机制、证据、局限、待验证问题和适用条件；针对个人的解释单独保存在私有工作空间，不能混入公开研究数据。

[`AGENTS.md`](AGENTS.md)规定研究 Agent 的调用与交接规则，[Agent 与个人改进设计](docs/research-agent.md)说明角色模板、个人策略、反馈路由和受控 RSI。当前已接通 **本机手动阅读执行器与个人反馈作业流**；云端定时任务仍只抓题录。个人解读是本机模板适配，岗位与目标不会发送给模型；这不是模型自由对话或已验证的 RSI。

技能测试使用明确标注的合成材料，不发布为真实论文或博客。人工采用技能时仍须完成事实核查和现有发布质量校验；JSON 格式一致不能证明科学结论正确。

## 个人研究工作台

公共雷达适合直接浏览；需要真实精读和个人反馈时，在自己的电脑运行：

```bash
git clone https://github.com/Zhiying-Li-dot/ai-frontier.git
cd ai-frontier
npm ci
npm run build
npm run workbench
```

需要 **Node 24+、已安装且已登录的 Codex CLI**（参见[官方非交互模式说明](https://developers.openai.com/codex/noninteractive)）。本轮实测 Codex CLI 0.162.1；先在终端运行 `codex login status` 检查。PDF 文字提取另需 Poppler 的 `pdfinfo`、`pdftotext`；未安装时会显示失败，不生成假结果。打开终端显示的 `http://127.0.0.1:4318/`，按 Ctrl+C 停止。本机地址只对这台电脑有效，朋友应在自己的电脑启动。

工作台读取公共雷达候选，也允许粘贴来源白名单内的公开原文。一次只处理一篇，抓取后加载阅读 skill，生成中立记录并严格验证；每个北京时间自然日最多 8 次模型调用，失败计入，无自动重试，额度跨重启保留。使用现有 Codex 账号额度，受账号服务和用量限制约束；不是无限免费模型服务，不会把登录凭据传给 GitHub。

arXiv 摘要链接会按[官方地址规则](https://github.com/arXiv/arxiv-docs/blob/develop/source/help/arxiv_identifier_for_services.md)转到同一论文、同一指定版本的 PDF；未指定版本时由 arXiv 返回当前版本。PDF 下载失败时不会退回摘要进行阅读，抓取或提取失败不占用模型调用次数。PDF 当前最多 8 MB、40 页，只提取文字，图表未核查时仍保留“待补材料”。macOS 可用 `brew install poppler` 安装所需的 `pdfinfo` 和 `pdftotext`；工具缺失或 PDF 损坏时，运行记录会显示处理提示。

岗位、关注主题、工作目标和深度只在本次服务进程的内存中；反馈生成你的策略候选，先运行独立合成样例中的事实与不确定性保留检查，再由你确认采用，可随时回滚或清除。结构检查不能证明策略更有用；更不代表递归加速。请勿填写公司机密或敏感个人信息。关闭进程后个人会话消失。

公开来源快照、中立阅读记录及日预算保存在本机仓库外的 `~/.local/share/ai-frontier/`，目录权限 0700、文件权限 0600，没有额外实现磁盘加密；由本机系统权限与磁盘保护承担离线保护。删除该目录可清除这些本机档案。**这些记录不会自动提交到 GitHub，也不会自动出现在公共站已完成档案。** `review-ready` 仍需事实复核及发布检查，`hold` 必须补材料。

工作台只监听回环地址，校验 Host、Origin 和进程会话令牌；不要转发端口或用作公开多人服务。模型只接收公开原文及阅读规范，shell、应用、插件、浏览器和联网搜索等工具禁用；仍通过官方 CLI 请求模型服务。GitHub Actions 原有免费发现与静态部署保持运行；本机停止后精读服务停止。

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
skills/technical-content-reading/ 阅读技能、研究记录契约和合成测试用例
AGENTS.md                   研究 Agent 的调用与交接规则
docs/research-agent.md       个人策略、反馈路由与受控改进设计
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

涉及本机工作台交互时，另运行 `npx playwright install chromium` 和 `npm run test:ui`。如果已安装 Chrome，可使用 `FRONTIER_BROWSER_CHANNEL=chrome npm run test:ui`。这些浏览器回归检查使用临时目录和合成材料，覆盖失败提示、阅读切换、清除会话及重启恢复，不调用模型或改动个人档案。

论文抓取的 HTTP 集成检查使用本地 Postman 模拟服务及真实 Poppler 提取，运行方式见 [来源抓取测试](postman/README.md)。

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

## 主题观察台

首页增加主题坐标与最近七个上海自然日的原文发表统计。数字仅代表当前公开快照，候选仍然等待精读；主题按标题与标签关键词匹配，可跨主题，不是质量或热度评分。主题、分类、搜索和原文时间范围可组合使用，候选每次显示 20 条，支持继续加载。时间筛选以快照更新时间为参照，避免离线快照随访问时间变化。

信息组织参考 [AISafetyHot](https://github.com/wuyoscar/AISafetyHot) 的主题探索与时间信息流；界面、统计与交互在本仓库独立实现，未复制第三方内容或视觉资产。
