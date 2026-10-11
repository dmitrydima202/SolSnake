import { SKINS, SKIN_PRICES, RAINBOW_STOPS, skinTier } from '../../shared/colors.js';
import { displayStick } from './StickWallet.js';
import { isEmbeddedInPlatform } from '@idosgames/wallet';

export class Shop {
  constructor(net, ui, wallet) {
    this.net = net; this.ui = ui; this.wallet = wallet;
    this.screen = document.getElementById('shopScreen');
    this.grid = document.getElementById('shopGrid');
    this.backBtn = document.getElementById('shopBackBtn');
    this.backBtn.addEventListener('click', () => this.hide());
    document.getElementById('stickConnectBtn').addEventListener('click', () => wallet.connect());
    document.getElementById('stickSolflareBtn').addEventListener('click', () => wallet.connect('solflare'));
    document.getElementById('stickRefreshBtn').addEventListener('click', () => wallet.refresh());
    document.getElementById('stickDisconnectBtn').addEventListener('click', () => wallet.disconnect());
    this._buildGrid();
    wallet.onChange(() => this._updateUI());
  }
  _buildGrid() {
    this.grid.replaceChildren();
    SKINS.forEach((skin, i) => {
      const price = SKIN_PRICES[i], tier = skinTier(price);
      const el = document.createElement('button');
      el.type = 'button'; el.className = 'shop-item'; el.dataset.skin = i;
      el.setAttribute('aria-label', `${skin.name}: ${price ? `hold ${price.toLocaleString('en-US')} STICK` : 'free'}`);
      const swatch = document.createElement('div'); swatch.className = 'shop-swatch';
      swatch.style.background = skin.main === 'combo' || skin.main === 'rainbow'
        ? `linear-gradient(135deg, ${(skin.colors || RAINBOW_STOPS).join(', ')})` : skin.main;
      const name = document.createElement('div'); name.className = 'shop-item-name'; name.textContent = skin.name;
      const tierEl = document.createElement('div'); tierEl.className = 'shop-item-tier'; tierEl.textContent = tier.name; tierEl.style.color = tier.color;
      const priceEl = document.createElement('div'); priceEl.className = 'shop-item-price';
      priceEl.textContent = price ? `Hold ${price.toLocaleString('en-US')} STICK` : 'FREE';
      const state = document.createElement('div'); state.className = 'shop-item-access';
      el.append(swatch, name, tierEl, priceEl, state);
      el.addEventListener('click', () => {
        if (this.wallet.unlocked.has(i)) { this.ui._selectSkin(i); this._updateUI(); }
        else {
          this.wallet.status = this.wallet.address
            ? `Hold at least ${price.toLocaleString('en-US')} STICK to use ${skin.name}.`
            : 'Connect your wallet to verify your STICK balance.';
          this.wallet.emit();
        }
      });
      this.grid.append(el);
    });
  }
  _updateUI() {
    const wallet = this.wallet;
    this.ui.setUnlockedSkins(wallet.unlocked);
    document.getElementById('shopCoinCount').textContent = displayStick(wallet.rawBalance);
    document.getElementById('stickWalletAddress').textContent = wallet.address
      ? `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}` : 'Wallet not connected';
    document.getElementById('stickWalletStatus').textContent = wallet.status;
    document.getElementById('skinsWalletBalance').textContent = wallet.address
      ? `Wallet balance: ${displayStick(wallet.rawBalance)} STICK` : 'Free skins are available without a wallet.';
    const embedded = isEmbeddedInPlatform();
    document.getElementById('stickConnectBtn').textContent = embedded ? 'Connect site wallet' : 'Connect Phantom';
    for (const id of ['stickConnectBtn', 'stickSolflareBtn', 'stickRefreshBtn']) document.getElementById(id).disabled = wallet.busy;
    document.getElementById('stickConnectBtn').classList.toggle('hidden', !!wallet.address);
    document.getElementById('stickSolflareBtn').classList.toggle('hidden', !!wallet.address || embedded);
    document.getElementById('stickRefreshBtn').classList.toggle('hidden', !wallet.address);
    document.getElementById('stickDisconnectBtn').classList.toggle('hidden', !wallet.address);
    for (const el of this.grid.children) {
      const id = Number(el.dataset.skin), available = wallet.unlocked.has(id);
      el.classList.toggle('owned', available); el.classList.toggle('locked', !available);
      el.classList.toggle('free', SKIN_PRICES[id] === 0);
      el.classList.toggle('selected', this.ui.selectedSkin === id);
      el.querySelector('.shop-item-access').textContent = available
        ? (this.ui.selectedSkin === id ? 'Selected' : 'Use skin') : 'Locked';
    }
    this.net.setSkin(this.ui.getSkin());
  }
  show() { this.screen.classList.remove('hidden'); if (this.wallet.address) void this.wallet.refresh(); }
  hide() { this.screen.classList.add('hidden'); }
  isVisible() { return !this.screen.classList.contains('hidden'); }
}
