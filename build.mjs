/**
 * dsh-android-ui 构建脚本（esbuild，唯一 devDependency）。
 *
 * 产出两份自包含产物：
 *   lib/index.js   —— Node 半（ESM）：订阅 webserver/index-inject + 注册 tapIndex。
 *   lib/client.js  —— 浏览器半（IIFE）：执行时向 window.__ModuleLoader__.load({id,factory})
 *                     注册工厂，DSH 客户端模块系统据此实例化插件。
 *
 * 客户端产物形状对齐官方客户端模块契约（docs/subsystems/client-modules.zh.md）：
 * 包在 package.json 声明 dsh.client.platform=web、在 exports["./client"] 导出构建好的
 * bundle，宿主侧扫描后把它排进 window.__DSH_BOOT__ 的 combo 脚本。id 必须等于包名。
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const id = pkg.name

const HOST_OPTIONS = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  outfile: 'lib/index.js',
}

const CLIENT_OPTIONS = {
  entryPoints: ['src/client.ts'],
  bundle: true,
  format: 'iife',
  globalName: '__dshAndroidUiBundle',
  platform: 'browser',
  target: 'es2020',
  outfile: 'lib/client.js',
  banner: { js: `window.__ModuleLoader__.load({id:${JSON.stringify(id)},factory:function(require){` },
  footer: { js: 'return __dshAndroidUiBundle;}});' },
}

const esbuild = (() => {
  try {
    return require('esbuild')
  } catch (error) {
    if (error?.code === 'MODULE_NOT_FOUND') {
      throw new Error('[dsh-android-ui] esbuild 是本包 devDependency，请先执行 npm install', { cause: error })
    }
    throw error
  }
})()

console.log(`[dsh-android-ui] building lib/index.js + lib/client.js (id=${id}) …`)
await esbuild.build(HOST_OPTIONS)
await esbuild.build(CLIENT_OPTIONS)
console.log('[dsh-android-ui] done')
