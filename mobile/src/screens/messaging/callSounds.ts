import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";

const INCOMING_RING = require("../../../assets/sounds/incoming_ring.wav");
const OUTGOING_RING = require("../../../assets/sounds/outgoing_ring.wav");

let incomingSound: Audio.Sound | null = null;
let outgoingSound: Audio.Sound | null = null;

async function ensureCallAudioMode() {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    shouldDuckAndroid: false,
    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    playThroughEarpieceAndroid: false
  });
}

async function loadLoopingSound(module: number) {
  await ensureCallAudioMode();
  const { sound } = await Audio.Sound.createAsync(module, { isLooping: true, volume: 1 });
  return sound;
}

export async function startIncomingRingtone() {
  await stopCallSounds();
  try {
    incomingSound = await loadLoopingSound(INCOMING_RING);
    await incomingSound.playAsync();
  } catch {
    incomingSound = null;
  }
}

export async function startOutgoingRingtone() {
  await stopCallSounds();
  try {
    outgoingSound = await loadLoopingSound(OUTGOING_RING);
    await outgoingSound.playAsync();
  } catch {
    outgoingSound = null;
  }
}

export async function stopCallSounds() {
  const sounds = [incomingSound, outgoingSound];
  incomingSound = null;
  outgoingSound = null;
  await Promise.all(
    sounds.map(async (sound) => {
      if (!sound) return;
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
      } catch {
        // no-op
      }
    })
  );
}
