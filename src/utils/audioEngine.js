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
