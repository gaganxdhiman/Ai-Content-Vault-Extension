import { useEffect, useState } from "react";
import "./App.css";
import Dashboard from "./components/Dashboard";

function App() {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    chrome.storage.local.get("token", (result) => {
      setToken(result.token || null);
      setLoading(false);
    });
  }, []);

  const handleGoogleLogin = () => {
    setLoginLoading(true);
    setError("");

    const authUrl =
      "https://aicontentvault.site/api/extension/auth/google";

    chrome.identity.launchWebAuthFlow(
      {
        url: authUrl,
        interactive: true,
      },
      async (redirectUrl) => {
        if (chrome.runtime.lastError) {
          setError(chrome.runtime.lastError.message);
          setLoginLoading(false);
          return;
        }

        if (!redirectUrl) {
          setError("No redirect URL received.");
          setLoginLoading(false);
          return;
        }

        try {
          const url = new URL(redirectUrl);
          const code = url.searchParams.get("code");

          if (!code) {
            throw new Error("Google authorization code missing.");
          }

          const response = await fetch(
            "https://aicontentvault.site/api/extension/auth/exchange",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ code }),
            }
          );

          const data = await response.json();

          if (!response.ok || !data.token) {
            throw new Error(data.error || "Google login failed.");
          }

          await chrome.storage.local.set({
            token: data.token,
          });

          setToken(data.token);
        } catch (err) {
          setError(err.message || "Login failed.");
        } finally {
          setLoginLoading(false);
        }
      }
    );
  };

  if (loading) {
    return (
      <div className="app">
        <div className="login-card loading-card">
          <p>Loading AI Content Vault...</p>
        </div>
      </div>
    );
  }

  if (token) {
    return (
      <Dashboard token={token} setLoading={setLoading} setToken={setToken} />
    );
  }

  return (
    <div className="app">
      <div className="login-card">
    

        <span className="badge-tag">[ LOGIN/REGISTER ]</span>
   
       

        <h1>AI Content Vault</h1>

        <p className="subtitle">
          Save it now. Find it whenever you need it.
        </p>

        <button
          className="google-btn"
          onClick={handleGoogleLogin}
          disabled={loginLoading}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M21.805 10.041H12v3.917h5.638c-.606 2-2.282 3.28-5.638 3.28a6.04 6.04 0 1 1 0-12.077c1.682 0 3.16.71 4.246 1.67l3.01-3.01C17.407 2.118 14.985 1 12 1a11 11 0 1 0 0 22c6.627 0 11-4.664 11-11 0-.738-.078-1.36-.195-1.959Z"
              fill="#FFC107"
            />
            <path
              d="M3.153 7.437 6.35 9.78A6.035 6.035 0 0 1 12 5.161c1.682 0 3.16.71 4.246 1.67l3.01-3.01C17.407 2.118 14.985 1 12 1a11 11 0 0 0-8.847 4.437Z"
              fill="#FF3D00"
            />
            <path
              d="M12 23c2.893 0 5.302-.956 7.07-2.598l-3.01-3.01c-.814.546-1.854.846-4.06.846-3.336 0-6.017-2.247-7.008-5.274L3.16 15.306A11 11 0 0 0 12 23Z"
              fill="#4CAF50"
            />
            <path
              d="M21.805 10.041H12v3.917h5.638c-.291.963-.825 1.785-1.578 2.434l3.01 3.01C20.82 17.798 23 14.655 23 12c0-.738-.078-1.36-.195-1.959Z"
              fill="#1976D2"
            />
          </svg>

          {loginLoading
            ? "Signing in..."
            : "Continue with Google →"}
        </button>

        {error && <p className="error-message">{error}</p>}

        <p className="terms">
          By continuing, you agree to use AI Content Vault.
        </p>
      </div>
    </div>
  );
}

export default App;