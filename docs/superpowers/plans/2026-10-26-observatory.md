# 主题观察台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 发布基于真实快照的可探索主题首页。
**Architecture:** lib/observatory.ts 负责去重、主题匹配、时间筛选与统计；src/observatory.jsx 负责展示；main.jsx 接入统一筛选和候选分批展示。
**Tech Stack:** React 19 / Vite 8 / Node 24 / Playwright，沿用现有依赖。
**Spec:** docs/superpowers/specs/2026-10-26-observatory.md

## Global Constraints
- 只统计当前公开快照，不称全网热度。
- 不增加模型调用、付费服务或个人数据上传。
- 已核查记录优先；未来和无效日期不计入近期统计。
- 所有新界面使用本站数据和原创代码。

## Review Focus
- 同一 arXiv 的 abs/pdf/version 链接：去重优先保留已核查记录（Task 1）。
- 未来、无效日期及上海零点边界：不污染近期计数（Task 1）。
- 无主题匹配：归入其他研究，仍可访问（Task 1）。
- 加载更多后改变搜索：展示数量重新开始，空结果有提示（Task 2）。
- 390px 手机与键盘用户：无横向溢出，主题按钮可操作（Task 2）。

### Task 1: 数据与筛选
**Files:** Create lib/observatory.ts; tests/observatory.test.ts.
**Interfaces:** topics 常量；matchesTopic(item, topic)；withinWindow(item, days, now)；uniqueMaterials(items, pending)；observe(items, pending, now) 返回 entries/topics/days。
- [x] 写去重、关键词多主题与其他、时间窗口和上海日期统计测试。
- [x] 执行 node --experimental-strip-types --test tests/observatory.test.ts，预期模块缺失失败。
- [x] 实现上述纯函数。
- [x] 同一命令全部通过，提交函数与测试。

### Task 2: 页面与交互
**Files:** Create src/observatory.jsx; tests/browser/observatory.test.ts. Modify src/main.jsx; src/styles.css; README.md.
**Interfaces:** Observatory({data, topic, onTopic}) 使用 Task 1 observe；主页面同时筛选已核查与候选并每批显示 20 条。
- [x] 写浏览器测试：主题筛选、分页重置、空结果、阅读直达、手机无横向溢出和键盘选择。
- [x] 构建并运行新测试，预期找不到观察台和主题按钮失败。
- [x] 实现观察台、组合筛选、候选分页与响应式样式。
- [x] 完整单元与浏览器检查通过；检查桌面和手机截图；更新说明并提交。

## 验证记录

2026-10-26：新主题测试4项、公开界面浏览器测试3项均先观察失败后通过；完整单元28/28、浏览器12/12、Postman来源集成8/8通过。1440px、1100px与390px已检查；最终只读代码与研究内容审查无Critical/Important。发布沿用已有GitHub Pages。

旧工作台状态请求无超时的低优先级问题留待后续；本轮未更改其请求超时策略。
