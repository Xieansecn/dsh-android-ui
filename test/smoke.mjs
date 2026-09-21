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
  // 新会话页没有上下文仪表面板时，trailing 里只剩发送键；它必须保留 flex 盒子，
  // 否则宿主/本文件给它的 margin-left:auto 会被 display:contents 一起拆掉。
  const trailing = /\.uV2eYG_trailing\s*\{([^}]*)\}/.exec(css)
  assert.ok(trailing, '应能找到 trailing 右对齐规则')
  assert.ok(trailing[1].includes('display: flex'), 'trailing 不能被 display:contents 拆掉')
  assert.ok(trailing[1].includes('margin-left: auto'), 'trailing 必须保留右推边距，发送键才会始终贴右')
  // 模型胶囊的宽度上限吃浏览器半写上的 --dsh-modes-w（"顶到权限胶囊再省略"），
  // 且必须有不用变量的兜底值，否则量尺寸的脚本来不及跑时两颗胶囊会重叠。
  // 注意：._7KE1Ra_root 在合并规则里也出现，这里直接找带变量的那条。
  const model = /\._7KE1Ra_root\s*\{([^}]*var\(--dsh-modes-w[^}]*)\}/.exec(css)
  assert.ok(model, '应能找到吃 --dsh-modes-w 的模型胶囊规则')
  assert.ok(model[1].includes('50%'), '模型胶囊宽度上限应带不依赖变量的兜底（一半宽度）')
  // 光标位置由输入框自己的 padding/line-height 决定，而提示词是宿主按它原生几何
  // （inset:4px 8px auto 14px）绝对定位的**平级**节点：本文件一改输入框，两边就错位。
  // 这两条规则的值必须始终相等（这是"光标与提示词对齐"的唯一保证）。
  const inputBox = /\.uV2eYG_input\s*\{([^}]*padding-top[^}]*)\}/.exec(css)
  const placeholder = /\.uV2eYG_placeholder\s*\{([^}]*)\}/.exec(css)
  assert.ok(inputBox && placeholder, '应能找到输入框与提示词规则')
  const value = (body, prop) => {
    const hit = new RegExp(`${prop}:\\s*([^;!]+)`).exec(body)
    return hit && hit[1].trim()
  }
  assert.equal(
    value(placeholder[1], 'top'),
    value(inputBox[1], 'padding-top'),
    '提示词的 top 必须等于输入框的 padding-top，否则光标与提示词上下错位',
  )
  assert.equal(
    value(placeholder[1], 'left'),
    value(inputBox[1], 'padding-left'),
    '提示词的 left 必须等于输入框的 padding-left，否则光标与提示词左右错位',
  )
  assert.equal(
    value(placeholder[1], 'line-height'),
    value(inputBox[1], 'line-height'),
    '提示词的行高必须等于输入框的行高，否则同一行里两条基线对不上',
  )
})

// 侧栏会话行沿用宿主尺寸：宿主 32px 高，曾经被本模块抬到 44px（触摸目标），
// 现在按"不改尺寸"的要求交回宿主 —— 谁再抬一次，这条会红。
check('移动端 CSS 不改侧栏会话行的尺寸', () => {
  const css = host.injectionRows().find((row) => row.kind === 'style').text
  assert.ok(
    !/\[class\*="_sessionRow"\][^{]*\{[^}]*min-height/.test(css),
    '侧栏会话行不应有 min-height 覆盖（沿用宿主原尺寸）',
  )
})

// 会话页头：让位给悬浮开关的左边距只许出现在 header 上（其他行各自再加偏移就
// 对不齐了），且必须够避开关闭态的悬浮开关（28px 按钮 + 8px 左距 + 8px 间隔）。
check('会话页头：各行共用同一条左基线，且避开悬浮开关', () => {
  const css = host.injectionRows().find((row) => row.kind === 'style').text
  const header = /\.wSkVaW_header\s*\{([^}]*)\}/.exec(css)
  const tabs = /\.wSkVaW_tabs\s*\{([^}]*)\}/.exec(css)
  assert.ok(header && tabs, '应能找到页头与标签页规则')
  const shorthand = /padding:\s*([^;!]+)/.exec(header[1])
  assert.ok(shorthand, '页头应有 padding 简写')
  const parts = shorthand[1].trim().split(/\s+/)
  const left = parts.length === 4 ? parts[3] : parts.length === 2 ? parts[1] : parts[0]
  assert.equal(left, '44px', '页头左内边距必须让开悬浮开关（28 + 8 + 8 = 44px）')
  assert.ok(/padding-left:\s*0/.test(tabs[1]), '标签页左内边距归零，才与标题共用同一条基线')
  assert.ok(
    !/\.wSkVaW_titleRow\s*\{[^}]*padding-left/.test(css),
    '标题行不许再自己加左内边距（会在 44px 基线上再加一段）',
  )
  // 预设胶囊（当前会话用的 preset）必须与标题同排：曾经写死 flex-basis:100% 让它
  // "独占一行"，结果标题与 preset 永远分两排、中间空一整行。
  const actions = /\.wSkVaW_headerActions\s*\{([^}]*)\}/.exec(css)
  assert.ok(actions, '应能找到页头操作区规则')
  assert.ok(
    /flex:\s*0 1 auto/.test(actions[1]) && !/flex:\s*0 0 100%/.test(actions[1]),
    '预设胶囊必须可与标题同排（flex-basis:100% 会把它顶到自己一行）',
  )
})

// 宿主类名核对：上游重新发布同一个 dsh 版本时哈希也会变（.h8S2Va_* → .ZKlsPq_* 等），
// 旧名字留在代码里不会报错、只是效果静默失效 —— 所以这里把"已核对过的旧名"钉住。
check('构建产物里没有已被宿主换掉的旧哈希类名', () => {
  const texts = [
    host.injectionRows().find((row) => row.kind === 'style').text,
    readFileSync(join(root, 'lib', 'client.js'), 'utf8'),
  ]
  for (const stale of ['h8S2Va', 'Md3f7G', '_list_19372_8', '_bubble_owhem_8']) {
    for (const text of texts) {
      assert.ok(!text.includes(stale), `旧哈希类名 ${stale} 应已按新构建更新`)
    }
  }
  // 反过来的坑：子代理下拉由宿主 createPortal + 内联坐标定位，本文件给它写
  // left/right/top !important 会盖掉内联样式（!important 赢过内联）→ 菜单跑偏。
  const css = texts[0]
  assert.ok(!/\.ZKlsPq_menu\s*[,{]/.test(css), '子代理下拉不能有 CSS 覆盖（会盖掉宿主内联坐标）')
})

// 悬浮开关的图标来源与尺寸：折叠态下 toggle 里的第一个 svg 是 sidebar.brand.mark
// 槽位的品牌标记（鱼 logo），克隆它就成了"左上角一个鱼按钮"（用户实测反馈）。
// 要的是宿主自己的面板图标；外观用应用自己的浮层按钮 token（悬在内容上，纯图标
// 无底色会被读成"飘着的图标"而不是按钮），尺寸与页头右上角那颗 ExpandButton 一致。
check('悬浮开关：克隆面板图标（非品牌标记）、按浮层 token 画、尺寸与右上角那颗一致', () => {
  const css = host.injectionRows().find((row) => row.kind === 'style').text
  const bundle = readFileSync(join(root, 'lib', 'client.js'), 'utf8')
  assert.ok(bundle.includes('.hHd-Xa_panelIcon'), '应从 toggle 里取 .hHd-Xa_panelIcon')
  assert.ok(bundle.includes('[data-sidebar-right-expand]'), '面板图标取不到时要能退到右上角那颗同款按钮')
  assert.ok(!/querySelector\(\s*['"]svg['"]\s*\)/.test(bundle), '不能取 toggle 里第一个 svg（那是品牌标记）')
  const fab = /\[data-dsh-nav-fab\]\s*\{([^}]*)\}/.exec(css)
  assert.ok(fab, '应有 [data-dsh-nav-fab] 基态规则')
  for (const decl of [
    'width: 28px',
    'height: 28px',
    'border: none',
    'background: var(--dsw-alias-button-floating-fill',
    'box-shadow: 0 2px 12px rgba(0, 0, 0, .18)',
  ]) {
    assert.ok(fab[1].includes(decl), `悬浮开关应像宿主浮层按钮那样有实体，缺少 ${decl}`)
  }
  assert.ok(
    !fab[1].includes('--dsw-elevation-stroke-color'),
    '描边应已换成阴影：不许再套 elevation token 里那条 0 0 0 .5px 描边',
  )
  assert.ok(
    /\[data-dsh-nav-fab\]:hover,\s*\[data-dsh-nav-fab\]:active/.test(css),
    '触摸端没有 hover，`:active` 必须一起给（点下去有反馈才像按钮）',
  )
  // 纵向位置与宿主展开态侧栏开关重合：抽屉里那颗 28px 开关上沿 22（列内边距 6 +
  // 行内边距 8 + 居中 8）、中线 36；本按钮同尺寸同中线 → 上沿也是 22。
  assert.ok(
    /top:\s*calc\(env\(safe-area-inset-top, 0px\) \+ 22px\)/.test(fab[1]),
    '悬浮开关的纵向位置必须与宿主展开态侧栏开关重合（28px、上沿 22px）',
  )
  const glyph = /\[data-dsh-nav-fab\]\s*svg\s*\{([^}]*)\}/.exec(css)
  assert.ok(glyph, '应有 [data-dsh-nav-fab] svg 字形规则')
  assert.ok(
    /width:\s*15px/.test(glyph[1]) && /height:\s*15px/.test(glyph[1]),
    '字形 15px，与右上角那颗 ExpandButton 一致',
  )
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
  const resizeObservers = []
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
  // 作曲栏桩：模型胶囊的宽度要按权限胶囊的实测宽度算（浏览器半会把它写成卡片的
  // --dsh-modes-w 自定义属性），这里给出卡片/权限胶囊两个最小节点。
  const styleStub = () => {
    const props = new Map()
    return {
      props,
      setProperty(k, v) {
        props.set(k, v)
      },
      getPropertyValue(k) {
        return props.get(k) ?? ''
      },
      removeProperty(k) {
        props.delete(k)
      },
    }
  }
  const cardStub = makeNode('div')
  cardStub.isConnected = true
  cardStub.style = styleStub()
  const modesStub = makeNode('div')
  modesStub.isConnected = true
  modesStub.width = 120
  modesStub.getBoundingClientRect = () => ({ width: modesStub.width })
  // 悬浮开关桩：折叠态下 toggle 里的**第一个** svg 是 sidebar.brand.mark 的品牌标记
  // （鱼 logo），面板图标排在它后面 —— 两个都放进来，断言被克隆的是面板图标那个。
  let drawerOpened = 0
  const brandMarkStub = makeNode('svg')
  brandMarkStub.cloneNode = () => ({ mark: 'brand' })
  const panelIconStub = makeNode('svg')
  panelIconStub.cloneNode = () => ({
    mark: 'panel',
    removed: [],
    removeAttribute(name) {
      this.removed.push(name)
    },
  })
  const toggleStub = makeNode('button')
  toggleStub.isConnected = true
  toggleStub.click = () => {
    drawerOpened += 1
  }
  toggleStub.querySelector = (sel) => {
    if (sel === '.hHd-Xa_panelIcon') return panelIconStub
    if (sel === 'svg') return brandMarkStub
    return null
  }
  const frameStub = makeNode('div')
  frameStub.isConnected = true
  frameStub.setAttribute('data-sidebar-collapsed', '')
  const documentStub = {
    documentElement: htmlElement,
    querySelector: (sel) => {
      if (sel === '[data-composer-card]') return cardStub
      if (sel === '.uV2eYG_modes') return modesStub
      if (sel === '.hHd-Xa_toggle') return toggleStub
      if (sel === '[class*="_frame"]') return frameStub
      return null
    },
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
    // 悬浮开关只在 ≤480px 且侧栏折叠时出现（matches=true 代表"就是这种手机状态"）。
    matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
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
  class ResizeObserverStub {
    constructor(cb) {
      this.cb = cb
      this.targets = []
      resizeObservers.push(this)
    }
    observe(el) {
      this.targets.push(el)
    }
    unobserve(el) {
      const at = this.targets.indexOf(el)
      if (at !== -1) this.targets.splice(at, 1)
    }
    disconnect() {
      this.targets.length = 0
      const at = resizeObservers.indexOf(this)
      if (at !== -1) resizeObservers.splice(at, 1)
    }
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
    ResizeObserver: ResizeObserverStub,
    AbortController,
    KeyboardEvent: class KeyboardEventStub {
      constructor(type, init = {}) {
        this.type = type
        Object.assign(this, init)
      }
    },
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
  // 卸载发生在 load 之前：deferred 安装必须被 cancelled 标记挡住，迟到的 load 不能
  // 把已经停掉的插件重新唤醒（否则插件停用后页面还会被改）。
  let disposeEarly
  clientModule.apply({
    effect(fn) {
      disposeEarly = fn()
    },
  })
  const earlyLoad = listeners.get('w:load')
  disposeEarly()
  assert.equal(listeners.has('w:load'), false, '卸载应摘掉 load 钩子')
  earlyLoad()
  assert.equal(observers.length, 0, '已卸载的插件不应被迟到的 load 唤醒')
  assert.equal(documentStub.body.childNodes.length, 0, '已卸载的插件不应注入按钮')
  let dispose
  clientModule.apply({
    effect(fn) {
      dispose = fn()
    },
  })
  assert.equal(typeof dispose, 'function', 'apply 应返回 disposer 供框架回收')
  // 安装推迟到 load 之后（避开宿主首屏挂载的突变风暴）：load 前只挂一个 load 钩子。
  assert.equal(observers.length, 0, 'load 前不应安装 observer')
  assert.equal(documentStub.body.childNodes.length, 0, 'load 前不应注入悬浮侧栏按钮')
  assert.equal(typeof listeners.get('w:load'), 'function', '应挂 load 钩子等待安装时机')
  listeners.get('w:load')?.()
  assert.ok(observers.length >= 1, 'load 后应安装 MutationObserver')
  assert.ok(listeners.size >= 3, 'load 后应安装 DOM/visualViewport 监听')
  assert.equal(documentStub.body.childNodes.length, 1, 'load 后应注入悬浮侧栏开关按钮')
  // 图标必须来自面板图标（与页头右上角那颗同款），不是品牌鱼 logo；克隆时剥掉宿主
  // 类名（右上角那颗是 scaleX(-1) 镜像版，留着会让字形翻向）。点击转发给宿主开关。
  const fabStub = documentStub.body.childNodes[0]
  assert.equal(fabStub.childNodes.length, 1, '悬浮开关应带上图标')
  assert.equal(fabStub.childNodes[0].mark, 'panel', '克隆的必须是面板图标，不是品牌标记')
  assert.equal(fabStub.childNodes[0].removed.join(','), 'class', '克隆后应剥掉宿主类名')
  assert.ok(fabStub.hasAttribute('data-dsh-nav-fab-visible'), '折叠态下按钮应置为可见')
  fabStub.listeners.get('click')?.()
  assert.equal(drawerOpened, 1, '点悬浮开关应转发给宿主自己的 toggle')
  // 模型胶囊宽度跟随权限胶囊：装上先量一次写进卡片变量，尺寸变化后再量（CSS 的
  // max-width 用这个变量把模型标签顶到权限胶囊前 12px 再省略）。
  assert.equal(resizeObservers.length, 1, '应挂一个 ResizeObserver 量权限胶囊宽度')
  assert.ok(resizeObservers[0].targets.includes(modesStub), '应观察权限胶囊')
  assert.equal(cardStub.style.getPropertyValue('--dsh-modes-w'), '120px', '应把权限胶囊实测宽度写进卡片变量')
  modesStub.width = 150
  resizeObservers[0].cb()
  assert.equal(cardStub.style.getPropertyValue('--dsh-modes-w'), '150px', '权限胶囊变宽后应重写变量')
  // 捕获阶段的"点会话行收起抽屉"判定：行内控件（三点菜单）不能算点行本身，
  // 否则菜单刚弹就被插件收掉抽屉（真机复现过）。这里只看两种情况是否安排收起。
  let scheduled = 0
  windowStub.setTimeout = () => {
    scheduled += 1
    return 0
  }
  const fireClick = ({ row, control, frame = true, trigger = false }) =>
    listeners.get('click')({
      target: {
        nodeType: 1,
        hasAttribute: () => false,
        closest: (sel) => {
          if (sel.includes('ZKlsPq_trigger')) return trigger ? {} : null
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
  // 子代理血缘触发器：宿主只绑了 hover（onMouseEnter → 150ms）与 ArrowDown，当前会话
  // 那一颗连 onClick 都没有 —— 触摸端点第二下不会再派发 mouseenter，菜单就打不开。
  // 我们等一拍确认菜单没开，再补发一次 ArrowDown（宿主自己的键盘路径）。
  const timers = []
  windowStub.setTimeout = (fn) => {
    scheduled += 1
    timers.push(fn)
    return timers.length
  }
  const dispatched = []
  const triggerStub = { dispatchEvent: (event) => dispatched.push(event) }
  const tapTrigger = () =>
    listeners.get('click')({
      target: {
        nodeType: 1,
        hasAttribute: () => false,
        closest: (sel) => (sel.includes('ZKlsPq_trigger') ? triggerStub : null),
      },
    })
  tapTrigger()
  assert.equal(timers.length, 1, '点触发器应等一拍再确认菜单开没开')
  timers.pop()()
  assert.equal(dispatched.length, 1, '菜单没开时应补发宿主键盘路径')
  assert.equal(dispatched[0].key, 'ArrowDown', '补发的必须是 ArrowDown（宿主的打开按键）')
  // 菜单已经被合成的 mouseenter 打开：不能再补发，否则等于和用户对着开
  const menuStub = {}
  const realQuery = documentStub.querySelector
  documentStub.querySelector = (sel) => (sel === '.ZKlsPq_menu' ? menuStub : realQuery(sel))
  tapTrigger()
  timers.pop()()
  assert.equal(dispatched.length, 1, '菜单已开时不应重复补发')
  documentStub.querySelector = realQuery
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
  assert.equal(resizeObservers.length, 0, '卸载应断掉 ResizeObserver')
  assert.equal(cardStub.style.getPropertyValue('--dsh-modes-w'), '', '卸载应清掉卡片上的宽度变量')
})

console.log(`\n[dsh-android-ui] ${checks - failures}/${checks} 项通过`)
process.exit(failures === 0 ? 0 : 1)
