#!/usr/bin/env node
/**
 * dsh-android-ui 离线冒烟测试（无需启动 dsh、不碰运行中的 profile）。
 *
 * 覆盖四件事，都是"改坏了会静默失效"的地方：
 *   1. Node 半贡献的 index 注入行形状（结构化行协议）。
 *   2. 用【官方渲染器】renderIndexInjections 渲染真实 index.html，断言 CSS/脚本落在
 *      head、polyfill 早于应用 module 脚本、viewport 被 tap 就地改写。
 *   3. 在 vm 里真跑注入的 polyfill：AbortSignal.any 能传播 abort、crypto.randomUUID
 *      产出 RFC 4122 v4 且不覆盖已有实现。
 *   4. 在 vm 里按 __ModuleLoader__ 协议加载浏览器半：apply 能装上全部效果，且
 *      disposer 真能把 DOM 恢复原状（键盘跟随的 html 样式）。
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let checks = 0
let failures = 0
function check(label, fn) {
  checks += 1
  try {
    fn()
    console.log(`  [ok]   ${label}`)
  } catch (error) {
    failures += 1
    console.log(`  [FAIL] ${label}\n         ${error.message}`)
  }
}

/** 定位已安装的 dsh（拿官方渲染器和真实 index.html；找不到就跳过相关断言）。 */
function findDsh() {
  const tryPaths = []
  try {
    const npmRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()
    tryPaths.push(join(npmRoot, '@deepseek-ai', 'dsh'))
  } catch {
    /* 无 npm 时只找常见路径 */
  }
  tryPaths.push('/data/data/com.termux/files/usr/lib/node_modules/@deepseek-ai/dsh')
  return tryPaths.find((p) => existsSync(join(p, 'node_modules', '@deepseek-ai', 'dsh-host-webserver', 'lib', 'index.js')))
}

console.log('[dsh-android-ui] smoke test')

// ---------------------------------------------------------------- 1. Node 半
const host = await import(join(root, 'lib', 'index.js'))

check('Node 半导出 name / inject / apply', () => {
  assert.equal(host.name, 'dsh-android-ui')
  assert.deepEqual(host.inject, ['webServer'])
  assert.equal(typeof host.apply, 'function')
})

check('注入行：一条 style + 一条 head script（顺序即渲染顺序）', () => {
  const rows = host.injectionRows()
  assert.equal(rows.length, 2)
  assert.equal(rows[0].kind, 'style')
  assert.ok(rows[0].text.includes('data-dsh-kb-open'), 'style 行应含键盘跟随相关规则')
  assert.equal(rows[1].kind, 'script')
  assert.equal(rows[1].placement, 'head', 'polyfill 必须在 head 解析期同步执行')
  assert.ok(rows[1].text.includes('AbortSignal.any'))
  assert.ok(rows[1].text.includes('randomUUID'))
})

// 作曲栏版式的尺寸契约：CSS 是文本注入，离线只能静态断言这两条互相咬合的规则；
// 真机版式仍要按 AGENTS.md 的"真机检查点"过一遍。
check('移动端 CSS：胶囊在卡片上方独立成排、发送键不折行', () => {
  const css = host.injectionRows().find((row) => row.kind === 'style').text
  // 旧的"整行上浮 40px + 输入框留白 40px"重叠版式必须已经拆掉。
  assert.ok(!css.includes('margin-top: -40px'), '不应再把工具行负位移压进输入框')
  const pills = /\.uV2eYG_modes,\s*\._7KE1Ra_root\s*\{([^}]*)\}/.exec(css)
  assert.ok(pills, '应能找到胶囊层规则')
  assert.ok(
    pills[1].includes('position: absolute') && pills[1].includes('bottom: 100%'),
    '胶囊应绝对定位到卡片上方（bottom:100% 以卡片为包含块）',
  )
  const gap = /margin-bottom:\s*(\d+)px/.exec(pills[1])
  const card = /\.uV2eYG_card:has\([^)]*\)\s*\{([^}]*)\}/.exec(css)
  assert.ok(gap && card, '应能找到胶囊间距与卡片预留高度')
  const reserved = /margin-top:\s*(\d+)px/.exec(card[1])
  assert.ok(reserved, '卡片应预留胶囊带')
  // 胶囊 28px 是宿主原值（本文件不覆盖），预留高度必须容得下它 + 间隔。
  assert.ok(
    Number(reserved[1]) >= 28 + Number(gap[1]),
    `卡片预留 ${reserved[1]}px 容不下 28px 胶囊 + ${gap[1]}px 间隔`,
  )
  const shrink = /\.uV2eYG_modes > \*\s*\{([^}]*)\}/.exec(css)
  assert.ok(
    shrink && shrink[1].includes('flex-shrink: 0'),
    '胶囊不许收缩：宿主默认 flex-shrink:1 会把标签折成两行、胶囊顶到 44px，预留带就装不下',
  )
  const row = /\.uV2eYG_row\s*\{([^}]*)\}/.exec(css)
  assert.ok(row, '应能找到工具行规则')
  assert.ok(row[1].includes('flex-wrap: nowrap'), '底行不折行，发送键才固定停在右下角')
  assert.ok(row[1].includes('container-type: normal'), '行盒必须让出包含块（否则胶囊落回输入框上）')
})

check('viewport 内容含 viewport-fit=cover 与 interactive-widget', () => {
  assert.ok(host.VIEWPORT_CONTENT.includes('viewport-fit=cover'))
  assert.ok(host.VIEWPORT_CONTENT.includes('interactive-widget=resizes-content'))
})

check('apply 订阅 index-inject 并注册 tapIndex（disposer 交给 ctx.effect）', () => {
  let listener
  const taps = []
  let owned
  const ctx = {
    on(event, fn) {
      assert.equal(event, 'webserver/index-inject')
      listener = fn
    },
    effect(fn) {
      owned = fn()
    },
    webServer: {
      tapIndex(transform) {
        taps.push(transform)
        return () => {
          taps.length = 0
        }
      },
    },
  }
  host.apply(ctx)
  const table = []
  listener(table)
  assert.equal(table.length, 2)
  assert.equal(taps.length, 1, 'tapIndex 应被调用一次')
  assert.equal(typeof owned, 'function', 'ctx.effect 应拿到 disposer')
  owned()
  assert.equal(taps.length, 0, 'disposer 应能摘除 tap')
})

check('rewriteViewportMeta：就地替换，两种 attribute 顺序都认', () => {
  const a = host.rewriteViewportMeta('<head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>')
  assert.ok(a.includes(`content="${host.VIEWPORT_CONTENT}"`))
  assert.equal(a.match(/<meta/g).length, 1, '不应新增重复 meta')
  const b = host.rewriteViewportMeta('<head><meta content="width=device-width" name="viewport"></head>')
  assert.ok(b.includes(`content="${host.VIEWPORT_CONTENT}"`))
  const c = host.rewriteViewportMeta('<head><title>x</title></head>')
  assert.ok(c.includes(host.VIEWPORT_CONTENT), '没有 viewport 时应补一个')
})

// ------------------------------------------- 2/3. 官方渲染器 + 真实 index.html
const dshRoot = findDsh()
let rendered = null
if (!dshRoot) {
  console.log('  [skip] 未找到已安装的 dsh：跳过官方渲染器与真实 index.html 断言')
} else {
  const { renderIndexInjections } = await import(
    join(dshRoot, 'node_modules', '@deepseek-ai', 'dsh-host-webserver', 'lib', 'index.js')
  )
  const distIndex = join(dshRoot, 'node_modules', '@deepseek-ai', 'dsh-web-frontend', 'dist', 'index.html')

  check('真实 index.html：viewport 被改写、meta 不重复、已是目标时幂等', () => {
    const html = readFileSync(distIndex, 'utf8')
    const out = host.rewriteViewportMeta(html)
    assert.ok(out.includes(host.VIEWPORT_CONTENT), '改写后应含目标 viewport')
    assert.equal((out.match(/<meta/g) || []).length, (html.match(/<meta/g) || []).length, 'meta 数量不应变化')
    // 若该部署此前已被 apply-frontend.sh 注入过同样的 viewport，改写必须原样返回（幂等）。
    if (html.includes(host.VIEWPORT_CONTENT)) {
      assert.equal(out, html, '已是目标 viewport 时改写应完全幂等')
    }
    // 除 viewport 那一处外，文档其余部分必须逐字不变。
    const strip = (text) => text.replace(/<meta\s+name=["']viewport["'][^>]*>/i, '<viewport/>')
    assert.equal(strip(out), strip(html), '除 viewport 外的内容不应有变化')
  })

  check('官方 renderIndexInjections：CSS 与 polyfill 落进 head，且 polyfill 早于应用脚本', () => {
    const html = readFileSync(distIndex, 'utf8')
    rendered = host.rewriteViewportMeta(renderIndexInjections(html, host.injectionRows()))
    const head = rendered.slice(0, rendered.search(/<\/head>/i))
    assert.ok(head.includes('dsh-android-ui'), 'CSS 注释标记应在 head 内')
    const polyfillAt = rendered.indexOf('AbortSignal.any')
    assert.ok(polyfillAt > 0, 'polyfill 应出现在渲染结果里')
    const moduleAt = rendered.search(/<script[^>]+type="module"/i)
    assert.ok(moduleAt > 0, '找不到应用 module 脚本，无法验证执行顺序')
    assert.ok(polyfillAt < moduleAt, 'polyfill 必须先于应用 module 脚本')
    assert.ok(rendered.includes('interactive-widget=resizes-content'), 'viewport 应带上 interactive-widget')
  })

  check('vm 真跑注入的 polyfill：AbortSignal.any 传播 abort、randomUUID 产出 v4', () => {
    const script = host.injectionRows().find((row) => row.kind === 'script').text
    const calls = { any: 0, uuid: 0 }
    const context = vm.createContext({
      AbortController,
      AbortSignal: class AbortSignal {},
      Array,
      Uint8Array,
      Object,
      console,
      crypto: {
        getRandomValues(array) {
          calls.uuid += 1
          for (let i = 0; i < array.length; i += 1) array[i] = (i * 7 + 3) & 0xff
          return array
        },
      },
    })
    context.AbortSignal.any = undefined
    vm.runInContext(script, context)
    assert.equal(typeof context.AbortSignal.any, 'function')
    const outer = new AbortController()
    const inner = new AbortController()
    const merged = context.AbortSignal.any([outer.signal, inner.signal])
    assert.equal(merged.aborted, false)
    outer.abort('boom')
    calls.any += 1
    assert.equal(merged.aborted, true, 'AbortSignal.any 应把 abort 传播到合并信号')
    assert.equal(merged.reason, 'boom', '应保留原始 abort reason')
    const uuid = context.crypto.randomUUID()
    assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/, `不是 v4 UUID: ${uuid}`)
    assert.equal(calls.uuid, 1, 'randomUUID 应走 getRandomValues')
    assert.ok(calls.any === 1)
  })

  check('polyfill 不覆盖已有实现（幂等装载）', () => {
    const script = host.injectionRows().find((row) => row.kind === 'script').text
    const sentinel = () => 'kept'
    const context = vm.createContext({
      AbortSignal: { any: sentinel },
      crypto: { randomUUID: sentinel, getRandomValues: () => {} },
      Array,
      Uint8Array,
      Object,
      console,
    })
    vm.runInContext(script, context)
    assert.equal(context.AbortSignal.any, sentinel)
    assert.equal(context.crypto.randomUUID, sentinel)
  })

  check('官方 loadOverlayPatches 解析本包 cordis.patch.yml（组合包层契约）', () => {
    const require = createRequire(join(root, 'noop.mjs'))
    const { loadOverlayPatches } = require(
      join(dshRoot, 'node_modules', '@deepseek-ai', 'dsh-app-boot', 'lib', 'index.js'),
    )
    const patches = loadOverlayPatches('dsh-android-ui:selfcheck', join(root, 'cordis.patch.yml'))
    assert.ok(Array.isArray(patches) && patches.length === 1, '应解析出一条 patch')
    const inserted = patches[0].insert
    assert.ok(Array.isArray(inserted) && inserted.length === 1, '应有一条 insert 行')
    assert.equal(inserted[0].id, 'dsh-android-ui')
    assert.equal(inserted[0].name, 'dsh-android-ui', '行必须按包名引用（不是相对路径）')
  })
}

// ------------------------------------------------------------ 5. 包契约
check('包契约：dsh.bundle / dsh.client / exports 与构建产物一致', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  assert.equal(pkg.name, 'dsh-android-ui', 'bundle 行 id 与客户端 bundle 注册 id 都取包名')
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(pkg.dsh.client.platform, 'web', '浏览器半必须声明 platform=web 才会被扫描')
  for (const rel of [pkg.dsh.bundle.patch, pkg.main, pkg.exports['./client'].default, pkg.exports['.'].default]) {
    assert.ok(existsSync(join(root, rel)), `package.json 引用的文件不存在：${rel}`)
  }
})

// ------------------------------------------------------------ 4. 浏览器半装载
check('浏览器半：按 __ModuleLoader__ 协议装载，apply 安装并可完整卸载', () => {
  const bundle = readFileSync(join(root, 'lib', 'client.js'), 'utf8')
  const listeners = new Map()
  const observers = []
  const rafs = new Map()
  let rafId = 0
  const htmlElement = {
    style: {
      height: '',
      setProperty(key, value) {
        this[key] = value
      },
      removeProperty(key) {
        this[key] = ''
      },
    },
    attrs: new Map(),
    setAttribute(k, v) {
      this.attrs.set(k, v)
    },
    getAttribute(k) {
      return this.attrs.get(k) ?? null
    },
    hasAttribute(k) {
      return this.attrs.has(k)
    },
    removeAttribute(k) {
      this.attrs.delete(k)
    },
  }
  const visualViewport = {
    height: 500,
    addEventListener(type, fn) {
      listeners.set(`vv:${type}`, fn)
    },
    removeEventListener(type) {
      listeners.delete(`vv:${type}`)
    },
  }
  // 最小节点桩：浏览器半会 createElement 出悬浮侧栏按钮并 append 到 body，
  // 靠它断言"注入过、卸载后摘干净"。
  const makeNode = (tag) => {
    const node = {
      tagName: tag,
      childNodes: [],
      attrs: new Map(),
      listeners: new Map(),
      style: {},
      setAttribute(k, v) {
        this.attrs.set(k, v)
      },
      getAttribute(k) {
        return this.attrs.get(k) ?? null
      },
      hasAttribute(k) {
        return this.attrs.has(k)
      },
      removeAttribute(k) {
        this.attrs.delete(k)
      },
      addEventListener(type, fn) {
        this.listeners.set(type, fn)
      },
      removeEventListener(type) {
        this.listeners.delete(type)
      },
      append(child) {
        this.childNodes.push(child)
      },
      remove() {
        const at = documentStub.body.childNodes.indexOf(this)
        if (at !== -1) documentStub.body.childNodes.splice(at, 1)
      },
      querySelector: () => null,
      cloneNode: () => makeNode(tag),
    }
    return node
  }
  const documentStub = {
    documentElement: htmlElement,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener(type, fn) {
      listeners.set(type, fn)
    },
    removeEventListener(type) {
      listeners.delete(type)
    },
    body: {
      childNodes: [],
      append(child) {
        this.childNodes.push(child)
      },
    },
    createElement(tag) {
      return makeNode(tag)
    },
  }
  const windowStub = {
    innerWidth: 390,
    innerHeight: 800,
    visualViewport,
    addEventListener(type, fn) {
      listeners.set(`w:${type}`, fn)
    },
    removeEventListener(type) {
      listeners.delete(`w:${type}`)
    },
    requestAnimationFrame(fn) {
      rafId += 1
      rafs.set(rafId, fn)
      return rafId
    },
    cancelAnimationFrame(id) {
      rafs.delete(id)
    },
    setTimeout: () => 0,
    clearTimeout: () => {},
    getComputedStyle: () => ({
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      // 代表"Node 半的样式表已注入"：浏览器半靠这个变量决定要不要注入悬浮按钮。
      getPropertyValue: (key) => (key === '--dsh-android-ui-css' ? '1' : ''),
    }),
    dispatchEvent: () => true,
    Event: class Event {},
  }
  class MutationObserverStub {
    observe() {
      observers.push(this)
    }
    disconnect() {
      const at = observers.indexOf(this)
      if (at !== -1) observers.splice(at, 1)
    }
  }
  let registration
  const context = vm.createContext({
    window: Object.assign(windowStub, {
      __ModuleLoader__: {
        load(reg) {
          registration = reg
        },
      },
    }),
    document: documentStub,
    navigator: { maxTouchPoints: 1 },
    MutationObserver: MutationObserverStub,
    AbortController,
    Array,
    Object,
    Math,
    Event: windowStub.Event,
    console,
  })
  context.globalThis = context
  vm.runInContext(bundle, context)
  assert.ok(registration, 'bundle 应通过 window.__ModuleLoader__.load 注册')
  assert.equal(registration.id, 'dsh-android-ui', 'id 必须等于包名')
  const clientModule = registration.factory(() => {
    throw new Error('unexpected require')
  })
  assert.equal(clientModule.name, 'dsh-android-ui')
  assert.equal(typeof clientModule.apply, 'function')
  assert.equal(clientModule.inject.length, 0, 'inject 应为空数组（无服务依赖）')
  let dispose
  clientModule.apply({
    effect(fn) {
      dispose = fn()
    },
  })
  assert.equal(typeof dispose, 'function', 'apply 应返回 disposer 供框架回收')
  assert.ok(observers.length >= 1, '应安装 MutationObserver')
  assert.ok(listeners.size >= 3, '应安装 DOM/visualViewport 监听')
  assert.equal(documentStub.body.childNodes.length, 1, '应注入悬浮侧栏开关按钮')
  // 捕获阶段的"点会话行收起抽屉"判定：行内控件（三点菜单）不能算点行本身，
  // 否则菜单刚弹就被插件收掉抽屉（真机复现过）。这里只看两种情况是否安排收起。
  let scheduled = 0
  windowStub.setTimeout = () => {
    scheduled += 1
    return 0
  }
  const fireClick = ({ row, control, frame = true }) =>
    listeners.get('click')({
      target: {
        nodeType: 1,
        hasAttribute: () => false,
        closest: (sel) => {
          if (sel.includes('_sessionRow')) return row ? {} : null
          if (sel.includes('_frame')) return frame ? { hasAttribute: () => false } : null
          return control ? {} : null
        },
      },
    })
  fireClick({ row: true, control: true })
  assert.equal(scheduled, 0, '点会话行内的控件（三点菜单）不应收起抽屉')
  fireClick({ row: true, control: false })
  assert.equal(scheduled, 1, '点会话行本体应安排收起抽屉')
  // 模拟键盘弹出后再卸载，检查 DOM 被还原
  listeners.get('w:resize')?.()
  visualViewport.height = 500
  for (const fn of [...rafs.values()]) fn()
  dispose()
  assert.equal(observers.length, 0, '卸载应断开全部 observer')
  assert.equal(listeners.size, 0, '卸载应移除全部监听')
  assert.equal(documentStub.body.childNodes.length, 0, '卸载应摘掉注入的悬浮按钮')
  assert.equal(htmlElement.style.height, '', '卸载应还原 html 高度')
  assert.equal(htmlElement.attrs.has('data-dsh-kb-open'), false, '卸载应清掉键盘标记')
})

console.log(`\n[dsh-android-ui] ${checks - failures}/${checks} 项通过`)
process.exit(failures === 0 ? 0 : 1)
