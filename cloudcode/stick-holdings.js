// Read-only: no token transfers, grants, or persistent skin ownership.
handlers.solSnakeStickHoldings = function (args) {
  var address = args && args.address;
  if (typeof address !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address))
    throw new Error('Connect a Solana wallet first.');
  var user = server.ReadUserData(['Blockchain']);
  var state = (user && user.Blockchain) || {};
  var wallets = state.LinkedWallets || {};
  var verified = false;
  Object.keys(wallets).forEach(function (key) {
    var wallet = wallets[key];
    if (wallet.NetworkID === 'solana' && wallet.Address === address &&
        (wallet.IsSignatureVerified === true || wallet.LinkType === 'SignatureVerified')) verified = true;
  });
  if (state.LastWalletLogin && state.LastWalletLogin.NetworkID === 'solana' &&
      state.LastWalletLogin.Address === address) verified = true;
  if (!verified) return {ok: false, error: 'Verify ownership of this wallet by signing the connection message.'};
  var request = server.HttpRequest({
    Method: 'POST', Url: 'https://api.mainnet-beta.solana.com', ContentType: 'application/json',
    Body: JSON.stringify({jsonrpc: '2.0', id: 1, method: 'getTokenAccountsByOwner', params: [
      address, {mint: 'CdomqHDyfMGEDPpBzgLHMaP9N6DTnSfkW36dh8eSidos'},
      {encoding: 'jsonParsed', commitment: 'confirmed'}
    ]})
  });
  if (!request.Success || !request.Data.Ok || request.Data.BodyTooLarge)
    throw new Error('STICK balance could not be checked. Please retry.');
  var result = JSON.parse(request.Data.Body);
  if (result.error || !result.result || !Array.isArray(result.result.value))
    throw new Error('STICK balance could not be checked. Please retry.');
  function add(a, b) {
    var carry = 0, out = '', i = a.length - 1, j = b.length - 1;
    while (i >= 0 || j >= 0 || carry) {
      var digit = (i >= 0 ? Number(a[i--]) : 0) + (j >= 0 ? Number(b[j--]) : 0) + carry;
      out = String(digit % 10) + out; carry = Math.floor(digit / 10);
    }
    return out.replace(/^0+(?=\d)/, '');
  }
  var raw = '0';
  result.result.value.forEach(function (entry) {
    var info = entry.account.data.parsed.info;
    if (info.mint !== 'CdomqHDyfMGEDPpBzgLHMaP9N6DTnSfkW36dh8eSidos' || info.owner !== address ||
        info.tokenAmount.decimals !== 6 || !/^\d+$/.test(info.tokenAmount.amount))
      throw new Error('Invalid STICK balance response.');
    raw = add(raw, info.tokenAmount.amount);
  });
  return {ok: true, address: address, mint: 'CdomqHDyfMGEDPpBzgLHMaP9N6DTnSfkW36dh8eSidos',
    rawBalance: raw, decimals: 6, checkedAt: new Date().toISOString()};
};
