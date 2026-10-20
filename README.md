# DoubleFour

**Your loop never changes gear, so it never ends.** DoubleFour keeps your BPM and your 4 chords and plays 4 bars as they are, then moves kit, upright bass and piano up one subdivision for 4 bars (16th hats, 8th bass, pushed piano). The strings keep holding the harmony at the original pace. Export the 8 bars as a seamless WAV plus matching MIDI.

- Static HTML/CSS/JS, no account, no database. Settings stay in localStorage.
- Chairs: acoustic kit (Virtuosity Drums, CC0), upright bass, grand piano, string ensemble (FluidR3 GM, CC BY 3.0, Frank Wen).
- Every semitone is loaded, so no note is pitch-shifted (the engine cap is ±4 semitones, using the nearest sample).
- Samples come from jsDelivr at pinned commits:
  - gleitz/midi-js-soundfonts@044fab8e1456bfafc5776e86dfd6bb8697149aef
  - sfzinstruments/virtuosity_drums@9f04cf9a734527edfbb0a4eee1f674e45bbf71bc
- Export: 48 kHz / 24-bit / stereo WAV. The downbeat sits at sample 0, the length is exact, the tail is folded back to the start, the peak is −1.1 dBFS and compressor latency is compensated. MIDI is format 1 with tempo and 4/4.
- Web MIDI: a chord can be played in, or a MIDI clock/transport can drive it.
- Price: $29 one-time (Lemon Squeezy license key). The free demo exports 4 bars.
- Checkout config lives in one place: `LEMON` at the top of the license section in `app.js` (`checkoutUrl`, `storeId`, `productId`). Keys are activated per device (`/v1/licenses/activate`) and accepted only when `meta.store_id` and `meta.product_id` match. They are re-validated on load, so refunded or disabled keys relock. "Remove key" deactivates the device. Until the config is filled in, the Buy button shows "Checkout opening soon" and no key unlocks.

`npm run build` puts the files in `dist/`. Code is MIT; the samples keep their own licenses (see the credits in the app).
