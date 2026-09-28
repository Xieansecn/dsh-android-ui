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
  var BUBBLE = "._bubble_ugtpz_1";
  var SUBAGENT_TRIGGER = ".ZKlsPq_trigger, .ZKlsPq_switcherTrigger";
  var SUBAGENT_MENU = ".ZKlsPq_menu";
  var FRAME = '[class*="_frame"]';
  var COMPOSER_INPUT = ".uV2eYG_input";
  var COMPOSER_ADD = ".uV2eYG_add";
  var SIDEBAR_TOGGLE = ".hHd-Xa_toggle";
  var SIDEBAR_PANEL_ICON = ".hHd-Xa_panelIcon";
  var RIGHT_EXPAND_BUTTON = "[data-sidebar-right-expand]";
  var SESSION_ROW = '[class*="_sessionRow"]';
  var ROW_CONTROL = 'button, [role="button"], input, [class*="_rowActions"]';
  var COMPOSER_CARD = "[data-composer-card]";
  var COMPOSER_MODES = ".uV2eYG_modes";
  var MODES_W_VAR = "--dsh-modes-w";
  var FAB_ATTR = "data-dsh-nav-fab";
  var FAB_VISIBLE_ATTR = "data-dsh-nav-fab-visible";
  function installPerFrame(run) {
    let raf = 0;
    const tick = () => {
      raf = 0;
      run();
    };
    return {
      wake: () => {
        if (!raf) raf = window.requestAnimationFrame(tick);
      },
      stop: () => {
        if (raf) window.cancelAnimationFrame(raf);
        raf = 0;
      }
    };
  }
  function installWhenIdle(install) {
    let dispose = null;
    let cancelled = false;
    const start = () => {
      if (!cancelled) dispose = install();
    };
    const schedule = () => {
      if (cancelled) return;
      const idle = window.requestIdleCallback;
      if (typeof idle === "function") idle(start, { timeout: 500 });
      else start();
    };
    if (document.readyState === "interactive" || document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule);
    return () => {
      cancelled = true;
      window.removeEventListener("load", schedule);
      if (dispose) dispose();
    };
  }
  function installTouchInteractions() {
    const isTouch = "ontouchstart" in window || typeof navigator !== "undefined" && (navigator.maxTouchPoints || 0) > 0;
    let hintTimer = 0;
    let dismissTimer = 0;
    let menuTimer = 0;
    const openHintOnTap = (target) => {
      if (!target || typeof target.dispatchEvent !== "function") return;
      hintTimer = window.setTimeout(() => {
        hintTimer = 0;
        if (document.querySelector(BUBBLE)) return;
        const MouseEventCtor = window.MouseEvent;
        const event = typeof MouseEventCtor === "function" ? new MouseEventCtor("mouseover", { bubbles: true, cancelable: true, view: window }) : new Event("mouseover", { bubbles: true });
        target.dispatchEvent(event);
      }, 250);
    };
    const onTouchEnd = (event) => {
      if (!isTouch) return;
      openHintOnTap(event.target);
    };
    const openSubagentMenuOnTap = (event) => {
      if (!isTouch) return;
      const target = event.target;
      if (!target || typeof target.closest !== "function") return;
      const trigger = target.closest(SUBAGENT_TRIGGER);
      if (!trigger) return;
      menuTimer = window.setTimeout(() => {
        menuTimer = 0;
        if (document.querySelector(SUBAGENT_MENU)) return;
        trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      }, 250);
    };
    const onDocumentClick = (event) => {
      openSubagentMenuOnTap(event);
      const target = event.target;
      if (!target || target.nodeType !== 1 || typeof target.closest !== "function") return;
      const row = target.closest(SESSION_ROW);
      const onRowControl = !!row && !!target.closest(ROW_CONTROL);
      if (!target.hasAttribute("data-shell-overlay") && !(row && !onRowControl)) return;
      const frame = target.closest(FRAME);
      if (!frame || frame.hasAttribute("data-sidebar-collapsed")) return;
      dismissTimer = window.setTimeout(() => {
        dismissTimer = 0;
        if (frame.hasAttribute("data-sidebar-collapsed")) return;
        const toggle = document.querySelector(SIDEBAR_TOGGLE);
        if (toggle) toggle.click();
      }, 0);
    };
    document.addEventListener("touchend", onTouchEnd, true);
    document.addEventListener("click", onDocumentClick, true);
    return () => {
      if (hintTimer) window.clearTimeout(hintTimer);
      if (dismissTimer) window.clearTimeout(dismissTimer);
      if (menuTimer) window.clearTimeout(menuTimer);
      document.removeEventListener("touchend", onTouchEnd, true);
      document.removeEventListener("click", onDocumentClick, true);
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
  function installEnterKeyHint() {
    const applyHint = () => {
      const el = document.querySelector(COMPOSER_INPUT);
      if (el && !el.hasAttribute("enterkeyhint")) el.setAttribute("enterkeyhint", "newline");
    };
    applyHint();
    const frame = installPerFrame(applyHint);
    const observer = new MutationObserver(frame.wake);
    try {
      observer.observe(document.documentElement, { childList: true, subtree: true });
    } catch {
    }
    return () => {
      observer.disconnect();
      frame.stop();
    };
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
    let toggle = null;
    let frame = null;
    const find = (cached, selector) => {
      if (cached && cached.isConnected) return cached;
      return document.querySelector(selector);
    };
    const sync = () => {
      toggle = find(toggle, SIDEBAR_TOGGLE);
      frame = find(frame, FRAME);
      const show = !!mobile && mobile.matches && !!toggle && !!frame && frame.hasAttribute("data-sidebar-collapsed");
      if (!show) {
        fab.removeAttribute(FAB_VISIBLE_ATTR);
        return;
      }
      if (fab.childNodes.length === 0) {
        const icon = toggle.querySelector(SIDEBAR_PANEL_ICON) || document.querySelector(`${RIGHT_EXPAND_BUTTON} svg`);
        if (!icon) return;
        const clone = icon.cloneNode(true);
        if (clone && typeof clone.removeAttribute === "function") clone.removeAttribute("class");
        fab.append(clone);
      }
      fab.setAttribute(FAB_VISIBLE_ATTR, "");
    };
    const openDrawer = () => {
      toggle = find(toggle, SIDEBAR_TOGGLE);
      if (toggle) toggle.click();
    };
    fab.addEventListener("click", openDrawer);
    document.body.append(fab);
    const frameTask = installPerFrame(sync);
    const observer = new MutationObserver(frameTask.wake);
    try {
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-sidebar-collapsed"]
      });
    } catch {
    }
    window.addEventListener("resize", frameTask.wake);
    if (mobile && typeof mobile.addEventListener === "function") mobile.addEventListener("change", frameTask.wake);
    sync();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", frameTask.wake);
      if (mobile && typeof mobile.removeEventListener === "function") mobile.removeEventListener("change", frameTask.wake);
      fab.removeEventListener("click", openDrawer);
      frameTask.stop();
      fab.remove();
    };
  }
  function installModelPillWidth() {
    if (typeof ResizeObserver !== "function") return () => {
    };
    let card = null;
    let modes = null;
    let raf = 0;
    const observer = new ResizeObserver(() => sync());
    const sync = () => {
      const nextCard = card && card.isConnected ? card : document.querySelector(COMPOSER_CARD);
      if (!nextCard) return;
      const nextModes = modes && modes.isConnected ? modes : document.querySelector(COMPOSER_MODES);
      if (nextModes !== modes) {
        if (modes) observer.unobserve(modes);
        modes = nextModes;
        if (modes) observer.observe(modes);
      }
      card = nextCard;
      const width = modes && typeof modes.getBoundingClientRect === "function" ? modes.getBoundingClientRect().width : 0;
      const next = `${width}px`;
      if (card.style.getPropertyValue(MODES_W_VAR) !== next) card.style.setProperty(MODES_W_VAR, next);
    };
    const wake = () => {
      if (!raf) raf = window.requestAnimationFrame(() => {
        raf = 0;
        sync();
      });
    };
    window.addEventListener("resize", wake);
    document.addEventListener("focusin", wake, true);
    sync();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", wake);
      document.removeEventListener("focusin", wake, true);
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      if (card) card.style.removeProperty(MODES_W_VAR);
    };
  }
  var installers = [
    installTouchInteractions,
    installAddButtonKeyboardGuard,
    installEnterKeyHint,
    installKeyboardFollow,
    installSidebarFab,
    installModelPillWidth
  ];
  function apply(ctx) {
    ctx.effect(
      () => installWhenIdle(() => {
        const disposers = installers.map((install) => install());
        return () => {
          for (const dispose of disposers) dispose();
        };
      }),
      "dsh-android-ui: mobile DOM effects"
    );
  }
  return __toCommonJS(client_exports);
})();
return __dshAndroidUiBundle;}});
