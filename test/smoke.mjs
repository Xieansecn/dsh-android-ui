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
  assert.ok(rows[0].text.includes('--dsh-android-ui-css: 1'), 'style 行应带样式表握手标记（浏览器半靠它决定要不要注入悬浮开关）')
  assert.equal(rows[1].kind, 'script')
  assert.equal(rows[1].placement, 'head', 'polyfill 必须在 head 解析期同步执行')
  assert.ok(rows[1].text.includes('AbortSignal.any'))
  assert.ok(rows[1].text.includes('randomUUID'))
})

// 作曲栏版式的尺寸契约：CSS 是文本注入，离线只能静态断言这两条互相咬合的规则；
// 真机版式仍要按 AGENTS.md 的"真机检查点"过一遍。
check('移动端 CSS：胶囊在卡片上方独立成排（外观同输入框）、发送键不折行', () => {
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
  const card = /\.uV2eYG_card:has\(([\s\S]*?)\)\s*\{([^}]*)\}/.exec(css)
  assert.ok(gap && card, '应能找到胶囊间距与卡片预留高度')
  // 0.1.7-rc.2 宿主新增 hidden=activity：会话跑起来时 tools / standardControls 整组藏掉，
  // 胶囊跟着消失 —— 此时不能再占那 36px（否则卡片上方留一条白带）。
  assert.ok(
    card[1].includes('.uV2eYG_tools:not([hidden])') && card[1].includes('.uV2eYG_standardControls:not([hidden])'),
    '胶囊带占位要跟着宿主的 hidden 走（tools/standardControls 被 hidden 时不占位）',
  )
  const reserved = /margin-top:\s*(\d+)px/.exec(card[2])
  assert.ok(reserved, '卡片应预留胶囊带（真占位，胶囊才不压输入框）')
  // 胶囊 28px 是宿主原值（本文件不覆盖），预留高度必须容得下它 + 间隔。
  assert.ok(
    Number(reserved[1]) >= 28 + Number(gap[1]),
    `卡片预留 ${reserved[1]}px 容不下 28px 胶囊 + ${gap[1]}px 间隔`,
  )
  // 两颗胶囊的观感：照输入框卡片那套画 —— 底色 = 卡片的 --dsw-specific-input-major，
  // 0.5px 极细描边 = 卡片自己 stroke 的颜色 --dsw-alias-border-l2，外加两层极淡投影。
  // 这一整套与左上角那颗悬浮开关**共用同一对变量**（--dsh-android-ui-chip-*，
  // 用户指定"按钮边缘与作曲栏一致"），两边因此不可能各飘各的。
  // 描边必须用 box-shadow 画：宿主那两颗触发器是 content-box（模型触发器实测
  // height:28px、border:none），真 border 会把胶囊撑到 29px、顶破上面的预留带。
  const pill = /\.uV2eYG_row \.uV2eYG_modes button\[class\*="_trigger"\],[\s\S]*?\._7KE1Ra_trigger\s*\{([^}]*)\}/.exec(css)
  assert.ok(pill, '应能找到权限/模型两颗胶囊的外观规则')
  assert.ok(
    pill[1].includes('background: var(--dsh-android-ui-chip-fill'),
    '胶囊底色必须与输入框卡片同色（--dsh-android-ui-chip-fill → --dsw-specific-input-major）',
  )
  assert.ok(
    /box-shadow:\s*var\(--dsh-android-ui-chip-edge/.test(pill[1]),
    '胶囊要有 0.5px 极细描边（与卡片 stroke 同色），由 box-shadow 画、不占布局',
  )
  assert.ok(
    !/\bborder:\s*[^;]*solid/.test(pill[1]),
    '描边不许写成真 border（content-box 下会把 28px 胶囊撑成 29px）',
  )
  // 共用变量的定义处：必须落在 **body** 上，不能放 :root —— 调色 token 是宿主写在
  // body{…} 里的，自定义属性里的 var() 在**声明所在元素**上求值，放 :root 会双双
  // 落到兜底值（深色主题下悬浮开关变回一块白）。
  const chip = /\nbody\s*\{([^}]*--dsh-android-ui-chip-fill[^}]*)\}/.exec(css)
  assert.ok(chip, '悬浮开关/胶囊共用的"边缘"变量应定义在 body 上（:root 取不到调色 token）')
  assert.ok(
    chip[1].includes('--dsh-android-ui-chip-fill: var(--dsw-specific-input-major'),
    '共用底色 = 输入框卡片的 --dsw-specific-input-major',
  )
  assert.ok(
    /--dsh-android-ui-chip-edge:\s*0 0 0 \.5px var\(--dsw-alias-border-l2/.test(chip[1]),
    '共用边缘 = 0.5px 极细描边（与卡片 stroke 同色）+ 两层极淡投影',
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
  assert.ok(
    /- 12px\)/.test(model[1]),
    '模型胶囊上限要扣掉与权限胶囊之间的 12px 间隔，否则会顶上去',
  )
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

// 抽屉底部的「设置」入口（sidebar.settings 座席 → .VOzbGW_trigger）套
// dsh-mobile-nav（dsh-web-mobile）那颗药丸的观感（描边 + 圆角 + 按下反馈），
// 但底色必须与抽屉背景分开 —— 透明底就是侧栏自己的 sidebar-fill，按钮和背景同色。
// 做法是直接沿用宿主同一列那颗「新建会话」的画法：button-elevated-fill + .5px border-l3。
check('侧栏设置入口：套 dsh-mobile-nav 药丸、底色与抽屉背景分开', () => {
  const css = host.injectionRows().find((row) => row.kind === 'style').text
  const pill = /\.VOzbGW_trigger:not\(\.VOzbGW_rail\)\s*\{([^}]*)\}/.exec(css)
  assert.ok(pill, '应能找到侧栏设置入口（.VOzbGW_trigger）的药丸规则')
  assert.ok(
    /background:\s*var\(--dsw-alias-button-elevated-fill/.test(pill[1]),
    '底色必须与抽屉背景分开（透明底 = 侧栏 sidebar-fill，同色分不出来；用宿主新建会话那颗的 elevated-fill）',
  )
  assert.ok(
    /border:\s*\.5px solid var\(--dsw-alias-border-l3/.test(pill[1]),
    '描边沿用宿主同一列那颗按钮的 .5px border-l3（4% 的 border-l1 在浅底上几乎看不见）',
  )
  assert.ok(/border-radius:\s*12px/.test(pill[1]), '药丸圆角 12px（与那颗药丸一致）')
  assert.ok(!/height:/.test(pill[1]), '高度沿用宿主的 42px 整行（触控目标，不照抄药丸的 34px）')
  assert.ok(
    !/\.VOzbGW_trigger\s*\{/.test(css),
    '规则要排除 .VOzbGW_rail（侧栏收起时那颗 36×36 圆钮套描边会变成带边框的圆）',
  )
  // 按下/悬停必须用**实色** token：interactive-bg-hover 是半透明的，
  // 当 background 用会把刚填上的底色又换回背景色（按下去按钮反而"消失"）。
  assert.ok(
    /\.VOzbGW_trigger:not\(\.VOzbGW_rail\):hover,\s*\.VOzbGW_trigger:not\(\.VOzbGW_rail\):active\s*\{\s*background:\s*var\(--dsw-alias-interactive-bg-hover-solid/.test(
      css,
    ),
    '按下反馈必须与 :hover 同列（触摸端没有 hover），且用实色 token 而不是半透明的 hover 色',
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
  // 注释里写历史沿革（"旧名 → 新名"）是必要的，所以核对只在**去掉注释后**的正文里做：
  // 真正会让效果静默失效的是规则/代码里留着旧名，不是注释里提到它。
  const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  const texts = [
    host.injectionRows().find((row) => row.kind === 'style').text,
    readFileSync(join(root, 'lib', 'client.js'), 'utf8'),
  ].map(stripComments)
  for (const stale of [
    'h8S2Va',
    'Md3f7G',
    '_list_19372_8',
    '_bubble_owhem_8',
    // 0.1.7-rc.2 换掉的（0.1.5-rc.1 的值）：下拉列表类名与 tooltip 气泡类名。
    '_list_1nxmc_8',
    '_bubble_1nw3t_1',
    // 0.2.0-rc.2 又换掉同一对（同一版本号重新发布也会换哈希）。
    '_list_gzo7u_7',
    '_bubble_ugtpz_1',
  ]) {
    for (const text of texts) {
      assert.ok(!text.includes(stale), `旧哈希类名 ${stale} 应已按新构建更新`)
    }
  }
  const css = texts[0]
  const bundle = texts[1]
  assert.ok(css.includes('._list_4ub78_7'), '下拉列表的不出屏规则应挂在 0.2.0-rc.2 的 ._list_4ub78_7 上')
  assert.ok(bundle.includes('._bubble_12mhf_1'), 'tooltip 探针应指向 0.2.0-rc.2 的 ._bubble_12mhf_1')
  assert.ok(css.includes('.eGxaPq_frame'), '轮次索引轨的显示覆盖应挂在 0.2.0-rc.2 的 .eGxaPq_* 上')
  // 宿主自己接管定位的那批（子代理/后台任务/模型菜单、用量上下文面板、tooltip 气泡）：
  // 它们现在都是 createPortal（或条件渲染）+ JS 算坐标 + 内联 style，本文件再写
  // left/right/top 的 !important 会盖掉内联值（!important 赢过内联）→ 菜单/面板跑偏。
  // 所以这些选择器在本文件里连出现都不该出现（只允许出现在注释里，故按规则块匹配）。
  assert.ok(!/\.ZKlsPq_menu\s*[,{]/.test(css), '子代理下拉不能有 CSS 覆盖（会盖掉宿主内联坐标）')
  for (const owned of ['JObwrW_panel', 'QsffPG_menu', '_7KE1Ra_menu']) {
    assert.ok(!new RegExp(`\\.${owned}\\s*[,{]`).test(css), `${owned} 的定位已由宿主接管，本文件不能再有规则块`)
  }
  assert.ok(!/\.JObwrW_trigger\s*\{/.test(css), '上下文按钮已是宿主自带文本，不能再覆盖它的尺寸')
  assert.ok(!/\.JObwrW_trigger::after/.test(css), '不能再给上下文按钮补 ::after 文案（会与宿主的百分比重复）')
})

// 抽屉动画：收起/展开必须走 transform（合成层）而不是 left（布局属性，每帧都要把
// 这条 280px 宽、带 28px 阴影的列重绘一遍）。宿主自己的横向面板就是这套 ——
// 右栏文件预览 .P3OORG_panel：收起 translate(100%)、展开 transform:none、
// transition:transform var(--ds-transition-duration-slow) var(--ds-ease-in-out)。
// 例外（必须保留）：列内的 position:fixed 弹出层（设置对话框 .VOzbGW_overlay、
// Cordis 控制面板 .Nqubda_panel）会把本列的 transform 当包含块、被夹成 280px，
// 所以 :has 命中时退回 left 隐藏。
check('抽屉动画：transform 滑动 + 宿主同款时长缓动，列内有 fixed 弹出层时退回 left', () => {
  const css = host.injectionRows().find((row) => row.kind === 'style').text
  const collapsed = /\[class\*="_frame"\] > \[class\*="_sidebarCol"\] \{([^}]*)\}/.exec(css)
  const expanded = /\[class\*="_frame"\]:not\(\[data-sidebar-collapsed\]\) > \[class\*="_sidebarCol"\] \{([^}]*)\}/.exec(css)
  assert.ok(collapsed && expanded, '应能找到抽屉收起/展开两条规则')
  assert.ok(/transform: translateX\(-100%\) !important/.test(collapsed[1]), '收起态用 transform 移出画布')
  assert.ok(
    !/left:\s*calc\(-1/.test(collapsed[1]),
    '收起态不该再用 left 偏移（布局属性，动画期间每帧重绘整列）',
  )
  assert.ok(
    /transition: transform var\(--dsh-android-ui-drawer-ms, 300ms\) var\(--ds-ease-in-out, cubic-bezier\(\.4, 0, \.2, 1\)\)/.test(
      collapsed[1],
    ),
    '抽屉过渡应为 transform + 宿主同款时长(300ms)/缓动(--ds-ease-in-out)',
  )
  assert.ok(/transform: none !important/.test(expanded[1]), '展开态必须把 transform 清零（残留会让整列偏移）')
  const root = /:root \{([^}]*)\}/.exec(css)
  assert.ok(root, '应能找到 :root 变量块')
  assert.ok(/--dsh-android-ui-drawer-ms: 300ms/.test(root[1]), '抽屉时长与宿主慢速过渡一致（300ms）')
  // 兜底：列内有 fixed 弹出层时退回 left 隐藏（transform 会成为它们的包含块）。
  const guard = /\[class\*="_frame"\] > \[class\*="_sidebarCol"\]:has\(([^)]*)\) \{([^}]*)\}/.exec(css)
  assert.ok(guard, '应有"列内有 fixed 弹出层"的 :has 兜底规则')
  assert.ok(guard[1].includes('.VOzbGW_overlay'), '兜底要认设置对话框')
  assert.ok(guard[1].includes('.Nqubda_panel'), '兜底要认 Cordis 控制面板（同样是列内 fixed 弹出层）')
  assert.ok(
    /transform: none !important/.test(guard[2]) && /left: calc\(-1 \* min\(280px, 84vw\)\) !important/.test(guard[2]),
    '兜底态必须无 transform、改回 left 隐藏',
  )
  const guardOpen = /\[class\*="_frame"\]:not\(\[data-sidebar-collapsed\]\) > \[class\*="_sidebarCol"\]:has\([^)]*\) \{([^}]*)\}/.exec(css)
  assert.ok(guardOpen && /left: 0 !important/.test(guardOpen[1]), '兜底态下展开必须把 left 收回来（否则抽屉消失）')
  // 减弱动态效果时这几条（含 :has 兜底，特异性更高）必须一起关掉过渡。
  const reduce = /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/.exec(css)
  assert.ok(reduce, '应能找到 prefers-reduced-motion 块')
  assert.equal(
    (reduce[0].match(/:has\(\.VOzbGW_overlay, \.Nqubda_panel\)/g) || []).length,
    2,
    'reduced-motion 里两条 :has 兜底选择器都要列出（特异性更高，漏了就还在动）',
  )
})

// 右栏（文件/终端 dock）在手机上：既要能打开（本文件把 frame 压成单列网格后，
// 右栏列会被自动排进隐式第 2 行 —— 真机实测 (0,844,390,0)，宿主却已经把状态切成
// "打开"，表现为"点右上角那颗按钮 → 按钮消失、什么都没开"），又要有滑动动画
// （宿主把滑动做在面板内部的 dock 子元素上，与我们搬运这一列叠在一起 = 观感上
// "面板瞬间到位、只有内容在动"；宽屏有动画、窄屏没有，用户对比后反馈）。
// 所以收起/展开整列都由本文件驱动，与左抽屉同一套 300ms + --ds-ease-in-out。
check('移动端 CSS：右栏由本文件驱动开合（覆盖层 + transform 滑动，收起时移出画布）', () => {
  const css = host.injectionRows().find((row) => row.kind === 'style').text
  const closed = /\[class\*="_frame"\] > \[class\*="_rightbarCol"\] \{([^}]*)\}/.exec(css)
  assert.ok(closed, '应有右栏列的基态（收起）规则')
  for (const decl of ['position: absolute', 'width: 100vw', 'z-index: 41', 'transform: translateX(100%)', 'visibility: hidden']) {
    assert.ok(closed[1].includes(decl), `右栏收起态缺少 ${decl}`)
  }
  assert.ok(
    /transition: transform var\(--dsh-android-ui-drawer-ms, 300ms\) var\(--ds-ease-in-out/.test(closed[1]),
    '右栏收起/展开要用与左抽屉同款的时长与缓动',
  )
  const open = /\[class\*="_frame"\]\[data-rightbar-fullscreen\] > \[class\*="_rightbarCol"\],[\s\S]{0,200}?\{([^}]*)\}/.exec(css)
  assert.ok(open, '应有右栏展开规则')
  assert.ok(/transform: none !important/.test(open[1]), '展开态必须把 transform 清零')
  assert.ok(/visibility: visible !important/.test(open[1]), '展开态必须让整列可见')
  assert.ok(
    /\[class\*="_frame"\]\[data-rightbar-fullscreen\] > \[class\*="_rightbarCol"\]/.test(css) &&
      /\[class\*="_frame"\]:not\(\[data-rightbar-collapsed\]\) > \[class\*="_rightbarCol"\]/.test(css),
    '两个打开触发条件都要认（390px 实测打开态是 collapsed 仍在 + fullscreen 新增）',
  )
  // 宿主自己做在 dock 子元素上的那层滑动必须中和，否则与本列的 transform 叠成两倍速。
  const neutral = /\[class\*="_frame"\] > \[class\*="_rightbarCol"\] \[data-dockkit-host=dock\],[\s\S]{0,240}?\{([^}]*)\}/.exec(css)
  assert.ok(neutral && /transform: none !important/.test(neutral[1]), '要中和宿主给 dock 子元素的 transform')
  assert.ok(!/pointer-events/.test(closed[1]), '收起态靠 translateX(100%) 移出画布，不需要 pointer-events 兜底')
  // reduced-motion 里右栏也要一起关（本文件驱动的东西一律尊重该设置）。
  const reduce = /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/.exec(css)
  assert.ok(reduce, '应能找到 prefers-reduced-motion 块')
  assert.ok(
    (reduce[0].match(/\[class\*="_rightbarCol"\]/g) || []).length >= 3,
    'reduced-motion 里右栏的三条选择器都要列出（基态 + 两个打开态）',
  )
})

// 悬浮开关的图标来源、尺寸与外观：折叠态下 toggle 里的第一个 svg 是 sidebar.brand.mark
// 槽位的品牌标记（鱼 logo），克隆它就成了"左上角一个鱼按钮"（用户实测反馈）。
// 要的是宿主自己的面板图标；边缘用与作曲栏（输入框卡片 + 权限/模型两颗胶囊）**同一对
// 变量**，纵向位置与页头右上角那颗文件预览入口（ExpandButton）平齐。
check('悬浮开关：克隆面板图标（非品牌标记）、边缘同作曲栏、与右上角那颗平齐', () => {
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
    // 边缘（底色 + 0.5px 细描边 + 两层极淡投影）与权限/模型两颗胶囊同一对变量：
    // 用户指定"按钮边缘与作曲栏一致"，写死自己的一套就又会飘。
    'background: var(--dsh-android-ui-chip-fill',
    'box-shadow: var(--dsh-android-ui-chip-edge',
  ]) {
    assert.ok(fab[1].includes(decl), `悬浮开关应沿用作曲栏那套边缘，缺少 ${decl}`)
  }
  // 不能再是"浮层按钮"那套：底色/阴影都与作曲栏不同（用户实测反馈不像同一套 UI）。
  for (const stale of ['button-floating-fill', '0 2px 12px rgba(0, 0, 0, .18)']) {
    assert.ok(!fab[1].includes(stale), `悬浮开关不该再用浮层按钮那套观感（${stale}）`)
  }
  assert.ok(
    !fab[1].includes('--dsw-elevation-stroke-color'),
    '描边要自己画在那对共享变量里，不在基态规则里套 elevation token',
  )
  assert.ok(
    /\[data-dsh-nav-fab\]:hover,\s*\[data-dsh-nav-fab\]:active/.test(css),
    '触摸端没有 hover，`:active` 必须一起给（点下去有反馈才像按钮）',
  )
  assert.ok(
    /\[data-dsh-nav-fab\]:hover,\s*\[data-dsh-nav-fab\]:active\s*\{\s*background:\s*var\(--dsw-alias-interactive-bg-hover-solid/,
    '按下反馈取作曲栏那颗 ＋ 的 hover 色（interactive-bg-hover-solid）',
  )
  // 纵向位置与页头右上角那颗 ExpandButton（文件预览入口）平齐：页头从视口顶起、
  // padding-top 6px，titleRow 里最高的孩子是子代理血缘触发器（28px）或那颗 27px 的
  // 按钮，居中 → 那颗按钮中线 20；本按钮 28px 取 top 6 时中线正好 20。
  assert.ok(
    /top:\s*calc\(env\(safe-area-inset-top, 0px\) \+ 6px\)/.test(fab[1]),
    '悬浮开关必须与页头右上角那颗文件预览入口平齐（top = safe-area + 6px，中线 20）',
  )
  // 页头是文档流、本按钮是 fixed：刘海要让位就得两边一起让，否则一开一合就错开。
  const header = /\.wSkVaW_header\s*\{([^}]*)\}/.exec(css)
  assert.ok(
    header && /padding-top:\s*calc\(env\(safe-area-inset-top, 0px\) \+ 6px\)/.test(header[1]),
    '页头 padding-top 必须与悬浮开关的 top 用同一个表达式（fixed 与文档流一起抬刘海）',
  )
  const glyph = /\[data-dsh-nav-fab\]\s*svg\s*\{([^}]*)\}/.exec(css)
  assert.ok(glyph, '应有 [data-dsh-nav-fab] svg 字形规则')
  assert.ok(
    /width:\s*15px/.test(glyph[1]) && /height:\s*15px/.test(glyph[1]),
    '字形 15px，与右上角那颗 ExpandButton 一致',
  )
})

// 轮次索引轨（原型 agent_chat_scroll_prototype.html 的右时间轴）在竖屏是**自绘**的：
// 宿主 TurnNavigator 只当引擎 + 预览层（刻度 opacity:0、整条 frame pointer-events:none），
// 可见可拖的那条由浏览器半按原型的 .rail/.tick/.position 逐条实现。
check('轮次索引轨：宿主让位成引擎、自绘轨道照原型铺满 + 右缘热区 + 减弱动效', () => {
  const css = host.injectionRows().find((row) => row.kind === 'style').text
  const mobile = css.slice(css.indexOf('@media (max-width: 480px)'))
  // 宿主 frame：常驻显示（预览卡要能被看到）但不能吃触摸 —— 后者漏 !important 就是
  // "看不见但吃触摸 / 只能点不能滑"（宿主 CSS 是运行期 append 到 head 的，同档它赢）。
  const frame = /\.eGxaPq_frame \{([^}]*)\}/.exec(mobile)
  assert.ok(frame, '应给出宿主 frame 的接管规则')
  assert.ok(/display: block !important/.test(frame[1]), '宿主用容器查询隐藏它，窄屏要覆盖成常驻布局')
  assert.ok(/opacity: 1/.test(frame[1]), 'frame 要可见，里面的预览卡才看得见')
  assert.ok(/pointer-events: none !important/.test(frame[1]), 'frame 不能再吃指针（漏 !important 会被宿主的 auto 顶掉）')
  // 加长：宿主的 frame **高度本来是内容高度**（= 刻度总长，8 轮只有 82px），只覆盖
  // max-height 根本量不到 —— 必须给确定的 height 并放掉它那条 420px 上限；自绘轨道的几何
  // 是从这条 frame 的 rect 抄的，所以两边一起变长、刻度才会铺满（真机"缩在中间"的根因）。
  assert.ok(
    /height: max\(0px, calc\(var\(--turn-rail-band, 100dvh\) - 40px\)\) !important/.test(frame[1]),
    'frame 要给确定的 height（不能只覆盖 max-height）',
  )
  assert.ok(/max-height: none !important/.test(frame[1]), '要放掉宿主那条 420px 的 max-height，否则 height 被截断')
  const scrollerRule = /\.eGxaPq_scroller \{([^}]*)\}/.exec(mobile)
  assert.ok(scrollerRule && /max-height: 100% !important/.test(scrollerRule[1]), '滚动容器要填满 frame（虚拟化视口更高、渐隐遮罩才有意义）')
  // 宿主刻度：用 opacity 藏（不能用 display:none —— 节距与内边距要从 rect 量）。
  const mark = /\.eGxaPq_mark \{([^}]*)\}/.exec(mobile)
  assert.ok(mark && /opacity: 0/.test(mark[1]), '宿主刻度要藏起来（自绘轨道接管画面）')
  assert.ok(!/display: none/.test(mark[1]), '不能用 display:none：rect 会全变 0，量不出换算关系')
  // 自绘轨道：66px 贴右缘、几何由浏览器半写的变量给、抽出是原型的 75px 滑入 + 450ms。
  const rail = /\[data-dsh-rail\] \{([^}]*)\}/.exec(mobile)
  assert.ok(rail, '应有自绘索引轨的规则块')
  assert.ok(/width: 66px/.test(rail[1]), '宽度照原型 66px')
  assert.ok(/top: var\(--dsh-rail-top/.test(rail[1]) && /height: var\(--dsh-rail-h/.test(rail[1]), '几何从宿主 frame 的实测 rect 抄过来')
  assert.ok(/transform: translateX\(75px\)/.test(rail[1]), '收起态照原型整条右移 75px')
  assert.ok(/transition: transform \.45s cubic-bezier\(\.22, 1, \.36, 1\)/.test(rail[1]), '抽出用原型的 450ms 缓动')
  const shown = /html\[data-dsh-rail-revealed\] \[data-dsh-rail\] \{([^}]*)\}/.exec(mobile)
  assert.ok(shown, '抽出态应有单独规则')
  assert.ok(/transform: none/.test(shown[1]) && /opacity: 1/.test(shown[1]), '抽出后回到原位并显形')
  // 抽出后轨道**仍然不接指针**：输入面永远是右缘那条热区，热区宽度两态一致 ——
  // 否则"隐藏时窄、抽出后 66px"，窄了压不准（"不能被触发"）、宽了吃掉正文滚动（"误触"）。
  assert.ok(!/pointer-events: auto/.test(shown[1]), '自绘轨道常驻 pointer-events:none（只是显示面）')
  assert.ok(!/touch-action/.test(shown[1]), '轨道的 touch-action 也不该在抽出态被改')
  // 刻度带：space-between 铺满（原型 .rail-lines），条数由浏览器半按"每根至少 11px"重算。
  const lines = /\[data-dsh-rail-lines\] \{([^}]*)\}/.exec(mobile)
  assert.ok(lines, '应有刻度带规则')
  assert.ok(/justify-content: space-between/.test(lines[1]), '刻度要铺满整条轨道（原型的间距自适应）')
  assert.ok(/inset: 18px 0/.test(lines[1]), '刻度带上下留 18px（照原型）')
  // 拖动中预览卡要跟着我们的刻度走（宿主那套固定节距几何与 space-between 的刻度对不上）。
  const cardRule = /html\[data-dsh-rail-dragging\] \.eGxaPq_preview \{([^}]*)\}/.exec(mobile)
  assert.ok(cardRule, '应有"拖动中预览卡跟指示器"的规则')
  assert.ok(/top: clamp\(/.test(cardRule[1]), '覆盖的是 top（宿主的 top 在样式表规则里，!important 盖得住）')
  assert.ok(/--dsh-rail-card-y/.test(cardRule[1]) && /!important/.test(cardRule[1]), '用我们写下的 y，并带 !important')
  // 读数只在拖动中显示（原型 .dragging .position）。
  assert.ok(
    /html\[data-dsh-rail-dragging\] \[data-dsh-rail-pos\] \{[^}]*opacity: 1/.test(mobile),
    '当前轮读数只在拖动时出现',
  )
  // 右缘热区。
  const edge = /\[data-dsh-rail-edge\] \{([^}]*)\}/.exec(mobile)
  assert.ok(edge, '应有右缘热区规则')
  assert.ok(edge && /touch-action: none/.test(edge[1]), '热区要常驻 touch-action:none，否则拖动会被页面滚动收走')
  assert.ok(/width: 24px/.test(edge[1]), '热区 24px（= 上限，与作曲栏发送键右缘齐平）：12/20px 都不够好按')
  assert.ok(!/pan-y/.test(mobile), '不能再出现 pan-y：浏览器会把竖向拖动当滚动收走，手势链直接断掉')
  assert.ok(/z-index: 8/.test(edge[1]), '热区层级高于自绘轨道、低于抽屉(40)/右栏(41)/遮罩(39)')
  // 减弱动效：抽出、哑铃、读数都要一起关（特异性更高的规则不会替它们关）。
  const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
  for (const selector of ['[data-dsh-rail],', '[data-dsh-rail] i,', '[data-dsh-rail-pos]']) {
    assert.ok(reduced.includes(selector), `减弱动效里应列出 ${selector}`)
  }
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
      // 自绘索引轨会用 style.setProperty 写几何变量（--dsh-rail-top/-h），
      // 所以桩的 style 要是真的 styleStub（styleStub 在本函数之后定义，调用时已就绪）。
      style: styleStub(),
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
    // 浏览器半在触摸兜底里 new MouseEvent/Event('mouseover')，vm 里没有 MouseEvent
    // 会退到 Event —— 桩要留下 type，断言才看得出补发的是什么事件。
    Event: class EventStub {
      constructor(type, init = {}) {
        this.type = type
        Object.assign(this, init)
      }
    },
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
  // 效果清单：tooltip 重吸附已随 0.1.7-rc.2 宿主自接管定位而删除（同子代理下拉），
  // 剩下的七条各自独立。多一条少一条都要在这里显式改。
  // 跨 realm：vm 里的数组原型不同，deepEqual 会误报，所以比字符串。
  assert.equal(
    clientModule.installers.map((fn) => fn.name).join(','),
    [
      'installTouchInteractions',
      'installAddButtonKeyboardGuard',
      'installEnterKeyHint',
      'installKeyboardFollow',
      'installSidebarFab',
      'installModelPillWidth',
      'installTurnRailScrub',
    ].join(','),
    '效果清单应与本文件/文档列出的七条一致（删掉 tooltip 重吸附后只增了轮次索引轨）',
  )
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
  // 三颗注入元素：悬浮侧栏开关（先装，childNodes[0]）、轮次索引轨的自绘轨道
  // （childNodes[1]）与它的右缘热区（childNodes[2]）。
  assert.equal(documentStub.body.childNodes.length, 3, 'load 后应注入悬浮开关、自绘索引轨与右缘热区')
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
  // 轮次索引轨（竖屏）：自绘轨道负责画面与手势，宿主轨道降级成"引擎 + 预览层"。
  // 这里用桩走一遍完整链路：滚动探头（量几何/排刻度）→ 右缘按下即抽出 → 在自绘轨道上
  // 拖动 = 定位（换算成宿主轮次下标、滚宿主容器、喂预览、画哑铃与读数）→ 松手点一次
  // 宿主刻度落定；再验证键盘、轻点、以及"拖动中不会被点击打断"的结构性保证。
  const railMarks = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({
    // 宿主的轮次号只出现在 aria-label 里（t('chat.turnNavigation.jump', {turn})）；
    // 最后一根刻意写成 9，用来断言读数/正文跟随走的是轮次号而不是 data-index + 1。
    attrs: new Map([
      ['data-index', String(i)],
      ['aria-label', i === 7 ? '跳转到第 9 轮' : `跳转到第 ${i + 1} 轮`],
    ]),
    style: styleStub(),
    dispatched: [],
    clicked: 0,
    getAttribute(k) {
      return this.attrs.get(k) ?? null
    },
    // 内容坐标 = 1 + i*10（宿主的内边距 1px + 10px 节距），屏幕位再减 scrollTop。
    getBoundingClientRect() {
      return { top: 100 + 1 + i * 10 - railScrollerStub.scrollTop, bottom: 110 + i * 10 - railScrollerStub.scrollTop }
    },
    dispatchEvent(event) {
      this.dispatched.push(event)
      return true
    },
    click() {
      this.clicked += 1
    },
  }))
  const railMarksBox = {
    // 宿主把 totalSize 写成刻度容器的 inline height —— 这是"总轮数"的首选来源
    // （scrollHeight 在内容比视口矮时会被视口撑大）。
    style: { height: '82px' },
    children: railMarks,
    querySelectorAll: () => railMarks,
    querySelector: (sel) => railMarks.find((mark) => sel.includes(`data-index="${mark.getAttribute('data-index')}"`)) ?? null,
  }
  const railFrameStub = makeNode('nav')
  railFrameStub.isConnected = true
  railFrameStub.getBoundingClientRect = () => ({ top: 64, height: 420 })
  // 转录容器与"每一轮的行"（宿主给每个 flow item 挂 data-chat-turn="轮次号"）。
  // 行在屏上的位置 = 容器顶 + 内容坐标 - scrollTop；这里把第 9 轮那一行放得很靠下，
  // 好让"对齐到 anchorY"真的产生一次 scrollTop 写入。
  const transcriptStub = makeNode('div')
  transcriptStub.isConnected = true
  // 行查询现在是"限定在会话滚动容器内"的，所以容器自己要能 querySelector。
  transcriptStub.querySelector = (sel) => {
    const found = /data-chat-turn="(\d+)"/.exec(sel)
    return found ? (rows.find((row) => String(row.turn) === found[1]) ?? null) : null
  }
  transcriptStub.querySelectorAll = () => rows
  transcriptStub.scrollTop = 0
  transcriptStub.clientHeight = 600
  transcriptStub.getBoundingClientRect = () => ({ top: 120, bottom: 720 })
  const rowStub = (turn, contentTop) => {
    const node = {
      attrs: new Map([['data-chat-turn', String(turn)]]),
      getAttribute(k) {
        return this.attrs.get(k) ?? null
      },
      setAttribute(k, v) {
        this.attrs.set(k, v)
      },
      removeAttribute(k) {
        this.attrs.delete(k)
      },
      hasAttribute(k) {
        return this.attrs.has(k)
      },
      getBoundingClientRect: () => ({ top: 120 + contentTop - transcriptStub.scrollTop, bottom: 180 + contentTop }),
    }
    node.turn = turn
    return node
  }
  const rows = [rowStub(1, 80), rowStub(9, 780)]
  const railScrollerStub = makeNode('div')
  railScrollerStub.isConnected = true
  railScrollerStub.scrollTop = 0
  railScrollerStub.clientHeight = 60
  railScrollerStub.scrollHeight = 82 // 8 轮 × 10px 节距 + 上下各 1px 内边距
  railScrollerStub.getBoundingClientRect = () => ({ top: 100, bottom: 160 })
  const railQuery = documentStub.querySelector
  documentStub.querySelector = (sel) => {
    if (sel === '.eGxaPq_frame') return railFrameStub
    if (sel === '.eGxaPq_scroller') return railScrollerStub
    if (sel === '.eGxaPq_marks') return railMarksBox
    if (sel.includes('_scrollBody') || sel.includes('data-conversation-scroll')) return transcriptStub
    if (sel.includes('data-chat-turn')) {
      const found = /data-chat-turn="(\d+)"/.exec(sel)
      return found ? (rows.find((row) => String(row.turn) === found[1]) ?? null) : null
    }
    return railQuery(sel)
  }
  // 自绘轨道本体（childNodes[1]）与右缘热区（childNodes[2]）。
  const railRootStub = documentStub.body.childNodes[1]
  const zoneStub = documentStub.body.childNodes[2]
  assert.ok(railRootStub.hasAttribute('data-dsh-rail'), '应注入自绘索引轨（childNodes[1]）')
  assert.ok(zoneStub.hasAttribute('data-dsh-rail-edge'), '应注入右缘热区（childNodes[2]）')
  assert.equal(zoneStub.getAttribute('role'), 'slider', '热区要扛 role=slider（宿主刻度被让位后，无障碍路径在这里）')
  const railLinesStub = railRootStub.childNodes[0]
  const railPosStub = railRootStub.childNodes[3]
  assert.ok(railLinesStub.hasAttribute('data-dsh-rail-lines'), '自绘轨道里应有刻度带')
  assert.ok(railPosStub.hasAttribute('data-dsh-rail-pos'), '自绘轨道里应有当前轮读数')
  // 自绘轨道上的"手指落点"桩：它不是宿主的可点元素，这正是"滑动不会被点击打断"的前提。
  const railTouchStub = { nodeType: 1, closest: () => null }
  railRootStub.contains = (node) => node === railTouchStub
  const outsideStub = { nodeType: 1, closest: () => null }
  const zoneTarget = { nodeType: 1, closest: (sel) => (sel.includes('data-dsh-rail-edge') ? {} : null) }
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
    assert.equal(typeof listeners.get(type), 'function', `应在 document 捕获阶段监听 ${type}`)
  }
  assert.equal(typeof listeners.get('scroll'), 'function', '应挂滚动探头（capture）')
  // 不在轨道/热区上的拖动：一律不进定位。
  listeners.get('pointerdown')({ target: outsideStub, pointerId: 9, clientX: 100, clientY: 120 })
  listeners.get('pointermove')({ target: outsideStub, pointerId: 9, clientX: 100, clientY: 260 })
  assert.equal(htmlElement.attrs.has('data-dsh-rail-revealed'), false, '不在起手面上的拖动不该抽出轨道')
  listeners.get('pointerup')({ target: outsideStub, pointerId: 9 })
  // 滚一下对话 → 抽出索引轨，并把宿主 frame 的几何抄给自绘轨道、按高度排好刻度。
  railLinesStub.getBoundingClientRect = () => ({ top: 82, height: 384 })
  listeners.get('scroll')({ target: { nodeType: 1, matches: () => true } })
  assert.ok(htmlElement.attrs.has('data-dsh-rail-revealed'), '滚动对话应让索引轨探头')
  assert.equal(railRootStub.style.getPropertyValue('--dsh-rail-top'), '64px', '自绘轨道的 top 应抄宿主 frame')
  assert.equal(railRootStub.style.getPropertyValue('--dsh-rail-h'), '420px', '自绘轨道的高应抄宿主 frame')
  // 刻度条数照原型 rebuildTicks()：min(轮次总数, max(2, min(39, floor(h/11)+1)))，h=384 → 35，取 8 轮。
  assert.equal(railLinesStub.childNodes.length, 8, '刻度条数应取"高度能放下的条数"与轮次总数的较小者')
  assert.equal(railRootStub.childNodes[2].textContent, '8', '尾号按原型写裸总数（first 才是 01）')
  // 右缘：手指一放上去就抽出（按住不动不会从手指底下淡出），松手不跳会话。
  htmlElement.removeAttribute('data-dsh-rail-revealed')
  listeners.get('pointerdown')({ target: zoneTarget, pointerId: 3, clientX: 388, clientY: 82 })
  assert.ok(htmlElement.attrs.has('data-dsh-rail-revealed'), '手指放到右缘应立即抽出索引轨')
  assert.equal(railMarks[0].clicked, 0, '光放在右缘不该跳会话')
  // 从热区顺势下拖：越过 4px 阈值才算拖动定位。
  listeners.get('pointermove')({ target: zoneTarget, pointerId: 3, clientX: 380, clientY: 100 })
  assert.ok(htmlElement.attrs.has('data-dsh-rail-dragging'), '拖起来后应进入拖动态（读数才显示）')
  // 指尖在最上方 → 进度 0 → 第 1 轮；宿主容器被滚到对应位置、预览卡跟过来。
  assert.equal(railPosStub.textContent, '01', '读数应跟着选中项走')
  assert.equal(zoneStub.getAttribute('aria-valuemax'), '8', 'aria-valuemax 应是量出来的轮次总数')
  assert.equal(zoneStub.getAttribute('aria-valuenow'), '1', 'aria-valuenow 应跟着选中项走')
  assert.equal(railMarks[0].dispatched.at(-1)?.type, 'pointermove', '应把选中刻度喂给宿主的预览路径')
  assert.equal(railMarks[0].dispatched.at(-1)?.bubbles, true, '补发的 pointermove 必须冒泡（宿主在根上监听）')
  // 拖到最下方 → 进度 1 → 最后一轮（换算不依赖"那颗刻度此刻有没有被虚拟化挂上"）。
  listeners.get('pointermove')({ target: zoneTarget, pointerId: 3, clientX: 380, clientY: 466 })
  // 读数走"宿主轮次号"（最后一根刻度的 aria-label 写的是 9），不是 data-index + 1。
  assert.equal(railPosStub.textContent, '09', '拖到底应选到最后一轮，且读数用宿主的轮次号')
  assert.equal(zoneStub.getAttribute('aria-valuenow'), '9', 'aria-valuenow 同样用轮次号')
  assert.equal(railScrollerStub.scrollTop, 22, '宿主轨道容器应被滚到该轮（8 轮内容高 82 - 视口 60）')
  // 实时指示消息：正文里这一轮的行被对齐到 anchorY = 24 + p×min(100, 视口高×0.16)，
  // 并且被打上 [data-dsh-rail-target] 标记（原型 .scrubbing .user.selected 的对应物）。
  // 第 9 轮的行内容坐标 780，视口 600 → anchor = 24 + 96 = 120 → scrollTop = 780 - 120 = 660。
  assert.equal(transcriptStub.scrollTop, 660, '拖动中正文应实时对齐到选中轮（原型 align()）')
  assert.equal(transcriptStub.style.overflowAnchor, 'none', '拖动期间要临时关掉浏览器滚动锚定（内容增长时它会自己挪 scrollTop）')
  assert.equal(htmlElement.style['--dsh-rail-card-y'], '402px', '拖动中要写下指示器的 y 给预览卡用（18 + p×刻度带高）')
  assert.ok(rows[1].hasAttribute('data-dsh-rail-target'), '选中轮那一行应被打上落点标记')
  assert.equal(rows[0].hasAttribute('data-dsh-rail-target'), false, '没被选中的行不该带标记')
  assert.equal(typeof listeners.get('wheel'), 'function', '应挂"用户接管"监听（原型 L62）')
  assert.equal(typeof listeners.get('touchstart'), 'function', '应挂"用户接管"监听（原型 L62）')
  assert.equal(typeof listeners.get('keydown'), 'function', '键盘输入也要能接管（宿主 READING_INTENTS 同口径）')
  assert.equal(railMarks[7].clicked, 0, '拖动过程中绝不能点任何宿主刻度（这正是"滑到一半跳轮"的根因）')
  const painted = railLinesStub.childNodes.map((tick) => tick.style.width)
  assert.ok(painted.includes('33px'), '选中处应吃到满宽 33px（原型 9+24*s²）')
  assert.ok(painted.filter((w) => w === '9px').length >= 4, '远处刻度回到基准 9px（渐强只覆盖四根）')
  listeners.get('pointerup')({ target: zoneTarget, pointerId: 3 })
  assert.equal(railMarks[7].clicked, 1, '松手才点一次宿主刻度落定（未加载轮次由宿主先分页）')
  assert.equal(railMarks[7].dispatched.at(-1)?.type, 'pointerout', '收尾要撤掉宿主的预览卡')
  assert.equal(htmlElement.attrs.has('data-dsh-rail-dragging'), false, '松手要退出拖动态')
  assert.equal(rows[1].hasAttribute('data-dsh-rail-target'), false, '松手要撤掉落点标记')
  assert.equal(htmlElement.style['--dsh-rail-card-y'], '', '松手要撤掉预览卡的 y 变量')
  assert.equal(transcriptStub.style.overflowAnchor, '', '松手要还原滚动锚定')
  const holdRaf = [...rafs.values()].at(-1)
  assert.equal(typeof holdRaf, 'function', '松手后应排一帧做漂移纠正')
  holdRaf()
  // 780(行内容坐标) - 24 = 756：松手后的锚点换成宿主落位用的那个 24px，
  // 否则我们按 24+p×ratio 写、它按 24 落位，430ms 里会互相拉。
  assert.equal(transcriptStub.scrollTop, 756, '松手后的钉住要用宿主那套 24px 锚点')
  // settle 里那次漂移纠正**不能**把落点标记重新点亮 —— 否则高亮会赖在那一行不走（真机报障）。
  assert.equal(rows[1].hasAttribute('data-dsh-rail-target'), false, '松手后的漂移纠正不该重新点亮落点标记')
  // 两段式的第二段：轨道**已经抽出**时，"点一下不拖"= 松手跳到指尖那根刻度。
  // y=180：progress=(180-82)/384≈0.255 → round(0.255×7)=2 → 第 3 轮。
  const clickedBeforeTap = railMarks.reduce((n, m) => n + m.clicked, 0)
  assert.ok(htmlElement.attrs.has('data-dsh-rail-revealed'), '此时轨道应显示着（上一步的拖动留下的）')
  const posBeforeTap = railPosStub.textContent
  listeners.get('pointerdown')({ target: zoneTarget, pointerId: 6, clientX: 386, clientY: 180 })
  assert.equal(railPosStub.textContent, posBeforeTap, '按下瞬间不该先跳（观感突然、也像误触）')
  assert.equal(railMarks[2].clicked, 0, '按下不落定')
  listeners.get('pointerup')({ target: zoneTarget, pointerId: 6 })
  assert.equal(railPosStub.textContent, '03', '松手才落到指尖那根刻度（点一下不拖）')
  assert.equal(
    railMarks.reduce((n, m) => n + m.clicked, 0),
    clickedBeforeTap + 1,
    '只落定一次',
  )
  assert.equal(railMarks[2].clicked, 1, '落定的应是第 3 轮那根刻度')
  // 按在自绘轨道本体上（不是热区）不该起手 —— 它只是显示面。
  const posBeforeRailPress = railPosStub.textContent
  listeners.get('pointerdown')({ target: railTouchStub, pointerId: 4, clientX: 366, clientY: 82 })
  listeners.get('pointermove')({ target: railTouchStub, pointerId: 4, clientX: 366, clientY: 240 })
  assert.equal(railPosStub.textContent, posBeforeRailPress, '按在轨道本体上不该起手定位')
  listeners.get('pointerup')({ target: railTouchStub, pointerId: 4 })
  // 键盘：宿主刻度让位后无障碍路径在热区上（keydown 移动、keyup 落定，长按连发只跳一次）。
  zoneStub.listeners.get('keydown')({ key: 'Home', preventDefault: () => {} })
  assert.equal(railPosStub.textContent, '01', 'Home 应回到第 1 轮')
  zoneStub.listeners.get('keydown')({ key: 'ArrowDown', preventDefault: () => {} })
  assert.equal(railPosStub.textContent, '02', 'ArrowDown 应移向下一轮')
  assert.equal(railMarks[1].clicked, 0, 'keydown 不落定')
  zoneStub.listeners.get('keydown')({ key: 'End', preventDefault: () => {} })
  assert.equal(railPosStub.textContent, '09', 'End 应跳到最后一轮（读数用轮次号）')
  const clicksBeforeKeyup = railMarks[7].clicked
  zoneStub.listeners.get('keyup')({})
  assert.equal(railMarks[7].clicked, clicksBeforeKeyup + 1, 'keyup 才落定一次（keydown 期间不落定）')
  assert.equal(railMarks[1].clicked, 0, '途中经过的第 2 轮不该被落定')
  // 选中轮正在加载（宿主 busyTurn → 刻度 aria-busy）时不写 scrollTop：分页期间它的
  // preserve() 会把我们的值精确回滚，写了等于白写还顺带打断它的锚点。
  railMarks[7].attrs.set('aria-busy', 'true')
  listeners.get('pointerdown')({ target: zoneTarget, pointerId: 5, clientX: 386, clientY: 82 })
  const beforeBusy = transcriptStub.scrollTop
  listeners.get('pointermove')({ target: zoneTarget, pointerId: 5, clientX: 386, clientY: 466 })
  assert.equal(transcriptStub.scrollTop, beforeBusy, '这一轮正在加载时不该写 scrollTop')
  listeners.get('pointerup')({ target: zoneTarget, pointerId: 5 })
  railMarks[7].attrs.delete('aria-busy')
  // 先让"用户接管"生效（原型 L62）：settle 还钉着的时候读者的滚动不该抢指示器，
  // 这也是宿主 READING_INTENTS 的口径 —— wheel 一来就把控制权交还。
  listeners.get('wheel')({})
  // 读者自己滚（没碰轨道）时指示器要跟着走 —— 原型 L60 的 scroll 处理：
  // probe = scrollTop + 视口高 × 0.28，二分找 probe 落在哪一轮，再折算成轨道进度。
  railPosStub.textContent = ''
  transcriptStub.scrollTop = 0
  // 前面的"探头滚动"也排过 reader 帧但没人跑它们，而 reader 帧是单飞的（已排就不再排）——
  // 真机上这些帧会自己跑掉，测试里得先把积压的帧跑干，否则新的排不进来。
  for (const fn of [...rafs.values()]) fn()
  rafs.clear()
  // 只跑"这次滚动新排的那一帧"：rafs 里可能还有别的效果排的帧，取最后一个新键。
  const readerTick = (action) => {
    const before = new Set(rafs.keys())
    action()
    const added = [...rafs.keys()].filter((key) => !before.has(key))
    assert.ok(added.length >= 1, '读者滚动应排一帧更新指示器')
    rafs.get(added[added.length - 1])()
  }
  readerTick(() =>
    listeners.get('scroll')({ target: { nodeType: 1, matches: (sel) => sel.includes('data-conversation-scroll') } }),
  )
  assert.equal(railPosStub.textContent, '01', '停在顶部时指示器应指向第 1 轮')
  // 滚到第 9 轮所在的位置：probe 落到那一行 → 读数与 aria 一起变。
  transcriptStub.scrollTop = 700
  readerTick(() =>
    listeners.get('scroll')({ target: { nodeType: 1, matches: (sel) => sel.includes('data-conversation-scroll') } }),
  )
  assert.equal(railPosStub.textContent, '09', '滚到第 9 轮时指示器应跟过去')
  assert.equal(zoneStub.getAttribute('aria-valuenow'), '9', 'aria-valuenow 也要跟')
  assert.equal(transcriptStub.scrollTop, 700, '读者自己滚动时绝不反过来写 scrollTop')
  assert.equal(rows[1].hasAttribute('data-dsh-rail-target'), false, '读者滚动不打拖动落点标记')
  transcriptStub.scrollTop = 0
  const tickW = railLinesStub.childNodes[0].style.width
  assert.ok(typeof tickW === 'string' && tickW.endsWith('px'), '刻度宽度由浏览器半写（原型同款）')
  documentStub.querySelector = railQuery
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
  // 触摸端提示气泡：气流泡在 0.1.7-rc.2 是"条件渲染 + 宿主自己定位"，外面的老办法
  // （改气泡 display + 派发 resize）全失效。宿主只给了 hover/focus 路径，而点按会
  // 先用合成 mouseover 起表、紧接着的 click 又把它关掉 —— 触摸端永远看不到提示。
  // 现在的兜底：等一拍确认气泡没出来，就在被点的元素上补发一次 mouseover，
  // 让宿主自己的 hover 路径重新计时。气泡已经开着就什么都不做。
  const hintEvents = []
  const hintTarget = { dispatchEvent: (event) => hintEvents.push(event) }
  listeners.get('touchend')({ target: hintTarget })
  assert.equal(timers.length, 1, '点按应等一拍再确认气泡开没开')
  timers.pop()()
  assert.equal(hintEvents.length, 1, '气泡没弹出时应补发一次 mouseover')
  assert.equal(hintEvents[0].type, 'mouseover', '补发的必须是宿主 hover 路径认的 mouseover')
  documentStub.querySelector = (sel) => (sel === '._bubble_12mhf_1' ? {} : realQuery(sel))
  listeners.get('touchend')({ target: hintTarget })
  timers.pop()()
  assert.equal(hintEvents.length, 1, '气泡已开时不应重复补发')
  documentStub.querySelector = realQuery
  // 模拟键盘弹出后再卸载，检查 DOM 被还原
  listeners.get('w:resize')?.()
  visualViewport.height = 500
  for (const fn of [...rafs.values()]) fn()
  // 键盘跟随的挂钩：可视高度压到 500（innerHeight 800）时应压扁 html、打标记、写
  // --dsh-kb。CSS 里已经没有规则挂在这对挂钩上（面板改由宿主定位），所以这里直接
  // 断言浏览器半自己的契约，后面再断言卸载还原。
  assert.equal(htmlElement.style.height, '500px', '软键盘弹出时应把 html 压到可视高度')
  assert.equal(htmlElement.attrs.get('data-dsh-kb-open'), '1', '软键盘弹出时应打上 data-dsh-kb-open')
  assert.equal(htmlElement.style['--dsh-kb'], '300px', '软键盘高度（800-500）应写进 --dsh-kb')
  dispose()
  assert.equal(observers.length, 0, '卸载应断开全部 observer')
  assert.equal(listeners.size, 0, '卸载应移除全部监听')
  assert.equal(documentStub.body.childNodes.length, 0, '卸载应摘掉注入的悬浮开关、自绘索引轨与右缘热区')
  assert.equal(htmlElement.attrs.has('data-dsh-rail-revealed'), false, '卸载应清掉索引轨的抽出标记')
  assert.equal(railMarks.some((mark) => mark.style.getPropertyValue('--dsh-rail-grip') !== ''), false, '卸载应清掉刻度上的渐强变量')
  assert.equal(htmlElement.style.height, '', '卸载应还原 html 高度')
  assert.equal(htmlElement.attrs.has('data-dsh-kb-open'), false, '卸载应清掉键盘标记')
  assert.equal(resizeObservers.length, 0, '卸载应断掉 ResizeObserver')
  assert.equal(cardStub.style.getPropertyValue('--dsh-modes-w'), '', '卸载应清掉卡片上的宽度变量')
})

console.log(`\n[dsh-android-ui] ${checks - failures}/${checks} 项通过`)
process.exit(failures === 0 ? 0 : 1)
