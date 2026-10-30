/**
 * 语音播放器封装（项目书 5.3 / 4.3）
 *
 * 有音频地址时播放音频；没有时，网页里用浏览器自带朗读读文字，小程序里只显示文字。
 *
 * 职责：
 *  - 统一封装播放、试听、打断、急停
 *  - 播放状态与 UI 动画保持同步（通过 subscribe 订阅）
 *  - 播放失败时降级为纯文字呈现，不阻断流程（项目书 7 音频设备异常）
 *  - 安全中止时 stop() 必须立即生效
 *
 * 约束：
 *  - 全局同时只允许一个音频实例播放，避免多个语音叠在一起造成刺激
 *  - 不做自动连续播放，每段语音都由明确的用户动作或流程节点触发
 */

const STATE = {
  IDLE: 'IDLE',
  LOADING: 'LOADING',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  STOPPED: 'STOPPED',
  ERROR: 'ERROR'
}

let innerAudio = null
let state = STATE.IDLE
let current = { url: '', text: '', tag: '' }
const listeners = new Set()

function emit(event, payload) {
  state = event
  listeners.forEach((fn) => {
    try {
      fn(event, payload)
    } catch (e) {
      console.warn('[player] 监听器异常', e)
    }
  })
}

/** 惰性创建音频实例，并绑定一次性事件 */
function getAudio() {
  if (innerAudio) return innerAudio

  innerAudio = uni.createInnerAudioContext()
  // TTS 尽量走扬声器，儿童端不要走听筒
  innerAudio.obeyMuteSwitch = false
  innerAudio.volume = 1

  innerAudio.onPlay(() => emit(STATE.PLAYING, { ...current }))
  innerAudio.onWaiting(() => emit(STATE.LOADING, { ...current }))
  innerAudio.onPause(() => emit(STATE.PAUSED, { ...current }))
  innerAudio.onStop(() => emit(STATE.STOPPED, { ...current }))
  innerAudio.onEnded(() => {
    const done = { ...current }
    emit(STATE.STOPPED, done)
    done.onEnded && done.onEnded()
  })
  innerAudio.onError((err) => {
    console.warn('[player] 播放失败', err)
    emit(STATE.ERROR, { ...current, error: err })
  })

  return innerAudio
}

/* ============================================================
 * 网页：浏览器自带的朗读（speechSynthesis）
 * 后端不提供语音合成，题目和反馈在网页里用它读出来。不需要 https。
 * 声音由手机系统决定；没有中文声音或浏览器不支持时，退回只显示文字。
 * ========================================================== */

// #ifdef H5
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
let speakToken = 0
/** 部分安卓浏览器不触发 onend，按字数估一个兜底时长，保证流程能往下走 */
const MS_PER_CHAR = 320

function zhVoice() {
  if (!synth) return null
  const voices = synth.getVoices() || []
  return (
    voices.find((v) => /^zh[-_]CN/i.test(v.lang)) ||
    voices.find((v) => /^zh/i.test(v.lang)) ||
    null
  )
}

function speak(text, onEnded) {
  if (!synth || !text || typeof SpeechSynthesisUtterance === 'undefined') return false
  const token = ++speakToken
  let finished = false
  let fallback = null
  const finish = () => {
    if (finished || token !== speakToken) return
    finished = true
    clearTimeout(fallback)
    emit(STATE.STOPPED, { ...current })
    if (typeof onEnded === 'function') onEnded()
  }

  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'zh-CN'
  const voice = zhVoice()
  if (voice) u.voice = voice
  u.rate = 0.85 // 比默认慢一点，给孩子听清楚的时间（项目书：慢节奏）
  u.pitch = 1.05
  u.onstart = () => {
    if (token === speakToken) emit(STATE.PLAYING, { ...current })
  }
  u.onend = finish
  u.onerror = finish
  fallback = setTimeout(finish, 1500 + text.length * MS_PER_CHAR)

  emit(STATE.LOADING, { ...current })
  synth.speak(u)
  return true
}

function stopSpeak() {
  speakToken += 1
  if (synth) synth.cancel()
}

// iOS Safari 第一次 speak 必须发生在用户点按里，否则整页都读不出来。
// 在第一次点按时读一个空串，把朗读「解锁」。
if (synth && typeof document !== 'undefined') {
  const unlock = () => {
    try {
      synth.speak(new SpeechSynthesisUtterance(''))
    } catch (e) {
      /* ignore */
    }
    document.removeEventListener('touchend', unlock, true)
    document.removeEventListener('click', unlock, true)
  }
  document.addEventListener('touchend', unlock, true)
  document.addEventListener('click', unlock, true)
  // 声音列表在部分浏览器里是异步加载的，先触发一次
  synth.getVoices()
}
// #endif

/** 当前环境能否把文字读出来（网页里有 speechSynthesis 才行） */
export function canSpeak() {
  // #ifdef H5
  return !!synth
  // #endif
  return false
}

/**
 * 播放一段语音
 * @param {object} options
 * @param {string} options.url      音频地址；为空时网页里用浏览器朗读 text
 * @param {string} [options.text]   对应文本
 * @param {string} [options.tag]    来源标记：intro / question / feedback / wordcard / safety
 * @param {Function} [options.onEnded] 播放结束回调
 * @returns {Promise<boolean>} 是否发出了声音
 */
export function play({ url, text = '', tag = '', onEnded } = {}) {
  // 同一段正在播就直接跳过，避免重复叠加
  if (state === STATE.PLAYING && current.url === url && current.text === text) {
    return Promise.resolve(true)
  }

  // 先停掉上一段，保证不重叠
  stop(true)

  current = { url, text, tag, onEnded }

  if (!url) {
    // #ifdef H5
    if (speak(text, onEnded)) return Promise.resolve(true)
    // #endif
    // 读不出来：只显示文字，留一点阅读时间再继续，不阻断流程
    emit(STATE.ERROR, { ...current, reason: 'no_url' })
    if (typeof onEnded === 'function') setTimeout(onEnded, 1200)
    return Promise.resolve(false)
  }

  emit(STATE.LOADING, { ...current })
  const audio = getAudio()
  audio.src = url

  return new Promise((resolve) => {
    try {
      audio.play()
      resolve(true)
    } catch (e) {
      emit(STATE.ERROR, { ...current, error: e })
      resolve(false)
    }
  })
}

/**
 * 停止播放
 * @param {boolean} silent 是否静默停止（内部切换时不触发 STOPPED 通知）
 */
export function stop(silent = false) {
  // #ifdef H5
  stopSpeak()
  // #endif
  if (!innerAudio) {
    if (!silent) emit(STATE.STOPPED, { ...current })
    else state = STATE.STOPPED
    return
  }
  try {
    innerAudio.stop()
  } catch (e) {
    console.warn('[player] 停止失败', e)
  }
  if (silent) {
    state = STATE.STOPPED
  } else {
    emit(STATE.STOPPED, { ...current })
  }
}

/** 暂停：儿童/家长暂停训练时调用（流程 10 暂停分支） */
export function pause() {
  // #ifdef H5
  if (synth && synth.speaking) synth.pause()
  // #endif
  if (!innerAudio || state !== STATE.PLAYING) return
  try {
    innerAudio.pause()
  } catch (e) {
    console.warn('[player] 暂停失败', e)
  }
}

/** 从暂停恢复 */
export function resume() {
  // #ifdef H5
  if (synth && synth.paused) synth.resume()
  // #endif
  if (!innerAudio || state !== STATE.PAUSED) return
  try {
    innerAudio.play()
  } catch (e) {
    console.warn('[player] 恢复失败', e)
  }
}

/**
 * 急停：安全中止专用（项目书 4.3 / 4.6）
 * 必须立即生效，且不可恢复
 */
export function forceStop() {
  // #ifdef H5
  stopSpeak()
  // #endif
  if (innerAudio) {
    try {
      innerAudio.stop()
      innerAudio.seek(0)
    } catch (e) {
      /* ignore */
    }
  }
  current = { url: '', text: '', tag: '' }
  emit(STATE.STOPPED, { force: true })
}

/** 当前是否在播 */
export function isPlaying() {
  return state === STATE.PLAYING
}

/** 当前状态 */
export function getState() {
  return state
}

/** 当前播放内容的来源标记，UI 用它决定动画 */
export function getTag() {
  return current.tag
}

/** 订阅状态变化 */
export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * 播放一段固定时长的提示音（无 TTS 资源时）
 * 用于"我在听"这类不需要合成语音的场景
 */
export function playBeep(duration = 300) {
  // 用轻震动代替提示音，比声音刺激更弱；网页里浏览器不支持就什么都不做
  // #ifndef H5
  try {
    uni.vibrateShort({ type: 'light' })
  } catch (e) {
    /* ignore */
  }
  // #endif
  return Promise.resolve(duration)
}

export { STATE as PLAYER_STATE }
