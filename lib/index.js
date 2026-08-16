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
  const css = config?.css ?? DEFAULT_CSS
  if (!css) return
  ctx.inject(['webServer'], (httpCtx) => {
    httpCtx.effect(() => httpCtx.webServer.tapIndex((html) => {
      const style = `<style data-dsh-ui-todo-fix>${css}</style>`
      return html.includes('</head>')
        ? html.replace('</head>', style + '</head>')
        : html + style
    }), 'dsh-ui-todo-fix: inject css')
  })
}

export { name, apply }
