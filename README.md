# ScenePilot

面向动画分镜创作的人机协作编辑器。笔试题 B「动画 AI 编辑器方向」的交付项目。

- 公开仓库：https://github.com/Zzz-oe/animation-flow

## 文档导航

| 文件 | 用途 |
| --- | --- |
| `docs/EVALUATION.md` | 最高优先级验收基线，含考题原始要求与产品判定标准 |
| `docs/DEVELOPMENT_SPEC.md` | 需求到实现的阶段拆解与退出条件 |
| `docs/DELIVERY.md` | 面向题目交付的实现、时间、人机交互、Token 和个人投入说明 |
| `docs/DEVELOPMENT_LOG.md` | 逐次追加的开发日志（含真实 Token 用量与人工耗时） |
| `docs/WORKLOG.md` | 跨阶段有效的决策、失败案例与经验沉淀 |
| `docs/TOKEN_USAGE.md` | Token 用量台账，数据取自本机会话记录 |

## 当前阶段

核心 Demo 已完成并进入阶段 6 交付收尾。Mock 模式无需 API Key 即可完整演示“人工编辑 → 结构化评审 → 选择建议 → 隔离候选 → 对比 → 接受/拒绝/恢复”。三个镜头、三个案例、涂鸦标注、PNG/JSON 导出和本地刷新恢复均已接入。

真实模式通过同源服务端代理调用 Qwen3.8-Flash 评审和 Qwen-Image 候选生成。真实候选先在侧栏和舞台隔离预览，只有点击“接受并应用”才覆盖当前视觉版本；结构化图层仍保留，便于继续编辑。真实模型会产生费用，并明显慢于 Mock；没有配置服务端密钥时应使用 Mock。

## 本地运行

```bash
npm install
npm run dev
```

受限执行环境中使用 Vite runner config loader；`npm run build` 会生成生产构建。

真实模式需要另开终端启动服务端代理；Mock 模式只需启动 Vite：

```bash
copy .env.example .env.local
npm run api
npm run dev
```

密钥只保存在服务端 `.env.local`；浏览器仅访问同源 `/api/review` 和 `/api/revision`。`GET /api/health` 可检查代理配置，但不会发起模型调用。运行 `npm run check` 可执行生产构建和服务端语法检查。

## 已知边界

- 本地恢复使用浏览器 `localStorage`，不是云端保存；协作历史为当前会话级记录。
- 真实候选图片是隔离的扁平视觉版本，接受后覆盖舞台显示，但不会把图片反向拆解成新的结构化图层。
- 真实模型延迟、图片 URL 有效期和输出质量取决于上游服务；上游失败不会覆盖原稿，Mock 仍可继续演示。
- 当前交付地址是本地 `http://127.0.0.1:5173/`；公开源码仓库为上方 GitHub 地址。

## 统计 Token 用量

```bash
node scripts/token-usage.mjs --out usage.md
```

读取 WorkBuddy 会话记录中的真实 `usage` 字段并汇总为 Markdown，用于填写开发日志。

交付台账还会单独记录可读取到的 Codex 本地线程累计值。两类数据源的统计口径不同：Codex 的 `threads.tokens_used` 没有输入/缓存/输出拆分，不能与 WorkBuddy 总数相加，详见 `docs/TOKEN_USAGE.md`。
