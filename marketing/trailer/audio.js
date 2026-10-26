// Original soundtrack for the Harvestia trailer, synthesized offline (deterministic).
// 120 BPM, A minor (Am – F – C – G). `music: false` renders ambience + sound effects only.
const SR = 48000;
const midi = n => 440 * 2 ** ((n - 69) / 12);
let seed = 1;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

export async function buildSoundtrack(dur, music) {
  seed = 7;
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * dur), SR);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 3.5; comp.attack.value = .004; comp.release.value = .2;
  const master = ctx.createGain(); master.gain.value = .7;
  // the compressor adds its own makeup gain; trim after it to leave ~1.5 dB of headroom
  const out = ctx.createGain(); out.gain.value = .82;
  master.connect(comp); comp.connect(out); out.connect(ctx.destination);
  // reverb send
  const verb = ctx.createConvolver(), ir = ctx.createBuffer(2, SR * 2.6, SR);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = (rand() * 2 - 1) * Math.pow(1 - i / d.length, 3.2); }
  verb.buffer = ir; const verbGain = ctx.createGain(); verbGain.gain.value = .28; verb.connect(verbGain); verbGain.connect(master);
  const bus = (vol = 1, rev = .2) => { const gn = ctx.createGain(); gn.gain.value = vol; gn.connect(master); if (rev) { const s = ctx.createGain(); s.gain.value = rev; gn.connect(s); s.connect(verb); } return gn; };

  const noise = ctx.createBuffer(1, SR * 3, SR); { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rand() * 2 - 1; }
  const noiseSrc = (t, len) => { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.start(t, rand() * 2, len + .05); return s; };
  const env = (gp, t, peak, a, d, sustain = 0, rel = .05, hold = 0) => {
    gp.setValueAtTime(0, t); gp.linearRampToValueAtTime(peak, t + a);
    gp.exponentialRampToValueAtTime(Math.max(1e-4, peak * sustain || 1e-4), t + a + d + hold);
    if (sustain) gp.setTargetAtTime(1e-4, t + a + d + hold, rel);
  };

  // ---------------------------------------------------------------- instruments
  const drumBus = bus(.9, .08), padBus = bus(.5, .45), arpBus = bus(.32, .4), bassBus = bus(.55, .05), sfxBus = bus(.9, .3), ambBus = bus(.55, .2);
  const kick = (t, v = 1) => {
    const o = ctx.createOscillator(), gn = ctx.createGain();
    o.frequency.setValueAtTime(155, t); o.frequency.exponentialRampToValueAtTime(42, t + .14);
    env(gn.gain, t, v, .002, .42); o.connect(gn); gn.connect(drumBus); o.start(t); o.stop(t + .5);
  };
  const clap = (t, v = .5) => {
    const s = noiseSrc(t, .25), f = ctx.createBiquadFilter(), gn = ctx.createGain();
    f.type = 'bandpass'; f.frequency.value = 1700; f.Q.value = .8; env(gn.gain, t, v, .002, .18);
    s.connect(f); f.connect(gn); gn.connect(drumBus);
  };
  const hat = (t, v = .14, open = false) => {
    const s = noiseSrc(t, .2), f = ctx.createBiquadFilter(), gn = ctx.createGain();
    f.type = 'highpass'; f.frequency.value = 7500; env(gn.gain, t, v, .001, open ? .16 : .035);
    s.connect(f); f.connect(gn); gn.connect(drumBus);
  };
  const crash = (t, v = .25) => {
    const s = noiseSrc(t, 2.2), f = ctx.createBiquadFilter(), gn = ctx.createGain();
    f.type = 'highpass'; f.frequency.value = 4500; env(gn.gain, t, v, .002, 1.9);
    s.connect(f); f.connect(gn); gn.connect(drumBus);
  };
  const pluck = (t, n, v = .3, len = .22, bright = 3200) => {
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), gn = ctx.createGain();
    o1.type = 'triangle'; o2.type = 'square'; o1.frequency.value = midi(n); o2.frequency.value = midi(n) * 1.003;
    const g2 = ctx.createGain(); g2.gain.value = .25;
    f.type = 'lowpass'; f.frequency.setValueAtTime(bright, t); f.frequency.exponentialRampToValueAtTime(500, t + len);
    env(gn.gain, t, v, .003, len);
    o1.connect(f); o2.connect(g2); g2.connect(f); f.connect(gn); gn.connect(arpBus);
    o1.start(t); o2.start(t); o1.stop(t + len + .1); o2.stop(t + len + .1);
  };
  const pad = (t0, t1, notes, v = .07, cutoff = 1400) => {
    for (const n of notes) for (const det of [-6, 6]) {
      const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), gn = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = midi(n); o.detune.value = det;
      f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = .4;
      gn.gain.setValueAtTime(0, t0); gn.gain.linearRampToValueAtTime(v, t0 + .35); gn.gain.setValueAtTime(v, t1 - .25); gn.gain.linearRampToValueAtTime(0, t1 + .3);
      o.connect(f); f.connect(gn); gn.connect(padBus); o.start(t0); o.stop(t1 + .35);
    }
  };
  const bass = (t, n, len = .45, v = .5) => {
    const o = ctx.createOscillator(), s = ctx.createOscillator(), f = ctx.createBiquadFilter(), gn = ctx.createGain(), sg = ctx.createGain();
    o.type = 'sine'; s.type = 'sawtooth'; o.frequency.value = midi(n); s.frequency.value = midi(n); sg.gain.value = .35;
    f.type = 'lowpass'; f.frequency.value = 420; env(gn.gain, t, v, .005, len);
    o.connect(gn); s.connect(sg); sg.connect(f); f.connect(gn); gn.connect(bassBus);
    o.start(t); s.start(t); o.stop(t + len + .1); s.stop(t + len + .1);
  };

  // ---------------------------------------------------------------- sound effects
  const impact = (t, v = 1) => {
    const o = ctx.createOscillator(), gn = ctx.createGain();
    o.frequency.setValueAtTime(72, t); o.frequency.exponentialRampToValueAtTime(28, t + 1.4);
    env(gn.gain, t, v * .9, .004, 1.6); o.connect(gn); gn.connect(sfxBus); o.start(t); o.stop(t + 1.8);
    const s = noiseSrc(t, 1.2), f = ctx.createBiquadFilter(), g2 = ctx.createGain();
    f.type = 'lowpass'; f.frequency.setValueAtTime(2400, t); f.frequency.exponentialRampToValueAtTime(120, t + 1);
    env(g2.gain, t, v * .5, .002, 1); s.connect(f); f.connect(g2); g2.connect(sfxBus);
  };
  const whoosh = (t, len = .8, v = .35, up = true) => {
    const s = noiseSrc(t, len + .2), f = ctx.createBiquadFilter(), gn = ctx.createGain();
    f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(up ? 300 : 5000, t); f.frequency.exponentialRampToValueAtTime(up ? 5200 : 260, t + len);
    gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(v, t + len * .7); gn.gain.linearRampToValueAtTime(0, t + len);
    s.connect(f); f.connect(gn); gn.connect(sfxBus);
  };
  const riser = (t0, t1, v = .3) => {
    const s = noiseSrc(t0, t1 - t0 + .1), f = ctx.createBiquadFilter(), gn = ctx.createGain();
    f.type = 'highpass'; f.frequency.setValueAtTime(400, t0); f.frequency.exponentialRampToValueAtTime(9000, t1);
    gn.gain.setValueAtTime(0, t0); gn.gain.linearRampToValueAtTime(v, t1 - .02); gn.gain.linearRampToValueAtTime(0, t1 + .05);
    s.connect(f); f.connect(gn); gn.connect(sfxBus);
  };
  const chime = (t, n, v = .25, len = 1.6) => {
    for (const [mul, a] of [[1, 1], [2.01, .45], [3.0, .2], [4.17, .12]]) {
      const o = ctx.createOscillator(), gn = ctx.createGain();
      o.frequency.value = midi(n) * mul; env(gn.gain, t, v * a, .003, len / mul);
      o.connect(gn); gn.connect(sfxBus); o.start(t); o.stop(t + len + .1);
    }
  };
  const pop = (t, v = .18) => {
    const o = ctx.createOscillator(), gn = ctx.createGain();
    o.frequency.setValueAtTime(520 + rand() * 300, t); o.frequency.exponentialRampToValueAtTime(1300, t + .06);
    env(gn.gain, t, v, .002, .09); o.connect(gn); gn.connect(sfxBus); o.start(t); o.stop(t + .15);
  };
  const swish = (t, v = .3) => whoosh(t, .35, v, false);
  const wind = (t0, t1, v = .18) => {
    const s = noiseSrc(t0, t1 - t0), f = ctx.createBiquadFilter(), gn = ctx.createGain();
    f.type = 'lowpass'; f.frequency.value = 520;
    gn.gain.setValueAtTime(0, t0);
    for (let t = t0; t < t1; t += .5) gn.gain.linearRampToValueAtTime(v * (.55 + .45 * Math.sin(t * 1.3) ** 2), t);
    gn.gain.linearRampToValueAtTime(0, t1);
    s.connect(f); f.connect(gn); gn.connect(ambBus);
  };
  const bird = t => {
    const o = ctx.createOscillator(), gn = ctx.createGain(), base = 3200 + rand() * 1600;
    o.type = 'sine';
    for (let k = 0; k < 3; k++) { const tt = t + k * .09; o.frequency.setValueAtTime(base, tt); o.frequency.exponentialRampToValueAtTime(base * 1.4, tt + .05); }
    gn.gain.setValueAtTime(0, t); for (let k = 0; k < 3; k++) { const tt = t + k * .09; gn.gain.linearRampToValueAtTime(.05, tt + .01); gn.gain.linearRampToValueAtTime(0, tt + .07); }
    o.connect(gn); gn.connect(ambBus); o.start(t); o.stop(t + .4);
  };

  // ---------------------------------------------------------------- arrangement
  const BEAT = .5, BAR = 2;
  const CH = [ // pad voicing, bass root, arp notes
    { pad: [57, 60, 64, 69], root: 45, arp: [69, 72, 76, 72, 81, 76, 72, 69] },
    { pad: [53, 57, 60, 65], root: 41, arp: [65, 69, 72, 69, 77, 72, 69, 65] },
    { pad: [55, 60, 64, 67], root: 48, arp: [67, 72, 76, 72, 79, 76, 72, 67] },
    { pad: [55, 59, 62, 67], root: 43, arp: [67, 71, 74, 71, 79, 74, 71, 67] },
  ];
  const chordAt = t => CH[Math.floor(t / BAR) % 4];

  // ambience + effects (both versions)
  wind(0, 6.2, .22); wind(6, 14.6, .07); wind(39, 45, .08);
  for (const t of [3.4, 4.6, 7.3, 9.1, 11.6, 13.2, 40.2, 41.7, 43.1]) bird(t);
  whoosh(1.4, 1.2, .25); impact(2.6, 1); chime(2.62, 81, .18, 2.4);
  for (const t of [6, 8, 10, 12]) { impact(t, .55); }
  // planting pops, synced to the recorded clip (a seed every 0.21 s from 0.5 s in; GROW shows clip 1.0–3.0 s)
  for (let k = 0; k < 24; k++) { const src = .5 + k * .21; if (src >= 1.0 && src < 3.0) pop(6 + src - 1.0); }
  for (const src of [1.85]) swish(10 + src - .8, .4);          // combine harvests a field
  chime(12 + 1.6 - .9, 76, .2, 1.2); chime(12.75, 83, .12, 1.4); // new land unlocked
  whoosh(13.6, 1.0, .4); impact(14.8, .5); whoosh(17.6, .7, .2); whoosh(18.2, .9, .3, false);
  whoosh(20.4, .6, .35); impact(21, .9); chime(21.5, 88, .22, 2.2);
  for (const t of [22.4, 23.65, 24.9]) chime(t, 84, .14, 1.1);
  riser(28.2, 30, .3); impact(30, .8); impact(30.6, .6); chime(30.62, 81, .2, 1.6);
  impact(34.6, .6); chime(36.4, 88, .2, 1.0); chime(36.52, 93, .14, 1.0); // wallet connected
  riser(36.5, 39, .35); impact(39, 1); crash(39, .3); chime(40, 81, .2, 2.5); chime(43, 76, .25, 2);

  if (music) {
    // intro pads after the impact
    pad(2.6, 6, chordAt(0).pad, .055, 900);
    for (let t = 3.0; t < 6; t += BEAT) pluck(t, chordAt(t).arp[Math.round(t / BEAT) % 8], .16, .3, 1800);
    // groove 6–14
    for (let bar = 6; bar < 14; bar += BAR) pad(bar, bar + BAR, chordAt(bar).pad, .06, 1600);
    for (let t = 6; t < 14; t += BEAT) { kick(t); if (Math.round(t / BEAT) % 2) clap(t); hat(t + BEAT / 2, .12); bass(t, chordAt(t).root, .4); bass(t + BEAT / 2, chordAt(t).root + 12, .2, .3); }
    for (let t = 6; t < 14; t += BEAT / 2) pluck(t, chordAt(t).arp[Math.round(t / (BEAT / 2)) % 8], .24);
    for (const t of [6, 8, 10, 12]) crash(t, .16);
    // markets 14.8–21: lighter, ticking
    for (let bar = 14; bar < 21; bar += BAR) pad(Math.max(bar, 14.8), bar + BAR, chordAt(bar).pad, .05, 1300);
    for (let t = 14.8; t < 21; t += BEAT / 2) { hat(t, .07); pluck(t, chordAt(t).arp[Math.round(t / (BEAT / 2)) % 8], .17, .18, 2600); }
    for (let t = 15; t < 21; t += BAR / 2) { kick(t, .7); bass(t, chordAt(t).root, .9, .4); }
    // token 21–30: dark, sub pulses, half-time
    for (let bar = 20; bar < 30; bar += BAR) pad(Math.max(bar, 21), bar + BAR, chordAt(bar).pad.map(n => n - 12), .06, 700);
    for (let t = 21; t < 30; t += BEAT) { bass(t, chordAt(t).root - 12, .35, .45); if (Math.round(t / BEAT) % 4 === 0) kick(t, .8); if (Math.round(t / BEAT) % 4 === 2) clap(t, .35); }
    for (let t = 25; t < 30; t += BEAT / 2) pluck(t, chordAt(t).arp[Math.round(t / (BEAT / 2)) % 8] + 12, .1, .16, 2200);
    // launch 30–39: build
    for (let bar = 30; bar < 39; bar += BAR) pad(bar, Math.min(bar + BAR, 39), chordAt(bar).pad, .065, 2000);
    for (let t = 30; t < 37; t += BEAT) { kick(t); if (Math.round(t / BEAT) % 2) clap(t, .45); hat(t + BEAT / 2, .12, true); bass(t, chordAt(t).root, .4); }
    for (let t = 30; t < 39; t += BEAT / 2) pluck(t, chordAt(t).arp[Math.round(t / (BEAT / 2)) % 8], .25, .2, 3600);
    // snare roll into the finale
    for (let k = 0; k < 24; k++) { const t = 37 + 2 * (1 - Math.pow(1 - k / 24, 1.6)); clap(t, .18 + .25 * k / 24); }
    // finale 39–45
    for (let bar = 39; bar < 43; bar += BAR) pad(bar, bar + BAR, chordAt(bar - 39).pad, .08, 2600);
    for (let t = 39; t < 43; t += BEAT) { kick(t); if (Math.round(t / BEAT) % 2) clap(t, .5); hat(t + BEAT / 2, .13, true); bass(t, chordAt(t - 39).root, .4); }
    for (let t = 39; t < 43; t += BEAT / 2) pluck(t, chordAt(t - 39).arp[Math.round(t / (BEAT / 2)) % 8] + 12, .22, .2, 4200);
    pad(43, 45, [57, 64, 69, 72, 76], .075, 2200); bass(43, 33, 1.9, .55); kick(43); crash(43, .3);
  }
  // fade the very end
  master.gain.setValueAtTime(.7, dur - 1.2); master.gain.linearRampToValueAtTime(0, dur - .02);
  return ctx.startRendering();
}
