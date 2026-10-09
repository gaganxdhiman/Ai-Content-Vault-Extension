import { useState, useEffect } from "react";

const dummyUser = {
  name: "Gaganpreet Singh",
  email: "gagan@example.com",
};

const dummyStats = {
  totalLinks: 128,
  instagramLinks: 76,
};

const Dashboard = ({setLoading, token, setToken}) => {
     const [user, setUser] = useState(null);
    const [stats, setStats] = useState({})


useEffect(async () => {
    
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
  console.log(data.stats)
}
}, [])



     const handleLogout = async () => {
    await chrome.storage.local.remove("token");
    setToken(null);
    setError("");
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
                <p className="subtitle">
                  Your personal content library
                </p>
              </div>
            </div>

            <button
              className="logout-btn"
              onClick={handleLogout}
            >
              Log out
            </button>
          </header>

          <section className="profile-section">
            <div className="avatar">
              {dummyUser.name.charAt(0)}
            </div>

            <div className="profile-info">
              <p className="section-label">SIGNED IN AS</p>
              <h2><p className="email">{user?.email || "Loading..."}</p></h2>
              
            </div>

            <span className="status-dot" />
          </section>

          <section className="stats-grid">
            <div className="stat-card">
              <span className="stat-icon">🔖</span>
              <h2>{stats.totalLinks}</h2>
              <p>Saved links</p>
            </div>

            <div className="stat-card">
              <span className="stat-icon">📸</span>
              <h2>{stats.instagramLinks}</h2>
              <p>Instagram saves</p>
            </div>
            <div className="stat-card">
              <span className="stat-icon">📸</span>
              <h2>{stats.youtubeLinks}</h2>
              <p>Youtube saves</p>
            </div>
          </section>

          <section className="quick-action">
            <h3>Ready to save?</h3>
            <p>
              Open an Instagram Reel or post and save it
              directly to your vault.
            </p>

            <button
              className="primary-btn"
              onClick={openVault}
            >
              Open Content Vault ↗
            </button>
          </section>

          <p className="footer-note">
            Save it now. Find it whenever you need it.
          </p>
        </div>
      </div>
  )
}

export default Dashboard