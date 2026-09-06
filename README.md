# AGC DSKY Android

Android recreation of the Apollo Block II DSKY with local/offline AGC execution, DreamService display modes, and an EL-only home-screen widget.

## Spacecraft modes

The interactive app defaults to the **Command Module** configuration and **Comanche 055**. The alternate **Lunar Module** configuration uses **Luminary 099**. The same Block II DSKY is shared by both modes while the surrounding spacecraft panel changes with the selected rope.

### DSKY-centred panel rendering

The normal full-app view keeps the DSKY centred on screen. A larger spacecraft-panel scene is registered to the exact 320 x 372 DSKY rectangle, so display aspect ratio changes only the crop of the surrounding panel.

- CM surround is organized around Block II Main Display Console Panel 2: caution/warning and mission timer above, FDAI No. 2 to the left, CMC DSKY at 2C, abort/boost/entry controls below, and RCS management to the right.
- LM surround is organized around LM Panel 4 / Figure 3.6: CDR and LMP ACA/4 JET and TTCA/TRANSL switches immediately flanking the DSKY, Panel 3 directly above, and Panels 5/6 plus the forward hatch below.

Dream, SCREEN, and legacy display-only modes intentionally omit the spacecraft surround.

## Local-only runtime

The application does not request `android.permission.INTERNET`. AGC WASM/rope inputs are packaged locally and verified against pinned Git blob identities before a canonical Gradle build.

Pinned inputs:

- `yaAGC.wasm`: 132,617 bytes, Git blob `713685680492098d05437b99c26403f683d56009`
- `Luminary099.bin`: 73,728 bytes, Git blob `cd2ec9992d5863e1c7234fa760020f68ef946202`
- `Comanche055.bin`: 73,728 bytes, Git blob `9e4ec167dc99ac12b233df07b6b91fef585e5015`

The recursive `webAGC` submodule is pinned to commit `0575ea7a1231e3948bae7d2c22a6ac146da0c38d`.
