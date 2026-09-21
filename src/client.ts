/**
 * dsh-android-ui —— 浏览器半（客户端插件）。
 *
 * 只做"运行期 DOM 效果"，因为这些效果必须跟随活 DOM 反复执行；能在 HTML 里一次
 * 表达完的（viewport / CSS / polyfill）都放在 Node 半的 index 注入里，见 src/index.ts。
 *
 * 移植自 deepseek-harness-android/patches/mobile.js 第 3~8 段：
 *   3) tooltip 气泡重吸附（React 只在 window resize 时重定位，侧栏开合/滚动后漂移）
 *   4) 触摸交互：按下显示气泡、松手销毁；抽屉遮罩点击关闭
 *   5) 作曲栏 "+" 号在触摸端不唤起软键盘（捕获 mousedown，阻止 React 根 keepFocus）
 *   6) 子代理下拉吸附触发器下方（实测 containing block 偏移后换算坐标）
 *      —— 已删：宿主现在自己用 createPortal + JS 算坐标（top = 触发器下沿 + 5、
 *      left 视口内 clamp）并写内联 style，这里再写只会跟 React 抢同一个属性。
 *   7) 作曲输入框 enterkeyhint=newline（配合"普通回车=换行"的会话补丁）
 *   8) 软键盘跟随：visualViewport 收缩时把根容器压到可视高度，整页（含输入框）抬起
 *
 * 生命周期：全部注册包在一个 ctx.effect 里，返回值统一回收（rAF/observer/监听器/
 * 定时器/html 样式），插件停止或更新后页面回到未安装状态——这是官方对插件副作用的
 * 硬要求（docs/user/develop/basic/index.zh.md 的"自动清理"一节）。
 */
export const name = 'dsh-android-ui'

/** 不需要任何宿主服务：效果全部作用于本页 DOM。 */
export const inject: string[] = []

/** tooltip 气泡类名（dsh 构建产物哈希类，版本敏感：同一个 0.1.5-rc.1 重新构建后
 *  由 ._bubble_owhem_8 变成 ._bubble_1nw3t_1）。 */
const BUBBLE = '._bubble_1nw3t_1'
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

type Disposer = () => void
type Element_ = any

/** 元素可见性（display/visibility/opacity + 是否有渲染矩形）。 */
function isVisible(el: Element_): boolean {
  if (!el || el.getClientRects().length === 0) return false
  const cs = window.getComputedStyle(el)
  return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0'
}

/** 在视口内 clamp 一个矩形左上角。 */
function clampToViewport(left: number, top: number, width: number, height: number, margin: number): { left: number; top: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  let l = left
  let t = top
  if (l + width > vw - margin) l = vw - margin - width
  if (l < margin) l = margin
  if (t + height > vh - margin) t = vh - margin - height
  if (t < margin) t = margin
  return { left: l, top: t }
}

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

/** 每帧唤醒式的 DOM 任务骨架：MutationObserver 只在有活儿时驱动 rAF。 */
function installFrameTask(selector: string, place: (node: Element_) => void): Disposer {
  let raf = 0
  const tick = (): void => {
    raf = 0
    let alive = false
    const nodes = document.querySelectorAll(selector)
    for (let i = 0; i < nodes.length; i += 1) {
      if (!isVisible(nodes[i])) continue
      alive = true
      place(nodes[i])
    }
    if (alive) raf = window.requestAnimationFrame(tick)
  }
  const wake = (): void => {
    if (!raf) raf = window.requestAnimationFrame(tick)
  }
  const observer = new MutationObserver(wake)
  try {
    observer.observe(document.documentElement, { childList: true, subtree: true })
  } catch {
    /* 无 documentElement 时不观察，退化为仅 resize/scroll 驱动 */
  }
  window.addEventListener('resize', wake)
  window.addEventListener('scroll', wake, true)
  wake()
  return () => {
    observer.disconnect()
    window.removeEventListener('resize', wake)
    window.removeEventListener('scroll', wake, true)
    if (raf) window.cancelAnimationFrame(raf)
    raf = 0
  }
}

/** 3) tooltip 气泡：贴着锚点（前一个兄弟元素）右侧垂直居中，超出视口则收回。 */
function installTooltipReanchor(): Disposer {
  const GAP = 8
  const MARGIN = 12
  return installFrameTask(BUBBLE, (bubble) => {
    const anchor = bubble.previousElementSibling
    if (!anchor) return
    const a = anchor.getBoundingClientRect()
    if (a.width === 0 && a.height === 0) return
    const b = bubble.getBoundingClientRect()
    const side = bubble.getAttribute('data-side') || 'right'
    let left: number
    let top: number
    if (side === 'right') {
      left = a.right + GAP
      top = a.top + (a.height - b.height) / 2
    } else if (side === 'top') {
      left = a.left + (a.width - b.width) / 2
      top = a.top - b.height - GAP
    } else if (side === 'bottom') {
      left = a.left + (a.width - b.width) / 2
      top = a.bottom + GAP
    } else {
      left = a.left + (a.width - b.width) / 2
      top = a.top + (a.height - b.height) / 2
    }
    const placed = clampToViewport(left, top, b.width, b.height, MARGIN)
    bubble.style.left = `${placed.left}px`
    bubble.style.top = `${placed.top}px`
  })
}

/** 4) 触摸交互：按下显示被触摸锚点的气泡；松手销毁全部气泡；遮罩/会话行点按收起抽屉；
 *  子代理血缘触发器点按补开下拉（宿主只给了 hover 路径，见下）。 */
function installTouchInteractions(): Disposer {
  const isTouch =
    'ontouchstart' in window || (typeof navigator !== 'undefined' && (navigator.maxTouchPoints || 0) > 0)
  let hideTimer = 0
  let dismissTimer = 0
  let menuTimer = 0
  const wakeAnchor = (): void => {
    window.dispatchEvent(new Event('resize'))
  }
  const showTouchedBubble = (event: Event): void => {
    let el: Element_ = event.target
    while (el && el.nodeType === 1) {
      const sibling = el.nextElementSibling
      if (sibling && sibling.classList && sibling.classList.contains(BUBBLE.slice(1))) {
        if (sibling.style.display === 'none') sibling.style.display = ''
        wakeAnchor()
        return
      }
      el = el.parentElement
    }
  }
  const hideBubbles = (): void => {
    const nodes = document.querySelectorAll(BUBBLE)
    for (let i = 0; i < nodes.length; i += 1) nodes[i].style.display = 'none'
  }
  const onTouchEnd = (): void => {
    hideTimer = window.setTimeout(hideBubbles, 120)
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
  document.addEventListener('touchstart', showTouchedBubble, true)
  document.addEventListener('touchend', onTouchEnd, true)
  document.addEventListener('click', onDocumentClick, true)
  return () => {
    if (hideTimer) window.clearTimeout(hideTimer)
    if (dismissTimer) window.clearTimeout(dismissTimer)
    if (menuTimer) window.clearTimeout(menuTimer)
    document.removeEventListener('touchstart', showTouchedBubble, true)
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

/** 全部效果的安装器（顺序无关，各自独立）。 */
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

export const installers: Array<() => Disposer> = [
  installTooltipReanchor,
  installTouchInteractions,
  installAddButtonKeyboardGuard,
  installEnterKeyHint,
  installKeyboardFollow,
  installSidebarFab,
  installModelPillWidth,
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
