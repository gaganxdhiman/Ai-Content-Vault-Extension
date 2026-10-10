
const API_URL = "https://aicontentvault.site/api/extension/links";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "ACV_SAVE_LINK") return;

  (async () => {
    try {
      const { token } = await chrome.storage.local.get("token");

      if (!token) {
        sendResponse({
          success: false,
          status: 401,
          error: "Please sign in to AI Content Vault first.",
        });
        return;
      }

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: message.url,
          note: message.note || "",
        }),
      });

      const data = await response.json().catch(() => ({}));

      sendResponse({
        ...data,
        success: response.ok && data.success === true,
        status: response.status,
      });
    } catch (error) {
      console.error("ACV background save error:", error);

      sendResponse({
        success: false,
        error: "Network error. Please try again.",
      });
    }
  })();

  return true;
});
