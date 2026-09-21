# AGENTS.md

## Project

- 单一 npm 包的 **DeepSeek Harness 组合包（bundle）**：Node 半做 index 文档级注入，浏览器半做运行时 DOM 效果。它把 `deepseek-harness-android` 原先"改写 dist/index.html 注入"的界面改动，换成官方插件形态。
- 名字边界：目录/README/包名/客户端 bundle 注册 id/`cordis.patch.yml` 行 id **都必须是 `dsh-android-ui`**（客户端模块系统用包名做 row id，扫描时校验一致）。
- 真正的入口：
  - `cordis.patch.yml` —— 组合包 patch 层，`insert` 一行把本包挂进 profile 树。
  - `src/index.ts` —— Node 半：`ctx.on('webserver/index-inject')` 推注入行 + `ctx.effect(() => ctx.webServer.tapIndex(...))` 改 viewport。
  - `src/client.ts` —— 浏览器半，经 `package.json` 的 `dsh.client.platform: "web"` 与 `exports["./client"]` 被发现。
  - `lib/` —— 已提交的构建产物（宿主的客户端模块扫描要求 bundle 事先存在，git 安装不会跑 build）。
- 不碰任何 dsh 产品文件；不依赖 dist 路径；不改 `~/.dsh`。

## Commands

```sh
npm install          # 唯一 devDependency：esbuild
npm run build        # src/*.ts -> lib/index.js (ESM) + lib/client.js (IIFE)
npm test             # 离线冒烟 17 项（不需要 dsh 在跑）
npm run check        # build && test —— 改任何 src/ 后的必跑门
npm run manifest     # 可选：PWA manifest display -> standalone（默认 dry-run）

# 装进 profile 验证（会链接本目录，最后一步需要重启 dsh web）
dsh plugin --profile web add link:$PWD
dsh --profile web --dump-config      # 应出现 "# == dsh-android-ui"
```

- 没有 lint / formatter / CI。`npm run check` 就是门。
- `lib/` 不入 git 才怪：客户端 bundle 必须在安装前就构建好（官方 publish 文档：git 安装不会运行 build，除非作者提供 `prepare`）。改了 `src/` 不跑 `npm run build`，改动等于没生效。

## Architecture

- **Host/client 分工由"时机"决定，不是由代码量决定**：
  - 必须在应用 bundle 之前生效的（viewport、polyfill）→ Node 半的 index 注入。head 里的注入行在解析期同步执行，是唯一确定的"早于应用"执行点；插件 `apply()` 还要等 fiber 就绪，不能拿它保证顺序。
  - 必须跟随活 DOM 反复跑的（气泡定位、下拉吸附、键盘跟随）→ 浏览器半的 `ctx.effect`。
- Node 半三种贡献，缺一不可：
  1. `ctx.webServer.tapIndex(rewriteViewportMeta)` —— **就地改写**已有的 `<meta name="viewport">`。不要改成 `{ kind: 'html' }` 行新增一个 meta：产品页本来就有 viewport meta，重复标签由浏览器自己挑一个，行为不可预期。
  2. `{ kind: 'style', text: MOBILE_CSS }` —— 渲染进 `<head>`。
  3. `{ kind: 'script', placement: 'head', text: PREBOOT_POLYFILLS }` —— 解析期执行，早于应用 module 脚本（测试里有断言）。
- `inject = ['webServer']` 是硬依赖：没有 webServer 就没有 index 可改。别改成 `ctx.get('webServer')` 的可选读法——那样插件可能在 webServer 挂载前 apply，tap 永远不注册，viewport 静默失效。
- 浏览器半：所有效果在**一个** `ctx.effect` 中安装，返回的 disposer 逐个回收。`installers` 数组是唯一的注册表。
- **CSS 表达不了的就量出来喂给 CSS**：模型胶囊的宽度上限要吃权限胶囊的**实测宽度**（`installModelPillWidth` 用 ResizeObserver 把 px 写进卡片上的 `--dsh-modes-w`，样式表的 `max-width: calc(100% - var(--dsh-modes-w, 50%) - 12px)` 用它算出"顶到邻居就省略"）。变量没写上/没有 ResizeObserver 时样式表的兜底值仍然安全（不会重叠）。
- **安装时机也是性能设计**：`apply()` 里只挂一个 `load` 钩子，真正的安装交给 `installWhenIdle`（load 之后的空闲帧）；突变驱动的工作一律过 `installPerFrame` 收敛到一帧一次。宿主首屏挂载期间突变是连续的，装在前就是跟宿主抢主线程。

## Conventions

- **每个效果必须可回收、且必须还原自己改过的 DOM**。软键盘跟随会写 `html.style.height` / `data-dsh-kb-open` / `--dsh-kb`，disposer 里必须清空；否则插件重载一次，页面就永久留着一个被压扁的高度（冒烟测试专门断言了这点）。
- **rAF 循环 + MutationObserver 的任务必须成对关闭**（`installFrameTask` 是唯一实现，别再手写第二份）：断 observer、摘监听、`cancelAnimationFrame`。
- **ticker/定时器同理**：`installTouchInteractions` 里的 `hideTimer` 必须在 disposer 里 `clearTimeout`。
- **不要在 `apply()` 里同步装效果**：每条效果都会建 document 级 MutationObserver，而 dsh 启动时会同时唤醒所有客户端插件。走 `installWhenIdle`（load 之后的空闲帧）+ `installPerFrame`（每帧最多跑一次）——实测 2000 节点 / 200 批突变的模拟启动：同步装 = 800 次 MO 回调 / 603 次 `querySelector` / ~40ms 主线程；延时装 = 首屏 0 次，装上后同一批突变只 28 次查询。这些效果都只在用户交互后才有用，晚半个节拍装没有观感差异。
- **中文注释**，与上游 Android 工具包保持一致的表述（说明"为什么"而不是"做了什么"）。
- **哈希类名集中放置**：`src/client.ts` 顶部常量（`BUBBLE` / `COMPOSER_INPUT` / `COMPOSER_ADD` / `SIDEBAR_TOGGLE` / `SIDEBAR_PANEL_ICON`）与 `src/mobile-css.ts`。上游改版后只改这两处，不要在函数体里散落选择器字符串。核对方法：在 `npm root -g`/@deepseek-ai/dsh/node_modules 里 grep 类名，或用本地名反查（`grep -rho "[A-Za-z0-9_-]*_hint\b"`）；**版本号没变也会变**（同一个 0.1.5-rc.1 重新发布后 `.h8S2Va_*`→`.ZKlsPq_*`、`.Md3f7G_hint`→`.EvIC1a_hint`、`._list_19372_8`→`._list_1nxmc_8`、`._bubble_owhem_8`→`._bubble_1nw3t_1`）。
- **宿主自己修好的就删掉，别守着旧规则**：子代理下拉的"吸附触发器 + 视口内 clamp"上游已用 `createPortal` + JS 坐标（内联 `style`）实现；本文件**不能**再写 `left/right/top` 的 `!important`（`!important` 盖得过内联样式），`installSubagentMenuReanchor` 那种每帧回写坐标的浏览器半效果同理——不是失效，是有害。删之前先确认宿主新实现（`catalogMenuPosition` 这类函数）确实做了同一件事。
- 注入的 CSS/JS 是**模板字符串文本**：内容里不能出现 `</script>`（会提前闭合注入的 script 标签），**也不能出现反引号**（CSS 注释里写 `flex: 0 0 100%` 会当场把模板字符串截断，esbuild 报 `Expected ";" but found ...`）；`String.raw` 只用于避免反斜杠被吞。
- **宿主只给 hover 路径的交互，触摸端要补键盘路径**：页头子代理触发器（`.ZKlsPq_trigger` / `_switcherTrigger`）外层只挂 `onMouseEnter`（150ms 后开菜单），按钮自己只有 `onKeyDown(ArrowDown)`，**当前会话那一颗连 onClick 都没有**。触摸端第一下靠浏览器补发的合成 mouseenter 能开，之后 hover 状态不变、不再派发 mouseenter，同一颗按钮就再也点不开（真机："点子会话有时打不开"）。`installTouchInteractions` 在点按触发器后等 250ms 确认菜单没开，就给触发器派发一次 `ArrowDown` —— 走宿主自己的键盘路径，不要合成 click。
- **页头默认一行放完**：标题（crumbs，可收缩省略）+ 当前 preset 胶囊（`headerActions` 里宿主 AgentPresetLabel，22px 高 / 最多 180px）必须同排。写死 `flex-basis: 100%` 会让它们永远分两排、中间空一整行（用户实测）；`flex: 0 1 auto` + `titleCluster` 的 wrap 才是"紧凑且不重叠"。
- 结构化类型优先：Node 半用 `HostCtx`，浏览器半用 `ClientCtx`，**不 import 任何 `@deepseek-ai/*`**（无 peerDependency，也就没有版本耦合）。
- `dsh.client` 里不要写 `inject`：本模块不消费任何客户端服务。

## Pitfalls

- **客户端 bundle 的形状是协议**：`window.__ModuleLoader__.load({ id, factory })`，`id` 必须等于包名，`factory(require)` 返回带 `name`/`apply` 的模块。改 `build.mjs` 的 banner/footer/`globalName` 任一处都会让浏览器端静默不加载（页面正常但效果全无）。冒烟测试会按同样协议真装载一次。
- **`lib/index.js` 是 bundle 过的 ESM**：Node 半 import 的 `./mobile-css.ts` / `./polyfills.ts` 会被内联，所以运行时不需要这两个文件存在。
- **悬浮开关的图标别克隆"toggle 里的第一个 svg"**：折叠态下（`wide = !collapsed || !settled` 为 false）宿主 toggle 里排在最前的是 `sidebar.brand.mark` 槽位的品牌标记（`FishLogo`），克隆它左上角就变成一个"鱼按钮"（用户实测反馈）。要的是 `.hHd-Xa_panelIcon`——即 `IconPanelLeftOutline16`，与页头右上角那颗 `ExpandButton`（`[data-sidebar-right-expand]`，`dsh-client-ui-sidebar-right` 的 `conversation.session.header.corner` 座席）是同一个图形组件；取不到时退到那颗按钮的 svg 兜底。克隆后剥掉宿主类名（理由见 `src/client.ts` 里那段注释），尺寸由本文件 CSS 给。
- **职责边界：Android/移动端界面适配，不做布局重构**。竖屏布局（抽屉/面板/断点）借鉴其他模块（`dsh-mobile-nav`）。本模块覆盖 viewport/安全区、启动期 polyfill、软键盘跟随、触摸交互、`enterkeyhint`，以及下拉与面板的"不出屏"定位——都属于同一批界面适配，别单独拆包。两边都改同一元素的定位时，以 CSS 顺序与 `!important` 为准，属于需要人工取舍的冲突，不要靠加 `!important` 硬压。
- **宿主给 `.uV2eYG_row` 的 `container-type: inline-size` 是包含块**：它附带 layout containment，使**行盒**成为绝对/固定后代的包含块。作曲栏两颗胶囊要悬到卡片上方（`bottom:100%`），就必须在本文件把行盒改成 `container-type: normal`（包含块回到 `position:relative` 的卡片）；删掉这条，胶囊会静默落回输入框上——正是 2026-09 那版要拆掉的旧形态。代价：宿主那两条 `@container` 查询不再命中（权限/模型标签本来就被本文件强制显示，模型触发器宽度上限退化成 45vw，仍被胶囊自身的 max-width 收住），卡片内的 `.JObwrW_panel`（position:fixed）改以视口为锚（原 CSS 的意图）。
- **光标与提示词是两套几何，必须手动同步**：提示词 `.uV2eYG_placeholder` 不是输入框的后代，而是 `.uV2eYG_grow`（`position:relative`）里与它**平级**的绝对定位节点，宿主按自己的输入框内边距写死 `inset:4px 8px auto 14px`。本文件把 `.uV2eYG_input` 改成更紧凑的 `padding-top/left/line-height`，就必须把同一组值补给提示词，否则光标与提示词错位（冒烟测试里有一条等式盯着这三个值）。
- **`enterkeyhint=newline` 与"普通回车=换行"是配套的**：后者是改产品包 `dsh-client-ui-conversation` 的按键映射（官方无扩展点），留在 `deepseek-harness-android/setup.sh` 4d。只装本模块时输入法会显示"换行"但回车仍然是发送——这是已知的、文档里写明的不一致，不要"顺手"在浏览器半里用 DOM 合成按键去修（ProseMirror 编辑器的合成事件不可靠）。
- **PWA manifest 只能离线改**：浏览器独立 GET 那份 JSON，运行期插件改不了，`tapIndex` 也只作用于 index.html。`scripts/manifest-standalone.mjs` 是一次性脚本，默认 dry-run。
- **跨 realm 断言陷阱**：冒烟测试在 `node:vm` 里装载浏览器半，vm 里的数组有自己的 prototype，`assert.deepEqual(x, [])` 会因原型不同而失败——用 `.length` 比较。
- **`check()` 是同步的**：往里塞 `async` 回调会让失败变成 unhandled rejection 而"看起来通过"。需要官方 ESM 解析器时用 `createRequire(...)(...)`（Node ≥22 支持 require(ESM)），不要用 `await import`。

## Testing & QA

- `npm test` 覆盖：注入行形状、移动端 CSS 的作曲栏版式尺寸契约（胶囊带预留 ≥ 胶囊 28px + 间隔、胶囊 `flex-shrink: 0` 不许折行顶高、底行 `flex-wrap: nowrap`、行盒 `container-type: normal`、提示词与输入框的 `top/left/line-height` 三点等式、旧的重叠 hack 已删）、viewport 就地改写（含幂等）、用官方 `renderIndexInjections()` 渲染真实 index.html 的顺序断言、VM 里真跑 polyfill、VM 里按协议装载浏览器半并断言完整卸载、官方 `loadOverlayPatches()` 解析本包 patch 层、包契约（`dsh.bundle`/`dsh.client`/`exports` 指向的文件都存在），以及浏览器半的**安装时机**（load 前不装任何 observer/按钮、load 后才装上、load 前卸载后迟到的 load 不能把插件唤醒）。
- 还有一条"宿主类名核对"：构建产物里不许再出现已核对过的旧哈希名（`h8S2Va` / `Md3f7G` / `_list_19372_8` / `_bubble_owhem_8`），且移动端 CSS 里不许有 `.ZKlsPq_menu` 规则（会盖掉宿主的内联坐标）。
- 两条"别乱动"的断言：侧栏会话行不许有 `min-height` 覆盖（尺寸交回宿主），会话页头的左基线只许由 `.wSkVaW_header` 给（44px = 悬浮开关让位），标签页左内边距必须归零，`headerActions` 不许再写 `flex-basis: 100%`（会把 preset 顶到自己一行）。
- 悬浮开关的图标与外观也是断言项：必须从 toggle 里取 `.hHd-Xa_panelIcon`（取不到退到 `[data-sidebar-right-expand]`）、不许出现 `querySelector('svg')`；CSS 里 [data-dsh-nav-fab] 按浮层按钮 token 画（`button-floating-fill` 底 + 两层 rgba 纯阴影、**不许**套 elevation token 里那条 `0 0 0 .5px` 描边）、尺寸与页头右上角那颗 ExpandButton 一致（28×28、15px 字形）、`top` 必须是 `env(safe-area-inset-top) + 22px`（与宿主展开态侧栏开关同尺寸同上沿），且 `:hover` 必须与 `:active` 同列（触摸端没有 hover）。
- 浏览器半还断言了**子代理触发器的点按兜底**：点触发器后菜单没开就派发一次 `ArrowDown`、已经开就不派发（宿主只有 hover 路径，见 Conventions）。
- 找不到已安装的 dsh 时，依赖官方渲染器的那几项会打印 `[skip]` 而不是假装通过。
- 真机检查点（装进 profile、重启后，手机 390px 竖屏）：
  1. 地址栏页面无横向滚动，刘海/挖孔不遮内容，底部输入区有 safe-area 留白；
  2. 点作曲栏"+"不弹键盘；输入法回车键显示"换行"；
  3. 作曲栏版式：权限（可能带"计划"胶囊）/模型两颗胶囊在输入框**上方独立成排**（权限贴左、模型贴右，互不重叠，不压输入框、不压消息区），发送键固定停在输入框**右下角**、不折行；模型名尽量完整——能顶到权限胶囊前 12px 才省略（权限胶囊越窄、模型名显示越多）；320px 窄屏同样成立；
  4. 弹出软键盘：作曲栏与整页上移、不被键盘盖住；收起后完全还原；
  5. 侧栏展开是覆盖式抽屉，点右侧遮罩空白处能关闭；设置面板全屏；
  6. 用量/上下文面板与子代理下拉不超出视口；
  7. 会话页头：标题与当前 preset 胶囊同排（放不下才换行）、标题/操作区/标签页左缘共用同一条 44px 基线（悬浮开关让位量落在 `header` 上），纵向紧凑，没有哪一行压到左上角的悬浮开关；左上角那颗是**浮层按钮**（面板图标、28×28、与右上角那颗 ExpandButton 同尺寸、圆底配柔和阴影（无描边）、按下有底色反馈），不是品牌鱼 logo；它的位置与展开态抽屉里那颗侧栏开关（28px @ 上沿 22）重合，开合抽屉时按钮不跳；
  8. 页头子代理触发器：连点几下都能打开下拉（不能只在第一下靠 hover 生效），下拉里点任一子会话都能跳过去；
  9. 老 WebView（无 `AbortSignal.any` / 非安全上下文）下页面能正常启动。
- `deepseek-harness-android` 已于 2026-09 删除 `apply-frontend.sh` / `patches/mobile.css` / `patches/mobile.js`，界面适配全部由本模块承担——不会再出现"两边都注入"。
- **但仍要留意旧注入残留**：在这之前跑过 `apply-frontend.sh` 的部署，`dsh-web-frontend/dist/index.html` 里还留着 `<style id="dsh-mobile-adapt">` 与那段 polyfill/效果脚本。它与本模块**内容等价、叠加无害**（同款规则与幂等监听），只是 DOM 效果会跑两份；下一次 `npm install -g @deepseek-ai/dsh`（或重跑 `setup.sh`）重写 dist 后即消失。排查"效果像是执行了两遍"时先看这个。

## Maintenance

- 本文件是活参考：发现新的命令、约定或坑就地更新；与源码不符的条目删掉，不要留过时说明。
- 上游 dsh 升级后先跑 `npm run check`，再按"真机检查点"逐条过一遍；哈希类名不命中时按 `Pitfalls` 更新两处常量/CSS，不要改结构。
