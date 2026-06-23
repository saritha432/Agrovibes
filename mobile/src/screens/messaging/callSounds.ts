import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";

const INCOMING_RING = require("../../../assets/sounds/incoming_ring.wav");
const OUTGOING_RING = require("../../../assets/sounds/outgoing_ring.wav");

let incomingSound: Audio.Sound | null = null;
let outgoingSound: Audio.Sound | null = null;
let soundGeneration = 0;

async function unloadSound(sound: Audio.Sound) {
  try {
    const status = await sound.getStatusAsync();
    if (!status.isLoaded) return;
    if (status.isPlaying) {
      await sound.setVolumeAsync(0);
      await sound.stopAsync();
    }
    await sound.unloadAsync();
  } catch {
    // no-op
  }
}

async function ensureRingAudioMode() {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    shouldDuckAndroid: false,
    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    playThroughEarpieceAndroid: false
  });
}

async function loadLoopingSound(module: number, generation: number) {
  await ensureRingAudioMode();
  const { sound } = await Audio.Sound.createAsync(module, {
    isLooping: true,
    volume: 1,
    shouldPlay: false
  });
  if (generation !== soundGeneration) {
    await unloadSound(sound);
    return null;
  }
  return sound;
}

export async function stopCallSounds() {
  soundGeneration += 1;
  const sounds = [incomingSound, outgoingSound];
  incomingSound = null;
  outgoingSound = null;
  await Promise.all(sounds.map((sound) => (sound ? unloadSound(sound) : Promise.resolve())));
}

async function playRing(sound: Audio.Sound | null) {
  if (!sound) return;
  try {
    const status = await sound.getStatusAsync();
    if (status.isLoaded && !status.isPlaying) {
      await sound.setVolumeAsync(1);
      await sound.playAsync();
    }
  } catch {
    // no-op
  }
}

export async function startIncomingRingtone() {
  await stopCallSounds();
  const generation = soundGeneration;
  try {
    const sound = await loadLoopingSound(INCOMING_RING, generation);
    if (!sound || generation !== soundGeneration) return;
    incomingSound = sound;
    await playRing(sound);
  } catch {
    incomingSound = null;
  }
}

export async function startOutgoingRingtone() {
  await stopCallSounds();
  const generation = soundGeneration;
  try {
    const sound = await loadLoopingSound(OUTGOING_RING, generation);
    if (!sound || generation !== soundGeneration) return;
    outgoingSound = sound;
    await playRing(sound);
  } catch {
    outgoingSound = null;
  }
}
