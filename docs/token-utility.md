# STICK cosmetic access

SolSnake uses the existing STICK token attached to iDos Games title `FPC8NUE4`. The earlier SNAKE launch proposal has been superseded.

- Network: Solana mainnet.
- Mint: `CdomqHDyfMGEDPpBzgLHMaP9N6DTnSfkW36dh8eSidos`.
- Decimals: 6.
- Purpose: cosmetic access based on current holdings, without token transfers or purchases.

## Holding requirements

| Minimum STICK held | Skins |
| --- | --- |
| 0 | Red, Blue, Green, Yellow |
| 500 | Orange, Light Blue |
| 1,000 | Sandy, Frost |
| 2,500 | Sunset, Ocean, Crimson |
| 5,000 | Royal, Dark Green, Lavender |
| 10,000 | Rainbow |
| 25,000 | Neon |

These values match the former game-currency prices. All qualifying tiers unlock together: holding 10,000 STICK enables Rainbow and every lower tier. Access is not a permanent purchase.

## Implemented flow

1. The player connects Phantom or Solflare on the direct game URL, or uses the official wallet bridge inside iDos Games.
2. The SDK associates a verified wallet with the platform player using an ownership message. Free play does not require a wallet.
3. `solSnakeStickHoldings` reads the player's Blockchain data and requires a verified matching Solana wallet association or matching last wallet login.
4. CloudCode calls `getTokenAccountsByOwner` for the fixed mint at confirmed commitment. It validates the owner, mint and six decimals, and sums atomic integer strings across token accounts.
5. The client compares the returned balance against the skin thresholds. It refreshes every 30 seconds and before play/respawn; checked access expires after 60 seconds.
6. Disconnect, wallet change, stale eligibility or a failed refresh restores a free skin. Pending responses from an earlier connection cannot restore access.

The public wallet address is sent to Solana RPC for a balance read. No private keys are handled, and this flow requests no token transfer or financial transaction. A reload requires reconnecting the wallet.

## Deployment

Build and upload `dist/` to the configured iDos Games title. Deploy the handler from `cloudcode/stick-holdings.js` under the name `solSnakeStickHoldings`.

Enable CloudCode HTTP requests with only `api.mainnet-beta.solana.com` allowed, HTTPS required, one request per invocation, timeout 7,000 ms and response limit 131,072 bytes. Keep logs and stack traces hidden from clients. The balance handler is read-only and does not grant inventory items or save permanent skin ownership.

The production title already has this handler and the holder Shop deployed. Local source checkout alone does not recreate platform configuration.

## Verification and limits

`npm test` runs six checks covering exact thresholds, multi-account sums, ownership rejection, RPC failures and decimal validation, invalid skin messages, and access revocation. Production builds and free-skin browser flows were checked. A real holder's wallet signature and positive unlock path have not been verified end to end.

The balance is checked by CloudCode, but cosmetic selection and gameplay remain in browsers. A modified client or host can bypass client-side cosmetic rules. This implementation should not be described as tamper-proof token gating. RPC availability, cross-wallet compatibility and real holder behavior need further testing. No token-price, yield or revenue claims are made.
