const name = 'dsh-ui-todo-fix'

// 默认 CSS：开箱即用；profile 侧 override config.css 可整体替换（HMR 热生效，无需重启）
const DEFAULT_CSS = `
body section[data-testid="todo-panel"]{
  position: fixed; top: 104px; right: 16px;
  width: 320px; max-width: min(320px, calc(100vw - 32px));
  z-index: 9999; margin: 0;
  box-sizing: border-box;
  box-shadow: 0 8px 32px rgba(0,0,0,.35);
  max-height: calc(100vh - 120px); overflow-y: auto;
}
`

function apply(ctx, config) {
  const cfg = config ?? {}

  // 1) CSS 注入（v0.1 能力）：把 todo 面板固定到右上角
  const css = cfg.css ?? DEFAULT_CSS
  if (css) {
    ctx.inject(['webServer'], (httpCtx) => {
      httpCtx.effect(() => httpCtx.webServer.tapIndex((html) => {
        const style = `<style data-dsh-ui-todo-fix>${css}</style>`
        return html.includes('</head>')
          ? html.replace('</head>', style + '</head>')
          : html + style
      }), 'dsh-ui-todo-fix: inject css')
    })
  }

  // 2) 跨轮常驻（v0.2 能力）：dsh 原生在 turn/start（用户发消息）时把 todos 投影清空，
  //    todo 面板随之整体消失。这里按会话记录最近一次 todo/write 的值，在 turn/start 后
  //    立即重放一条 todo/write，让任务列表跨轮保持可见（不依赖任何 agent 行为习惯）。
  //    config.keepAcrossTurns = false 可关闭，恢复原生行为。
  if (cfg.keepAcrossTurns !== false) {
    const lastBySession = new Map()
    ctx.on('session/event', (session, event) => {
      if (event.type === 'todo/write') {
        lastBySession.set(session.id, event.data.todos)
      } else if (event.type === 'turn/start') {
        const last = lastBySession.get(session.id)
        if (last !== undefined) {
          // session/event 分发期间直接 append 会被 reentrancy 保护拒绝
          // （"session append cannot reenter..."），延后到微任务再写回
          queueMicrotask(() => {
            session.append('todo/write', { todos: last })
          })
        }
      }
    })
  }
}

export { name, apply }
