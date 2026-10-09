import { useState, useEffect } from "react";

const BookmarkIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
  </svg>
);

const InstagramIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

const YoutubeIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path>
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="currentColor"></polygon>
  </svg>
);

const Dashboard = ({ setLoading, token, setToken }) => {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({});

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(
          "https://aicontentvault.site/api/extension/stats",
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (response.ok) {
          setStats(data.stats);
          console.log(data.stats);
        }
      } catch (err) {
        console.error("Stats fetch error:", err);
      }
    };

    fetchStats();
  }, [token]);

  const handleLogout = async () => {
    await chrome.storage.local.remove("token");
    setToken(null);
  };

  useEffect(() => {
    const loadUser = async () => {
      try {
        const { token } = await chrome.storage.local.get("token");

        if (!token) {
          setToken(null);
          return;
        }

        setToken(token);

        const response = await fetch(
          "https://aicontentvault.site/api/extension/me",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.status === 401) {
          await chrome.storage.local.remove("token");
          setToken(null);
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to load user details.");
        }

        const data = await response.json();
        setUser(data.user);
      } catch (error) {
        console.error("Profile loading failed:", error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const openVault = () => {
    chrome.tabs.create({
      url: "https://aicontentvault.site",
    });
  };

  return (
    <div className="app">
      <div className="dashboard">
        <header className="dashboard-header">
          <div className="brand">
            <div className="logo">
              <span>AI</span>
            </div>

            <div>
              <h1>AI Content Vault</h1>
              <p className="subtitle">Your personal library</p>
            </div>
          </div>

          <button className="logout-btn" onClick={handleLogout}>
            Log out
          </button>
        </header>

        <section className="profile-section">
          <div className="avatar">
            {user?.email ? user.email.charAt(0).toUpperCase() : "A"}
          </div>

          <div className="profile-info">
            <p className="section-label">SIGNED IN AS</p>
            <p className="email">{user?.email || "Loading..."}</p>
          </div>

          <span className="status-dot" />
        </section>

        <section className="stats-grid">
          <div className="stat-card">
            <span className="stat-icon">
              <BookmarkIcon />
            </span>
            <h2>{stats.totalLinks ?? 0}</h2>
            <p>Saved links</p>
          </div>

          <div className="stat-card">
            <span className="stat-icon">
              <InstagramIcon />
            </span>
            <h2>{stats.instagramLinks ?? 0}</h2>
            <p>Instagram</p>
          </div>

          <div className="stat-card">
            <span className="stat-icon">
              <YoutubeIcon />
            </span>
            <h2>{stats.youtubeLinks ?? 0}</h2>
            <p>YouTube</p>
          </div>
        </section>

        <section className="quick-action">
          <h3>Ready to save?</h3>
          <p>
            Open an Instagram Reel or YouTube video and save it directly to your vault.
          </p>

          <button className="primary-btn" onClick={openVault}>
            Open Content Vault ↗
          </button>
        </section>

        <p className="footer-note">
          Save it now. Find it whenever you need it.
        </p>
      </div>
    </div>
  );
};

export default Dashboard;