# dsh-android-ui

把 [deepseek-harness-android](https://github.com/FunnelCakes/deepseek-harness-android) 里"对 dsh 界面的改动"抽出来，按 **DeepSeek Harness 官方模块（组合包）形态**重写的一个模块。范围是整批 Android/移动端界面适配：viewport 与安全区、移动端 CSS、启动期 polyfill、软键盘跟随、触摸交互与下拉定位。

原来这些改动是 `apply-frontend.sh` 往 `dsh-web-frontend/dist/index.html` 里**改写文件**注入的 `<style>` / `<script>` + manifest 改动。升级 dsh 会重装 node_modules、覆盖 index.html，每次都要重跑；现在改成插件：宿主侧走官方的 **index 注入表 / 原始 HTML 变换**，浏览器侧走官方的**客户端模块**协议，不再碰任何产品文件。

## 它做什么

| # | 改动 | 实现位置 | 官方机制 |
|---|---|---|---|
| 1 | viewport：`viewport-fit=cover` + `interactive-widget=resizes-content`（安全区、软键盘收缩内容区而不是覆盖页面） | Node 半 | `ctx.webServer.tapIndex()` 就地改写已有 `<meta name="viewport">` |
| 2 | 移动端 CSS：抽屉式侧栏、≥44px 触控目标、safe-area 避让、作曲栏重排（权限/模型胶囊移到输入框上方独立成排、发送键固定输入框右下角）、设置面板全屏、各类下拉不出屏 | Node 半 | `{ kind: 'style' }` 注入行 → 渲染进 `<head>` |
| 3 | 启动前 polyfill：`AbortSignal.any`、`crypto.randomUUID`（局域网 HTTP / 老 WebView 缺失时前端起不来） | Node 半 | `{ kind: 'script', placement: 'head' }` 注入行 → 解析期同步执行，早于应用 bundle |
| 4 | 运行时 DOM 效果：tooltip 气泡重吸附、触摸按下显示/松手销毁气泡、抽屉遮罩点击关闭、"+"号不唤起键盘、子代理下拉吸附、`enterkeyhint=newline`、**软键盘跟随**（visualViewport） | 浏览器半 | `dsh.client` 客户端插件 + `ctx.effect()` |
| 5 | PWA manifest `display: fullscreen → standalone` | 可选脚本 | `scripts/manifest-standalone.mjs`（见下文"为什么这一项只能离线做"） |

浏览器半的每条效果都注册在**一个** `ctx.effect()` 里并在 disposer 中回收（rAF / MutationObserver / 监听器 / 定时器 / 被改写的 `html` 样式），插件停止或更新后页面回到未安装状态。

效果**不在首屏安装**：`apply()` 只挂一个 `load` 钩子，真正的安装推迟到 `load` 之后的空闲帧（`installWhenIdle`），突变驱动的工作按帧收敛（`installPerFrame`）。dsh 启动时会同时唤醒所有客户端插件，本模块把首屏那段主线程让出去——模拟 2000 节点启动：同步装要付 800 次 MutationObserver 回调 / 603 次 `querySelector` / ~40ms，延时装首屏 0 次，装上后同一批突变只 28 次查询。

## 安装

```sh
# 1) 装进 profile（pnpm 链接）——把 <path> 换成本目录绝对路径
dsh plugin --profile web add link:/path/to/dsh-android-ui

# 2) 先只验证层组合，不启动
dsh --profile web --dump-config      # 应出现一行 "# == dsh-android-ui"

# 3) 重启 web 生效
bash ~/dsh/restart_dsh_now.sh
```

卸载：`dsh plugin --profile web remove dsh-android-ui`。

可选（PWA 键盘行为，一次性）：

```sh
node scripts/manifest-standalone.mjs           # dry-run，打印目标与将做的改动
node scripts/manifest-standalone.mjs --write   # 写入；PWA 需重新安装后生效
```

## 开发

```sh
npm install          # 只装 esbuild（唯一 devDependency）
npm run build        # src/*.ts -> lib/index.js（Node ESM）+ lib/client.js（浏览器 IIFE）
npm test             # 离线冒烟：13 项，不需要启动 dsh
npm run check        # build + test
```

`npm test` 做的是真验证，不是形状检查：

- 用官方 `renderIndexInjections()` 渲染**真实 index.html**，断言 CSS 与 polyfill 落进 `<head>`、polyfill 早于应用 module 脚本；
- 在 `node:vm` 里**真跑**注入的 polyfill：`AbortSignal.any` 传播 abort、`randomUUID` 产出 RFC 4122 v4、已有实现不被覆盖；
- 在 `node:vm` 里按 `window.__ModuleLoader__` 协议**装载** `lib/client.js`：插件导出合法、`apply()` 装上全部效果、disposer 后 observer/监听器/`html` 样式全部还原；
- 用官方 `loadOverlayPatches()` 解析 `cordis.patch.yml`，断言组合包层能解析出正确的 `insert` 行；
- 静态断言作曲栏版式的尺寸契约：胶囊带预留高度 ≥ 胶囊 28px + 间隔、底行 `flex-wrap: nowrap`、行盒 `container-type: normal`、旧的重叠 hack 已删——CSS 是文本注入，离线只能到这一步，真机版式按 AGENTS.md 检查点过。

未在 CI/本机自动化的最后一步是"装进 profile 后真实打开页面"（会重启正在使用的 dsh web），请自行执行上面安装章节的 1~3 步并对照下面的检查点。

## 目录

```
src/index.ts         Node 半：index 注入行 + viewport tap
src/client.ts        浏览器半：运行时 DOM 效果（含清理）
src/mobile-css.ts    移动端 CSS 文本
src/polyfills.ts     启动前 polyfill 脚本文本
lib/                 构建产物（已提交，消费者无需构建）
scripts/             可选的 manifest 一次性脚本
test/smoke.mjs       离线冒烟测试
cordis.patch.yml     组合包 patch 层（insert 一行）
```

## 官方文档依据

- [第一个插件](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/index.zh.md) — `apply(ctx)`、`inject`、`ctx.effect` 自动清理
- [打包与安装插件](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.zh.md) — `dsh.bundle.patch`、`cordis.patch.yml`、profile 层顺序
- [Client 模块](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/client-modules.zh.md) — `dsh.client.platform: "web"`、`exports["./client"]`、`window.__DSH_BOOT__`、bootstrap 脚本先于 Vite entry
- [扩展插件形态 cookbook](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/extension-cookbook.md) — 特性 → 扩展点对照

注入行类型（`global` / `script` / `script-src` / `script-preload` / `style` / `html`）与 `tapIndex` 的"逃生口"定位，取自 `@deepseek-ai/dsh-host-webserver` 的 `renderIndexInjections` / `WebServer#tapIndex`。

## 为什么不把这些也放进模块

- **作曲栏"普通回车=换行，Ctrl/Cmd+Enter=发送"**：这是改 `dsh-client-ui-conversation` 的按键映射（ProseMirror command），官方没有对应扩展点，只能改产品包代码。它仍留在 `deepseek-harness-android/setup.sh`（4d）。本模块的 `enterkeyhint=newline` 与它配套：装了那个补丁时输入法显示"换行"，行为一致。
- **PWA manifest**：manifest 是浏览器独立 GET 的静态 JSON，运行期插件无法替浏览器换一份用于安装（index 注入与 `tapIndex` 都只作用于 index.html）。所以保留为一次性脚本，逻辑与 `apply-frontend.sh` 第 4 步一致。

## 已知限制

- **哈希类名随版本漂移**：`src/mobile-css.ts` 与 `src/client.ts` 里的 `.h8S2Va_menu` / `.uV2eYG_*` / `.VOzbGW_*` / `._7KE1Ra_*` / `._bubble_owhem_8` / `.hHd-Xa_*` / `.Md3f7G_*` 等来自 dsh `0.1.5-rc.1` 的构建产物。上游重新构建后可能改名 → 对应用户只是"效果不生效"（不会报错），需要同步更新这两个文件。稳定的 `data-*` 契约（`data-details-collapsed` / `data-sidebar-collapsed` / `data-shell-overlay` / `data-dsh-kb-open`）优先依赖。
- 只对 Web profile 有意义；行挂在别的 profile 上时什么都不做（但会白等 `webServer`，所以别那样装）。
- 与 [dsh-web-mobile](https://github.com/FunnelCakes/dsh-web-mobile)（`dsh-mobile-nav`，竖屏布局重构）职责相邻但不同：那个做**布局**（抽屉/面板/断点 1024px），本模块做**界面适配**（viewport/polyfill/键盘/触摸/下拉定位）。两者可以同时装；若都改同一元素的定位，以各自 CSS 的先后与 `!important` 为准，冲突时需要人工取舍。

## License

MIT
