# Cooperative Chess — Six-Player Rules Prototype

A clean-slate prototype for a cooperative chess variant: **six human armies vs. one central CPU fortress**.

This repository intentionally does not reuse code, styling, or gameplay from the earlier Handshake experiments.

## Board rule under test

The six-player stress-test board is **17 files × 22 ranks**.

Every human front pawn line starts **four empty squares away** from the nearest CPU front/pawn line:

- Top pawns: rank 2 → four empty ranks 3–6 → CPU front at rank 7
- Bottom pawns: rank 21 → four empty ranks 17–20 → CPU front at rank 16
- Left pawns: file B → four empty files C–F → CPU front at file G
- Right pawns: file P → four empty files L–O → CPU front at file K

The board remains a normal square grid for every player count.

## Prototype rules

- Six separate human armies cooperate against one CPU army.
- Turn order: **P1 → CPU → P2 → CPU → ... → P6 → CPU → P1**.
- Human pieces cannot capture teammates. Allied pieces block movement normally.
- Human kings follow normal check rules.
- If a human king is in check, that player's move must resolve the check.
- If a human king has no legal move that resolves check, that player is eliminated and their entire army disappears.
- The CPU king cannot be captured.
- A checkmated/pinned CPU king does **not** end the game while other CPU pieces remain.
- Once the CPU king is the only CPU piece left, normal checkmate ends the game immediately.
- Castling and en passant are disabled in this first prototype.
- Pawns keep the forward direction of the army/front from which they started.
- Promotion is currently to queen only for rules testing.

## Why start with six players?

Six players exercises every geometry case: two top armies, two bottom armies, a left army, a right army, horizontal and vertical pawn movement, allied blocking, multiple kings, and the expanded CPU fortress. If the rules engine behaves here, smaller versions are reductions of the same system.

## Status

This is a **hot-seat/rules prototype**, not the finished networked Handshake game. The next step is to play the six-player geometry, verify movement and check behavior, then lock the board setup before networking and AI polish.
