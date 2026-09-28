/**
 * 移动端 CSS（宿主半以 `{ kind: 'style' }` 行注入 index.html 的 <head>）。
 *
 * 移植自 deepseek-harness-android/patches/mobile.css，规则逐字保留。
 *
 * ⚠️ 版本敏感：选择器里的类名（.uV2eYG_* / .VOzbGW_* / ._7KE1Ra_* / .wSkVaW_* /
 * .hHd-Xa_* / .ZKlsPq_* / ._list_gzo7u_* / .P3OORG_* / .Nqubda_* / .pI_x6G_frame 系列，
 * 以及 client.ts 的 ._bubble_ugtpz_1）**已按 dsh 0.1.7-rc.2 逐个核对命中**，
 * 上游重新构建后哈希前缀会变、CSS module 的本地名（_frame / _sidebarCol / _menu …）
 * 不变。**版本号没变也会变**：同一个 0.1.5-rc.1 重新发布后 .h8S2Va_* → .ZKlsPq_*、
 * .Md3f7G_hint → .EvIC1a_hint、._list_19372_8 → ._list_1nxmc_8、
 * ._bubble_owhem_8 → ._bubble_1nw3t_1；升到 0.1.7-rc.2 后 ._list_1nxmc_8 →
 * ._list_gzo7u_7、._bubble_1nw3t_1 → ._bubble_ugtpz_1（气泡还搬进了外壳
 * dsh-web-frontend，其它仍是各自的 client-ui-* 包）。
 * 所以升级 dsh 后要按本文件逐个类名核对是否还命中（不命中只是效果静默失效，不会报错）。
 * 核对方法：在 `npm root -g`/@deepseek-ai/dsh/node_modules/@deepseek-ai/ 下按包名 grep
 * lib/client.js（外壳那几个类名在外壳包 dsh-web-frontend 的 dist/assets 里），
 * 或按本地名反查（`grep -rho "[A-Za-z0-9_-]*_hint\b"`）。
 * 优先依赖 data-* 稳定契约（data-sidebar-collapsed / data-shell-overlay /
 * data-shell-leading / data-dsh-kb-open），其次按本地名后缀做子串匹配
 * （[class*="_frame"]），最后才是整串哈希类名。
 * 踩过的坑：data-details-collapsed 在 0.1.5-rc.1 已被 data-sidebar-collapsed 取代，
 * 旧规则静默失效，展开侧栏会把对话区挤成窄条（见下方抽屉段注释）。
 * 另一类坑（0.1.7-rc.2 集中清理了一批）：**宿主自己接管了定位**的下拉/面板 ——
 * 子代理菜单、后台任务菜单、模型菜单、用量/上下文面板、tooltip 气泡，现在都是
 * createPortal（或条件渲染）+ JS 算坐标 + 内联 style。本文件对它们再写
 * position/left/right/top 的 !important 只会盖掉内联值（!important 赢过内联），
 * 属于"必须删掉"而不是"失效"。
 */
export const MOBILE_CSS = String.raw`/* 竖屏手机适配覆盖层 —— dsh-android-ui */

/* 样式表已到位的握手标记：浏览器半注入悬浮侧栏按钮前先读这个自定义属性，
 * 读不到就不注入。样式表由 Node 半在 index 里注入（重启才更新），而浏览器半
 * 的 bundle 是宿主按请求从磁盘读的 —— 两者不同步时（改了 CSS 还没重启）
 * 页面会多出一个没有样式的裸按钮。 */
:root {
  --dsh-android-ui-css: 1;
  /* 抽屉展开/收起时长（同时管遮罩与悬浮开关的淡入淡出）：想快想慢只调这一处。
     取值与宿主自己的横向面板一致 —— 右栏文件预览面板用
     var(--ds-transition-duration-slow)（300ms）+ var(--ds-ease-in-out)；本模块
     其余动效（设置面板 180/200ms）更短，因为那些是"浮现"，这里是"横向位移"。 */
  --dsh-android-ui-drawer-ms: 300ms;
}

/* 悬浮开关与作曲栏控件共用同一套"边缘"（用户指定：按钮边缘与作曲栏——输入框卡片
 * 和权限/模型两颗胶囊——一致）：底色、0.5px 极细描边、两层极淡投影都从这两个变量
 * 里取，悬浮开关与两颗胶囊因此不可能各画各的。
 * **必须定义在 body 上，不能放 :root**：调色 token（--dsw-specific-input-major /
 * --dsw-alias-border-l2）是宿主写在 body{…} 与 body[data-ds-dark-theme]{…} 里的，
 * 而自定义属性里的 var() 是在**声明所在元素**上求值的 —— 定义在 :root(html) 上时
 * 两个 token 都取不到、双双落到兜底值，深色主题下悬浮开关会变回一块白。 */
body {
  --dsh-android-ui-chip-fill: var(--dsw-specific-input-major, var(--dsw-alias-bg-layer-1, #fff));
  /* 描边用 box-shadow 画（0.5px 细线，不参与布局）：宿主那两颗胶囊是 content-box，
     真 border 会把 28px 的胶囊撑到 29px、顶破输入框上方那条预留带。 */
  --dsh-android-ui-chip-edge: 0 0 0 .5px var(--dsw-alias-border-l2, rgba(0, 0, 0, .1)),
    0 1px 2px rgba(0, 0, 0, .06), 0 2px 8px rgba(0, 0, 0, .06);
}

/* 子代理目录树下拉（.ZKlsPq_menu）**故意不写规则**：上游 rc.1 之后改成
 * createPortal + JS 定位（catalogMenuPosition：top = 触发器下沿 + 5，left 在
 * 视口内 clamp，宽度/高度也用 CSS 的 min(…, 100vw/100vh - …) 收住），并且把
 * 坐标写在内联 style 上。本文件任何 left/right/top 的 !important 都会盖掉内联
 * 值（!important 胜过内联），等于把菜单按到视口边缘或静态位置 —— 那正是
 * 2026-09 之前为"绝对定位 + left:0"版本写的旧规则，现在只会帮倒忙。
 * 若将来上游回退成纯 CSS 左锚定展开，右边界会重新出屏，届时再加回来。 */

/* 后台任务下拉（.QsffPG_menu）**也不再接管**（0.1.7-rc.2）：宿主给它加了 JS 视口吸附 ——
 * useLayoutEffect 里按触发器 rect 与菜单 offsetWidth 算出 menuShift，把菜单夹在
 * [VIEWPORT_MARGIN, 100vw - margin] 内并写进**内联 left**（宽度也已经是
 * width:500px + max-width:min(560px, 100vw - 32px)）。
 * 本文件原来那两条（顶层 right:0；≤480px 的 fixed + left:8/right:8 全宽面板）都是
 * !important，会盖掉内联 left —— 与子代理下拉同一个坑：把宿主算好的吸附丢掉。
 * 旧版宿主是 trigger 内 absolute;left:0 无内联坐标，那时才需要右对齐/全宽化。 */

/* 用量/上下文仪表面板（.JObwrW_panel）与本模块**无关了**（0.1.7-rc.2）：宿主把它改成
 * createPortal + useAnchoredPosition（useLayoutEffect 里量触发器 rect、side:top/gap:8、
 * 视口内按 margin 12 clamp，scroll/resize/自身 ResizeObserver 都会重算），坐标写在
 * 面板的**内联 style** 上，宽度也由宿主自己收成 min(264px, 100vw - 24px)。
 * 这里曾经写 right/bottom/left/top 的 !important 把面板按到"右下角固定位置" ——
 * !important 赢过内联，等于把宿主算好的坐标丢掉（与子代理下拉同一个坑）。
 * 旧版宿主是 trigger 内的 absolute;bottom:calc(100%+8px);right:0，那时才需要接管。 */

@media (max-width: 480px) {
  /* 侧栏整列脱离网格流：折叠 = 完全收起（不占宽度），展开 = 覆盖式抽屉。
     0.1.5-rc.1 起（0.1.7-rc.2 未变）的壳：frame 带 data-sidebar-collapsed
     （**展开时整个属性消失**，折叠时 =true），列依次是 sidebarCol / centerCol /
     rightbarCol，遮罩层是 [data-shell-overlay]（宿主自己还在这层里渲染 shell.overlay
     座席内容，列外面、整个 frame 之上）。旧版用来识别的 data-details-collapsed 早已
     不存在，整段抽屉规则因此静默失效 —— 390px 展开侧栏时对话区被挤到 110px
     （实测截图）。所以改挂 CSS module 的本地名后缀（_frame / _sidebarCol 跨
     重新构建稳定，只有哈希前缀会变）。
     折叠态也必须脱流：宿主默认给折叠侧栏留 56px 竖条（390px 上占 14% 宽度，
     新建会话/搜索/用量/设置都挤在那一条里），手机上对话区因此永久少一截。
     脱流后折叠态由浏览器半注入的悬浮按钮当入口，见 client.ts 的 sidebar-fab。
     注意宿主自己的左上角座席（shell.leading，0.1.7-rc.2 的 --dsh-frame-leading-clearance
     就是它发布的）**只在 macOS 且侧栏折叠时挂载**（layout 里 leadingMounted = darwin &&
     sidebarCollapsed），网页/安卓端不挂，所以这颗悬浮开关仍是必要的。 */
  [class*="_frame"] {
    grid-template-columns: minmax(0, 1fr) !important;
  }
  [class*="_frame"] > [class*="_sidebarCol"] {
    position: absolute !important;
    top: 0;
    bottom: 0;
    left: 0 !important;
    width: min(280px, 84vw) !important;
    z-index: 40;
    box-shadow: 0 0 28px rgba(0, 0, 0, .45);
    /* 收起/展开走 transform（**不是 left**）：left 是布局属性，每帧都要把这条
       280px 宽、带 28px 阴影的列重绘一遍，主线程扛不住；transform 只动合成层。
       这也是宿主自己的做法 —— 右栏文件预览面板（.P3OORG_panel）就是
       position:absolute + right:0、收起 translate(100%)、展开 transform:none、
       transition:transform 300ms var(--ds-ease-in-out)（s 形缓动，实测比原来的
       240ms ease 顺）。时长与缓动直接复用宿主的 token，手指和眼睛不用重新适应。
       收起 = 移出画布 + 动画播完再转 visibility:hidden：display:none 不可过渡，
       而宿主只切一个属性，没有"动画结束再卸载"的回调时机给我们。
       代价：transform 会给本列造出包含块 —— 列内的 position:fixed 弹出层（设置
       对话框、Cordis 控制面板）会改按本列定位，见下面的 :has 兜底。 */
    transform: translateX(-100%) !important;
    visibility: hidden !important;
    transition: transform var(--dsh-android-ui-drawer-ms, 300ms) var(--ds-ease-in-out, cubic-bezier(.4, 0, .2, 1)),
      visibility 0s linear var(--dsh-android-ui-drawer-ms, 300ms) !important;
  }
  [class*="_frame"]:not([data-sidebar-collapsed]) > [class*="_sidebarCol"] {
    transform: none !important;
    visibility: visible !important;
    /* 展开时 visibility 立刻生效（delay 0），否则滑入的头一帧还是隐藏的。 */
    transition: transform var(--dsh-android-ui-drawer-ms, 300ms) var(--ds-ease-in-out, cubic-bezier(.4, 0, .2, 1)),
      visibility 0s linear 0s !important;
  }
  /* 列内的 position:fixed 弹出层：设置对话框（.VOzbGW_overlay，inset:0，触发器在
     sidebar.settings → 侧栏 footer）与 Cordis 控制面板（.Nqubda_panel，坐标由宿主
     按触发器实测位置写在内联样式上）。它们都在本列的 DOM 子树里，而本列上面那条
     transform 会成为它们的包含块：面板被夹成 280px 宽、或跟着抽屉一起平移
     （实测设置面板 0,0,280,844：导航被裁、正文挤成四行）。所以只要有这两种弹出层，
     就退回"无 transform + left 隐藏" —— left 不造包含块，fixed 后代永远按视口定位。
     观感代价只有弹出层开着时的那段滑动，而用户此时看的是弹出层本身。
     用 :has 而不是 JS 判定：宿主只切 data-sidebar-collapsed 一个属性，本文件没有
     时机去改本列的隐藏方式；:has 不支持的旧 WebView 拿不到这条兜底，退化成
     "弹出层被夹住"（与本改动之前的行为一致），不会更糟。 */
  [class*="_frame"] > [class*="_sidebarCol"]:has(.VOzbGW_overlay, .Nqubda_panel) {
    left: calc(-1 * min(280px, 84vw)) !important;
    transform: none !important;
    transition: left var(--dsh-android-ui-drawer-ms, 300ms) var(--ds-ease-in-out, cubic-bezier(.4, 0, .2, 1)),
      visibility 0s linear var(--dsh-android-ui-drawer-ms, 300ms) !important;
  }
  [class*="_frame"]:not([data-sidebar-collapsed]) > [class*="_sidebarCol"]:has(.VOzbGW_overlay, .Nqubda_panel) {
    left: 0 !important;
    visibility: visible !important;
    transition: left var(--dsh-android-ui-drawer-ms, 300ms) var(--ds-ease-in-out, cubic-bezier(.4, 0, .2, 1)),
      visibility 0s linear 0s !important;
  }
  /* 悬浮开关（浏览器半 [data-dsh-nav-fab] 注入，折叠态才置 visible）：
     外观**与作曲栏同一套"边缘"**（用户指定）：底色、0.5px 极细描边、两层极淡投影
     全部走 --dsh-android-ui-chip-fill / --dsh-android-ui-chip-edge（定义在上面那条
     body 规则里），与权限/模型两颗胶囊是同一份声明。它悬在会话内容上，之前用的是
     应用的"浮层按钮"那套（button-floating-fill + 两层 rgba 重投影），在浅底上比
     作曲栏的控件更"浮"、边缘也不一样（用户实测反馈：不像同一套 UI）。
     纵向位置**与页头右上角那颗文件预览入口（ExpandButton，[data-sidebar-right-expand]）
     平齐**（用户指定）：那才是会话页里与它同排的控件。推导 —— .wSkVaW_header 从
     视口顶开始（frame 是 grid-template-rows:100%，没有上内边距）；宿主自己的
     padding-top 在 0.1.7-rc.2 是 10px，本文件把它压到 6px（见下面的 .wSkVaW_header
     规则，页头同样要紧凑），titleRow 的最小高度被本文件收到 24px，于是行高由里面
     最高的孩子决定：子代理血缘触发器（.ZKlsPq_switcherTrigger min-height:28px）或
     那颗 27px 的 ExpandButton，居中对齐 → 那颗按钮在行高 28 时上沿 = 6 + (28-27)/2
     ≈ 6.5、中线 20。本按钮 28px，取 top = 6 时中线正好 20，与它精确重合；
     行里没有血缘触发器时（行高 27）差 0.5px，肉眼不可见。
     页头那条 padding-top 必须一起抬 safe-area：宿主自己不给页头留刘海，而本按钮是
     fixed、不会跟着页头走 —— 两边用同一个表达式，两种机型上才都不错开。
     尺寸仍是 28×28、字形 15px（与右上角那颗 ExpandButton 的 svg 同尺寸）。
     图标是宿主自己的面板图标（IconPanelLeftOutline16）。
     z-index 低于抽屉(40)与遮罩(39)，抽屉一开就被盖住。
     左上角占位由下面的页头内边距让出来。
     用透明度而不是 display 切换，才能跟抽屉同步淡入淡出。 */
  [data-dsh-nav-fab] {
    position: fixed;
    top: calc(env(safe-area-inset-top, 0px) + 6px);
    left: 8px;
    z-index: 30;
    display: inline-flex;
    opacity: 0;
    pointer-events: none;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: 100px;
    background: var(--dsh-android-ui-chip-fill, var(--dsw-specific-input-major, #fff));
    color: var(--dsw-alias-label-primary, inherit);
    box-shadow: var(--dsh-android-ui-chip-edge,
      0 0 0 .5px var(--dsw-alias-border-l2, rgba(0, 0, 0, .1)), 0 1px 2px rgba(0, 0, 0, .06), 0 2px 8px rgba(0, 0, 0, .06));
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: opacity var(--dsh-android-ui-drawer-ms, 300ms) var(--ds-ease-in-out, cubic-bezier(.4, 0, .2, 1));
  }
  /* 触摸端没有 hover：:active 是唯一能证明"这是一颗按钮"的即时反馈。
     按下底色取作曲栏里那颗 ＋ 的 hover token（interactive-bg-hover-solid），
     不是浮层按钮那套 —— 与上面的边缘是同一套观感。 */
  [data-dsh-nav-fab]:hover,
  [data-dsh-nav-fab]:active {
    background: var(--dsw-alias-interactive-bg-hover-solid, var(--dsw-alias-interactive-bg-hover));
  }
  [data-dsh-nav-fab]:focus-visible {
    outline: 2px solid var(--dsw-alias-state-business-primary, #4f6ef7);
    outline-offset: 1px;
  }
  /* 字形尺寸由本文件定：克隆时剥掉了宿主类名（右上角那颗是 scaleX(-1) 镜像版，
     且宿主把 display:none 挂在同名类上）。15px 与右上角那颗按钮的 svg 规则一致。 */
  [data-dsh-nav-fab] svg {
    display: block;
    width: 15px;
    height: 15px;
  }
  [data-dsh-nav-fab][data-dsh-nav-fab-visible] {
    opacity: 1;
    pointer-events: auto;
  }
  /* 悬浮开关压在左上角，会话页头整块让出这条带：28px 按钮 + 8px 左边距 + 8px
     间隔 = 44px。让位**统一给 header**，不给 titleRow。
     右边距沿用宿主的 28px：headerCorner 自带 margin-right:-16px，改小会把那颗
     按钮推出屏幕。
     padding-top 单独再写一条：它必须与悬浮开关的 top 用同一个表达式（悬浮开关是
     fixed、页头是文档流，宿主自己不给页头留刘海），否则刘海机型上左上角那颗与
     右上角的文件预览入口会错开 —— 见上面 [data-dsh-nav-fab] 那段的推导。
     简写留在前面，是为了"左内边距 44px"这条基线仍然是一个可读的 4 段值。 */
  .wSkVaW_header {
    min-height: 0 !important;
    padding: 6px 28px 0 44px !important;
    padding-top: calc(env(safe-area-inset-top, 0px) + 6px) !important;
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
    transition: opacity var(--dsh-android-ui-drawer-ms, 300ms) var(--ds-ease-in-out, cubic-bezier(.4, 0, .2, 1));
  }
  [class*="_frame"]:not([data-sidebar-collapsed]) [data-shell-overlay]::before {
    opacity: 1;
    pointer-events: auto; /* 遮罩可点击：点击空白区关闭抽屉 */
  }

  /* 作曲栏的圆按钮（＋ / 附件 / 上下文 / 发送）**一律沿用宿主原尺寸**：
     实测 ＋/附件/上下文 28×28、发送 34×34。之前为触控目标把它们抬到 44px，
     结果作曲栏又高又重，窄屏下 44px 的发送键还会被挤到下一行、跑到左下角。
     尺寸交回宿主后底行在 320px 也放得下，发送稳定停在右下角。 */

  /* 抽屉里的会话行**不改尺寸**：宿主 32px 高（390px 实测），曾经为了让它在触摸端
     好点抬到 44px，但一个抽屉只装得下几行、观感也更笨重 —— 尺寸交回宿主。
     同理下面的图标按钮只抬高度不动宽度（宽度一改那排图标会被抽屉右缘裁掉）。 */

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

  /* 抽屉底部的「设置」入口（宿主 sidebar.settings 座席 → .VOzbGW_trigger）：
     观感套 dsh-mobile-nav（dsh-web-mobile）抽屉底部那颗药丸（描边 + 圆角 +
     hover/按下反馈），但**底色必须与抽屉背景分开**（用户指定）：透明底就是侧栏
     自己的 --dsw-specific-sidebar-fill（亮色 #f9fafb），按钮与背景同色，只剩一条
     4% 的细线，看着不像一颗按钮。
     所以底色/描边直接沿用宿主**同一列里那颗「新建会话」**的画法
     （.hHd-Xa_newSession：button-elevated-fill + .5px border-l3）—— 同一列两种
     按钮一套观感，深浅色主题都跟着 token 走（暗色下 elevated-fill #43454a
     也明显亮于侧栏 #1b1b1c）。
     高度/内边距/字号一律沿用宿主原值（42px 整行）：那颗药丸本身是 34px，
     但触控目标越大越好按，用户要的是"手指按住有反应"的观感，不是把行做小。
     排除 .VOzbGW_rail：侧栏收起时宿主仍渲染这一行（只是缩成 36×36 圆钮），
     给圆钮套描边会变成一个带边框的圆（那时整列在屏外，看不见，但别留着）。 */
  .VOzbGW_trigger:not(.VOzbGW_rail) {
    background: var(--dsw-alias-button-elevated-fill, var(--dsw-specific-input-major, #fff)) !important;
    border: .5px solid var(--dsw-alias-border-l3, rgba(0, 0, 0, .12)) !important;
    border-radius: 12px !important;
    -webkit-tap-highlight-color: transparent;
  }
  /* 按下/悬停换成**实色** hover token（作曲栏那颗 ＋ 用的同一个）：
     --dsw-alias-interactive-bg-hover 是半透明的（#2631480f），拿它当 background
     会把刚填上的底色又换回接近背景的浅灰 —— 按下去按钮反而"消失"。 */
  .VOzbGW_trigger:not(.VOzbGW_rail):hover,
  .VOzbGW_trigger:not(.VOzbGW_rail):active {
    background: var(--dsw-alias-interactive-bg-hover-solid, var(--dsw-alias-interactive-bg-hover)) !important;
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

  /* 下拉菜单不出屏（外壳 UI kit 的 ._list_*；0.1.5-rc.1 是 ._list_1nxmc_8，
     0.1.7-rc.2 变成 ._list_gzo7u_7）。宿主自己的上限是 360px、没有按视口收，
     320px 窄屏上仍会顶出右边界；这里把它夹到视口内。
     菜单本体若走 portal（._portal_gzo7u_41 = fixed + 宿主 JS 坐标）不受影响。 */
  ._list_gzo7u_7 {
    max-width: calc(100vw - 16px) !important;
  }

  /* 模型选择器：尺寸/内边距**一律沿用宿主原值**（实测 28px 高、gap 4），
     之前这里为了"加大触控"写成 36px + 大内边距，比同排的权限胶囊高 8px、
     还多占 12px 宽，直接把胶囊行挤到折行。 */
  ._7KE1Ra_triggerLabel {
    min-width: 0 !important;
    white-space: nowrap !important;
    text-overflow: ellipsis !important;
  }
  /* 下拉菜单是弹层、不在作曲栏里，选项仍按触控目标 44px。
     菜单尺寸本身**不动**：宿主 0.1.7-rc.2 已经是 fixed + width:max-content、
     max-width:min(420px, 100vw - 32px)、max-height:min(360px, 100vh - 96px)，
     比本文件原来那条 max-height:50vh 更严格。 */
  ._7KE1Ra_option {
    min-height: 44px !important;
  }

  /* 作曲栏布局（窄屏重排）。DOM 实测结构（0.1.7-rc.2）：
       .uV2eYG_card(position:relative, data-composer-card)
         ├─ .uV2eYG_overlayAnchor / .uV2eYG_accessory / 附件座席 / .uV2eYG_scroll 输入区
         └─ .uV2eYG_row（宿主 container-type:inline-size，本文件改 normal，见下）
              ├─ .uV2eYG_tools（hidden=activity）：＋(add) / 附件(input file) /
              │    权限+计划(.uV2eYG_modes) / [input.left]
              └─ .uV2eYG_trailing
                   ├─ .uV2eYG_standardControls（hidden=activity）：[input.right]=上下文 /
                   │    模型座席(._7KE1Ra_root)
                   └─ .uV2eYG_activity / _activityExpanded：[input.activity]=发送键等
     目标版式（自上而下）：
         (⚠ 完全权限 ˅)                       (▤ DeepSeek-V41-Flash High ˅)
         ┌───────────────────────────────────┐
         │ [输入框]                           │
         │ (＋) (📎)     ◔ 45% 上下文已用 45%  [发送] │
         └───────────────────────────────────┘
     做法：tools 拍平（display:contents，排除 [hidden]）把 ＋/附件 并进底行；trailing
     保留 flex 盒子，并显式 margin-left:auto —— 发送键的右对齐靠它。新会话页没有上下文
     胶囊、trailing 里只剩活动座席时，如果也把 trailing 拍平，这个右推边距会一起消失，
     发送键就落到＋/附件后面；保留盒子后无论胶囊/上下文是否渲染，发送都在最右。
     两颗胶囊整体脱离文档流，绝对定位到卡片上方（bottom:100%，包含块 = 卡片）；
     卡片同时用 margin-top 预留同高的一条带（胶囊 28px + 间隔 8px = 36px）—— 是真
     占位，所以胶囊既不与输入框相连、不压在输入框上，也不压住上方消息区。
     外观上它们就照输入框卡片自己那套画（用户指定）：底色同卡片
     （--dsw-specific-input-major）、0.5px 极细描边（--dsw-alias-border-l2，与卡片
     自己的 stroke 同色）、外加两层极淡投影（对应卡片的 elevation-soft）—— 看起来
     像"两枚缩小版的输入框"浮在卡片上方，而不是另一种灰底胶囊。
     底行只剩 ＋/附件/上下文/发送，flex-wrap:nowrap 保证它永远是一行：发送因此固定停在卡片
     右下角，不会再被挤到下一行（宿主原尺寸下 320px 也放得下）。权限/模型的文字标签
     现在是宿主自己用 --dsh-composer-mode/model-text-display 这类变量 + 容器查询切换
     （窄屏只给图标），本文件把标签显式放出来（见下面 triggerLabel 那组规则）；
     上下文按钮宿主已经自带百分比文本，本文件不再补 ::after。
     为什么必须 container-type:normal：宿主给 .uV2eYG_row 的 container-type:inline-size
     附带 layout containment，会让**行盒**成为绝对/固定后代的包含块 —— 胶囊的
     bottom:100% 就会以行盒为锚落进输入框里（正是要拆掉的旧形态）。让位给卡片后胶囊
     以卡片为包含块。代价是宿主那条 @container (width<=560px) 的 gap 微调不再命中
     （本文件自己给了 gap）、模型触发器 max-width:45cqw 退化成 45vw ≈ 175px，仍被胶囊
     自己的 max-width 收住。
     边界保护：两颗胶囊各 max-width:calc(50% - 6px)，永不重叠；标签 overflow:hidden +
     ellipsis；胶囊与圆按钮尺寸一律不改（沿用宿主原值）。 */
  .uV2eYG_row {
    flex-wrap: nowrap !important;
    justify-content: flex-start !important;
    align-items: center !important;
    gap: 10px !important;
    /* 见上：让出包含块（胶囊定位到卡片，不被行盒夹住）。 */
    container-type: normal !important;
  }
  /* tools 拍平：把 ＋/附件/权限胶囊并进底行。
     必须排除 [hidden]：宿主 0.1.7-rc.2 用 hidden: activity 在会话跑起来时整组藏掉
     （让位给 activity 座席），而 display:contents 会盖过 UA 的 [hidden]{display:none}
     —— 不排除的话，生成期间 ＋/附件 与两颗胶囊仍会显示。 */
  .uV2eYG_tools:not([hidden]) {
    display: contents !important;
  }
  /* trailing 不能 display:contents：宿主靠它的 margin-left:auto 把整组贴到右缘。
     新会话页没有上下文仪表面板、trailing 里只剩发送键，拍平就会把右推边距一起
     拆掉，发送键便跟在＋/附件后。保留盒子后空/满状态下发送都在最右。 */
  .uV2eYG_trailing {
    display: flex !important;
    margin-left: auto !important;
    gap: 10px !important;
    min-width: 0 !important;
  }
  /* 胶囊带占位：只在真有胶囊（且那一段没被宿主藏起来）时留。
     两处 :not([hidden]) 是 0.1.7-rc.2 的账：会话跑起来时宿主把 tools 与
     standardControls 整组 hidden，胶囊跟着消失，此时再留 36px 就是一条白带
     （旧版没有这个 hidden，所以原来只判断"有没有胶囊"）。
     :has 的写法与宿主同基线 —— 宿主自己在 composerSeat 上也用 :has。 */
  .uV2eYG_card:has(.uV2eYG_tools:not([hidden]) .uV2eYG_modes > *, .uV2eYG_standardControls:not([hidden]) ._7KE1Ra_root) {
    margin-top: 36px !important;
  }
  /* ① 胶囊层：脱离卡片盒，悬在卡片上方 8px。权限贴卡片左缘、模型贴右缘。 */
  .uV2eYG_modes,
  ._7KE1Ra_root {
    position: absolute !important;
    top: auto !important;
    bottom: 100% !important;
    margin-bottom: 8px !important;
    min-width: 0 !important;
  }
  /* 权限胶囊最多占一半（要留给模型），标签自己的 ellipsis 兜底。 */
  .uV2eYG_modes {
    left: 0 !important;
    right: auto !important;
    max-width: calc(50% - 6px) !important;
  }
  /* 模型胶囊：能多宽就多宽，**顶到权限胶囊前 12px 才省略**。CSS 没法表达"到邻居为止"
     （两个胶囊分属 tools/trailing 两棵子树，没法放进同一个 flex 行），所以宽度上限由
     浏览器半量出权限胶囊的实测宽度写进卡片上的 --dsh-modes-w（见 client.ts 的
     model-pill-width）。变量还没写上时退回一半宽度，两颗胶囊同样不会重叠。 */
  ._7KE1Ra_root {
    left: auto !important;
    right: 0 !important;
    max-width: calc(100% - var(--dsh-modes-w, 50%) - 12px) !important;
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
  /* 胶囊外观：照输入框卡片那套画（用户指定"和输入框样式颜色相同 + 很细的描边"）——
     底色 = 卡片的 --dsw-specific-input-major，描边 = 卡片自己那条 stroke 的颜色
     --dsw-alias-border-l2，再补两层极淡投影（对应卡片 elevation-soft 里那两层，
     但**不含** 0 0 0 .5px 那条：这里已经用 box-shadow 自己画了描边，直接套 token
     会叠出双线）。这一整套取值集中在文件顶部的 --dsh-android-ui-chip-fill /
     --dsh-android-ui-chip-edge（**body 上**，理由见那段注释）—— 左上角那颗悬浮开关
     用的是同一份声明，两处观感因此永远一致（用户指定"按钮边缘与作曲栏一致"）。
     用 box-shadow 而不是 border：宿主这两颗触发器是 content-box（模型触发器实测
     height:28px、border:none），真 border 会把胶囊撑到 29px，把预留带顶破；box-shadow
     不参与布局，0.5px 的细线也是宿主自己画描边的习惯写法。
     注意不要把底色写回 --dsw-specific-selector：那个灰和卡片里的 ＋/附件 圆钮同色，
     悬在卡片外时反而与页面底色分不开（用户实测反馈"不像输入框的一部分"）。
     **高度/内边距/圆角一律不覆盖**，沿用宿主原值（实测 28px、圆角 24px），
     只加底色、描边投影与下面那组防溢出规则。 */
  .uV2eYG_row .uV2eYG_modes button[class*="_trigger"],
  .uV2eYG_row ._7KE1Ra_trigger {
    max-width: 100% !important;
    min-width: 0 !important;
    background: var(--dsh-android-ui-chip-fill, var(--dsw-specific-input-major, var(--dsw-alias-bg-layer-1, #fff))) !important;
    box-shadow: var(--dsh-android-ui-chip-edge,
      0 0 0 .5px var(--dsw-alias-border-l2, rgba(0, 0, 0, .1)), 0 1px 2px rgba(0, 0, 0, .06), 0 2px 8px rgba(0, 0, 0, .06)) !important;
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
  /* ② 底行：＋/附件 在左下，trailing 整体贴右；上下文在 trailing 内，发送是它的
     最后一个子项。视觉顺序 = 文档顺序，不再需要 order；旧的 order/断行垫片是配合
     "胶囊压输入框"那版排的，已随胶囊上移一并删除。 */
  .JObwrW_root {
    /* trailing 已是右对齐盒子；这里只保证上下文胶囊可收缩，不把发送键顶出去。
       宿主自己的 .JObwrW_root 是 flex:none（不收缩），长文案（"上下文已用 100%"）
       在 320px 上会撑破底行，所以显式允许它收缩。 */
    flex-shrink: 1 !important;
    min-width: 0 !important;
  }
  /* 上下文按钮的外观**全部交回宿主**（0.1.7-rc.2）：宿主自己把它做成
     inline-flex + gap 6 + padding 1px 8px，并在里面渲染了一个 <span>{百分比}</span>。
     本文件曾经用 ::after 的 content:attr(aria-label) 把 aria-label（"上下文已用
     45%"）补成可见文字 —— 那时按钮只有圆环图标；现在会把同一句话显示两遍
     （"◔ 45% 上下文已用 45%"），还把按钮撑宽。所以整段（含 width/height/padding
     覆盖）删掉。 */

  /* 作曲栏视觉收紧。结构实测（390px）：seat(pad-bottom 10) > root(pad 0 16px 4px)
     > card(pad-top 8 / gap 12 / radius 22) > [scroll(input 36) + row(44)]，
     指标行在 card 下面。逐项收一点留白与字号：
       - 进卡留白 8→6、输入区与工具行间距 12→8；
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
    min-height: 36px !important;
  }
  .uV2eYG_input {
    padding-top: 4px !important;
    padding-left: 8px !important; /* 与下面那排控件的左缘对齐（原来 14px，比 ＋ 号右 6px） */
    line-height: 24px !important;
  }
  /* 提示词不是输入框的后代，而是 .uV2eYG_grow（position:relative）里与它平级的
     绝对定位节点，宿主按**自己**的输入框几何写死 inset:4px 8px auto 14px。上面一改
     内边距/行高，两边就各自为政。把同一组值补给提示词，两者重新重合。改上面那三条时
     必须同步改这里（冒烟测试盯着）。 */
  .uV2eYG_placeholder {
    top: 4px !important;
    left: 8px !important;
    line-height: 24px !important;
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

  /* 会话头部：标题行允许换行，子代理血缘另起一行，避免"预设/子代理/Session Log"
     挤在一行。纵向一律收到最小 —— 左边基线由上面的 .wSkVaW_header 统一给 44px（悬浮开关让位量），
     这里只调行高、间距与内边距，碰不到水平定位，所以收紧也不会重叠。 */
  .wSkVaW_titleRow {
    flex-wrap: wrap !important;
    min-height: 24px !important;
  }
  /* 标题簇也必须可换行：下面那条 headerActions{flex-basis:100%} 的本意是
     "操作区独占一整行"，但标题簇（titleCluster）上游是 nowrap，100% 基线
     在 nowrap 容器里不会换行、只会把 crumbs 挤成 0 宽 —— 390px 实测会话标题
     只剩 16px（文字 100px），标题等于不可见。允许换行后 crumbs 拿回整行
     （实测 100px），操作区落到第二行，页面行数不变。 */
  .wSkVaW_titleCluster {
    flex-wrap: wrap !important;
    gap: 6px !important;
  }
  /* 这一格是**当前会话的预设胶囊**（宿主 AgentPresetLabel：inline-flex、22px 高、
     最多 180px、文字可省略）。这里曾经写死 flex:0 0 100%（想让它"独占一行"），
     代价是标题与 preset 永远分两排、中间空出一整行。改成可收缩的同排项：胶囊贴
     标题右侧；crumbs 有 min-width:0 + ellipsis，谁宽谁让位，实在放不下时由上面
     titleCluster 的 wrap 兜底换行（flex 布局不会重叠）。 */
  .wSkVaW_headerActions {
    flex: 0 1 auto !important;
    flex-wrap: wrap !important;
    gap: 6px !important;
    min-width: 0 !important;
  }
  /* 没装对应插件时这一槽是空的，空元素仍会占掉一个行间距，白给页头加高。 */
  .wSkVaW_headerActions:empty {
    display: none !important;
  }
  .wSkVaW_headerUtilities {
    margin-left: 8px !important;
    gap: 6px !important;
  }
  .wSkVaW_headerCorner {
    margin-left: 4px !important;
  }
  /* 标题胶囊（宿主 4px 8px 内边距、22px 圆角）只收内边距，字号/行高不动。 */
  .wSkVaW_crumb {
    padding: 2px 6px !important;
  }
  /* 标签页与标题共用左基线：宿主自带 8px 左内边距会把它从基线上推走。 */
  .wSkVaW_tabs {
    margin-top: 2px !important;
    padding-left: 0 !important;
    gap: 24px !important;
  }
  .wSkVaW_tab {
    padding-bottom: 6px !important;
  }
  .ZKlsPq_root {
    flex-basis: 100% !important;
  }

  /* 子代理下拉在这里也**不接管**（理由见文件上半部分同名注释）：宿主是
     createPortal + 内联 left/top，本文件的 !important 会把它按到静态位置。 */

  /* 后台任务下拉（.QsffPG_menu）同样不接管：宿主自己按触发器 rect 把它吸附在视口内
     （见文件上半部分的同名注释），宽度/高度/滚动都已由宿主收好。 */
}

/* 软键盘弹出时的挂钩：浏览器半的键盘跟随效果会写 html.style.height /
   data-dsh-kb-open / --dsh-kb（收起或卸载时清空）。
   本文件现在**没有任何规则挂在它上面** —— 唯一的使用者（用量/上下文面板的 bottom
   提升）已随宿主改用 useAnchoredPosition 而删除（面板按触发器定位，触发器自己跟着
   页面抬起）。保留这对挂钩是给别的样式/插件用的，也是键盘跟随的自检点（冒烟测试
   断言了弹起时写入、卸载时清空）；将来要加规则直接挂在 html[data-dsh-kb-open] 上。 */

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
     与动画版结束时的画面一致。展开态与 :has 兜底那几条选择器必须一起列出来 ——
     它们特异性更高，只写基态那条会被它们顶掉。 */
  [class*="_frame"] > [class*="_sidebarCol"],
  [class*="_frame"]:not([data-sidebar-collapsed]) > [class*="_sidebarCol"],
  [class*="_frame"] > [class*="_sidebarCol"]:has(.VOzbGW_overlay, .Nqubda_panel),
  [class*="_frame"]:not([data-sidebar-collapsed]) > [class*="_sidebarCol"]:has(.VOzbGW_overlay, .Nqubda_panel),
  [class*="_frame"] [data-shell-overlay]::before,
  [data-dsh-nav-fab] {
    transition: none !important;
  }
}
`
