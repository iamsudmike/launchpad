'use strict';

const Sound = (() => {
  let actx = null;

  function getCtx() {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }

  function tone(freq, type, dur, vol = 0.2, freqEnd = null) {
    try {
      const ac = getCtx();
      const osc  = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, ac.currentTime + dur);
      gain.gain.setValueAtTime(vol, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
      osc.start(ac.currentTime);
      osc.stop(ac.currentTime + dur + 0.01);
    } catch (e) { /* audio not available */ }
  }

  function noise(dur, vol = 0.15) {
    try {
      const ac      = getCtx();
      const rate    = ac.sampleRate;
      const samples = Math.ceil(rate * dur);
      const buf     = ac.createBuffer(1, samples, rate);
      const data    = buf.getChannelData(0);
      for (let i = 0; i < samples; i++) data[i] = Math.random() * 2 - 1;
      const src  = ac.createBufferSource();
      src.buffer = buf;
      const gain = ac.createGain();
      src.connect(gain);
      gain.connect(ac.destination);
      gain.gain.setValueAtTime(vol, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
      src.start(ac.currentTime);
    } catch (e) { /* audio not available */ }
  }

  function later(fn, ms) { setTimeout(fn, ms); }

  return {
    shoot()       { tone(600, 'square',   0.06, 0.12, 200); },
    shootBig()    { tone(280, 'square',   0.10, 0.18,  80); },
    shootRocket() { tone(160, 'sawtooth', 0.12, 0.18,  55); },

    enemyHit()  { tone(180, 'sawtooth', 0.05, 0.07); },
    enemyDie()  {
      tone(260, 'sawtooth', 0.08, 0.15, 80);
      later(() => noise(0.06, 0.06), 40);
    },

    playerHurt() { tone(100, 'sawtooth', 0.22, 0.28, 55); },

    explosion() {
      noise(0.3, 0.32);
      tone(70, 'sine', 0.28, 0.18, 28);
    },

    pickup() {
      tone(880,  'sine', 0.09, 0.14);
      later(() => tone(1320, 'sine', 0.09, 0.10), 75);
    },

    bossDie() {
      noise(0.5, 0.38);
      [350, 220, 140, 75].forEach((f, i) =>
        later(() => tone(f, 'sawtooth', 0.22, 0.28), i * 120)
      );
    },

    levelComplete() {
      [523, 659, 784, 1047].forEach((f, i) =>
        later(() => tone(f, 'square', 0.18, 0.22), i * 130)
      );
    },

    gameOver() {
      [400, 300, 200, 120].forEach((f, i) =>
        later(() => tone(f, 'sawtooth', 0.22, 0.25), i * 110)
      );
    },
  };
})();
