# dsh-todo-dock

![DeepSeek Harness](https://img.shields.io/badge/Built%20with-DeepSeek%20Harness-4D6BFE?logo=deepseek&logoColor=white)
![License](https://img.shields.io/github/license/lsxblh/dsh-todo-dock?logo=github)
![Version](https://img.shields.io/github/v/tag/lsxblh/dsh-todo-dock?label=version)

DeepSeek Harness Web GUI 插件：把 todo 面板从聊天输入框上方**停靠到界面右上角**（`position: fixed`），不占文档流、不挡输入，并让任务列表**跨轮常驻**不消失。纯 CSS 注入 + host 侧机制级重放，不碰任何组件逻辑。

> **改名说明**：v0.3.0 起由 `dsh-ui-todo-fix` 更名为 `dsh-todo-dock`（v0.2.x 及更早均为原名）。

![效果：todo 面板停靠右上角](https://github.com/lsxblh/dsh-todo-dock/raw/main/assets/screenshot.png)

## 特性

- 零依赖、纯 Host 插件，核心代码 ~50 行
- 走官方注入钩子 `webServer.tapIndex`（与内置主题插件同构）
- CSS 内容由 `config.css` 驱动：**热调样式无需重启**（改 profile 的 `cordis.patch.yml` → HMR 生效 → 刷新页面）
- **跨轮常驻**：todo 列表在发消息（新 turn）后不消失——机制级实现，不依赖任何 agent 行为习惯（v0.2 新增）
- **健壮性加固**（v0.2.1）：非数组 junk 不重放 / Map 随会话销毁清理 / 重放错误隔离，附 8 用例回归测试
- 内置默认样式，装完即有默认效果
- 标准 `dsh.bundle` 形态：`dsh plugin add` 自动登记进 profile bundles

## 跨轮常驻

dsh 原生机制：`turn/start`（用户发消息开启新一轮）会把 todos 投影清空，todo 面板随之整体消失，直到 agent 本轮重新调用 `todo_write`。

本插件在 host 侧监听 `session/event`：按会话记录最近一次 `todo/write` 的列表，`turn/start` 后立即重放一条 `todo/write`——任务列表跨轮保持可见，任何 agent 都无需额外动作。

- 默认开启；`config.keepAcrossTurns: false` 可关闭（恢复原生行为）
- agent 主动清空（写入空列表）后不会复活
- 每次 turn 会在会话事件流多追加一条 `todo/write`（合法事件，仅用于恢复）

## 机制

todo 面板（`section[data-testid="todo-panel"]`）由内置组件挂载在 `conversation.input.dock` 槽（`order: 0`），因此默认出现在输入框上方。本插件向 index.html 注入一段 `<style>`，把该面板 `position: fixed` 钉到右上角并加阴影/圆角/滚动。

> 注意：TodoPanel 是条件渲染的——当前会话没有 todo 任务时不显示面板，这是产品行为，与插件无关。

## 安装

依赖 DSH Web profile（`dsh plugin` 基于 pnpm，需本机有 pnpm）：

```bash
# 方式一：GitHub 发布包（推荐）
dsh plugin --profile web add https://github.com/lsxblh/dsh-todo-dock/archive/refs/tags/v0.3.1.tar.gz

# 方式二：本地源码目录
dsh plugin --profile web add file:/path/to/dsh-todo-dock
```

安装后**重启一次 dsh web 服务**（bundle 层在启动时组合）。装完面板即出现在右上角。

## 配置与热调

注入的 CSS 默认取包内 `DEFAULT_CSS`；想覆盖/调整，在 `~/.dsh/profiles/web/cordis.patch.yml` 追加：

```yaml
- id: dsh-todo-dock
  name: dsh-todo-dock
  config:
    css: |
      body section[data-testid="todo-panel"]{
        position: fixed; top: 104px; right: 16px;
        width: 320px; z-index: 9999; margin: 0;
        box-shadow: 0 8px 32px rgba(0,0,0,.35);
      }
```

改完无需重启：HMR 自动应用，刷新页面即生效。

默认 CSS（`lib/index.js` 的 `DEFAULT_CSS`）：

```css
body section[data-testid="todo-panel"]{
  position: fixed; top: 104px; right: 16px;
  width: 320px; max-width: min(320px, calc(100vw - 32px));
  z-index: 9999; margin: 0;
  box-sizing: border-box;
  box-shadow: 0 8px 32px rgba(0,0,0,.35);
  max-height: calc(100vh - 120px); overflow-y: auto;
}
```

## 卸载 / 回滚

```bash
dsh plugin --profile web remove dsh-todo-dock
```

并删除 `cordis.patch.yml` 中相关 override 行（如有）。

## 开发

```text
dsh-todo-dock/
├── package.json        # dsh.bundle.patch 声明（官方 bundle 形态）
├── cordis.patch.yml    # 向 profile 注入一行插件条目
├── lib/index.js        # 插件本体：inject webServer → tapIndex 注入 config.css + 跨轮重放
└── tests/              # 8 用例回归测试：node tests/keep-across-turns.test.mjs
```

修改后本地验证：`dsh plugin --profile web add file:<本目录>` → 重启 dsh web → 刷新页面。

## License

MIT
