# SNAKE cosmetic access proposal

SNAKE is the founder's planned own Solana token linked to SolSnake on iDos Games. The proposal replaces game-coin skin prices with access based on how much SNAKE a connected wallet holds.

## Intended flow

Connect a wallet, prove control of its address, read the balance for the chosen SNAKE mint, and display the skins unlocked by that balance tier. Holding for access does not spend the tokens. Gameplay and movement remain off-chain.

## Decisions still open

- Token mint, token standard, supply and issuance schedule.
- Balance thresholds and the skins assigned to each tier.
- Refresh frequency and behavior when a wallet sells or transfers tokens.
- Trusted eligibility enforcement and persistence on iDos Games.
- Revenue model and distribution strategy.

There is no deployed SNAKE mint or implemented wallet integration in this repository. No yield, token-price increase or revenue forecast is promised. This proposal is a product plan, not measured user demand.

## Implementation references

- [Solana: getTokenAccountsByOwner](https://solana.com/docs/rpc/http/gettokenaccountsbyowner): query token accounts for an owner and selected mint.
- [Phantom: signing a message](https://docs.phantom.com/solana/signing-a-message): wallet signatures for proving control of an address.

References checked on 2026-10-11. These APIs describe the proposed implementation, not a completed integration.
