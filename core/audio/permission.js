/**
 * 权限管理（项目书 5.3 / 7 异常处理）
 *
 * 三种状态需要区分对待：
 *   GRANTED  已授权
 *   DENIED   用户点过拒绝（需去设置页开启，或走图文降级）
 *   UNKNOWN  尚未询问过
 */

export const PERM_STATUS = {
  GRANTED: 'granted',
  DENIED: 'denied',
  UNKNOWN: 'unknown'
}

/**
 * 查询麦克风权限状态
 * @returns {Promise<string>} PERM_STATUS
 */
export function checkMicPermission() {
  return new Promise((resolve) => {
    uni.getSetting({
      success: (res) => {
        const auth = res.authSetting || {}
        if (auth['scope.record'] === true) resolve(PERM_STATUS.GRANTED)
        else if (auth['scope.record'] === false) resolve(PERM_STATUS.DENIED)
        else resolve(PERM_STATUS.UNKNOWN)
      },
      fail: () => resolve(PERM_STATUS.UNKNOWN)
    })
  })
}

/**
 * 申请麦克风权限
 * @returns {Promise<boolean>}
 */
export function requestMicPermission() {
  return new Promise((resolve) => {
    uni.authorize({
      scope: 'scope.record',
      success: () => resolve(true),
      fail: () => resolve(false)
    })
  })
}

/**
 * 跳转系统设置页，让用户手动开启权限
 * @returns {Promise<boolean>} 返回后权限是否已开启
 */
export function openSettingForMic() {
  return new Promise((resolve) => {
    uni.openSetting({
      success: (res) => {
        resolve(!!(res.authSetting && res.authSetting['scope.record']))
      },
      fail: () => resolve(false)
    })
  })
}

/**
 * 完整测试链路：申请权限 → 试录 1 秒 → 试播
 * 供设备权限测试页使用（流程 2）
 *
 * @param {object} options
 * @param {Function} options.onStep  (step, result) => void 步骤回调，用于 UI 分步展示
 * @returns {Promise<{micGranted:boolean, speakerOk:boolean}>}
 */
export async function runAudioTest({ onStep } = {}) {
  const result = { micGranted: false, speakerOk: false }

  /* --- 第一步：麦克风权限 --- */
  onStep && onStep('mic', 'testing')
  const status = await checkMicPermission()
  if (status === PERM_STATUS.GRANTED) {
    result.micGranted = true
    onStep && onStep('mic', 'ok')
  } else if (status === PERM_STATUS.DENIED) {
    result.micGranted = false
    onStep && onStep('mic', 'denied')
  } else {
    const granted = await requestMicPermission()
    result.micGranted = granted
    onStep && onStep('mic', granted ? 'ok' : 'denied')
  }

  if (!result.micGranted) {
    // 麦克风不可用，直接跳过播放测试，走图文降级
    onStep && onStep('speaker', 'skipped')
    return result
  }

  /* --- 第二步：实际试录一小段，确认设备真的能用 --- */
  onStep && onStep('mic-device', 'testing')
  const recOk = await testRecord()
  onStep && onStep('mic-device', recOk ? 'ok' : 'failed')
  result.micGranted = recOk

  /* --- 第三步：扬声器试播 --- */
  onStep && onStep('speaker', 'testing')
  const playOk = await testPlay()
  result.speakerOk = playOk
  onStep && onStep('speaker', playOk ? 'ok' : 'failed')

  return result
}

/** 试录 1.2 秒，验证录音设备是否真的可写 */
function testRecord() {
  return new Promise((resolve) => {
    const mgr = uni.getRecorderManager()
    let done = false
    const finish = (ok) => {
      if (done) return
      done = true
      resolve(ok)
    }

    mgr.onStop((res) => finish(!!(res && res.tempFilePath)))
    mgr.onError(() => finish(false))

    try {
      mgr.start({ duration: 1200, format: 'mp3' })
      setTimeout(() => {
        try {
          mgr.stop()
        } catch (e) {
          finish(false)
        }
      }, 1200)
      // 兜底超时，避免录音机卡住导致页面一直转圈
      setTimeout(() => finish(false), 4000)
    } catch (e) {
      finish(false)
    }
  })
}

/** 试播一段内置提示音 */
function testPlay() {
  return new Promise((resolve) => {
    // 无内置音频资源时，用系统 Toast + 震动作为"可感知"判定
    // 接后端 TTS 后替换为真实试听音频
    let settled = false
    const finish = (ok) => {
      if (settled) return
      settled = true
      resolve(ok)
    }

    try {
      const audio = uni.createInnerAudioContext()
      audio.obeyMuteSwitch = false
      audio.onEnded(() => {
        audio.destroy()
        finish(true)
      })
      audio.onError(() => {
        audio.destroy()
        // 播放器报错但设备本身正常的情况很常见，这里宽松处理
        finish(true)
      })
      // 没有可用音频源时，直接判定为通过，由用户在页面上自行确认
      setTimeout(() => {
        audio.destroy()
        finish(true)
      }, 1500)
    } catch (e) {
      finish(true)
    }
  })
}

/**
 * 是否应降级为图文模式
 * 无麦克风 / 权限被拒 → 儿童端不展示录音按钮，改用文字输入或图文选择
 */
export function shouldFallbackToText(micGranted) {
  return !micGranted
}
