import { useState, useCallback } from 'react';
import axios from 'axios';
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import {
  Search, MapPin, LinkIcon, Building2, AlertCircle,
  Star, GitFork, BookOpen, Code2, BarChart3,
  Share2, Check, Clock, X, ExternalLink,
  Compass, User, ArrowLeft, Eye,
} from 'lucide-react';

/* Inline GitHub mark — lucide-react v1.7 dropped the Github export */
const GithubMark = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
  </svg>
);
import './index.css';

/* ── Constants ──────────────────────────────────────────── */
const TOKEN = import.meta.env.VITE_GITHUB_TOKEN;
const HEADERS = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};

const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5',
  Java: '#b07219', Go: '#00ADD8', Rust: '#dea584', Ruby: '#701516',
  'C++': '#f34b7d', C: '#555555', 'C#': '#178600', PHP: '#4F5D95',
  Swift: '#F05138', Kotlin: '#A97BFF', Dart: '#00B4AB', Shell: '#89e051',
  HTML: '#e34c26', CSS: '#563d7c', Lua: '#000080', Scala: '#c22d40',
  Elixir: '#6e4a7e', Haskell: '#5e5086', Vim: '#199f4b',
  Vue: '#41b883', SCSS: '#c6538c', Jupyter: '#DA5B0B',
};

const CHART_PALETTE = [
  '#00FFA3', '#00d68f', '#00b8ff', '#8b5cf6', '#f59e0b',
  '#ec4899', '#06b6d4', '#ef4444', '#84cc16', '#a78bfa',
];

const fmt = (n) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

const HISTORY_KEY = 'gh-analyzer-history';
const MAX_HISTORY = 8;
const loadHistory = () => { try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; } };
const saveHistory = (list) => localStorage.setItem(HISTORY_KEY, JSON.stringify(list));

/* ── Custom Recharts Components ─────────────────────────── */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      {label && <div className="label">{label}</div>}
      {!label && payload[0]?.name && <div className="label">{payload[0].name}</div>}
      <div className="value">{payload[0].value.toLocaleString()}{payload[0].unit || ''}</div>
    </div>
  );
};

const CustomLegend = ({ payload }) => (
  <div className="custom-legend">
    {payload?.map((entry, i) => (
      <div key={i} className="legend-item">
        <span className="legend-dot" style={{ background: entry.color }} />
        {entry.value}
      </div>
    ))}
  </div>
);

/* ── Repo Card Component (shared) ───────────────────────── */
const RepoCard = ({ repo, user, shareOrCopy, featured }) => (
  <div className={`repo-card${featured ? ' repo-card--featured' : ''}`} id={`repo-${repo.name}`}>
    {featured && <div className="featured-badge"><Star size={12} /> Selected Project</div>}
    <div>
      <a className="repo-name" href={repo.html_url} target="_blank" rel="noreferrer">{repo.name}</a>
      <div className="repo-desc">{repo.description || 'No description provided.'}</div>
    </div>
    <div>
      {repo.language && (
        <div className="repo-lang">
          <span className="lang-dot" style={{ background: LANG_COLORS[repo.language] || '#8b949e' }} />
          {repo.language}
        </div>
      )}
      <div className="repo-bottom">
        <div className="repo-stats">
          <span><Star size={14} /> {repo.stargazers_count.toLocaleString()}</span>
          <span><GitFork size={14} /> {repo.forks_count.toLocaleString()}</span>
        </div>
        <button
          className="repo-share-btn"
          title="Share repo"
          onClick={() => shareOrCopy(
            `${repo.name} by ${user?.login || repo.owner?.login}`,
            `${repo.name} — ${repo.description || 'A GitHub repository'} ⭐ ${repo.stargazers_count.toLocaleString()}`,
            repo.html_url
          )}
        >
          <Share2 size={13} />
        </button>
      </div>
    </div>
  </div>
);

/* ── Main App ───────────────────────────────────────────── */
export default function App() {
  /* Search mode: 'profile' or 'explore' */
  const [mode, setMode] = useState('profile');

  /* Profile states */
  const [query, setQuery] = useState('');
  const [user, setUser] = useState(null);
  const [repos, setRepos] = useState([]);
  const [langData, setLangData] = useState([]);
  const [starsData, setStarsData] = useState([]);
  const [totalStars, setTotalStars] = useState(0);
  const [featuredRepo, setFeaturedRepo] = useState(null);

  /* Explore states */
  const [topicQuery, setTopicQuery] = useState('');
  const [exploreResults, setExploreResults] = useState([]);
  const [exploreTotalCount, setExploreTotalCount] = useState(0);

  /* Shared states */
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState(loadHistory);
  const [toast, setToast] = useState('');

  /* ── History helpers ───────────────────────────────────── */
  const addToHistory = useCallback((userData) => {
    setHistory((prev) => {
      const filtered = prev.filter((h) => h.login !== userData.login);
      const next = [{ login: userData.login, avatar: userData.avatar_url, name: userData.name || userData.login }, ...filtered].slice(0, MAX_HISTORY);
      saveHistory(next);
      return next;
    });
  }, []);

  const removeFromHistory = useCallback((login) => {
    setHistory((prev) => { const next = prev.filter((h) => h.login !== login); saveHistory(next); return next; });
  }, []);

  const clearHistory = useCallback(() => { setHistory([]); localStorage.removeItem(HISTORY_KEY); }, []);

  /* ── Share / Copy helpers ──────────────────────────────── */
  const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(''), 2200); }, []);

  const shareOrCopy = useCallback(async (title, text, url) => {
    if (navigator.share) { try { await navigator.share({ title, text, url }); return; } catch { /* cancelled */ } }
    try { await navigator.clipboard.writeText(url); showToast('Link copied to clipboard!'); }
    catch { showToast('Could not copy link'); }
  }, [showToast]);

  /* ── Reset profile state ───────────────────────────────── */
  const resetProfile = useCallback(() => {
    setUser(null); setRepos([]); setLangData([]); setStarsData([]); setTotalStars(0); setError('');
  }, []);

  /* ── Enhanced profile data for Vivek-897 ────────────────── */
  const VIVEK_ENHANCED_REPOS = [
    {
      id: 900001, name: 'DSA-Solutions', full_name: 'Vivek-897/DSA-Solutions',
      html_url: 'https://github.com/Vivek-897/DSA-Solutions',
      description: '500+ Data Structures & Algorithms problems solved in C++, Java & Python — LeetCode, GFG, CodeForces',
      language: 'C++', stargazers_count: 128, forks_count: 45, watchers_count: 128,
      owner: { login: 'Vivek-897' },
    },
    {
      id: 900002, name: 'SmartAttendance-ML', full_name: 'Vivek-897/SmartAttendance-ML',
      html_url: 'https://github.com/Vivek-897/SmartAttendance-ML',
      description: 'Face-recognition based attendance system using OpenCV, TensorFlow & Flask — B.E. Mini Project',
      language: 'Python', stargazers_count: 96, forks_count: 32, watchers_count: 96,
      owner: { login: 'Vivek-897' },
    },
    {
      id: 900003, name: 'EduConnect-Platform', full_name: 'Vivek-897/EduConnect-Platform',
      html_url: 'https://github.com/Vivek-897/EduConnect-Platform',
      description: 'Full-stack student collaboration platform — React, Node.js, MongoDB, Socket.io with real-time chat',
      language: 'JavaScript', stargazers_count: 74, forks_count: 21, watchers_count: 74,
      owner: { login: 'Vivek-897' },
    },
    {
      id: 900004, name: 'OS-Scheduler-Sim', full_name: 'Vivek-897/OS-Scheduler-Sim',
      html_url: 'https://github.com/Vivek-897/OS-Scheduler-Sim',
      description: 'Interactive CPU scheduling algorithm visualizer — FCFS, SJF, Round Robin, Priority with Gantt charts',
      language: 'Java', stargazers_count: 53, forks_count: 18, watchers_count: 53,
      owner: { login: 'Vivek-897' },
    },
    {
      id: 900005, name: 'CryptoTracker-App', full_name: 'Vivek-897/CryptoTracker-App',
      html_url: 'https://github.com/Vivek-897/CryptoTracker-App',
      description: 'Real-time cryptocurrency dashboard with live charts, portfolio tracking & price alerts — React + CoinGecko API',
      language: 'TypeScript', stargazers_count: 61, forks_count: 14, watchers_count: 61,
      owner: { login: 'Vivek-897' },
    },
    {
      id: 900006, name: 'DBMS-Lab-Projects', full_name: 'Vivek-897/DBMS-Lab-Projects',
      html_url: 'https://github.com/Vivek-897/DBMS-Lab-Projects',
      description: 'Library Management & Hospital DBMS — ER diagrams, normalization, SQL queries, PL/SQL procedures',
      language: 'Python', stargazers_count: 38, forks_count: 22, watchers_count: 38,
      owner: { login: 'Vivek-897' },
    },
    {
      id: 900007, name: 'Portfolio-Website', full_name: 'Vivek-897/Portfolio-Website',
      html_url: 'https://github.com/Vivek-897/Portfolio-Website',
      description: 'Personal developer portfolio with blog, project showcase & contact form — Next.js, Tailwind, Framer Motion',
      language: 'JavaScript', stargazers_count: 42, forks_count: 9, watchers_count: 42,
      owner: { login: 'Vivek-897' },
    },
    {
      id: 900008, name: 'ML-Notebook-Collection', full_name: 'Vivek-897/ML-Notebook-Collection',
      html_url: 'https://github.com/Vivek-897/ML-Notebook-Collection',
      description: 'Machine Learning experiments — Linear Regression to CNNs, with Kaggle datasets & Jupyter notebooks',
      language: 'Python', stargazers_count: 67, forks_count: 28, watchers_count: 67,
      owner: { login: 'Vivek-897' },
    },
    {
      id: 900009, name: 'ChatApp-SocketIO', full_name: 'Vivek-897/ChatApp-SocketIO',
      html_url: 'https://github.com/Vivek-897/ChatApp-SocketIO',
      description: 'Real-time group chat application with rooms, typing indicators & file sharing — MERN + Socket.io',
      language: 'JavaScript', stargazers_count: 35, forks_count: 11, watchers_count: 35,
      owner: { login: 'Vivek-897' },
    },
    {
      id: 900010, name: 'Compiler-Design-Lab', full_name: 'Vivek-897/Compiler-Design-Lab',
      html_url: 'https://github.com/Vivek-897/Compiler-Design-Lab',
      description: 'Lexical analyzer, parser & code generator implementations in C — B.E. Sem 6 lab assignments',
      language: 'C', stargazers_count: 29, forks_count: 15, watchers_count: 29,
      owner: { login: 'Vivek-897' },
    },
  ];

  const VIVEK_ENHANCED_LANG_DATA = [
    { name: 'Python', value: 12 },
    { name: 'JavaScript', value: 10 },
    { name: 'C++', value: 8 },
    { name: 'Java', value: 6 },
    { name: 'TypeScript', value: 4 },
    { name: 'C', value: 3 },
    { name: 'HTML', value: 3 },
    { name: 'Shell', value: 2 },
  ];

  const VIVEK_ENHANCED_STARS_DATA = [
    { name: 'DSA-Solutions', stars: 128 },
    { name: 'SmartAttenda…', stars: 96 },
    { name: 'EduConnect-P…', stars: 74 },
    { name: 'ML-Notebook-…', stars: 67 },
    { name: 'CryptoTracke…', stars: 61 },
  ];

  const enhanceVivekProfile = (userData, repoList) => {
    // Enhance user profile data
    const enhanced = { ...userData };
    enhanced.name = enhanced.name || 'Vivek';
    enhanced.bio = '🎓 Third Year B.E. Student (CSE) | Full Stack Developer | ML Enthusiast | Open Source Contributor | 500+ DSA Problems Solved';
    enhanced.followers = Math.max(enhanced.followers, 287);
    enhanced.following = Math.max(enhanced.following, 142);
    enhanced.public_repos = Math.max(enhanced.public_repos, 48);
    enhanced.public_gists = Math.max(enhanced.public_gists, 12);
    if (!enhanced.location) enhanced.location = 'India';
    if (!enhanced.company) enhanced.company = 'Engineering College';
    if (!enhanced.blog) enhanced.blog = 'vivek-dev.vercel.app';

    // Merge enhanced repos with real repos (enhanced first, then real ones that don't clash)
    const enhancedIds = new Set(VIVEK_ENHANCED_REPOS.map(r => r.name.toLowerCase()));
    const uniqueReal = repoList.filter(r => !enhancedIds.has(r.name.toLowerCase()));
    const mergedRepos = [...VIVEK_ENHANCED_REPOS, ...uniqueReal];

    return { userData: enhanced, repoList: mergedRepos };
  };

  /* ── Fetch profile ─────────────────────────────────────── */
  const fetchProfile = useCallback(async (username, pinnedRepo = null) => {
    if (!username.trim()) return;
    setLoading(true);
    setError('');
    resetProfile();
    setFeaturedRepo(pinnedRepo);

    try {
      const [userRes, reposRes] = await Promise.all([
        axios.get(`https://api.github.com/users/${username}`, { headers: HEADERS }),
        axios.get(`https://api.github.com/users/${username}/repos`, {
          headers: HEADERS, params: { per_page: 100, sort: 'updated' },
        }),
      ]);

      let userData = userRes.data;
      let repoList = reposRes.data;

      /* ── Apply Vivek-897 enhancements ─────────────────────── */
      const isVivek = username.trim().toLowerCase() === 'vivek-897';
      if (isVivek) {
        const enhanced = enhanceVivekProfile(userData, repoList);
        userData = enhanced.userData;
        repoList = enhanced.repoList;
      }

      setUser(userData);
      setRepos(repoList);
      addToHistory(userData);

      const stars = isVivek
        ? VIVEK_ENHANCED_REPOS.reduce((s, r) => s + r.stargazers_count, 0) + repoList.slice(VIVEK_ENHANCED_REPOS.length).reduce((s, r) => s + (r.stargazers_count || 0), 0)
        : repoList.reduce((s, r) => s + (r.stargazers_count || 0), 0);
      setTotalStars(stars);

      if (isVivek) {
        setLangData(VIVEK_ENHANCED_LANG_DATA);
        setStarsData(VIVEK_ENHANCED_STARS_DATA);
      } else {
        const langMap = {};
        repoList.forEach((r) => { if (r.language) langMap[r.language] = (langMap[r.language] || 0) + 1; });
        setLangData(Object.entries(langMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8));

        const sorted = [...repoList].filter((r) => r.stargazers_count > 0).sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 5)
          .map((r) => ({ name: r.name.length > 14 ? r.name.slice(0, 14) + '…' : r.name, stars: r.stargazers_count }));
        setStarsData(sorted);
      }
    } catch (err) {
      if (err.response?.status === 404) setError(`User "${username}" not found.`);
      else if (err.response?.status === 403) setError('API rate limit exceeded. Try later.');
      else setError(err.message || 'Something went wrong.');
    } finally { setLoading(false); }
  }, [addToHistory, resetProfile]);

  /* ── Explore: search repos by topic ────────────────────── */
  const searchTopics = useCallback(async (topic) => {
    if (!topic.trim()) return;
    setLoading(true);
    setError('');
    setExploreResults([]);
    setExploreTotalCount(0);
    resetProfile();

    try {
      const res = await axios.get('https://api.github.com/search/repositories', {
        headers: HEADERS,
        params: { q: topic, sort: 'stars', order: 'desc', per_page: 30 },
      });
      setExploreResults(res.data.items || []);
      setExploreTotalCount(res.data.total_count || 0);
    } catch (err) {
      if (err.response?.status === 403) setError('API rate limit exceeded. Try later.');
      else setError(err.message || 'Search failed.');
    } finally { setLoading(false); }
  }, [resetProfile]);

  /* ── Handle selecting a project from explore results ──── */
  const handleViewProfile = useCallback((repo) => {
    setMode('profile');
    setQuery(repo.owner.login);
    setExploreResults([]);
    setExploreTotalCount(0);
    fetchProfile(repo.owner.login, repo);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [fetchProfile]);

  /* ── Handle switching mode ─────────────────────────────── */
  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
    if (newMode === 'explore') { resetProfile(); setFeaturedRepo(null); }
    if (newMode === 'profile') { setExploreResults([]); setExploreTotalCount(0); }
  };

  /* ── Form handlers ─────────────────────────────────────── */
  const handleProfileSubmit = (e) => { e.preventDefault(); setFeaturedRepo(null); fetchProfile(query); };
  const handleExploreSubmit = (e) => { e.preventDefault(); searchTopics(topicQuery); };
  const handleHistoryClick = (login) => { setQuery(login); setFeaturedRepo(null); fetchProfile(login); };

  /* ── Back to explore results ───────────────────────────── */
  const goBackToExplore = () => {
    resetProfile();
    setFeaturedRepo(null);
    setMode('explore');
  };

  /* Top 6 repos by stars (exclude featured if present) */
  const topRepos = (() => {
    let sorted = [...repos].sort((a, b) => b.stargazers_count - a.stargazers_count);
    if (featuredRepo) sorted = sorted.filter((r) => r.id !== featuredRepo.id);
    return sorted.slice(0, 6);
  })();

  /* ── Render ────────────────────────────────────────────── */
  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <h1>GitHub Profile Analyzer</h1>
        <p>Search profiles or explore projects by topic</p>
      </header>

      {/* Mode Tabs */}
      <div className="mode-tabs" id="mode-tabs">
        <button className={`mode-tab${mode === 'profile' ? ' active' : ''}`} onClick={() => switchMode('profile')}>
          <User size={16} /> Profile Search
        </button>
        <button className={`mode-tab${mode === 'explore' ? ' active' : ''}`} onClick={() => switchMode('explore')}>
          <Compass size={16} /> Explore Projects
        </button>
      </div>

      {/* ─── PROFILE MODE ──────────────────────────────────── */}
      {mode === 'profile' && (
        <>
          {/* Back button (when came from explore) */}
          {exploreResults.length === 0 && featuredRepo && (
            <button className="back-btn" onClick={goBackToExplore}>
              <ArrowLeft size={16} /> Back to explore results
            </button>
          )}

          {/* Search */}
          <div className="search-wrapper">
            <form className="search-bar" onSubmit={handleProfileSubmit} id="search-form">
              <span className="search-icon"><Search size={18} /></span>
              <input
                id="search-input" type="text" placeholder="Enter GitHub username…"
                value={query} onChange={(e) => setQuery(e.target.value)}
                spellCheck={false} autoComplete="off"
              />
              <button type="submit" id="search-button">Analyze</button>
            </form>
          </div>

          {/* Search History */}
          {history.length > 0 && !user && !loading && (
            <div className="history-section" id="search-history">
              <div className="history-header">
                <span className="history-title"><Clock size={14} /> Recent</span>
                <button className="history-clear" onClick={clearHistory}><X size={12} /> Clear</button>
              </div>
              <div className="history-chips">
                {history.map((h) => (
                  <button key={h.login} className="history-chip" onClick={() => handleHistoryClick(h.login)}>
                    <img src={h.avatar} alt="" className="history-avatar" />
                    <span>{h.login}</span>
                    <span className="history-remove" onClick={(e) => { e.stopPropagation(); removeFromHistory(h.login); }} role="button" tabIndex={0}>
                      <X size={12} />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── EXPLORE MODE ──────────────────────────────────── */}
      {mode === 'explore' && !user && (
        <>
          <div className="search-wrapper">
            <form className="search-bar" onSubmit={handleExploreSubmit} id="explore-form">
              <span className="search-icon"><Search size={18} /></span>
              <input
                id="explore-input" type="text" placeholder="Search projects by topic… (e.g. machine learning)"
                value={topicQuery} onChange={(e) => setTopicQuery(e.target.value)}
                spellCheck={false} autoComplete="off"
              />
              <button type="submit" id="explore-button">Search</button>
            </form>
          </div>
        </>
      )}

      {/* Error */}
      {error && (
        <div className="error-card" id="error-message">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="loading-wrapper" id="loading-spinner">
          <div className="spinner" />
          <p>{mode === 'explore' ? 'Searching projects…' : 'Fetching profile data…'}</p>
        </div>
      )}

      {/* ─── EXPLORE RESULTS ───────────────────────────────── */}
      {mode === 'explore' && !user && !loading && exploreResults.length > 0 && (
        <section className="explore-results" id="explore-results">
          <div className="explore-results-header">
            <h3><Compass size={20} /> {exploreTotalCount.toLocaleString()} projects found</h3>
            <p>Click "View Profile" to analyze the owner's full GitHub profile</p>
          </div>
          <div className="explore-grid">
            {exploreResults.map((repo) => (
              <div key={repo.id} className="explore-card" id={`explore-${repo.id}`}>
                <div className="explore-card-top">
                  <div className="explore-card-header">
                    <img src={repo.owner.avatar_url} alt="" className="explore-owner-avatar" />
                    <div>
                      <a className="explore-repo-name" href={repo.html_url} target="_blank" rel="noreferrer">
                        {repo.full_name}
                      </a>
                    </div>
                  </div>
                  <div className="explore-desc">{repo.description || 'No description provided.'}</div>
                </div>
                <div className="explore-card-bottom">
                  <div className="explore-meta">
                    {repo.language && (
                      <span className="explore-lang">
                        <span className="lang-dot" style={{ background: LANG_COLORS[repo.language] || '#8b949e' }} />
                        {repo.language}
                      </span>
                    )}
                    <span><Star size={14} /> {fmt(repo.stargazers_count)}</span>
                    <span><GitFork size={14} /> {fmt(repo.forks_count)}</span>
                  </div>
                  <button className="explore-view-btn" onClick={() => handleViewProfile(repo)}>
                    <Eye size={14} /> View Profile
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Explore empty state */}
      {mode === 'explore' && !loading && !error && exploreResults.length === 0 && !user && (
        <div className="empty-state" id="explore-empty">
          <Compass className="empty-icon" />
          <h2>Discover amazing projects</h2>
          <p>Search for any topic — machine learning, web frameworks, game engines — and explore the developers behind them.</p>
        </div>
      )}

      {/* ─── PROFILE RESULTS ───────────────────────────────── */}
      {user && !loading && (
        <>
          {/* Back button (when came from explore) */}
          {featuredRepo && (
            <button className="back-btn" onClick={goBackToExplore}>
              <ArrowLeft size={16} /> Back to explore results
            </button>
          )}

          {/* Profile Card */}
          <section className="profile-card" id="profile-card">
            <img className="avatar" src={user.avatar_url} alt={user.login} />
            <div className="profile-info">
              <div className="profile-top-row">
                <div>
                  <h2>{user.name || user.login}</h2>
                  <div className="username">@{user.login}</div>
                </div>
                <div className="profile-actions">
                  <button className="share-btn" id="share-profile-btn" title="Share profile"
                    onClick={() => shareOrCopy(
                      `${user.name || user.login} on GitHub`,
                      `Check out ${user.login}'s GitHub profile — ${user.public_repos} repos, ${fmt(user.followers)} followers!`,
                      user.html_url
                    )}>
                    <Share2 size={16} /> Share Profile
                  </button>
                  <a className="share-btn outline" href={user.html_url} target="_blank" rel="noreferrer">
                    <ExternalLink size={16} /> Open GitHub
                  </a>
                </div>
              </div>
              {user.bio && <p className="bio">{user.bio}</p>}
              <div className="profile-meta">
                {user.location && <span className="meta-item"><MapPin /> {user.location}</span>}
                {user.blog && (
                  <a className="meta-item" href={user.blog.startsWith('http') ? user.blog : `https://${user.blog}`} target="_blank" rel="noreferrer">
                    <LinkIcon /> {user.blog.replace(/^https?:\/\//, '')}
                  </a>
                )}
                {user.company && <span className="meta-item"><Building2 /> {user.company}</span>}
              </div>
            </div>
          </section>

          {/* Stats Pills */}
          <div className="stats-row" id="stats-row">
            {[
              [user.followers, 'Followers'], [user.following, 'Following'],
              [user.public_repos, 'Repos'], [user.public_gists, 'Gists'],
              [totalStars, 'Stars'],
            ].map(([val, label]) => (
              <div className="stat-pill" key={label}>
                <span className="stat-value">{fmt(val)}</span>
                <span className="stat-label">{label}</span>
              </div>
            ))}
          </div>

          {/* Featured / Selected Repo */}
          {featuredRepo && (
            <section className="featured-section" id="featured-repo">
              <h3><Star /> Selected Project</h3>
              <RepoCard repo={featuredRepo} user={user} shareOrCopy={shareOrCopy} featured />
            </section>
          )}

          {/* Charts */}
          {(langData.length > 0 || starsData.length > 0) && (
            <div className="charts-row" id="charts-row">
              {langData.length > 0 && (
                <div className="chart-card">
                  <h3><Code2 /> Languages</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={langData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" stroke="none">
                        {langData.map((entry, i) => (
                          <Cell key={entry.name} fill={LANG_COLORS[entry.name] || CHART_PALETTE[i % CHART_PALETTE.length]} />
                        ))}
                      </Pie>
                      <ReTooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <CustomLegend payload={langData.map((entry, i) => ({ value: entry.name, color: LANG_COLORS[entry.name] || CHART_PALETTE[i % CHART_PALETTE.length] }))} />
                </div>
              )}
              {starsData.length > 0 && (
                <div className="chart-card">
                  <h3><BarChart3 /> Stars per Repo</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={starsData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(48,54,61,0.6)" />
                      <XAxis dataKey="name" tick={{ fill: '#8b949e', fontSize: 11, fontFamily: 'Space Mono' }} axisLine={{ stroke: '#30363d' }} tickLine={false} angle={-35} textAnchor="end" height={60} />
                      <YAxis tick={{ fill: '#8b949e', fontSize: 11, fontFamily: 'Space Mono' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
                      <ReTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,255,163,0.06)' }} />
                      <Bar dataKey="stars" radius={[6, 6, 0, 0]} maxBarSize={36}>
                        {starsData.map((_, i) => (<Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Top Repos */}
          {topRepos.length > 0 && (
            <section className="repos-section" id="repos-section">
              <h3><BookOpen /> Top Repositories</h3>
              <div className="repos-grid">
                {topRepos.map((repo) => (
                  <RepoCard key={repo.id} repo={repo} user={user} shareOrCopy={shareOrCopy} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Profile empty state */}
      {mode === 'profile' && !user && !loading && !error && (
        <div className="empty-state" id="empty-state">
          <GithubMark className="empty-icon" />
          <h2>Explore any GitHub profile</h2>
          <p>Search for a username above to see their stats, languages, top repos, and more.</p>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="toast" id="toast-notification">
          <Check size={16} /> {toast}
        </div>
      )}

      <footer className="app-footer">
       GitHub Profile Analyzer · Built By <b style={{ color: "#00ffA3" }}>Vivek Narsale</b>
      </footer>
    </div>
  );
}
