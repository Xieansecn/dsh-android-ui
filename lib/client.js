window.__ModuleLoader__.load({id:"dsh-android-ui",factory:function(require){
var __dshAndroidUiBundle = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name2 in all)
      __defProp(target, name2, { get: all[name2], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/client.ts
  var client_exports = {};
  __export(client_exports, {
    apply: () => apply,
    inject: () => inject,
    installers: () => installers,
    name: () => name
  });
  var name = "dsh-android-ui";
  var inject = [];
  var BUBBLE = "._bubble_owhem_8";
  var SUBAGENT_MENU = ".h8S2Va_menu";
  var COMPOSER_INPUT = ".uV2eYG_input";
  var COMPOSER_ADD = ".uV2eYG_add";
  var SIDEBAR_TOGGLE = ".hHd-Xa_toggle";
  var SESSION_ROW = '[class*="_sessionRow"]';
  var ROW_CONTROL = 'button, [role="button"], input, [class*="_rowActions"]';
  var FAB_ATTR = "data-dsh-nav-fab";
  var FAB_VISIBLE_ATTR = "data-dsh-nav-fab-visible";
  function isVisible(el) {
    if (!el || el.getClientRects().length === 0) return false;
    const cs = window.getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden" && cs.opacity !== "0";
  }
  function clampToViewport(left, top, width, height, margin) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let l = left;
    let t = top;
    if (l + width > vw - margin) l = vw - margin - width;
    if (l < margin) l = margin;
    if (t + height > vh - margin) t = vh - margin - height;
    if (t < margin) t = margin;
    return { left: l, top: t };
  }
  function installFrameTask(selector, place) {
    let raf = 0;
    const tick = () => {
      raf = 0;
      let alive = false;
      const nodes = document.querySelectorAll(selector);
      for (let i = 0; i < nodes.length; i += 1) {
        if (!isVisible(nodes[i])) continue;
        alive = true;
        place(nodes[i]);
      }
      if (alive) raf = window.requestAnimationFrame(tick);
    };
    const wake = () => {
      if (!raf) raf = window.requestAnimationFrame(tick);
    };
    const observer = new MutationObserver(wake);
    try {
      observer.observe(document.documentElement, { childList: true, subtree: true });
    } catch {
    }
    window.addEventListener("resize", wake);
    window.addEventListener("scroll", wake, true);
    wake();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", wake);
      window.removeEventListener("scroll", wake, true);
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
    };
  }
  function installTooltipReanchor() {
    const GAP = 8;
    const MARGIN = 12;
    return installFrameTask(BUBBLE, (bubble) => {
      const anchor = bubble.previousElementSibling;
      if (!anchor) return;
      const a = anchor.getBoundingClientRect();
      if (a.width === 0 && a.height === 0) return;
      const b = bubble.getBoundingClientRect();
      const side = bubble.getAttribute("data-side") || "right";
      let left;
      let top;
      if (side === "right") {
        left = a.right + GAP;
        top = a.top + (a.height - b.height) / 2;
      } else if (side === "top") {
        left = a.left + (a.width - b.width) / 2;
        top = a.top - b.height - GAP;
      } else if (side === "bottom") {
        left = a.left + (a.width - b.width) / 2;
        top = a.bottom + GAP;
      } else {
        left = a.left + (a.width - b.width) / 2;
        top = a.top + (a.height - b.height) / 2;
      }
      const placed = clampToViewport(left, top, b.width, b.height, MARGIN);
      bubble.style.left = `${placed.left}px`;
      bubble.style.top = `${placed.top}px`;
    });
  }
  function installTouchInteractions() {
    let hideTimer = 0;
    let dismissTimer = 0;
    const wakeAnchor = () => {
      window.dispatchEvent(new Event("resize"));
    };
    const showTouchedBubble = (event) => {
      let el = event.target;
      while (el && el.nodeType === 1) {
        const sibling = el.nextElementSibling;
        if (sibling && sibling.classList && sibling.classList.contains(BUBBLE.slice(1))) {
          if (sibling.style.display === "none") sibling.style.display = "";
          wakeAnchor();
          return;
        }
        el = el.parentElement;
      }
    };
    const hideBubbles = () => {
      const nodes = document.querySelectorAll(BUBBLE);
      for (let i = 0; i < nodes.length; i += 1) nodes[i].style.display = "none";
    };
    const onTouchEnd = () => {
      hideTimer = window.setTimeout(hideBubbles, 120);
    };
    const onBackdropClick = (event) => {
      const target = event.target;
      if (!target || target.nodeType !== 1 || typeof target.closest !== "function") return;
      const row = target.closest(SESSION_ROW);
      const onRowControl = !!row && !!target.closest(ROW_CONTROL);
      if (!target.hasAttribute("data-shell-overlay") && !(row && !onRowControl)) return;
      const frame = target.closest('[class*="_frame"]');
      if (!frame || frame.hasAttribute("data-sidebar-collapsed")) return;
      dismissTimer = window.setTimeout(() => {
        dismissTimer = 0;
        if (frame.hasAttribute("data-sidebar-collapsed")) return;
        const toggle = document.querySelector(SIDEBAR_TOGGLE);
        if (toggle) toggle.click();
      }, 0);
    };
    document.addEventListener("touchstart", showTouchedBubble, true);
    document.addEventListener("touchend", onTouchEnd, true);
    document.addEventListener("click", onBackdropClick, true);
    return () => {
      if (hideTimer) window.clearTimeout(hideTimer);
      if (dismissTimer) window.clearTimeout(dismissTimer);
      document.removeEventListener("touchstart", showTouchedBubble, true);
      document.removeEventListener("touchend", onTouchEnd, true);
      document.removeEventListener("click", onBackdropClick, true);
    };
  }
  function installAddButtonKeyboardGuard() {
    const isTouch = "ontouchstart" in window || typeof navigator !== "undefined" && (navigator.maxTouchPoints || 0) > 0;
    if (!isTouch) return () => {
    };
    const onMouseDown = (event) => {
      const target = event.target;
      if (target && typeof target.closest === "function" && target.closest(COMPOSER_ADD)) {
        event.stopPropagation();
        event.preventDefault();
      }
    };
    document.addEventListener("mousedown", onMouseDown, true);
    return () => document.removeEventListener("mousedown", onMouseDown, true);
  }
  function installSubagentMenuReanchor() {
    const GAP = 5;
    const MARGIN = 12;
    return installFrameTask(SUBAGENT_MENU, (menu) => {
      const root = menu.parentElement;
      if (!root) return;
      const r = root.getBoundingClientRect();
      const m = menu.getBoundingClientRect();
      if (m.width === 0 && m.height === 0) return;
      const placed = clampToViewport(r.left, r.bottom + GAP, m.width, m.height, MARGIN);
      const prevLeft = menu.style.left;
      const prevTop = menu.style.top;
      const prevTransform = menu.style.transform;
      menu.style.left = "0px";
      menu.style.top = "0px";
      menu.style.transform = "none";
      const base = menu.getBoundingClientRect();
      menu.style.left = prevLeft;
      menu.style.top = prevTop;
      menu.style.transform = prevTransform;
      menu.style.left = `${placed.left - base.left}px`;
      menu.style.top = `${placed.top - base.top}px`;
    });
  }
  function installEnterKeyHint() {
    const applyHint = () => {
      const el = document.querySelector(COMPOSER_INPUT);
      if (el && !el.hasAttribute("enterkeyhint")) el.setAttribute("enterkeyhint", "newline");
    };
    applyHint();
    const observer = new MutationObserver(applyHint);
    try {
      observer.observe(document.documentElement, { childList: true, subtree: true });
    } catch {
    }
    return () => observer.disconnect();
  }
  function installKeyboardFollow() {
    const vv = window.visualViewport;
    if (!vv) return () => {
    };
    const KB_MIN = 80;
    let raf = 0;
    let current = 0;
    const html = document.documentElement;
    const sync = () => {
      raf = 0;
      const kb = Math.max(0, window.innerHeight - vv.height);
      if (Math.abs(kb - current) < 2) return;
      current = kb;
      if (kb >= KB_MIN) {
        html.style.height = `${vv.height}px`;
        html.setAttribute("data-dsh-kb-open", "1");
        html.style.setProperty("--dsh-kb", `${kb}px`);
        try {
          window.scrollTo(0, 0);
        } catch {
        }
      } else {
        html.style.height = "";
        html.removeAttribute("data-dsh-kb-open");
        html.style.removeProperty("--dsh-kb");
      }
    };
    const schedule = () => {
      if (!raf) raf = window.requestAnimationFrame(sync);
    };
    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    sync();
    return () => {
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      html.style.height = "";
      html.removeAttribute("data-dsh-kb-open");
      html.style.removeProperty("--dsh-kb");
    };
  }
  function installSidebarFab() {
    const mobile = typeof window.matchMedia === "function" ? window.matchMedia("(max-width: 480px)") : null;
    const rootStyle = typeof window.getComputedStyle === "function" ? window.getComputedStyle(document.documentElement) : null;
    const cssReady = !!rootStyle && typeof rootStyle.getPropertyValue === "function" && rootStyle.getPropertyValue("--dsh-android-ui-css").trim() === "1";
    if (!cssReady) return () => {
    };
    const fab = document.createElement("button");
    fab.type = "button";
    fab.setAttribute(FAB_ATTR, "");
    fab.setAttribute("aria-label", "\u6253\u5F00\u4FA7\u8FB9\u680F");
    const sync = () => {
      const host = document.querySelector(SIDEBAR_TOGGLE);
      const frame = document.querySelector('[class*="_frame"]');
      const show = !!mobile && mobile.matches && !!host && !!frame && frame.hasAttribute("data-sidebar-collapsed");
      if (!show) {
        fab.removeAttribute(FAB_VISIBLE_ATTR);
        return;
      }
      if (fab.childNodes.length === 0) {
        const icon = host.querySelector("svg");
        if (!icon) return;
        fab.append(icon.cloneNode(true));
      }
      fab.setAttribute(FAB_VISIBLE_ATTR, "");
    };
    const openDrawer = () => {
      const host = document.querySelector(SIDEBAR_TOGGLE);
      if (host) host.click();
    };
    fab.addEventListener("click", openDrawer);
    document.body.append(fab);
    const observer = new MutationObserver(sync);
    try {
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-sidebar-collapsed"]
      });
    } catch {
    }
    window.addEventListener("resize", sync);
    if (mobile && typeof mobile.addEventListener === "function") mobile.addEventListener("change", sync);
    sync();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", sync);
      if (mobile && typeof mobile.removeEventListener === "function") mobile.removeEventListener("change", sync);
      fab.removeEventListener("click", openDrawer);
      fab.remove();
    };
  }
  var installers = [
    installTooltipReanchor,
    installTouchInteractions,
    installAddButtonKeyboardGuard,
    installSubagentMenuReanchor,
    installEnterKeyHint,
    installKeyboardFollow,
    installSidebarFab
  ];
  function apply(ctx) {
    ctx.effect(() => {
      const disposers = installers.map((install) => install());
      return () => {
        for (const dispose of disposers) dispose();
      };
    }, "dsh-android-ui: mobile DOM effects");
  }
  return __toCommonJS(client_exports);
})();
return __dshAndroidUiBundle;}});
