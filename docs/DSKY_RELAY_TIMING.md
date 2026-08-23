# DSKY relay timing model

This project separates source-backed AGC/DSKY timing from acoustic simulation.

## Source-backed timing

For Apollo 11 Luminary 99, `T4RUPT_PROGRAM.agc` shows the display path writing a selected relay bank to `OUT0`, entering `HANG20`, scheduling `20MRUPT`, then using `QUIKDSP` / `QUIKOFF` to remove relay drive and service further display work. The normal T4 service period is 120 ms.

The Android clock-mode emulator therefore uses:

- Normal display service: **120 ms**
- Selected bank coil-drive / latch interval: **20 ms**
- Drive removed for the following **20 ms**
- Successive dirty-bank commands during a quick-display cascade: **40 ms** start-to-start

The Block II DSKY relay matrix has 12 rows of latching relays. Channel 10 selects one row and supplies 11 relay bits. Those relays are electrically commanded in parallel; five relay bits encode each decimal character and the eleventh bit may control a sign/discrete.

## Acoustic model

The app may emit more than one audible click when several relay bits change in a selected bank. This does **not** mean the AGC serially drives those relays. They are driven in parallel.

To keep individual mechanical operations audible while remaining inside the documented latch interval, the sound model distributes changed-relay contact snaps across at most **14 ms** of the 20 ms coil-drive window. This 14 ms spread is an acoustic/mechanical simulation parameter, not a claimed Apollo hardware timing specification.

## AGC mode

When running Luminary through yaAGC, software-originated Channel 10 timing is retained. The frontend does not impose a second 120/40 ms software schedule on authentic AGC output. It only models individual relay/contact sound for the bits that actually change.

## Primary references

- Apollo 11 Luminary 99 `T4RUPT_PROGRAM.agc`: `HANG20`, `20MRUPT`, `QUIKDSP`, `QUIKOFF`, `120MRUPT`.
- AGC Information Series errata: one relay bank may be switched during the 120 ms T4RUPT service.
- MIT/NASA AGC/DSKY descriptions: selected DSKY latching relays require a 20 ms drive/settling interval; the relay matrix uses a selected row plus 11 parallel relay-bit lines.
