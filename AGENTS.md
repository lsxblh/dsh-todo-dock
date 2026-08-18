# 项目（dsh-todo-dock）

DSH Web GUI 插件：todo 面板停靠右上角（CSS 注入）+ 跨轮常驻（机制级重放）。注意**工作区目录名 `dsh-ui-todo-fix` 是旧名**——v0.3.0 起包名 / 仓库名 / 插件 id 均为 `dsh-todo-dock`。

- 无 npm scripts；测试单进程直跑：`node tests/keep-across-turns.test.mjs`
- 开发验证：`dsh plugin --profile web add file:<本目录>` → 重启 dsh web → 刷新页面
- CSS 热调：改 `~/.dsh/profiles/web/cordis.patch.yml` 的 `config.css` → HMR 生效，无需重启
- 发版：同步 package.json `version` 与 git tag（v0.3.2 出现过 tag/version 不同步）

# Agent skills

### Issue tracker

Issues live in GitHub Issues（lsxblh/dsh-todo-dock，用 gh CLI 读写）。See `docs/agents/issue-tracker.md`.

### Triage labels

五角色标签用中文：需要分诊 / 需要信息 / 待代理处理 / 待人工处理 / 不修复。See `docs/agents/triage-labels.md`.

### Domain docs

领域文档约定（`CONTEXT.md` / `docs/adr/` 惰性创建，不存在时静默继续、别主动建）见 `docs/agents/domain.md`。

# 代码审查增强层（可选 · 自主判断 · 不强制）

`/code-review` 双轴之外，本工作区有两个**可选**增强，按改动形态自主决定是否启用——尊重 `/code-review` 原流程，**不改动任何 skill**：

**① OCR delegate —— 双轴的前置输入（管"范围"）**

双轴审查开始前，若目标是 git 仓库且有可审改动（未提交或历史 commit），先跑 `ocr delegate preview`（workspace / `--from --to` / `-c <commit>` 模式，无需 `git add`/`commit`）+ `ocr delegate rule <files>`（每类文件的审查规则）。ocr（open-code-review）不在系统 PATH 时，用 `node <npm 全局目录>/node_modules/@alibaba-group/open-code-review/bin/ocr.js delegate preview` 全路径调用，或临时把 npm 全局 bin 加入 PATH。用其"可审文件清单"核对双轴 sub-agent 的文件覆盖，规则组当通用缺陷清单喂给双轴。

**② 对抗性 subagent —— 双轴之后的复核（管"置信"）**

双轴完成后，涉及并发 / 状态机 / 边界 / 安全的改动，派独立 sub-agent 做对抗复核：吃 ① 的规则清单当弹药，专挑双轴覆盖不到的边界 / 竞态 / 项目特有逻辑。

**三者不重叠**：OCR 管**范围**（确定性，不判断）→ 双轴管**判断**（需求 / 规范）→ 对抗性管**置信**（独立怀疑）。数据流单向：OCR → 双轴 → 对抗性。
