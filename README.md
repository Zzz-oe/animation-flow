# ScenePilot

面向动画分镜创作的人机协作编辑器。笔试题 B「动画 AI 编辑器方向」的交付项目。

- 公开仓库：https://github.com/Zzz-oe/animation-flow

## 文档导航

| 文件 | 用途 |
| --- | --- |
| `docs/EVALUATION.md` | 最高优先级验收基线，含考题原始要求与产品判定标准 |
| `docs/DEVELOPMENT_SPEC.md` | 需求到实现的阶段拆解与退出条件 |
| `docs/DEVELOPMENT_LOG.md` | 逐次追加的开发日志（含真实 Token 用量与人工耗时） |
| `docs/WORKLOG.md` | 跨阶段有效的决策、失败案例与经验沉淀 |
| `docs/TOKEN_USAGE.md` | Token 用量台账，数据取自本机会话记录 |

## 当前阶段

阶段 4：可完整演示人机协作闭环的动画分镜 AI 编辑器。

当前已包含雨夜车站默认场景、镜头列表、Canvas 舞台、时间轴和导演意图；支持对象选择、拖动、缩放、属性编辑、显隐/锁定、图层顺序、增删、撤销/重做与刷新恢复。Mock AI 评审会基于场景快照和导演意图输出动画专项评分、结构化问题、证据区域与可执行建议。用户可逐条选择建议、补充修改要求、生成与原稿隔离的候选修正版，在舞台切换前后版本，并决定接受、拒绝或从历史恢复。整个 Mock 闭环无需 API Key，候选生成失败不会改动原稿。

## 演示路径

1. 在画布调整人物或隐藏列车等场景对象。
2. 在“创作意图”运行镜头评审。
3. 在“AI 协作”选择建议并生成候选修正版。
4. 切换“当前原稿 / 候选修正版”查看差异。
5. 接受、拒绝候选，或从 AI 操作记录恢复接受前版本。

## 本地运行

```bash
npm install
npm run dev
```

受限执行环境中使用 Vite runner config loader；`npm run build` 会生成生产构建。

## 统计 Token 用量

```bash
node scripts/token-usage.mjs --out usage.md
```

读取 WorkBuddy 会话记录中的真实 `usage` 字段并汇总为 Markdown，用于填写开发日志。
