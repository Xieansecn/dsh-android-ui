# 竖屏轮次索引轨：原型特征点检索 vs 现状

对象：`report/agent_chat_scroll_prototype.html`（下称**原型**）的右侧时间轴，
与 `dsh-android-ui` 在竖屏（≤480px）下对宿主 `TurnNavigator`（`.eGxaPq_*`）的接管。

## 一、原型特征点（逐条从源码抄出）

| # | 特征 | 出处 | 取值 |
|---|---|---|---|
| P1 | 轨道长度 | `.rail{top:8%;bottom:8%}` | stage 的 84%（几乎整段） |
| P2 | 轨道宽度/贴边 | `.rail{right:5px;width:66px}` | 66px |
| P3 | 刻度排布 | `.rail-lines{inset:18px 0;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-end}` | **space-between 铺满**：间距随条数自适应 |
| P4 | 刻度条数 | `rebuildTicks()`：`min(data.length, max(2, min(39, floor(h/11)+1)))` | 每根至少 11px 节距，最多 39 根 |
| P5 | 刻度形状 | `.tick{height:2px;width:9px;border-radius:3px;opacity:.42;transform-origin:right center}` | 右对齐、基准 9px |
| P6 | 跟随手指的“哑铃” | `paint()`：`width=9+24*s²`、`opacity=.35+.65*s`、`dist<.55` 换 accent 色，`s=max(0,1-dist/4)` | 选中处 33px，4 根内衰减 |
| P7 | 头尾编号 | `.rail-number.first/.last` = `01` / `n` | 9px，tabular-nums |
| P8 | 当前轮读数 | `.position{right:41px}`，`.dragging .position{opacity:1}`，`top=18+progress*h` | 两位置数，仅拖动时显示 |
| P9 | 抽出动画 | `.rail{transform:translateX(75px);opacity:0}` → `.shown{transform:none;opacity:1}`，`transition:transform .45s var(--ease),opacity .22s` | 75px 滑入 + 淡入 |
| P10 | 输入面 | `.edge{right:0;top:0;bottom:0;width:30px;touch-action:none}` | 整条右缘热门 |
| P11 | 起手 | `pointerdown`：轨道已 shown → 立刻 `begin()+move()`；否则 `|dy|>4 \|\| inward>7` 才 `begin()` | 阈值 4/7 |
| P12 | 拖动映射 | `move(y)`：`p=(y-lines.top)/lines.height` → `select(round(p*(n-1)))` | **一次手势覆盖整个会话** |
| P13 | 落定 | `finish()`：把选中轮对齐到 `anchorY`（`24+p*16%视口`），并 `holdAnchor` 430ms | 滚动区跟手 |
| P14 | 拖动中点击 | 轨道 `pointer-events:none`、刻度是 `<i>` | **结构上不可能**在滑动中被点击 |
| P15 | 长提示词 | 拖动中全部压到 75px、选中行高亮 | 用压缩换“看得见落点” |
| P16 | 键盘 | `.edge` `role="slider"` + Arrow/Home/End/PageUp/PageDown，keyup 落定，`aria-valuenow/valuetext` | 完整 |
| P17 | 滚动探头 | `chat.addEventListener('scroll')` → `reveal()` | 749ms 后淡出 |
| P18 | 空转保护 | `reveal()` 里 `if(!active)` 才排淡出定时器 | — |

## 二、现状（重构前）与差距

| 特征 | 现状 | 判定 |
|---|---|---|
| P1 长度 | 已覆盖 `max-height: band-40` | ✅ 对齐 |
| P2 宽度 | 宿主 28px、贴边 12px | △ |
| P3/P4 间距 | **宿主固定 10px 节距 + 轨道内虚拟滚动** | ❌ 与原型差距最大：390px 机器上一屏塞 60+ 根，密成一条虫；短会话也不会像原型那样铺满 |
| P5/P6 形状 | 宿主 `:before` 20px×2px、scaleX .6→1 | △ 幅度只有 12→20px |
| P7 头尾编号 | 无 | ❌ |
| P8 读数 | 无（只有宿主预览卡） | ❌ |
| P9 抽出动画 | 只有 `opacity .16s` | ❌ |
| P10 输入面 | 12px 热区 | △（有意取窄） |
| P11 起手 | 右缘按下即抽出、轨道按下即定位 | ✅ |
| P12 映射 | 指尖命中“当前虚拟窗口内”的宿主刻度，越界才自动滚 | ❌ 无法一次手势覆盖全会话；每帧 ~60 次 rect 命中 |
| P13 落定 | `mark.click()` 交给宿主导航（不每帧写滚动区） | ✅ 有意不同（宿主锚点补偿按“读者动作”记账） |
| P14 滑动中被点击 | **宿主刻度是 `<button>`，松手会被浏览器补发 click → 中途跳轮**（用户报障） | ❌ 本次修复的核心 |
| P15 压缩提示词 | 无（用宿主预览卡承担） | ✅ 有意不同 |
| P16 键盘 | 无（宿主刻度被我们设为 pointer-events:none 后基本只剩 Tab） | ❌ |
| P17 探头 | 有 | ✅ |

### P14 的根因（“滑动时会点击 → 触发太短 → 滑不动”）

1. 宿主每根刻度都是 `<button>`，`onClick → onNavigate`。
2. 触摸滑动的位移只要没超过浏览器的 tap slop（约 10px），松手时浏览器**仍会补发一次 click**；
   而我们的起手阈值只有 4px —— 也就是“我已经在拖了，浏览器还认为这是一次点击”。
3. 上一版用“begin 时把指针捕获到热区 → click 被重定向到热区 → 吞掉”来兜底，但这条依赖
   WebView 对 pointer capture 的重定向行为，且拖动起点一旦落在宿主刻度上仍可能漏 click。
4. 结论：只要手指下面还有宿主的可点元素，这个竞态就消不掉。

## 三、重构方案（竖屏专用：把宿主轨道降级成“引擎 + 预览层”）

- **宿主 frame**：保留布局（虚拟化需要非零高度），但 `pointer-events:none !important`，
  刻度 `opacity:0`（**不能用 display:none**：rect 会全变 0，而节距/内边距要靠它量出来）。
  它从此只负责：轮次数据、分页、预览卡（`.eGxaPq_preview` 的定位与文案只有宿主持有）、
  以及“落定用的那颗刻度”。
- **自绘索引轨** `[data-dsh-rail]`：几何（top/height）从宿主 frame 的实测 rect 抄过来，
  视觉与手感逐条照原型 P2–P9 实现（66px、space-between 铺满、条数 `floor(h/11)+1` 封顶 39、
  9→33px 哑铃、头尾编号、当前轮读数、75px 滑入 450ms）。
- **映射**：指尖 → `p ∈ [0,1]`（原型 `move()`）→ `index = round(p*(n-1))`。
  `n` 与节距、内边距在探头时量一次：`pitch` 取两根已挂载刻度的间距，
  `paddingStart = 刻度屏幕位 - 滚动容器顶 + scrollTop - index*pitch`（**与滚动量无关**，所以
  在写 scrollTop 之前量就是对的），`n = round((scrollHeight - 2*paddingStart)/pitch)`。
  定位时把宿主滚动容器滚到 `paddingStart + index*pitch - 视口/2` —— 该轮次那颗刻度随即被
  虚拟化挂上，预览与落定 click 都拿得到。
- **P14**：手指下面是自绘轨道的 `<i>`/容器（没有按钮），落定点击由我们在 `finish()` 里
  **程序化**点一次宿主刻度；`pointerdown` 还 `preventDefault()` 掐掉浏览器补发的 mouse 链。
  滑动中途被点击从此结构上不可能。
- **P16**：`role="slider"` 放在自绘热区上，Arrow/Home/End/PageUp/PageDown 由我们实现，
  keyup 落定；`aria-valuenow/valuemax/valuetext` 跟着选中项走。
- **保留的有意差异**：拖动中不写对话区滚动位置（宿主锚点记账）、不压缩提示词（用宿主预览卡）。

## 四、第二轮的四个报障与修法（真机）

| 报障 | 根因 | 修法 |
|---|---|---|
| 刻度"缩在中间、没有彻底分散开" | 宿主只给 `.eGxaPq_frame` 一条 `max-height`，而它的**高度本来是内容高度**（= 刻度总长，8 轮只有 82px），所以覆盖 `max-height` 根本量不到 | 窄屏给 frame **确定的 `height`**（`--turn-rail-band - 40px`）＋ `max-height: none`；再让滚动容器 `max-height: 100%` 填满它。自绘轨道的几何就是从 frame 的 rect 抄的，于是刻度铺满整屏、`space-between` 的间距也随之变大 |
| 滑动中不能实时指示消息 | 只做了"自绘轨道 + 宿主预览卡"，正文没跟着动（原型是每帧 `align()`） | 用宿主给每个 flow item 挂的 **`data-chat-turn="轮次号"`** 定位选中轮的行，写会话滚动容器（`[data-conversation-scroll]`）的 `scrollTop`：对齐到 `anchorY = 24 + p×min(100, 视口高×0.16)`（原型的 `move()`/`align()`）；**每选一轮只写一次**，松手后 `holdAnchor(430)` 只做漂移纠正，用户一 wheel/touchstart 就交还；给该行打 `[data-dsh-rail-target]` 做落点标记（原型 `.scrubbing .user.selected`） |
| 滑动界面时指示器位置不对 | 刻度带只有 46px 高，同样的手指位移会被放大成很多轮，读数与哑铃看起来乱跳 | 同第 1 条（带宽从 46px 变回整屏）；`.position` 的 `top = 18 + p×刻度带高`、刻度 `9+24s²`、`dist<.55` 换色都与原型逐条对齐 |
| 消息条目计数不对 | 读数用的是数组下标 + 1，而宿主的**轮次号**在重试/分叉过的会话里会与下标错开 | 轮次号从刻度的 `aria-label` 解析（`t('chat.turnNavigation.jump', {turn})`），取不到才退回下标 + 1；尾号按原型写裸总数（`first` 才是写死的 `01`） |
| 预览卡不跟指示器、自己小幅浮动 | 卡片的 `top` 由宿主按**它自己那套固定节距几何**（虚拟项 start − scrollTop，内联 `--turn-preview-center`）算，我们可见的刻度是 space-between 铺满的 —— 两套几何错开 | 拖动中把指示器的 y（`18 + p × 刻度带高`）写进 html 上的 `--dsh-rail-card-y`，用 `[data-dsh-rail-dragging] .eGxaPq_preview{top:clamp(...) !important}` 覆盖（宿主的 top 是样式表值、非内联，所以可盖）；松手撤掉 |
| 隐藏态"不能被触发"、抽出后热区又变成 66px | 输入面在两态之间换了尺寸：隐藏时只有 8/12px 细带（手指落点常内缩 10~20px，压不准），抽出后整条 66px 轨道接指针（右缘一条竖列全被吃掉） | **唯一输入面 = 右缘 24px 热区，两态宽度一致**：自绘轨道常驻 `pointer-events:none`（只当显示面）、热区常驻 `touch-action:none`；同时试过的 `pan-y`（让竖带也能滚正文，结果浏览器收走竖向手势、真机"根本不触发"）与"按住刻度直接拖"（轨道接指针，导致热区忽大忽小）都已放弃；拖动本身不要求手指留在热区里（document 捕获 + pointerId 过滤） |
| 手动滚正文时指示器不动 | 只在拖动路径里更新了刻度与读数 | 补上原型 L60 的 scroll 处理：`probe = scrollTop + 视口高 × 0.28` → 在 `[data-chat-turn]` 行上二分 → 折算进度 → `paint()` + 读数；不写 scrollTop、不打落点标记，并把选中项同步过来供方向键续用 |

**一个仍存在的取舍**：未加载的轮次在转录里没有行，拖动中只能靠预览卡 + 读数指示，正文要等松手后宿主分页落位（原型没有分页概念，它始终是"全量 DOM"，所以能做到每帧都在动真内容）。为此松手后的 430ms 钉住只在"这轮本来就有行"时启用 —— 否则会与宿主的分页锚点补偿互相拉。

## 五、宿主契约勘察结论（0.2.0-rc.2 产物，只读反查）

子 agent 逐条核过产物，本模块据此定的写法：

| 事实 | 证据 | 我们的用法 |
|---|---|---|
| 转录行 = `[data-chat-turn="N"]`，是 `[data-chat-flow]`（`.EvIC1a_column`）的直接子元素；同一轮可能拆多行 | `client.js:1766` `"data-chat-turn": turn`；`:1761/1762/1765` 同族 flow/anchor/node/kind 键 | `rowOf()` 取**文档序第一条**（提示词行），且**限定在会话滚动容器内**查 |
| 刻度按钮上**没有**轮次号属性（只有 `data-index`）、也没有 `name` | `TurnMark` 只渲染 ref/data-index/className/aria-* | 轮次号从 `aria-label` 解析（`"chat.turnNavigation.jump": "跳转到第 {turn} 轮"`） |
| 宿主自己的落位 = 行顶落在滚动容器上沿下方 **24px**，瞬时写 `scrollTop`，无 smooth | `:4849 align(row,24,turn)` / `:4858 write` | 拖动中用原型的 `24 + p×ratio`，**松手后把 ratio 归零**改成 24，免得和它的落位对拉 |
| 程序化写 `scrollTop` 不触发任何 intent（只听 wheel/touchstart/pointerdown/keydown/beforematch），但会被记成 `movedByReader` | `:4476 READING_INTENTS`、`:4598 readScroll` | 我们的"用户接管"口径与它一致；拖动中不接管 |
| **分页中写 `scrollTop` 会被 `preserve()` 精确回滚** | `:4790 preserve` ⇒ `target = T` | 选中刻度 `aria-busy="true"`（宿主 busyTurn）或行不存在时**不写**，松手后也不钉 |
| 浏览器滚动锚定只在 follow-tail 时被宿主关掉 | CSS `:has(.EvIC1a_root[data-chat-following-tail]){overflow-anchor:none}` | 拖动期间给滚动容器加内联 `overflow-anchor:none`，松手/卸载立刻还原 |
| `.eGxaPq_slot` 在共享滚动容器里是 `position:sticky` 且 `height:0` ⇒ rect 与滚动量无关 | `:3566` CSS + 布局 | 自绘 `position:fixed` 轨道**不需要每帧重算几何**，只在探头/resize 时抄一次 |
| `--dsh-composer-height` / `--dsh-conversation-viewport-height` 由会话包的 ResizeObserver 内联写在**滚动容器**上 | `conversation/lib/client.js:16227-16234` | `--turn-rail-band` 由宿主算在 frame 上，我们直接抄 frame 的 rect |

**已知失败模式**（照抄勘察、并在实现里做了抑制）：① 未加载轮没有行 → 跟随必然滞后到松手分页；② 分页中写 → 被回滚（已用 `aria-busy` 抑制）；③ 我们的写被记成读者动作 → 释放 follow-tail、覆写会话滚动记忆（这是"用户在找某一轮"的正当语义，接受）；④ 同轮拆行取错（取文档序第一条）；⑤ 手指按住不动 >500ms 且内容在长 → 宿主的 `onResize()→followTail()` 会往底部拽，我们的 settle 会纠正回来，最多对拉 430ms。
