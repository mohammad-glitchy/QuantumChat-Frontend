import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import * as MP4Box from 'mp4box';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

const CORE_VERSION = '0.12.6';
const CORE_BASE_URL = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`;
const LONG_THRESHOLD_BYTES = 60 * 1024 * 1024;

export function isWebCodecsSupported() {
  return typeof VideoEncoder !== 'undefined' && typeof VideoDecoder !== 'undefined';
}

// If the source is already roughly at or under our target resolution/bitrate,
// re-encoding only burns time for no size/quality win — skip straight to sending
// the original. This is the single biggest speed win: many phone/OBS exports
// already qualify, so compression becomes instant instead of minutes.
async function alreadyGoodEnough(file, videoTrack, durationSeconds) {
  const isLong = file.size > LONG_THRESHOLD_BYTES;
  const targetMaxDim = isLong ? 480 : 720;
  const targetBitrate = isLong ? 1_000_000 : 1_500_000;

  const { width, height } = videoTrack.video;
  const longEdge = Math.max(width, height);
  if (longEdge > targetMaxDim * 1.1) return false; // meaningfully larger than target — worth shrinking

  if (durationSeconds > 0) {
    const estimatedBitrate = (file.size * 8) / durationSeconds;
    if (estimatedBitrate > targetBitrate * 1.35) return false; // meaningfully heavier than target
  }
  return true;
}

// ---------- fast path: WebCodecs (hardware-accelerated, MP4/H.264 input only) ----------

function descriptionFromTrack(mp4boxFile, track) {
  const trak = mp4boxFile.getTrackById(track.id);
  const entries = trak?.mdia?.minf?.stbl?.stsd?.entries || [];
  for (const entry of entries) {
    const box = entry.avcC || entry.hvcC;
    if (box) {
      const stream = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN);
      box.write(stream);
      return new Uint8Array(stream.buffer, 8); // skip box header
    }
  }
  return undefined;
}

function demux(file) {
  return new Promise((resolve, reject) => {
    const mp4boxFile = MP4Box.createFile();
    const videoSamples = [];
    const audioSamples = [];
    let videoTrack = null;
    let audioTrack = null;

    mp4boxFile.onError = (e) => reject(new Error(String(e)));

    mp4boxFile.onReady = (info) => {
      videoTrack = info.videoTracks?.[0] || null;
      audioTrack = info.audioTracks?.[0] || null;
      if (!videoTrack) {
        reject(new Error('No demuxable H.264 video track found'));
        return;
      }
      mp4boxFile.setExtractionOptions(videoTrack.id, 'video', { nbSamples: Infinity });
      if (audioTrack) mp4boxFile.setExtractionOptions(audioTrack.id, 'audio', { nbSamples: Infinity });
      mp4boxFile.start();
    };

    mp4boxFile.onSamples = (id, _user, samples) => {
      if (videoTrack && id === videoTrack.id) videoSamples.push(...samples);
      if (audioTrack && id === audioTrack.id) audioSamples.push(...samples);
    };

    file.arrayBuffer().then((buf) => {
      buf.fileStart = 0;
      mp4boxFile.appendBuffer(buf);
      mp4boxFile.flush();
      resolve({
        mp4boxFile,
        videoTrack,
        audioTrack,
        videoSamples,
        audioSamples,
        videoDescription: descriptionFromTrack(mp4boxFile, videoTrack),
      });
    }).catch(reject);
  });
}

async function compressVideoWebCodecs(file, onProgress, options = {}) {
  const { videoTrack, audioTrack, videoSamples, audioSamples, videoDescription } = await demux(file);

  const durationSeconds = videoSamples.reduce((max, s) => Math.max(max, s.cts + s.duration), 0) / videoTrack.timescale;
  if (!options.force && (await alreadyGoodEnough(file, videoTrack, durationSeconds))) {
    onProgress?.(1);
    return null; // signal "no compression needed" — caller sends the original file
  }

  const isLong = file.size > LONG_THRESHOLD_BYTES;
  const maxDim = isLong ? 480 : 720;
  const scale = Math.min(1, maxDim / Math.max(videoTrack.video.width, videoTrack.video.height));
  const outWidth = Math.round((videoTrack.video.width * scale) / 2) * 2;
  const outHeight = Math.round((videoTrack.video.height * scale) / 2) * 2;
  const needsScale = scale < 1;

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width: outWidth, height: outHeight },
    audio: audioTrack ? { codec: 'aac', numberOfChannels: audioTrack.audio.channel_count, sampleRate: audioTrack.audio.sample_rate } : undefined,
    fastStart: 'in-memory',
  });

  let canvas, ctx;
  if (needsScale) {
    canvas = new OffscreenCanvas(outWidth, outHeight);
    ctx = canvas.getContext('2d');
  }

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { throw e; },
  });
  encoder.configure({
    codec: 'avc1.42001f',
    width: outWidth,
    height: outHeight,
    bitrate: isLong ? 1_000_000 : 1_500_000,
    hardwareAcceleration: 'prefer-hardware',
  });

  const totalVideoDuration = videoSamples.reduce((max, s) => Math.max(max, s.cts + s.duration), 0) / videoTrack.timescale;
  let processedTime = 0;

  const decoder = new VideoDecoder({
    output: (frame) => {
      const toEncode = needsScale
        ? (() => {
            ctx.drawImage(frame, 0, 0, outWidth, outHeight);
            const scaled = new VideoFrame(canvas, { timestamp: frame.timestamp, duration: frame.duration });
            frame.close();
            return scaled;
          })()
        : frame;
      encoder.encode(toEncode);
      toEncode.close();
      processedTime = toEncode.timestamp / 1e6;
      if (totalVideoDuration > 0) onProgress?.(Math.min(1, processedTime / totalVideoDuration));
    },
    error: (e) => { throw e; },
  });
  decoder.configure({
    codec: videoTrack.codec,
    codedWidth: videoTrack.video.width,
    codedHeight: videoTrack.video.height,
    description: videoDescription,
  });

  const QUEUE_DEPTH = 24; // deeper pipeline keeps hardware decoder/encoder busier between frames
  async function waitForQueueRoom() {
    if (decoder.decodeQueueSize <= QUEUE_DEPTH) return;
    await new Promise((resolve) => {
      decoder.addEventListener('dequeue', function onDequeue() {
        if (decoder.decodeQueueSize <= QUEUE_DEPTH) {
          decoder.removeEventListener('dequeue', onDequeue);
          resolve();
        }
      });
    });
  }

  for (const sample of videoSamples) {
    await waitForQueueRoom();
    decoder.decode(new EncodedVideoChunk({
      type: sample.is_sync ? 'key' : 'delta',
      timestamp: (sample.cts / videoTrack.timescale) * 1e6,
      duration: (sample.duration / videoTrack.timescale) * 1e6,
      data: sample.data,
    }));
  }
  await decoder.flush();
  await encoder.flush();
  decoder.close();
  encoder.close();

  // Audio: remux-copy, no re-encode (avoids AudioEncoder codec-support gaps).
  if (audioTrack) {
    try {
      for (const sample of audioSamples) {
        muxer.addAudioChunkRaw(sample.data, sample.is_sync ? 'key' : 'delta', (sample.cts / audioTrack.timescale) * 1e6, (sample.duration / audioTrack.timescale) * 1e6);
      }
    } catch {
      // Audio remux failed (e.g. codec mismatch) — proceed video-only rather than aborting the whole compression.
    }
  }

  muxer.finalize();
  const blob = new Blob([target.buffer], { type: 'video/mp4' });
  const compressedName = file.name.replace(/\.[a-zA-Z0-9]+$/, '') + '-compressed.mp4';
  return new File([blob], compressedName, { type: 'video/mp4' });
}

// ---------- fallback path: ffmpeg.wasm (works on any container, any browser) ----------

let ffmpegPromise = null;
function loadFFmpeg() {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const ffmpeg = new FFmpeg();
      const coreURL = await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, 'text/javascript');
      const wasmURL = await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm');
      await ffmpeg.load({ coreURL, wasmURL });
      return ffmpeg;
    })();
  }
  return ffmpegPromise;
}

export function preloadFFmpeg() {
  loadFFmpeg().catch(() => {});
}

async function compressVideoWasm(file, onProgress) {
  const ffmpeg = await loadFFmpeg();
  const progressHandler = ({ progress }) => {
    if (typeof progress === 'number' && Number.isFinite(progress)) onProgress?.(Math.max(0, Math.min(1, progress)));
  };
  ffmpeg.on('progress', progressHandler);

  const inputName = 'input' + (file.name.match(/\.[a-zA-Z0-9]+$/)?.[0] || '.mp4');
  const outputName = 'output.mp4';
  const isLong = file.size > LONG_THRESHOLD_BYTES;
  const scaleFilter = isLong
    ? "scale='min(854,iw)':'min(480,ih)':force_original_aspect_ratio=decrease"
    : "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease";
  const audioAlreadyAac = /audio\/(mp4|aac|x-m4a)/i.test(file.type) || /\.(m4a|aac)$/i.test(file.name);

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));
    await ffmpeg.exec([
      '-i', inputName,
      '-vf', scaleFilter,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-b:v', isLong ? '1M' : '1.5M',
      '-maxrate', isLong ? '1M' : '1.5M',
      '-bufsize', isLong ? '2M' : '3M',
      ...(audioAlreadyAac ? ['-c:a', 'copy'] : ['-c:a', 'aac', '-b:a', '128k']),
      '-movflags', '+faststart',
      outputName,
    ]);
    const data = await ffmpeg.readFile(outputName);
    const blob = new Blob([data.buffer], { type: 'video/mp4' });
    const compressedName = file.name.replace(/\.[a-zA-Z0-9]+$/, '') + '-compressed.mp4';
    return new File([blob], compressedName, { type: 'video/mp4' });
  } finally {
    ffmpeg.off('progress', progressHandler);
    try {
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
    } catch { /* best-effort cleanup */ }
  }
}

// ---------- public entry point: WebCodecs -> wasm -> original ----------

/**
 * @param {File} file
 * @param {(n: number) => void} [onProgress]
 * @param {(phase: string) => void} [onPhaseChange]
 * @param {{ force?: boolean }} [options] force=true skips the "already small enough" short-circuit
 */
export async function compressVideo(file, onProgress, onPhaseChange, options = {}) {
  const force = Boolean(options?.force);
  if (isWebCodecsSupported()) {
    try {
      onPhaseChange?.('encoding');
      const result = await compressVideoWebCodecs(file, onProgress, { force });
      return result || file; // null means "already good enough" — send original
    } catch {
      // Unsupported container, decode error, etc. — fall through to wasm path.
    }
  }
  onPhaseChange?.('loading');
  const ffmpeg = await loadFFmpeg().catch(() => null);
  if (!ffmpeg) throw new Error('Video compression is not supported in this browser');
  onPhaseChange?.('encoding');
  return compressVideoWasm(file, onProgress);
}