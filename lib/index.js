const name = 'dsh-todo-dock'

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
      }), 'dsh-todo-dock: inject css')
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
        // FIX-1：只记录合法的完整列表；非数组 junk 不进入重放，避免原样回放污染投影
        if (Array.isArray(event.data.todos)) lastBySession.set(session.id, event.data.todos)
      } else if (event.type === 'turn/start') {
        let last = lastBySession.get(session.id)
        if (last === undefined) {
          // FIX-4（v0.3.2）：跨重启恢复。进程重启后 lastBySession 为空，此时从该会话的
          // 事件日志（DSH 持久化恢复后 events 含完整历史）倒序懒扫描最后一条 todo/write，
          // 存入游标。扫描只在「本进程首次遇到该会话的 turn/start 且游标 miss」时发生一次，
          // 之后全部 O(1) 增量——不调 LLM、不写盘，纯内存遍历。
          last = lastTodoFromLog(session)
          if (last !== undefined) lastBySession.set(session.id, last)
        }
        if (last !== undefined) {
          // session/event 分发期间直接 append 会被 reentrancy 保护拒绝
          // （"session append cannot reenter..."），延后到微任务再写回
          queueMicrotask(() => {
            try {
              session.append('todo/write', { todos: last })
            } catch {
              // FIX-3：会话可能在 turn/start 与微任务之间被销毁/脱离，
              // append 抛错时静默丢弃，不向上传播、不崩宿主进程
            }
          })
        }
      } else if (event.type === 'session/disposed') {
        // FIX-2：会话销毁即清理条目，防止 Map 无界增长与 fork 死条目
        lastBySession.delete(session.id)
      }
    })
  }
}

// 从会话事件日志倒序找最后一条合法的 todo/write（跨重启恢复的唯一入口）。
// 命中即停：期望 O(1)（todo/write 通常在日志尾部），最坏 O(n) 纯内存遍历。
// 返回 undefined 表示日志里没有可恢复的列表（新会话 / 已被 compaction 剪掉），
// 此时保持原生行为（不重放），与 v0.2 一致、不会更坏。
function lastTodoFromLog(session) {
  const events = session.events
  if (!Array.isArray(events)) return undefined
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]
    if (event?.type === 'todo/write' && Array.isArray(event?.data?.todos)) return event.data.todos
  }
  return undefined
}

export { name, apply }
