/**
 * 网页录音：麦克风 → 16 kHz 单声道 PCM → MP3
 *
 * 后端 /speech/transcriptions 只收 16 kHz 的 MP3（server/speech_audio.go 会真的解码校验采样率），
 * 浏览器 MediaRecorder 只能出 webm/mp4，所以这里自己采 PCM、重采样、用 lamejs 编码。
 *
 * 只在 H5 下被 recorder.js 动态引入，小程序包里不会带上编码器。
 *
 * 浏览器限制：麦克风只在 https 或 localhost 页面可用（isSecureContext）。
 */
import * as lame from '@breezystack/lamejs'

// 包的 README 用的是 import * as lame；兼容只有默认导出的构建产物
const Mp3Encoder = lame.Mp3Encoder || (lame.default && lame.default.Mp3Encoder)

const TARGET_RATE = 16000
const KBPS = 32 // 16 kHz 单声道人声，32 kbps 足够清楚；15 秒约 60 KB，远低于后端 2.25 MB 上限
const FRAME = 1152 // MP3 一帧的采样数

/** 当前环境能不能录音，不能的话给出原因（显示给家长） */
export function webRecordSupport() {
  if (typeof window === 'undefined') return { ok: false, reason: '当前环境不支持录音' }
  if (!window.isSecureContext) {
    return { ok: false, reason: '网页需要 https 才能使用麦克风' }
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return { ok: false, reason: '这个浏览器不支持录音' }
  }
  if (!(window.AudioContext || window.webkitAudioContext)) {
    return { ok: false, reason: '这个浏览器不支持录音' }
  }
  return { ok: true, reason: '' }
}

/**
 * 线性插值重采样到 16 kHz。
 * 人声频段在 8 kHz 以下，这种简单做法对识别足够；不在主线程做复杂滤波，避免低端机卡顿。
 */
function resample(input, fromRate) {
  if (fromRate === TARGET_RATE) return input
  const ratio = fromRate / TARGET_RATE
  const outLen = Math.floor(input.length / ratio)
  const out = new Float32Array(outLen)
  for (let i = 0; i < outLen; i += 1) {
    const pos = i * ratio
    const idx = Math.floor(pos)
    const frac = pos - idx
    const a = input[idx] || 0
    const b = input[idx + 1] !== undefined ? input[idx + 1] : a
    out[i] = a + (b - a) * frac
  }
  return out
}

function floatTo16(input) {
  const out = new Int16Array(input.length)
  for (let i = 0; i < input.length; i += 1) {
    const s = Math.max(-1, Math.min(1, input[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

function encodeMp3(samples16k) {
  const encoder = new Mp3Encoder(1, TARGET_RATE, KBPS)
  const pcm = floatTo16(samples16k)
  const chunks = []
  for (let i = 0; i < pcm.length; i += FRAME) {
    const buf = encoder.encodeBuffer(pcm.subarray(i, i + FRAME))
    if (buf.length) chunks.push(new Uint8Array(buf))
  }
  const tail = encoder.flush()
  if (tail.length) chunks.push(new Uint8Array(tail))
  return new Blob(chunks, { type: 'audio/mpeg' })
}

/**
 * 开始一次录音
 * @param {object} cb
 * @param {(level:number)=>void} [cb.onLevel] 实时音量 0~1，用于静音检测和波形
 * @returns {Promise<{ stop: () => Promise<{ blob: Blob, duration: number }>, cancel: () => void }>}
 * @throws 权限被拒时抛出 name 为 NotAllowedError 的错误
 */
export async function startWebRecording({ onLevel } = {}) {
  // AudioContext 要在第一个 await 之前创建并 resume：iOS 只认用户点按同步调用的这一下，
  // 等麦克风授权弹窗回来以后再创建，会一直是 suspended，录到的全是静音
  const Ctx = window.AudioContext || window.webkitAudioContext
  const audioCtx = new Ctx()
  const resuming = audioCtx.state === 'suspended' ? audioCtx.resume() : Promise.resolve()

  let stream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
    })
  } catch (e) {
    audioCtx.close().catch(() => {})
    throw e
  }
  await resuming

  const source = audioCtx.createMediaStreamSource(stream)
  // ScriptProcessor 已标记废弃但所有主流浏览器都还支持；AudioWorklet 需要单独的模块文件，
  // 在 uni-app 的 H5 构建里路径不好处理，先用这个
  const processor = audioCtx.createScriptProcessor(4096, 1, 1)
  const buffers = []
  let length = 0
  const startedAt = Date.now()

  processor.onaudioprocess = (e) => {
    const data = e.inputBuffer.getChannelData(0)
    buffers.push(new Float32Array(data))
    length += data.length
    if (onLevel) {
      let sum = 0
      for (let i = 0; i < data.length; i += 16) sum += Math.abs(data[i])
      onLevel(Math.min(1, (sum / (data.length / 16)) * 4))
    }
  }
  source.connect(processor)
  // 必须连到 destination，processor 才会被调度；输出全是 0，不会有回放声音
  processor.connect(audioCtx.destination)

  let closed = false
  function release() {
    if (closed) return
    closed = true
    processor.onaudioprocess = null
    try {
      source.disconnect()
      processor.disconnect()
    } catch (e) {
      /* ignore */
    }
    stream.getTracks().forEach((t) => t.stop())
    audioCtx.close().catch(() => {})
  }

  return {
    async stop() {
      const rate = audioCtx.sampleRate
      release()
      const merged = new Float32Array(length)
      let offset = 0
      buffers.forEach((b) => {
        merged.set(b, offset)
        offset += b.length
      })
      const blob = encodeMp3(resample(merged, rate))
      return { blob, duration: Date.now() - startedAt }
    },
    cancel: release
  }
}
