# paper-source simulation context

2026-10-26，项目自建合成 arXiv HTTP/PDF 场景；唯一成员 `arxiv`，处理器见 `../mocks/arxiv/default.js`。

## Purpose
验证真实来源抓取器经 HTTP 下载、重定向复核和 Poppler 提取后的成功与失败分支。资料为合成测试数据，未调用模型，未上传 Postman 工作空间。

## Execution
1. `postman simulation run postman/simulations/paper-source.sim.yaml --port 4918 --output ndjson --no-history`
2. 确认 `listening`，再运行 `npm run test:sources`；其他端口用 README 中的 `FRONTIER_SOURCE_MOCK`。
3. 检查 NDJSON 的 request 事件，确认唯一成员 `arxiv` 收到请求；停止本次模拟进程。

## Assumptions
- 2026-10-26：Node 24 与已安装 Poppler 才可覆盖实际 PDF 解析；缺失工具分支另有隔离测试（本次执行观察）。
- 2026-10-26：模拟响应根据官方 URL 规则和测试分支构造；不能证明真实 arXiv 连通性、全部重定向、图表核查或作者实验可复现性（处理器与测试范围审查）。

## Observations
<!-- begin:observations -->
- 2026-10-26：8/8 来源集成测试通过。唯一成员 `arxiv` 有流量，无沉默成员；实际观察到版本化及旧编号 PDF、302 跳转、HTML 伪装、404、损坏 PDF 与超页数场景的请求事件。拒绝外部跳转时未请求被禁止目的地。
<!-- end:observations -->
