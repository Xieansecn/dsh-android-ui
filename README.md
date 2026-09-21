# dsh-android-ui

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 Android/移动端界面适配模块。以**官方组合包插件**形态实现——不修改任何产品文件，升级 dsh 后自动生效。

从 [deepseek-harness-android](https://github.com/FunnelCakes/deepseek-harness-android) 的 `apply-frontend.sh` 改写而来：原来的"改写 `dist/index.html` 注入 `<style>`/`<script>`"方案升级 dsh 后每次都要重跑，本模块用官方扩展点实现了同样的效果，dsh 自动加载。

## 做什么

### Node 半（index 注入，渲染期生效）

| 功能 | 机制 |
|---|---|
| **viewport** — `viewport-fit=cover`（刘海/挖孔安全区）+ `interactive-widget=resizes-content`（软键盘收缩内容区而不是覆盖页面） | `ctx.webServer.tapIndex()` 就地改写已有的 `<meta name="viewport">`，不新增重复标签 |
| **移动端 CSS** — 抽屉式侧栏、safe-area 避让、作曲栏重排（权限/模型胶囊移至输入框上方、发送键固定右下角、模型名顶到权限胶囊前才省略）、设置面板全屏、各类下拉不出屏 | `{ kind: 'style' }` 注入行 → 渲染进 `<head>` |
| **启动前 polyfill** — `AbortSignal.any`、`crypto.randomUUID`（老 WebView / 非安全上下文缺失时前端起不来） | `{ kind: 'script', placement: 'head' }` 注入行 → 解析期同步执行，早于应用 bundle |

### 浏览器半（运行时 DOM 效果，跟随活 DOM 反复执行）

| 功能 | 说明 |
|---|---|
| tooltip 气泡重吸附 | 侧栏开合/滚动后贴着锚点重新定位，超出视口收回 |
| 触摸交互 | 按下显示气泡、松手销毁；抽屉遮罩点击关闭 |
| 悬浮侧栏开关 | ≤480px 折叠态下侧栏脱离网格流，入口由左上角这颗浮层按钮承担；图标克隆宿主自己的面板图标（不是品牌鱼 logo），点击转发给宿主开关 |
| 子代理触发器点按兜底 | 宿主只有 hover 路径，触摸端点第二下打不开——补发 `ArrowDown` 走宿主键盘路径 |
| "+" 号不唤起键盘 | 捕获阶段拦下 `mousedown`，避免 React 根 refocus 拉起软键盘 |
| `enterkeyhint=newline` | 安卓输入法回车键显示"换行"（配套 `setup.sh` 里的按键映射） |
| 软键盘跟随 | `visualViewport` 收缩时把整页抬到键盘上方，收回时还原 |
| 模型胶囊宽度跟随权限胶囊 | `ResizeObserver` 量出权限胶囊宽度写进 `--dsh-modes-w`，CSS 用它算出"顶到邻居前 12px 再省略" |

### 可选脚本

| 功能 | 说明 |
|---|---|
| PWA manifest `display → standalone` | `scripts/manifest-standalone.mjs`，一次性脚本，详见下方 |

浏览器半全部效果注册在**一个** `ctx.effect()` 中，disposer 逐个回收所有副作用（rAF / MutationObserver / 监听器 / 定时器 / `html` 样式）。效果**不在首屏安装**——`apply()` 只挂一个 `load` 钩子，安装推迟到 load 后空闲帧，突变驱动的工作按帧收敛。

## 安装

```sh
# 1) 装进 profile（link 指向本目录）
dsh plugin --profile web add link:/path/to/dsh-android-ui

# 2) 验证层组合
dsh --profile web --dump-config      # 应出现一行 "# == dsh-android-ui"

# 3) 重启生效
bash ~/dsh/restart_dsh_now.sh
```

卸载：`dsh plugin --profile web remove dsh-android-ui`

可选（PWA 键盘行为，一次性）：

```sh
node scripts/manifest-standalone.mjs           # dry-run，查看目标与改动
node scripts/manifest-standalone.mjs --write   # 写入，PWA 需重新安装后生效
```

## 开发

```sh
npm install          # 唯一 devDependency：esbuild
npm run build        # src/*.ts → lib/index.js (ESM) + lib/client.js (IIFE)
npm test             # 离线冒烟 17 项，不需要启动 dsh
npm run check        # build + test（改 src/ 后必跑）
```

`lib/` 目录已提交——客户端 bundle 必须在安装前就构建好（git 安装不会跑 build）。`npm run check` 是唯一的门，没有 lint / formatter / CI。

### 测试覆盖

`npm test` 不是形状检查，是真验证：

- 用**官方 `renderIndexInjections()`** 渲染真实 index.html，断言 CSS/脚本落进 `<head>`、polyfill 早于应用 module 脚本
- 在 **`node:vm` 里真跑** polyfill：`AbortSignal.any` 传播 abort、`randomUUID` 产出 v4、已有实现不被覆盖
- 在 **`node:vm` 里按 `__ModuleLoader__` 协议装载**浏览器半：导出合法、`apply()` 装上效果、disposer 后所有 DOM 状态还原
- 用**官方 `loadOverlayPatches()`** 解析 `cordis.patch.yml`，断言组合包层正确
- **静态断言作曲栏版式**：胶囊预留高度 ≥ 28px + 间隔、底行 `flex-wrap: nowrap`、行盒 `container-type: normal`、提示词与输入框三组等式、旧重叠 hack 已删
- **静态断言悬浮开关**：克隆的是面板图标而不是品牌标记（`querySelector('svg')` 不许出现）、按浮层按钮 token 画（28×28、无描边）、`top` 与宿主展开态侧栏开关重合（`env(safe-area-inset-top) + 22px`）、`:active` 与 `:hover` 同列
- **宿主类名核对**：已过时的哈希类名（`h8S2Va` / `Md3f7G` 等）不许出现

## 目录

```
src/index.ts         Node 半：index 注入行 + viewport tap
src/client.ts        浏览器半：运行时 DOM 效果（含完整卸载）
src/mobile-css.ts    移动端 CSS（模板字符串，≤480px 媒体查询为主）
src/polyfills.ts     启动前 polyfill（AbortSignal.any + crypto.randomUUID）
lib/                 构建产物（已提交，消费者无需构建）
scripts/             可选的 PWA manifest 一次性脚本
test/smoke.mjs       离线冒烟测试（17 项）
build.mjs            esbuild 构建脚本
cordis.patch.yml     组合包 patch 层（insert 一行挂进 profile）
```

## 架构

```
Node 半 (src/index.ts)                    浏览器半 (src/client.ts)
┌─────────────────────────┐    ┌──────────────────────────────────┐
│ ctx.on('index-inject')  │    │ ctx.effect(installWhenIdle(...)) │
│   → 注入 CSS + polyfill  │    │   → tooltip 重吸附               │
│ ctx.webServer.tapIndex  │    │   → 触摸交互                      │
│   → 就地改写 viewport   │    │   → 子代理触发器兜底              │
└─────────────────────────┘    │   → + 号键盘拦截                  │
         ↓ 渲染期               │   → enterkeyhint                  │
    <head> 里同步生效            │   → 软键盘跟随                    │
                                │   → 悬浮侧栏开关                  │
                                │   → 模型胶囊宽度                  │
                                └──────────────────────────────────┘
                                          ↓ load 后空闲帧
                                     运行期按需生效
```

**分界依据是"时机"**：必须在应用 bundle 之前生效的（viewport、polyfill）走 Node 半 index 注入；必须跟随活 DOM 反复跑的（气泡定位、键盘跟随）走浏览器半 `ctx.effect`。

## 官方文档依据

- [第一个插件](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/index.zh.md) — `apply(ctx)`、`inject`、`ctx.effect` 自动清理
- [打包与安装插件](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.zh.md) — `dsh.bundle.patch`、`cordis.patch.yml`、profile 层顺序
- [Client 模块](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/client-modules.zh.md) — `dsh.client.platform: "web"`、`exports["./client"]`、bootstrap 脚本先于 Vite entry
- [扩展插件形态 cookbook](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/extension-cookbook.md) — 特性 → 扩展点对照

## 不在本模块范围内

- **作曲栏"普通回车=换行"** — 这是改 `dsh-client-ui-conversation` 的 ProseMirror 按键映射，官方无对应扩展点，留在 `deepseek-harness-android/setup.sh`。本模块的 `enterkeyhint=newline` 与它配套。
- **PWA manifest** — 浏览器独立 GET 的静态 JSON，运行期插件无法替换。保留为 `scripts/manifest-standalone.mjs` 一次性脚本。
- **竖屏布局（抽屉/面板/断点）** — 借鉴 [dsh-mobile-nav](https://github.com/FunnelCakes/dsh-web-mobile) 等其他模块，本模块只做界面适配。

## 已知限制

- **哈希类名随版本漂移** — `src/mobile-css.ts` 和 `src/client.ts` 里的 `.uV2eYG_*` / `.ZKlsPq_*` / `._bubble_1nw3t_1` 等来自 dsh `0.1.5-rc.1` 构建产物。上游重新发布同一版本也会换哈希，后果是"效果静默失效"（不报错）。升级 dsh 后需按 `AGENTS.md` 核对并更新两处常量/CSS。优先依赖 `data-*` 稳定契约。
- **子代理下拉不接管** — 上游已用 `createPortal` + JS 内联坐标定位，`!important` 会盖掉内联值。
- **只对 Web profile 有意义** — 挂在别的 profile 上不工作。

## License

MIT
