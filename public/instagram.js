(() => {
  "use strict";

  // Home feed and Reels viewer: keep ACV controls compact and below each action group.
  const CONTROL_CLASS = "acv-instagram-save";
  const POST_PATH = /^\/(?:p|reel|tv)\/[^/]+/;

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

  function createControl(postUrl) {
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
    note.placeholder = "Add a note (optional)";
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

    function showStatus(message, isError = true) {
      panel.style.display = "none";
      status.textContent = message;
      status.style.display = "block";
      status.style.color = isError ? "#b91c1c" : "#15803d";
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

    async function savePost() {
      if (saving || saved) return;
      saving = true;
      save.disabled = true;
      save.textContent = "Saving…";
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
          save.textContent = "Save with note";
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
        save.textContent = "✓ Saved";
        save.style.background = "#166534";
        toggle.disabled = true;
        note.disabled = true;
        showStatus("Link saved to AI Content Vault!", false);
      } catch (error) {
        console.error("ACV: Instagram home-feed save failed:", error);
        showStatus("Couldn't contact the extension. Reload it and try again.");
      } finally {
        saving = false;
        if (!saved) {
          save.disabled = false;
          if (save.textContent === "Saving…") save.textContent = "🔖 Save to Vault";
        }
      }
    }

    save.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
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

  function scanFeed() {
    if (isHomeFeed()) {
      document.querySelectorAll("article").forEach((article) => addButton(article));
      return;
    }

    if (!isReelsViewer()) {
      document.querySelectorAll("." + CONTROL_CLASS).forEach((node) => node.remove());
      return;
    }

    const main = document.querySelector("main") || document.body;
    const currentReelUrl = getCurrentReelUrl();

    // On /reels/<id>, the route is the source of truth. Instagram often keeps
    // one viewer mounted while replacing its content as the user scrolls.
    if (currentReelUrl) {
      main.querySelectorAll("." + CONTROL_CLASS).forEach((node) => {
        if (node.dataset.url !== currentReelUrl) node.remove();
      });

      const matchingArticle = [...main.querySelectorAll("article")].find((article) =>
        [...article.querySelectorAll('a[href]')]
          .some((link) => canonicalPostUrl(link.href) === currentReelUrl)
      );

      addButton(matchingArticle || main, currentReelUrl);
      return;
    }

    // At /reels/ without an ID in the address bar, attach to the most visible
    // reel card and refresh that choice as the nested scroller moves.
    const candidates = [...main.querySelectorAll("article")]
      .map((article) => {
        const postUrl = getPostUrl(article);
        const rect = article.getBoundingClientRect();
        const visibleHeight = Math.max(
          0,
          Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)
        );
        const visibleWidth = Math.max(
          0,
          Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0)
        );
        return { article, postUrl, visibleArea: visibleHeight * visibleWidth };
      })
      .filter((item) => item.postUrl && /\/reel\//.test(item.postUrl))
      .sort((a, b) => b.visibleArea - a.visibleArea);

    if (candidates.length) {
      const active = candidates[0];
      main.querySelectorAll("." + CONTROL_CLASS).forEach((node) => {
        if (node.dataset.url !== active.postUrl) node.remove();
      });
      addButton(active.article, active.postUrl);
      return;
    }

    // Fallback for viewer layouts without article elements.
    const postUrl = [...main.querySelectorAll('a[href]')]
      .map((link) => canonicalPostUrl(link.href))
      .find((url) => url && /\/reel\//.test(url));
    if (!postUrl) return;

    main.querySelectorAll("." + CONTROL_CLASS).forEach((node) => {
      if (node.dataset.url !== postUrl) node.remove();
    });
    addButton(main, postUrl);
  }
  let scanTimer;
  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scanFeed, 250);
  }

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("popstate", scheduleScan);
  document.addEventListener("scroll", scheduleScan, { capture: true, passive: true });
  document.addEventListener("wheel", scheduleScan, { capture: true, passive: true });
  scanFeed();
})();






