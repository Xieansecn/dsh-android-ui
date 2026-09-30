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
  var BUBBLE = "._bubble_12mhf_1";
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
  var RAIL_FRAME = ".eGxaPq_frame";
  var RAIL_SCROLLER = ".eGxaPq_scroller";
  var RAIL_MARKS = ".eGxaPq_marks";
  var RAIL_MARK = ".eGxaPq_mark";
  var TRANSCRIPT_SCROLL = '[data-conversation-scroll], [class*="_scrollBody"]';
  var TRANSCRIPT_TURN = "data-chat-turn";
  var RAIL_TARGET = "data-dsh-rail-target";
  var RAIL_REVEALED = "data-dsh-rail-revealed";
  var RAIL_DRAGGING = "data-dsh-rail-dragging";
  var RAIL_ROOT = "data-dsh-rail";
  var RAIL_LINES = "data-dsh-rail-lines";
  var RAIL_NUM = "data-dsh-rail-num";
  var RAIL_POS = "data-dsh-rail-pos";
  var RAIL_EDGE = "data-dsh-rail-edge";
  var RAIL_TOP_VAR = "--dsh-rail-top";
  var RAIL_H_VAR = "--dsh-rail-h";
  var RAIL_LINGER_MS = 750;
  var RAIL_DRAG_Y = 4;
  var RAIL_TICK_MIN_PITCH = 11;
  var RAIL_TICK_MAX = 39;
  var RAIL_TICK_BASE_W = 9;
  var RAIL_TICK_GROW_W = 24;
  var RAIL_GRIP_SPAN = 4;
  var RAIL_CARD_Y_VAR = "--dsh-rail-card-y";
  var RAIL_ANCHOR_TOP = 24;
  var RAIL_ANCHOR_MAX = 100;
  var RAIL_ANCHOR_RATIO = 0.16;
  var RAIL_ANCHOR_HOLD_MS = 430;
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
  function installTurnRailScrub() {
    const isTouch = "ontouchstart" in window || typeof navigator !== "undefined" && (navigator.maxTouchPoints || 0) > 0;
    if (!isTouch || typeof window.matchMedia !== "function") return () => {
    };
    const mobile = window.matchMedia("(max-width: 480px)");
    const rootStyle = typeof window.getComputedStyle === "function" ? window.getComputedStyle(document.documentElement) : null;
    const cssReady = !!rootStyle && typeof rootStyle.getPropertyValue === "function" && rootStyle.getPropertyValue("--dsh-android-ui-css").trim() === "1";
    if (!cssReady) return () => {
    };
    const doc = document.documentElement;
    let hideTimer = 0;
    let raf = 0;
    let pointer = null;
    let startY = 0;
    let active = false;
    let index = -1;
    let total = 0;
    let pitch = 10;
    let padStart = 1;
    let gripMark = null;
    let selectedNode = null;
    let lastProgress = 0;
    let targetRow = null;
    let aligned = false;
    let anchorFrame = 0;
    let anchorUntil = 0;
    let tapTarget = -1;
    let anchorBase = RAIL_ANCHOR_TOP;
    let anchorRatio = RAIL_ANCHOR_RATIO;
    let anchorStyleBox = null;
    let anchorStylePrev = "";
    const ticks = [];
    const turnIndex = /* @__PURE__ */ new Map();
    let readerFrame = 0;
    let frame = null;
    let scroller = null;
    let marks = null;
    let transcript = null;
    const find = (cached, selector) => cached && cached.isConnected ? cached : document.querySelector(selector);
    const root = document.createElement("div");
    root.setAttribute(RAIL_ROOT, "");
    root.setAttribute("aria-hidden", "true");
    const lines = document.createElement("div");
    lines.setAttribute(RAIL_LINES, "");
    const numFirst = document.createElement("span");
    numFirst.setAttribute(RAIL_NUM, "first");
    numFirst.textContent = "01";
    const numLast = document.createElement("span");
    numLast.setAttribute(RAIL_NUM, "last");
    const position = document.createElement("span");
    position.setAttribute(RAIL_POS, "");
    root.append(lines);
    root.append(numFirst);
    root.append(numLast);
    root.append(position);
    const edge = document.createElement("div");
    edge.setAttribute(RAIL_EDGE, "");
    edge.setAttribute("role", "slider");
    edge.setAttribute("tabindex", "0");
    edge.setAttribute("aria-orientation", "vertical");
    edge.setAttribute("aria-valuemin", "1");
    edge.setAttribute("aria-label", "\u5BF9\u8BDD\u7D22\u5F15\uFF1A\u4E0A\u4E0B\u6ED1\u52A8\u5B9A\u4F4D\u8F6E\u6B21");
    const setVar = (name2, value) => {
      const style = root.style;
      if (style && typeof style.setProperty === "function") style.setProperty(name2, value);
    };
    const sync = () => {
      frame = find(frame, RAIL_FRAME);
      if (!frame || typeof frame.getBoundingClientRect !== "function") return false;
      const rect = frame.getBoundingClientRect();
      if (!(rect.height > 0)) return false;
      setVar(RAIL_TOP_VAR, `${rect.top}px`);
      setVar(RAIL_H_VAR, `${rect.height}px`);
      return true;
    };
    const markPitch = () => {
      const kids = marks && marks.children;
      if (!kids || kids.length < 2) return 10;
      const first = kids[0];
      const last = kids[kids.length - 1];
      const from = Number(first.getAttribute("data-index"));
      const to = Number(last.getAttribute("data-index"));
      if (!Number.isFinite(from) || !Number.isFinite(to) || to === from) return 10;
      const gap = (last.getBoundingClientRect().top - first.getBoundingClientRect().top) / (to - from);
      return gap > 0 ? gap : 10;
    };
    const measureScale = () => {
      if (!scroller || !marks) return false;
      const kids = marks.children;
      if (!kids || kids.length === 0) return false;
      const first = kids[0];
      const from = Number(first.getAttribute("data-index"));
      if (!Number.isFinite(from)) return false;
      if (typeof scroller.getBoundingClientRect !== "function" || typeof first.getBoundingClientRect !== "function") return false;
      pitch = markPitch();
      padStart = first.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - from * pitch;
      const mountedMax = Number(kids[kids.length - 1].getAttribute("data-index")) + 1;
      let size = 0;
      const marksStyle = marks.style;
      if (marksStyle && typeof marksStyle.height === "string") size = parseFloat(marksStyle.height);
      if (!(size > 0)) size = scroller.scrollHeight;
      let derived = Math.round((size - 2 * padStart) / pitch);
      if (!Number.isFinite(derived) || derived < 2) derived = 0;
      total = Math.max(derived, Number.isFinite(mountedMax) ? mountedMax : 0);
      return total >= 2;
    };
    const rebuildTicks = () => {
      if (typeof lines.getBoundingClientRect !== "function") return;
      const height = lines.getBoundingClientRect().height;
      if (!(height > 0)) return;
      let count = Math.max(2, Math.min(RAIL_TICK_MAX, Math.floor(height / RAIL_TICK_MIN_PITCH) + 1));
      if (total > 1) count = Math.min(count, total);
      while (ticks.length > count) {
        const extra = ticks.pop();
        if (extra && typeof extra.remove === "function") extra.remove();
      }
      while (ticks.length < count) {
        const tick = document.createElement("i");
        lines.append(tick);
        ticks.push(tick);
      }
      numLast.textContent = total > 0 ? String(total) : "";
    };
    const paint = (progress) => {
      const count = ticks.length;
      if (count > 0) {
        const selected = progress * (count - 1);
        for (let i = 0; i < count; i += 1) {
          const style = ticks[i].style;
          if (!style) continue;
          const dist = Math.abs(i - selected);
          const strength = Math.max(0, 1 - dist / RAIL_GRIP_SPAN);
          style.width = `${RAIL_TICK_BASE_W + RAIL_TICK_GROW_W * strength * strength}px`;
          style.opacity = String(0.35 + 0.65 * strength);
          style.background = dist < 0.55 ? "var(--dsw-alias-label-primary, #333)" : "var(--dsw-alias-label-tertiary, #909090)";
        }
      }
      if (typeof lines.getBoundingClientRect === "function") {
        const y = 18 + progress * lines.getBoundingClientRect().height;
        position.style.top = `${y}px`;
        const style = doc.style;
        if (style && typeof style.setProperty === "function") style.setProperty(RAIL_CARD_Y_VAR, `${y}px`);
      }
    };
    const readout = (selected, node) => {
      const turn = node ? turnNumber(node) : selected + 1;
      position.textContent = selected >= 0 ? String(turn).padStart(2, "0") : "";
      edge.setAttribute("aria-valuenow", String(turn));
      edge.setAttribute("aria-valuemax", total > 0 ? String(total) : "");
      edge.setAttribute("aria-valuetext", `\u7B2C ${turn} \u8F6E`);
    };
    const refreshTurnIndex = () => {
      const kids = marks && marks.children;
      if (!kids) return;
      for (let i = 0; i < kids.length; i += 1) {
        const node = kids[i];
        const at = Number(typeof node.getAttribute === "function" ? node.getAttribute("data-index") : NaN);
        if (Number.isFinite(at)) turnIndex.set(turnNumber(node), at);
      }
    };
    const followReader = () => {
      const box = find(transcript, TRANSCRIPT_SCROLL);
      if (!box || !scroller || !marks || total < 2) return;
      if (typeof box.querySelectorAll !== "function" || typeof box.getBoundingClientRect !== "function") return;
      const rows = box.querySelectorAll(`[${TRANSCRIPT_TURN}]`);
      if (!rows || rows.length === 0) return;
      const view = typeof box.clientHeight === "number" ? box.clientHeight : 0;
      const probe = box.scrollTop + view * 0.28;
      const origin = box.getBoundingClientRect().top;
      const contentTop = (i) => {
        const row2 = rows[i];
        if (!row2 || typeof row2.getBoundingClientRect !== "function") return -Infinity;
        return row2.getBoundingClientRect().top - origin + box.scrollTop;
      };
      let lo = 0;
      let hi = rows.length - 1;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (contentTop(mid) <= probe) lo = mid;
        else hi = mid - 1;
      }
      const row = rows[lo];
      const raw = typeof row?.getAttribute === "function" ? row.getAttribute(TRANSCRIPT_TURN) : null;
      const turn = Number(raw);
      if (!Number.isFinite(turn)) return;
      let found = turnIndex.get(turn);
      if (found === void 0) {
        refreshTurnIndex();
        found = turnIndex.get(turn);
      }
      if (found === void 0) return;
      const progress = total > 1 ? Math.max(0, Math.min(1, found / (total - 1))) : 0;
      lastProgress = progress;
      index = found;
      paint(progress);
      const node = typeof marks.querySelector === "function" ? marks.querySelector(`${RAIL_MARK}[data-index="${found}"]`) : null;
      readout(found, node);
    };
    const scheduleReaderFollow = () => {
      if (readerFrame) return;
      readerFrame = window.requestAnimationFrame(() => {
        readerFrame = 0;
        followReader();
      });
    };
    const commitIndex = () => {
      if (index < 0 || !marks || typeof marks.querySelector !== "function") return;
      const mark = marks.querySelector(`${RAIL_MARK}[data-index="${index}"]`);
      if (mark && typeof mark.click === "function") mark.click();
      else commitLater();
    };
    const preview = (node) => {
      if (!node || node === gripMark || typeof node.dispatchEvent !== "function") return;
      gripMark = node;
      const Ctor = window.PointerEvent;
      const event = typeof Ctor === "function" ? new Ctor("pointermove", { bubbles: true, cancelable: true, view: window }) : new Event("pointermove", { bubbles: true });
      node.dispatchEvent(event);
    };
    const clearPreview = () => {
      const node = gripMark;
      gripMark = null;
      if (!node || typeof node.dispatchEvent !== "function") return;
      node.dispatchEvent(new Event("pointerout", { bubbles: true }));
    };
    const turnNumber = (node) => {
      if (!node || typeof node.getAttribute !== "function") return 0;
      const label = node.getAttribute("aria-label");
      if (typeof label === "string") {
        const found = label.match(/\d+/);
        if (found) return Number(found[0]);
      }
      const at = Number(node.getAttribute("data-index"));
      return Number.isFinite(at) ? at + 1 : 0;
    };
    const rowOf = (box, node) => {
      const turn = turnNumber(node);
      if (!(turn > 0)) return null;
      const scope = box && typeof box.querySelector === "function" ? box : document;
      if (!scope || typeof scope.querySelector !== "function") return null;
      return scope.querySelector(`[${TRANSCRIPT_TURN}="${turn}"]`);
    };
    const markTarget = (row) => {
      if (row === targetRow) return;
      const previous = targetRow;
      targetRow = row;
      if (previous && typeof previous.removeAttribute === "function") previous.removeAttribute(RAIL_TARGET);
      if (row && typeof row.setAttribute === "function") row.setAttribute(RAIL_TARGET, "");
    };
    const alignTranscript = (progress, node) => {
      const box = find(transcript, TRANSCRIPT_SCROLL);
      if (!box || typeof box.getBoundingClientRect !== "function" || typeof box.scrollTop !== "number") return;
      const row = rowOf(box, node);
      if (!row || typeof row.getBoundingClientRect !== "function") return;
      markTarget(row);
      if (typeof node.getAttribute === "function" && node.getAttribute("aria-busy") === "true") return;
      aligned = true;
      const view = typeof box.clientHeight === "number" ? box.clientHeight : 0;
      const anchor = anchorBase + progress * Math.min(RAIL_ANCHOR_MAX, view * anchorRatio);
      const top = row.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
      const next = Math.max(0, top - anchor);
      if (Math.abs(next - box.scrollTop) > 1) box.scrollTop = next;
    };
    const holdTick = () => {
      anchorFrame = 0;
      if (!active && Date.now() >= anchorUntil) return;
      if (selectedNode) alignTranscript(lastProgress, selectedNode);
      if (active || Date.now() < anchorUntil) anchorFrame = window.requestAnimationFrame(holdTick);
    };
    const clearCardY = () => {
      const style = doc.style;
      if (style && typeof style.removeProperty === "function") style.removeProperty(RAIL_CARD_Y_VAR);
    };
    const setOverflowAnchor = (on) => {
      const box = find(transcript, TRANSCRIPT_SCROLL);
      if (!box || !box.style) return;
      if (on) {
        if (anchorStyleBox !== box) {
          anchorStyleBox = box;
          anchorStylePrev = typeof box.style.overflowAnchor === "string" ? box.style.overflowAnchor : "";
        }
        box.style.overflowAnchor = "none";
        return;
      }
      if (anchorStyleBox && anchorStyleBox.style) anchorStyleBox.style.overflowAnchor = anchorStylePrev;
      anchorStyleBox = null;
      anchorStylePrev = "";
    };
    const holdAnchor = (ms = RAIL_ANCHOR_HOLD_MS) => {
      anchorUntil = Date.now() + ms;
      if (!anchorFrame) anchorFrame = window.requestAnimationFrame(holdTick);
    };
    const releaseAnchor = () => {
      anchorUntil = 0;
      if (anchorFrame) window.cancelAnimationFrame(anchorFrame);
      anchorFrame = 0;
    };
    const applyIndex = (i) => {
      if (!scroller || !marks || total < 2) return;
      index = Math.max(0, Math.min(total - 1, i));
      const target = padStart + index * pitch;
      const view = typeof scroller.clientHeight === "number" ? scroller.clientHeight : 0;
      const max = Math.max(0, scroller.scrollHeight - view);
      if (typeof scroller.scrollTop === "number") scroller.scrollTop = Math.max(0, Math.min(max, target - view / 2));
      const node = typeof marks.querySelector === "function" ? marks.querySelector(`${RAIL_MARK}[data-index="${index}"]`) : null;
      const progress = total > 1 ? index / (total - 1) : 0;
      lastProgress = progress;
      selectedNode = node;
      if (node) preview(node);
      paint(progress);
      if (node) alignTranscript(progress, node);
      readout(index, node);
    };
    const prepare = () => {
      if (!sync()) return false;
      scroller = find(scroller, RAIL_SCROLLER);
      marks = find(marks, RAIL_MARKS);
      if (!scroller || !marks) return false;
      if (!measureScale()) return false;
      refreshTurnIndex();
      rebuildTicks();
      return true;
    };
    const progressAt = (y) => {
      if (typeof lines.getBoundingClientRect !== "function") return 0;
      const rect = lines.getBoundingClientRect();
      if (!(rect.height > 0)) return 0;
      return Math.max(0, Math.min(1, (y - rect.top) / rect.height));
    };
    const clearTimer = () => {
      if (hideTimer) window.clearTimeout(hideTimer);
      hideTimer = 0;
    };
    const reveal = (linger = RAIL_LINGER_MS) => {
      clearTimer();
      if (!prepare()) return;
      doc.setAttribute(RAIL_REVEALED, "");
      hideTimer = window.setTimeout(() => {
        hideTimer = 0;
        if (active || pointer !== null) return;
        doc.removeAttribute(RAIL_REVEALED);
      }, linger);
    };
    const begin = (y) => {
      if (active) return;
      if (!prepare()) return;
      active = true;
      clearTimer();
      doc.setAttribute(RAIL_REVEALED, "");
      doc.setAttribute(RAIL_DRAGGING, "");
      aligned = false;
      anchorBase = RAIL_ANCHOR_TOP;
      anchorRatio = RAIL_ANCHOR_RATIO;
      setOverflowAnchor(true);
      applyIndex(Math.round(progressAt(y) * (total - 1)));
      holdAnchor();
    };
    const commitLater = () => {
      const wanted = index;
      if (raf) window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        if (!marks || typeof marks.querySelector !== "function") return;
        const mark = marks.querySelector(`${RAIL_MARK}[data-index="${wanted}"]`);
        if (mark && typeof mark.click === "function") mark.click();
      });
    };
    const finish = (commit) => {
      const wasActive = active;
      pointer = null;
      active = false;
      doc.removeAttribute(RAIL_DRAGGING);
      if (!wasActive) {
        if (mobile.matches) reveal();
        return;
      }
      if (commit) commitIndex();
      clearPreview();
      markTarget(null);
      clearCardY();
      setOverflowAnchor(false);
      anchorRatio = 0;
      if (aligned) holdAnchor();
      if (mobile.matches) reveal();
      else doc.removeAttribute(RAIL_REVEALED);
    };
    const onPointerDown = (event) => {
      if (pointer !== null || !mobile.matches) return;
      const target = event.target;
      if (!target || target.nodeType !== 1 || typeof target.closest !== "function") return;
      if (!target.closest(`[${RAIL_EDGE}]`)) {
        if (!active) releaseAnchor();
        return;
      }
      pointer = typeof event.pointerId === "number" ? event.pointerId : 1;
      startY = event.clientY;
      fingerY = event.clientY;
      const shown = typeof doc.hasAttribute === "function" && doc.hasAttribute(RAIL_REVEALED);
      reveal();
      tapTarget = shown && total > 0 ? Math.round(progressAt(event.clientY) * (total - 1)) : -1;
    };
    const onPointerMove = (event) => {
      if (pointer === null || typeof event.pointerId === "number" && event.pointerId !== pointer) return;
      if (!active) {
        if (Math.abs(event.clientY - startY) <= RAIL_DRAG_Y) return;
        tapTarget = -1;
        begin(event.clientY);
        if (!active) return;
      }
      applyIndex(Math.round(progressAt(event.clientY) * (total - 1)));
      if (typeof event.preventDefault === "function") event.preventDefault();
    };
    const onPointerUp = (event) => {
      if (pointer === null || typeof event.pointerId === "number" && event.pointerId !== pointer) return;
      if (!active && tapTarget >= 0) {
        const at = tapTarget;
        tapTarget = -1;
        applyIndex(at);
        commitIndex();
        finish(false);
        return;
      }
      tapTarget = -1;
      finish(true);
    };
    const onPointerCancel = (event) => {
      if (pointer === null || typeof event.pointerId === "number" && event.pointerId !== pointer) return;
      finish(false);
    };
    const onKeyDown = (event) => {
      if (!mobile.matches) return;
      const key = event.key;
      let delta = 0;
      if (key === "ArrowUp") delta = -1;
      else if (key === "ArrowDown") delta = 1;
      else if (key === "PageUp") delta = -10;
      else if (key === "PageDown") delta = 10;
      else if (key !== "Home" && key !== "End") return;
      if (typeof event.preventDefault === "function") event.preventDefault();
      if (!prepare()) return;
      if (!active) {
        active = true;
        clearTimer();
        doc.setAttribute(RAIL_REVEALED, "");
        doc.setAttribute(RAIL_DRAGGING, "");
      }
      if (key === "Home") applyIndex(0);
      else if (key === "End") applyIndex(total - 1);
      else applyIndex((index < 0 ? 0 : index) + delta);
    };
    const onKeyUp = () => finish(true);
    const onScroll = (event) => {
      if (active || !mobile.matches) return;
      const target = event.target;
      if (!target || target.nodeType !== 1 || typeof target.matches !== "function") return;
      if (!target.matches(TRANSCRIPT_SCROLL)) return;
      if (!anchorFrame) scheduleReaderFollow();
      reveal();
    };
    const onResize = () => {
      if (!mobile.matches) {
        finish(false);
        doc.removeAttribute(RAIL_REVEALED);
        return;
      }
      if (doc.hasAttribute(RAIL_REVEALED) && !prepare()) doc.removeAttribute(RAIL_REVEALED);
    };
    const onTakeOver = () => {
      if (!active) releaseAnchor();
    };
    const onWindowBlur = () => finish(false);
    document.body.append(root);
    document.body.append(edge);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("pointercancel", onPointerCancel, true);
    document.addEventListener("scroll", onScroll, true);
    document.addEventListener("wheel", onTakeOver, { capture: true, passive: true });
    document.addEventListener("touchstart", onTakeOver, { capture: true, passive: true });
    document.addEventListener("keydown", onTakeOver, true);
    window.addEventListener("resize", onResize);
    window.addEventListener("blur", onWindowBlur);
    const viewport = window.visualViewport;
    if (viewport && typeof viewport.addEventListener === "function") viewport.addEventListener("resize", onResize);
    if (typeof mobile.addEventListener === "function") mobile.addEventListener("change", onResize);
    edge.addEventListener("keydown", onKeyDown);
    edge.addEventListener("keyup", onKeyUp);
    edge.addEventListener("blur", onKeyUp);
    return () => {
      clearTimer();
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      if (readerFrame) window.cancelAnimationFrame(readerFrame);
      readerFrame = 0;
      pointer = null;
      active = false;
      releaseAnchor();
      setOverflowAnchor(false);
      clearCardY();
      markTarget(null);
      clearPreview();
      doc.removeAttribute(RAIL_REVEALED);
      doc.removeAttribute(RAIL_DRAGGING);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("pointercancel", onPointerCancel, true);
      document.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("wheel", onTakeOver, true);
      document.removeEventListener("touchstart", onTakeOver, true);
      document.removeEventListener("keydown", onTakeOver, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("blur", onWindowBlur);
      if (viewport && typeof viewport.removeEventListener === "function") viewport.removeEventListener("resize", onResize);
      if (typeof mobile.removeEventListener === "function") mobile.removeEventListener("change", onResize);
      edge.removeEventListener("keydown", onKeyDown);
      edge.removeEventListener("keyup", onKeyUp);
      edge.removeEventListener("blur", onKeyUp);
      root.remove();
      edge.remove();
    };
  }
  var installers = [
    installTouchInteractions,
    installAddButtonKeyboardGuard,
    installEnterKeyHint,
    installKeyboardFollow,
    installSidebarFab,
    installModelPillWidth,
    installTurnRailScrub
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
