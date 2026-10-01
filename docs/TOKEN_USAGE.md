# Token 用量台账

本文件记录每次开发会话的真实 Token 用量，用于满足笔试题交付要求中的「使用的 AI Coding 工具及大致 Token 用量（含最耗 Token 的部分）」。

数字不是估算：它们来自本机 WorkBuddy 会话记录中每条 API 回合的 `usage` 字段，由 `scripts/token-usage.mjs` 汇总，可随时重新运行复现。

## 口径

- 数据源：`~/.workbuddy/projects/<workspace-slug>/<sessionId>.jsonl`。运行时会为每个 API 回合写入一条 `usage` 记录。
- `total_tokens = input_tokens + output_tokens`（已用原始记录逐条校验）。
- `cache_read_input_tokens` 是 `input_tokens` 的**子集**，即缓存命中的那部分输入，**不重复累加**。
- 「未缓存输入」= `input_tokens − cache_read_input_tokens`。
- 会话进行中取到的读数只是部分值，取数时刻逐条标注。

## 取数命令

```bash
node scripts/token-usage.mjs --out usage.md            # 当前工作区最新会话
node scripts/token-usage.mjs --all --out usage-all.md  # 当前工作区全部会话
node scripts/token-usage.mjs <path.jsonl>              # 指定会话文件
```

## 用量记录

| # | 日期 | 会话 / 任务 | 模型 | 回合 | 未缓存输入 | 缓存命中输入 | 输入合计 | 输出 | 总计 | 取数时刻 |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 2026-09-30 | 现状核对 + 文档校正 + Token 记录机制 | deepseek-v4.1-flash | 78 | 121,112 | 7,502,208 | 7,623,320 | 49,652 | 7,672,972 | 10:08:48（会话进行中） |
| 3 | 2026-10-02 | 核心 Demo 交付收尾 | 无可用记录 | — | — | — | — | — | — | 取数时刻；指定 WorkBuddy 工作区记录不存在 |
| 2 | 2026-10-02 | 阶段 5 多模态评审代理加固 | 无可用记录 | — | — | — | — | — | — | 01:20:19；指定 WorkBuddy 工作区记录不存在 |
| 4 | 2026-10-02 | Codex ScenePilot 工作区（6 个线程，含并行子任务） | gpt-5.6-terra / gpt-5.6-sol | — | — | — | — | — | 61,852,409 | 06:26:41；Codex 本地线程累计值 |
| 5 | 2026-10-02 | 交付说明补充（Codex 累计快照，非增量） | gpt-5.6-terra / gpt-5.6-sol | — | — | — | — | — | 62,773,182 | 06:34:49；同一工作区线程的更新快照 |

本次会话缓存命中率为 98.4%：绝大部分输入成本来自「每个回合重发完整上下文」，新增内容本身占比很小。输出 token 只有 49,652，消耗集中在上下文而非生成。

Codex 与 WorkBuddy 是不同的记录来源，不能把两者的总数相加。Codex 记录来自本机 `C:\Users\周晓琳\.codex\state_5.sqlite` 的 `threads.tokens_used`，是线程累计值，不提供本表所需的输入/缓存/输出拆分；因此对应字段保持 `—`，总数明确标注为 Codex 本地累计值。当前主线程在同一取数时刻为 `29,346,535` tokens，工作区合计包含三个主线程和三个并行子任务。

## 明细

### 2026-09-30 · 现状核对 + 文档校正 + Token 记录机制

- 会话文件：`C:\Users\Administrator\.workbuddy\projects\d-me-animation-flow\896bdb58-ee78-489a-a21e-2f0f9ef64604.jsonl`
- 取数时刻：2026-09-30 10:08:48
- 会话时间范围：2026-09-30 09:53:21 → 2026-09-30 10:08:47
- 有效 API 回合数：78

| 计费项 | Token 数 | 说明 |
| --- | ---: | --- |
| 未缓存输入 | 121,112 | input_tokens − cache_read，按原价计费 |
| 缓存命中输入 | 7,502,208 | 占全部输入的 98.4% |
| 输入合计 | 7,623,320 | 每次请求都要重发的上下文 |
| 输出 | 49,652 | 模型生成 |
| **总计** | **7,672,972** | 输入合计 + 输出 |

按模型拆分：

| 模型 | 回合 | 输入 | 输出 | 总计 |
| --- | ---: | ---: | ---: | ---: |
| deepseek-v4.1-flash | 78 | 7,623,320 | 49,652 | 7,672,972 |

### 2026-10-02 · Codex ScenePilot 工作区累计值

- 数据源：Codex 本地 `state_5.sqlite` 的 `threads.tokens_used`，不是 WorkBuddy JSONL `usage` 明细。
- 取数时刻：2026-10-02 06:26:41 +08:00。
- 范围：工作区 `D:\scene-pilot-remote` 的 6 个 Codex 线程，包括 3 个主线程和 3 个并行子任务。
- 当前主线程：`29,346,535` tokens；工作区线程合计：`61,852,409` tokens。
- 模型：`gpt-5.6-terra` 与 `gpt-5.6-sol`。
- 口径限制：这是 Codex 的线程累计字段，不能拆解成 `input_tokens`、缓存命中和 `output_tokens`，也不等同于账单明细；因此没有把它伪装成 WorkBuddy 的详细 usage 表。
- Token 最多的部分：当前主线程（约 2,935 万 tokens）；主要由长上下文、多轮代码检查、浏览器回归和工具输出累积，无法从该字段进一步拆分到单个功能。

### 2026-10-02 · 交付说明补充累计快照

- 取数时刻：2026-10-02 06:34:49 +08:00。
- 当前主线程：`30,267,308` tokens；工作区线程合计：`62,773,182` tokens。
- 这是同一 Codex 工作区的更新累计快照，不是本次文档工作的增量用量；不能与上方 Codex 行相加。
