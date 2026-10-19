(() => {
  "use strict";

  // Home feed and Reels viewer: keep ACV controls compact and below each action group.
  const CONTROL_CLASS = "acv-instagram-save";
  const POST_PATH = /^\/(?:p|reel|tv)\/[^/]+/;
  const REEL_BOOKMARK_ICON = '<svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-3.8L6 21V4.75Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';

  function isHomeFeed() {
    return location.pathname === "/";
  }

  function isReelsViewer() {
    return /^\/(?:reels|reel)(?:\/|$)/.test(location.pathname);
  }

  function getCurrentReelUrl() {
    const match = location.pathname.match(/^\/(?:reels|reel)\/([^/]+)\/?$/);
    if (!match) return null;
    return location.origin + "/reel/" + encodeURIComponent(match[1]) + "/";
  }

  function canonicalPostUrl(rawHref) {
    try {
      const parsed = new URL(rawHref, location.href);
      if (
        parsed.hostname !== "www.instagram.com" ||
        !POST_PATH.test(parsed.pathname)
      ) return null;
      return parsed.origin + parsed.pathname;
    } catch {
      return null;
    }
  }

  function getPostUrl(article) {
    for (const link of article.querySelectorAll('a[href]')) {
      const url = canonicalPostUrl(link.href);
      if (url) return url;
    }
    return null;
  }

  function createControl(postUrl, resolveCurrentUrl = null) {
    const wrapper = document.createElement("div");
    wrapper.className = CONTROL_CLASS;
    wrapper.dataset.url = postUrl;
    Object.assign(wrapper.style, {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      width: "max-content",
      maxWidth: "100%",
      margin: "8px 0 10px",
      position: "relative",
      zIndex: "5",
      font: "13px/1.3 system-ui, sans-serif",
      boxSizing: "border-box",
    });

    const save = document.createElement("button");
    save.type = "button";
    save.textContent = "🔖 Save to Vault";
    save.setAttribute("aria-label", "Save post to AI Content Vault");
    Object.assign(save.style, {
      display: "inline-flex",
      alignItems: "center",
      border: "0",
      borderRadius: "16px",
      background: "#C2410C",
      color: "#fff",
      padding: "7px 11px",
      font: "600 12px system-ui, sans-serif",
      whiteSpace: "nowrap",
      cursor: "pointer",
    });

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.textContent = "+";
    toggle.title = "Add an optional note";
    toggle.setAttribute("aria-label", "Add an optional note");
    Object.assign(toggle.style, {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "27px",
      height: "27px",
      flex: "0 0 27px",
      padding: "0",
      border: "1px solid #aaa",
      borderRadius: "50%",
      background: "#262626",
      color: "#fff",
      font: "18px/1 system-ui, sans-serif",
      cursor: "pointer",
    });

    // The note panel floats above the button row and does not change page layout.
    const panel = document.createElement("div");
    Object.assign(panel.style, {
      display: "none",
      position: "absolute",
      left: "0",
      bottom: "calc(100% + 6px)",
      width: "min(250px, 70vw)",
      maxWidth: "calc(100vw - 32px)",
      padding: "8px",
      border: "1px solid #ddd",
      borderRadius: "9px",
      background: "#fff",
      boxShadow: "0 3px 14px rgba(0,0,0,.24)",
      boxSizing: "border-box",
    });

    const note = document.createElement("input");
    note.type = "text";
    note.placeholder = "Add a note (optional) and click save.";
    note.setAttribute("aria-label", "Optional note");
    Object.assign(note.style, {
      display: "block",
      width: "100%",
      minWidth: "0",
      height: "34px",
      padding: "0 9px",
      border: "1px solid #bbb",
      borderRadius: "6px",
      background: "#fff",
      color: "#111",
      font: "13px system-ui, sans-serif",
      boxSizing: "border-box",
    });
    panel.appendChild(note);

    const status = document.createElement("div");
    status.setAttribute("role", "status");
    Object.assign(status.style, {
      display: "none",
      position: "absolute",
      left: "0",
      bottom: "calc(100% + 6px)",
      width: "min(280px, 75vw)",
      padding: "8px 10px",
      borderRadius: "8px",
      background: "#fff",
      color: "#b91c1c",
      boxShadow: "0 3px 14px rgba(0,0,0,.24)",
      font: "12px/1.4 system-ui, sans-serif",
      whiteSpace: "normal",
      overflowWrap: "anywhere",
      boxSizing: "border-box",
    });

    let statusTimer;
    function showStatus(message, isError = true, duration = 0) {
      clearTimeout(statusTimer);
      panel.style.display = "none";
      status.textContent = message;
      status.style.display = "block";
      status.style.color = isError ? "#b91c1c" : "#15803d";
      if (duration > 0) {
        statusTimer = setTimeout(() => {
          status.style.display = "none";
        }, duration);
      }
    }

    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      status.style.display = "none";
      const opening = panel.style.display === "none";
      panel.style.display = opening ? "block" : "none";
      toggle.textContent = opening ? "−" : "+";
      toggle.title = opening ? "Hide note" : "Add an optional note";
      toggle.setAttribute(
        "aria-label",
        opening ? "Hide optional note" : "Add an optional note"
      );
      if (opening) note.focus();
    });

    let saving = false;
    let saved = false;
    const savedIcon = '<svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="m5 12 4 4L19 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const isFloatingReel = () => wrapper.dataset.reelFloating === "true";

    async function savePost() {
      if (saving || saved) return;
      saving = true;
      save.disabled = true;
      if (isFloatingReel()) save.title = "Saving…";
      else save.textContent = "Saving…";
      status.style.display = "none";

      try {
        const response = await chrome.runtime.sendMessage({
          type: "ACV_SAVE_LINK",
          url: wrapper.dataset.url,
          note: note.value.trim(),
        });

        if (!response) {
          showStatus("No response from the extension. Reload it and try again.");
          return;
        }

        if (response.requiresNote) {
          panel.style.display = "block";
          toggle.textContent = "−";
          toggle.title = "Hide note";
          toggle.setAttribute("aria-label", "Hide optional note");
          if (isFloatingReel()) save.title = "Save with note";
          else save.textContent = "Save with note";
          showStatus(
            response.message ||
            "Instagram details could not be fetched. Add a note, then save again."
          );
          panel.style.display = "block";
          note.focus();
          return;
        }

        if (!response.success) {
          const message = response.status === 401
            ? "Please sign in to AI Content Vault from the extension."
            : response.status === 409
              ? (response.error || "This link is already in your Content Vault.")
              : (response.error || "Couldn't save this post. Please try again.");
          showStatus(message);
          return;
        }

        saved = true;
        if (isFloatingReel()) {
          save.innerHTML = savedIcon;
          save.title = "Saved";
          save.setAttribute("aria-label", "Reel saved to AI Content Vault");
        } else save.textContent = "✓ Saved";
        save.style.background = "#166534";
        toggle.disabled = true;
        note.disabled = true;
        showStatus("Link saved to AI Content Vault!", false, 1500);
      } catch (error) {
        console.error("ACV: Instagram home-feed save failed:", error);
        showStatus("Couldn't contact the extension. Reload it and try again.");
      } finally {
        saving = false;
        if (!saved) {
          save.disabled = false;
          if (isFloatingReel()) {
            save.innerHTML = REEL_BOOKMARK_ICON;
            save.title = "Save Reel to Vault";
            save.setAttribute("aria-label", "Save Reel to AI Content Vault");
          } else if (save.textContent === "Saving…") save.textContent = "🔖 Save to Vault";
        }
      }
    }

    save.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (resolveCurrentUrl) {
        const currentUrl = resolveCurrentUrl();
        if (!currentUrl) {
          showStatus("Couldn't identify the current Reel. Try again in a moment.");
          return;
        }
        if (currentUrl !== wrapper.dataset.url) {
          wrapper.dataset.url = currentUrl;
          saved = false;
          save.disabled = false;
          if (isFloatingReel()) save.innerHTML = REEL_BOOKMARK_ICON;
          else save.textContent = "🔖 Save to Vault";
          save.title = isFloatingReel() ? "Save Reel to Vault" : "";
          save.setAttribute("aria-label", isFloatingReel() ? "Save Reel to AI Content Vault" : "Save post to AI Content Vault");
          save.style.background = "#C2410C";
          toggle.disabled = false;
          note.disabled = false;
          status.style.display = "none";
        }
      }
      savePost();
    });
    panel.addEventListener("click", (event) => event.stopPropagation());
    panel.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Enter") {
        event.preventDefault();
        savePost();
      }
    });

    wrapper.append(save, toggle, panel, status);
    return wrapper;
  }

  function findActionRow(article) {
    const controls = [...article.querySelectorAll('button, [role="button"]')].filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 &&
        style.display !== "none" && style.visibility !== "hidden";
    });
    const getLabel = (element) => [
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.querySelector("[aria-label]")?.getAttribute("aria-label"),
    ].filter(Boolean).join(" ");

    const likeControl = controls.find((element) =>
      /\b(?:like|unlike)\b/i.test(getLabel(element))
    );
    if (!likeControl) return null;

    // Prefer the shared container of Like and Instagram's native bookmark action.
    const nativeBookmark = controls.find((element) =>
      !element.closest("." + CONTROL_CLASS) &&
      /\b(?:save|bookmark)\b/i.test(getLabel(element))
    );
    if (nativeBookmark) {
      let node = likeControl.parentElement;
      while (node && node !== article) {
        if (node.contains(nativeBookmark)) return node;
        node = node.parentElement;
      }
    }

    // Labels vary across Instagram layouts. Count the complete icon group,
    // including the bookmark icon, and use a smaller group only as fallback.
    let node = likeControl.parentElement;
    let fallback = null;
    while (node && node !== article) {
      const count = node.querySelectorAll('button, [role="button"]').length;
      if (count >= 5) return node;
      if (count >= 4 && !fallback) fallback = node;
      node = node.parentElement;
    }

    return fallback || likeControl.parentElement;
  }
  function addButton(container, postUrl = getPostUrl(container)) {
    if (!postUrl) return;

    const existing = container.querySelector("." + CONTROL_CLASS);
    if (existing?.dataset.url === postUrl) return;
    existing?.remove();

    const actionRow = findActionRow(container);
    if (!actionRow) return;

    // Put a separate, compact row after every action icon and before the caption.
    actionRow.insertAdjacentElement("afterend", createControl(postUrl));
  }

  let reelControl = null;

  function getDisplayedReelUrl(main) {
    const candidates = [...main.querySelectorAll('a[href]')]
      .map((link) => {
        const postUrl = canonicalPostUrl(link.href);
        const rect = link.getBoundingClientRect();
        const visible = rect.width > 0 && rect.height > 0 &&
          rect.bottom > 0 && rect.top < window.innerHeight &&
          rect.right > 0 && rect.left < window.innerWidth;
        const centerDistance = Math.abs(
          rect.top + rect.height / 2 - window.innerHeight / 2
        );
        return { postUrl, visible, centerDistance };
      })
      .filter((item) => item.postUrl && /\/reel\//.test(item.postUrl) && item.visible)
      .sort((a, b) => a.centerDistance - b.centerDistance);

    // The route is reliable when Instagram updates it; visible Reel links
    // handle viewers that keep one route while swapping the card in place.
    return candidates[0]?.postUrl || getCurrentReelUrl();
  }

  function showFloatingReelControl(main) {
    const postUrl = getDisplayedReelUrl(main);

    // Remove controls injected by older versions of this script. Reels use
    // one viewport-fixed control so scrolling never moves it with a card.
    main.querySelectorAll("." + CONTROL_CLASS).forEach((node) => {
      if (node !== reelControl) node.remove();
    });

    if (!postUrl) return;
    if (reelControl?.dataset.url !== postUrl) {
      reelControl?.remove();
      reelControl = createControl(postUrl, () => {
        const currentMain = document.querySelector("main") || document.body;
        return getDisplayedReelUrl(currentMain);
      });
      reelControl.dataset.reelFloating = "true";
      reelControl.style.flexDirection = "column";
      reelControl.style.gap = "7px";
      Object.assign(reelControl.style, {
        position: "fixed",
        left: "260px",
        top: "50%",
        right: "auto",
        bottom: "auto",
        transform: "translateY(-50%)",
        zIndex: "2147483647",
        margin: "0",
        padding: "0",
        background: "transparent",
        boxShadow: "none",
      });

      const save = reelControl.querySelector("button");
      save.textContent = "";
      save.setAttribute("aria-label", "Save Reel to AI Content Vault");
      save.title = "Save Reel to Vault";
      Object.assign(save.style, {
        justifyContent: "center",
        width: "42px",
        height: "42px",
        padding: "0",
        borderRadius: "50%",
        boxShadow: "0 2px 8px rgba(0,0,0,.45)",
      });
      save.innerHTML = REEL_BOOKMARK_ICON;

      const toggle = reelControl.querySelectorAll("button")[1];
      Object.assign(toggle.style, {
        width: "34px",
        height: "34px",
        flex: "0 0 34px",
        fontSize: "21px",
        boxShadow: "0 2px 8px rgba(0,0,0,.4)",
      });

      const panel = reelControl.querySelector("input").parentElement;
      Object.assign(panel.style, {
       left: "calc(100% + 8px)",
right: "auto",
        bottom: "0",
        width: "min(250px, 65vw)",
      });
      const status = reelControl.querySelector('[role="status"]');
      Object.assign(status.style, {
        left: "auto",
        right: "calc(100% + 8px)",
        bottom: "0",
        width: "min(280px, 65vw)",
      });
      document.body.appendChild(reelControl);
    }
  }

  function scanFeed() {
    if (isHomeFeed()) {
      reelControl?.remove();
      reelControl = null;
      document.querySelectorAll("article").forEach((article) => addButton(article));
      return;
    }

    if (!isReelsViewer()) {
      document.querySelectorAll("." + CONTROL_CLASS).forEach((node) => node.remove());
      reelControl = null;
      return;
    }

    const main = document.querySelector("main") || document.body;

    showFloatingReelControl(main);
  }
  let scanTimer;
  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scanFeed, 250);
  }

  const observer = new MutationObserver((mutations) => {
    // Reel navigation can reuse the same card and only update its permalink,
    // class, or visibility. Ignore mutations caused by our own controls.
    if (mutations.some((mutation) =>
      !mutation.target.parentElement?.closest("." + CONTROL_CLASS)
    )) scheduleScan();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["href", "class", "style", "aria-label"],
  });

  // Instagram uses pushState for /reels/<id> changes without popstate.
  for (const method of ["pushState", "replaceState"]) {
    const original = history[method];
    history[method] = function (...args) {
      const result = original.apply(this, args);
      scheduleScan();
      return result;
    };
  }
  window.addEventListener("popstate", scheduleScan);
  window.addEventListener("resize", scheduleScan, { passive: true });
  window.addEventListener("orientationchange", scheduleScan, { passive: true });
  document.addEventListener("scroll", scheduleScan, { capture: true, passive: true });
  document.addEventListener("wheel", scheduleScan, { capture: true, passive: true });
  scanFeed();
})();










