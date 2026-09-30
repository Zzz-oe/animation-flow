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
| 1 | 2026-09-30 | 现状核对 + 文档校正 + Token 记录机制 | deepseek-v4.1-flash | 54 | 115,135 | 4,564,608 | 4,679,743 | 36,550 | 4,716,293 | 10:05:33（会话进行中） |

本次会话缓存命中率为 97.5%：绝大部分输入成本来自「每个回合重发完整上下文」，新增内容本身占比很小。输出 token 只有 36,550，说明消耗集中在上下文而非生成。

## 明细

### 2026-09-30 · 现状核对 + 文档校正 + Token 记录机制

- 会话文件：`C:\Users\Administrator\.workbuddy\projects\d-me-animation-flow\896bdb58-ee78-489a-a21e-2f0f9ef64604.jsonl`
- 取数时刻：2026-09-30 10:05:33
- 会话时间范围：2026-09-30 09:53:21 → 2026-09-30 10:05:32
- 有效 API 回合数：54

| 计费项 | Token 数 | 说明 |
| --- | ---: | --- |
| 未缓存输入 | 115,135 | input_tokens − cache_read，按原价计费 |
| 缓存命中输入 | 4,564,608 | 占全部输入的 97.5% |
| 输入合计 | 4,679,743 | 每次请求都要重发的上下文 |
| 输出 | 36,550 | 模型生成 |
| **总计** | **4,716,293** | 输入合计 + 输出 |

按模型拆分：

| 模型 | 回合 | 输入 | 输出 | 总计 |
| --- | ---: | ---: | ---: | ---: |
| deepseek-v4.1-flash | 54 | 4,679,743 | 36,550 | 4,716,293 |
