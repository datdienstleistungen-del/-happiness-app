// LofiGenerator - Generiert chill Lofi-Beats mit Web Audio API
// V2: Klare Töne, kein Rauschen

class LofiGenerator {
  constructor() {
    this.ctx = null;
    this.isPlaying = false;
    this.masterGain = null;
    this.analyser = null;
    this.volume = 0.35;
    this.bpm = 72;
    this.currentStep = 0;
    this.nextNoteTime = 0;
    this.timerID = null;
    this.chordIdx = 0;

    // Am7 - Fmaj7 - Cmaj7 - G (classic lofi)
    this.chords = [
      [220, 261.63, 329.63],   // Am7
      [174.61, 261.63, 329.63], // Fmaj7
      [130.81, 164.81, 261.63], // Cmaj7
      [196, 246.94, 293.66],    // G
    ];

    // Pentatonic minor melody
    this.melody = [440, 523.25, 587.33, 659.25, 783.99, 587.33, 523.25, 440, 392, 349.23];
  }

  async init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.ctx.destination);

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 128;
    this.masterGain.connect(this.analyser);
  }

  // Clean sine tone with ADSR envelope
  tone(freq, time, dur, type = 'sine', vol = 0.12) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;

    const attack = 0.02;
    const release = Math.min(dur * 0.4, 0.3);
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(vol, time + attack);
    g.gain.setValueAtTime(vol, time + dur - release);
    g.gain.linearRampToValueAtTime(0, time + dur);

    o.connect(g);
    g.connect(this.masterGain);
    o.start(time);
    o.stop(time + dur + 0.01);
  }

  // Soft kick
  kick(time) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(120, time);
    o.frequency.exponentialRampToValueAtTime(40, time + 0.08);
    g.gain.setValueAtTime(0.35, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
    o.connect(g);
    g.connect(this.masterGain);
    o.start(time);
    o.stop(time + 0.25);
  }

  // Soft snare (just a short tone, no noise)
  snare(time) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = 180;
    g.gain.setValueAtTime(0.2, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    o.connect(g);
    g.connect(this.masterGain);
    o.start(time);
    o.stop(time + 0.08);
  }

  // Hi-hat (short high tone)
  hihat(time) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'square';
    o.frequency.value = 800;
    g.gain.setValueAtTime(0.04, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
    o.connect(g);
    g.connect(this.masterGain);
    o.start(time);
    o.stop(time + 0.03);
  }

  // Chord (3 notes at once)
  chord(time) {
    const notes = this.chords[this.chordIdx];
    const dur = (60 / this.bpm) * 2;
    notes.forEach(f => {
      this.tone(f, time, dur, 'sine', 0.07);
      this.tone(f * 2, time, dur, 'sine', 0.02); // octave shimmer
    });
    this.chordIdx = (this.chordIdx + 1) % this.chords.length;
  }

  // Single melody note
  melodyNote(time) {
    const note = this.melody[Math.floor(Math.random() * this.melody.length)];
    const dur = (60 / this.bpm) * (Math.random() > 0.5 ? 1 : 0.5);
    this.tone(note, time, dur, 'triangle', 0.1);
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

      // Hi-hat: every 2 steps
      if (step % 2 === 0) this.hihat(t);

      // Chord: beat 0
      if (step === 0) this.chord(t);

      // Melody: random
      if (Math.random() > 0.55) this.melodyNote(t);

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
