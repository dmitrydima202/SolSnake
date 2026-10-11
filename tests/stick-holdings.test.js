import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { skinsForBalance, displayStick, STICK_MINT, StickWallet } from '../src/client/js/StickWallet.js';
import { decodeClientMessage, C2S } from '../src/shared/protocol.js';

test('whole-token thresholds use exact atomic units and keep all lower tiers accessible', () => {
  assert.deepEqual([...skinsForBalance('0')], [0,1,2,3]);
  assert.equal(skinsForBalance('9999999999').has(14), false);
  assert.equal(skinsForBalance('10000000000').has(14), true);
  assert.equal(skinsForBalance('10000000000').has(15), false);
  assert.equal(skinsForBalance('25000000000').size, 16);
  assert.equal(displayStick('10000000001'), '10,000.000001');
});

const source = readFileSync(new URL('../cloudcode/stick-holdings.js', import.meta.url), 'utf8');
const address = STICK_MINT; // public fixture only; no wallet account is created.
function runCloud({verified = true, amounts = ['4000000000','6000000000'], decimals = 6, rpcFails = false} = {}) {
  let calls = 0;
  const context = {
    handlers: {}, server: {
      ReadUserData: () => ({Blockchain: {LinkedWallets: verified ? {
        solana: {NetworkID: 'solana', Address: address, IsSignatureVerified: true}
      } : {}}}),
      HttpRequest: () => { calls++; return {Success: true, Data: {Ok: !rpcFails, Body: JSON.stringify({result: {value: amounts.map(amount => ({
        account: {data: {parsed: {info: {owner: address, mint: STICK_MINT, tokenAmount: {amount, decimals}}}}}
      }))}})}}; }
    }
  };
  vm.createContext(context); vm.runInContext(source, context);
  return {read: () => context.handlers.solSnakeStickHoldings({address}), calls: () => calls};
}
test('server combines multiple STICK accounts without rounding', () => {
  assert.equal(runCloud().read().rawBalance, '10000000000');
  assert.equal(runCloud({amounts:['999999999999999999','1']}).read().rawBalance, '1000000000000000000');
  assert.equal(runCloud({amounts:[]}).read().rawBalance, '0');
});
test('unverified wallets cannot borrow another holder balance', () => {
  const cloud = runCloud({verified:false});
  assert.equal(cloud.read().ok, false);
  assert.equal(cloud.calls(), 0);
});
test('RPC failures and wrong mint decimals cannot unlock a skin', () => {
  assert.throws(() => runCloud({rpcFails:true}).read());
  assert.throws(() => runCloud({decimals:9}).read());
});
test('skin updates reject truncated and out-of-range protocol messages', () => {
  assert.deepEqual(decodeClientMessage(new Uint8Array([C2S.SKIN,14])), {op:C2S.SKIN,skin:14});
  assert.equal(decodeClientMessage(new Uint8Array([C2S.SKIN])), null);
  assert.equal(decodeClientMessage(new Uint8Array([C2S.SKIN,255])), null);
});
test('refresh failure revokes cached access; disconnect prevents stale response restoring it', async () => {
  const wallet = Object.create(StickWallet.prototype);
  Object.assign(wallet, {net:{client:{auth:{isLoggedIn:true},cloudCode:{execute:async()=>({ok:false})}}},
    address, provider:null, rawBalance:'25000000000', unlocked:skinsForBalance('25000000000'), listeners:new Set(), generation:0, busy:false});
  await wallet.refresh();
  assert.equal(wallet.unlocked.size,4);
  let resolve;
  wallet.net.client.cloudCode.execute = () => new Promise(r => {resolve=r;});
  const pending = wallet.refresh();
  await new Promise(r => setImmediate(r));
  wallet.disconnect(false);
  resolve({ok:true,data:{FunctionResult:{ok:true,address,mint:STICK_MINT,decimals:6,rawBalance:'25000000000'}}});
  await pending;
  assert.equal(wallet.address,null); assert.equal(wallet.unlocked.size,4);
});
