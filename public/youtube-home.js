/* AI Content Vault: homepage three-dot menu save flow.
   Kept in an IIFE so it does not collide with youtube.js globals. */
(() => {
  if (window.__acvHomeMenuInstalled) return;
  window.__acvHomeMenuInstalled = true;

  const PREFIX = "[ACV Home]";
  let pending = null;
  let injectTimer = 0;
  let toastTimer = 0;

  function toast(message, error = false) {
    document.querySelector("#acv-home-toast")?.remove();
    const el = document.createElement("div");
    el.id = "acv-home-toast";
    el.textContent = message;
    Object.assign(el.style, {
      position: "fixed", right: "18px", bottom: "18px", zIndex: "2147483647",
      maxWidth: "min(360px, calc(100vw - 36px))", padding: "11px 15px",
      borderRadius: "9px", background: error ? "#991b1b" : "#166534", color: "white",
      font: "500 13px/1.4 system-ui, sans-serif", boxShadow: "0 6px 22px #0006"
    });
    document.body.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), 2200);
  }

  function getCard(target) {
    const card = target.closest("ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytm-rich-item-renderer, ytm-video-with-context-renderer, ytm-compact-video-renderer, ytm-video-renderer");
    if (card) return card;
    // Mobile layouts have changed their card wrappers over time. Walk upward
    // until an ancestor contains a YouTube video link.
    for (let node = target, depth = 0; node && node !== document.body && depth < 12; node = node.parentElement, depth++) {
      if (node.querySelector?.('a[href*="/watch?v="], a[href^="/shorts/"]')) return node;
    }
    return null;
  }

  function getDetails(card) {
    if (!card) return null;
    for (const a of card.querySelectorAll('a[href]')) {
      try {
        const u = new URL(a.href, location.href);
        if (!/(^|\.)youtube\.com$/i.test(u.hostname)) continue;
        let videoUrl = "";
        if (u.pathname === "/watch" && u.searchParams.get("v")) videoUrl = `${location.origin}/watch?v=${encodeURIComponent(u.searchParams.get("v"))}`;
        else if (u.pathname.startsWith("/shorts/")) videoUrl = `${location.origin}${u.pathname}`;
        if (!videoUrl) continue;
        const title = card.querySelector("#video-title, h3")?.textContent?.trim() || a.getAttribute("title") || "";
        return { videoUrl, title };
      } catch (_) {}
    }
    return null;
  }

  // YouTube currently renders the homepage menu inside shadow roots. A normal
  // document.querySelectorAll("ytd-menu-popup-renderer") does not see it.
  function findVisibleMenu() {
    const candidates = [];
    function scan(root) {
      for (const el of root.querySelectorAll("*")) {
        if (el.matches("yt-list-view-model, ytd-menu-popup-renderer, [role='menu'], bottom-sheet-layout, yt-bottom-sheet-layout, ytm-bottom-sheet-renderer")) {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          if (r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden" && s.opacity !== "0") {
            const isMobileSheet = el.matches("bottom-sheet-layout, yt-bottom-sheet-layout, ytm-bottom-sheet-renderer");
            const priority = location.hostname === "m.youtube.com"
              ? (isMobileSheet ? 0 : el.matches("yt-list-view-model") ? 1 : 2)
              : (el.matches("yt-list-view-model") ? 0 : 1);
            candidates.push({ el, area: r.width * r.height, priority });
          }
        }
        if (el.shadowRoot) scan(el.shadowRoot);
      }
    }
    scan(document);
    candidates.sort((a, b) => a.priority - b.priority || b.area - a.area);
    return candidates[0]?.el || null;
  }

  function makeControls(details) {
    const box = document.createElement("div");
    box.className = "acv-home-save-controls";
    box.dataset.url = details.videoUrl;
    Object.assign(box.style, { display: "flex", alignItems: "center", gap: "6px", padding: "8px 12px", position: "sticky", top: "0", zIndex: "2147483646", background: "var(--yt-spec-menu-background, #282828)", font: "13px Roboto,Arial,sans-serif", borderBottom: "1px solid #8885", boxSizing: "border-box" });

    const save = document.createElement("button");
    save.type = "button"; save.textContent = "🔖 Save to Vault";
    Object.assign(save.style, { minHeight: "34px", padding: "0 11px", border: "0", borderRadius: "17px", background: "#C2410C", color: "#fff", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" });

    const toggle = document.createElement("button");
    toggle.type = "button"; toggle.textContent = "+"; toggle.title = "Add an optional note";
    Object.assign(toggle.style, { width: "28px", height: "28px", border: "1px solid #777", borderRadius: "50%", background: "#292929", color: "#fff", fontSize: "18px", cursor: "pointer", flex: "0 0 auto" });

    const input = document.createElement("input");
    input.type = "text"; input.placeholder = "Add a note (optional)"; input.setAttribute("aria-label", "Optional note");
    Object.assign(input.style, { display: "none", width: "150px", maxWidth: "30vw", minWidth: "90px", height: "32px", padding: "0 8px", border: "1px solid #777", borderRadius: "7px", background: "#212121", color: "#fff", fontSize: "12px", boxSizing: "border-box" });

    const status = document.createElement("span");
    Object.assign(status.style, { display: "none", position: "absolute", left: "8px", top: "calc(100% + 4px)", zIndex: "2147483647", width: "min(270px, calc(100vw - 40px))", padding: "8px 10px", borderRadius: "7px", background: "#202020", color: "#fecaca", fontSize: "12px", whiteSpace: "normal", boxShadow: "0 4px 16px #0008" });
    const setStatus = (msg, error = true) => { status.textContent = msg; status.style.display = "block"; status.style.color = error ? "#fecaca" : "#bbf7d0"; status.style.border = `1px solid ${error ? "#ef4444" : "#22c55e"}`; };

    toggle.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); const open = input.style.display === "none"; input.style.display = open ? "inline-block" : "none"; toggle.textContent = open ? "−" : "+"; if (open) input.focus(); });
    input.addEventListener("click", e => e.stopPropagation());

    let saving = false, saved = false;
    async function saveLink(e) {
      e?.preventDefault(); e?.stopPropagation();
      if (saving || saved) return;
      saving = true; save.disabled = true; save.textContent = "Saving..."; status.style.display = "none";
      try {
        const response = await chrome.runtime.sendMessage({ type: "ACV_SAVE_LINK", url: details.videoUrl, note: input.value.trim() });
        if (!response) throw new Error("No response from the extension. Reload it and try again.");
        if (response.requiresNote) {
          input.style.display = "inline-block"; toggle.textContent = "−"; input.focus();
          const msg = response.message || "Couldn't fetch video details. Add a note, then save again.";
          setStatus(msg); toast(msg, true); return;
        }
        if (!response.success) {
          const msg = response.status === 401 ? "Please sign in to AI Content Vault from the extension." : response.status === 409 ? (response.error || "Link already exists in your Content Vault.") : (response.error || "Couldn't save this video. Please try again.");
          setStatus(msg); toast(msg, true); return;
        }
        saved = true; save.textContent = "✓ Saved"; save.style.background = "#166534"; toggle.disabled = true; input.disabled = true;
        setStatus("Link saved to AI Content Vault!", false); toast("Link saved to AI Content Vault!");
      } catch (err) {
        console.error(`${PREFIX} Save failed:`, err);
        const msg = err?.message || "Couldn't contact the extension. Reload it and try again.";
        setStatus(msg); toast(msg, true);
      } finally { saving = false; if (!saved) { save.disabled = false; if (save.textContent === "Saving...") save.textContent = "🔖 Save to Vault"; } }
    }
    save.addEventListener("click", saveLink);
    input.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Enter") saveLink(e); });
    box.append(save, toggle, input, status);
    return box;
  }

  function inject() {
    if (!pending) return;
    const menu = findVisibleMenu();
    if (!menu) return;
    menu.querySelector(":scope > .acv-home-save-controls")?.remove();
    const controls = makeControls(pending);
    menu.insertBefore(controls, menu.firstChild);
    console.info(`${PREFIX} Save controls added`, { ...pending, menu });
    pending = null;
  }

  // Shorts use a fixed save control, like the Instagram Reels control. Read
  // the live URL on every Shorts navigation and rebuild controls for the new
  // clip so a prior save state never carries over to the next Short.
  let shortsDock = null;
  let shortsUrl = "";
  let shortsPosition = null;
  let suppressShortsClickUntil = 0;

  function enableShortsDragging(dock) {
    let startX = 0, startY = 0, originX = 0, originY = 0;
    let pointerId = null, moved = false;

    dock.addEventListener("pointerdown", event => {
      if (event.target.closest("input")) return;
      if (event.button !== undefined && event.button !== 0) return;
      const rect = dock.getBoundingClientRect();
      startX = event.clientX;
      startY = event.clientY;
      originX = rect.left;
      originY = rect.top;
      pointerId = event.pointerId;
      moved = false;
    });

    dock.addEventListener("pointermove", event => {
      if (pointerId === null || event.pointerId !== pointerId) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (!moved && Math.hypot(dx, dy) < 5) return;
      if (!moved) dock.setPointerCapture?.(pointerId);
      moved = true;
      const rect = dock.getBoundingClientRect();
      const left = Math.max(0, Math.min(window.innerWidth - rect.width, originX + dx));
      const top = Math.max(0, Math.min(window.innerHeight - rect.height, originY + dy));
      dock.style.left = `${left}px`;
      dock.style.top = `${top}px`;
      dock.style.transform = "none";
      shortsPosition = { left, top };
      event.preventDefault();
    });

    const finish = event => {
      if (pointerId === null || event.pointerId !== pointerId) return;
      if (moved) suppressShortsClickUntil = Date.now() + 250;
      pointerId = null;
      moved = false;
    };
    dock.addEventListener("pointerup", finish);
    dock.addEventListener("pointercancel", finish);
    dock.addEventListener("click", event => {
      if (Date.now() > suppressShortsClickUntil) return;
      suppressShortsClickUntil = 0;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }, true);
  }

  function syncShortsDock() {
    const match = location.pathname.match(/^\/shorts\/([^/?#]+)/);
    if (!match) {
      shortsDock?.remove();
      shortsDock = null;
      shortsUrl = "";
      return;
    }
    const liveUrl = `${location.origin}/shorts/${match[1]}`;
    if (!document.body || liveUrl === shortsUrl) return;
    shortsDock?.remove();
    shortsDock = document.createElement("div");
    shortsDock.id = "acv-shorts-save-dock";
    Object.assign(shortsDock.style, {
      position: "fixed", left: `${shortsPosition?.left ?? 32}px`, top: shortsPosition ? `${shortsPosition.top}px` : "50%", transform: shortsPosition ? "none" : "translateY(-50%)",
      zIndex: "2147483646", maxWidth: "calc(100vw - 32px)",
      padding: "4px", borderRadius: "12px", background: "rgba(24,24,24,.94)",
      boxShadow: "0 4px 18px rgba(0,0,0,.4)", cursor: "grab", touchAction: "none", userSelect: "none"
    });
    const controls = makeControls({ videoUrl: liveUrl, title: document.title || "" });
    controls.style.position = "relative";
    controls.style.top = "auto";
    controls.style.background = "transparent";
    controls.style.borderBottom = "0";
    shortsDock.appendChild(controls);
    enableShortsDragging(shortsDock);
    document.body.appendChild(shortsDock);
    shortsUrl = liveUrl;
    console.info(`${PREFIX} Shorts save control ready`, { url: liveUrl });
  }

  document.addEventListener("yt-navigate-finish", syncShortsDock);
  window.addEventListener("popstate", syncShortsDock);
  window.setInterval(syncShortsDock, 400);
  syncShortsDock();

  document.addEventListener("click", event => {
    if (location.pathname !== "/") return;
    const trigger = event.target.closest("ytd-menu-renderer button, ytd-menu-renderer yt-icon-button, ytm-menu-button-renderer, ytm-menu-renderer button, ytm-menu-renderer yt-icon-button, button[aria-label*='More'], button[aria-label*='more'], button[aria-label*='Action'], button[aria-label*='Options']");
    if (!trigger) return;
    const details = getDetails(getCard(trigger));
    if (!details) { console.warn(`${PREFIX} Menu click detected, but couldn't identify its video card/URL.`, trigger); return; }
    pending = details;
    console.info(`${PREFIX} Three-dot click detected`, details);
    clearInterval(injectTimer);
    const start = Date.now();
    injectTimer = setInterval(() => { inject(); if (!pending || Date.now() - start > 2500) clearInterval(injectTimer); }, 80);
  }, true);

  console.info(`${PREFIX} Menu save flow loaded`);
})();
