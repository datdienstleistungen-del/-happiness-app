// LofiGenerator - Generiert chill Lofi-Beats mit Web Audio API
// Keine externen Dateien nötig, alles passiert im Browser

class LofiGenerator {
  constructor() {
    this.ctx = null;
    this.isPlaying = false;
    this.gainNode = null;
    this.masterGain = null;
    this.analyser = null;
    this.volume = 0.3;
    this.bpm = 75;
    this.currentStep = 0;
    this.nextNoteTime = 0;
    this.scheduleAheadTime = 0.1;
    this.lookahead = 25;
    this.timerID = null;

    // Lofi chord progressions (mellow, chill)
    this.chordProgressions = [
      // Am7 - Fmaj7 - Cmaj7 - G
      [
        [220.00, 261.63, 329.63, 392.00],   // Am7
        [174.61, 261.63, 329.63, 440.00],   // Fmaj7
        [130.81, 164.81, 196.00, 246.94],   // Cmaj7
        [196.00, 246.94, 293.66, 392.00],   // G
      ],
      // Dm7 - G7 - Cmaj7 - Am
      [
        [146.83, 174.61, 220.00, 261.63],   // Dm7
        [196.00, 246.94, 293.66, 349.23],   // G7
        [130.81, 164.81, 196.00, 246.94],   // Cmaj7
        [220.00, 261.63, 329.63, 392.00],   // Am
      ],
    ];

    this.currentChordIndex = 0;
    this.currentProgression = this.chordProgressions[Math.floor(Math.random() * this.chordProgressions.length)];

    // Melody notes (pentatonic minor - always sounds good)
    this.melodyNotes = [
      440.00, 523.25, 587.33, 659.25, 783.99,
      880.00, 783.99, 659.25, 587.33, 523.25,
      440.00, 392.00, 349.23, 329.63, 293.66,
    ];
  }

  async init() {
    if (this.ctx) return;

    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Master gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.ctx.destination);

    // Analyser for visualization
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.masterGain.connect(this.analyser);

    // Create reverb (simple convolution)
    this.reverb = await this.createReverb();
    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.value = 0.3;
    this.reverb.connect(this.reverbGain);
    this.reverbGain.connect(this.masterGain);

    // Dry path
    this.dryGain = this.ctx.createGain();
    this.dryGain.gain.value = 0.7;
    this.dryGain.connect(this.masterGain);

    // Filter (lowpass for lofi feel)
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 2000;
    this.filter.Q.value = 0.5;
    this.filter.connect(this.dryGain);
    this.filter.connect(this.reverb);
  }

  async createReverb() {
    const length = this.ctx.sampleRate * 1.5;
    const impulse = this.ctx.createBuffer(2, length, this.ctx.sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
      }
    }

    const convolver = this.ctx.createConvolver();
    convolver.buffer = impulse;
    return convolver;
  }

  playNote(freq, time, duration, type = 'sine', gain = 0.15) {
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;

    // Slight detune for lofi feel
    osc.detune.value = Math.random() * 10 - 5;

    gainNode.gain.setValueAtTime(0, time);
    gainNode.gain.linearRampToValueAtTime(gain, time + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gainNode);
    gainNode.connect(this.filter);

    osc.start(time);
    osc.stop(time + duration);
  }

  playChord(time) {
    const chord = this.currentProgression[this.currentChordIndex];
    const duration = (60 / this.bpm) * 4; // Whole note

    chord.forEach((freq, i) => {
      // Slight spread for width
      this.playNote(freq * 0.99, time, duration, 'sine', 0.06);
      this.playNote(freq * 1.01, time, duration, 'sine', 0.06);
    });

    this.currentChordIndex = (this.currentChordIndex + 1) % this.currentProgression.length;
  }

  playMelody(time) {
    const note = this.melodyNotes[Math.floor(Math.random() * this.melodyNotes.length)];
    const duration = (60 / this.bpm) * (Math.random() > 0.5 ? 1 : 0.5);

    this.playNote(note, time, duration, 'triangle', 0.08);
  }

  playKick(time) {
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(30, time + 0.1);

    gainNode.gain.setValueAtTime(0.8, time);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

    osc.connect(gainNode);
    gainNode.connect(this.filter);

    osc.start(time);
    osc.stop(time + 0.3);
  }

  playSnare(time) {
    // Noise part
    const bufferSize = this.ctx.sampleRate * 0.1;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.3, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 1000;

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.filter);

    noise.start(time);
    noise.stop(time + 0.1);

    // Tone part
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.frequency.value = 200;
    oscGain.gain.setValueAtTime(0.5, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    osc.connect(oscGain);
    oscGain.connect(this.filter);
    osc.start(time);
    osc.stop(time + 0.05);
  }

  playHiHat(time, open = false) {
    const bufferSize = this.ctx.sampleRate * (open ? 0.15 : 0.05);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.15, time);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + (open ? 0.15 : 0.05));

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 5000;

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.filter);

    noise.start(time);
    noise.stop(time + (open ? 0.15 : 0.05));
  }

  playRhodes(time) {
    // Rhodes/electric piano sound
    const chord = this.currentProgression[this.currentChordIndex];
    const note = chord[Math.floor(Math.random() * chord.length)];
    const duration = (60 / this.bpm) * 0.5;

    // Two oscillators for richness
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.value = note;
    osc2.type = 'sine';
    osc2.frequency.value = note * 2; // Octave up

    gainNode.gain.setValueAtTime(0, time);
    gainNode.gain.linearRampToValueAtTime(0.06, time + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(this.filter);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + duration);
    osc2.stop(time + duration);
  }

  scheduler() {
    const secondsPerBeat = 60.0 / this.bpm;

    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.currentStep, this.nextNoteTime);
      this.nextNoteSeconds(secondsPerBeat);
    }
  }

  nextNoteSeconds(secondsPerBeat) {
    this.nextNoteTime += secondsPerBeat * 0.5; // 8th notes
    this.currentStep++;
  }

  scheduleNote(step, time) {
    const beat = step % 8;

    // Kick on 1, 3, 5, 7 (four on the floor - lofi style)
    if (beat % 4 === 0) {
      this.playKick(time);
    }

    // Snare on 2, 6 (backbeat)
    if (beat === 2 || beat === 6) {
      this.playSnare(time);
    }

    // Hi-hats on every 8th note (some open, some closed)
    if (beat % 2 === 0) {
      this.playHiHat(time, beat === 4);
    }

    // Additional hi-hats for swing
    if (Math.random() > 0.7) {
      this.playHiHat(time + secondsPerBeat * 0.25, false);
    }

    // Chord on 1 of every 4 beats
    if (beat === 0) {
      this.playChord(time);
    }

    // Melody - random placement
    if (Math.random() > 0.6) {
      this.playMelody(time);
    }

    // Rhodes stabs
    if (Math.random() > 0.8) {
      this.playRhodes(time);
    }
  }

  start() {
    if (this.isPlaying) return;

    this.init().then(() => {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      this.isPlaying = true;
      this.currentStep = 0;
      this.nextNoteTime = this.ctx.currentTime;

      this.timerID = setInterval(() => this.scheduler(), this.lookahead);
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

  // Duck music when video plays
  duck(duckAmount = 0.1) {
    if (this.masterGain) {
      this.masterGain.gain.linearRampToValueAtTime(
        this.volume * duckAmount,
        this.ctx.currentTime + 0.3
      );
    }
  }

  // Restore volume
  unduck() {
    if (this.masterGain) {
      this.masterGain.gain.linearRampToValueAtTime(
        this.volume,
        this.ctx.currentTime + 0.3
      );
    }
  }

  getAnalyserData() {
    if (!this.analyser) return null;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }
}

// Singleton
const lofiGenerator = new LofiGenerator();
export default lofiGenerator;
