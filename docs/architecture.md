# Architecture

SolSnake uses a Canvas client, a shared JavaScript simulation and a Vite build hosted on iDos Games.

## Room-code multiplayer

1. The host creates an eight-character invitation code and a public room named `SolSnake CODE`.
2. iDos Games provides guest identity, membership and signaling.
3. Joining clients locate the room and establish WebRTC connections.
4. The host browser runs the simulation. Peers send inputs and receive world snapshots.
5. Leaving returns to local play. Host handover starts a fresh round.

Capacity is configured for eight players; earlier gameplay checks used two distinct guest clients. Eight-player load and broad network compatibility remain untested. Codes are invitations, not secret passwords. A browser host controls simulation and availability.

## STICK wallet access

`StickWallet.js` uses the official wallet SDK to connect and associate an address with the platform player. `solSnakeStickHoldings` verifies that association using server-side player data, then queries only the fixed STICK mint on Solana mainnet. It validates and sums exact atomic balances rather than using floating-point token amounts.

The client Shop derives cosmetic eligibility from the returned balance. Refreshes run every 30 seconds and before play/respawn; access expires after 60 seconds. Failures, disconnection or wallet changes restore a free selection. Updated skin messages propagate the active selection to the arena.

## Trust boundaries

CloudCode rejects an arbitrary unverified address and performs the balance read outside the client. It does not write inventory or enforce every skin message on a trusted simulation server. The client and host remain modifiable, so cosmetic access is not tamper-proof. Tokens are neither transferred nor burned. The public address is transmitted to the configured RPC endpoint. See [token utility](token-utility.md) for settings and verification limits.

## Source map

- `src/client/js/PlatformNet.js`: identity, room lifecycle and WebRTC transport.
- `src/client/js/StickWallet.js`: wallet connection, balance refresh and eligibility lifetime.
- `src/client/js/Shop.js`: holding tiers and skin selection.
- `src/client/js/main.js`, `ui.js`: menu, play/respawn and UI behavior.
- `src/server/Room.js`: simulation running in the host browser.
- `src/shared/colors.js`, `protocol.js`: skin thresholds and messages.
- `cloudcode/stick-holdings.js`: verified-wallet balance handler.
- `tests/stick-holdings.test.js`: six automated checks.
- `index.html`, `css/`: interface.
