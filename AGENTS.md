# Agent skills

### Issue tracker

Issues live in GitHub Issues（lsxblh/dsh-todo-dock，用 gh CLI 读写）。See `docs/agents/issue-tracker.md`.

### Triage labels

五角色标签用中文：需要分诊 / 需要信息 / 待代理处理 / 待人工处理 / 不修复。See `docs/agents/triage-labels.md`.

### Domain docs

Single-context —— 根目录一个 `CONTEXT.md` + `docs/adr/`。See `docs/agents/domain.md`.

# 代码审查增强层（可选 · 自主判断 · 不强制）

`/code-review` 双轴之外，本工作区有两个**可选**增强，按改动形态自主决定是否启用——尊重 `/code-review` 原流程，**不改动任何 skill**：

**① OCR delegate —— 双轴的前置输入（管"范围"）**

双轴审查开始前，若目标是 git 仓库且有可审改动（未提交或历史 commit），先跑 `ocr delegate preview`（workspace / `--from --to` / `-c <commit>` 模式，无需 `git add`/`commit`）+ `ocr delegate rule <files>`（每类文件的审查规则）。ocr 不在系统 PATH，pwsh 用全路径：`node C:\npm-global\node_modules\@alibaba-group\open-code-review\bin\ocr.js delegate preview`。用其"可审文件清单"核对双轴 sub-agent 的文件覆盖，规则组当通用缺陷清单喂给双轴。

**② 对抗性 subagent —— 双轴之后的复核（管"置信"）**

双轴完成后，涉及并发 / 状态机 / 边界 / 安全的改动，派独立 sub-agent 做对抗复核：吃 ① 的规则清单当弹药，专挑双轴覆盖不到的边界 / 竞态 / 项目特有逻辑。

**三者不重叠**：OCR 管**范围**（确定性，不判断）→ 双轴管**判断**（需求 / 规范）→ 对抗性管**置信**（独立怀疑）。数据流单向：OCR → 双轴 → 对抗性。
