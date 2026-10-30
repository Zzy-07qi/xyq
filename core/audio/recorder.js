import { TIMING } from '@/config/constants'

/**
 * 录音管理器
 *
 * 两个平台都输出后端要的 16 kHz 单声道 MP3：
 *   小程序：uni.getRecorderManager，onStop 给临时文件路径
 *   网页：  ./web-recorder.js（浏览器采 PCM 再编码），onStop 给 Blob
 *
 * 对外状态事件：LISTENING / RECORDING / STOPPED / ERROR
 * 静音检测用「音量阈值 + 持续时长」近似，真机上可按环境噪声调 SILENCE_THRESHOLD。
 */

const SILENCE_THRESHOLD = 0.06 // 音量阈值，低于该值视为静音
const STATE = {
  LISTENING: 'LISTENING',
  RECORDING: 'RECORDING',
  STOPPED: 'STOPPED',
  ERROR: 'ERROR'
}

let recorderManager = null
let state = STATE.STOPPED
const listeners = new Set()

/** 内部计时器 */
let silenceTimer = null
let maxDurationTimer = null
let lastSoundAt = 0
/** 最近一次的音量 0~1，给波形用 */
let currentLevel = 0

function setLevel(level) {
  currentLevel = level
  if (level > SILENCE_THRESHOLD) lastSoundAt = Date.now()
}

/** 当前录音上下文，停止时透传给回调 */
let ctx = {
  startedAt: 0,
  onStop: null,
  onError: null
}

function emit(event, payload) {
  state = event
  listeners.forEach((fn) => {
    try {
      fn(event, payload)
    } catch (e) {
      console.warn('[recorder] 监听器异常', e)
    }
  })
}

function getManager() {
  if (!recorderManager) {
    recorderManager = uni.getRecorderManager()
    bindEvents()
  }
  return recorderManager
}

function bindEvents() {
  recorderManager.onStart(() => {
    ctx.startedAt = Date.now()
    emit(STATE.RECORDING)
    lastSoundAt = Date.now()
    startSilenceWatch()
    startMaxDurationWatch()
  })

  recorderManager.onStop((res) => {
    clearWatch()
    const duration = Date.now() - ctx.startedAt
    emit(STATE.STOPPED, { ...res, duration })
    if (typeof ctx.onStop === 'function') {
      ctx.onStop(res.tempFilePath, duration)
    }
  })

  recorderManager.onError((err) => {
    clearWatch()
    emit(STATE.ERROR, err)
    if (typeof ctx.onError === 'function') {
      ctx.onError(err)
    }
  })

  // 帧数据回调：用于粗略音量检测
  recorderManager.onFrameRecorded((res) => {
    setLevel(estimateVolume(res.frameBuffer))
  })
}

/**
 * 从 PCM 帧粗略估算音量（0~1）
 * 只取前若干字节做采样，避免儿童端低端机性能压力
 */
function estimateVolume(buffer) {
  if (!buffer || !buffer.byteLength) return 0
  const view = new Uint8Array(buffer)
  const step = Math.max(1, Math.floor(view.length / 256))
  let sum = 0
  let count = 0
  for (let i = 0; i < view.length; i += step) {
    sum += Math.abs(view[i] - 128)
    count += 1
  }
  return count ? Math.min(1, sum / count / 128) : 0
}

/** 静音检测：持续静音超过阈值则自动停止录音 */
function startSilenceWatch() {
  clearInterval(silenceTimer)
  silenceTimer = setInterval(() => {
    if (state !== STATE.RECORDING) return
    if (Date.now() - lastSoundAt > TIMING.SILENCE_DETECT) {
      // 一句话说完了，自动结束
      stop()
    }
  }, 400)
}

/** 最长时长保护，防止误触长时间录制 */
function startMaxDurationWatch() {
  clearTimeout(maxDurationTimer)
  maxDurationTimer = setTimeout(() => {
    if (state === STATE.RECORDING) stop()
  }, TIMING.RECORD_MAX)
}

function clearWatch() {
  clearInterval(silenceTimer)
  clearTimeout(maxDurationTimer)
  silenceTimer = null
  maxDurationTimer = null
}

/* ============================================================
 * 网页（H5）：浏览器录音，产出 16 kHz MP3 Blob
 * onStop 的第一个参数在网页里是 Blob，在小程序里是临时文件路径，
 * 上传函数（core/request.js upload）两种都认。
 * ============================================================ */

// #ifdef H5
let webSession = null
let webSupport = null
/**
 * 页面一加载就开始下载编码器模块。点录音时它已经就绪，
 * startWebRecording 里的 getUserMedia 才能和点按发生在同一个事件里
 * （iOS Safari 要求开麦克风必须是用户点按直接触发的，中间隔了网络加载就会被拒）。
 */
let webModule = null
const webModuleReady = import('./web-recorder').then((m) => {
  webModule = m
  return m
})

async function webStart() {
  const mod = webModule || (await webModuleReady)
  webSupport = webSupport || mod.webRecordSupport()
  if (!webSupport.ok) {
    const err = { reason: 'unsupported', errMsg: webSupport.reason }
    emit(STATE.ERROR, err)
    if (ctx.onError) ctx.onError(err)
    return
  }
  try {
    webSession = await mod.startWebRecording({ onLevel: setLevel })
  } catch (e) {
    const denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')
    const err = { reason: denied ? 'permission_denied' : 'start_failed', errMsg: e && e.message }
    emit(STATE.ERROR, err)
    if (ctx.onError) ctx.onError(err)
    return
  }
  ctx.startedAt = Date.now()
  lastSoundAt = Date.now()
  emit(STATE.RECORDING)
  startSilenceWatch()
  startMaxDurationWatch()
}

async function webStop() {
  clearWatch()
  const s = webSession
  webSession = null
  if (!s) return
  try {
    const { blob, duration } = await s.stop()
    emit(STATE.STOPPED, { tempFilePath: blob, duration })
    if (ctx.onStop) ctx.onStop(blob, duration)
  } catch (e) {
    const err = { reason: 'encode_failed', errMsg: e && e.message }
    emit(STATE.ERROR, err)
    if (ctx.onError) ctx.onError(err)
  }
}
// #endif

/** 网页能否录音；不能时返回原因（如「网页需要 https 才能使用麦克风」） */
export async function getSupport() {
  // #ifdef H5
  const mod = webModule || (await webModuleReady)
  webSupport = mod.webRecordSupport()
  return webSupport
  // #endif
  // #ifndef H5
  return { ok: true, reason: '' }
  // #endif
}

/* ============================================================
 * 对外 API
 * ============================================================ */

/**
 * 申请麦克风权限
 * 网页里浏览器会在第一次 getUserMedia 时自己弹窗，这里只检查环境是否允许
 * @returns {Promise<boolean>}
 */
export function requestPermission() {
  // #ifdef H5
  return getSupport().then((s) => s.ok)
  // #endif
  return new Promise((resolve) => {
    uni.authorize({
      scope: 'scope.record',
      success: () => resolve(true),
      fail: () => {
        // 引导用户去设置页开启
        uni.showModal({
          title: '需要麦克风',
          content: '打开麦克风以后，孩子说话我才能听见',
          confirmText: '去打开',
          cancelText: '先用文字',
          success: (res) => {
            if (res.confirm) {
              uni.openSetting({
                success: (s) => resolve(!!s.authSetting['scope.record']),
                fail: () => resolve(false)
              })
            } else {
              resolve(false)
            }
          },
          fail: () => resolve(false)
        })
      }
    })
  })
}

/**
 * 开始录音
 * @param {object} options
 * @param {Function} options.onStop  (tempFilePath, duration) => void
 * @param {Function} options.onError (err) => void
 */
export function start({ onStop, onError } = {}) {
  ctx = { startedAt: 0, onStop, onError }
  emit(STATE.LISTENING)
  // #ifdef H5
  webStart()
  return
  // #endif
  const mgr = getManager()
  mgr.start({
    duration: TIMING.RECORD_MAX,
    sampleRate: 16000,
    numberOfChannels: 1,
    encodeBitRate: 48000,
    format: 'mp3',
    frameSize: 4 // 开启 onFrameRecorded，用于音量检测
  })
}

/** 主动停止录音 */
export function stop() {
  if (state !== STATE.RECORDING && state !== STATE.LISTENING) return
  // #ifdef H5
  webStop()
  return
  // #endif
  try {
    getManager().stop()
  } catch (e) {
    console.warn('[recorder] 停止失败', e)
  }
}

/** 当前音量 0~1 */
export function getLevel() {
  return state === STATE.RECORDING ? currentLevel : 0
}

/** 是否正在录音 */
export function isRecording() {
  return state === STATE.RECORDING
}

/** 当前状态 */
export function getState() {
  return state
}

/** 订阅状态变化，返回取消订阅函数 */
export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** 急停：安全中止时调用，立刻释放录音资源 */
export function forceStop() {
  clearWatch()
  // #ifdef H5
  if (webSession) {
    webSession.cancel()
    webSession = null
  }
  // #endif
  // #ifndef H5
  try {
    getManager().stop()
  } catch (e) {
    /* ignore */
  }
  // #endif
  emit(STATE.STOPPED, { force: true })
}

export { STATE as RECORDER_STATE }
