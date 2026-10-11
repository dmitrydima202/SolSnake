// ===========================================================================
// main.js — client entry point. Wires UI, Net, Game and global key bindings.
// ===========================================================================

import Net from './PlatformNet.js';
import Input from './Input.js';
import Camera from './Camera.js';
import Renderer from './Renderer.js';
import Game from './Game.js';
import Hud from './Hud.js';
import Ui from './ui.js';
import AdminPanel from './AdminPanel.js';
import KillFeed from './KillFeed.js';
import { Shop } from './Shop.js';
import { StickWallet } from './StickWallet.js';

const canvas = document.getElementById('game');

const net = new Net();
const input = new Input(canvas);
const camera = new Camera(canvas);
const renderer = new Renderer(canvas);
const hud = new Hud();
const ui = new Ui();
const adminPanel = new AdminPanel(net);
const killFeed = new KillFeed();

const game = new Game({ net, renderer, camera, input, hud, ui });
const stickWallet = new StickWallet(net);
const shop = new Shop(net, ui, stickWallet);

const onlineBtn = document.getElementById('onlineBtn');
const onlinePanel = document.getElementById('onlinePanel');
const onlineStatus = document.getElementById('onlineStatus');
const roomActions = document.getElementById('roomActions');
const activeRoom = document.getElementById('activeRoom');
const codeInput = document.getElementById('roomCodeInput');
const codeDisplay = document.getElementById('roomCodeDisplay');
const createBtn = document.getElementById('createRoomBtn');
const joinBtn = document.getElementById('joinRoomBtn');
const leaveBtn = document.getElementById('leaveRoomBtn');
let roomTimer;

onlineBtn.addEventListener('click', () => {
  const expanded = onlinePanel.classList.toggle('hidden') === false;
  onlineBtn.setAttribute('aria-expanded', String(expanded));
});

function updateRoom() {
  const inRoom = Boolean(net.session);
  roomActions.classList.toggle('hidden', inRoom);
  activeRoom.classList.toggle('hidden', !inRoom);
  codeDisplay.textContent = net.roomCode || '';
  onlineBtn.textContent = inRoom ? 'Online room' : 'Play Online';
  ui.playBtn.disabled = inRoom && !net.connected;
  ui.playBtn.textContent = inRoom ? 'Play in room' : 'Play';
}

async function openRoom(code) {
  createBtn.disabled = joinBtn.disabled = true;
  onlineStatus.textContent = code ? 'Finding room…' : 'Creating room…';
  try {
    await net.playOnline(code);
    updateRoom();
    onlineStatus.textContent = net.connected
      ? 'Room ready. Share the code and press Play in room.'
      : 'Connecting to the room host…';
    clearTimeout(roomTimer);
    if (!net.connected) roomTimer = setTimeout(() => {
      if (net.session && !net.connected) onlineStatus.textContent = 'Host connection failed. Leave the room and try again.';
    }, 30000);
  } catch (error) {
    onlineStatus.textContent = error.message;
  } finally {
    createBtn.disabled = joinBtn.disabled = false;
  }
}
createBtn.addEventListener('click', () => openRoom());
document.getElementById('joinRoomForm').addEventListener('submit', event => {
  event.preventDefault();
  if (!codeInput.value.trim()) {
    onlineStatus.textContent = 'Enter your friend’s room code.';
    codeInput.focus();
    return;
  }
  openRoom(codeInput.value);
});
codeInput.addEventListener('input', () => { codeInput.value = codeInput.value.toUpperCase(); });
document.getElementById('copyRoomBtn').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(net.roomCode);
    onlineStatus.textContent = 'Code copied. Send it to your friends.';
  } catch {
    onlineStatus.textContent = `Copy this code: ${net.roomCode}`;
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(codeDisplay); selection.removeAllRanges(); selection.addRange(range);
  }
});
leaveBtn.addEventListener('click', async () => {
  leaveBtn.disabled = true;
  try { await net.leaveOnline(); }
  catch (error) { onlineStatus.textContent = error.message; }
  finally { leaveBtn.disabled = false; }
});
net.on('open', () => {
  clearTimeout(roomTimer);
  updateRoom();
  if (net.session) onlineStatus.textContent = 'Connected. Press Play in room.';
});
net.on('close', () => {
  updateRoom();
  if (net.session) {
    // Keep the room controls available when the host disconnects.
    ui.hideConnecting(); ui.hideHud(); ui.hideDeath(); ui.showMenu();
    onlinePanel.classList.remove('hidden');
    onlineBtn.setAttribute('aria-expanded', 'true');
    onlineStatus.textContent = 'Host disconnected. Waiting for reconnection, or leave this room.';
  }
});
net.on('roomEnded', () => {
  clearTimeout(roomTimer);
  game.state.alive = false;
  game.state.snakes.clear(); game.state.food.clear(); game.state.powerups.clear();
  game.stopSpectating();
  ui.hideConnecting(); ui.hideHud(); ui.hideDeath(); ui.showMenu();
  updateRoom();
  onlineStatus.textContent = 'Room left or closed. Create a room or enter another code.';
});

// ---- Auth state ----
let authState = { token: null, username: null };

// Clear previous session — require re-login each time
localStorage.removeItem('slither_token');
localStorage.removeItem('slither_username');

// ---- Auth UI wiring ----
let authMode = 'login'; // 'login' or 'register'

ui.authLoginTab.addEventListener('click', () => {
  authMode = 'login';
  ui.setAuthMode('login');
});

ui.authRegisterTab.addEventListener('click', () => {
  authMode = 'register';
  ui.setAuthMode('register');
});

ui.authSubmitBtn.addEventListener('click', () => {
  const username = ui.authUsername.value.trim();
  const password = ui.authPassword.value;
  if (!username || !password) {
    ui.showAuthError('Enter username and password');
    return;
  }
  if (authMode === 'login') {
    net.sendLogin(username, password);
  } else {
    net.sendRegister(username, password);
  }
});

ui.authBackBtn.addEventListener('click', () => {
  ui.hideLoginScreen();
  ui.showMenu();
});

ui.authGuestBtn.addEventListener('click', () => {
  authState.token = null;
  authState.username = null;
  ui.hideLoginScreen();
  ui.showMenu();
});

ui.profileBtn.addEventListener('click', () => {
  ui.hideMenu();
  ui.showProfile();
  net.sendProfileRequest();
});

ui.profileBackBtn.addEventListener('click', () => {
  ui.hideProfile();
  ui.showMenu();
});

ui.profileLogoutBtn.addEventListener('click', () => {
  authState.token = null;
  authState.username = null;
  net.setAuthToken(null);
  ui.showLoggedOut();
  adminPanel.setAdminUser(null);
  ui.hideProfile();
  ui.showMenu();
});

// ---- Auth results ----
net.on('authResult', (d) => {
  if (d.ok) {
    authState.token = d.token;
    authState.username = d.username;
    net.setAuthToken(d.token);
    ui.showAuthSuccess(`Logged in as ${d.username}`);
    ui.showLoggedIn(d.username);
    adminPanel.setAdminUser(d.username);
    setTimeout(() => {
      ui.hideLoginScreen();
      ui.showMenu();
    }, 800);
  } else {
    ui.showAuthError(d.msg || 'Failed');
  }
});

net.on('profileData', (d) => {
  ui.updateProfile(d);
});



// ---- Button wiring ----
ui.playBtn.addEventListener('click', async () => {
  if (!net.connected) return;
  if (stickWallet.address) await stickWallet.refresh();
  game.join(ui.getName(), ui.getSkin());
});
ui.respawnBtn.addEventListener('click', async () => {
  if (stickWallet.address) await stickWallet.refresh();
  net.setSkin(ui.getSkin());
  game.stopSpectating();
  game.respawn();
});
ui.spectateBtn.addEventListener('click', () => {
  // Spectate the top snake on the leaderboard
  game.startSpectating(0); // 0 = auto-pick top snake
});
ui.menuBtn.addEventListener('click', () => {
  game.stopSpectating();
  ui.hideDeath();
  ui.hideHud();
  ui.showMenu();
});
ui.skinsBtn.addEventListener('click', () => {
  ui.hideMenu();
  ui.showSkins();
  if (stickWallet.address) void stickWallet.refresh();
});
document.getElementById('skinsWalletBtn').addEventListener('click', () => {
  ui.hideSkins(); shop.show();
});
ui.skinsBackBtn.addEventListener('click', () => {
  ui.hideSkins();
  ui.showMenu();
});

// ---- Shop ----
document.getElementById('shopBtn').addEventListener('click', () => {
  ui.hideMenu();
  shop.show();
});
shop.backBtn.addEventListener('click', () => {
  shop.hide();
  ui.showMenu();
});

// ---- All-time leaderboard ----
let alltimeData = [];
let alltimeSortBy = 'score';

ui.alltimeBtn.addEventListener('click', () => {
  ui.hideMenu();
  ui.showAlltime();
  net.requestLeaderboardAlltime();
});
ui.alltimeBackBtn.addEventListener('click', () => {
  ui.hideAlltime();
  ui.showMenu();
});

// Tab switching
document.querySelectorAll('.alltime-tabs .tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    alltimeSortBy = btn.dataset.tab;
    document.querySelectorAll('.alltime-tabs .tab-btn').forEach(b => b.classList.toggle('active', b === btn));
    ui.updateAlltime(alltimeData, alltimeSortBy, authState.username);
  });
});

net.on('leaderboardAlltime', (d) => {
  alltimeData = d.entries;
  ui.updateAlltime(d.entries, alltimeSortBy, authState.username);
});

// Touch boost button: hold to boost.
if (ui.boostBtn) {
  const setBoost = (on) => input.setTouchBoost(on);
  ui.boostBtn.addEventListener('touchstart', (e) => { e.preventDefault(); setBoost(true); }, { passive: false });
  ui.boostBtn.addEventListener('touchend',   (e) => { e.preventDefault(); setBoost(false); }, { passive: false });
  ui.boostBtn.addEventListener('mousedown',  () => setBoost(true));
  ui.boostBtn.addEventListener('mouseup',    () => setBoost(false));
  ui.boostBtn.addEventListener('mouseleave', () => setBoost(false));
}

// ---- Keyboard ----
window.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, form, button')) return;
  // Enter: play from menu or respawn from death.
  if (e.code === 'Enter') {
    if (game._spectating) {
      game.stopSpectating();
      game.respawn();
    } else if (hud && !hud.el.classList.contains('hidden') && !ui.death.classList.contains('hidden')) {
      // dead — respawn
      game.respawn();
    } else if (!ui.menu.classList.contains('hidden') && net.connected) {
      game.join(ui.getName(), ui.getSkin());
    } else if (!ui.death.classList.contains('hidden')) {
      game.respawn();
    }
  }
  // S: spectate from death screen
  if (e.code === 'KeyS' && !ui.death.classList.contains('hidden')) {
    game.startSpectating(0);
  }
  // Escape: stop spectating and respawn
  if (e.code === 'Escape' && game._spectating) {
    game.stopSpectating();
    game.respawn();
  }
  // G: toggle low graphics.
  if (e.code === 'KeyG') {
    renderer.toggleLowGraphics();
  }
  // F2: toggle admin panel.
  if (e.code === 'F2') {
    e.preventDefault();
    adminPanel.toggle();
  }
});

// ---- Connection lifecycle ----
net.on('open', () => ui.hideConnecting());
net.on('close', () => { if (!net.session) ui.showConnecting('Disconnected. Refresh to retry.'); });
net.on('error', () => ui.showConnecting('Connection error. Refresh to retry.'));
net.on('welcome', () => { ui.hideConnecting(); });

ui.showConnecting('Connecting to server…');
game.start();

// ---- Speed slider label update ----
const speedSlider = document.getElementById('adminGameSpeed');
const speedLabel = document.getElementById('adminSpeedLabel');
if (speedSlider && speedLabel) {
  speedSlider.addEventListener('input', () => {
    const v = parseInt(speedSlider.value) || 100;
    speedLabel.textContent = (v / 100).toFixed(2) + 'x';
  });
}

// ---- Leaderboard click-to-spectate ----
const lbList = document.getElementById('leaderboardList');
if (lbList) {
  lbList.addEventListener('click', (e) => {
    if (!game._spectating) return;
    const li = e.target.closest('li');
    if (!li) return;
    // Find snake by matching rank text and score
    const rankEl = li.querySelector('.rank');
    if (!rankEl) return;
    const rank = parseInt(rankEl.textContent);
    // Find snake from radar that matches this leaderboard position
    const radar = game.state.radar;
    if (!radar || radar.length === 0) return;
    // Sort radar by score to match leaderboard order
    const sorted = [...radar].sort((a, b) => b.score - a.score);
    if (rank > 0 && rank <= sorted.length) {
      game.startSpectating(sorted[rank - 1].id);
    }
  });
}

// ---- Mobile touch steering ----
const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
if (isTouchDevice) {
  const touchZone = document.getElementById('touchZone');
  const boostBtn = document.getElementById('boostBtn');
  if (touchZone) touchZone.classList.remove('hidden');
  if (boostBtn) boostBtn.classList.remove('hidden');

  let touchId = null;
  let touchStartX = 0;
  let touchStartY = 0;

  const getAngle = (touch) => {
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const tx = touch.clientX - rect.left - cx;
    const ty = touch.clientY - rect.top - cy;
    return Math.atan2(ty, tx);
  };

  document.addEventListener('touchstart', (e) => {
    if (shop.isVisible()) return;
    if (!ui.menu.classList.contains('hidden')) return;
    if (!ui.death.classList.contains('hidden')) return;
    // Only capture the first touch
    if (touchId !== null) return;
    const t = e.changedTouches[0];
    touchId = t.identifier;
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    input.setTouchAngle(getAngle(t));
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (touchId === null) return;
    for (const t of e.changedTouches) {
      if (t.identifier === touchId) {
        input.setTouchAngle(getAngle(t));
        break;
      }
    }
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === touchId) {
        touchId = null;
        break;
      }
    }
  }, { passive: true });
}
