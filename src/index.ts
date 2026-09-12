/**
 * dsh-android-ui —— Node 半。
 *
 * 只做"文档级"注入，不碰任何文件、不依赖 dist 路径：
 *   1. viewport meta：用 `ctx.webServer.tapIndex()` 就地改写 index.html 里已有的
 *      `<meta name="viewport">`（官方文档把 tapIndex 定义为"结构化行表达不了的标记"的
 *      逃生口；这里要的是【就地替换】而不是新增重复标签，所以用 tap 而不是 html 行）。
 *   2. 移动端 CSS：`{ kind: 'style' }` 结构化行 → 渲染到 <head>。
 *   3. 启动前 polyfill：`{ kind: 'script', placement: 'head' }` 结构化行 → 解析期同步
 *      执行，早于应用 bundle（polyfill 必须比应用先跑）。
 *
 * 官方文档依据：
 *   - 插件形态与 apply/ctx：docs/user/develop/basic/index.zh.md
 *   - 组合包 / cordis.patch.yml / 装载进 profile：docs/user/develop/basic/publish.zh.md
 *   - index 注入表与 tapIndex：dsh-host-webserver 的 renderIndex/tapIndex
 *     （子系统的结构见 docs/subsystems/client-modules.zh.md 对注入行的描述）
 *
 * 浏览器半（运行时 DOM 效果）见 src/client.ts，由 package.json 的 dsh.client 声明发现。
 */
import { MOBILE_CSS } from './mobile-css.ts'
import { PREBOOT_POLYFILLS } from './polyfills.ts'

export const name = 'dsh-android-ui'

/** 硬依赖：没有 webServer 就没有 index 可改，viewport tap 是核心能力。 */
export const inject = ['webServer']

/** 目标 viewport：适配安全区（刘海/挖孔）并让软键盘收缩内容区而不是覆盖页面。 */
export const VIEWPORT_CONTENT =
  'width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content'

/** index 注入表里的一行（官方行类型：global/script/script-src/script-preload/style/html）。 */
export interface IndexInjectionRow {
  kind: 'style' | 'script' | 'html'
  text?: string
  html?: string
  placement?: 'head' | 'body'
}

/** 本模块贡献的 index 注入行（顺序即渲染顺序）。 */
export function injectionRows(): IndexInjectionRow[] {
  return [
    { kind: 'style', text: MOBILE_CSS },
    { kind: 'script', placement: 'head', text: PREBOOT_POLYFILLS },
  ]
}

const VIEWPORT_TAG = `<meta name="viewport" content="${VIEWPORT_CONTENT}" />`

/**
 * 就地改写 index.html 的 viewport meta；attribute 顺序两种写法都认。
 * 找不到时补一个（宁可多一个自己的也不留没有 viewport 的页面：产品页一定有，
 * 这里只是对上游改版后的兜底）。
 * @param html - 原始 index.html 文本。
 * @returns 改写后的文本（找不到 meta 时插入自己的）。
 */
export function rewriteViewportMeta(html: string): string {
  const nameFirst = /<meta\s+name=["']viewport["']\s+content=["'][^"']*["']\s*\/?>/i
  const contentFirst = /<meta\s+content=["'][^"']*["']\s+name=["']viewport["']\s*\/?>/i
  if (nameFirst.test(html)) return html.replace(nameFirst, VIEWPORT_TAG)
  if (contentFirst.test(html)) return html.replace(contentFirst, VIEWPORT_TAG)
  return html.replace(/<head(?:\s[^>]*)?>/i, (open) => `${open}\n    ${VIEWPORT_TAG}`)
}

/** 宿主半用到的最小 Cordis 上下文（结构化类型，不引入任何运行时依赖）。 */
export interface HostCtx {
  on(event: string, listener: (table: IndexInjectionRow[]) => void): unknown
  effect(fn: () => unknown, label?: string): unknown
  webServer: { tapIndex(transform: (html: string) => string): () => void }
}

export function apply(ctx: HostCtx): void {
  ctx.on('webserver/index-inject', (table: IndexInjectionRow[]) => {
    if (!Array.isArray(table)) return
    table.push(...injectionRows())
  })
  // tapIndex 返回 disposer；交给 ctx.effect 持有，插件停止/更新时自动摘除。
  ctx.effect(() => ctx.webServer.tapIndex(rewriteViewportMeta), 'dsh-android-ui: viewport meta tap')
}
