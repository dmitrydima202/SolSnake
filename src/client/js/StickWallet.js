import { SKIN_PRICES } from '../../shared/colors.js';
import { askPlatformPage } from '@idosgames/core/platform';
import { isEmbeddedInPlatform, linkWalletViaPlatform, linkWalletSolana,
  PLATFORM_WALLET_MESSAGES, onWalletBalanceChanged } from '@idosgames/wallet';

export const STICK_MINT = 'CdomqHDyfMGEDPpBzgLHMaP9N6DTnSfkW36dh8eSidos';
export const STICK_DECIMALS = 6;
const FREE = () => new Set(SKIN_PRICES.flatMap((price, i) => price === 0 ? [i] : []));
export function skinsForBalance(raw) {
  const balance = BigInt(raw);
  return new Set(SKIN_PRICES.flatMap((price, i) => balance >= BigInt(price) * 1000000n ? [i] : []));
}
export function displayStick(raw) {
  const amount = BigInt(raw);
  return (amount / 1000000n).toLocaleString('en-US') +
    (amount % 1000000n ? '.' + String(amount % 1000000n).padStart(6, '0').replace(/0+$/, '') : '');
}

export class StickWallet {
  constructor(net) {
    this.net = net;
    this.address = null;
    this.provider = null;
    this.rawBalance = '0';
    this.unlocked = FREE();
    this.status = 'Connect a wallet to unlock skins by holding STICK.';
    this.busy = false;
    this.listeners = new Set();
    this.generation = 0;
    this.expiresAt = 0;
    onWalletBalanceChanged(() => { if (this.address) void this.refresh(); });
    this.timer = setInterval(() => {
      if (!this.address) return;
      if (Date.now() >= this.expiresAt) this.revoke();
      if (!document.hidden) void this.refresh();
    }, 30000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.address) { this.revoke(); void this.refresh(); }
    });
  }
  onChange(fn) { this.listeners.add(fn); fn(this); }
  emit() { for (const fn of this.listeners) fn(this); }
  revoke() { this.rawBalance = '0'; this.unlocked = FREE(); this.expiresAt = 0; this.emit(); }
  async ensureSession() {
    if (this.net.client.auth.isLoggedIn) return;
    const result = await this.net.client.auth.loginWithDeviceID();
    if (!result.ok) throw new Error('Platform connection failed. Please retry.');
  }
  async connect(kind = 'phantom') {
    if (this.busy) return;
    this.busy = true; this.status = 'Connecting wallet…'; this.emit();
    const generation = ++this.generation;
    try {
      await this.ensureSession();
      let result;
      if (isEmbeddedInPlatform()) {
        result = await linkWalletViaPlatform({client: this.net.client, networkID: 'solana', family: 'solana'});
      } else {
        const provider = kind === 'solflare' ? window.solflare : (window.phantom?.solana || window.solana);
        if (!provider?.connect || !provider?.signMessage) throw new Error(`Open this game in a browser with ${kind === 'solflare' ? 'Solflare' : 'Phantom'} installed.`);
        await provider.connect();
        const address = provider.publicKey?.toString();
        if (!address) throw new Error('Wallet connection was cancelled.');
        result = await linkWalletSolana({client: this.net.client, networkID: 'solana', walletAddress: address,
          signMessage: async bytes => {
            const signed = await provider.signMessage(bytes, 'utf8');
            return signed.signature || signed;
          }});
        if (result.ok) {
          this.provider = provider;
          this.accountChanged = () => this.disconnect(false);
          provider.on?.('accountChanged', this.accountChanged);
          provider.on?.('disconnect', this.accountChanged);
        }
      }
      if (generation !== this.generation) return;
      if (!result.ok || !result.data.Linked || !result.data.Address) throw new Error(result.error || 'Wallet verification failed.');
      this.address = result.data.Address;
      this.revoke();
      this.busy = false;
      await this.refresh();
    } catch (error) {
      if (generation === this.generation) {
        this.revoke(); this.status = error.message || 'Wallet connection failed. Please retry.';
      }
    } finally { if (generation === this.generation) { this.busy = false; this.emit(); } }
  }
  async refresh() {
    if (this.busy || !this.address) return;
    this.busy = true; this.status = 'Checking STICK balance…'; this.emit();
    const generation = this.generation, address = this.address;
    try {
      if (this.provider && this.provider.publicKey?.toString() !== address) { this.disconnect(false); return; }
      if (isEmbeddedInPlatform()) {
        const current = await askPlatformPage(PLATFORM_WALLET_MESSAGES.addressRequest,
          PLATFORM_WALLET_MESSAGES.addressResponse, {titleID: this.net.client.titleID, family: 'solana'});
        if (!current.ok || current.data.address !== address) { this.disconnect(false); return; }
      }
      await this.ensureSession();
      const result = await this.net.client.cloudCode.execute('solSnakeStickHoldings', {address});
      if (!result.ok || result.data.Error) throw new Error('STICK balance could not be checked. Please retry.');
      const data = result.data.FunctionResult;
      if (!data?.ok) throw new Error(data?.error || 'STICK balance could not be checked. Please retry.');
      if (data.address !== address || data.mint !== STICK_MINT || data.decimals !== STICK_DECIMALS || !/^\d+$/.test(data.rawBalance))
        throw new Error('Invalid STICK balance response.');
      if (generation !== this.generation) return;
      this.rawBalance = data.rawBalance;
      this.unlocked = skinsForBalance(this.rawBalance);
      this.expiresAt = Date.now() + 60000;
      this.status = 'Balance verified · tokens stay in your wallet.';
    } catch (error) {
      if (generation === this.generation) { this.revoke(); this.status = error.message; }
    } finally { if (generation === this.generation) { this.busy = false; this.emit(); } }
  }
  disconnect(disconnectProvider = true) {
    ++this.generation;
    const provider = this.provider;
    provider?.off?.('accountChanged', this.accountChanged);
    provider?.off?.('disconnect', this.accountChanged);
    this.provider = null; this.address = null; this.busy = false;
    this.revoke(); this.status = 'Wallet disconnected. Free skins are available.'; this.emit();
    if (disconnectProvider) void provider?.disconnect?.();
  }
}
