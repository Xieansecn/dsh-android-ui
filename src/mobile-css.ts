/**
 * 移动端 CSS（宿主半以 `{ kind: 'style' }` 行注入 index.html 的 <head>）。
 *
 * 移植自 deepseek-harness-android/patches/mobile.css，规则逐字保留。
 *
 * ⚠️ 版本敏感：选择器里的类名（.h8S2Va_menu / .uV2eYG_* / .VOzbGW_* / ._7KE1Ra_* /
 * .wSkVaW_* / .hHd-Xa_* / .Md3f7G_* / ._list_19372_8 / .pI_x6G_frame 系列）来自
 * dsh 0.1.5-rc.1 的构建产物，上游重新构建后哈希前缀会变、CSS module 的本地名
 * （_frame / _sidebarCol / _menu …）不变。改名前这些规则只是不命中（不影响功能），
 * 改名后需要同步更新本文件：优先依赖 data-* 稳定契约（data-sidebar-collapsed /
 * data-rightbar-collapsed / data-shell-overlay / data-dsh-kb-open），其次按本地名
 * 后缀做子串匹配（[class*="_frame"]），最后才是整串哈希类名。
 * 踩过的坑：data-details-collapsed 在 0.1.5-rc.1 已被 data-sidebar-collapsed 取代，
 * 旧规则静默失效，展开侧栏会把对话区挤成窄条（见下方抽屉段注释）。
 */
export const MOBILE_CSS = String.raw`/* 竖屏手机适配覆盖层 —— dsh-android-ui */

/* 样式表已到位的握手标记：浏览器半注入悬浮侧栏按钮前先读这个自定义属性，
 * 读不到就不注入。样式表由 Node 半在 index 里注入（重启才更新），而浏览器半
 * 的 bundle 是宿主按请求从磁盘读的 —— 两者不同步时（改了 CSS 还没重启）
 * 页面会多出一个没有样式的裸按钮。 */
:root {
  --dsh-android-ui-css: 1;
  /* 抽屉展开/收起时长（同时管遮罩与悬浮开关的淡入淡出）：想快想慢只调这一处。
     240ms 是抽屉类动效的常规值；本模块其余动效（设置面板 180/200ms）更短，
     因为那些是"浮现"，这里是"横向位移"。 */
  --dsh-android-ui-drawer-ms: 240ms;
}

/* 子代理目录树下拉（.h8S2Va_menu）：所有宽度生效的通用修正。
 * 上游构建的菜单用 left:0 以触发器左缘为锚向右展开，而触发器位于
 * 会话页头右侧，宽屏/窄屏下右边界都可能超出视口。此处改为右对齐触发器
 * 右边缘、向左展开（与页头 token 面板 right:0 模式一致）。
 * <=480px 的移动端由下方媒体查询（position:fixed + 运行时定位）接管，
 * 该查询里显式 right:auto 保证不受本规则约束。 */
.h8S2Va_menu {
  left: auto !important;
  right: 0 !important;
}

/* 后台任务下拉（.QsffPG_menu）：与子代理下拉同款修正。 */
.QsffPG_menu {
  left: auto !important;
  right: 0 !important;
}

/* 用量/上下文仪表面板（.JObwrW_panel）：纯 CSS 修复，所有宽度生效。
 * 上游样式是 absolute;bottom:calc(100% + 8px);right:0;width:264px，
 * 面板向上展开会被会话滚动容器（overflow 裁剪）遮挡，触发器不贴右时还会
 * 出边界。这里与子代理下拉同款思路：改成 position:fixed 挂在最上层，
 * 按视口锚定（贴右、位于作曲栏上方），尺寸受视口约束。 */
.JObwrW_panel {
  position: fixed !important;
  left: auto !important;
  top: auto !important;
  right: 12px !important;
  bottom: 64px !important;
  max-width: calc(100vw - 24px) !important;
  max-height: 60vh !important;
  overflow-y: auto !important;
  z-index: 2147483647 !important;
}

@media (max-width: 480px) {
  /* 侧栏整列脱离网格流：折叠 = 完全收起（不占宽度），展开 = 覆盖式抽屉。
     0.1.5-rc.1 的壳：frame 带 data-sidebar-collapsed（**展开时整个属性消失**，
     折叠时 =true），列依次是 sidebarCol / centerCol / rightbarCol，遮罩层是
     [data-shell-overlay]。旧版用来识别的 data-details-collapsed 在这一版已经
     不存在，整段抽屉规则因此静默失效 —— 390px 展开侧栏时对话区被挤到 110px
     （实测截图）。所以改挂 CSS module 的本地名后缀（_frame / _sidebarCol 跨
     重新构建稳定，只有哈希前缀会变）。
     折叠态也必须脱流：宿主默认给折叠侧栏留 56px 竖条（390px 上占 14% 宽度，
     新建会话/搜索/用量/设置都挤在那一条里），手机上对话区因此永久少一截。
     脱流后折叠态由浏览器半注入的悬浮按钮当入口，见 client.ts 的 sidebar-fab。 */
  [class*="_frame"] {
    grid-template-columns: minmax(0, 1fr) !important;
  }
  [class*="_frame"] > [class*="_sidebarCol"] {
    position: absolute !important;
    top: 0;
    bottom: 0;
    width: min(280px, 84vw) !important;
    z-index: 40;
    box-shadow: 0 0 28px rgba(0, 0, 0, .45);
    /* 收起态用 left 偏移，不用 transform —— 这一条是被设置对话框逼出来的：
       设置对话框就挂在本列的 DOM 子树里，它的 overlay 是 position:fixed，
       而 transform（**连 translateX(0) 这种单位阵也算**）会给本列造出包含块，
       那个 fixed overlay 于是被夹成 280px、贴着抽屉显示（实测面板 0,0,280,844：
       导航被裁、正文挤成四行）。left 是布局属性、不造包含块，fixed 后代永远按
       视口定位；两态都能过渡，代价是动画期间走重排而不是合成。
       收起 = 移出画布 + 动画播完再转 visibility:hidden：display:none 不可过渡，
       而宿主只切一个属性，没有"动画结束再卸载"的回调时机给我们。 */
    left: calc(-1 * min(280px, 84vw)) !important;
    /* 宿主自己也给这一列挂了 transform 做收起/展开（收起 = translateX(-281px)，
       展开 = translateX(0)，实测）。它对 fixed 后代一样有毒，所以直接清零，
       位移全部交给上面的 left。 */
    transform: none !important;
    visibility: hidden !important;
    transition: left var(--dsh-android-ui-drawer-ms, 240ms) ease,
      visibility 0s linear var(--dsh-android-ui-drawer-ms, 240ms) !important;
  }
  [class*="_frame"]:not([data-sidebar-collapsed]) > [class*="_sidebarCol"] {
    left: 0 !important;
    transform: none !important;
    visibility: visible !important;
    /* 展开时 visibility 立刻生效（delay 0），否则滑入的头一帧还是隐藏的。 */
    transition: left var(--dsh-android-ui-drawer-ms, 240ms) ease,
      visibility 0s linear 0s !important;
  }
  /* 悬浮开关（浏览器半 [data-dsh-nav-fab] 注入，折叠态才置 visible）：
     尺寸与观感对齐应用自带的浮层按钮；z-index 低于抽屉(40)与遮罩(39)，
     抽屉一开就被盖住。左上角占位由下面的页头内边距让出来。
     用透明度而不是 display 切换，才能跟抽屉同步淡入淡出。 */
  [data-dsh-nav-fab] {
    position: fixed;
    top: calc(env(safe-area-inset-top, 0px) + 12px);
    left: 10px;
    z-index: 30;
    display: inline-flex;
    opacity: 0;
    pointer-events: none;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    padding: 0;
    border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, .12));
    border-radius: 50%;
    background: var(--dsw-alias-button-floating-fill, #fff);
    color: var(--dsw-alias-label-primary, inherit);
    box-shadow: 0 2px 12px rgba(0, 0, 0, .18);
    -webkit-tap-highlight-color: transparent;
    transition: opacity var(--dsh-android-ui-drawer-ms, 240ms) ease;
  }
  [data-dsh-nav-fab][data-dsh-nav-fab-visible] {
    opacity: 1;
    pointer-events: auto;
  }
  /* 悬浮开关压在左上角，对应把会话页头内容右移，别压住标题。 */
  [class*="_frame"] [class*="_titleRow"] {
    padding-left: 56px !important;
  }
  /* 遮罩常驻、用透明度过渡，才能跟着抽屉一起淡出（只在展开态存在的话，
     一收起就"啪"地消失，没有收起动画）。 */
  [class*="_frame"] [data-shell-overlay] {
    z-index: 39;
  }
  [class*="_frame"] [data-shell-overlay]::before {
    content: "";
    position: fixed;
    inset: 0;
    z-index: 39;
    background: rgba(0, 0, 0, .45);
    opacity: 0;
    pointer-events: none; /* 收起态不可见也不吃点击 */
    transition: opacity var(--dsh-android-ui-drawer-ms, 240ms) ease;
  }
  [class*="_frame"]:not([data-sidebar-collapsed]) [data-shell-overlay]::before {
    opacity: 1;
    pointer-events: auto; /* 遮罩可点击：点击空白区关闭抽屉 */
  }

  /* 作曲栏的圆按钮（＋ / 附件 / 上下文 / 发送）**一律沿用宿主原尺寸**：
     实测 ＋/附件/上下文 28×28、发送 34×34。之前为触控目标把它们抬到 44px，
     结果作曲栏又高又重，窄屏下 44px 的发送键还会被挤到下一行、跑到左下角。
     尺寸交回宿主后底行在 320px 也放得下，发送稳定停在右下角。 */

  /* 抽屉里的会话行：宿主只有 32px 高（390px 实测），手机上是整个抽屉最常点的
     目标，抬到 44px。按 CSS module 本地名后缀匹配，跨重新构建稳定。 */
  [class*="_sessionRow"] {
    min-height: 44px;
  }

  /* 抽屉里偏小的控件：收起按钮实测 36×28、工作区标题右侧的搜索/视图选项/
     添加工作区 28×28。**只抬高度、不动宽度** —— 宽度一改，那排图标会挤出抽屉
     右缘被裁（284 > 281，实测），新建会话按钮的图标/文字也会被挤成两行。 */
  [class*="_frame"] > [class*="_sidebarCol"] [class*="_iconButton"],
  [class*="_frame"] > [class*="_sidebarCol"] [class*="_searchButton"] {
    min-height: 36px;
  }

  /* 抽屉底部避让安全区：footer（用量/余额 + 设置）实测贴到距屏底 6px，
     手势导航条会压在上面。给整列加下内边距，底部两组自然上移；真机取
     safe-area，取不到时兜底 8px。 */
  [class*="_frame"] > [class*="_sidebarCol"] {
    padding-bottom: max(env(safe-area-inset-bottom, 0px), 8px) !important;
  }

  /* 设置面板顶栏：宿主在窄屏下把"设置"标题压成 40px 宽、两个字竖排
     （实测 navTitle 40×48），因为它跟着 tab 列表一起被压缩。标题不参与收缩、
     不换行，横向滚动交给整条 nav（原本就是 overflow-x:auto）。 */
  .VOzbGW_navTitle {
    flex: 0 0 auto !important;
    white-space: nowrap !important;
  }

  /* 会话滚动容器：宿主为桌面滚动条预留了滚动条宽度（实测作曲栏 seat 是 0..380，
     右边空 10px），手机上滚动条是浮层、不需要预留，去掉后消息列与作曲栏真正居中。 */
  [class*="_scrollBody"] {
    scrollbar-gutter: auto !important;
    scrollbar-width: none;
  }
  [class*="_scrollBody"]::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }

  /* 输入区 safe-area 避让 */
  .wSkVaW_composerSeat {
    padding-bottom: max(env(safe-area-inset-bottom), 8px) !important;
  }

  /* 下拉菜单不出屏 */
  ._list_19372_8 {
    max-width: calc(100vw - 16px) !important;
  }

  /* 辅助字号微调 */
  .Md3f7G_hint {
    font-size: 13px;
  }

  /* 模型选择器：尺寸/内边距**一律沿用宿主原值**（实测 28px 高、gap 4），
     之前这里为了"加大触控"写成 36px + 大内边距，比同排的权限胶囊高 8px、
     还多占 12px 宽，直接把胶囊行挤到折行。 */
  ._7KE1Ra_triggerLabel {
    min-width: 0 !important;
    white-space: nowrap !important;
    text-overflow: ellipsis !important;
  }
  /* 下拉菜单是弹层、不在作曲栏里，选项仍按触控目标 44px */
  ._7KE1Ra_option {
    min-height: 44px !important;
  }
  ._7KE1Ra_menu {
    max-height: 50vh !important;
  }

  /* 作曲栏布局（窄屏重排）。DOM 实测结构：
       .uV2eYG_card(position:relative)
         ├─ .uV2eYG_scroll：输入区
         └─ .uV2eYG_row（宿主 container-type:inline-size，本文件改 normal，见下）
              ├─ .uV2eYG_tools：＋(add) / 附件(add) / 权限(modes) / [input.left]
              └─ .uV2eYG_trailing：模型(_7KE1Ra_root) / 上下文(JObwrW_root) / 发送(primary)
     目标版式（自上而下）：
         (⚠ 完全权限 ˅)                       (▤ DeepSeek-V41-Flash High ˅)
         ┌───────────────────────────────────┐
         │ [输入框]                           │
         │ (＋) (📎)     ◔ 上下文已用 xx%  [发送] │
         └───────────────────────────────────┘
     做法：tools/trailing 拍平（display:contents）后，两颗胶囊整体脱离文档流，绝对
     定位到卡片上方（bottom:100%，包含块 = 卡片）；卡片同时用 margin-top 预留同高的
     一条带（胶囊 28px + 间隔 8px = 36px）—— 是真占位，所以胶囊既不与输入框相连、
     不压在输入框上，也不压住上方消息区。底行只剩 ＋/附件/上下文/发送，
     flex-wrap:nowrap 保证它永远是一行：发送因此固定停在卡片右下角，不会再被挤到
     下一行（宿主原尺寸下 320px 也放得下）。权限/模型的文字标签宿主默认 display:none
     （窄屏只给图标），这里显式放出来；上下文那个按钮 DOM 里没有文本，用 ::after
     取 aria-label（"上下文已用 xx%"）补上基本信息。
     为什么必须 container-type:normal：宿主给 .uV2eYG_row 的 container-type:inline-size
     附带 layout containment，会让**行盒**成为绝对/固定后代的包含块 —— 胶囊的
     bottom:100% 会落回卡片内部（输入框上），正是本次要拆掉的旧形态；它同时让卡片里
     的 .JObwrW_panel（position:fixed）以行盒为锚。让位给卡片后：胶囊以卡片为包含块、
     上下文面板以视口为锚（原 CSS 的意图）。代价是宿主那两条 @container 查询不再命中：
     权限标签本来就被本文件强制显示，模型触发器 max-width:45cqw 退化成 45vw ≈ 175px，
     仍被胶囊自己的 max-width 收住。
     边界保护：两颗胶囊各 max-width:calc(50% - 6px)，永不重叠；标签 overflow:hidden +
     ellipsis；胶囊与圆按钮尺寸一律不改（沿用宿主原值）。 */
  .uV2eYG_row {
    flex-wrap: nowrap !important;
    justify-content: flex-start !important;
    align-items: center !important;
    gap: 10px !important;
    /* 见上：让出包含块（胶囊定位到卡片、上下文面板锚定视口）。 */
    container-type: normal !important;
  }
  .uV2eYG_tools,
  .uV2eYG_trailing {
    display: contents !important;
  }
  /* 胶囊带占位：只在真有胶囊时留（工作区选择等无胶囊状态不留空档）。
     :has 与宿主同基线——宿主自己也用 .uV2eYG_root:has([data-composer-stats])。 */
  .uV2eYG_card:has(.uV2eYG_modes > *, ._7KE1Ra_root) {
    margin-top: 36px !important;
  }
  /* ① 胶囊层：脱离卡片盒，悬在卡片上方 8px。左右各贴一边、中间自然留白；各占
     一半宽度作上限，所以标签再长也不会互相重叠。 */
  .uV2eYG_modes,
  ._7KE1Ra_root {
    position: absolute !important;
    top: auto !important;
    bottom: 100% !important;
    margin-bottom: 8px !important;
    max-width: calc(50% - 6px) !important;
    min-width: 0 !important;
  }
  .uV2eYG_modes {
    left: 0 !important;
    right: auto !important;
  }
  ._7KE1Ra_root {
    left: auto !important;
    right: 0 !important;
  }
  /* 胶囊内部**不许收缩**：宿主默认 flex-shrink:1，宽度不够时会把胶囊里的文字挤成
     两行（"计划模式"这种短标签实测会折成两行、胶囊高 44px），预留带就装不下它了。
     让位交给权限胶囊自己 —— 它的标签本来就有 ellipsis（见下）。 */
  .uV2eYG_modes > * {
    flex-shrink: 0 !important;
    max-width: 100% !important;
    min-width: 0 !important;
  }
  .uV2eYG_modes > [class*="_trigger"] {
    flex-shrink: 1 !important;
  }
  /* 胶囊外观：底色用宿主自己的 token（--dsw-specific-selector：亮色 #f5f6f7 /
     暗色 #353638），与 ＋/附件 两个圆**同色**——之前写死的 rgba(127,127,127,.12)
     在亮色下合成 (240,240,240)，比宿主自己的灰还深一档，整条作曲栏因此显得发暗。
     **高度/内边距/圆角一律不覆盖**，沿用宿主原值（实测 28px、圆角 24px），
     只加底色与下面那组防溢出规则。 */
  .uV2eYG_row .uV2eYG_modes button[class*="_trigger"],
  .uV2eYG_row ._7KE1Ra_trigger {
    max-width: 100% !important;
    min-width: 0 !important;
    background: var(--dsw-specific-selector, rgba(127, 127, 127, .12)) !important;
  }
  .uV2eYG_modes [class*="triggerLabel"],
  ._7KE1Ra_triggerLabel,
  ._7KE1Ra_triggerEffort {
    display: block !important;
    min-width: 0 !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
  }
  /* ② 底行：＋/附件 在左下，上下文 + 发送贴右下（上下文 margin-left:auto 顶过去）。
     视觉顺序 = 文档顺序，不再需要 order；旧的 order/断行垫片是配合"胶囊压输入框"
     那版排的，已随胶囊上移一并删除。 */
  .JObwrW_root {
    margin-left: auto !important;
    /* 底行 nowrap：上下文只能缩自己，不能把发送键顶出卡片。 */
    min-width: 0 !important;
  }
  /* 上下文按钮显式给 auto 宽度 + inline-flex，否则它仍是图标按钮（宿主 28×28），
     ::after 那段文字会溢出到卡片外。高度沿用宿主原值 28px。 */
  .JObwrW_trigger {
    width: auto !important;
    min-width: 28px !important;
    height: 28px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 6px !important;
    padding: 0 6px !important;
    overflow: visible !important;
  }
  .JObwrW_trigger::after {
    content: attr(aria-label);
    font-size: 12px;
    line-height: 1;
    white-space: nowrap;
    /* 超长文案（"上下文已用 100%" 之类）在自己这一格内省略，不撑破底行。 */
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* 作曲栏视觉收紧。结构实测（390px）：seat(pad-bottom 10) > root(pad 0 16px 4px)
     > card(pad-top 8 / gap 12 / radius 22) > [scroll(input 36) + row(44)]，
     指标行在 card 下面。逐项收一点留白与字号：
       - 进卡留白 8→6、输入区与工具行间距 12→8；
       - 输入行 min-height 36→32、行高 24→20、上内边距 4→2；
       - 工具行显式 gap 10（原来靠各控件自带间距，模型胶囊那格是 20，参差）；
       - 指标胶囊 13px→12px，一行装得下、少一处省略号；
       - 底部留白 4→2，seat 10→8（真机仍取 safe-area）。
     圆按钮（＋ / 附件 / 上下文 / 发送）一律**不改尺寸**，沿用宿主原值。 */
  .uV2eYG_card {
    padding-top: 6px !important;
    gap: 8px !important;
  }
  .uV2eYG_scroll,
  .uV2eYG_grow,
  .uV2eYG_input {
    min-height: 32px !important;
  }
  .uV2eYG_input {
    padding-top: 2px !important;
    padding-left: 8px !important; /* 与下面那排控件的左缘对齐（原来 14px，比 ＋ 号右 6px） */
    line-height: 20px !important;
  }
  .wSkVaW_composerSeat [class*="_pill"] {
    font-size: 12px !important;
    line-height: 18px !important;
    padding: 1px 7px !important;
  }
  .uV2eYG_root {
    padding-bottom: 2px !important;
  }

  /* 侧边栏切换按钮：展开态加大触控目标 */
  .hHd-Xa_root:not(.hHd-Xa_collapsed) .hHd-Xa_toggle {
    width: auto !important;
    padding: 0 10px !important;
    gap: 6px !important;
  }

  /* 设置面板：手机全屏化，导航栏变顶部横排，内容独占剩余空间 */
  .VOzbGW_overlay {
    align-items: stretch !important;
    justify-content: stretch !important;
    padding: 0 !important;
  }
  .VOzbGW_panel {
    width: 100vw !important;
    max-width: 100vw !important;
    height: 100vh !important;
    height: 100dvh !important;
    max-height: 100dvh !important;
    border-radius: 0 !important;
    flex-direction: column !important;
  }
  .VOzbGW_nav {
    width: 100% !important;
    flex-direction: row !important;
    align-items: center !important;
    gap: 8px !important;
    padding: 8px 10px !important;
    overflow-x: auto !important;
    border-bottom: 1px solid var(--dsw-alias-border-l1);
  }
  .VOzbGW_navList {
    flex-direction: row !important;
    gap: 4px !important;
  }
  .VOzbGW_navCell {
    min-width: max-content !important;
  }
  .VOzbGW_content {
    flex: 1 !important;
    min-height: 0 !important;
    overflow-y: auto !important;
  }
  /* 设置面板入场动画：宿主官方对话框是"啪"地直接出现（390px 实测
     animation-name:none），补一段遮罩淡入 + 面板上浮，读起来才像一张 sheet。
     面板只动 transform 不动 opacity，避免与遮罩淡入叠成二次淡入；实测面板内
     没有 position:fixed 后代，动画期的 transform 不会给别的 fixed 元素换包含块。
     keyframes 与"减弱动态效果"关闭规则放在文件末尾的顶层区，避免媒体查询嵌套。 */
  .VOzbGW_overlay {
    animation: dsh-android-ui-fade .18s ease-out;
  }
  .VOzbGW_panel {
    animation: dsh-android-ui-sheet-rise .2s ease-out;
  }

  /* 会话头部：子代理另起一行，避免"预设/子代理/Session Log"挤在一行 */
  .wSkVaW_titleRow {
    flex-wrap: wrap !important;
  }
  /* 标题簇也必须可换行：下面那条 headerActions{flex-basis:100%} 的本意是
     "操作区独占一整行"，但标题簇（titleCluster）上游是 nowrap，100% 基线
     在 nowrap 容器里不会换行、只会把 crumbs 挤成 0 宽 —— 390px 实测会话标题
     只剩 16px（文字 100px），标题等于不可见。允许换行后 crumbs 拿回整行
     （实测 100px），操作区落到第二行，页面行数不变。 */
  .wSkVaW_titleCluster {
    flex-wrap: wrap !important;
  }
  .wSkVaW_headerActions {
    flex: 0 0 100% !important;
    flex-wrap: wrap !important;
  }
  .h8S2Va_root {
    flex-basis: 100% !important;
  }

  /* 子代理下拉：position:fixed 脱离 overflow 容器裁剪，仍吸附在触发器
     下方（top:auto = 静态位置，即触发器正下方）；水平方向做成视口内
     全宽面板（left:8px + right:8px），无论触发器位置/页面缩放如何，
     右边界都不会超出视口。 */
  .h8S2Va_menu {
    position: fixed !important;
    left: 8px !important;
    right: 8px !important;
    top: auto !important;
    width: auto !important;
    min-width: 0 !important;
    max-width: calc(100vw - 16px) !important;
    max-height: 60vh !important;
    overflow: auto !important;
    z-index: 100 !important;
  }

  /* 后台任务下拉（.QsffPG_menu）：与子代理下拉同款——视口内全宽面板。 */
  .QsffPG_menu {
    position: fixed !important;
    left: 8px !important;
    right: 8px !important;
    top: auto !important;
    width: auto !important;
    min-width: 0 !important;
    max-width: calc(100vw - 16px) !important;
    max-height: 60vh !important;
    overflow: auto !important;
    z-index: 100 !important;
  }
}

/* 软键盘弹出时（html[data-dsh-kb-open] 由浏览器半的键盘跟随效果设置）：
   贴底的悬浮面板（用量/上下文仪表）随键盘上移，避免被键盘遮挡；
   其余以 top 锚定的菜单在键盘弹出时位于可视区上方，不受影响。 */
html[data-dsh-kb-open] .JObwrW_panel {
  bottom: calc(64px + var(--dsh-kb, 0px)) !important;
}

/* 设置面板入场动画的关键帧（≤480px 的两条 animation 引用它们）与"减弱动态
   效果"关闭规则。放顶层而不是嵌在媒体查询里：媒体查询嵌套虽然合法，但旧
   WebView 上会整块被忽略，顶层就没有这个变量。 */
@keyframes dsh-android-ui-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes dsh-android-ui-sheet-rise {
  from { transform: translateY(14px) scale(.98); }
  to { transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .VOzbGW_overlay,
  .VOzbGW_panel {
    animation: none !important;
  }
  /* 抽屉/遮罩/悬浮开关同样关掉过渡：关掉后收起态直接落到 visibility:hidden，
     与动画版结束时的画面一致。展开态那条选择器必须一起列出来 —— 它的特异性
     更高，只写基态那条会被它自己顶掉。 */
  [class*="_frame"] > [class*="_sidebarCol"],
  [class*="_frame"]:not([data-sidebar-collapsed]) > [class*="_sidebarCol"],
  [class*="_frame"] [data-shell-overlay]::before,
  [data-dsh-nav-fab] {
    transition: none !important;
  }
}
`
