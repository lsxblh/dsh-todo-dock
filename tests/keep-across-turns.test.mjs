// v0.3.2 修复的反馈环：mock Cordis ctx，验证跨轮常驻的 4 个修复点（含 FIX-4 跨重启恢复）
// + 原有行为不回归。单进程直跑（不走 node --test runner 的子进程）：node tests/keep-across-turns.test.mjs
import assert from 'node:assert/strict'
import { apply } from '../lib/index.js'

/** 构造一个可发出事件的假 ctx 与假 session。 */
function makeHarness() {
  const listeners = {}
  const taps = []
  const ctx = {
    on(type, fn) {
      ;(listeners[type] ??= []).push(fn)
      return () => {}
    },
    inject(deps, factory) {
      const httpCtx = {
        effect(fn) {
          fn()
        },
        webServer: {
          tapIndex(fn) {
            taps.push(fn)
            return () => {}
          }
        }
      }
      factory(httpCtx)
    },
    emit(type, ...args) {
      for (const fn of listeners[type] ?? []) fn(...args)
    },
    listeners,
    taps
  }
  return {
    ctx,
    makeSession(id = 's1', opts = {}) {
      const appends = []
      const session = {
        id,
        // 会话事件日志（真实 DSH 重启后从持久化恢复，events 含完整历史）
        events: opts.events ?? [],
        append(type, data) {
          if (opts.appendThrows) throw new Error('boom')
          appends.push({ type, data })
        }
      }
      return { session, appends }
    }
  }
}

/** 排空微任务队列（queueMicrotask 回调）。 */
const flushMicrotasks = () => new Promise((r) => setTimeout(r, 0))

let pass = 0
let fail = 0
async function run(name, fn) {
  try {
    await fn()
    pass += 1
    console.log(`  ✅ ${name}`)
  } catch (e) {
    fail += 1
    console.log(`  ❌ ${name} — ${e.message}`)
  }
}

const suite = async () => {
  console.log('── 基线：v0.1 CSS 注入不回归 ──')
  await run('CSS 注入仍注册 tapIndex', () => {
    const { ctx } = makeHarness()
    apply(ctx, { css: 'x{}' })
    assert.equal(ctx.taps.length, 1)
    const out = ctx.taps[0]('<html><head></head><body></body></html>')
    assert.ok(out.includes('data-dsh-ui-todo-fix'))
  })
  await run('config 缺省使用默认 CSS', () => {
    const { ctx } = makeHarness()
    apply(ctx)
    assert.equal(ctx.taps.length, 1)
    const out = ctx.taps[0]('<html><head></head></html>')
    assert.ok(out.includes('data-dsh-ui-todo-fix'))
  })

  console.log('── 基线：v0.2 跨轮常驻基本行为 ──')
  await run('todo/write 数组被记录并在 turn/start 后重放', async () => {
    const { ctx, makeSession } = makeHarness()
    apply(ctx, {})
    const { session, appends } = makeSession('s1')
    ctx.emit('session/event', session, {
      type: 'todo/write',
      data: { todos: [{ content: 'a', status: 'in_progress' }] }
    })
    ctx.emit('session/event', session, { type: 'turn/start' })
    await flushMicrotasks()
    assert.equal(appends.length, 1)
    assert.equal(appends[0].type, 'todo/write')
    assert.deepEqual(appends[0].data.todos, [{ content: 'a', status: 'in_progress' }])
  })
  await run('多会话隔离：只重放本会话的列表', async () => {
    const { ctx, makeSession } = makeHarness()
    apply(ctx, {})
    const s1 = makeSession('s1')
    const s2 = makeSession('s2')
    ctx.emit('session/event', s1.session, {
      type: 'todo/write',
      data: { todos: [{ content: 's1-task', status: 'in_progress' }] }
    })
    ctx.emit('session/event', s2.session, {
      type: 'todo/write',
      data: { todos: [{ content: 's2-task', status: 'in_progress' }] }
    })
    ctx.emit('session/event', s2.session, { type: 'turn/start' })
    await flushMicrotasks()
    assert.equal(s2.appends.length, 1)
    assert.equal(s2.appends[0].data.todos[0].content, 's2-task')
    assert.equal(s1.appends.length, 0)
  })

  console.log('── 修复点 1：非数组 junk 不记录 ──')
  await run('FIX-1: 非数组 todos 不被记录（junk 不原样回放）', async () => {
    const { ctx, makeSession } = makeHarness()
    apply(ctx, {})
    const { session, appends } = makeSession('s1')
    ctx.emit('session/event', session, { type: 'todo/write', data: { todos: { not: 'array' } } })
    ctx.emit('session/event', session, { type: 'turn/start' })
    await flushMicrotasks()
    assert.equal(appends.length, 0, 'junk 不应触发重放')
  })

  console.log('── 修复点 2：session/disposed 清理 ──')
  await run('FIX-2: session/disposed 后条目被清理，不再重放', async () => {
    const { ctx, makeSession } = makeHarness()
    apply(ctx, {})
    const { session, appends } = makeSession('s1')
    ctx.emit('session/event', session, {
      type: 'todo/write',
      data: { todos: [{ content: 'a', status: 'in_progress' }] }
    })
    ctx.emit('session/event', session, { type: 'session/disposed' })
    ctx.emit('session/event', session, { type: 'turn/start' })
    await flushMicrotasks()
    assert.equal(appends.length, 0, 'disposed 会话不应再被重放')
  })

  console.log('── 修复点 3：微任务内 append 抛错不崩 ──')
  await run('FIX-3: 重放时 append 抛错被吞掉（不向上传播）', async () => {
    const { ctx, makeSession } = makeHarness()
    apply(ctx, {})
    const { session } = makeSession('s1', { appendThrows: true })
    ctx.emit('session/event', session, {
      type: 'todo/write',
      data: { todos: [{ content: 'a', status: 'in_progress' }] }
    })
    ctx.emit('session/event', session, { type: 'turn/start' })
    await assert.doesNotReject(flushMicrotasks())
  })

  console.log('── 修复点 4：跨重启恢复（从会话日志懒扫描） ──')
  await run('FIX-4: 重启后 turn/start 从日志恢复最后一条 todo/write', async () => {
    const { ctx, makeSession } = makeHarness()
    apply(ctx, {})
    // 模拟重启后的新插件实例 + 从持久化恢复的会话（events 含历史 todo/write）
    const { session, appends } = makeSession('s1', {
      events: [
        { type: 'todo/write', data: { todos: [{ content: 'old', status: 'in_progress' }] } },
        { type: 'turn/end' }
      ]
    })
    ctx.emit('session/event', session, { type: 'turn/start' })
    await flushMicrotasks()
    assert.equal(appends.length, 1)
    assert.equal(appends[0].type, 'todo/write')
    assert.deepEqual(appends[0].data.todos, [{ content: 'old', status: 'in_progress' }])
  })
  await run('FIX-4: 日志末尾是 turn/start（原生投影已清空）也能恢复', async () => {
    const { ctx, makeSession } = makeHarness()
    apply(ctx, {})
    // 用户 bug 场景：最后一条相关事件是 turn/start，DSH 原生折叠为 null
    const { session, appends } = makeSession('s1', {
      events: [
        { type: 'todo/write', data: { todos: [{ content: 'survive', status: 'completed' }] } },
        { type: 'turn/start' }
      ]
    })
    ctx.emit('session/event', session, { type: 'turn/start' })
    await flushMicrotasks()
    assert.equal(appends.length, 1)
    assert.deepEqual(appends[0].data.todos, [{ content: 'survive', status: 'completed' }])
  })
  await run('FIX-4: 日志里没有 todo/write（新会话）不重放', async () => {
    const { ctx, makeSession } = makeHarness()
    apply(ctx, {})
    const { session, appends } = makeSession('s1', {
      events: [{ type: 'user/message' }, { type: 'assistant/message' }]
    })
    ctx.emit('session/event', session, { type: 'turn/start' })
    await flushMicrotasks()
    assert.equal(appends.length, 0)
  })
  await run('FIX-4: 日志里 junk todo/write 被跳过，扫到更早的合法列表', async () => {
    const { ctx, makeSession } = makeHarness()
    apply(ctx, {})
    const { session, appends } = makeSession('s1', {
      events: [
        { type: 'todo/write', data: { todos: [{ content: 'good', status: 'pending' }] } },
        { type: 'todo/write', data: { todos: { not: 'array' } } }
      ]
    })
    ctx.emit('session/event', session, { type: 'turn/start' })
    await flushMicrotasks()
    assert.equal(appends.length, 1)
    assert.deepEqual(appends[0].data.todos, [{ content: 'good', status: 'pending' }])
  })
  await run('FIX-4: 恢复后进程内增量更新仍生效（重放的是最新列表）', async () => {
    const { ctx, makeSession } = makeHarness()
    apply(ctx, {})
    const { session, appends } = makeSession('s1', {
      events: [
        { type: 'todo/write', data: { todos: [{ content: 'from-log', status: 'pending' }] } }
      ]
    })
    // 先恢复（turn/start 触发懒扫描），随后 agent 写新列表覆盖游标
    ctx.emit('session/event', session, { type: 'turn/start' })
    await flushMicrotasks()
    ctx.emit('session/event', session, {
      type: 'todo/write',
      data: { todos: [{ content: 'fresh', status: 'in_progress' }] }
    })
    ctx.emit('session/event', session, { type: 'turn/start' })
    await flushMicrotasks()
    assert.equal(appends.length, 2)
    assert.deepEqual(appends[1].data.todos, [{ content: 'fresh', status: 'in_progress' }])
  })

  console.log('── keepAcrossTurns 开关 ──')
  await run('keepAcrossTurns=false 时完全不注册监听器', async () => {
    const { ctx, makeSession } = makeHarness()
    apply(ctx, { keepAcrossTurns: false })
    const { session, appends } = makeSession('s1')
    ctx.emit('session/event', session, {
      type: 'todo/write',
      data: { todos: [{ content: 'a', status: 'in_progress' }] }
    })
    ctx.emit('session/event', session, { type: 'turn/start' })
    await flushMicrotasks()
    assert.equal(appends.length, 0)
  })
}

suite().then(() => {
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail === 0 ? 0 : 1)
})
