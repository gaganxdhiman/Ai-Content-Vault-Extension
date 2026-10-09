
console.log("ACV: YouTube script loaded");

document.addEventListener("click", (event) => {
  const menuButton = event.target.closest(
    'button[aria-label="More actions"]'
  );

  if (!menuButton) return;

  const card = menuButton.closest(
    "yt-lockup-view-model, ytm-rich-item-renderer, ytd-rich-item-renderer, ytd-video-renderer"
  );

  if (!card) return;

  const videoLink = card.querySelector(
    'a[href*="/watch?v="]'
  );

  if (!videoLink) return;

  const titleElement = card.querySelector(
    "h3 a, a#video-title"
  );

  const videoTitle =
    titleElement?.getAttribute("title") ||
    titleElement?.textContent.trim() ||
    "";

  // Wait for YouTube's menu to render
  setTimeout(() => {
    const menu = document.querySelector(
      "ytd-menu-popup-renderer, tp-yt-iron-dropdown"
    );

    if (!menu || menu.querySelector(".acv-save-button")) return;

    const saveButton = document.createElement("button");
    saveButton.className = "acv-save-button";
    saveButton.textContent = "🔖 Save to AI Content Vault";

   Object.assign(saveButton.style, {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  padding: "10px 14px",
  border: "1px solid #E2DEC9",
  borderRadius: "0px",
  background: "#1C1B18",
  color: "#F7F5F0",
  fontSize: "11px",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontWeight: "600",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  textAlign: "left",
  cursor: "pointer",
  margin: "4px 0",
  boxSizing: "border-box",
  transition: "all 0.15s ease",
});

// Hover state using the signature Rust accent (#C2410C)
saveButton.onmouseenter = () => {
  saveButton.style.background = "#C2410C";
  saveButton.style.borderColor = "#C2410C";
};

saveButton.onmouseleave = () => {
  saveButton.style.background = "#1C1B18";
  saveButton.style.borderColor = "#E2DEC9";
};

    saveButton.addEventListener("mouseenter", () => {
      saveButton.style.background = "#7c3aed";
    });

    saveButton.addEventListener("mouseleave", () => {
      saveButton.style.background = "#6d28d9";
    });

    saveButton.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      console.log("ACV: Save clicked");
      console.log("ACV: Video title:", videoTitle);
      console.log("ACV: Video URL:", videoLink.href);

      menu.remove();
    });

    menu.prepend(saveButton);

    console.log("ACV: Save button injected");
  }, 300);
});
