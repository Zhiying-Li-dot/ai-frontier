# 论文来源抓取检查

这些检查运行真实抓取器、HTTP 客户端和 PDF 提取工具，验证 arXiv 摘要链接转正文、保留指定版本、重定向复核，以及错误页面、下载失败、缺工具、损坏 PDF 和页数限制。测试资料是合成 PDF 与摘要，不包含真实研究结论，也不会调用模型。

依赖 Node 24、Postman CLI 1.70+ 和 Poppler（`pdfinfo`、`pdftotext`）。先在一个终端启动本地模拟服务：

```bash
postman simulation run postman/simulations/paper-source.sim.yaml --port 4918 --output ndjson --no-history
```

看到 `listening` 后，在另一终端运行：

```bash
npm run test:sources
```

如使用其他端口，通过 `FRONTIER_SOURCE_MOCK=http://127.0.0.1:端口/arxiv` 指定测试目的地。测试只将抓取器现有 transport 参数的目的地址替换为模拟服务，保留实际 HTTP、请求选项、响应处理、来源检查和提取流程。生产路径不放开本机地址。

模拟服务由本项目依据 [arXiv 官方 URL 规则](https://github.com/arXiv/arxiv-docs/blob/develop/source/help/arxiv_identifier_for_services.md)编写，未采用 arXiv 官方 mock；合成资料、错误状态是为测试特定分支设置的。未建模的路由返回 501。通过检查证明这些场景下的行为，不代表 arXiv 当前联网可用，也不代表完成图表核查或论文复现。服务只在本机运行，未部署或上传到 Postman 工作空间。改动 mock 后需重启模拟服务，完成后按 Ctrl+C 停止。
