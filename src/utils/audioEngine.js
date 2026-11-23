const engines = new WeakMap();

function createImpulse(context, seconds = 1.4, decay = 2.6) {
  const length = Math.floor(context.sampleRate * seconds);
  const impulse = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      data[index] =
        (Math.random() * 2 - 1) * Math.pow(1 - index / length, decay);
    }
  }
  return impulse;
}

function setNow(parameter, value, context) {
  parameter.cancelScheduledValues(context.currentTime);
  parameter.setTargetAtTime(value, context.currentTime, 0.025);
}

function createEngine(audio) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  const context = new AudioContextClass({ latencyHint: "playback" });
  const source = context.createMediaElementSource(audio);
  const bass = context.createBiquadFilter();
  bass.type = "lowshelf";
  bass.frequency.value = 120;
  const mid = context.createBiquadFilter();
  mid.type = "peaking";
  mid.frequency.value = 1800;
  mid.Q.value = 0.8;
  const treble = context.createBiquadFilter();
  treble.type = "highshelf";
  treble.frequency.value = 6200;
  const compressor = context.createDynamicsCompressor();
  const dry = context.createGain();
  const leftDelay = context.createDelay(0.08);
  leftDelay.delayTime.value = 0.011;
  const rightDelay = context.createDelay(0.08);
  rightDelay.delayTime.value = 0.019;
  const leftPan = context.createStereoPanner();
  leftPan.pan.value = -1;
  const rightPan = context.createStereoPanner();
  rightPan.pan.value = 1;
  const spatial = context.createGain();
  const convolver = context.createConvolver();
  convolver.buffer = createImpulse(context);
  const reverb = context.createGain();
  const master = context.createGain();

  source.connect(bass);
  bass.connect(mid);
  mid.connect(treble);
  treble.connect(compressor);
  compressor.connect(dry);
  dry.connect(master);
  compressor.connect(leftDelay);
  compressor.connect(rightDelay);
  leftDelay.connect(leftPan);
  rightDelay.connect(rightPan);
  leftPan.connect(spatial);
  rightPan.connect(spatial);
  spatial.connect(master);
  compressor.connect(convolver);
  convolver.connect(reverb);
  reverb.connect(master);
  master.connect(context.destination);

  const engine = {
    context,
    bass,
    mid,
    treble,
    compressor,
    dry,
    spatial,
    reverb,
    master,
  };
  engines.set(audio, engine);
  return engine;
}

export function applyAudioEffects(audio, preferences) {
  if (!audio) return null;
  let engine = engines.get(audio);
  if (!preferences.audioEffectsEnabled && !engine) return null;
  engine = engine || createEngine(audio);
  if (!engine) return null;
  const enabled = Boolean(preferences.audioEffectsEnabled);
  const preset = enabled ? ({
    balanced: { bass: 0, mid: 0, treble: 0 },
    bass: { bass: 5, mid: -0.5, treble: -1 },
    vocal: { bass: -1, mid: 4, treble: 1.5 },
    bright: { bass: 0, mid: 1, treble: 4 },
    night: { bass: 2, mid: 1, treble: -2 },
  }[preferences.audioPreset] || { bass: 0, mid: 0, treble: 0 }) : { bass: 0, mid: 0, treble: 0 };
  const { context } = engine;
  setNow(
    engine.bass.gain,
    preset.bass + (enabled ? Number(preferences.bassBoost || 0) : 0),
    context,
  );
  setNow(engine.mid.gain, preset.mid, context);
  setNow(
    engine.treble.gain,
    preset.treble + (enabled ? Number(preferences.trebleBoost || 0) : 0),
    context,
  );
  const spatialAmount = enabled && preferences.virtualAtmos
    ? Math.max(0, Math.min(1, Number(preferences.spatialWidth || 0))) * 0.34
    : 0;
  const reverbAmount = enabled
    ? Math.max(0, Math.min(0.55, Number(preferences.reverbAmount || 0)))
    : 0;
  setNow(engine.spatial.gain, spatialAmount, context);
  setNow(engine.reverb.gain, reverbAmount, context);
  setNow(
    engine.dry.gain,
    Math.max(0.68, 1 - spatialAmount * 0.28 - reverbAmount * 0.18),
    context,
  );
  setNow(engine.master.gain, 0.94, context);
  const normalize = enabled && Boolean(preferences.loudnessNormalization);
  engine.compressor.threshold.setValueAtTime(normalize ? -20 : 0, context.currentTime);
  engine.compressor.knee.setValueAtTime(normalize ? 24 : 0, context.currentTime);
  engine.compressor.ratio.setValueAtTime(normalize ? 4 : 1, context.currentTime);
  engine.compressor.attack.setValueAtTime(normalize ? 0.01 : 0, context.currentTime);
  engine.compressor.release.setValueAtTime(normalize ? 0.24 : 0.01, context.currentTime);
  if (!audio.paused && context.state === "suspended") context.resume().catch(() => {});
  return engine;
}

export function resumeAudioEffects(audio) {
  const engine = engines.get(audio);
  if (engine?.context.state === "suspended") return engine.context.resume();
  return Promise.resolve();
}
