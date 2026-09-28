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
npm test             # 离线冒烟 20 项（不需要 dsh 在跑）
npm run check        # build && test —— 改任何 src/ 后的必跑门
npm run manifest     # 可选：PWA manifest display -> standalone（默认 dry-run）

# 装进 profile 验证（会链接本目录，最后一步需要重启 dsh web）
dsh plugin --profile web add link:$PWD
dsh --profile web --dump-config      # 应出现 "# == dsh-android-ui"
```

- 没有 lint / formatter / CI。`npm run check` 就是门。
- **生效范围不同（实测）**：Node 半（CSS / polyfill / viewport）是**挂载时读进内存的常量和 tap** —— 改了 `src/mobile-css.ts` / `src/polyfills.ts` / `src/index.ts` 之后，光刷新页面没用，必须重启 dsh web（`bash ~/dsh/restart_dsh_now.sh`）。浏览器半 `lib/client.js` 是宿主按请求从磁盘读的，改完 build 后刷新页面即可。`dsh plugin --profile web remove/add` 会被 profile 热挂载接住（行会真的卸载再挂上），但**同一个模块 specifier 不会重新求值**（ESM 缓存），所以它省不掉重启。
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
- **官方已有"左上角座席"，但网页端不挂**：宿主 `shell.leading`（frame 左上角窗口装饰座席）+ `--dsh-frame-leading-clearance` 是给 macOS 用的，`leadingMounted = darwin && sidebarCollapsed`，网页/安卓端永远不挂 —— 所以本模块的悬浮开关与 44px 让位仍然必要。宿主另有一个 `shell.overlay`（list 座席，渲染进 frame 的 `[data-shell-overlay]` 层、z-index 20）是"官方该放悬浮按钮的地方"，本模块出于零依赖（不 import React / 不 inject slots）仍走 `document.body` 追加；要迁过去得先决定是否接受 React 与 `slots` 服务依赖。
- **安装时机也是性能设计**：`apply()` 里只挂一个 `load` 钩子，真正的安装交给 `installWhenIdle`（load 之后的空闲帧）；突变驱动的工作一律过 `installPerFrame` 收敛到一帧一次。宿主首屏挂载期间突变是连续的，装在前就是跟宿主抢主线程。

## Conventions

- **每个效果必须可回收、且必须还原自己改过的 DOM**。软键盘跟随会写 `html.style.height` / `data-dsh-kb-open` / `--dsh-kb`，disposer 里必须清空；否则插件重载一次，页面就永久留着一个被压扁的高度（冒烟测试专门断言了这点）。
- **rAF 循环 + MutationObserver 的任务必须成对关闭**（`installFrameTask` 曾是唯一实现，效果删掉后它一并删除；将来若再需要，照 `installPerFrame` + observer 的组合写，别再手写第二份）：断 observer、摘监听、`cancelAnimationFrame`。
- **ticker/定时器同理**：`installTouchInteractions` 里的 `hintTimer` / `dismissTimer` / `menuTimer` 必须在 disposer 里 `clearTimeout`。
- **不要在 `apply()` 里同步装效果**：每条效果都会建 document 级 MutationObserver，而 dsh 启动时会同时唤醒所有客户端插件。走 `installWhenIdle`（load 之后的空闲帧）+ `installPerFrame`（每帧最多跑一次）——实测 2000 节点 / 200 批突变的模拟启动：同步装 = 800 次 MO 回调 / 603 次 `querySelector` / ~40ms 主线程；延时装 = 首屏 0 次，装上后同一批突变只 28 次查询。这些效果都只在用户交互后才有用，晚半个节拍装没有观感差异。
- **中文注释**，与上游 Android 工具包保持一致的表述（说明"为什么"而不是"做了什么"）。
- **哈希类名集中放置**：`src/client.ts` 顶部常量（`BUBBLE` / `COMPOSER_INPUT` / `COMPOSER_ADD` / `SIDEBAR_TOGGLE` / `SIDEBAR_PANEL_ICON`）与 `src/mobile-css.ts`。上游改版后只改这两处，不要在函数体里散落选择器字符串。**当前基线是 dsh `0.1.7-rc.2`**（已逐个核对命中）。核对方法：在 `npm root -g`/@deepseek-ai/dsh/node_modules/@deepseek-ai/ 下按包名 grep `lib/client.js`（外壳自己的类名——tooltip 气泡 `._bubble_ugtpz_1`、下拉列表 `._list_gzo7u_7`——在 `dsh-web-frontend/dist/assets` 的 css/js 里），或用本地名反查（`grep -rho "[A-Za-z0-9_-]*_hint\b"`）。**版本号没变也会变**：同一个 0.1.5-rc.1 重新发布后 `.h8S2Va_*`→`.ZKlsPq_*`、`.Md3f7G_hint`→`.EvIC1a_hint`、`._list_19372_8`→`._list_1nxmc_8`、`._bubble_owhem_8`→`._bubble_1nw3t_1`；0.1.7-rc.2 又换掉两个：`._list_1nxmc_8`→`._list_gzo7u_7`、`._bubble_1nw3t_1`→`._bubble_ugtpz_1`（气泡同时从 `dsh-web-frontend` 的旧哈希搬到新哈希，仍在**外壳包**里，不是 client-ui-* 包）。
- **宿主自己修好的就删掉，别守着旧规则**：子代理下拉的"吸附触发器 + 视口内 clamp"上游已用 `createPortal` + JS 坐标（内联 `style`）实现；本文件**不能**再写 `left/right/top` 的 `!important`（`!important` 盖得过内联样式）。0.1.7-rc.2 把同一件事又做给了另外四处——后台任务下拉（`setMenuShift` 视口吸附）、模型下拉（`createPortal` + `menuPos`）、用量/上下文面板（`createPortal` + `useAnchoredPosition`）、tooltip 气泡（组件内按锚点 rect 算 left/top + clamp + 上下翻面，`ResizeObserver` 跟自身尺寸）：这四处的 CSS 接管和 `installTooltipReanchor` 那种每帧回写坐标的浏览器半效果**都已删除**——不是失效，是有害。删之前先确认宿主新实现（`catalogMenuPosition` / `useAnchoredPosition` / `setMenuShift` 这类函数）确实做了同一件事。
- 注入的 CSS/JS 是**模板字符串文本**：内容里不能出现 `</script>`（会提前闭合注入的 script 标签），**也不能出现反引号**（CSS 注释里写 `flex: 0 0 100%` 会当场把模板字符串截断，esbuild 报 `Expected ";" but found ...`）；`String.raw` 只用于避免反斜杠被吞。
- **宿主只给 hover 路径的交互，触摸端要补键盘路径**：页头子代理触发器（`.ZKlsPq_trigger` / `_switcherTrigger`）外层只挂 `onMouseEnter`（150ms 后开菜单），按钮自己只有 `onKeyDown(ArrowDown)`，**当前会话那一颗连 onClick 都没有**。触摸端第一下靠浏览器补发的合成 mouseenter 能开，之后 hover 状态不变、不再派发 mouseenter，同一颗按钮就再也点不开（真机："点子会话有时打不开"）。`installTouchInteractions` 在点按触发器后等 250ms 确认菜单没开，就给触发器派发一次 `ArrowDown` —— 走宿主自己的键盘路径，不要合成 click。
- **单击不会产生 hover，提示气泡要自己补**：`Tooltip` 是条件渲染 + 自己定位（`onMouseEnter/onFocus` 起表、`onClick` 立刻关掉），触摸端点按的合成 `mouseenter` 刚起表就被 `click` 关掉 —— 触摸端看不到任何提示。`installTouchInteractions` 在 `touchend` 后等 250ms，气泡没出现就在被点的元素上补发一次 `mouseover`，让宿主的 hover 路径重新计时（与下面子代理触发器的 ArrowDown 兜底同款思路）。别再去改气泡的 `display`，它是条件渲染的、节点开之前不在 DOM 里。
- **页头默认一行放完**：标题（crumbs，可收缩省略）+ 当前 preset 胶囊（`headerActions` 里宿主 AgentPresetLabel，22px 高 / 最多 180px）必须同排。写死 `flex-basis: 100%` 会让它们永远分两排、中间空一整行（用户实测）；`flex: 0 1 auto` + `titleCluster` 的 wrap 才是"紧凑且不重叠"。
- 结构化类型优先：Node 半用 `HostCtx`，浏览器半用 `ClientCtx`，**不 import 任何 `@deepseek-ai/*`**（无 peerDependency，也就没有版本耦合）。
- `dsh.client` 里不要写 `inject`：本模块不消费任何客户端服务。

## Pitfalls

- **客户端 bundle 的形状是协议**：`window.__ModuleLoader__.load({ id, factory })`，`id` 必须等于包名，`factory(require)` 返回带 `name`/`apply` 的模块。改 `build.mjs` 的 banner/footer/`globalName` 任一处都会让浏览器端静默不加载（页面正常但效果全无）。冒烟测试会按同样协议真装载一次。
- **`lib/index.js` 是 bundle 过的 ESM**：Node 半 import 的 `./mobile-css.ts` / `./polyfills.ts` 会被内联，所以运行时不需要这两个文件存在。
- **悬浮开关的图标别克隆"toggle 里的第一个 svg"**：折叠态下（`wide = !collapsed || !settled` 为 false）宿主 toggle 里排在最前的是 `sidebar.brand.mark` 槽位的品牌标记（`FishLogo`），克隆它左上角就变成一个"鱼按钮"（用户实测反馈）。要的是 `.hHd-Xa_panelIcon`——即 `IconPanelLeftOutline16`，与页头右上角那颗 `ExpandButton`（`[data-sidebar-right-expand]`，`dsh-client-ui-sidebar-right` 的 `conversation.session.header.corner` 座席）是同一个图形组件；取不到时退到那颗按钮的 svg 兜底。克隆后剥掉宿主类名（理由见 `src/client.ts` 里那段注释），尺寸由本文件 CSS 给。
- **职责边界：Android/移动端界面适配，不做布局重构**。竖屏布局（抽屉/面板/断点）借鉴其他模块（`dsh-mobile-nav`）。本模块覆盖 viewport/安全区、启动期 polyfill、软键盘跟随、触摸交互、`enterkeyhint`，以及下拉与面板的"不出屏"定位——都属于同一批界面适配，别单独拆包。两边都改同一元素的定位时，以 CSS 顺序与 `!important` 为准，属于需要人工取舍的冲突，不要靠加 `!important` 硬压。
- **右栏在手机上必须由本文件驱动开合**（两个坑叠在一起，2026-09 真机报障）：① 本文件给 frame 的 `grid-template-columns: minmax(0,1fr)` 会把第三个子列 rightbarCol 自动排到 `grid-template-rows:100%` 之外 —— 实测右栏列 `(0, 844, 390, 0)`（高度 0、整个在视口下方），而宿主此时已经把状态切成"打开"（`data-rightbar-fullscreen`、面板根挂 `[data-sidebar-right-open]`），于是"点右上角那颗'打开右侧边栏' → 按钮消失、什么都没开"；② 窄屏（`autoFullscreen = viewportWidth < 768`）宿主走 fullscreen 覆盖层模式，它把滑动做在**面板内部的 dock 子元素**上（`transform: translateX(var(--dsh-sidebar-width))` ⇄ `none`），与我们把这列搬到覆盖层叠在一起 —— 观感是"面板瞬间到位、只有内容在动"，用户对比宽屏后反馈"宽屏一直有动画、窄屏没有"。
  所以这一列**整块由本文件接管**：基态 `position:absolute; width:100vw; z-index:41; transform:translateX(100%); visibility:hidden`，打开态（两个条件都要认：`[data-rightbar-fullscreen]` 或 `:not([data-rightbar-collapsed])`，390px 实测打开态是"collapsed 仍在 + fullscreen 新增"）`transform:none; visibility:visible`，时长/缓动共用左抽屉那对 token；同时**中和**宿主给 `[data-dockkit-*]` 的 `transform`（不清 `visibility`，收起时还要靠它把内容从辅助技术里摘掉），否则两层 transform 叠成两倍速。收起靠 translateX(100%) 移出画布，不需要 pointer-events；reduced-motion 里这三条选择器也要一起关（与左抽屉同待遇）。
- **空白页头的 headerCorner 不许被 `margin-left` 覆盖**：宿主用 `.wSkVaW_headerBlank .wSkVaW_headerCorner{margin-left:auto}` 把「打开右侧边栏」推到右上角；本文件那条 `margin-left:4px !important`（页头收紧）会盖掉 auto，那颗按钮就落到 44px 基线上、与悬浮开关并排成"两个一模一样的展开按钮"（用户截图报障）。所以规则必须排除空白页头（`.wSkVaW_headerBlank .wSkVaW_headerCorner{margin-left:auto !important}` 放行）。
- **抽屉滑动必须走 transform，列内的 fixed 弹出层要 `:has` 兜底**：收起/展开用 `transform: translateX(-100%)` ⇄ `none` + `transition: transform var(--dsh-android-ui-drawer-ms, 300ms) var(--ds-ease-in-out)`（宿主右栏文件预览 `.P3OORG_panel` 就是这个模式，观感一致）。`left` 是布局属性，动画期间每帧都要重绘那条 280px 宽、带 28px 阴影的整列，真机上一卡一卡的（用户对比后反馈）。代价：transform 会给本列造出包含块，列内 `position:fixed` 弹出层 —— 设置对话框 `.VOzbGW_overlay`、Cordis 控制面板 `.Nqubda_panel` —— 会被夹成 280px（实测 0,0,280,844：导航被裁），所以 `:has(.VOzbGW_overlay, .Nqubda_panel)` 命中时退回"无 transform + left 隐藏"。这两个弹出层都渲染在侧栏座席（`sidebar.settings` / `sidebar.footer.action`）里、没有 portal，少了任何一个都要把类名补进 `:has`。
- **自定义属性里的 `var()` 在“声明所在元素”上求值**：悬浮开关与作曲栏胶囊共用的 `--dsh-android-ui-chip-fill` / `--dsh-android-ui-chip-edge`（底色 + 0.5px 细描边 + 两层淡投影）**必须定义在 `body` 上，不能放 `:root`** —— 调色 token（`--dsw-specific-input-major` / `--dsw-alias-border-l2`）是宿主写在 `body{…}` 与 `body[data-ds-dark-theme]{…}` 里的，挂在 `html` 上取不到，两个 token 会双双落到兜底值（深色主题下悬浮开关变回一块白）。
- **宿主给 `.uV2eYG_row` 的 `container-type: inline-size` 是包含块**：它附带 layout containment，使**行盒**成为绝对/固定后代的包含块。作曲栏两颗胶囊要悬到卡片上方（`bottom:100%`，包含块必须是卡片），就必须在本文件把行盒改成 `container-type: normal`（包含块回到 `position:relative` 的卡片）；删掉这条，胶囊会静默落回输入框上——正是 2026-09 那版要拆掉的旧形态。代价：宿主那条 `@container (width<=560px)` 的 gap 微调不再命中（本文件自己给了 gap），模型触发器宽度上限退化成 45vw，仍被胶囊自身的 max-width 收住；权限/模型标签宿主现在用 `--dsh-composer-model-text-display` 这类变量按容器查询切换，本文件显式放出来。
- **光标与提示词是两套几何，必须手动同步**：提示词 `.uV2eYG_placeholder` 不是输入框的后代，而是 `.uV2eYG_grow`（`position:relative`）里与它**平级**的绝对定位节点，宿主按自己的输入框内边距写死 `inset:4px 8px auto 14px`。本文件把 `.uV2eYG_input` 改成更紧凑的 `padding-top/left/line-height`，就必须把同一组值补给提示词，否则光标与提示词错位（冒烟测试里有一条等式盯着这三个值）。
- **`enterkeyhint=newline` 与"普通回车=换行"是配套的**：后者是改产品包 `dsh-client-ui-conversation` 的按键映射（官方无扩展点），留在 `deepseek-harness-android/setup.sh` 4d。只装本模块时输入法会显示"换行"但回车仍然是发送——这是已知的、文档里写明的不一致，不要"顺手"在浏览器半里用 DOM 合成按键去修（编辑器的合成事件不可靠；0.1.7-rc.2 起文本面已经换成 shell 自己的 Lexical 编辑器，不再是 ProseMirror）。
- **PWA manifest 只能离线改**：浏览器独立 GET 那份 JSON，运行期插件改不了，`tapIndex` 也只作用于 index.html。`scripts/manifest-standalone.mjs` 是一次性脚本，默认 dry-run。
- **跨 realm 断言陷阱**：冒烟测试在 `node:vm` 里装载浏览器半，vm 里的数组有自己的 prototype，`assert.deepEqual(x, [])` 会因原型不同而失败——用 `.length` 比较。
- **`check()` 是同步的**：往里塞 `async` 回调会让失败变成 unhandled rejection 而"看起来通过"。需要官方 ESM 解析器时用 `createRequire(...)(...)`（Node ≥22 支持 require(ESM)），不要用 `await import`。

## Testing & QA

- `npm test` 覆盖：注入行形状、移动端 CSS 的作曲栏版式尺寸契约（胶囊带预留 ≥ 胶囊 28px + 间隔、胶囊 `flex-shrink: 0` 不许折行顶高、底行 `flex-wrap: nowrap`、行盒 `container-type: normal`、提示词与输入框的 `top/left/line-height` 三点等式、旧的重叠 hack 已删、两颗胶囊与输入框卡片同色且描边用 box-shadow 画 0.5px 细线）、viewport 就地改写（含幂等）、用官方 `renderIndexInjections()` 渲染真实 index.html 的顺序断言、VM 里真跑 polyfill、VM 里按协议装载浏览器半并断言完整卸载、官方 `loadOverlayPatches()` 解析本包 patch 层、包契约（`dsh.bundle`/`dsh.client`/`exports` 指向的文件都存在），以及浏览器半的**安装时机**（load 前不装任何 observer/按钮、load 后才装上、load 前卸载后迟到的 load 不能把插件唤醒）。
- 还有一条"宿主类名核对"（**按去注释后的正文比对**，注释里允许写"旧名 → 新名"的沿革）：构建产物里不许再出现已核对过的旧哈希名（`h8S2Va` / `Md3f7G` / `_list_19372_8` / `_bubble_owhem_8` / `_list_1nxmc_8` / `_bubble_1nw3t_1`），且 `.ZKlsPq_menu` / `.JObwrW_panel` / `.QsffPG_menu` / `._7KE1Ra_menu` 这些**宿主已自接管定位**的选择器在本文件里连规则块都不许有（只允许出现在注释里）；`.JObwrW_trigger` 不许再有规则块或 `::after`（宿主自带百分比文本，补了会重复）。
- 两条"别乱动"的断言：侧栏会话行不许有 `min-height` 覆盖（尺寸交回宿主），会话页头的左基线只许由 `.wSkVaW_header` 给（44px = 悬浮开关让位），标签页左内边距必须归零，`headerActions` 不许再写 `flex-basis: 100%`（会把 preset 顶到自己一行）。
- 悬浮开关的图标、边缘与纵向位置也是断言项：必须从 toggle 里取 `.hHd-Xa_panelIcon`（取不到退到 `[data-sidebar-right-expand]`）、不许出现 `querySelector('svg')`；边缘（底色 + 0.5px 细描边 + 两层淡投影）走与作曲栏胶囊共用的 `--dsh-android-ui-chip-fill` / `--dsh-android-ui-chip-edge`（**定义在 `body` 上**，见 Pitfalls）、不许再用 `button-floating-fill` + 两层重投影那套浮层观感；尺寸与页头右上角那颗 ExpandButton 一致（28×28、15px 字形）；`top` 必须是 `env(safe-area-inset-top) + 6px`（与那颗文件预览入口平齐，页头 `padding-top` 用同一表达式）；`:hover` 必须与 `:active` 同列（触摸端没有 hover），反馈色取作曲栏 ＋ 号的 `interactive-bg-hover-solid`。
- 侧栏设置入口（抽屉底部 `sidebar.settings` 座席 → `.VOzbGW_trigger`）也是断言项：观感照 `dsh-mobile-nav`（dsh-web-mobile）抽屉底部那颗药丸（12px 圆角 + 按下反馈），**但底色必须与抽屉背景分开** —— 那颗药丸原本是透明底，等于侧栏自己的 `--dsw-specific-sidebar-fill`（亮色 #f9fafb），按钮与背景同色；改用宿主同一列「新建会话」的画法：`--dsw-alias-button-elevated-fill` 底 + `.5px --dsw-alias-border-l3` 描边，`:hover`/`:active` 用**实色** `interactive-bg-hover-solid`（半透明的 `interactive-bg-hover` 当 background 会把底色换回背景色）。**高度/内边距/字号沿用宿主 42px 整行**（不照抄药丸的 34px），规则必须 `:not(.VOzbGW_rail)`（收起态那颗 36×36 圆钮套描边会变带边框的圆）。
- 抽屉动画也是断言项：收起态必须是 `transform: translateX(-100%)`（不许再出现 `left: calc(-1 * …)`）、时长/缓动是宿主的 300ms + `var(--ds-ease-in-out)`、展开态 `transform: none`，且 `:has(.VOzbGW_overlay, .Nqubda_panel)` 兜底两条在 reduced-motion 里也必须一起列出。
- 浏览器半还断言了**两条触摸兜底**：点子代理触发器后菜单没开就派发一次 `ArrowDown`（已开不派发）；点按后提示气泡没出来就补发一次 `mouseover`（已开不补发）。还钉了**效果清单**（`installers` 六条，删掉 tooltip 重吸附后不再增删）与胶囊带 `:has` 里的 `hidden` 守卫（生成期间不再留白带）。
- 找不到已安装的 dsh 时，依赖官方渲染器的那几项会打印 `[skip]` 而不是假装通过。
- 真机检查点（装进 profile、重启后，手机 390px 竖屏）：
  1. 地址栏页面无横向滚动，刘海/挖孔不遮内容，底部输入区有 safe-area 留白；
  2. 点作曲栏"+"不弹键盘；输入法回车键显示"换行"；
  3. 作曲栏版式：权限（可能带"计划"胶囊）/模型两颗胶囊在输入框**上方独立成排**（权限贴左、模型贴右，互不重叠，底色与输入框卡片相同、带 0.5px 极细描边，不压输入框、不压消息区），发送键固定停在输入框**右下角**、不折行；模型名尽量完整——能顶到权限胶囊前 12px 才省略（权限胶囊越窄、模型名显示越多）；320px 窄屏同样成立；
  4. 弹出软键盘：作曲栏与整页上移、不被键盘盖住；收起后完全还原；
  5. 侧栏展开是覆盖式抽屉（滑动走合成层，手感与右栏文件预览面板一致），点右侧遮罩空白处能关闭；设置面板全屏，且设置面板开着时抽屉不会把它夹成 280px、Cordis 控制面板同理；抽屉底部那颗「设置」是药丸样（白底 + 12px 圆角 + `.5px` 细描边，**与侧栏背景明显分开**，按住变灰），不是与背景同色的裸文字行；
  6. 各类下拉与面板不超出视口（**现在全部由宿主自己吸附**：子代理下拉、后台任务下拉、模型下拉、用量/上下文面板）；用量/上下文面板跟随触发器（不再固定贴在右下角），软键盘弹出后仍在可视区内；
  7. 会话页头：标题与当前 preset 胶囊同排（放不下才换行）、标题/操作区/标签页左缘共用同一条 44px 基线（悬浮开关让位量落在 `header` 上），纵向紧凑，没有哪一行压到左上角的悬浮开关；左上角那颗与页头右上角那颗文件预览入口（ExpandButton）**同一水平线**（都是 28px 上下、中线 20），边缘与作曲栏的输入框卡片/权限/模型胶囊是同一套（同底色 + 0.5px 细描边 + 极淡投影，圆底），按下有底色反馈，面板图标而不是品牌鱼 logo；它比展开态抽屉里那颗侧栏开关（28px @ 上沿 22）高 —— 抽屉是左侧独立一列，按钮让位的是会话页头；
  8. 页头子代理触发器：连点几下都能打开下拉（不能只在第一下靠 hover 生效），下拉里点任一子会话都能跳过去；
  9. 老 WebView（无 `AbortSignal.any` / 非安全上下文）下页面能正常启动；
  10. 会话生成中（"activity" 状态）：作曲栏的 ＋/附件与权限/模型胶囊按宿主意图隐藏、卡片上方不留一条空白带；
  11. 触摸端长按/点按一个有提示的按钮（例如 ＋、模型胶囊），提示气泡能出现（合成 mouseenter 被 click 关掉的那条死路已绕过）；子代理下拉连点仍能打开；
  12. 右栏（文件/终端 dock）：点页头右上角那颗「打开右侧边栏」→ 面板**全屏滑入**（整块面板在动，观感与左抽屉一致；不是"瞬间铺满、只有内容在动"），右上角自带那颗能收起、收起时也有滑出动画；收起后页面（作曲栏、悬浮开关）点击不受影响、页面无横向滚动；右下角那颗悬浮开关在右栏打开时被盖住（z-index 30 < 41）不会误触；系统开了"移除动画"时左右两侧都应当是瞬切（本文件尊重该设置）。
- `deepseek-harness-android` 已于 2026-09 删除 `apply-frontend.sh` / `patches/mobile.css` / `patches/mobile.js`，界面适配全部由本模块承担——不会再出现"两边都注入"。
- **但仍要留意旧注入残留**：在这之前跑过 `apply-frontend.sh` 的部署，`dsh-web-frontend/dist/index.html` 里还留着 `<style id="dsh-mobile-adapt">` 与那段 polyfill/效果脚本。它与本模块**内容等价、叠加无害**（同款规则与幂等监听），只是 DOM 效果会跑两份；下一次 `npm install -g @deepseek-ai/dsh`（或重跑 `setup.sh`）重写 dist 后即消失。排查"效果像是执行了两遍"时先看这个。

## Maintenance

- 本文件是活参考：发现新的命令、约定或坑就地更新；与源码不符的条目删掉，不要留过时说明。
- 上游 dsh 升级后先跑 `npm run check`，再按"真机检查点"逐条过一遍；哈希类名不命中时按 `Pitfalls` 更新两处常量/CSS，不要改结构。
