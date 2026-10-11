# Architecture

SolSnake runs in the browser using a Canvas renderer and a JavaScript simulation. Vite bundles the client for hosting on iDos Games.

## Room-code multiplayer

1. The creator receives an eight-character room code.
2. The iDos Games SDK creates a public room named `SolSnake CODE` and provides guest identity and signaling.
3. Joining clients find the room by its code and establish WebRTC connections.
4. One participant's browser runs the authoritative simulation. Peers send input and receive world snapshots.
5. Leaving closes the session and returns the client to local play. Host changes can reset the round.

The configured room cap is eight players. Gameplay was checked with two distinct guest clients; eight-player performance has not been load tested. Room codes are invitations rather than passwords: the underlying rooms are publicly listed. A participant hosting the simulation remains a trust and availability limitation.

## Planned wallet access

Wallet connection, proof of wallet control, SNAKE balance reads and persistent cosmetic eligibility are future work. They are not needed for the current demo. The chosen mint must be fixed explicitly, balances must respect token decimals, and the eligibility decision must be enforced through a trusted platform service rather than only a browser flag.

The current Shop displays game-coin prices. Its purchase operations are not implemented by the browser networking adapter.

## Source map

- `src/client/js/PlatformNet.js`: identity, signaling, room lifecycle and peer transport.
- `src/client/js/main.js`: menu and player flow.
- `src/server/Room.js`: simulation adapted for execution in the host browser.
- `src/client/js/Shop.js`: existing shop interface.
- `index.html`, `css/`: browser interface.
