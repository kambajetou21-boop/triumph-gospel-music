import './styles.css';
import {
  login,
  signup,
  logout,
  getUser,
  handleAuthCallback,
  onAuthChange,
  AuthError,
} from '@netlify/identity';

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
const routes = {};
let currentCleanup = null;

function registerRoute(path, handler) {
  routes[path] = handler;
}

function navigate(path) {
  if (window.location.hash === '#' + path) {
    renderRoute(path);
    return;
  }
  window.location.hash = path;
}

function matchRoute(hash) {
  const path = hash.replace('#', '') || '/';
  if (routes[path]) return { handler: routes[path], params: {} };
  for (const pattern of Object.keys(routes)) {
    if (!pattern.includes(':')) continue;
    const parts = pattern.split('/');
    const segments = path.split('/');
    if (parts.length !== segments.length) continue;
    const params = {};
    let match = true;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].startsWith(':')) params[parts[i].slice(1)] = segments[i];
      else if (parts[i] !== segments[i]) { match = false; break; }
    }
    if (match) return { handler: routes[pattern], params };
  }
  return null;
}

async function renderRoute(hash) {
  if (currentCleanup) { currentCleanup(); currentCleanup = null; }
  const container = document.getElementById('page-content');
  if (!container) return;
  const match = matchRoute(hash || window.location.hash);
  if (match) {
    const cleanup = await match.handler(container, match.params);
    if (typeof cleanup === 'function') currentCleanup = cleanup;
  } else {
    container.innerHTML = '<div class="container" style="padding-top:4rem;text-align:center;"><h2>Page not found</h2></div>';
  }
  window.scrollTo(0, 0);
}

function startRouter() {
  window.addEventListener('hashchange', () => renderRoute(window.location.hash));
  renderRoute(window.location.hash);
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
const icons = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>',
  volume: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
  volumeMute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  music: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  disc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>',
  dollar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  barChart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
};

// ---------------------------------------------------------------------------
// Auth State
// ---------------------------------------------------------------------------
let currentUser = null;
const userListeners = [];

function onUserChange(fn) {
  userListeners.push(fn);
  return () => { const i = userListeners.indexOf(fn); if (i >= 0) userListeners.splice(i, 1); };
}

function notifyUserChange() {
  userListeners.forEach(fn => fn(currentUser));
}

function getCurrentUser() {
  return currentUser;
}

async function initAuth() {
  try {
    const result = await handleAuthCallback();
    if (result && result.user) {
      currentUser = result.user;
      notifyUserChange();
      return result;
    }
  } catch (_) { /* no callback */ }
  const user = await getUser();
  if (user) {
    currentUser = user;
    notifyUserChange();
  }
  return null;
}

async function doLogin(email, password) {
  const user = await login(email, password);
  currentUser = user;
  notifyUserChange();
  return user;
}

async function doSignup(email, password, name) {
  const user = await signup(email, password, { full_name: name });
  if (user.emailVerified) {
    currentUser = user;
    notifyUserChange();
  }
  return user;
}

async function doLogout() {
  await logout();
  currentUser = null;
  notifyUserChange();
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------
async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

async function apiUpload(url, formData) {
  const res = await fetch(url, { method: 'POST', body: formData });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Toast notifications
// ---------------------------------------------------------------------------
function toast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ---------------------------------------------------------------------------
// Music Player
// ---------------------------------------------------------------------------
let audio = null;
let currentTrack = null;
let isPlaying = false;
let playerVolume = 0.8;
const playerListeners = [];

function onPlayerChange(fn) {
  playerListeners.push(fn);
  return () => { const i = playerListeners.indexOf(fn); if (i >= 0) playerListeners.splice(i, 1); };
}

function notifyPlayer() {
  playerListeners.forEach(fn => fn({ track: currentTrack, isPlaying }));
}

async function playTrack(track) {
  if (currentTrack && currentTrack.id === track.id && audio) {
    if (audio.paused) { audio.play(); isPlaying = true; }
    else { audio.pause(); isPlaying = false; }
    notifyPlayer();
    return;
  }
  if (audio) { audio.pause(); audio.src = ''; }
  currentTrack = track;
  const src = `/api/stream/${encodeURIComponent(track.blobKey)}`;
  audio = new Audio(src);
  audio.volume = playerVolume;
  audio.addEventListener('ended', () => { isPlaying = false; notifyPlayer(); });
  audio.addEventListener('error', () => { isPlaying = false; notifyPlayer(); });
  try {
    await audio.play();
    isPlaying = true;
    notifyPlayer();
    api('/api/streams', { method: 'POST', body: JSON.stringify({ trackId: track.id }) }).catch(() => {});
  } catch {
    isPlaying = false;
    notifyPlayer();
  }
}

function togglePlay() {
  if (!audio) return;
  if (audio.paused) { audio.play(); isPlaying = true; }
  else { audio.pause(); isPlaying = false; }
  notifyPlayer();
}

function setVolume(v) {
  playerVolume = v;
  if (audio) audio.volume = v;
}

function getAudio() { return audio; }

function seekTo(fraction) {
  if (!audio || !audio.duration) return;
  audio.currentTime = fraction * audio.duration;
}

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

// -- HOME --
async function homePage(container) {
  const user = getCurrentUser();
  container.innerHTML = `
    <section class="hero">
      <div class="container">
        <div class="hero-content">
          <h1>Where <span class="gold">Bold Artists</span> Build Culture</h1>
          <p>Triumph Music Label is an independent powerhouse developing the next generation of artists. Stream exclusive music, support your favorites, and be part of something real.</p>
          <div class="hero-actions">
            <button class="btn btn-primary" id="hero-browse">Browse Music</button>
            ${user ? '' : '<button class="btn btn-outline" id="hero-join">Join Now</button>'}
          </div>
        </div>
      </div>
    </section>
    <section class="container" style="padding:4rem 2rem;">
      <h2 class="section-title">Featured Artists</h2>
      <p class="section-subtitle">Meet the voices shaping the sound of tomorrow</p>
      <div class="artist-grid" id="home-artists">
        <div class="skeleton" style="height:360px;border-radius:16px;"></div>
        <div class="skeleton" style="height:360px;border-radius:16px;"></div>
        <div class="skeleton" style="height:360px;border-radius:16px;"></div>
      </div>
    </section>
    <section class="container" style="padding:2rem 2rem 4rem;">
      <h2 class="section-title">Latest Tracks</h2>
      <p class="section-subtitle">Fresh releases from the label</p>
      <div class="track-grid" id="home-tracks">
        <div class="skeleton" style="height:280px;border-radius:16px;"></div>
        <div class="skeleton" style="height:280px;border-radius:16px;"></div>
        <div class="skeleton" style="height:280px;border-radius:16px;"></div>
        <div class="skeleton" style="height:280px;border-radius:16px;"></div>
      </div>
    </section>
  `;
  document.getElementById('hero-browse')?.addEventListener('click', () => navigate('/browse'));
  document.getElementById('hero-join')?.addEventListener('click', () => navigate('/login'));
  loadHomeArtists();
  loadHomeTracks();
}

async function loadHomeArtists() {
  try {
    const artists = await api('/api/artists');
    const el = document.getElementById('home-artists');
    if (!el) return;
    if (artists.length === 0) {
      el.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">${icons.user}<p>Artists coming soon</p></div>`;
      return;
    }
    el.innerHTML = artists.slice(0, 6).map(a => `
      <div class="artist-card" data-id="${a.id}">
        <div class="artist-card-img">
          ${a.imageUrl ? `<img src="${a.imageUrl}" alt="${a.name}"/>` : `<div style="width:100%;height:100%;background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;">${icons.user}</div>`}
        </div>
        <div class="artist-card-info">
          <div class="artist-card-name">${a.name}</div>
          <div class="artist-card-genre">${a.genre || 'Artist'}</div>
        </div>
      </div>
    `).join('');
    el.querySelectorAll('.artist-card').forEach(card => {
      card.addEventListener('click', () => navigate(`/artist/${card.dataset.id}`));
    });
  } catch {
    const el = document.getElementById('home-artists');
    if (el) el.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><p>Could not load artists</p></div>';
  }
}

async function loadHomeTracks() {
  try {
    const tracks = await api('/api/tracks');
    const el = document.getElementById('home-tracks');
    if (!el) return;
    if (tracks.length === 0) {
      el.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">${icons.music}<p>No tracks yet. Be the first to upload!</p></div>`;
      return;
    }
    renderTrackGrid(el, tracks.slice(0, 8));
  } catch {
    const el = document.getElementById('home-tracks');
    if (el) el.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><p>Could not load tracks</p></div>';
  }
}

function renderTrackGrid(el, tracks) {
  el.innerHTML = tracks.map(t => `
    <div class="track-card" data-track='${JSON.stringify(t).replace(/'/g, "&#39;")}'>
      <div class="track-card-cover">
        ${t.coverUrl ? `<img src="${t.coverUrl}" alt="${t.title}"/>` : `<div style="width:100%;height:100%;background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;">${icons.disc}</div>`}
        <div class="track-card-play">${icons.play}</div>
      </div>
      <div class="track-card-info">
        <div class="track-card-title">${t.title}</div>
        <div class="track-card-artist">${t.artistName || 'Unknown'}</div>
      </div>
    </div>
  `).join('');
  el.querySelectorAll('.track-card').forEach(card => {
    card.addEventListener('click', () => {
      const track = JSON.parse(card.dataset.track);
      playTrack(track);
    });
  });
}

// -- LOGIN --
async function loginPage(container) {
  if (getCurrentUser()) { navigate('/dashboard'); return; }
  let isSignup = false;

  function render() {
    container.innerHTML = `
      <div class="auth-page">
        <div class="auth-card">
          <h2>${isSignup ? 'Create Account' : 'Welcome Back'}</h2>
          <p class="subtitle">${isSignup ? 'Join Triumph Music Label' : 'Sign in to your account'}</p>
          <div id="auth-message"></div>
          <form id="auth-form">
            ${isSignup ? `<div class="form-group">
              <label>Full Name</label>
              <input type="text" id="auth-name" placeholder="Your name" required />
            </div>` : ''}
            <div class="form-group">
              <label>Email</label>
              <input type="email" id="auth-email" placeholder="you@example.com" required />
            </div>
            <div class="form-group">
              <label>Password</label>
              <input type="password" id="auth-password" placeholder="Min 8 characters" minlength="8" required />
            </div>
            <button type="submit" class="btn btn-primary" id="auth-submit">
              ${isSignup ? 'Create Account' : 'Sign In'}
            </button>
          </form>
          <div class="auth-toggle">
            ${isSignup
              ? 'Already have an account? <a href="#" id="toggle-auth">Sign in</a>'
              : 'Need an account? <a href="#" id="toggle-auth">Sign up</a>'}
          </div>
        </div>
      </div>
    `;
    document.getElementById('toggle-auth').addEventListener('click', e => {
      e.preventDefault();
      isSignup = !isSignup;
      render();
    });
    document.getElementById('auth-form').addEventListener('submit', handleSubmit);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const btn = document.getElementById('auth-submit');
    const msg = document.getElementById('auth-message');
    btn.disabled = true;
    btn.textContent = isSignup ? 'Creating...' : 'Signing in...';
    msg.innerHTML = '';
    try {
      if (isSignup) {
        const name = document.getElementById('auth-name').value;
        const user = await doSignup(email, password, name);
        if (user.emailVerified) {
          navigate('/dashboard');
        } else {
          msg.innerHTML = '<div class="auth-success">Check your email to confirm your account.</div>';
          btn.disabled = false;
          btn.textContent = 'Create Account';
        }
      } else {
        await doLogin(email, password);
        navigate('/dashboard');
      }
    } catch (err) {
      let message = 'Something went wrong. Please try again.';
      if (err instanceof AuthError) {
        if (err.status === 401) message = 'Invalid email or password.';
        else if (err.status === 403) message = 'Signups are not allowed at this time.';
        else if (err.status === 422) message = 'Invalid input. Check your email and password.';
        else message = err.message;
      }
      msg.innerHTML = `<div class="auth-error">${message}</div>`;
      btn.disabled = false;
      btn.textContent = isSignup ? 'Create Account' : 'Sign In';
    }
  }

  render();
}

// -- BROWSE --
async function browsePage(container) {
  container.innerHTML = `
    <div class="container" style="padding-top:2rem;">
      <h2 class="section-title">Browse Music</h2>
      <p class="section-subtitle">Discover tracks from Triumph artists</p>
      <div class="track-grid" id="browse-tracks">
        ${Array(8).fill('<div class="skeleton" style="height:280px;border-radius:16px;"></div>').join('')}
      </div>
      <h2 class="section-title" style="margin-top:4rem;">Artists</h2>
      <p class="section-subtitle">The roster</p>
      <div class="artist-grid" id="browse-artists">
        ${Array(4).fill('<div class="skeleton" style="height:360px;border-radius:16px;"></div>').join('')}
      </div>
    </div>
  `;
  loadBrowseTracks();
  loadBrowseArtists();
}

async function loadBrowseTracks() {
  try {
    const tracks = await api('/api/tracks');
    const el = document.getElementById('browse-tracks');
    if (!el) return;
    if (tracks.length === 0) {
      el.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">${icons.music}<p>No tracks uploaded yet</p></div>`;
      return;
    }
    renderTrackGrid(el, tracks);
  } catch {
    const el = document.getElementById('browse-tracks');
    if (el) el.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><p>Could not load tracks</p></div>';
  }
}

async function loadBrowseArtists() {
  try {
    const artists = await api('/api/artists');
    const el = document.getElementById('browse-artists');
    if (!el) return;
    if (artists.length === 0) {
      el.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">${icons.user}<p>No artists yet</p></div>`;
      return;
    }
    el.innerHTML = artists.map(a => `
      <div class="artist-card" data-id="${a.id}">
        <div class="artist-card-img">
          ${a.imageUrl ? `<img src="${a.imageUrl}" alt="${a.name}"/>` : `<div style="width:100%;height:100%;background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;">${icons.user}</div>`}
        </div>
        <div class="artist-card-info">
          <div class="artist-card-name">${a.name}</div>
          <div class="artist-card-genre">${a.genre || 'Artist'}</div>
        </div>
      </div>
    `).join('');
    el.querySelectorAll('.artist-card').forEach(card => {
      card.addEventListener('click', () => navigate(`/artist/${card.dataset.id}`));
    });
  } catch {
    const el = document.getElementById('browse-artists');
    if (el) el.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><p>Could not load artists</p></div>';
  }
}

// -- DASHBOARD --
async function dashboardPage(container) {
  const user = getCurrentUser();
  if (!user) { navigate('/login'); return; }

  let activeTab = 'overview';
  let artist = null;
  let streamData = null;
  let payoutData = null;

  container.innerHTML = '<div class="container" style="padding-top:2rem;"><div class="skeleton" style="height:400px;border-radius:16px;"></div></div>';

  try {
    const artists = await api('/api/artists');
    artist = artists.find(a => a.identityId === user.id);
  } catch { /* no profile yet */ }

  function render() {
    container.innerHTML = `
      <div class="container" style="padding-top:2rem;">
        <div class="dashboard-header">
          <div>
            <h1 style="font-family:var(--font-display);font-size:2rem;">
              ${artist ? `Welcome, ${artist.name}` : 'Artist Dashboard'}
            </h1>
            <p style="color:var(--text-secondary);font-size:0.9rem;">${user.email}</p>
          </div>
          ${artist ? '' : '<button class="btn btn-primary" id="create-profile-btn">Create Artist Profile</button>'}
        </div>
        ${artist ? `
          <div class="tabs">
            <button class="tab ${activeTab === 'overview' ? 'active' : ''}" data-tab="overview">Overview</button>
            <button class="tab ${activeTab === 'upload' ? 'active' : ''}" data-tab="upload">Upload</button>
            <button class="tab ${activeTab === 'profile' ? 'active' : ''}" data-tab="profile">Profile</button>
            <button class="tab ${activeTab === 'payouts' ? 'active' : ''}" data-tab="payouts">Payouts</button>
          </div>
          <div id="tab-content"></div>
        ` : '<div id="profile-setup"></div>'}
      </div>
    `;

    if (!artist) {
      const btn = document.getElementById('create-profile-btn');
      btn?.addEventListener('click', () => renderProfile(document.getElementById('profile-setup') || container, true));
      return;
    }

    container.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => { activeTab = tab.dataset.tab; render(); });
    });

    const tabContent = document.getElementById('tab-content');
    if (activeTab === 'overview') renderOverview(tabContent);
    else if (activeTab === 'upload') renderUpload(tabContent);
    else if (activeTab === 'profile') renderProfile(tabContent, false);
    else if (activeTab === 'payouts') renderPayouts(tabContent);
  }

  async function renderOverview(el) {
    el.innerHTML = '<div class="skeleton" style="height:200px;border-radius:12px;margin-bottom:1rem;"></div>';
    try { streamData = await api('/api/streams'); } catch { streamData = { totalStreams: 0, last30Days: 0, byTrack: [] }; }
    try { payoutData = await api('/api/payouts'); } catch { payoutData = { payouts: [], pendingEarnings: 0, stripeConnected: false }; }

    el.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Streams</div>
          <div class="stat-value">${streamData.totalStreams.toLocaleString()}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Last 30 Days</div>
          <div class="stat-value">${streamData.last30Days.toLocaleString()}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Pending Earnings</div>
          <div class="stat-value gold">$${(payoutData.pendingEarnings / 100).toFixed(2)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Stripe Connect</div>
          <div class="stat-value" style="font-size:1rem;">
            ${payoutData.stripeConnected
              ? '<span class="badge badge-active">Connected</span>'
              : '<span class="badge badge-pending">Not Set Up</span>'}
          </div>
        </div>
      </div>
      <div class="dashboard-section">
        <h3>Streams by Track</h3>
        ${streamData.byTrack.length === 0
          ? '<div class="empty-state"><p>No stream data yet. Upload tracks and share them!</p></div>'
          : `<div class="table-wrap"><table>
              <thead><tr><th>Track</th><th>Streams</th></tr></thead>
              <tbody>${streamData.byTrack.map(s => `<tr><td>${s.title}</td><td>${s.count.toLocaleString()}</td></tr>`).join('')}</tbody>
            </table></div>`}
      </div>
    `;
  }

  function renderUpload(el) {
    el.innerHTML = `
      <div class="dashboard-section">
        <h3>Upload New Track</h3>
        <form id="upload-form" style="max-width:560px;">
          <div class="upload-zone" id="drop-zone">
            ${icons.upload}
            <p>Drop an audio file here or click to browse</p>
            <div class="hint">MP3, WAV, FLAC — up to 50 MB</div>
            <input type="file" id="audio-file" accept="audio/*" style="display:none;" />
          </div>
          <div id="file-name" style="margin:1rem 0;color:var(--text-secondary);font-size:0.88rem;"></div>
          <div class="form-group">
            <label>Track Title</label>
            <input type="text" id="track-title" placeholder="Name your track" required />
          </div>
          <div class="form-group">
            <label>Genre</label>
            <input type="text" id="track-genre" placeholder="e.g. Gospel, Afrobeat, R&B" />
          </div>
          <div class="form-group">
            <label>Cover Image URL (optional)</label>
            <input type="text" id="track-cover" placeholder="https://..." />
          </div>
          <button type="submit" class="btn btn-primary" id="upload-btn">Upload Track</button>
        </form>
      </div>
    `;

    const zone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('audio-file');
    const fileName = document.getElementById('file-name');

    zone.addEventListener('click', () => fileInput.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('dragover');
      if (e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        fileName.textContent = e.dataTransfer.files[0].name;
      }
    });
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) fileName.textContent = fileInput.files[0].name;
    });

    document.getElementById('upload-form').addEventListener('submit', async e => {
      e.preventDefault();
      const file = fileInput.files[0];
      if (!file) { toast('Please select an audio file', 'error'); return; }
      const btn = document.getElementById('upload-btn');
      btn.disabled = true;
      btn.textContent = 'Uploading...';

      const formData = new FormData();
      formData.append('audio', file);
      formData.append('title', document.getElementById('track-title').value);
      formData.append('genre', document.getElementById('track-genre').value);
      formData.append('coverUrl', document.getElementById('track-cover').value);

      try {
        const tempAudio = new Audio();
        tempAudio.src = URL.createObjectURL(file);
        await new Promise(resolve => {
          tempAudio.addEventListener('loadedmetadata', () => {
            formData.append('duration', String(Math.round(tempAudio.duration)));
            resolve();
          });
          tempAudio.addEventListener('error', resolve);
          setTimeout(resolve, 3000);
        });
        await apiUpload('/api/tracks', formData);
        toast('Track uploaded!', 'success');
        activeTab = 'overview';
        render();
      } catch (err) {
        toast(err.message || 'Upload failed', 'error');
        btn.disabled = false;
        btn.textContent = 'Upload Track';
      }
    });
  }

  function renderProfile(el, isNew) {
    el.innerHTML = `
      <div class="dashboard-section">
        <h3>${isNew ? 'Create Your Artist Profile' : 'Edit Profile'}</h3>
        <form id="profile-form" class="profile-form">
          <div class="form-group">
            <label>Artist Name</label>
            <input type="text" id="profile-name" value="${artist?.name || ''}" placeholder="Your artist name" required />
          </div>
          <div class="form-group">
            <label>Genre</label>
            <input type="text" id="profile-genre" value="${artist?.genre || ''}" placeholder="e.g. Gospel, Afrobeat" />
          </div>
          <div class="form-group">
            <label>Bio</label>
            <textarea id="profile-bio" rows="4" placeholder="Tell your story...">${artist?.bio || ''}</textarea>
          </div>
          <div class="form-group">
            <label>Profile Image URL</label>
            <input type="text" id="profile-image" value="${artist?.imageUrl || ''}" placeholder="https://..." />
          </div>
          <button type="submit" class="btn btn-primary" id="profile-btn">
            ${isNew ? 'Create Profile' : 'Save Changes'}
          </button>
        </form>
      </div>
    `;

    document.getElementById('profile-form').addEventListener('submit', async ev => {
      ev.preventDefault();
      const btn = document.getElementById('profile-btn');
      btn.disabled = true;
      btn.textContent = 'Saving...';
      try {
        artist = await api('/api/artists', {
          method: 'POST',
          body: JSON.stringify({
            name: document.getElementById('profile-name').value,
            genre: document.getElementById('profile-genre').value,
            bio: document.getElementById('profile-bio').value,
            imageUrl: document.getElementById('profile-image').value,
          }),
        });
        toast('Profile saved!', 'success');
        activeTab = 'overview';
        render();
      } catch (err) {
        toast(err.message || 'Could not save profile', 'error');
        btn.disabled = false;
        btn.textContent = isNew ? 'Create Profile' : 'Save Changes';
      }
    });
  }

  async function renderPayouts(el) {
    el.innerHTML = '<div class="skeleton" style="height:200px;border-radius:12px;"></div>';
    let connectData;
    try { payoutData = await api('/api/payouts'); } catch { payoutData = payoutData || { payouts: [], pendingEarnings: 0, stripeConnected: false }; }
    try { connectData = await api('/api/stripe-connect'); } catch { connectData = { connected: false, onboarded: false }; }

    el.innerHTML = `
      <div class="dashboard-section">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem;">
          <h3 style="margin:0;">Payouts</h3>
          <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
            ${connectData.onboarded
              ? `<button class="btn btn-primary btn-sm" id="request-payout-btn">${icons.dollar} Request Payout</button>`
              : `<button class="btn btn-outline btn-sm" id="connect-stripe-btn">${icons.link} Set Up Stripe Connect</button>`}
          </div>
        </div>
        <div class="stats-grid" style="margin-bottom:2rem;">
          <div class="stat-card">
            <div class="stat-label">Pending Earnings</div>
            <div class="stat-value gold">$${(payoutData.pendingEarnings / 100).toFixed(2)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Rate Per Stream</div>
            <div class="stat-value" style="font-size:1.2rem;">$0.004</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Stripe Status</div>
            <div class="stat-value" style="font-size:1rem;">
              ${connectData.onboarded
                ? '<span class="badge badge-active">Active</span>'
                : connectData.connected
                  ? '<span class="badge badge-pending">Pending</span>'
                  : '<span class="badge badge-failed">Not Connected</span>'}
            </div>
          </div>
        </div>
        <h3>Payout History</h3>
        ${payoutData.payouts.length === 0
          ? '<div class="empty-state"><p>No payouts yet</p></div>'
          : `<div class="table-wrap"><table>
              <thead><tr><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>${payoutData.payouts.map(p => `
                <tr>
                  <td>${new Date(p.createdAt).toLocaleDateString()}</td>
                  <td>$${(p.amount / 100).toFixed(2)}</td>
                  <td><span class="badge badge-${p.status === 'completed' ? 'active' : p.status === 'pending' ? 'pending' : 'failed'}">${p.status}</span></td>
                </tr>
              `).join('')}</tbody>
            </table></div>`}
      </div>
    `;

    const connectBtn = document.getElementById('connect-stripe-btn');
    connectBtn?.addEventListener('click', async () => {
      connectBtn.disabled = true;
      connectBtn.textContent = 'Redirecting...';
      try {
        const result = await api('/api/stripe-connect', { method: 'POST' });
        if (result.url) window.location.href = result.url;
        else if (result.alreadyOnboarded) { toast('Already connected to Stripe', 'success'); renderPayouts(el); }
      } catch (err) {
        toast(err.message || 'Could not connect Stripe', 'error');
        connectBtn.disabled = false;
        connectBtn.textContent = 'Set Up Stripe Connect';
      }
    });

    const payoutBtn = document.getElementById('request-payout-btn');
    payoutBtn?.addEventListener('click', async () => {
      if (payoutData.pendingEarnings < 100) { toast('Minimum payout is $1.00', 'error'); return; }
      payoutBtn.disabled = true;
      payoutBtn.textContent = 'Processing...';
      try {
        await api('/api/payouts', { method: 'POST' });
        toast('Payout requested!', 'success');
        renderPayouts(el);
      } catch (err) {
        toast(err.message || 'Payout failed', 'error');
        payoutBtn.disabled = false;
        payoutBtn.textContent = 'Request Payout';
      }
    });
  }

  render();
}

// -- SUBSCRIBE --
async function subscribePage(container) {
  const user = getCurrentUser();
  const params = window.location.hash.includes('?')
    ? new URLSearchParams(window.location.hash.split('?')[1])
    : new URLSearchParams();
  const success = params.get('success');
  const canceled = params.get('canceled');

  let subData = null;
  if (user) {
    try { subData = await api('/api/subscribe'); } catch { /* not subscribed */ }
  }

  container.innerHTML = `
    <div class="container" style="padding-top:2rem;">
      ${success ? '<div class="auth-success" style="max-width:480px;margin:0 auto 1.5rem;text-align:center;">Welcome to Triumph Premium! Your subscription is active.</div>' : ''}
      ${canceled ? '<div class="auth-error" style="max-width:480px;margin:0 auto 1.5rem;text-align:center;">Subscription was canceled. You can try again anytime.</div>' : ''}
      <div class="subscribe-card">
        <h2 class="section-title">Triumph Premium</h2>
        <div class="subscribe-price">$4.99<span> /month</span></div>
        <p style="color:var(--text-secondary);margin-bottom:1.5rem;">Unlimited streaming. Support the artists you love.</p>
        <ul class="subscribe-features">
          <li>${icons.check} Unlimited high-quality streaming</li>
          <li>${icons.check} Ad-free listening experience</li>
          <li>${icons.check} Early access to new releases</li>
          <li>${icons.check} Direct artist support through stream revenue</li>
          <li>${icons.check} Exclusive content and behind-the-scenes</li>
        </ul>
        ${subData && subData.subscribed
          ? `<div class="auth-success" style="margin-bottom:1rem;">You're subscribed! Premium is active.</div>
             <button class="btn btn-outline" disabled>Active Subscription</button>`
          : `<button class="btn btn-primary" id="subscribe-btn" style="width:100%;">
              ${user ? 'Subscribe Now' : 'Sign In to Subscribe'}
            </button>`}
      </div>
    </div>
  `;

  const btn = document.getElementById('subscribe-btn');
  btn?.addEventListener('click', async () => {
    if (!user) { navigate('/login'); return; }
    btn.disabled = true;
    btn.textContent = 'Redirecting to checkout...';
    try {
      const result = await api('/api/subscribe', { method: 'POST' });
      if (result.alreadySubscribed) { btn.textContent = 'Already Subscribed'; return; }
      if (result.url) window.location.href = result.url;
    } catch {
      btn.disabled = false;
      btn.textContent = 'Subscribe Now';
    }
  });
}

// -- ARTIST DETAIL --
async function artistPage(container, params) {
  const artistId = params.id;
  container.innerHTML = '<div class="container" style="padding-top:2rem;"><div class="skeleton" style="height:300px;border-radius:16px;margin-bottom:2rem;"></div></div>';

  try {
    const artistData = await api(`/api/artists/${artistId}`);
    const allTracks = await api('/api/tracks');
    const artistTracks = allTracks.filter(t => t.artistId === artistData.id);

    container.innerHTML = `
      <div class="container" style="padding-top:2rem;">
        <div style="display:flex;gap:2rem;align-items:flex-start;margin-bottom:3rem;flex-wrap:wrap;">
          <div style="width:200px;height:200px;border-radius:var(--radius-lg);overflow:hidden;background:var(--bg-surface);flex-shrink:0;">
            ${artistData.imageUrl
              ? `<img src="${artistData.imageUrl}" alt="${artistData.name}" style="width:100%;height:100%;object-fit:cover;"/>`
              : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-muted);">${icons.user}</div>`}
          </div>
          <div style="flex:1;min-width:240px;">
            <div style="font-size:0.82rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--gold);margin-bottom:0.5rem;">Artist</div>
            <h1 style="font-family:var(--font-display);font-size:2.5rem;margin-bottom:0.5rem;">${artistData.name}</h1>
            ${artistData.genre ? `<div style="color:var(--text-secondary);margin-bottom:1rem;">${artistData.genre}</div>` : ''}
            ${artistData.bio ? `<p style="color:var(--text-secondary);line-height:1.7;max-width:500px;">${artistData.bio}</p>` : ''}
          </div>
        </div>
        <h2 class="section-title">Tracks</h2>
        <p class="section-subtitle">${artistTracks.length} track${artistTracks.length !== 1 ? 's' : ''}</p>
        <div class="track-grid" id="artist-tracks">
          ${artistTracks.length === 0
            ? `<div class="empty-state" style="grid-column:1/-1;">${icons.music}<p>No tracks yet</p></div>`
            : ''}
        </div>
      </div>
    `;

    if (artistTracks.length > 0) {
      const el = document.getElementById('artist-tracks');
      renderTrackGrid(el, artistTracks.map(t => ({ ...t, artistName: t.artistName || artistData.name })));
    }
  } catch {
    container.innerHTML = '<div class="container" style="padding-top:2rem;"><div class="empty-state"><p>Artist not found</p></div></div>';
  }
}

// ---------------------------------------------------------------------------
// Register Routes
// ---------------------------------------------------------------------------
registerRoute('/', homePage);
registerRoute('/login', loginPage);
registerRoute('/browse', browsePage);
registerRoute('/dashboard', dashboardPage);
registerRoute('/subscribe', subscribePage);
registerRoute('/artist/:id', artistPage);

// ---------------------------------------------------------------------------
// App Shell
// ---------------------------------------------------------------------------
const app = document.getElementById('app');
app.innerHTML = `
  <nav class="nav">
    <a href="#/" class="nav-logo">Triumph</a>
    <div class="nav-links" id="nav-links"></div>
  </nav>
  <main class="page" id="page-content"></main>
  <div class="player-bar" id="player-bar">
    <div class="player-cover" id="player-cover"></div>
    <div class="player-info">
      <div class="player-title" id="player-title"></div>
      <div class="player-artist" id="player-artist"></div>
    </div>
    <div class="player-controls">
      <button class="play-btn" id="player-play-btn">${icons.play}</button>
    </div>
    <div class="player-progress">
      <span class="player-time" id="player-current">0:00</span>
      <div class="progress-bar" id="progress-bar">
        <div class="progress-fill" id="progress-fill"></div>
      </div>
      <span class="player-time" id="player-duration">0:00</span>
    </div>
    <div class="player-volume">
      <button id="volume-btn">${icons.volume}</button>
      <div class="volume-slider" id="volume-slider">
        <div class="volume-fill" id="volume-fill" style="width:80%;"></div>
      </div>
    </div>
  </div>
`;

// ---------------------------------------------------------------------------
// Nav
// ---------------------------------------------------------------------------
function updateNav() {
  const user = getCurrentUser();
  const nav = document.getElementById('nav-links');
  const hash = (window.location.hash.replace('#', '') || '/');
  nav.innerHTML = `
    <a href="#/browse" class="${hash === '/browse' ? 'active' : ''}">Browse</a>
    <a href="#/subscribe" class="${hash === '/subscribe' ? 'active' : ''}">Premium</a>
    ${user
      ? `<a href="#/dashboard" class="${hash === '/dashboard' ? 'active' : ''}">Dashboard</a>
         <button class="btn btn-ghost btn-sm" id="logout-btn">Sign Out</button>`
      : '<a href="#/login" class="btn btn-primary btn-sm">Sign In</a>'}
  `;
  const logoutBtn = document.getElementById('logout-btn');
  logoutBtn?.addEventListener('click', async () => { await doLogout(); navigate('/'); });
}

onUserChange(updateNav);
window.addEventListener('hashchange', updateNav);

// ---------------------------------------------------------------------------
// Player bar UI
// ---------------------------------------------------------------------------
onPlayerChange(({ track, isPlaying: playing }) => {
  const bar = document.getElementById('player-bar');
  if (!track) { bar.classList.remove('active'); return; }
  bar.classList.add('active');
  document.getElementById('player-title').textContent = track.title;
  document.getElementById('player-artist').textContent = track.artistName || '';
  const cover = document.getElementById('player-cover');
  cover.innerHTML = track.coverUrl ? `<img src="${track.coverUrl}" alt="${track.title}"/>` : icons.disc;
  document.getElementById('player-play-btn').innerHTML = playing ? icons.pause : icons.play;
});

document.getElementById('player-play-btn').addEventListener('click', togglePlay);

document.getElementById('progress-bar').addEventListener('click', e => {
  const rect = e.currentTarget.getBoundingClientRect();
  seekTo((e.clientX - rect.left) / rect.width);
});

let isMuted = false;
document.getElementById('volume-btn').addEventListener('click', () => {
  isMuted = !isMuted;
  setVolume(isMuted ? 0 : 0.8);
  document.getElementById('volume-btn').innerHTML = isMuted ? icons.volumeMute : icons.volume;
  document.getElementById('volume-fill').style.width = isMuted ? '0%' : '80%';
});

document.getElementById('volume-slider').addEventListener('click', e => {
  const rect = e.currentTarget.getBoundingClientRect();
  const vol = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  setVolume(vol);
  document.getElementById('volume-fill').style.width = vol * 100 + '%';
  isMuted = vol === 0;
  document.getElementById('volume-btn').innerHTML = isMuted ? icons.volumeMute : icons.volume;
});

function updateProgress() {
  const a = getAudio();
  if (a && a.duration) {
    const pct = (a.currentTime / a.duration) * 100;
    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('player-current').textContent = formatTime(a.currentTime);
    document.getElementById('player-duration').textContent = formatTime(a.duration);
  }
  requestAnimationFrame(updateProgress);
}
requestAnimationFrame(updateProgress);

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function boot() {
  await initAuth();
  updateNav();
  startRouter();
}

boot();
