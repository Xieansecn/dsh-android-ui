/**
 * 启动前 polyfill（宿主半以 `{ kind: 'script', placement: 'head' }` 行注入 index.html）。
 *
 * ⚠️ 这些 API 必须在应用 bundle 之前就位，所以不能放在浏览器半里等 Cordis 激活：
 * 官方客户端模块契约里所有 bootstrap 脚本确实先于 Vite entry 执行，但插件 apply()
 * 仍要等服务就绪；head 里的行脚本是最早、最确定的执行点。
 *
 * 移植自 deepseek-harness-android/patches/mobile.js 第 1、2 段，逐字保留语义：
 *   1) AbortSignal.any —— 老手机浏览器缺失，工作区选择等请求会直接抛错。
 *   2) crypto.randomUUID —— 只在安全上下文暴露；经局域网 HTTP 访问时缺失，
 *      getRandomValues 在非安全上下文仍可用，用它生成 RFC 4122 v4 UUID。
 */
export const PREBOOT_POLYFILLS = String.raw`(function () {
  "use strict";

  /* ---- 1) AbortSignal.any ---- */
  if (typeof AbortSignal !== "undefined" && !AbortSignal.any) {
    AbortSignal.any = function (signals) {
      var controller = new AbortController();
      var first = Array.prototype.find.call(signals, function (s) { return s.aborted; });
      if (first) { controller.abort(first.reason); return controller.signal; }
      function onAbort() {
        if (controller.signal.aborted) return;
        var aborted = Array.prototype.find.call(signals, function (s) { return s.aborted; });
        controller.abort(aborted ? aborted.reason : undefined);
      }
      Array.prototype.forEach.call(signals, function (s) {
        if (s && typeof s.addEventListener === "function") s.addEventListener("abort", onAbort, { once: true });
      });
      return controller.signal;
    };
  }

  /* ---- 2) crypto.randomUUID ---- */
  var cryptoObject = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (!cryptoObject || typeof cryptoObject.randomUUID === "function") return;
  if (typeof cryptoObject.getRandomValues !== "function") return;

  var hex = Array.from({ length: 256 }, function (_, value) {
    return value.toString(16).padStart(2, "0");
  });

  Object.defineProperty(cryptoObject, "randomUUID", {
    configurable: true,
    value: function () {
      var bytes = cryptoObject.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      return (
        hex[bytes[0]] + hex[bytes[1]] + hex[bytes[2]] + hex[bytes[3]] + "-" +
        hex[bytes[4]] + hex[bytes[5]] + "-" +
        hex[bytes[6]] + hex[bytes[7]] + "-" +
        hex[bytes[8]] + hex[bytes[9]] + "-" +
        hex[bytes[10]] + hex[bytes[11]] + hex[bytes[12]] +
        hex[bytes[13]] + hex[bytes[14]] + hex[bytes[15]]
      );
    }
  });
})();`
