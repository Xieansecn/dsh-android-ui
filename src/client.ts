/**
 * dsh-android-ui —— 浏览器半（客户端插件）。
 *
 * 只做"运行期 DOM 效果"，因为这些效果必须跟随活 DOM 反复执行；能在 HTML 里一次
 * 表达完的（viewport / CSS / polyfill）都放在 Node 半的 index 注入里，见 src/index.ts。
 *
 * 移植自 deepseek-harness-android/patches/mobile.js 第 3~8 段：
 *   3) tooltip 气泡重吸附 —— 已删（0.1.7-rc.2）：宿主现在自己算坐标（Tooltip 组件里
 *      按锚点 rect 求 left/top + 视口 clamp + 上下自动翻面，ResizeObserver 跟随气泡
 *      自身尺寸），并把 left/top/visibility 写在内联 style 上。本文件的 rAF 回写只会
 *      和 React 抢同一个属性（同 6 的删除理由）。
 *   4) 触摸交互：点按后补一发 mouseover 让宿主的 hover 路径弹出提示气泡（0.1.7-rc.2
 *      的气泡是条件渲染 + 自己定位，外部改不了它的显隐，见下）；抽屉遮罩点击关闭
 *   5) 作曲栏 "+" 号在触摸端不唤起软键盘（捕获 mousedown，阻止 React 根 keepFocus）
 *   6) 子代理下拉吸附触发器下方（实测 containing block 偏移后换算坐标）
 *      —— 已删：宿主现在自己用 createPortal + JS 算坐标（catalogMenuPosition：
 *      top = 触发器下沿 + 5、left 视口内 clamp）并写内联 style，这里再写只会跟
 *      React 抢同一个属性。
 *   7) 作曲输入框 enterkeyhint=newline（配合"普通回车=换行"的会话补丁）
 *   8) 软键盘跟随：visualViewport 收缩时把根容器压到可视高度，整页（含输入框）抬起
 *  12) 轮次索引轨：从右缘向内划抽出宿主的 TurnNavigator，再用手指上下拖动定位
 *      （原型 agent_chat_scroll_prototype.html 的右时间轴）—— 宿主的轨道在窄屏被
 *      容器查询整块隐藏，且预览只挂 hover，触摸端等于没有索引
 *
 * 生命周期：全部注册包在一个 ctx.effect 里，返回值统一回收（rAF/observer/监听器/
 * 定时器/html 样式），插件停止或更新后页面回到未安装状态——这是官方对插件副作用的
 * 硬要求（docs/user/develop/basic/index.zh.md 的"自动清理"一节）。
 */
export const name = 'dsh-android-ui'

/** 不需要任何宿主服务：效果全部作用于本页 DOM。 */
export const inject: string[] = []

/** tooltip 气泡类名（dsh 构建产物哈希类，版本敏感：0.1.5-rc.1 的 ._bubble_1nw3t_1
 *  →0.1.7-rc.2 的 ._bubble_ugtpz_1→0.2.0-rc.2 的 ._bubble_12mhf_1，且这个组件
 *  在前端外壳 dsh-web-frontend 的 dist/assets 里，不在 client-ui-* 包）。
 *  只当"提示气泡此刻开着没"的探针用 —— 定位已由宿主自己负责（见文件头第 3 条）。 */
const BUBBLE = '._bubble_12mhf_1'
/** 子代理血缘下拉：触发器（页头 crumbs 里那颗）与它展开的菜单（同上，版本敏感）。 */
const SUBAGENT_TRIGGER = '.ZKlsPq_trigger, .ZKlsPq_switcherTrigger'
const SUBAGENT_MENU = '.ZKlsPq_menu'
/** 应用外壳（CSS module 本地名后缀，跨重新构建稳定；属性子串选择器，全文档扫描不便宜）。 */
const FRAME = '[class*="_frame"]'
/** 作曲输入框 / "+" 号 / 侧栏切换按钮类名（同上）。 */
const COMPOSER_INPUT = '.uV2eYG_input'
const COMPOSER_ADD = '.uV2eYG_add'
const SIDEBAR_TOGGLE = '.hHd-Xa_toggle'
/** 宿主侧栏 toggle 里的"打开侧边栏"面板图标。**不能取 toggle 里的第一个 svg**：
 *  折叠态（wide=false）排在它前面的是 sidebar.brand.mark 槽位的品牌标记（鱼 logo），
 *  克隆那个就成了"鱼按钮"。宿主换哈希时按 Pitfalls 一起改本常量。 */
const SIDEBAR_PANEL_ICON = '.hHd-Xa_panelIcon'
/** 会话页头右上角那颗"打开右侧边栏"按钮：同一个 IconPanelLeftOutline16 组件，
 *  宿主用 data 属性暴露（不是哈希类名）。面板图标取不到时拿它兜底。 */
const RIGHT_EXPAND_BUTTON = '[data-sidebar-right-expand]'
/** 会话行 / 行内交互控件（同上）。会话行本身是 div[role=treeitem]，行内的按钮才是控件。 */
const SESSION_ROW = '[class*="_sessionRow"]'
const ROW_CONTROL = 'button, [role="button"], input, [class*="_rowActions"]'
/** 作曲栏卡片（宿主稳定 data 契约）与权限胶囊：模型胶囊的宽度上限要按权限胶囊的
 *  实测宽度算，CSS 表达不了"顶到邻居为止"。 */
const COMPOSER_CARD = '[data-composer-card]'
const COMPOSER_MODES = '.uV2eYG_modes'
/** 权限胶囊实测宽度（px），写在卡片上，供 mobile-css.ts 的 ._7KE1Ra_root 用。 */
const MODES_W_VAR = '--dsh-modes-w'
/** 悬浮侧栏开关的属性名（样式在 mobile-css.ts 的 [data-dsh-nav-fab]）。 */
const FAB_ATTR = 'data-dsh-nav-fab'
const FAB_VISIBLE_ATTR = 'data-dsh-nav-fab-visible'
/** 轮次索引轨 —— 宿主的 TurnNavigator（0.2.0-rc.2 的 eGxaPq_ 前缀，版本敏感）。
 *  竖屏下宿主自己用 @container (width<=900px) 把它整块 display:none。本模块在竖屏上只用
 *  它当"引擎 + 预览层"（轮次数据、分页、预览卡、落定用的那颗刻度），可见可拖的那条轨道
 *  由浏览器半自绘 —— 为什么要这样拆，见 docs/turn-rail-portrait.md 的特征点对比。 */
const RAIL_FRAME = '.eGxaPq_frame'
const RAIL_SCROLLER = '.eGxaPq_scroller'
const RAIL_MARKS = '.eGxaPq_marks'
/** 一颗刻度（宿主渲染成 button[data-index]，data-index 就是它在轮次列表里的下标）。 */
const RAIL_MARK = '.eGxaPq_mark'
/** 会话滚动容器（宿主稳定 data 契约；退路是 CSS module 的本地名后缀）。滚动一下就让
 *  索引轨探头一拍：这是"右缘有索引"在手机上的唯一提示。 */
const TRANSCRIPT_SCROLL = '[data-conversation-scroll], [class*="_scrollBody"]'
/** 转录里"每一轮"的 DOM 行：宿主的每个 flow item 都挂 data-chat-turn = 轮次号（一轮会有
 *  多行，文档顺序里第一条就是这轮的提示词行）。拖动中要实时把正文对齐到选中轮，靠的就是它
 *  —— 未加载的轮次没有行，那时只有预览卡与读数。 */
const TRANSCRIPT_TURN = 'data-chat-turn'
/** 拖动中给"当前轮"那行打的标记（样式在 mobile-css.ts 的 [data-dsh-rail-target]）。 */
const RAIL_TARGET = 'data-dsh-rail-target'
/** 索引轨抽出/拖动中的状态（挂 documentElement，CSS 用它们切实显隐与读数）。 */
const RAIL_REVEALED = 'data-dsh-rail-revealed'
const RAIL_DRAGGING = 'data-dsh-rail-dragging'
/** 自绘索引轨与它的零件（原型 .rail / .rail-lines / .tick / .position / .edge 的对应物）。 */
const RAIL_ROOT = 'data-dsh-rail'
const RAIL_LINES = 'data-dsh-rail-lines'
const RAIL_NUM = 'data-dsh-rail-num'
const RAIL_POS = 'data-dsh-rail-pos'
const RAIL_EDGE = 'data-dsh-rail-edge'
/** 自绘轨道的几何：从宿主 frame 的实测 rect 抄过来（frame 在 sticky 槽里是 absolute、
 *  自绘轨道是 fixed，两者都以视口为坐标系，所以 top/height 直接抄就严丝合缝）。 */
const RAIL_TOP_VAR = '--dsh-rail-top'
const RAIL_H_VAR = '--dsh-rail-h'
/** 抽出后停留时长（原型 reveal() 的 750ms）。 */
const RAIL_LINGER_MS = 750
/** 竖向 4px 才算拖动定位（右缘起手；自绘轨道上按下即定位，见 onPointerDown）。 */
const RAIL_DRAG_Y = 4
/** 刻度条数与间距 —— 照原型 rebuildTicks()：每根至少 11px 节距、最多 39 根，
 *  flex space-between 铺满整条轨道，所以轮次少时间距很大（8 轮 = 铺满一屏）。 */
const RAIL_TICK_MIN_PITCH = 11
const RAIL_TICK_MAX = 39
/** 刻度长度：基准 9px + 渐强 24px（原型 paint() 的 9+24*s²），右对齐、向左生长。 */
const RAIL_TICK_BASE_W = 9
const RAIL_TICK_GROW_W = 24
/** 哑铃渐强的半径（原型 paint() 的 dist/4）。 */
const RAIL_GRIP_SPAN = 4
/** 拖动中把"指示器当前所在的 y"写进 documentElement：宿主的预览卡靠它对齐到我们这根刻度上
 *  （写 html 而不是自绘轨道上，因为卡片在宿主 frame 子树里，只能从这个共同祖先继承）。 */
const RAIL_CARD_Y_VAR = '--dsh-rail-card-y'
/** 正文实时对齐（原型 align()/move()）：选中轮的行顶对齐到"可视顶下方 anchorY"，
 *  anchorY = 24 + p × min(100, 视口高 × 0.16) —— 手指往下拖时正文一起让位，
 *  指尖与目标消息保持"手在拉内容"的关系；松手后再钉住 430ms 让布局变化（图片/代码块
 *  撑开、宿主分页落位）不把刚对齐的行挤走，用户一自己滚就交还控制权。 */
const RAIL_ANCHOR_TOP = 24
const RAIL_ANCHOR_MAX = 100
const RAIL_ANCHOR_RATIO = 0.16
const RAIL_ANCHOR_HOLD_MS = 430

type Disposer = () => void
type Element_ = any

/** 突变驱动的"每帧最多跑一次"：宿主一次首屏挂载会甩出成百批突变（模拟 2000 节点的
 *  启动 = 200 批），把 querySelector 直接挂在 MutationObserver 回调里就是每批全文档扫
 *  一遍；统一收敛到一帧一次。 */
function installPerFrame(run: () => void): { wake: () => void; stop: () => void } {
  let raf = 0
  const tick = (): void => {
    raf = 0
    run()
  }
  return {
    wake: () => {
      if (!raf) raf = window.requestAnimationFrame(tick)
    },
    stop: () => {
      if (raf) window.cancelAnimationFrame(raf)
      raf = 0
    },
  }
}

/** 全部效果的安装时机：页面 load 之后再上（能空闲就空闲帧）。
 *  为什么：浏览器半每条效果都建 document 级 MutationObserver，而应用首屏挂载期间突变
 *  是连续的（实测 200 批 × 4 个 observer = 800 次回调、600 次 querySelector，光回调就
 *  烧掉 ~40ms）。这些效果（气泡/下拉/键盘跟随/侧栏入口）全都只在用户交互后才需要，
 *  晚半个节拍装上没有观感差异，但把首屏主线程还给宿主 —— 原来是 apply() 里同步装，
 *  dsh 启动时每个插件都在抢同一段主线程。 */
function installWhenIdle(install: () => Disposer): Disposer {
  let dispose: Disposer | null = null
  let cancelled = false
  const start = (): void => {
    if (!cancelled) dispose = install()
  }
  const schedule = (): void => {
    if (cancelled) return
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, opts: { timeout: number }) => unknown })
      .requestIdleCallback
    if (typeof idle === 'function') idle(start, { timeout: 500 })
    else start()
  }
  if (document.readyState === 'interactive' || document.readyState === 'complete') schedule()
  else window.addEventListener('load', schedule)
  return () => {
    cancelled = true
    window.removeEventListener('load', schedule)
    if (dispose) dispose()
  }
}

/** 4) 触摸交互：点按后补开提示气泡（走宿主 hover 路径，见下）；遮罩/会话行点按收起抽屉；
 *  子代理血缘触发器点按补开下拉（宿主只给了 hover 路径，见下）。 */
function installTouchInteractions(): Disposer {
  const isTouch =
    'ontouchstart' in window || (typeof navigator !== 'undefined' && (navigator.maxTouchPoints || 0) > 0)
  let hintTimer = 0
  let dismissTimer = 0
  let menuTimer = 0
  /* tooltip 气泡在 0.1.7-rc.2 是【条件渲染 + 宿主自己定位】：只有 hover/focus 路径
     （Tooltip 组件给子元素挂 onMouseEnter/onFocus 与 onClick→立刻关闭），气泡节点
     开之前根本不在 DOM 里、坐标由宿主按锚点 rect 算并写内联 style。所以旧方案那套
     "改写气泡 display + 派发 resize 叫醒 React" 整体失效（改的也不再是这个组件）。
     触摸端的死结没变：点按会先补发一次合成 mouseover/mouseenter（启动提示计时器），
     紧接着的 click 又把它关掉 —— 提示在触摸端永远看不到。
     做法与下面子代理触发器同款：等一拍（让 click 跑完），气泡没出来就在被点的元素上
     补一发 mouseover，让宿主自己的 hover 路径重新计时、自己弹出、自己定位。
     不再自己动任何样式；没有包 Tooltip 的元素上补发等于空转。 */
  const openHintOnTap = (target: Element_): void => {
    if (!target || typeof target.dispatchEvent !== 'function') return
    hintTimer = window.setTimeout(() => {
      hintTimer = 0
      if (document.querySelector(BUBBLE)) return
      const MouseEventCtor = (window as unknown as { MouseEvent?: new (type: string, init: object) => Event }).MouseEvent
      const event =
        typeof MouseEventCtor === 'function'
          ? new MouseEventCtor('mouseover', { bubbles: true, cancelable: true, view: window })
          : new Event('mouseover', { bubbles: true })
      target.dispatchEvent(event)
    }, 250)
  }
  const onTouchEnd = (event: Event): void => {
    if (!isTouch) return
    openHintOnTap(event.target)
  }
  /* 子代理血缘触发器（页头 crumbs 里那颗，`.ZKlsPq_trigger` / `_switcherTrigger`）在
     宿主里**只有 hover 路径**：外层 onMouseEnter → 150ms 后 changeOpen(true)，
     按钮自己只绑了 ArrowDown；当前会话那一颗连 onClick 都没有。
     触摸端第一下能开，是因为浏览器在点按时补发合成的 mouseenter；之后 hover 状态
     没变、不再派发 mouseenter，同一颗按钮就再也点不开了（真机："点子会话有时打不开"）。
     这里走宿主自己的键盘路径补一发 ArrowDown（它的 onKeyDown → changeOpen(true)），
     不是合成点击。等一拍是让合成的 mouseenter 先跑完 —— 菜单真开出来了就什么都不做。 */
  const openSubagentMenuOnTap = (event: Event): void => {
    if (!isTouch) return
    const target: Element_ = event.target
    if (!target || typeof target.closest !== 'function') return
    const trigger: Element_ = target.closest(SUBAGENT_TRIGGER)
    if (!trigger) return
    menuTimer = window.setTimeout(() => {
      menuTimer = 0
      if (document.querySelector(SUBAGENT_MENU)) return
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    }, 250)
  }
  /* 覆盖式抽屉的退出路径。0.1.5-rc.1 把 data-details-collapsed 换成了
     data-sidebar-collapsed（**展开时该属性整个消失**），旧的守卫因此永不成立：
     390px 实测真鼠标点遮罩不关、点会话行也不关，抽屉展开后只能去按抽屉里那颗
     收起按钮。这里只替用户点宿主的收起按钮，不自己改宿主状态；等一拍确认帧仍
     是展开态才点，避免宿主自己已经收起时被我们再打开一次。
     行内控件（三点菜单等）不算"点会话行"：宿主的三点按钮自己 stopPropagation，
     但本监听在 document 捕获阶段先跑，不在这里排掉，菜单刚弹就被我们收掉抽屉
     （真机复现过）。判定只能看 target —— 宿主是点击后约 100ms 才给行加 menuOpen
     并挂菜单，等行状态是竞态。 */
  const onDocumentClick = (event: Event): void => {
    openSubagentMenuOnTap(event)
    const target: Element_ = event.target
    if (!target || target.nodeType !== 1 || typeof target.closest !== 'function') return
    const row = target.closest(SESSION_ROW)
    const onRowControl = !!row && !!target.closest(ROW_CONTROL)
    if (!target.hasAttribute('data-shell-overlay') && !(row && !onRowControl)) return
    const frame = target.closest(FRAME)
    if (!frame || frame.hasAttribute('data-sidebar-collapsed')) return
    dismissTimer = window.setTimeout(() => {
      dismissTimer = 0
      if (frame.hasAttribute('data-sidebar-collapsed')) return
      const toggle = document.querySelector(SIDEBAR_TOGGLE)
      if (toggle) toggle.click()
    }, 0)
  }
  document.addEventListener('touchend', onTouchEnd, true)
  document.addEventListener('click', onDocumentClick, true)
  return () => {
    if (hintTimer) window.clearTimeout(hintTimer)
    if (dismissTimer) window.clearTimeout(dismissTimer)
    if (menuTimer) window.clearTimeout(menuTimer)
    document.removeEventListener('touchend', onTouchEnd, true)
    document.removeEventListener('click', onDocumentClick, true)
  }
}

/** 5) 触摸端点击作曲栏 "+"：捕获阶段拦下 mousedown，避免 React 根 refocus 拉起键盘。 */
function installAddButtonKeyboardGuard(): Disposer {
  const isTouch =
    'ontouchstart' in window || (typeof navigator !== 'undefined' && (navigator.maxTouchPoints || 0) > 0)
  if (!isTouch) return () => {}
  const onMouseDown = (event: Event): void => {
    const target: Element_ = event.target
    if (target && typeof target.closest === 'function' && target.closest(COMPOSER_ADD)) {
      event.stopPropagation()
      event.preventDefault()
    }
  }
  document.addEventListener('mousedown', onMouseDown, true)
  return () => document.removeEventListener('mousedown', onMouseDown, true)
}

/** 7) 作曲输入框 enterkeyhint=newline：让安卓输入法把回车键显示为"换行"。 */
function installEnterKeyHint(): Disposer {
  const applyHint = (): void => {
    const el = document.querySelector(COMPOSER_INPUT)
    if (el && !el.hasAttribute('enterkeyhint')) el.setAttribute('enterkeyhint', 'newline')
  }
  applyHint()
  /* 突变按帧收敛：宿主首屏挂载期间一批突变就全文档扫一次输入框，纯属白烧。 */
  const frame = installPerFrame(applyHint)
  const observer = new MutationObserver(frame.wake)
  try {
    observer.observe(document.documentElement, { childList: true, subtree: true })
  } catch {
    /* 无 documentElement 时只在装载时设一次 */
  }
  return () => {
    observer.disconnect()
    frame.stop()
  }
}

/** 8) 软键盘跟随：支持 interactive-widget=resizes-content 的 WebView 会自行收缩布局视口
 *  （innerHeight≈vv.height，本段不介入）；老 WebView / 悬浮键盘不收缩，这里把根容器高度
 *  压到 visualViewport.height，整页（含作曲栏）抬到键盘上方，收回时还原。 */
function installKeyboardFollow(): Disposer {
  const vv = window.visualViewport
  if (!vv) return () => {}
  const KB_MIN = 80
  let raf = 0
  let current = 0
  const html = document.documentElement
  const sync = (): void => {
    raf = 0
    const kb = Math.max(0, window.innerHeight - vv.height)
    if (Math.abs(kb - current) < 2) return /* 抖动过滤 */
    current = kb
    if (kb >= KB_MIN) {
      html.style.height = `${vv.height}px`
      html.setAttribute('data-dsh-kb-open', '1')
      html.style.setProperty('--dsh-kb', `${kb}px`)
      try {
        window.scrollTo(0, 0) /* 抵消浏览器把页面 pan 出可视区 */
      } catch {
        /* 无滚动权限时忽略 */
      }
    } else {
      html.style.height = ''
      html.removeAttribute('data-dsh-kb-open')
      html.style.removeProperty('--dsh-kb')
    }
  }
  const schedule = (): void => {
    if (!raf) raf = window.requestAnimationFrame(sync)
  }
  vv.addEventListener('resize', schedule)
  vv.addEventListener('scroll', schedule)
  window.addEventListener('resize', schedule)
  sync()
  return () => {
    vv.removeEventListener('resize', schedule)
    vv.removeEventListener('scroll', schedule)
    window.removeEventListener('resize', schedule)
    if (raf) window.cancelAnimationFrame(raf)
    raf = 0
    // 卸载时必须还原，否则会留下被压扁的页面。
    html.style.height = ''
    html.removeAttribute('data-dsh-kb-open')
    html.style.removeProperty('--dsh-kb')
  }
}

/** 浏览器半用到的最小 Cordis 上下文。 */
export interface ClientCtx {
  effect(fn: () => unknown, label?: string): unknown
}

/** 9) 悬浮侧栏开关：≤480px 折叠态下侧栏整列脱离网格流（不再永久占 56px，
 *  390px 上是 14% 宽度），入口由这颗按钮承担。图标克隆宿主自己的**面板图标**：
 *  与页头右上角那颗"打开右侧边栏"按钮同一个图形组件，自动跟随主题色，且不会
 *  变成品牌鱼 logo（用户明确要求这里是图标按钮）；点击只是转发给宿主自己的开关
 *  按钮，不自己改宿主状态。展开态由抽屉自带的收起按钮负责，这里置灰隐藏。 */
function installSidebarFab(): Disposer {
  /* 缺 matchMedia 的环境（极少见，但插件不该因为它整半挂掉——apply 里任何一个
     安装器抛错都会带走其余全部效果）当作非移动端处理。 */
  const mobile = typeof window.matchMedia === 'function' ? window.matchMedia('(max-width: 480px)') : null
  /* 样式表握手：Node 半注入的 CSS 会设 --dsh-android-ui-css，读不到说明宿主这次
     页面用的是旧 CSS（改了样式还没重启），此时注入按钮只会多出一个裸按钮。 */
  const rootStyle = typeof window.getComputedStyle === 'function' ? window.getComputedStyle(document.documentElement) : null
  const cssReady =
    !!rootStyle &&
    typeof rootStyle.getPropertyValue === 'function' &&
    rootStyle.getPropertyValue('--dsh-android-ui-css').trim() === '1'
  if (!cssReady) return () => {}
  const fab = document.createElement('button')
  fab.type = 'button'
  fab.setAttribute(FAB_ATTR, '')
  fab.setAttribute('aria-label', '打开侧边栏')
  /* 缓存这两个查找：FRAME 是属性子串选择器（全文档扫一遍不便宜），而 sync 每帧都会跑；
     React 换掉元素时 isConnected 变 false，缓存自然失效、下次重新查。 */
  let toggle: Element_ = null
  let frame: Element_ = null
  const find = (cached: Element_, selector: string): Element_ => {
    if (cached && cached.isConnected) return cached
    return document.querySelector(selector)
  }
  const sync = (): void => {
    toggle = find(toggle, SIDEBAR_TOGGLE)
    frame = find(frame, FRAME)
    const show = !!mobile && mobile.matches && !!toggle && !!frame && frame.hasAttribute('data-sidebar-collapsed')
    if (!show) {
      fab.removeAttribute(FAB_VISIBLE_ATTR)
      return
    }
    if (fab.childNodes.length === 0) {
      /* 面板图标在折叠态只是被宿主 CSS `display:none`，元素仍在 DOM 里；取不到就退到
         右上角那颗同款按钮（同一个 IconPanelLeftOutline16）。克隆后剥掉宿主类名：
         既不让 `scaleX(-1)`（右上角那颗是镜像过的）和 `display:none` 跟着过来，
         尺寸也完全由本文件的 CSS 决定。 */
      const icon = toggle.querySelector(SIDEBAR_PANEL_ICON) || document.querySelector(`${RIGHT_EXPAND_BUTTON} svg`)
      if (!icon) return /* 图标还没渲染，等下一次 sync */
      const clone = icon.cloneNode(true)
      if (clone && typeof clone.removeAttribute === 'function') clone.removeAttribute('class')
      fab.append(clone)
    }
    fab.setAttribute(FAB_VISIBLE_ATTR, '')
  }
  const openDrawer = (): void => {
    toggle = find(toggle, SIDEBAR_TOGGLE)
    if (toggle) toggle.click()
  }
  fab.addEventListener('click', openDrawer)
  document.body.append(fab)
  /* 同理按帧收敛：这个 observer 连 childList 都盯，首屏挂载期间回调一次接一次。 */
  const frameTask = installPerFrame(sync)
  const observer = new MutationObserver(frameTask.wake)
  try {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-sidebar-collapsed'],
    })
  } catch {
    /* 无 documentElement 时退化为仅 resize 驱动 */
  }
  window.addEventListener('resize', frameTask.wake)
  if (mobile && typeof mobile.addEventListener === 'function') mobile.addEventListener('change', frameTask.wake)
  sync()
  return () => {
    observer.disconnect()
    window.removeEventListener('resize', frameTask.wake)
    if (mobile && typeof mobile.removeEventListener === 'function') mobile.removeEventListener('change', frameTask.wake)
    fab.removeEventListener('click', openDrawer)
    frameTask.stop()
    fab.remove()
  }
}

/** 10) 模型胶囊的宽度上限跟随权限胶囊：把权限胶囊的实测宽度写进卡片上的
 *  --dsh-modes-w，样式表用它把模型胶囊放宽到"顶到权限胶囊前 12px 再省略"（见
 *  mobile-css.ts 的 ._7KE1Ra_root）。ResizeObserver 只在权限胶囊自己尺寸变化时触发
 *  （改权限、计划胶囊出现/消失、转屏、字体加载），不是 document 级突变监听；
 *  宿主换掉节点时靠 isConnected 重挂。取不到权限胶囊就写 0（模型独占整行）。 */
function installModelPillWidth(): Disposer {
  /* 没有 ResizeObserver 的环境（老 WebView）直接不装：样式表的 var() 兜底值
     （一半宽度）本来就是可用状态，只是模型标签少显示几个字。 */
  if (typeof ResizeObserver !== 'function') return () => {}
  let card: Element_ = null
  let modes: Element_ = null
  let raf = 0
  const observer: any = new ResizeObserver(() => sync())
  const sync = (): void => {
    const nextCard = card && card.isConnected ? card : document.querySelector(COMPOSER_CARD)
    if (!nextCard) return
    const nextModes = modes && modes.isConnected ? modes : document.querySelector(COMPOSER_MODES)
    if (nextModes !== modes) {
      if (modes) observer.unobserve(modes)
      modes = nextModes
      if (modes) observer.observe(modes)
    }
    card = nextCard
    const width = modes && typeof modes.getBoundingClientRect === 'function' ? modes.getBoundingClientRect().width : 0
    const next = `${width}px`
    /* 值没变就不写：写自定义属性会让模型胶囊重新算 max-width（多一次样式失效）。 */
    if (card.style.getPropertyValue(MODES_W_VAR) !== next) card.style.setProperty(MODES_W_VAR, next)
  }
  const wake = (): void => {
    if (!raf) raf = window.requestAnimationFrame(() => { raf = 0; sync() })
  }
  window.addEventListener('resize', wake)
  /* 换会话时作曲栏可能整块重建：用户一点进去（focusin）就重新认一次卡片/胶囊。 */
  document.addEventListener('focusin', wake, true)
  sync()
  return () => {
    observer.disconnect()
    window.removeEventListener('resize', wake)
    document.removeEventListener('focusin', wake, true)
    if (raf) window.cancelAnimationFrame(raf)
    raf = 0
    if (card) card.style.removeProperty(MODES_W_VAR)
  }
}

/** 12) 竖屏轮次索引轨：把宿主的 TurnNavigator 降级成"引擎 + 预览层"，自绘一条原型的轨道。
 *  为什么重构（真机两条报障叠在一起，详见 docs/turn-rail-portrait.md）：
 *    a) 宿主轨道是**固定 10px 节距 + 轨道内虚拟滚动**，390px 机器上一屏塞 60 多根刻度、
 *       密成一条虫；原型是 flex space-between 铺满（条数 = floor(h/11)+1 封顶 39），
 *       轮次少时一眼一根，这才是"时间轴"的手感。
 *    b) 宿主每根刻度都是 `<button>`，松手时浏览器会给它补发一次 click（触摸位移不超过
 *       tap slop 就算点击，约 10px，而我们的起手阈值只有 4px）—— 于是"滑到一半跳了一轮"，
 *       手势被打断。只要手指下面还有宿主的可点元素，这个竞态就消不掉。
 *  所以分工改成：宿主 frame 保留布局（虚拟化要非零尺寸，节距/内边距还要从它身上量）但
 *  `pointer-events:none`、刻度 `opacity:0`（**不能 display:none**，否则 rect 全为 0，
 *  量不出换算关系）；它只负责轮次数据、分页、预览卡与"落定用的那颗刻度"。可见可拖的
 *  轨道由本文件自绘（几何从 frame 的实测 rect 抄过来），落定点击由 finish 程序化触发一次。
 *  映射沿用原型的 move()：指尖 → 进度 p → index = round(p*(n-1))；n / 节距 / 内边距在
 *  探头时量一次（刻度的**内容坐标**与滚动量无关，所以能在写 scrollTop 之前量准），定位时
 *  再把宿主的滚动容器滚到目标刻度上 —— 虚拟化随即把它挂上，预览与 click 都拿得到。
 *  有意与原型不同的两点照旧：拖动中不写对话区滚动位置（宿主的锚点补偿按"读者动作"记账），
 *  不压缩提示词（反馈交给宿主的预览卡，截断规则只有它的轮次大纲投影有）。 */
function installTurnRailScrub(): Disposer {
  /* 竖屏触摸端专用：宽屏宿主的轨道本来就显示、悬停预览也够用。 */
  const isTouch = 'ontouchstart' in window || (typeof navigator !== 'undefined' && (navigator.maxTouchPoints || 0) > 0)
  if (!isTouch || typeof window.matchMedia !== 'function') return () => {}
  const mobile = window.matchMedia('(max-width: 480px)')
  /* 样式表握手（与悬浮开关同款）：Node 半没注入 CSS 时自绘轨道没有样式、几何变量也没人用，
     装了只会多出两个裸元素。 */
  const rootStyle = typeof window.getComputedStyle === 'function' ? window.getComputedStyle(document.documentElement) : null
  const cssReady =
    !!rootStyle &&
    typeof rootStyle.getPropertyValue === 'function' &&
    rootStyle.getPropertyValue('--dsh-android-ui-css').trim() === '1'
  if (!cssReady) return () => {}

  const doc = document.documentElement
  let hideTimer = 0
  let raf = 0
  let pointer: number | null = null
  let startY = 0
  let active = false
  /** 选中的轮次下标（= 宿主刻度的 data-index）与量出来的换算关系。 */
  let index = -1
  let total = 0
  let pitch = 10
  let padStart = 1
  let gripMark: Element_ = null
  /** 正文跟随用：选中的宿主刻度、最后一次进度、当前打了标记的行、settle 的 rAF。 */
  let selectedNode: Element_ = null
  let lastProgress = 0
  let targetRow: Element_ = null
  /** 本次拖动是否真的对齐上了转录里的行（未加载的轮次没有行）。 */
  let aligned = false
  let anchorFrame = 0
  let anchorUntil = 0
  /* settle 的锚点：拖动中用原型那套（24 + p × ratio）；松手后改成宿主自己落位用的 24 ——
     否则我们和宿主各按各的锚点写，430ms 内会互相拉。 */
  /** 已抽出时"点一下不拖"要跳的目标下标（-1 = 没有待落定的点按）；一开始拖动就作废。 */
  let tapTarget = -1
  let anchorBase = RAIL_ANCHOR_TOP
  let anchorRatio = RAIL_ANCHOR_RATIO
  /* 拖动期间临时关掉浏览器滚动锚定（宿主只在 follow-tail 时关）：不然内容一增长，
     浏览器会自己挪 scrollTop，跟我们的定位打架。松手立即还原。 */
  let anchorStyleBox: Element_ = null
  let anchorStylePrev = ''
  const ticks: Element_[] = []
  /* 轮次号 → 轨道下标。宿主刻度上只有 aria-label 带轮次号，所以扫一遍**已挂载**的那些
     （≤39 根）缓存起来；宿主会让轨道窗口跟着读者走，当前可见的轮次几乎总在里面。 */
  const turnIndex = new Map<number, number>()
  let readerFrame = 0
  /* 宿主侧节点：换会话/分页时整块重建，isConnected 就是失效信号。
     transcript 是会话滚动容器（正文所在，拖动时要实时跟随）。 */
  let frame: Element_ = null
  let scroller: Element_ = null
  let marks: Element_ = null
  let transcript: Element_ = null
  const find = (cached: Element_, selector: string): Element_ => (cached && cached.isConnected ? cached : document.querySelector(selector))

  /* ---------- 自绘轨道（原型 .rail / .rail-lines / .rail-number / .position 的对应物） ---------- */
  const root = document.createElement('div')
  root.setAttribute(RAIL_ROOT, '')
  root.setAttribute('aria-hidden', 'true')
  const lines = document.createElement('div')
  lines.setAttribute(RAIL_LINES, '')
  const numFirst = document.createElement('span')
  numFirst.setAttribute(RAIL_NUM, 'first')
  numFirst.textContent = '01'
  const numLast = document.createElement('span')
  numLast.setAttribute(RAIL_NUM, 'last')
  const position = document.createElement('span')
  position.setAttribute(RAIL_POS, '')
  root.append(lines)
  root.append(numFirst)
  root.append(numLast)
  root.append(position)

  /* 右缘热区：轨道没抽出来时的入口，也是键盘/无障碍的抓手（原型把 role=slider 放在 .edge 上）。 */
  const edge = document.createElement('div')
  edge.setAttribute(RAIL_EDGE, '')
  edge.setAttribute('role', 'slider')
  edge.setAttribute('tabindex', '0')
  edge.setAttribute('aria-orientation', 'vertical')
  edge.setAttribute('aria-valuemin', '1')
  edge.setAttribute('aria-label', '对话索引：上下滑动定位轮次')

  const setVar = (name: string, value: string): void => {
    const style = (root as Element_).style
    if (style && typeof style.setProperty === 'function') style.setProperty(name, value)
  }

  /** 把宿主 frame 的位置与高度抄给自绘轨道。量不到（轨道没挂 / 轮次少于两轮 / 正在换会话）
      就返回 false —— 此时不该让索引轨露面，否则会留下一条没有内容的空轨道。 */
  const sync = (): boolean => {
    frame = find(frame, RAIL_FRAME)
    if (!frame || typeof frame.getBoundingClientRect !== 'function') return false
    const rect = frame.getBoundingClientRect()
    if (!(rect.height > 0)) return false
    setVar(RAIL_TOP_VAR, `${rect.top}px`)
    setVar(RAIL_H_VAR, `${rect.height}px`)
    return true
  }

  /** 宿主刻度的节距：正常就是 10px，量出来是为了不写死宿主的 TURN_SPACING_PX。 */
  const markPitch = (): number => {
    const kids = marks && marks.children
    if (!kids || kids.length < 2) return 10
    const first = kids[0]
    const last = kids[kids.length - 1]
    const from = Number(first.getAttribute('data-index'))
    const to = Number(last.getAttribute('data-index'))
    if (!Number.isFinite(from) || !Number.isFinite(to) || to === from) return 10
    const gap = (last.getBoundingClientRect().top - first.getBoundingClientRect().top) / (to - from)
    return gap > 0 ? gap : 10
  }

  /** 量一次"进度 ↔ 轮次"的换算：节距、第一根刻度的内容坐标、总轮数。
      内容坐标 = 刻度屏幕位 - 滚动容器顶 + scrollTop，与当前滚动量无关 —— 所以能在写
      scrollTop 之前量准（写完再量会读到虚拟化还没跟上的旧位置）。 */
  const measureScale = (): boolean => {
    if (!scroller || !marks) return false
    const kids = marks.children
    if (!kids || kids.length === 0) return false
    const first = kids[0]
    const from = Number(first.getAttribute('data-index'))
    if (!Number.isFinite(from)) return false
    if (typeof scroller.getBoundingClientRect !== 'function' || typeof first.getBoundingClientRect !== 'function') return false
    pitch = markPitch()
    padStart = first.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - from * pitch
    /* 总轮数 = 内容总高扣掉上下内边距再除以节距。内容总高优先取宿主写在刻度容器上的
       inline height（= 它的 totalSize，与滚动视口无关）；取不到才退回 scrollHeight ——
       轮次少到内容比视口还矮时 scrollHeight 会被视口撑大，那会把总轮数算多，
       指尖就会映射到根本不存在的轮次上。 */
    const mountedMax = Number(kids[kids.length - 1].getAttribute('data-index')) + 1
    let size = 0
    const marksStyle = marks.style
    if (marksStyle && typeof marksStyle.height === 'string') size = parseFloat(marksStyle.height)
    if (!(size > 0)) size = scroller.scrollHeight
    let derived = Math.round((size - 2 * padStart) / pitch)
    if (!Number.isFinite(derived) || derived < 2) derived = 0
    total = Math.max(derived, Number.isFinite(mountedMax) ? mountedMax : 0)
    return total >= 2
  }

  /** 照原型 rebuildTicks()：条数由轨道内高定（每根至少 11px 节距、最多 39 根），
      铺满交给 CSS 的 space-between；只增删到需要的根数，不整段重建。 */
  const rebuildTicks = (): void => {
    if (typeof lines.getBoundingClientRect !== 'function') return
    const height = lines.getBoundingClientRect().height
    if (!(height > 0)) return
    let count = Math.max(2, Math.min(RAIL_TICK_MAX, Math.floor(height / RAIL_TICK_MIN_PITCH) + 1))
    if (total > 1) count = Math.min(count, total)
    while (ticks.length > count) {
      const extra = ticks.pop()
      if (extra && typeof extra.remove === 'function') extra.remove()
    }
    while (ticks.length < count) {
      const tick = document.createElement('i')
      lines.append(tick)
      ticks.push(tick)
    }
    /* 原型 .rail-number.last 写的是**裸总数**（first 才是写死的 01），照抄。 */
    numLast.textContent = total > 0 ? String(total) : ''
  }

  /** 拖动中的"哑铃"与读数 —— 逐条照原型 paint()：选中处最长最亮、四根以内平方衰减，
      读数跟着选中位置上下走（原型 .position 的 top = 18 + progress * linesH）。 */
  const paint = (progress: number): void => {
    const count = ticks.length
    if (count > 0) {
      const selected = progress * (count - 1)
      for (let i = 0; i < count; i += 1) {
        const style = ticks[i].style
        if (!style) continue
        const dist = Math.abs(i - selected)
        const strength = Math.max(0, 1 - dist / RAIL_GRIP_SPAN)
        style.width = `${RAIL_TICK_BASE_W + RAIL_TICK_GROW_W * strength * strength}px`
        style.opacity = String(0.35 + 0.65 * strength)
        style.background = dist < 0.55 ? 'var(--dsw-alias-label-primary, #333)' : 'var(--dsw-alias-label-tertiary, #909090)'
      }
    }
    if (typeof lines.getBoundingClientRect === 'function') {
      const y = 18 + progress * lines.getBoundingClientRect().height
      position.style.top = `${y}px`
      /* 同一个 y 也交给宿主的预览卡（见 RAIL_CARD_Y_VAR 的注释）：宿主自己那套固定节距几何
         与我们 space-between 的刻度对不上，不这么写卡片就会在指示器旁边自顾自地小幅浮动。 */
      const style = (doc as Element_).style
      if (style && typeof style.setProperty === 'function') style.setProperty(RAIL_CARD_Y_VAR, `${y}px`)
    }
  }

  /** 读数：位置用宿主的**轮次号**（不是数组下标 —— 重试/分叉过的会话两者会不一样），
      取不到才退回下标 + 1，和原型 .position 的两位补零一致。 */
  const readout = (selected: number, node: Element_): void => {
    const turn = node ? turnNumber(node) : selected + 1
    position.textContent = selected >= 0 ? String(turn).padStart(2, '0') : ''
    edge.setAttribute('aria-valuenow', String(turn))
    edge.setAttribute('aria-valuemax', total > 0 ? String(total) : '')
    edge.setAttribute('aria-valuetext', `第 ${turn} 轮`)
  }

  /** 把已挂载刻度的"轮次号 → 下标"收进缓存（探头/开始拖动时各刷一次，≤39 次读属性）。 */
  const refreshTurnIndex = (): void => {
    const kids = marks && marks.children
    if (!kids) return
    for (let i = 0; i < kids.length; i += 1) {
      const node = kids[i]
      const at = Number(typeof node.getAttribute === 'function' ? node.getAttribute('data-index') : NaN)
      if (Number.isFinite(at)) turnIndex.set(turnNumber(node), at)
    }
  }

  /** 读者自己滚动（没用轨道）时让指示器跟着走 —— 与原型 L60 同一套：probe 取视口高 28%
      处，二分找出 probe 所在的那一轮，再折算成轨道进度。**不写任何 scrollTop**、也不打
      落点标记（那是拖动时的反馈），只更新哑铃与读数。 */
  const followReader = (): void => {
    const box = find(transcript, TRANSCRIPT_SCROLL)
    if (!box || !scroller || !marks || total < 2) return
    if (typeof box.querySelectorAll !== 'function' || typeof box.getBoundingClientRect !== 'function') return
    const rows = box.querySelectorAll(`[${TRANSCRIPT_TURN}]`)
    if (!rows || rows.length === 0) return
    const view = typeof box.clientHeight === 'number' ? box.clientHeight : 0
    const probe = box.scrollTop + view * 0.28
    const origin = box.getBoundingClientRect().top
    const contentTop = (i: number): number => {
      const row = rows[i]
      if (!row || typeof row.getBoundingClientRect !== 'function') return -Infinity
      return row.getBoundingClientRect().top - origin + box.scrollTop
    }
    /* 行按文档序、内容坐标单调：二分找"最后一个内容坐标 ≤ probe"的行（原型同款）。 */
    let lo = 0
    let hi = rows.length - 1
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2)
      if (contentTop(mid) <= probe) lo = mid
      else hi = mid - 1
    }
    const row = rows[lo]
    const raw = typeof row?.getAttribute === 'function' ? row.getAttribute(TRANSCRIPT_TURN) : null
    const turn = Number(raw)
    if (!Number.isFinite(turn)) return
    let found = turnIndex.get(turn)
    if (found === undefined) {
      /* 窗口可能刚被宿主挪过：刷一次缓存再找；还找不到就不动指示器（宁可不更新也不跳）。 */
      refreshTurnIndex()
      found = turnIndex.get(turn)
    }
    if (found === undefined) return
    const progress = total > 1 ? Math.max(0, Math.min(1, found / (total - 1))) : 0
    lastProgress = progress
    /* 同步选中项：读者滚到哪，后面按方向键就从哪继续（否则会跳回上一次拖动的落点）。 */
    index = found
    paint(progress)
    const node = typeof marks.querySelector === 'function' ? marks.querySelector(`${RAIL_MARK}[data-index="${found}"]`) : null
    readout(found, node)
  }

  /** 滚动事件很密，收敛到一帧一次。 */
  const scheduleReaderFollow = (): void => {
    if (readerFrame) return
    readerFrame = window.requestAnimationFrame(() => {
      readerFrame = 0
      followReader()
    })
  }

  /** 程序化点一次宿主刻度 = 让宿主自己落定（未加载的轮次它会先分页再落位）。 */
  const commitIndex = (): void => {
    if (index < 0 || !marks || typeof marks.querySelector !== 'function') return
    const mark = marks.querySelector(`${RAIL_MARK}[data-index="${index}"]`)
    if (mark && typeof mark.click === 'function') mark.click()
    else commitLater()
  }

  /** 在刻度上补发一次 pointermove：宿主的预览卡挂在"最近悬停的那颗刻度"上，坐标由它自己
      算。走宿主的路径而不是自己画卡 —— 提示词 50 字 / 回复 120 字的截断只有宿主的轮次
      大纲投影有。 */
  const preview = (node: Element_): void => {
    if (!node || node === gripMark || typeof node.dispatchEvent !== 'function') return
    gripMark = node
    const Ctor = (window as unknown as { PointerEvent?: new (type: string, init: object) => Event }).PointerEvent
    const event =
      typeof Ctor === 'function'
        ? new Ctor('pointermove', { bubbles: true, cancelable: true, view: window })
        : new Event('pointermove', { bubbles: true })
    node.dispatchEvent(event)
  }

  /** 撤掉预览：宿主靠 onPointerLeave 清（pointerout 合成），拖动不走真实悬停路径，收尾时
      替它派发一次 pointerout，否则轨道再次抽出时还挂着上一轮的预览卡。 */
  const clearPreview = (): void => {
    const node = gripMark
    gripMark = null
    if (!node || typeof node.dispatchEvent !== 'function') return
    node.dispatchEvent(new Event('pointerout', { bubbles: true }))
  }

  /** 轮次号：宿主的刻度上只有 aria-label 里有它（t('chat.turnNavigation.jump', {turn})）；
      解析不出来就退回 data-index + 1（没重试/分叉过的会话两者相同）。 */
  const turnNumber = (node: Element_): number => {
    if (!node || typeof node.getAttribute !== 'function') return 0
    const label = node.getAttribute('aria-label')
    if (typeof label === 'string') {
      const found = label.match(/\d+/)
      if (found) return Number(found[0])
    }
    const at = Number(node.getAttribute('data-index'))
    return Number.isFinite(at) ? at + 1 : 0
  }

  /** 选中轮在转录里的行（宿主的 flow item 带 data-chat-turn；一轮多行时取第一条 =
      提示词那一行）。宿主只挂载已加载窗口内的行，所以未加载的轮次返回 null。 */
  const rowOf = (box: Element_, node: Element_): Element_ => {
    const turn = turnNumber(node)
    if (!(turn > 0)) return null
    /* 限定在会话滚动容器里查：宿主可能同时挂着别的区域（嵌入视图/轨迹）的行。
       同一轮可能拆成多行，取文档序第一条 = 提示词那一行（宿主自己的 scrollToTurnAtOrAfter
       也是这个口径）。 */
    const scope = box && typeof box.querySelector === 'function' ? box : document
    if (!scope || typeof scope.querySelector !== 'function') return null
    return scope.querySelector(`[${TRANSCRIPT_TURN}="${turn}"]`)
  }

  /** 给"当前轮"那行打标记（原型 .scrubbing .user.selected 的对应物）——只加属性，
      样式由 CSS 给，绝不动宿主那行的尺寸。 */
  const markTarget = (row: Element_): void => {
    if (row === targetRow) return
    const previous = targetRow
    targetRow = row
    if (previous && typeof previous.removeAttribute === 'function') previous.removeAttribute(RAIL_TARGET)
    if (row && typeof row.setAttribute === 'function') row.setAttribute(RAIL_TARGET, '')
  }

  /** 原型 align()：把选中轮的行顶对齐到 anchorY。每选一轮只写一次 scrollTop（不是每帧）——
      宿主的滚动位置保持与分页锚点按"读者动作"记账，每帧硬写会跟它互相拉。 */
  const alignTranscript = (progress: number, node: Element_): void => {
    const box = find(transcript, TRANSCRIPT_SCROLL)
    if (!box || typeof box.getBoundingClientRect !== 'function' || typeof box.scrollTop !== 'number') return
    const row = rowOf(box, node)
    if (!row || typeof row.getBoundingClientRect !== 'function') return
    if (active) markTarget(row)
    /* 这一轮正在加载（宿主 busyTurn，刻度上 aria-busy）时不要写：分页期间它的 preserve()
       会把我们的值精确回滚，写了等于白写还会顺带打断它的锚点。 */
    if (typeof node.getAttribute === 'function' && node.getAttribute('aria-busy') === 'true') return
    aligned = true
    const view = typeof box.clientHeight === 'number' ? box.clientHeight : 0
    const anchor = anchorBase + progress * Math.min(RAIL_ANCHOR_MAX, view * anchorRatio)
    const top = row.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop
    const next = Math.max(0, top - anchor)
    if (Math.abs(next - box.scrollTop) > 1) box.scrollTop = next
  }

  /** 原型 holdAnchor(430)：拖动中与松手后各钉住一拍，只做"漂移纠正"（差 >1px 才写），
      让宿主自己的布局变化不会把刚对齐的那行挤走。 */
  const holdTick = (): void => {
    anchorFrame = 0
    if (!active && Date.now() >= anchorUntil) return
    if (selectedNode) alignTranscript(lastProgress, selectedNode)
    if (active || Date.now() < anchorUntil) anchorFrame = window.requestAnimationFrame(holdTick)
  }

  /** 撤掉预览卡的 y（拖动结束后卡片已经隐藏，但这个变量不该留给下次）。 */
  const clearCardY = (): void => {
    const style = (doc as Element_).style
    if (style && typeof style.removeProperty === 'function') style.removeProperty(RAIL_CARD_Y_VAR)
  }

  const setOverflowAnchor = (on: boolean): void => {
    const box = find(transcript, TRANSCRIPT_SCROLL)
    if (!box || !box.style) return
    if (on) {
      if (anchorStyleBox !== box) {
        anchorStyleBox = box
        anchorStylePrev = typeof box.style.overflowAnchor === 'string' ? box.style.overflowAnchor : ''
      }
      box.style.overflowAnchor = 'none'
      return
    }
    if (anchorStyleBox && anchorStyleBox.style) anchorStyleBox.style.overflowAnchor = anchorStylePrev
    anchorStyleBox = null
    anchorStylePrev = ''
  }

  const holdAnchor = (ms = RAIL_ANCHOR_HOLD_MS): void => {
    anchorUntil = Date.now() + ms
    if (!anchorFrame) anchorFrame = window.requestAnimationFrame(holdTick)
  }

  /** 用户一有真实滚动/触摸就把控制权交还（原型 L62 的三个 passive 监听）。 */
  const releaseAnchor = (): void => {
    anchorUntil = 0
    if (anchorFrame) window.cancelAnimationFrame(anchorFrame)
    anchorFrame = 0
  }

  /** 选中第 i 轮：把宿主轨道滚过去（虚拟化才会挂上那颗刻度）、喂预览、刷新自绘反馈。
      滚动写的是宿主那条已经看不见的容器，观感上只有我们的轨道在动。 */
  const applyIndex = (i: number): void => {
    if (!scroller || !marks || total < 2) return
    index = Math.max(0, Math.min(total - 1, i))
    const target = padStart + index * pitch
    const view = typeof scroller.clientHeight === 'number' ? scroller.clientHeight : 0
    const max = Math.max(0, scroller.scrollHeight - view)
    if (typeof scroller.scrollTop === 'number') scroller.scrollTop = Math.max(0, Math.min(max, target - view / 2))
    const node = typeof marks.querySelector === 'function' ? marks.querySelector(`${RAIL_MARK}[data-index="${index}"]`) : null
    const progress = total > 1 ? index / (total - 1) : 0
    lastProgress = progress
    selectedNode = node
    if (node) preview(node)
    paint(progress)
    /* 实时指示消息：把正文里这一轮的行对齐过来并打上标记（未加载的轮次没有行，
       那时只有读数与预览卡，正文等松手后宿主自己分页落位）。 */
    if (node) alignTranscript(progress, node)
    readout(index, node)
  }

  /** 准备：找到宿主三件套、抄几何、量换算、备刻度。量不到说明现在没有可索引的会话。 */
  const prepare = (): boolean => {
    if (!sync()) return false
    scroller = find(scroller, RAIL_SCROLLER)
    marks = find(marks, RAIL_MARKS)
    if (!scroller || !marks) return false
    if (!measureScale()) return false
    refreshTurnIndex()
    rebuildTicks()
    return true
  }

  /** 指尖 → 进度（原型 move() 的那一句）。 */
  const progressAt = (y: number): number => {
    if (typeof lines.getBoundingClientRect !== 'function') return 0
    const rect = lines.getBoundingClientRect()
    if (!(rect.height > 0)) return 0
    return Math.max(0, Math.min(1, (y - rect.top) / rect.height))
  }

  const clearTimer = (): void => {
    if (hideTimer) window.clearTimeout(hideTimer)
    hideTimer = 0
  }

  /** 抽出索引轨（原型 reveal()：shown + 750ms 后收起）。手指还按着时不收 —— 右缘是
      "放上去即抽出"，按住不动不该让轨道从手指底下消失（松手时 finish 重新计一拍）。 */
  const reveal = (linger = RAIL_LINGER_MS): void => {
    clearTimer()
    if (!prepare()) return
    doc.setAttribute(RAIL_REVEALED, '')
    hideTimer = window.setTimeout(() => {
      hideTimer = 0
      if (active || pointer !== null) return
      doc.removeAttribute(RAIL_REVEALED)
    }, linger)
  }

  const begin = (y: number): void => {
    if (active) return
    if (!prepare()) return
    active = true
    clearTimer()
    doc.setAttribute(RAIL_REVEALED, '')
    doc.setAttribute(RAIL_DRAGGING, '')
    aligned = false
    anchorBase = RAIL_ANCHOR_TOP
    anchorRatio = RAIL_ANCHOR_RATIO
    setOverflowAnchor(true)
    applyIndex(Math.round(progressAt(y) * (total - 1)))
    holdAnchor()
  }

  /** 落定点击：滚动容器刚才已经滚到那一轮身上，刻度一定挂上了；万一虚拟化还没跟上，
      下一帧再点一次。 */
  const commitLater = (): void => {
    const wanted = index
    if (raf) window.cancelAnimationFrame(raf)
    raf = window.requestAnimationFrame(() => {
      raf = 0
      if (!marks || typeof marks.querySelector !== 'function') return
      const mark = marks.querySelector(`${RAIL_MARK}[data-index="${wanted}"]`)
      if (mark && typeof mark.click === 'function') mark.click()
    })
  }

  const finish = (commit: boolean): void => {
    const wasActive = active
    pointer = null
    active = false
    doc.removeAttribute(RAIL_DRAGGING)
    if (!wasActive) {
      if (mobile.matches) reveal()
      return
    }
    if (commit) commitIndex()
    clearPreview()
    markTarget(null)
    clearCardY()
    setOverflowAnchor(false)
    /* 松手后继续钉住一拍：宿主自己撑开内容时，刚对齐的那一轮不会被挤走。
       ① **只在这轮本来就有行、且不在加载中**时才钉 —— 未加载的轮次由宿主分页落位，
          我们再写 scrollTop 只会跟它的分页锚点补偿互相拉（那种情况交还控制权）；
       ② 锚点改成宿主自己落位用的 24px（去掉原型那个比例项），这样我们与它的落点一致，
          430ms 里不会各写各的。 */
    anchorRatio = 0
    if (aligned) holdAnchor()
    if (mobile.matches) reveal()
    else doc.removeAttribute(RAIL_REVEALED)
  }

  /* 两个起手面：自绘轨道自己（按下即定位）与右缘热区（按下即抽出索引）。事件挂在 document
     捕获阶段 —— 宿主换会话时轨道整块重建也不用重挂，而且捕获阶段不受任何 stopPropagation
     影响。这里**不**用 setPointerCapture：自绘轨道与热区都不是宿主的可点元素，pointerdown
     再 preventDefault 掉，浏览器就不会补发 click/mouse 链，"滑到一半被点击打断"从结构上消失。 */
  const onPointerDown = (event: Element_): void => {
    if (pointer !== null || !mobile.matches) return
    const target: Element_ = event.target
    if (!target || target.nodeType !== 1 || typeof target.closest !== 'function') return
    /* **唯一输入面是右缘热区**（自绘轨道只是显示面）：热区宽度两态一致，手感稳定。
       手指滑出热区不影响拖动 —— 事件挂在 document 捕获阶段、只按 pointerId 过滤。 */
    if (!target.closest(`[${RAIL_EDGE}]`)) {
      /* 按在别处 = 用户接管：把还在漂移纠正的 settle 交还给用户（与宿主 READING_INTENTS
         里的 pointerdown 同口径）。放在这里而不是再挂一个 document 监听：同一元素上挂两个
         pointerdown 既白跑一遍，也会让"按事件类型注册监听"的环境互相覆盖。 */
      if (!active) releaseAnchor()
      return
    }
    pointer = typeof event.pointerId === 'number' ? event.pointerId : 1
    startY = event.clientY
    fingerY = event.clientY
    const shown = typeof doc.hasAttribute === 'function' && doc.hasAttribute(RAIL_REVEALED)
    /* 手指放上去立刻抽出（不用先向内划），按住不动也不会从手指底下淡出。 */
    reveal()
    /* 已经抽出时，"点一下不拖"= 松手跳到指尖那根刻度；按下瞬间不动选中项
       （按下就跳正文很突然，也容易变成误触）。还藏着时只抽出、不跳会话。 */
    tapTarget = shown && total > 0 ? Math.round(progressAt(event.clientY) * (total - 1)) : -1
  }

  const onPointerMove = (event: Element_): void => {
    if (pointer === null || (typeof event.pointerId === 'number' && event.pointerId !== pointer)) return
    if (!active) {
      if (Math.abs(event.clientY - startY) <= RAIL_DRAG_Y) return
      tapTarget = -1
      begin(event.clientY)
      if (!active) return
    }
    applyIndex(Math.round(progressAt(event.clientY) * (total - 1)))
    if (typeof event.preventDefault === 'function') event.preventDefault()
  }

  const onPointerUp = (event: Element_): void => {
    if (pointer === null || (typeof event.pointerId === 'number' && event.pointerId !== pointer)) return
    /* 已抽出时"点一下不拖"：跳到指尖那根刻度并落定一次。 */
    if (!active && tapTarget >= 0) {
      const at = tapTarget
      tapTarget = -1
      applyIndex(at)
      commitIndex()
      finish(false)
      return
    }
    tapTarget = -1
    finish(true)
  }

  const onPointerCancel = (event: Element_): void => {
    if (pointer === null || (typeof event.pointerId === 'number' && event.pointerId !== pointer)) return
    finish(false)
  }

  /* 键盘：宿主刻度被让位成"引擎"之后，无障碍路径由热区自己扛（原型把 role=slider 放在
     .edge 上）。keydown 只移动选中项、keyup 才落定 —— 长按连发最终只跳一次。 */
  const onKeyDown = (event: Element_): void => {
    if (!mobile.matches) return
    const key = event.key
    let delta = 0
    if (key === 'ArrowUp') delta = -1
    else if (key === 'ArrowDown') delta = 1
    else if (key === 'PageUp') delta = -10
    else if (key === 'PageDown') delta = 10
    else if (key !== 'Home' && key !== 'End') return
    if (typeof event.preventDefault === 'function') event.preventDefault()
    if (!prepare()) return
    if (!active) {
      active = true
      clearTimer()
      doc.setAttribute(RAIL_REVEALED, '')
      doc.setAttribute(RAIL_DRAGGING, '')
    }
    if (key === 'Home') applyIndex(0)
    else if (key === 'End') applyIndex(total - 1)
    else applyIndex((index < 0 ? 0 : index) + delta)
  }

  const onKeyUp = (): void => finish(true)

  /* 滚一下对话就探头（原型每次滚动也 reveal 一次）：手机上"右缘有索引"只能这样被发现。
     同时让**指示器跟着读者走**（原型 L60 的 scroll 处理）：手动滚动时读数与哑铃要反映
     "现在读到哪一轮"，否则指示器只在拖轨道时才动。
     必须排掉宿主轨道自己的滚动容器 —— 拖动时它在跟着滚，不排掉轨道会一直亮着。 */
  const onScroll = (event: Element_): void => {
    if (active || !mobile.matches) return
    const target: Element_ = event.target
    if (!target || target.nodeType !== 1 || typeof target.matches !== 'function') return
    if (!target.matches(TRANSCRIPT_SCROLL)) return
    /* settle 还钉着的时候读者的滚动不抢指示器（原型 L60 同样在 anchorFrame 期间 return）。 */
    if (!anchorFrame) scheduleReaderFollow()
    reveal()
  }

  /* 旋屏 / 软键盘 / 尺寸变化：几何要重抄、刻度要重排（原型的 resize 处理同款）；
     退出竖屏（>480px）时轨道交回宿主的容器查询管辖，把状态清干净。 */
  const onResize = (): void => {
    if (!mobile.matches) {
      finish(false)
      doc.removeAttribute(RAIL_REVEALED)
      return
    }
    if (doc.hasAttribute(RAIL_REVEALED) && !prepare()) doc.removeAttribute(RAIL_REVEALED)
  }

  /* 原型 L62 与宿主自己的 READING_INTENTS（wheel / touchstart / pointerdown / keydown /
     beforematch）同一口径：用户一有真实输入就立刻从 settle 手里接管。拖动中不接管 ——
     那时正文归我们跟。beforematch（页内查找）太冷门，不挂。 */
  const onTakeOver = (): void => {
    if (!active) releaseAnchor()
  }

  const onWindowBlur = (): void => finish(false)

  document.body.append(root)
  document.body.append(edge)
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('pointermove', onPointerMove, true)
  document.addEventListener('pointerup', onPointerUp, true)
  document.addEventListener('pointercancel', onPointerCancel, true)
  document.addEventListener('scroll', onScroll, true)
  document.addEventListener('wheel', onTakeOver, { capture: true, passive: true })
  document.addEventListener('touchstart', onTakeOver, { capture: true, passive: true })
  document.addEventListener('keydown', onTakeOver, true)
  window.addEventListener('resize', onResize)
  window.addEventListener('blur', onWindowBlur)
  const viewport = window.visualViewport
  if (viewport && typeof viewport.addEventListener === 'function') viewport.addEventListener('resize', onResize)
  if (typeof mobile.addEventListener === 'function') mobile.addEventListener('change', onResize)
  edge.addEventListener('keydown', onKeyDown)
  edge.addEventListener('keyup', onKeyUp)
  edge.addEventListener('blur', onKeyUp)

  return () => {
    clearTimer()
    if (raf) window.cancelAnimationFrame(raf)
    raf = 0
    if (readerFrame) window.cancelAnimationFrame(readerFrame)
    readerFrame = 0
    pointer = null
    active = false
    releaseAnchor()
    setOverflowAnchor(false)
    clearCardY()
    markTarget(null)
    clearPreview()
    doc.removeAttribute(RAIL_REVEALED)
    doc.removeAttribute(RAIL_DRAGGING)
    document.removeEventListener('pointerdown', onPointerDown, true)
    document.removeEventListener('pointermove', onPointerMove, true)
    document.removeEventListener('pointerup', onPointerUp, true)
    document.removeEventListener('pointercancel', onPointerCancel, true)
    document.removeEventListener('scroll', onScroll, true)
    document.removeEventListener('wheel', onTakeOver, true)
    document.removeEventListener('touchstart', onTakeOver, true)
    document.removeEventListener('keydown', onTakeOver, true)
    window.removeEventListener('resize', onResize)
    window.removeEventListener('blur', onWindowBlur)
    if (viewport && typeof viewport.removeEventListener === 'function') viewport.removeEventListener('resize', onResize)
    if (typeof mobile.removeEventListener === 'function') mobile.removeEventListener('change', onResize)
    edge.removeEventListener('keydown', onKeyDown)
    edge.removeEventListener('keyup', onKeyUp)
    edge.removeEventListener('blur', onKeyUp)
    root.remove()
    edge.remove()
  }
}
/** 全部效果的安装器（顺序无关，各自独立）。 */
export const installers: Array<() => Disposer> = [
  installTouchInteractions,
  installAddButtonKeyboardGuard,
  installEnterKeyHint,
  installKeyboardFollow,
  installSidebarFab,
  installModelPillWidth,
  installTurnRailScrub,
]

export function apply(ctx: ClientCtx): void {
  /* 安装推迟到 load 之后的空闲帧（见 installWhenIdle）：dsh 启动时每个客户端插件都在
     抢同一段主线程，而本模块的效果全都要等用户交互才用得上。disposer 在"还没装上"时
     也必须能安全回收——installWhenIdle 用 cancelled 标记兜住。 */
  ctx.effect(
    () =>
      installWhenIdle(() => {
        const disposers = installers.map((install) => install())
        return () => {
          for (const dispose of disposers) dispose()
        }
      }),
    'dsh-android-ui: mobile DOM effects',
  )
}
