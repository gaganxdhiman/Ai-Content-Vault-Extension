
/* =========================================================
   AI CONTENT VAULT — YOUTUBE VIDEO SAVE CONTROLS
   - Save action in homepage video three-dot menus
   - Save button beside Like/Dislike
   - Compact optional note toggle (+ / −)
   - Success and error messages
   - Duplicate-link handling
   - YouTube SPA navigation support
========================================================= */

let acvWatchButtonUrl = "";
let acvWatchObserverTimer = null;
let acvHomeMenuVideo = null;
let acvHomeMenuAnchor = null;
let acvHomeMenuTimer = null;

// ---------------------------------------------------------
// Toast notifications
// ---------------------------------------------------------

function acvShowToast(message, type = "success") {
  document.querySelector("#acv-watch-toast")?.remove();

  const toast = document.createElement("div");
  toast.id = "acv-watch-toast";
  toast.textContent = message;

  Object.assign(toast.style, {
    position: "fixed",
    right: "20px",
    bottom: "20px",
    zIndex: "2147483647",
    maxWidth: "min(360px, calc(100vw - 40px))",
    padding: "12px 16px",
    borderRadius: "10px",
    background: type === "success" ? "#166534" : "#991b1b",
    color: "#fff",
    font: "500 13px/1.45 system-ui, sans-serif",
    boxShadow: "0 8px 24px rgba(0,0,0,.35)",
  });

  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ---------------------------------------------------------
// Save action in homepage video three-dot menus
// ---------------------------------------------------------

function acvGetHomepageVideoDetails(card) {
  const links = [...card.querySelectorAll('a[href]')];

  for (const link of links) {
    try {
      const url = new URL(link.href, location.href);
      if (!/(^|\.)youtube\.com$/i.test(url.hostname)) continue;

      let videoUrl = null;
      if (url.pathname === "/watch" && url.searchParams.has("v")) {
        videoUrl = `${location.origin}/watch?v=${encodeURIComponent(url.searchParams.get("v"))}`;
      } else if (url.pathname.startsWith("/shorts/")) {
        videoUrl = `${location.origin}${url.pathname}`;
      }
      if (!videoUrl) continue;

      const titleElement = card.querySelector(
        "#video-title, yt-formatted-string#video-title, h3"
      );
      return {
        videoUrl,
        videoTitle: titleElement?.textContent?.trim() || link.getAttribute("title") || "",
      };
    } catch {
      // Ignore malformed or non-video links in the card.
    }
  }

  return null;
}

function acvCreateHomepageSaveMenuItem(details) {
  const item = document.createElement("ytd-menu-service-item-renderer");
  item.className = "style-scope ytd-menu-popup-renderer acv-home-save-menu-item";
  item.setAttribute("role", "menuitem");
  item.setAttribute("tabindex", "0");
  item.dataset.url = details.videoUrl;
  Object.assign(item.style, { display: "block", width: "100%" });

  const paperItem = document.createElement("tp-yt-paper-item");
  paperItem.className = "style-scope ytd-menu-service-item-renderer";
  paperItem.setAttribute("role", "option");
  Object.assign(paperItem.style, {
    display: "flex",
    alignItems: "center",
    minHeight: "48px",
    padding: "0 16px",
    boxSizing: "border-box",
    color: "var(--yt-spec-text-primary, #0f0f0f)",
    font: "14px Roboto, Arial, sans-serif",
    cursor: "pointer",
    whiteSpace: "nowrap",
  });

  const icon = document.createElement("span");
  icon.textContent = "🔖";
  icon.setAttribute("aria-hidden", "true");
  icon.style.marginRight = "16px";

  const label = document.createElement("yt-formatted-string");
  label.className = "style-scope ytd-menu-service-item-renderer";
  label.textContent = "Save to AI Content Vault";
  paperItem.append(icon, label);
  item.appendChild(paperItem);

  async function saveHomepageVideo(event) {
    event.preventDefault();
    event.stopPropagation();
    if (item.dataset.saving === "true" || item.dataset.saved === "true") return;

    item.dataset.saving = "true";
    label.textContent = "Saving to Vault…";
    try {
      let response = await chrome.runtime.sendMessage({
        type: "ACV_SAVE_LINK",
        url: details.videoUrl,
        note: "",
      });

      if (response?.requiresNote) {
        const note = window.prompt(
          response.message || "Couldn't fetch video details. Add an optional note to save this video:",
          ""
        );
        if (note === null) {
          label.textContent = "Save to AI Content Vault";
          return;
        }
        response = await chrome.runtime.sendMessage({
          type: "ACV_SAVE_LINK",
          url: details.videoUrl,
          note: note.trim(),
        });
      }

      if (!response) {
        throw new Error("No response from the extension. Reload it and try again.");
      }
      if (!response.success) {
        if (response.status === 401) {
          throw new Error("Please sign in to AI Content Vault from the extension.");
        }
        if (response.status === 409) {
          throw new Error(response.error || "This link is already in your Content Vault.");
        }
        throw new Error(response.error || "Couldn't save this video. Please try again.");
      }

      item.dataset.saved = "true";
      label.textContent = "Saved to AI Content Vault";
      acvShowToast("Video saved to AI Content Vault!", "success");
    } catch (error) {
      console.error("ACV: Homepage video save failed:", error);
      label.textContent = "Save to AI Content Vault";
      acvShowToast(error.message || "Couldn't contact the extension. Reload it and try again.", "error");
    } finally {
      delete item.dataset.saving;
    }
  }

  item.addEventListener("click", saveHomepageVideo);
  item.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") saveHomepageVideo(event);
  });
  return item;
}

function acvInjectHomepageMenuItem() {
  if (!acvHomeMenuVideo || location.pathname !== "/") return;

  const anchorRect = acvHomeMenuAnchor?.getBoundingClientRect();
  const popups = [...document.querySelectorAll("ytd-menu-popup-renderer")].filter((popup) => {
    const rect = popup.getBoundingClientRect();
    const style = getComputedStyle(popup);
    return rect.width > 0 && rect.height > 0 &&
      style.display !== "none" && style.visibility !== "hidden" &&
      style.opacity !== "0";
  });
  popups.sort((a, b) => {
    if (!anchorRect) return 0;
    const aRect = a.getBoundingClientRect();
    const bRect = b.getBoundingClientRect();
    const aDistance = Math.hypot(
      aRect.left + aRect.width / 2 - (anchorRect.left + anchorRect.width / 2),
      aRect.top + aRect.height / 2 - (anchorRect.top + anchorRect.height / 2)
    );
    const bDistance = Math.hypot(
      bRect.left + bRect.width / 2 - (anchorRect.left + anchorRect.width / 2),
      bRect.top + bRect.height / 2 - (anchorRect.top + anchorRect.height / 2)
    );
    return aDistance - bDistance;
  });
  const popup = popups[0];
  if (!popup) return;

  popup.querySelectorAll(".acv-home-save-menu-item").forEach((oldItem) => oldItem.remove());
  const list = popup.querySelector("tp-yt-paper-listbox, [role='listbox']") || popup;
  list.appendChild(acvCreateHomepageSaveMenuItem(acvHomeMenuVideo));
  acvHomeMenuVideo = null;
  acvHomeMenuAnchor = null;
}

function acvScheduleHomepageMenuInjection() {
  if (!acvHomeMenuVideo || location.pathname !== "/") return;
  clearTimeout(acvHomeMenuTimer);
  acvHomeMenuTimer = setTimeout(acvInjectHomepageMenuItem, 80);
}

document.addEventListener("click", (event) => {
  if (location.pathname !== "/") return;

  const path = event.composedPath();
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  if (target?.closest(".acv-home-save-menu-item, ytd-menu-popup-renderer")) return;
  const triggerSelector =
    "ytd-menu-renderer, button[aria-label*='Action menu'], yt-icon-button[aria-label*='Action menu']";
  const menuTrigger = path.find((node) =>
    node instanceof Element && node.matches(triggerSelector)
  ) || target?.closest(triggerSelector);
  if (!menuTrigger) return;

  const card = menuTrigger.closest(
    "ytd-rich-item-renderer, ytd-rich-grid-media, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer"
  );
  if (!card) return;

  acvHomeMenuVideo = acvGetHomepageVideoDetails(card);
  if (!acvHomeMenuVideo) return;
  acvHomeMenuAnchor = menuTrigger;

  // YouTube creates the popup after the three-dot click handler runs.
  [80, 250, 600, 1000].forEach((delay) => {
    setTimeout(acvInjectHomepageMenuItem, delay);
  });
}, true);

// ---------------------------------------------------------
// Current video details
// ---------------------------------------------------------

function acvGetCurrentVideoDetails() {
  const url = new URL(location.href);

  const isWatchPage =
    url.pathname === "/watch" && url.searchParams.has("v");

  const isShortsPage = url.pathname.startsWith("/shorts/");

  if (!isWatchPage && !isShortsPage) return null;

  const videoUrl = isWatchPage
    ? `${location.origin}/watch?v=${encodeURIComponent(
        url.searchParams.get("v")
      )}`
    : `${location.origin}${url.pathname}`;

  const titleElement = document.querySelector(
    "h1 yt-formatted-string, h1, .slim-video-metadata-title, .watch-title"
  );

  return {
    videoUrl,
    videoTitle:
      titleElement?.textContent?.trim() || document.title || "",
  };
}

// ---------------------------------------------------------
// Find YouTube's action row
// ---------------------------------------------------------

function acvFindWatchActionRow() {
  const selectors = [
    // Desktop YouTube
    "ytd-watch-metadata #top-level-buttons-computed",
    "ytd-watch-metadata #actions ytd-menu-renderer #top-level-buttons-computed",
    "ytd-watch-metadata #actions-inner",
    "ytd-watch-metadata #actions",

    // Mobile YouTube
    ".slim-video-action-bar-actions",
    "ytm-slim-video-action-bar-renderer .slim-video-action-bar-actions",
    "ytm-slim-video-action-bar-renderer #actions",
    "ytm-slim-video-action-bar-renderer",
  ];

  for (const selector of selectors) {
    const row = [...document.querySelectorAll(selector)].find(
      (element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);

        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden"
        );
      }
    );

    if (row) return row;
  }

  return null;
}

// ---------------------------------------------------------
// Create the Save button, note toggle, note input and status
// ---------------------------------------------------------

function acvCreateWatchSaveButton(details) {
  const wrapper = document.createElement("div");
  wrapper.className = "acv-watch-save-wrapper";
  wrapper.dataset.url = details.videoUrl;

  Object.assign(wrapper.style, {
    display: "inline-flex",
    flex: "0 0 auto",
    alignItems: "center",
    gap: "6px",
    position: "relative",
    margin: "0 4px",
    fontFamily: "Roboto, Arial, sans-serif",
    verticalAlign: "middle",
  });

  // Save button
  const button = document.createElement("button");
  button.type = "button";
  button.className = "acv-watch-save-button";
  button.textContent = "🔖 Save to Vault";
  button.setAttribute(
    "aria-label",
    "Save video to AI Content Vault"
  );

  Object.assign(button.style, {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    minHeight: "36px",
    padding: "0 12px",
    border: "none",
    borderRadius: "18px",
    background: "#C2410C",
    color: "#fff",
    fontSize: "13px",
    fontWeight: "600",
    whiteSpace: "nowrap",
    cursor: "pointer",
  });

  // Compact optional-note toggle
  const noteToggle = document.createElement("button");
  noteToggle.type = "button";
  noteToggle.className = "acv-watch-note-toggle";
  noteToggle.textContent = "+";
  noteToggle.title = "Add an optional note";
  noteToggle.setAttribute("aria-label", "Add an optional note");

  Object.assign(noteToggle.style, {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "28px",
    padding: "0",
    border: "1px solid #777",
    borderRadius: "50%",
    background: "#292929",
    color: "#fff",
    fontSize: "18px",
    lineHeight: "1",
    cursor: "pointer",
    flex: "0 0 auto",
  });

  // Note input: hidden until the + icon is clicked.
  const noteInput = document.createElement("input");
  noteInput.type = "text";
  noteInput.className = "acv-watch-note-input";
  noteInput.placeholder = "Add a note (optional)";
  noteInput.setAttribute("aria-label", "Optional note");

  Object.assign(noteInput.style, {
    display: "none",
    width: "180px",
    maxWidth: "35vw",
    minWidth: "100px",
    height: "34px",
    padding: "0 9px",
    border: "1px solid #777",
    borderRadius: "8px",
    background: "#212121",
    color: "#fff",
    fontSize: "12px",
    boxSizing: "border-box",
  });

  // Status message displayed below the controls.
  const status = document.createElement("div");
  status.className = "acv-watch-save-status";

  Object.assign(status.style, {
    display: "none",
    position: "absolute",
    top: "calc(100% + 6px)",
    right: "0",
    zIndex: "2147483647",
    width: "240px",
    padding: "8px 10px",
    borderRadius: "8px",
    background: "#202020",
    color: "#fff",
    fontSize: "12px",
    lineHeight: "1.4",
    whiteSpace: "normal",
    overflowWrap: "anywhere",
    boxShadow: "0 4px 16px rgba(0,0,0,.35)",
  });

  function setStatus(message, isError = true) {
    status.textContent = message;
    status.style.display = "block";
    status.style.border = isError
      ? "1px solid #ef4444"
      : "1px solid #22c55e";
    status.style.color = isError ? "#fecaca" : "#bbf7d0";
  }

  // Toggle the optional note input.
  noteToggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    const opening = noteInput.style.display === "none";

    noteInput.style.display = opening ? "inline-block" : "none";
    noteToggle.textContent = opening ? "−" : "+";
    noteToggle.title = opening ? "Hide note" : "Add an optional note";
    noteToggle.setAttribute(
      "aria-label",
      opening ? "Hide optional note" : "Add an optional note"
    );

    if (opening) noteInput.focus();
  });

  let saving = false;
  let saved = false;

  // -------------------------------------------------------
  // Save video through the existing background worker
  // -------------------------------------------------------

  async function saveCurrentVideo() {
    if (saving || saved) return;

    const current = acvGetCurrentVideoDetails();

    if (
      !current ||
      current.videoUrl !== wrapper.dataset.url
    ) {
      const message = "The video changed. Please try again.";
      setStatus(message);
      acvShowToast(message, "error");
      return;
    }

    saving = true;
    button.disabled = true;
    button.textContent = "Saving...";
    status.style.display = "none";

    try {
      const response = await chrome.runtime.sendMessage({
        type: "ACV_SAVE_LINK",
        url: current.videoUrl,
        note: noteInput.value.trim(),
      });

      if (!response) {
        const message =
          "No response from the extension. Reload it and try again.";

        setStatus(message);
        acvShowToast(message, "error");
        return;
      }

      // Metadata could not be fetched; ask for a note.
      if (response.requiresNote) {
        noteInput.style.display = "inline-block";
        noteToggle.textContent = "−";
        noteToggle.title = "Hide note";
        noteToggle.setAttribute("aria-label", "Hide optional note");

        button.textContent = "Save with note";

        const message =
          response.message ||
          "Couldn't fetch video details. Add a note, then save again.";

        setStatus(message);
        acvShowToast(message, "error");
        noteInput.focus();
        return;
      }

      // Handle errors, including duplicate links.
      if (!response.success) {
        let message;

        if (response.status === 401) {
          message =
            "Please sign in to AI Content Vault from the extension.";
        } else if (response.status === 409) {
          message =
            response.error ||
            "Link already exists in your Content Vault.";
        } else {
          message =
            response.error ||
            "Couldn't save this video. Please try again.";
        }

        setStatus(message);
        acvShowToast(message, "error");
        return;
      }

      // Save succeeded.
      saved = true;
      button.textContent = "✓ Saved";
      button.disabled = true;
      button.style.background = "#166534";
      noteToggle.disabled = true;
      noteInput.disabled = true;

      setStatus("Link saved to AI Content Vault!", false);
      acvShowToast("Link saved to AI Content Vault!", "success");
    } catch (error) {
      console.error("ACV: Watch-page save failed:", error);

      const message =
        "Couldn't contact the extension. Reload it and try again.";

      setStatus(message);
      acvShowToast(message, "error");
    } finally {
      saving = false;

      // Don't re-enable the button after a successful save.
      if (!saved) {
        button.disabled = false;

        if (button.textContent === "Saving...") {
          button.textContent = "🔖 Save to Vault";
        }
      }
    }
  }

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    saveCurrentVideo();
  });

  noteInput.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  noteInput.addEventListener("keydown", (event) => {
    event.stopPropagation();

    if (event.key === "Enter") {
      event.preventDefault();
      saveCurrentVideo();
    }
  });

  wrapper.append(button, noteToggle, noteInput, status);

  return wrapper;
}

// ---------------------------------------------------------
// Inject beside Like/Dislike
// ---------------------------------------------------------

function acvInjectWatchPageButton() {
  const details = acvGetCurrentVideoDetails();

  if (!details) {
    document
      .querySelectorAll(".acv-watch-save-wrapper")
      .forEach((element) => element.remove());

    acvWatchButtonUrl = "";
    return;
  }

  const row = acvFindWatchActionRow();

  // YouTube may not have rendered the action row yet.
  if (!row) return;

  const existing = row.querySelector(
    ".acv-watch-save-wrapper"
  );

  if (
    existing &&
    existing.dataset.url === details.videoUrl
  ) {
    return;
  }

  // Remove buttons belonging to a previous video.
  document
    .querySelectorAll(".acv-watch-save-wrapper")
    .forEach((element) => element.remove());

  const wrapper = acvCreateWatchSaveButton(details);

  // Locate Like and its combined Like/Dislike group.
  const likeButton = [
    ...row.querySelectorAll(
      "button, yt-button-shape, ytd-toggle-button-renderer, a"
    ),
  ].find((element) =>
    /like/i.test(
      `${element.getAttribute("aria-label") || ""} ${
        element.getAttribute("title") || ""
      } ${element.textContent || ""}`
    )
  );

  if (likeButton) {
    const likeGroup =
      likeButton.closest(
        "ytd-segmented-like-dislike-button-renderer"
      ) ||
      likeButton.closest(
        "segmented-like-dislike-button-view-model"
      ) ||
      likeButton.parentElement?.parentElement;

    if (likeGroup && row.contains(likeGroup)) {
      likeGroup.insertAdjacentElement("afterend", wrapper);
    } else {
      likeButton.insertAdjacentElement("afterend", wrapper);
    }
  } else {
    row.appendChild(wrapper);
  }

  acvWatchButtonUrl = details.videoUrl;

  console.log(
    "ACV: Watch-page button injected for:",
    details.videoUrl
  );
}

// ---------------------------------------------------------
// YouTube single-page navigation support
// ---------------------------------------------------------

function acvScheduleWatchButtonInjection() {
  if (acvWatchObserverTimer) {
    clearTimeout(acvWatchObserverTimer);
  }

  acvWatchObserverTimer = setTimeout(
    acvInjectWatchPageButton,
    350
  );
}

document.addEventListener(
  "yt-navigate-finish",
  acvScheduleWatchButtonInjection
);

window.addEventListener(
  "popstate",
  acvScheduleWatchButtonInjection
);

// Detect when YouTube replaces the video or action row.
const acvWatchPageObserver = new MutationObserver(() => {
  if (acvHomeMenuVideo) {
    acvScheduleHomepageMenuInjection();
  }

  const current = acvGetCurrentVideoDetails();

  if (!current) {
    if (acvWatchButtonUrl) {
      acvScheduleWatchButtonInjection();
    }
    return;
  }

  const buttonExists = document.querySelector(
    ".acv-watch-save-wrapper"
  );

  if (
    current.videoUrl !== acvWatchButtonUrl ||
    !buttonExists
  ) {
    acvScheduleWatchButtonInjection();
  }
});

acvWatchPageObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

// Initial injection and retries for slower page rendering.
acvScheduleWatchButtonInjection();
setTimeout(acvScheduleWatchButtonInjection, 1000);
setTimeout(acvScheduleWatchButtonInjection, 2500);
