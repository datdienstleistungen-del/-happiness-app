// LofiGenerator V3 - Echte LoFi-Sounds mit Web Audio API
// Komplett überarbeitet: Kräftige Akkorde, tiefer Bass, knackige Drums

class LofiGenerator {
  constructor() {
    this.ctx = null;
    this.isPlaying = false;
    this.masterGain = null;
    this.analyser = null;
    this.volume = 0.4;
    this.bpm = 75;
    this.currentStep = 0;
    this.nextNoteTime = 0;
    this.timerID = null;
    this.chordIdx = 0;
    this.melodyIdx = 0;
    this.bassIdx = 0;

    // LoFi Chord Progression (Am7 - Fmaj7 - Cmaj7 - Gmaj7)
    // Each chord: [root, third, fifth, seventh]
    this.chords = [
      [110, 130.81, 164.81, 196],     // Am7
      [87.31, 130.81, 164.81, 220],   // Fmaj7
      [65.41, 82.41, 130.81, 123.47], // Cmaj7
      [98, 123.47, 146.83, 185],      // Gmaj7
    ];

    // Bass notes (roots)
    this.bassNotes = [110, 87.31, 65.41, 98];

    // Melody scale (Am pentatonic, 2 octaves)
    this.melody = [
      440, 523.25, 587.33, 659.25, 783.99,
      880, 783.99, 659.25, 587.33, 523.25,
      440, 392, 349.23, 329.63, 293.66
    ];
  }

  async init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Compressor for better mix
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -20;
    this.compressor.knee.value = 10;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.1;
    this.compressor.connect(this.ctx.destination);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.compressor);

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.masterGain.connect(this.analyser);

    // LoFi filter chain
    this.lofiFilter = this.ctx.createBiquadFilter();
    this.lofiFilter.type = 'lowpass';
    this.lofiFilter.frequency.value = 3000;
    this.lofiFilter.Q.value = 0.7;
    this.lofiFilter.connect(this.masterGain);
  }

  // Warm pad chord (Rhodes-style)
  padChord(time) {
    const notes = this.chords[this.chordIdx];
    const dur = (60 / this.bpm) * 2;
    const vol = 0.18;

    notes.forEach((freq, i) => {
      // Main tone (sine for warmth)
      this._tone(freq, time, dur, 'sine', vol * 0.7);
      // Slight shimmer (triangle for brightness)
      this._tone(freq * 2, time, dur * 0.8, 'triangle', vol * 0.15);
      // Sub octave (sine for depth)
      this._tone(freq * 0.5, time, dur, 'sine', vol * 0.2);
    });

    this.chordIdx = (this.chordIdx + 1) % this.chords.length;
  }

  // Deep sub bass
  bassNote(time) {
    const freq = this.bassNotes[this.bassIdx];
    const dur = (60 / this.bpm) * 2;

    this._tone(freq, time, dur, 'sine', 0.25);
    // Slight harmonic
    this._tone(freq * 2, time, dur * 0.3, 'sine', 0.05);

    this.bassIdx = (this.bassIdx + 1) % this.bassNotes.length;
  }

  // Melody (Rhodes/electric piano feel)
  melodyNote(time) {
    const freq = this.melody[this.melodyIdx % this.melody.length];
    const dur = (60 / this.bpm) * 0.5;

    this._tone(freq, time, dur, 'triangle', 0.12);
    this._tone(freq * 1.002, time, dur, 'sine', 0.08); // slight detune

    // Advance melody with some randomness
    if (Math.random() > 0.6) {
      this.melodyIdx = (this.melodyIdx + 1) % this.melody.length;
    } else {
      this.melodyIdx = (this.melodyIdx + 2) % this.melody.length;
    }
  }

  // Kick drum (punchy, clean)
  kick(time) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(150, time);
    o.frequency.exponentialRampToValueAtTime(30, time + 0.07);
    g.gain.setValueAtTime(0.5, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
    o.connect(g);
    g.connect(this.lofiFilter);
    o.start(time);
    o.stop(time + 0.3);
  }

  // Snare (warm, not harsh)
  snare(time) {
    // Body tone
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = 180;
    g.gain.setValueAtTime(0.25, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    o.connect(g);
    g.connect(this.lofiFilter);
    o.start(time);
    o.stop(time + 0.1);

    // Snap (very short high tone, NOT noise)
    const o2 = this.ctx.createOscillator();
    const g2 = this.ctx.createGain();
    o2.type = 'sine';
    o2.frequency.value = 800;
    g2.gain.setValueAtTime(0.12, time);
    g2.gain.exponentialRampToValueAtTime(0.001, time + 0.02);
    o2.connect(g2);
    g2.connect(this.lofiFilter);
    o2.start(time);
    o2.stop(time + 0.02);
  }

  // Hi-hat (clean tick)
  hihat(time, accent = false) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.value = accent ? 1200 : 900;
    g.gain.setValueAtTime(accent ? 0.08 : 0.04, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    o.connect(g);
    g.connect(this.lofiFilter);
    o.start(time);
    o.stop(time + 0.04);
  }

  // Core tone generator with ADSR
  _tone(freq, time, dur, type, vol) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = (Math.random() - 0.5) * 8;

    const attack = 0.015;
    const decay = dur * 0.1;
    const sustain = vol * 0.7;
    const release = dur * 0.3;

    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(vol, time + attack);
    g.gain.linearRampToValueAtTime(sustain, time + attack + decay);
    g.gain.setValueAtTime(sustain, time + dur - release);
    g.gain.linearRampToValueAtTime(0, time + dur);

    o.connect(g);
    g.connect(this.lofiFilter);
    o.start(time);
    o.stop(time + dur + 0.01);
  }

  scheduler() {
    const spb = 60.0 / this.bpm;
    while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
      const step = this.currentStep % 16;
      const t = this.nextNoteTime;

      // Kick: beats 0, 4, 8, 12
      if (step % 4 === 0) this.kick(t);

      // Snare: beats 4, 12
      if (step === 4 || step === 12) this.snare(t);

      // Hi-hat: every 2 steps (accent on 0, 4, 8, 12)
      if (step % 2 === 0) this.hihat(t, step % 4 === 0);

      // Chord: beat 0
      if (step === 0) this.padChord(t);

      // Bass: beats 0, 8
      if (step === 0 || step === 8) this.bassNote(t);

      // Melody: random placement
      if (Math.random() > 0.5) this.melodyNote(t);

      this.nextNoteTime += spb * 0.5;
      this.currentStep++;
    }
  }

  start() {
    if (this.isPlaying) return;
    this.init().then(() => {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.isPlaying = true;
      this.currentStep = 0;
      this.chordIdx = 0;
      this.bassIdx = 0;
      this.melodyIdx = 0;
      this.nextNoteTime = this.ctx.currentTime;
      this.timerID = setInterval(() => this.scheduler(), 25);
    });
  }

  stop() {
    this.isPlaying = false;
    if (this.timerID) {
      clearInterval(this.timerID);
      this.timerID = null;
    }
  }

  setVolume(vol) {
    this.volume = vol;
    if (this.masterGain) {
      this.masterGain.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + 0.1);
    }
  }

  duck(amount = 0.15) {
    if (this.masterGain) {
      this.masterGain.gain.linearRampToValueAtTime(this.volume * amount, this.ctx.currentTime + 0.3);
    }
  }

  unduck() {
    if (this.masterGain) {
      this.masterGain.gain.linearRampToValueAtTime(this.volume, this.ctx.currentTime + 0.3);
    }
  }

  getAnalyserData() {
    if (!this.analyser) return null;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }
}

const lofiGenerator = new LofiGenerator();
export default lofiGenerator;
