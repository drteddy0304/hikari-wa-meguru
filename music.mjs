import { DURATION } from './core.mjs';

let context;
const buffers = new Map();

function audioContext() {
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextClass) throw new Error('このブラウザでは音楽付き動画を生成できません。別のブラウザをご利用ください。');
  context ||= new AudioContextClass();
  return context;
}

export function availableTracks(tracks) {
  return tracks.filter(track => track.enabled !== false && track.src && Number.isFinite(track.chorusStart));
}

export function chooseTrack(tracks, randomValue = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296) {
  const available = availableTracks(tracks);
  if (!available.length) throw new Error('使える楽曲がまだ設定されていません。');
  const value = randomValue();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('楽曲を選べませんでした。');
  return available[Math.floor(value * available.length)];
}

export async function unlockMusic() {
  const audio = audioContext();
  let timer;
  try {
    await Promise.race([
      audio.resume(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('音声を開始できませんでした。もう一度動画生成ボタンを押してください。')), 5000); }),
    ]);
  } finally { clearTimeout(timer); }
}

export function suspendMusic() {
  if (context) void context.suspend().catch(() => {});
}

export async function prepareMusic(track, { signal } = {}) {
  if (!track?.src || !Number.isFinite(track.chorusStart)) {
    throw new Error('この曲は1番のサビの開始位置を確認中です。設定後に選べるようになります。');
  }
  audioContext();
  const url = new URL(track.src, import.meta.url);
  if (url.origin !== location.origin || !url.pathname.startsWith(new URL('./audio/', import.meta.url).pathname)) {
    throw new Error('音源の場所が正しくありません。');
  }
  let buffer = buffers.get(url.href);
  if (!buffer) {
    const response = await fetch(url, { signal, credentials: 'same-origin' });
    if (!response.ok) throw new Error('音源を読み込めませんでした。曲を選び直してください。');
    buffer = await context.decodeAudioData(await response.arrayBuffer());
    if (buffer.duration < DURATION - .05) throw new Error('音源が12秒より短いため動画を生成できません。');
    buffers.set(url.href, buffer);
  }
  return { context, buffer, track };
}

export function formatTime(seconds) {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
