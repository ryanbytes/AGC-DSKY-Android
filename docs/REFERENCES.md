# References

## Network time

- IETF RFC 5905, section 8, NTP four-timestamp offset and round-trip-delay equations: https://datatracker.ietf.org/doc/html/rfc5905#section-8

## Apollo / VirtualAGC

- Virtual AGC project: https://github.com/virtualagc/virtualagc
- Virtual AGC site: https://www.ibiblio.org/apollo/
- AC Electronics, ND-1021042 Rev. F, Volume II, *LEM Primary Guidance, Navigation, and Control System Manual*, §§4-5.10–4-5.10.2, pp. 4-648–4-649: CMC main/navigation DSKYs are described as electrically identical/interchangeable; the relay matrix is identified as latching and status/caution relays as non-latching. No production relay operate/release/bounce timing is specified in this section. https://www.ibiblio.org/apollo/Documents/acelectroniclmma00acel_0.pdf
- MIT/MSC Specification Control Drawing `1006315G`, *Indicator, Digital, Electroluminescent*: https://www.ibiblio.org/apollo/SCDs/scd_1006315g.pdf
- Virtual AGC developer information / yaAGC I/O protocol: https://www.ibiblio.org/apollo/developer.html
- VirtualAGC `yaDSKY2/LM.ini`: LM annunciator map, channel assignments, key codes.
- VirtualAGC `piPeripheral/humanizeScript.py`: channel `010` relay-word decoding and DSKY channel bit names.
- VirtualAGC `piPeripheral/convertNasspLog.py`: DSKY relay/digit code generation and register/sign relay mapping.
- VirtualAGC `yaAGC/agc_engine.h`: fictitious channel `0163` DSKY modulation masks.
- VirtualAGC `yaAGC/agc_engine.c`: DSKY hardware reconstruction, RESTART flip-flop/RSET behavior, STBY/EL-off behavior, channel `0163` output.
- VirtualAGC `yaAGC/ringbuffer_api.c`: browser/WASM input transport and KEYRUPT generation behavior.
- Apollo 11 Comanche 055 at VirtualAGC commit `ddc65e7bed41f1301921b934fcbaaee93db99dda`: [`ASSEMBLY_AND_OPERATION_INFORMATION.agc`](https://github.com/virtualagc/virtualagc/blob/ddc65e7bed41f1301921b934fcbaaee93db99dda/Comanche055/ASSEMBLY_AND_OPERATION_INFORMATION.agc) defines regular verbs and noun component/format restrictions; [`PINBALL_NOUN_TABLES.agc`](https://github.com/virtualagc/virtualagc/blob/ddc65e7bed41f1301921b934fcbaaee93db99dda/Comanche055/PINBALL_NOUN_TABLES.agc) maps nouns to erasable registers and types; [`PINBALL_GAME__BUTTONS_AND_LIGHTS.agc`](https://github.com/virtualagc/virtualagc/blob/ddc65e7bed41f1301921b934fcbaaee93db99dda/Comanche055/PINBALL_GAME__BUTTONS_AND_LIGHTS.agc) implements CM Pinball keyboard processing, RSET/error-reset, display lock/release, and regular-verb behavior.
- Apollo 11 Luminary 099 `PINBALL_GAME_BUTTONS_AND_LIGHTS.agc`: original DSKY key codes, channel 15 keyboard behavior, channel 10 relay-word display format, and relay digit codes.
- Apollo 11 source mirror: https://github.com/chrislgarry/Apollo-11
- Apollo-derived DSKY interface drawing: https://commons.wikimedia.org/wiki/File:Apollo_DSKY_interface.svg
- NASA, *Apollo Onboard Navigation*, slides 7–12: the Basic Reference Coordinate System is inertial, carries the navigation stars, and uses the nearest beginning-of-year epoch; its axes are tied to the mean equator/equinox. https://ntrs.nasa.gov/api/citations/20090016292/downloads/20090016292.pdf?attachment=true
- MIT Instrumentation Laboratory, SGA Memo 8-71, *Choice of Time-Points for the Various Apollo Nearest Besselian Ephemeris Years*: identifies NBY 1969/1970 as Apollo 11/12/13 and gives its 1970.0 reference epoch. https://www.ibiblio.org/apollo/Documents/SGA-Memo-8-71-Robertson.pdf
- NASA Technical Note D-6741, *Onboard Navigation Software*: identifies Apollo's NBY frame and states that the star-table vectors were accurate to about 5 arcseconds over only ±3 years, with periodic updating needed. https://www.nasa.gov/wp-content/uploads/static/history/alsj/tnD6741OnbrdNavSoftwr.pdf
- International Astronomical Union Standards of Fundamental Astronomy (SOFA): official precession and Earth-orientation algorithms; `apollo-stars.js` uses the lightweight IAU 1976 precession model to move the old Apollo mean coordinates to the observation-date mean frame. https://www.iausofa.org/current-software
- van Leeuwen (2007), *Hipparcos, the New Reduction of the Raw Data*, catalogue I/311: the selected bright-star positions are ICRS at epoch J1991.25; ESA documents `mu_alpha*cos(dec)` and `mu_delta` in mas per Julian year. The catalogue guidance recommends its linear main-catalogue motion for distant-epoch extrapolation rather than extrapolating the short-baseline acceleration model. https://cdsarc.cds.unistra.fr/viz-bin/ReadMe/I/311?format=html&tex=true https://hipparcos-tools.cosmos.esa.int/pstex/sect2_03.pdf
- SIMBAD's Deneb (α Cygni) and Polaris (α UMi) positions are independent regression checkpoints; the lookups use ICRS/J2000 coordinates and the database documents that coordinate epoch convention. https://simbad.cds.unistra.fr/simbad/sim-id?Ident=Deneb https://simbad.cds.unistra.fr/simbad/sim-id?Ident=Polaris https://simbad.u-strasbg.fr/Pages/guide/sim-fsam.htx
- SIMBAD's Arcturus (α Boötis) ICRS/J2000 position is an independent high-proper-motion checkpoint for the phone star-finder propagation test. https://simbad.cds.unistra.fr/simbad/sim-basic?Ident=Arcturus
- U.S. Naval Observatory Celestial Navigation API: independent geocentric computed altitude (`Hc`), true azimuth (`Zn`), and separate atmospheric-refraction corrections; its input time is UT1 and refraction assumes sea-level standard atmospheric conditions. `tools/apollo-stars-usno-smoke.js` records a 13-star 2026-10-03 sample and checks both geometric and apparent finder directions. https://aa.usno.navy.mil/data/api.html https://aa.usno.navy.mil/data/celnav
- Bennett, G. G. (1982), “The Calculation of Astronomical Refraction in Marine Navigation,” *The Journal of Navigation*, 35(2), 255–259, DOI: 10.1017/S0373463300022037. Its true-altitude approximation is used for the camera cue with standard sea-level conditions; USNO CelNav sample corrections independently check the implementation. https://doi.org/10.1017/S0373463300022037
- U.S. Naval Observatory, “Computing Altitude and Azimuth from Greenwich Apparent Sidereal Time” and “Computing Approximate Sidereal Time”: reference definitions for apparent sidereal time and horizon-coordinate conversion. https://aa.usno.navy.mil/faq/alt_az https://aa.usno.navy.mil/faq/GAST

### Block II DSKY key hardware

These sources are authoritative for the source-backed mechanical envelope in `key-mechanical-spec.js`:

- MIT/IL final report R-700, *Apollo Guidance, Navigation and Control — MIT's Role in Project Apollo, Vol. III, Computer Subsystem*, §3.10.1.5, Pushbutton Switch: approximately `3/16 in` cap-housing movement to switch actuation plus `1/16 in` additional travel before bottoming, for approximately `1/4 in` total stroke. https://www.ibiblio.org/apollo/Documents/R-700.pdf
- NASA/MIT drawing `2004941`, compression spring, DSKY pushbutton: `3.0–3.5 lb/in` spring rate, `0.500 in` free length (REF), `0.100 in` maximum solid height, approximately `1.2 lb` load at solid height, `0.245 in` OD, `0.016 in` wire.
- NASA specification-control drawing `1010901`, sensitive switch: `7 oz` maximum actuating force, `1 oz` minimum release force, `0.030 in` maximum pretravel, `0.006 in` maximum differential movement, `0.003 in` minimum overtravel, `3 lb` maximum overtravel force, SPDT contacts, minimum 25,000 operating cycles. https://www.ibiblio.org/apollo/SCDs/scd_1010901b.pdf
- NASA/MIT shaft assembly `2003975-011`: key EL panel acceptance requirement of at least `2.0 foot-lamberts` at `75 Vrms`, `400 Hz`.
- Raytheon Block II development report / NASA NTRS 19700015154: later cap-housing leaf-spring redesign retained the original spring rate while improving fatigue life; Teflon-coated shafts were adopted after wear produced rough/high-force key operation. https://www.ibiblio.org/apollo/Documents/19700015154.pdf

Important modeling rule: acceptance maxima/minima are envelopes, not probability distributions. The app only samples per-key variation where a bounded manufacturing range is actually documented (currently the `3.0–3.5 lb/in` compression-spring rate). Contact timing, return-audio timing, synthesized sound pitch/gain, and screen-space key depth remain explicitly labeled presentation/interaction estimates.

The documented spring rate and assembled stroke allow only the spring-force *increase* to be calculated without additional geometry: `9.0–10.5 oz` from rest to the approximately `3/16 in` actuation position, and `12–14 oz` from rest to the approximately `1/4 in` bottomed position. These are force deltas, not total astronaut finger force. The checked surviving drawings do not establish the installed spring length/preload or a complete leaf-spring/switch/friction force curve, so `key-mechanical-spec.js` intentionally leaves total finger force unresolved. Secondary replica/reconstruction figures around `21–26 oz` are not treated as Apollo drawing requirements.

### Block II DSKY lighting controls

- The CM NUMERICS and INTEGRAL lighting controls are rheostats with mechanical stops that prevent normal rotation to OFF; spacecraft training/schematic material specifies opening the applicable circuit breaker/feed when complete lighting disable is required.
- The normal app control range is clamped to a nonzero mechanical-stop range; complete OFF is represented only as an opened lighting feed/circuit-breaker condition, not as a rheostat position. The retired LIGHT BUS DEMO is not part of the current runtime.
- `lighting-rheostat-stop.js` enforces the normal nonzero range and normalizes legacy saved zero settings back to a legal nonzero position.
- The current app control is continuous between its modeled mechanical stops. Its swipe-to-angle/percentage mapping is an interaction approximation, not a claimed Apollo rheostat calibration curve or detent pattern.
- The INTEGRAL control feeds unlike loads: illuminated key legends are electroluminescent while status/caution legends use incandescent lamps. `lighting-electrical-model.js` therefore keeps their optical response separate; the incandescent `V^3.4` response is explicitly an engineering approximation rather than an Apollo-specified dimmer curve.
- SCD/part evidence establishes the three-bulb annunciator construction but not a statistical distribution for optical rise/decay or bulb-to-bulb gain. Those presentation estimates are fixed across simulated bulbs; the app does not invent per-bulb manufacturing tolerances.

### CM IMU gimbal geometry

- Apollo-era CSM guidance documentation defines CDUX as outer, CDUY as inner, and CDUZ as middle: see the [Apollo PGNCS GSOP](https://www.ibiblio.org/apollo/Documents/R-693-GSOP-Skylark1-Section2-DataLinks.pdf) and the [Apollo DSKY/crew reference](https://www.ibiblio.org/apollo/Documents/HSI-208424.pdf). This agrees with the application mapping below. The VirtualAGC [Assembly-Language Manual](https://www.ibiblio.org/apollo/assembly_language_manual.html) currently labels CDUX inner, CDUY middle, and CDUZ outer; that explanatory text conflicts with the Apollo CSM references and must not be used as authority for physical gimbal order.
- The documented matrix is exactly `Ry(inner) * Rz(middle) * Rx(outer)`. A generic roll/pitch/yaw `Rz * Ry * Rx` decomposition agrees for isolated single-axis motion but is wrong for compound attitudes.
- `phone-icdu.js` therefore keeps conventional device Euler angles only for camera aiming and magnetic-yaw input conditioning; the flight CDU path extracts Apollo outer/inner/middle angles from the quaternion DCM before generating CDUX/CDUY/CDUZ pulses.
- Quaternion-to-gimbal inversion has two equivalent Euler branches and is singular at a 90-degree middle-gimbal angle. The phone CDU adapter selects the branch nearest the preceding sample; at the exact singularity, where outer and inner are not individually observable, it preserves their closest values subject to the observable sum/difference. This is continuity handling in the phone input adapter, not a claim that the physical Apollo IMU could pass through lock without loss of attitude reference. NASA's Apollo guidance/IMU discussion describes the physical gimbal-lock condition: https://ntrs.nasa.gov/api/citations/19660019462/downloads/19660019462.pdf
- Apollo Guidance Computer System Test Procedures, §§21-119–21-120, states the nominal CM PIPA scale factor is exactly `5.85 cm/sec/pulse`; `phone-icdu.js` uses the equivalent `0.0585 m/s` delta-V per pulse. https://www.ibiblio.org/apollo/Documents/agcis_21_system_test.pdf
- Android `SensorManager.remapCoordinateSystem` documents `AXIS_Y, AXIS_MINUS_X` for a display at `Surface.ROTATION_90`. The native PIPA path uses the inverse screen-to-device rotation for its device-to-world quaternion and the matching device-to-screen basis for acceleration vectors. Android also states that the linear-acceleration sensor has an offset and recommends sampling that offset in a calibration step while the device is still; the app therefore waits for the user's explicit `PIPA CALIBRATE` action before emitting PIPA increments. Its accelerometer fallback applies the guide's time-constant-based low-pass approach to gravity estimation; the selected `0.23 s` time constant is an app tuning value. https://developer.android.com/reference/android/hardware/SensorManager#remapCoordinateSystem(float[],int,int,float[]) https://developer.android.com/develop/sensors-and-location/sensors/sensors_motion#use-the-linear-accelerometer https://developer.android.com/develop/sensors-and-location/sensors/sensors_motion#use-the-accelerometer
- Android `SensorManager.registerListener` returns whether a sensor is successfully enabled. The native bridge now uses per-sensor registration results for PIPA/IMU availability and selects the accelerometer fallback when the preferred linear-acceleration sensor cannot be enabled. https://developer.android.com/reference/android/hardware/SensorManager#registerListener(android.hardware.SensorEventListener,android.hardware.Sensor,int)
- Android defines `SENSOR_DELAY_GAME` as a suggested 20 ms interval; actual sensor events may arrive slower or faster. `SensorEvent.timestamp` is event time on the `elapsedRealtimeNanos()` time base; events should increase monotonically per sensor, but separate sensors still deliver independently sampled streams. The phone PIPA bridge keeps those timestamps to align attitude and acceleration by interpolation, and the accelerometer fallback aligns `TYPE_GRAVITY` vectors to accelerometer event time. PIPA integration uses the full positive acceleration interval up to the app's 200 ms stale-sample guard, and ignores non-increasing acceleration events without moving its time baseline backward. The 100 ms attitude/gravity sample-age and 200 ms acceleration-interval limits are app policy, not Android or Apollo hardware limits. https://developer.android.com/reference/android/hardware/SensorManager#SENSOR_DELAY_GAME https://developer.android.com/reference/android/hardware/SensorEvent#timestamp
- Android documents that `TYPE_GAME_ROTATION_VECTOR` omits geomagnetic north and its Z/yaw reference can drift, while `TYPE_ROTATION_VECTOR` provides the magnetic reference. The phone yaw-drift correction therefore compares each sensor's conventional absolute-yaw change from its respective zero in the same display-corrected frame; comparing absolute magnetic yaw change with Euler yaw of the game quaternion's relative rotation mixes coordinate quantities. https://developer.android.com/develop/sensors-and-location/sensors/sensors_position#use-the-game-rotation-vector https://developer.android.com/reference/android/hardware/SensorManager#getRotationMatrixFromVector(float[],float[])
- W3C Device Orientation defines its device axes in the standard screen orientation; rotating the display does not rotate those axes. The browser fallback therefore right-multiplies by the screen-to-device rotation before mapping handset motion to screen/CDU axes. Android's `ROTATION_90` remap (`AXIS_Y`, `AXIS_MINUS_X`) and browser fallback regressions verify device +X maps to screen −Y at 90 degrees. https://www.w3.org/TR/orientation-event/#device-coordinate-frame https://developer.android.com/reference/android/hardware/SensorManager#remapCoordinateSystem(float[],int,int,float[])

### CM optics CDU scaling

- NASA's Apollo navigation-systems characteristics, §5.5.1.1, describes the Command Module sextant as a 28×, dual-line-of-sight instrument with a 1.8° field of view. The app uses 1.8° as the full circular field diameter (±0.9° from center) for its cue thresholds; its single camera view and reticle remain a simplified proxy, not a complete dual-LOS/magnified optical simulation. https://www.ibiblio.org/apollo/Documents/apollo_nav_systems_characteristics.pdf
- Comanche erasable assignments identify location 0035 as CDUT (optics trunnion) and 0036 as CDUS (optics shaft).
- The Block II optical shaft CDU uses 32768 counts per 360 degrees (39.55078125 arcsec/count). The optical trunnion CDU uses 32768 counts per 90 degrees (9.8876953125 arcsec/count); these scales must not be shared.
- Comanche ZERO OPTICS stores zero in CDUS and `-20DEGS` in CDUT. The programmed `20DEGS` magnitude is 7200 signed CDUT counts, equivalent to 19.775390625 degrees. True trunnion line-of-sight angle is therefore decoded from signed CDUT plus that programmed bias.
- `optics.js` and the explicitly non-flight `sextant-tap-mark.js` simulator aid use the same source-backed shaft/trunnion delta scales. Only the live readout applies the absolute CDUT zero bias.

### Mappings implemented in v0.7

- COMP ACTY: output channel `011` octal, bit 2.
- UPLINK ACTY: output channel `011` octal, bit 3.
- DSKY numerical/relay output: channel `010` octal.
- Normal DSKY keys: input channel `015` octal.
- PRO/Proceed: input channel `032` octal, bit 14.
- yaAGC modulated DSKY state: fictitious channel `0163` octal.

## webAGC

- Source: https://github.com/michaelfranzl/webAGC
- Pinned by this repository at commit `0575ea7a1231e3948bae7d2c22a6ac146da0c38d`.

webAGC supplies the Comanche rope and a behavioral reference. The Android/Apple/PWA builds use the separately rebuilt CM-configured core documented in `vendor/yaAGC-cm/README.md`. Its `src/webAGC.js` documents the `cpu_step`, `packet_read`, `packet_write`, fixed-memory loading, channel `011`, and channel `0163` flow used as an embedding reference.

The Android project does not require the online webAGC demo for onboard AGC mode.

## Genuine DSKY visual references

CuriousMarc restoration videos were used to stop treating modern CAD/SVG styling as the visual master and instead compare against genuine hardware:

- `Apollo DSKY - part 1: we have a real (and broken) DSKY!`
- `Genuine NASA Apollo DSKY Full Restoration — part 2`
- `Apollo Guidance Computer Part 28: real DSKY display works again after 50 years`

Channel: https://www.youtube.com/@CuriousMarc

Key observations used in the current face:

- EL segments are flat surface emitters, not LED bars.
- Glow should be restrained and relatively uniform.
- Segment ends/corners are more sculpted than a generic seven-segment font.
- Display labels, register separators, COMP ACTY, and numeric segments visually belong to one EL assembly.
- The physical DSKY has significant recess depth, seams, and non-flat mechanical construction.

No CuriousMarc video frames are copied into this repository.
