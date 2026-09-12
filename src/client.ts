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

/** 气泡类名（dsh 构建产物哈希类，版本敏感）。 */
const BUBBLE = '._bubble_owhem_8'
/** 子代理下拉类名（同上）。 */
const SUBAGENT_MENU = '.h8S2Va_menu'
/** 作曲输入框 / "+" 号 / 侧栏切换按钮类名（同上）。 */
const COMPOSER_INPUT = '.uV2eYG_input'
const COMPOSER_ADD = '.uV2eYG_add'
const SIDEBAR_TOGGLE = '.hHd-Xa_toggle'
/** 会话行 / 行内交互控件（同上）。会话行本身是 div[role=treeitem]，行内的按钮才是控件。 */
const SESSION_ROW = '[class*="_sessionRow"]'
const ROW_CONTROL = 'button, [role="button"], input, [class*="_rowActions"]'
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

/** 4) 触摸交互：按下显示被触摸锚点的气泡；松手销毁全部气泡；遮罩/会话行点按收起抽屉。 */
function installTouchInteractions(): Disposer {
  let hideTimer = 0
  let dismissTimer = 0
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
  /* 覆盖式抽屉的退出路径。0.1.5-rc.1 把 data-details-collapsed 换成了
     data-sidebar-collapsed（**展开时该属性整个消失**），旧的守卫因此永不成立：
     390px 实测真鼠标点遮罩不关、点会话行也不关，抽屉展开后只能去按抽屉里那颗
     收起按钮。这里只替用户点宿主的收起按钮，不自己改宿主状态；等一拍确认帧仍
     是展开态才点，避免宿主自己已经收起时被我们再打开一次。
     行内控件（三点菜单等）不算"点会话行"：宿主的三点按钮自己 stopPropagation，
     但本监听在 document 捕获阶段先跑，不在这里排掉，菜单刚弹就被我们收掉抽屉
     （真机复现过）。判定只能看 target —— 宿主是点击后约 100ms 才给行加 menuOpen
     并挂菜单，等行状态是竞态。 */
  const onBackdropClick = (event: Event): void => {
    const target: Element_ = event.target
    if (!target || target.nodeType !== 1 || typeof target.closest !== 'function') return
    const row = target.closest(SESSION_ROW)
    const onRowControl = !!row && !!target.closest(ROW_CONTROL)
    if (!target.hasAttribute('data-shell-overlay') && !(row && !onRowControl)) return
    const frame = target.closest('[class*="_frame"]')
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
  document.addEventListener('click', onBackdropClick, true)
  return () => {
    if (hideTimer) window.clearTimeout(hideTimer)
    if (dismissTimer) window.clearTimeout(dismissTimer)
    document.removeEventListener('touchstart', showTouchedBubble, true)
    document.removeEventListener('touchend', onTouchEnd, true)
    document.removeEventListener('click', onBackdropClick, true)
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

/** 6) 子代理下拉：position:fixed 的 containing block 可能是带 transform/contain 的祖先，
 *  每帧实测偏移（left/top/transform 临时归零后读矩形）再换算坐标，避免菜单出屏。 */
function installSubagentMenuReanchor(): Disposer {
  const GAP = 5
  const MARGIN = 12
  return installFrameTask(SUBAGENT_MENU, (menu) => {
    const root = menu.parentElement
    if (!root) return
    const r = root.getBoundingClientRect()
    const m = menu.getBoundingClientRect()
    if (m.width === 0 && m.height === 0) return /* 宽度未就绪时跳过，等下一帧 */
    const placed = clampToViewport(r.left, r.bottom + GAP, m.width, m.height, MARGIN)
    const prevLeft = menu.style.left
    const prevTop = menu.style.top
    const prevTransform = menu.style.transform
    menu.style.left = '0px'
    menu.style.top = '0px'
    menu.style.transform = 'none'
    const base = menu.getBoundingClientRect()
    menu.style.left = prevLeft
    menu.style.top = prevTop
    menu.style.transform = prevTransform
    menu.style.left = `${placed.left - base.left}px`
    menu.style.top = `${placed.top - base.top}px`
  })
}

/** 7) 作曲输入框 enterkeyhint=newline：让安卓输入法把回车键显示为"换行"。 */
function installEnterKeyHint(): Disposer {
  const applyHint = (): void => {
    const el = document.querySelector(COMPOSER_INPUT)
    if (el && !el.hasAttribute('enterkeyhint')) el.setAttribute('enterkeyhint', 'newline')
  }
  applyHint()
  const observer = new MutationObserver(applyHint)
  try {
    observer.observe(document.documentElement, { childList: true, subtree: true })
  } catch {
    /* 无 documentElement 时只在装载时设一次 */
  }
  return () => observer.disconnect()
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
 *  390px 上是 14% 宽度），入口由这颗按钮承担。图标直接克隆宿主折叠态开关里的
 *  svg，省一份手写图标、且自动跟随主题；点击只是转发给宿主自己的开关按钮，
 *  不自己改宿主状态。展开态由抽屉自带的收起按钮负责，这里置灰隐藏。 */
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
  const sync = (): void => {
    const host = document.querySelector(SIDEBAR_TOGGLE)
    const frame = document.querySelector('[class*="_frame"]')
    const show = !!mobile && mobile.matches && !!host && !!frame && frame.hasAttribute('data-sidebar-collapsed')
    if (!show) {
      fab.removeAttribute(FAB_VISIBLE_ATTR)
      return
    }
    if (fab.childNodes.length === 0) {
      const icon = host.querySelector('svg')
      if (!icon) return /* 图标还没渲染，等下一次 sync */
      fab.append(icon.cloneNode(true))
    }
    fab.setAttribute(FAB_VISIBLE_ATTR, '')
  }
  const openDrawer = (): void => {
    const host = document.querySelector(SIDEBAR_TOGGLE)
    if (host) host.click()
  }
  fab.addEventListener('click', openDrawer)
  document.body.append(fab)
  const observer = new MutationObserver(sync)
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
  window.addEventListener('resize', sync)
  if (mobile && typeof mobile.addEventListener === 'function') mobile.addEventListener('change', sync)
  sync()
  return () => {
    observer.disconnect()
    window.removeEventListener('resize', sync)
    if (mobile && typeof mobile.removeEventListener === 'function') mobile.removeEventListener('change', sync)
    fab.removeEventListener('click', openDrawer)
    fab.remove()
  }
}

/** 全部效果的安装器（顺序无关，各自独立）。 */
export const installers: Array<() => Disposer> = [
  installTooltipReanchor,
  installTouchInteractions,
  installAddButtonKeyboardGuard,
  installSubagentMenuReanchor,
  installEnterKeyHint,
  installKeyboardFollow,
  installSidebarFab,
]

export function apply(ctx: ClientCtx): void {
  ctx.effect(() => {
    const disposers = installers.map((install) => install())
    return () => {
      for (const dispose of disposers) dispose()
    }
  }, 'dsh-android-ui: mobile DOM effects')
}
