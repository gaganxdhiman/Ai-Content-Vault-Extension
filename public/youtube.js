console.log("ACV: YouTube script loaded");

let acvMenuSession = 0;

function acvShowToast(message, type = "success") {
  document.querySelector("#acv-toast")?.remove();

  const toast = document.createElement("div");
  toast.id = "acv-toast";
  toast.textContent = message;

  Object.assign(toast.style, {
    position: "fixed",
    right: "20px",
    bottom: "20px",
    zIndex: "2147483647",
    maxWidth: "320px",
    padding: "12px 16px",
    borderRadius: "10px",
    background: type === "success" ? "#166534" : "#991b1b",
    color: "#fff",
    font: "500 13px/1.4 system-ui, sans-serif",
    boxShadow: "0 8px 24px rgba(0,0,0,.35)",
  });

  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function acvCloseMenu(menuButton, wrapper) {
  wrapper.remove();

  setTimeout(() => {
    if (menuButton?.isConnected) {
      menuButton.click();
    } else {
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          code: "Escape",
          bubbles: true,
          cancelable: true,
        })
      );
    }
  }, 0);
}

// Get the URL from the exact card whose three-dot button was clicked.
function acvGetVideoDetails(menuButton) {
  const card = menuButton.closest(
    "yt-lockup-view-model, ytm-rich-item-renderer, ytd-rich-item-renderer, ytd-video-renderer"
  );

  if (!card) return null;

  const links = card.querySelectorAll(
    'a[href*="/watch?v="], a[href*="/shorts/"]'
  );

  // Prefer the link closest to the card's title.
  let videoLink = card.querySelector(
    'h3 a[href*="/watch?v="], h3 a[href*="/shorts/"], a#video-title[href*="/watch?v="], a#video-title[href*="/shorts/"]'
  );

  if (!videoLink) {
    videoLink = links[0];
  }

  if (!videoLink) return null;

  const videoUrl = new URL(
    videoLink.getAttribute("href"),
    location.origin
  ).href;

  const titleElement = card.querySelector(
    "h3 a, a#video-title"
  );

  const videoTitle =
    titleElement?.getAttribute("title") ||
    titleElement?.textContent?.trim() ||
    "";

  return { videoUrl, videoTitle };
}

function acvFindMenu() {
  const selectors = [
    "ytd-menu-popup-renderer",
    "ytm-menu-popup-renderer",
    "tp-yt-iron-dropdown",
    "tp-yt-paper-listbox",
  ];

  for (const selector of selectors) {
    const elements = [...document.querySelectorAll(selector)];

    // Use the currently visible menu, not an old hidden menu.
    const visibleMenu = elements.find((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);

      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden"
      );
    });

    if (visibleMenu) return visibleMenu;
  }

  return null;
}

function acvInjectSaveUI(menu, menuButton, videoDetails, session) {
  const { videoUrl, videoTitle } = videoDetails;

  // Remove any previous ACV UI before injecting the current one.
  document.querySelectorAll(".acv-wrapper").forEach((element) => {
    element.remove();
  });

  const wrapper = document.createElement("div");
  wrapper.className = "acv-wrapper";
  wrapper.dataset.session = String(session);
  wrapper.dataset.url = videoUrl;

  Object.assign(wrapper.style, {
    padding: "10px 12px",
    margin: "4px 0 8px",
    borderBottom: "1px solid rgba(255,255,255,.1)",
    fontFamily: "system-ui, sans-serif",
    boxSizing: "border-box",
    minWidth: "220px",
  });

  const row = document.createElement("div");

  Object.assign(row.style, {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  });

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.textContent = "🔖 Save to Vault";

  Object.assign(saveButton.style, {
    flex: "1",
    padding: "9px 12px",
    borderRadius: "8px",
    background: "#C2410C",
    border: "none",
    color: "#fff",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  });

  const noteToggle = document.createElement("button");
  noteToggle.type = "button";
  noteToggle.textContent = "+ Note";

  Object.assign(noteToggle.style, {
    padding: "9px 10px",
    borderRadius: "8px",
    background: "rgba(255,255,255,.08)",
    border: "1px solid rgba(255,255,255,.15)",
    color: "#F1F1F1",
    fontSize: "12px",
    cursor: "pointer",
  });

  const noteInput = document.createElement("input");
  noteInput.type = "text";
  noteInput.placeholder = "What is this video about?";

  Object.assign(noteInput.style, {
    display: "none",
    width: "100%",
    marginTop: "8px",
    padding: "8px 10px",
    background: "#0F0F0F",
    border: "1px solid rgba(255,255,255,.2)",
    borderRadius: "6px",
    color: "#fff",
    fontSize: "12px",
    boxSizing: "border-box",
  });

  const status = document.createElement("div");

  Object.assign(status.style, {
    display: "none",
    marginTop: "8px",
    fontSize: "12px",
    lineHeight: "1.4",
    color: "#FCA5A5",
    overflowWrap: "anywhere",
  });

  function setStatus(message, isError = true) {
    status.textContent = message;
    status.style.display = "block";
    status.style.color = isError ? "#FCA5A5" : "#86EFAC";
  }

  function revealNote(message) {
    noteInput.style.display = "block";
    noteToggle.textContent = "– Note";
    setStatus(message);
    noteInput.focus();
  }

  noteToggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    const hidden = noteInput.style.display === "none";

    noteInput.style.display = hidden ? "block" : "none";
    noteToggle.textContent = hidden ? "– Note" : "+ Note";

    if (hidden) noteInput.focus();
  });

  wrapper.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  noteInput.addEventListener("keydown", (event) => {
    event.stopPropagation();

    if (event.key === "Enter") {
      event.preventDefault();
      saveButton.click();
    }
  });

  let saving = false;

  async function saveLink() {
    if (saving) return;

    // Never save if this UI belongs to an older menu session.
    if (
      !wrapper.isConnected ||
      wrapper.dataset.session !== String(session) ||
      wrapper.dataset.url !== videoUrl
    ) {
      setStatus("Menu changed. Reopen this video's three-dot menu.");
      return;
    }

    saving = true;
    saveButton.disabled = true;
    saveButton.textContent = "Saving...";
    status.style.display = "none";

    try {
      console.log("ACV: Saving URL:", videoUrl);

      // Send request through the extension background worker.
      const data = await chrome.runtime.sendMessage({
        type: "ACV_SAVE_LINK",
        url: videoUrl,
        note: noteInput.value.trim(),
      });

      if (!data) {
        setStatus("No response from the extension. Reload it and try again.");
        return;
      }

      if (data.requiresNote) {
        revealNote(
          data.message ||
            "Couldn't fetch video details. Add a note to save it."
        );

        saveButton.textContent = "Save with note";
        return;
      }

      if (!data.success) {
        if (data.status === 401) {
          setStatus("Please sign in to AI Content Vault again.");
        } else if (data.status === 409) {
          setStatus(
            data.error || "This video is already in your Content Vault."
          );
        } else {
          setStatus(data.error || "Couldn't save this video.");
        }

        return;
      }

      acvCloseMenu(menuButton, wrapper);
      acvShowToast("Saved to AI Content Vault!");

      console.log("ACV: Successfully saved:", {
        title: videoTitle,
        url: videoUrl,
      });
    } catch (error) {
      console.error("ACV: Save failed:", error);

      setStatus(
        "Couldn't contact the extension background worker. Reload the extension and try again."
      );
    } finally {
      saving = false;
      saveButton.disabled = false;

      if (saveButton.isConnected && saveButton.textContent === "Saving...") {
        saveButton.textContent = "🔖 Save to Vault";
      }
    }
  }

  saveButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    saveLink();
  });

  row.appendChild(saveButton);
  row.appendChild(noteToggle);

  wrapper.appendChild(row);
  wrapper.appendChild(noteInput);
  wrapper.appendChild(status);

  menu.prepend(wrapper);

  console.log("ACV: Button injected for:", videoUrl);
}

// Capture each three-dot click separately.
document.addEventListener(
  "click",
  (event) => {
    const target = event.target;

    if (!(target instanceof Element)) return;

    const menuButton = target.closest(
      'button[aria-label="More actions"]'
    );

    if (!menuButton) return;

    const videoDetails = acvGetVideoDetails(menuButton);

    if (!videoDetails) {
      console.warn("ACV: Couldn't identify this video's URL.");
      return;
    }

    const session = ++acvMenuSession;

    setTimeout(() => {
      // Ignore delayed callbacks from older clicks.
      if (session !== acvMenuSession) return;

      const menu = acvFindMenu();

      if (!menu) {
        console.warn("ACV: YouTube menu wasn't found.");
        return;
      }

      acvInjectSaveUI(
        menu,
        menuButton,
        videoDetails,
        session
      );
    }, 300);
  },
  true
);