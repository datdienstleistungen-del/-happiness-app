// LofiPlayer - Spielt echte Lofi-MP3s ab
// Kein Synthesizer mehr, nur echte Musik-Dateien

const TRACKS = [
  '/music/lofi1.webm',
];

class LofiPlayer {
  constructor() {
    this.audio = null;
    this.isPlaying = false;
    this.volume = 0.3;
    this.currentTrack = 0;
    this.analyser = null;
    this.ctx = null;
  }

  init() {
    if (this.audio) return;

    this.audio = new Audio();
    this.audio.loop = true;
    this.audio.volume = this.volume;
    this.audio.src = TRACKS[0];

    // Web Audio API nur für Analyser (Visualizer)
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const source = this.ctx.createMediaElementSource(this.audio);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 128;
    source.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  async start() {
    if (this.isPlaying) return;
    this.init();

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    try {
      await this.audio.play();
      this.isPlaying = true;
    } catch (e) {
      console.log('Audio play failed:', e);
    }
  }

  stop() {
    if (!this.isPlaying) return;
    this.audio.pause();
    this.audio.currentTime = 0;
    this.isPlaying = false;
  }

  setVolume(vol) {
    this.volume = vol;
    if (this.audio) {
      this.audio.volume = vol;
    }
  }

  duck(amount = 0.1) {
    if (this.audio) {
      this.audio.volume = this.volume * amount;
    }
  }

  unduck() {
    if (this.audio) {
      this.audio.volume = this.volume;
    }
  }

  getAnalyserData() {
    if (!this.analyser) return null;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }
}

const lofiPlayer = new LofiPlayer();
export default lofiPlayer;
