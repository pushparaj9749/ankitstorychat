/**
 * Real UI sounds + ambient music (expo-audio).
 * Assets are original synthesized WAVs in assets/sounds (see scripts/gen-sounds.mjs).
 * Everything is guarded — audio must never crash the app.
 */
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

let sendPlayer: AudioPlayer | null = null;
let receivePlayer: AudioPlayer | null = null;
let ambientPlayer: AudioPlayer | null = null;

function getSend(): AudioPlayer | null {
  try {
    if (!sendPlayer) sendPlayer = createAudioPlayer(require('../../assets/sounds/send.wav'));
    return sendPlayer;
  } catch {
    return null;
  }
}

function getReceive(): AudioPlayer | null {
  try {
    if (!receivePlayer) {
      receivePlayer = createAudioPlayer(require('../../assets/sounds/receive.wav'));
    }
    return receivePlayer;
  } catch {
    return null;
  }
}

function getAmbient(): AudioPlayer | null {
  try {
    if (!ambientPlayer) {
      ambientPlayer = createAudioPlayer(require('../../assets/sounds/ambient.wav'));
      ambientPlayer.loop = true;
      ambientPlayer.volume = 0.25;
    }
    return ambientPlayer;
  } catch {
    return null;
  }
}

/** Blip when the user sends a message (Settings -> Audio -> Sound). */
export function playSend(enabled: boolean): void {
  if (!enabled) return;
  try {
    const p = getSend();
    if (!p) return;
    void p.seekTo(0).then(() => p.play()).catch(() => p.play());
  } catch {
    // Silent failure — sound is garnish.
  }
}

/** Blip when a reply arrives. */
export function playReceive(enabled: boolean): void {
  if (!enabled) return;
  try {
    const p = getReceive();
    if (!p) return;
    void p.seekTo(0).then(() => p.play()).catch(() => p.play());
  } catch {
    // Silent failure.
  }
}

/** Ambient loop (Settings -> Audio -> Music). Call when the setting changes. */
export function setAmbientPlaying(playing: boolean): void {
  try {
    const p = getAmbient();
    if (!p) return;
    if (playing && !p.playing) p.play();
    else if (!playing && p.playing) p.pause();
  } catch {
    // Silent failure.
  }
}
