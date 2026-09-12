#!/usr/bin/env node
/**
 * PWA manifest 的 display 改成 standalone（可选、一次性、默认 dry-run）。
 *
 * 为什么只能离线做：manifest 是浏览器独立 GET 的静态 JSON，运行期插件改不了它
 * （前端 JS 无法替浏览器重新取一份 manifest 用于安装）。index 注入和 tapIndex 也
 * 只作用于 index.html。所以这一项保留为"安装后执行一次"的脚本，行为与
 * deepseek-harness-android/apply-frontend.sh 第 4 步一致：把 fullscreen 改成
 * standalone，让 PWA 保留系统栏、软键盘行为正常。
 *
 * 用法：
 *   node scripts/manifest-standalone.mjs                 # 自动定位（npm root -g），dry-run
 *   node scripts/manifest-standalone.mjs --write         # 真正写入
 *   node scripts/manifest-standalone.mjs --manifest /path/to/manifest.webmanifest --write
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const args = process.argv.slice(2)
const write = args.includes('--write')
const explicit = args.indexOf('--manifest')

function candidates() {
  const list = []
  if (explicit !== -1 && args[explicit + 1]) list.push(args[explicit + 1])
  try {
    const npmRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()
    list.push(
      join(npmRoot, '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-web-frontend', 'dist', 'manifest.webmanifest'),
    )
  } catch {
    /* npm 不可用时只认显式路径 */
  }
  return list
}

const target = candidates().find((path) => path && existsSync(path))
if (!target) {
  console.error('[manifest-standalone] 未找到 manifest.webmanifest，请用 --manifest <path> 指定')
  process.exit(1)
}

const raw = readFileSync(target, 'utf8')
const manifest = JSON.parse(raw)
const current = manifest.display
if (current === 'standalone') {
  console.log(`[manifest-standalone] 已是 standalone，无需改动：${target}`)
  process.exit(0)
}
manifest.display = 'standalone'
const next = `${JSON.stringify(manifest, null, 2)}\n`
console.log(`[manifest-standalone] display: ${current ?? '(未设置)'} -> standalone`)
console.log(`[manifest-standalone] 目标：${target}`)
if (!write) {
  console.log('[manifest-standalone] dry-run，未写入。确认后加 --write 执行。')
  process.exit(0)
}
writeFileSync(target, next)
console.log('[manifest-standalone] 已写入。PWA 需重新安装（或清理站点数据）后生效。')
