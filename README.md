# dsh-android-ui

**一句话 / In one line**：[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的网页界面在手机上本来是给桌面浏览器排的版——地址栏/刘海压住内容、软键盘盖住输入框、侧栏挤扁正文、触摸端点按钮没反应。本模块把这些改成手机能用，打包成**官方组合包插件**：不修改任何 dsh 产品文件，`dsh plugin add` 一行装上，升级 dsh 后自动生效。

**In one line**: DeepSeek Harness's web UI is laid out for desktop browsers; on a phone the notch covers content, the soft keyboard hides the composer, the sidebar squeezes the text, and touch taps on some buttons do nothing. This bundle fixes that, shipped as an **official composition-package plugin**: no dsh product file is touched, one `dsh plugin add` installs it, and it survives dsh upgrades.

## 原理 / How it works

修的东西分两类，所以包里有两半，分界依据是**时机**而不是代码量：
Two kinds of fixes, so two halves — split by *timing*, not by size:

| 半 / Half | 时机 / When | 手段 / Mechanism |
|---|---|---|
| **Node 半** `src/index.ts` | 渲染期，必须早于应用 bundle / at render, before the app bundle | `ctx.webServer.tapIndex()` 就地改写 viewport，再用 `{kind:'style'}` / `{kind:'script', placement:'head'}` 注入行进 `<head>` / rewrite the viewport in place, then inject rows into `<head>` |
| **浏览器半** `src/client.ts` | 运行期，跟随活 DOM 反复执行 / at runtime, against the live DOM | 一个 `ctx.effect()`，`load` 后空闲帧安装，disposer 逐个回收 / one `ctx.effect()`, installed on the idle frame after `load`, fully disposed |

- 为什么不能只用 JS：viewport 和 polyfill 必须在解析期就生效，插件的 `apply()` 要等 fiber 就绪，保证不了顺序。 / Why not browser-only: viewport and polyfills must land during parsing; `apply()` runs too late to guarantee order.
- 为什么不能只用 CSS：软键盘跟随、触摸兜底、宽度量测都要读活 DOM。 / Why not CSS-only: keyboard following, touch fallbacks, and width measurement need the live DOM.
- 为什么延迟安装：装在 `load` 之后的空闲帧，不与宿主首屏挂载抢主线程（实测 2000 节点模拟启动，首屏 0 次 MutationObserver 回调）。 / Why deferred: installing on the idle frame after `load` avoids competing with first paint (measured: 0 observer callbacks during a 2000-node simulated boot).

## 做什么 / Features

**Node 半 / Node half**

| 功能 / Feature | 解决什么 / What it fixes |
|---|---|
| viewport 改写 | `viewport-fit=cover` 让内容避开刘海/挖孔，`interactive-widget=resizes-content` 让软键盘收缩内容区而不是盖住页面；就地改写已有标签，不新增重复 meta / `viewport-fit=cover` keeps content out of the notch; `interactive-widget=resizes-content` makes the IME shrink the content area instead of covering it; rewrites the existing tag, adds no duplicate |
| 移动端 CSS | 侧栏变抽屉（合成层 `transform` 滑动，不挤压正文）、safe-area 避让、作曲栏重排（权限/模型胶囊移到输入框上方、发送键固定在右下角、模型名顶到权限胶囊前才省略）、设置面板全屏、手机上的右栏（文件/终端）改全屏覆盖层开合 / drawer sidebar that overlays instead of squeezing, safe-area padding, recomposed composer, fullscreen settings, fullscreen-overlay right dock |
| 启动前 polyfill | 补 `AbortSignal.any` 和 `crypto.randomUUID`——老 WebView 或非安全上下文缺了这两个，前端直接起不来（白屏）/ polyfills for `AbortSignal.any` and `crypto.randomUUID`, without which old WebViews or non-secure origins fail to boot at all |

**浏览器半 / Browser half**

| 功能 / Feature | 解决什么 / What it fixes |
|---|---|
| 软键盘跟随 | `visualViewport` 收缩时把整页抬到键盘上方，收起后完全还原 / the page lifts above the keyboard and is fully restored when it collapses |
| 悬浮侧栏开关 | 窄屏折叠态下侧栏脱离网格流，左上角这颗按钮接住入口；位置、尺寸、边缘与页头右上角那颗入口一致 / on narrow screens the sidebar leaves the grid, so this floating button takes over the entry point, styled like the header icon |
| 触摸交互兜底 | 宿主只给了 hover 路径：点按后补发一次 `mouseover` 让提示气泡出现，点按子代理触发器后补发一次 `ArrowDown` 走宿主的键盘路径（否则同一颗按钮第二下就点不开）/ the host only wires hover paths: a synthetic `mouseover` brings tooltips back, and an `ArrowDown` opens the sub-agent menu through the host's own keyboard path |
| 作曲栏细节 | "+" 号不唤起键盘、`enterkeyhint=newline` 让安卓输入法显示"换行"、模型胶囊按权限胶囊的实测宽度决定何处省略 / "+" no longer pops the IME, `enterkeyhint=newline`, and the model pill sizes itself against the measured permission pill |
| activity 状态不占位 | 生成期间宿主把胶囊整组藏起来，胶囊带那 36px 预留一起撤掉，不留一条白带 / while generating, the reserved 36px strip goes away with the hidden pills |
| 侧栏设置入口 | 抽屉底部那颗「设置」原来是透明底、与抽屉背景同色，改成跟「新建会话」同一套（`button-elevated-fill` 底 + `.5px` 描边 + 42px 整行）/ the settings entry was transparent-on-transparent; now it uses the same fill and hairline border as "new session" |

## 安装 / Install

```sh
# 1) 直接从 GitHub 装进 web profile / install straight from GitHub into the web profile
dsh plugin --profile web add github:Xieansecn/dsh-android-ui

# 2) 验证组合层，应出现 "# == dsh-android-ui" / verify the composition layer
dsh --profile web --dump-config

# 3) 重启生效（Node 半是挂载时读进内存的，刷新页面不够）/ restart (a refresh is not enough for the Node half)
bash ~/dsh/restart_dsh_now.sh
```

`lib/` 已提交，git 安装不需要构建（官方 publish 文档：git 安装不跑 build，除非作者提供 `prepare`）。
`lib/` is committed, so a git install needs no build (per the publish docs, git installs do not run `build` unless the author ships `prepare`).

本地改动调试 / For local development, link the checkout instead：

```sh
dsh plugin --profile web add link:/path/to/dsh-android-ui
# 改完 src/ 先 npm install && npm run build
```

卸载 / Uninstall：

```sh
dsh plugin --profile web remove dsh-android-ui
```

### 可选：PWA 让出系统栏 / Optional: give the system bar back

PWA（装到桌面的那份应用）的 manifest 现在写的是 `display: fullscreen`，会把系统状态栏也吃掉、软键盘行为也不对。这一项**只能离线改**——manifest 是浏览器自己去 GET 的静态 JSON，运行期插件改不了它（`tapIndex` 只作用于 index.html）。所以留成一次性脚本，改完 `display: fullscreen → standalone`：保留系统栏，键盘行为正常。不装 PWA（只用浏览器打开）可以跳过。

The installed PWA's manifest declares `display: fullscreen`, which swallows the system status bar and breaks keyboard behavior. This can only be changed **offline**: the manifest is a static JSON the browser fetches on its own, and a runtime plugin cannot replace it (`tapIndex` only sees index.html). Hence a one-shot script that flips `display: fullscreen → standalone`. Skip it if you never install the PWA.

```sh
node scripts/manifest-standalone.mjs           # 先看要改哪个文件、改什么（dry-run）/ preview the target and change
node scripts/manifest-standalone.mjs --write   # 写入，PWA 需重新安装后生效 / write; reinstall the PWA to apply
```

## 开发 / Develop

```sh
npm install     # 唯一 devDependency：esbuild
npm run build   # src/*.ts → lib/index.js (ESM) + lib/client.js (IIFE)
npm test        # 离线冒烟 20 项，不需要 dsh 在跑 / offline smoke tests, no dsh needed
npm run check   # build + test —— 改 src/ 后的必跑门 / the only gate
```

`lib/` 已提交：客户端 bundle 必须在安装前就构建好（git 安装不会跑 build）。没有 lint / formatter / CI。
`lib/` is committed because client bundles must exist before install (git installs do not build). There is no lint, formatter, or CI.

## 目录 / Layout

```
src/index.ts         Node 半：index 注入行 + viewport tap
src/client.ts        浏览器半：运行时 DOM 效果（含完整卸载）
src/mobile-css.ts    移动端 CSS（模板字符串）
src/polyfills.ts     启动前 polyfill
lib/                 构建产物（已提交，消费者无需构建）
scripts/             可选 PWA manifest 一次性脚本
test/smoke.mjs       离线冒烟测试（20 项）
build.mjs            esbuild 构建脚本
cordis.patch.yml     组合包 patch 层（insert 一行挂进 profile）
```

## 注意 / Caveats

- **哈希类名随版本漂移**：CSS 里按 dsh `0.1.7-rc.2` 逐个核对过的哈希类名上游改版即失效，且是**静默失效**（页面正常、效果全无）。升级后跑 `npm run check` 并按 `AGENTS.md` 更新两处常量。 / Hash class names are pinned to dsh `0.1.7-rc.2` and fail *silently* on upstream changes.
- **下拉/面板定位已交回宿主**：上游改用 `createPortal` + JS 坐标 + 内联 `style`，本模块不再接管。 / Menu and panel positioning now belongs to the host.
- **"普通回车=换行"不在此包内**：需改产品包按键映射，留在 `deepseek-harness-android/setup.sh`；本模块只给 `enterkeyhint=newline`。 / Enter-to-newline lives in the other repo.
- **只对 Web profile 有意义**。 / Only meaningful for the Web profile.

## License

MIT
