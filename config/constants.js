/* ============================================================
 * 全局常量
 * 对应项目书 3.4 全局设计约束 / 4.x 交互流程
 * 接口枚举以后端仓库 Cheerdoge/starlang-bridge 的 model/training.go 为准
 * ============================================================ */

/* ------------------------------------------------------------
 * 接口地址
 *
 * 网页（H5）：必须和后端同源（后端没开 CORS），所以只写路径。
 *         开发时由 vite.config.js 的代理转发，上线时由同一个 Caddy 转发。
 * 小程序：写完整地址；开发者工具要勾「不校验合法域名」。
 * ---------------------------------------------------------- */
let apiBase = 'http://1.12.252.114:80/api/v1'
// #ifdef H5
// apiBase = '/api/v1'
// #endif
export const API_BASE = apiBase

/**
 * 是否启用语音作答。
 * 录音 → POST /speech/transcriptions 转文字 → 带置信度提交回答。
 * 网页需要 https（或 localhost）才能用麦克风；不满足时训练页自动退回点选/打字。
 */
export const VOICE_INPUT_ENABLED = true

/** 本地存储 key，统一前缀避免与宿主小程序冲突 */
export const STORAGE_KEYS = {
  TOKEN: 'xy_token', // 登录令牌
  ONBOARDING: 'xy_onboarding', // 引导流进度（仅本机）
  TASK_FEEDBACK_CACHE: 'xy_task_feedback_cache' // 回填失败本地暂存，恢复网络后重传
}

/* ------------------------------------------------------------
 * 训练节奏（项目书 4.1 / 3.4）
 * ---------------------------------------------------------- */
export const TIMING = {
  /** AI 提问后至少等待 5 秒再给提示（3.4 等待与节奏约束） */
  WAIT_BEFORE_HINT: 5000,
  /** 倾听态最短等待时长，避免儿童还没开口就切状态 */
  LISTEN_MIN: 3000,
  /** 静音多久判定"本次没有说话" */
  SILENCE_DETECT: 2500,
  /** 单次录音最长时长，防误触长时间录制 */
  RECORD_MAX: 15000,
  /** 状态切换过渡，与 $t-base 保持一致 */
  TRANSITION: 320
}

/* ------------------------------------------------------------
 * 家长端陪练提示（流程 6）
 * ---------------------------------------------------------- */
export const COACHING_TIPS = {
  beforeRound: '等孩子自己先说，数到 5 再介入',
  childStuck: '可以示范一次，然后请孩子再说一遍',
  noAnswer: '没关系，可以跳过，也可以休息一下'
}

/* ------------------------------------------------------------
 * 训练页面阶段
 *
 * 注意：真正的训练状态机（轮次、重试、何时结束）在后端。
 * 这里只是前端界面处在哪一步，用来决定屏幕上显示什么。
 * ---------------------------------------------------------- */
export const PHASE = {
  IDLE: 'IDLE', // 还没开始
  QUESTION: 'QUESTION', // 正在读题
  LISTENING: 'LISTENING', // 等孩子回答
  SUBMITTING: 'SUBMITTING', // 已提交，等后端判断
  FEEDBACK: 'FEEDBACK', // 展示这一次的反馈
  FINISHED: 'FINISHED', // 后端返回 finish，本次训练完成
  ABORTED: 'ABORTED', // 家长或孩子主动结束
  SAFETY: 'SAFETY' // 安全中止（后端 risk_flag，或家长选了"孩子不舒服"）
}

/* ------------------------------------------------------------
 * 后端判断结果枚举（照抄 model/training.go）
 * ---------------------------------------------------------- */

/** validity：本次表达的有效性 */
export const VALIDITY = {
  VALID: 'valid',
  PARTIAL: 'partial',
  UNCLEAR: 'unclear',
  OFF_TOPIC: 'off_topic',
  REFUSED: 'refused',
  SILENCE: 'silence'
}

/**
 * next_action：后端决定的下一步。
 * praise 在后端有定义但不会被返回（答对时直接给 next_turn / finish）。
 */
export const NEXT_ACTION = {
  RETRY: 'retry', // 请再说一遍（同一题）
  SHOW_HINT: 'show_hint', // 显示词块（同一题）
  PARENT_ASSIST: 'parent_assist', // 显示完整句，请家长帮忙（同一题）
  NEXT_TURN: 'next_turn', // 进入下一轮（新的一题）
  FINISH: 'finish' // 本次训练完成
}

/** 提示层级：由 next_action 推出，只用于前端展示 */
export const HINT_LEVEL = {
  NONE: 0, // 没用提示
  L1: 1, // 请再说一遍
  L2: 2, // 词块
  L3: 3 // 完整句 + 家长辅助
}

/** 会话状态（后端 status 字段） */
export const SESSION_STATUS = {
  ACTIVE: 'active',
  FINISHED: 'finished',
  ABORTED: 'aborted'
}

/* ------------------------------------------------------------
 * 任务卡回填（后端 feedback 取值 1~5，0 表示还没回填）
 * ---------------------------------------------------------- */
export const TASK_FEEDBACK_OPTIONS = [
  { value: 1, label: '独立完成', desc: '孩子自己说出来了', effect: '难度保持或提高', tone: 'safe' },
  { value: 2, label: '提示后完成', desc: '给了一点提示以后完成了', effect: '保持难度，优化提示', tone: 'leaf' },
  { value: 3, label: '家长代答', desc: '最后是我们帮着说的', effect: '检查场景和时机', tone: 'warn' },
  { value: 4, label: '这次没完成', desc: '这次没做成，没关系', effect: '检查场景和时机', tone: 'warn' },
  { value: 5, label: '暂不适用', desc: '这次的情况不太合适', effect: '更换任务场景', tone: 'plain' }
]

/**
 * 回填后给家长的下次建议（流程 9）。
 * 后端目前没有"训练建议"接口，按回填结果在前端本地给出。
 */
export const DIFFICULTY_ADVICE = {
  1: { title: '下次可以试一点点更难的', desc: '孩子这次独立完成了，下次可以在同样的场景里多说一句。' },
  2: { title: '保持这个难度，把提示再收一点', desc: '还是一样的任务，提示可以少给一点，多等几秒。' },
  3: { title: '换个时机和场景再试试', desc: '不是孩子不会，可能是当时的状态或环境不太合适。' },
  4: { title: '换个时机和场景再试试', desc: '不是孩子不会，可能是当时的状态或环境不太合适。' },
  5: { title: '换一个更贴近日常的任务', desc: '把场景换成平时更容易发生的那种，会自然一些。' }
}

/** 任务卡建议时长（项目书流程 9：5 分钟以内），后端不返回该字段 */
export const TASK_CARD_DURATION = '5 分钟以内'

/* ------------------------------------------------------------
 * 退出原因（流程 10）
 * 后端 abort 接口的 reason 是自由文本，这里约定几个固定值方便统计。
 * 后端自己触发风险中止时写入的是 "safety"。
 * ---------------------------------------------------------- */
export const EXIT_REASON = {
  USER_PAUSE: 'user_pause', // 儿童/家长主动暂停
  USER_STOP: 'user_stop', // 主动结束
  CHILD_UNWELL: 'child_unwell', // 明显不适或异常
  REPEATED_ASR_FAIL: 'repeated_asr_fail', // 连续没听清
  SAFETY: 'safety', // 后端检测到风险内容
  STOP_SIGNAL: 'stop_signal' // 孩子说出了画像里的停止信号，后端写入
}

export const EXIT_REASON_LABEL = {
  user_pause: '主动暂停',
  user_stop: '主动结束',
  child_unwell: '孩子不太舒服',
  repeated_asr_fail: '连续没听清',
  safety: '触发了安全规则',
  stop_signal: '孩子说想停下来'
}
