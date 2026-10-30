import { request, upload, login, setToken, clearToken } from '@/core/request'
import { getDisplay } from '@/config/scenarios'
import { TASK_CARD_DURATION } from '@/config/constants'

/* ============================================================
 * 接口层：对接 Cheerdoge/starlang-bridge
 *
 * 每个函数返回的都是「前端用的形状」，后端字段名的转换全部在这个文件里做，
 * 页面和 store 不直接碰 snake_case 字段。以后后端改字段，只改这里。
 *
 * 所有函数失败时抛 ApiError（见 core/request.js），由调用方 try/catch。
 * ============================================================ */

/* ============================================================
 * 数据转换
 * ========================================================== */

/** 后端情境（列表项或详情）→ 前端情境 */
function toScenario(raw) {
  const display = getDisplay(raw.id)
  return {
    id: raw.id,
    title: raw.name,
    goal: raw.goal,
    image: raw.image,
    // 以下来自本地展示配置
    emoji: display.emoji,
    themeColor: display.themeColor,
    cover: display.cover,
    sceneDesc: display.sceneDesc || raw.goal,
    // 以下仅详情接口有
    targetSentences: raw.target_sentences || [],
    roundCount: raw.rounds ? raw.rounds.length : 0,
    rounds: (raw.rounds || []).map((r) => ({
      round: r.round,
      question: r.ai_question,
      targetSentence: r.target_sentence,
      wordBlocks: r.word_blocks || [],
      parentTip: r.parent_tip
    }))
  }
}

/**
 * 任务卡 steps 字段在两个地方类型不一样：
 *   训练结束时 answers 接口里返回的是数组
 *   /task-cards 列表和 /backfill 返回的是 JSON 字符串
 * 这里统一成数组。
 */
function parseSteps(steps) {
  if (Array.isArray(steps)) return steps
  if (typeof steps === 'string' && steps) {
    try {
      const arr = JSON.parse(steps)
      return Array.isArray(arr) ? arr : [steps]
    } catch (e) {
      return [steps]
    }
  }
  return []
}

/** 后端任务卡 → 前端任务卡 */
function toTaskCard(raw) {
  return {
    id: raw.id,
    sessionId: raw.session_id,
    scenarioId: raw.scenario_id,
    title: raw.name,
    targetSentence: raw.target_sentence,
    realScene: raw.scene,
    steps: parseSteps(raw.steps),
    observe: raw.observation,
    duration: TASK_CARD_DURATION,
    // status: 0 待完成 / 1 已回填；feedback: 0 未回填 / 1~5
    done: raw.status === 1,
    feedback: raw.feedback || 0,
    note: raw.note || '',
    createdAt: raw.created_at
  }
}

/** 后端孩子画像 → 前端画像 */
function toProfile(raw) {
  if (!raw) return null
  return {
    name: raw.name,
    age: raw.age,
    languageLevel: raw.language_level,
    // 后端是逗号分隔的字符串
    interests: raw.interests ? raw.interests.split(',').filter(Boolean) : [],
    hintPreference: raw.prompt_preference,
    waitSeconds: raw.wait_seconds,
    sensorySensitive: raw.sensory_sensitive,
    stopSignal: raw.stop_signal,
    riskNote: raw.risk_note
  }
}

/** 前端画像 → 后端 PUT /user/child 的请求体（全量覆盖，所有字段都要带上） */
function fromProfile(p) {
  return {
    name: p.name,
    age: Number(p.age),
    language_level: p.languageLevel || '',
    interests: (p.interests || []).join(','),
    prompt_preference: p.hintPreference || '',
    wait_seconds: Number(p.waitSeconds) || 5,
    sensory_sensitive: p.sensorySensitive || '',
    stop_signal: p.stopSignal || '',
    risk_note: p.riskNote || ''
  }
}

/** 后端 AnswerView / SessionView → 前端一轮结果 */
function toTurn(raw) {
  return {
    sessionId: raw.session_id,
    status: raw.status,
    round: raw.round,
    totalRounds: raw.total_rounds,
    question: raw.question || '',
    wordBlocks: raw.word_blocks || [],
    parentTip: raw.parent_tip || '',
    // 以下仅 answers 接口有
    validity: raw.validity || '',
    nextAction: raw.next_action || '',
    feedback: raw.feedback || '',
    targetSentence: raw.target_sentence || '',
    retryCount: raw.retry_count || 0,
    riskFlag: !!raw.risk_flag,
    summary: raw.summary || '',
    taskCard: raw.task_card ? toTaskCard(raw.task_card) : null
  }
}

/* ============================================================
 * 账号与同意（流程 2）
 * ========================================================== */

/**
 * 小程序静默登录。request 层会在需要时自动调用，页面一般不用直接调。
 * @returns {{ needConsent: boolean, consent: number }}
 */
export async function doLogin() {
  const data = await login()
  return { needConsent: !!data.need_consent, consent: data.user ? data.user.consent : 0 }
}

/** 登录 / 注册成功后的统一处理：存 token，返回同意状态 */
function afterAuth(data) {
  setToken(data.token)
  return { needConsent: !!data.need_consent, consent: data.user ? data.user.consent : 0 }
}

/**
 * 网页注册（手机号 + 密码），成功后直接是登录状态。
 * 后端要求：手机号为大陆 11 位；密码 8–64 位，同时有字母和数字。
 * 手机号已注册时抛 ApiError，code 409。
 */
export async function register({ phone, password, nickname = '' }) {
  const data = await request({
    url: '/auth/register',
    method: 'POST',
    data: { phone, password, nickname },
    auth: false
  })
  return afterAuth(data)
}

/**
 * 网页密码登录。
 * 手机号不存在和密码错误都返回 401「手机号或密码错误」；
 * 同一手机号 15 分钟内失败 5 次后返回 429。
 */
export async function passwordLogin({ phone, password }) {
  const data = await request({
    url: '/auth/login/password',
    method: 'POST',
    data: { phone, password },
    auth: false
  })
  return afterAuth(data)
}

/** 退出登录。后端是无状态 JWT，没有退出接口，清掉本地 token 即可 */
export function logout() {
  clearToken()
}

/**
 * 当前用户。consent：0 未确认，1 已同意，2 已撤回
 * @returns {{ needConsent: boolean, consent: number }}
 */
export async function getMe() {
  const data = await request({ url: '/user/me' })
  return { needConsent: !!data.need_consent, consent: data.user ? data.user.consent : 0 }
}

/**
 * 提交知情同意（流程 2）
 * @param {boolean} agree true 同意，false 撤回
 */
export async function submitConsent(agree) {
  const data = await request({
    url: '/user/consent',
    method: 'POST',
    data: { consent: agree ? 1 : 2 }
  })
  return { needConsent: !!data.need_consent }
}

/* ============================================================
 * 孩子画像（流程 2）
 * ========================================================== */

/** 读取画像，没有时返回 null */
export async function getProfile() {
  const data = await request({ url: '/user/child' })
  return toProfile(data.child)
}

/** 保存画像（创建或全量更新） */
export async function saveProfile(profile) {
  const data = await request({ url: '/user/child', method: 'PUT', data: fromProfile(profile) })
  return toProfile(data.child)
}

/* ============================================================
 * 情境（流程 3）
 * ========================================================== */

/** 情境列表（不需要登录） */
export async function getScenarioList() {
  const data = await request({ url: '/scenarios', auth: false })
  return (data.scenarios || []).map(toScenario)
}

/** 情境详情（需要登录），含每一轮的问题与词块 */
export async function getScenarioDetail(id) {
  const data = await request({ url: `/scenarios/${encodeURIComponent(id)}` })
  return toScenario(data)
}

/* ============================================================
 * 训练会话（流程 3 / 4 / 5 / 10）
 * ========================================================== */

/**
 * 开始训练，返回第一轮的问题
 * @returns 前端一轮结果（toTurn），额外带 scenarioTitle / goal
 */
export async function startSession(scenarioId) {
  const data = await request({
    url: '/training/sessions',
    method: 'POST',
    data: { scenario_id: scenarioId }
  })
  return { ...toTurn(data), scenarioTitle: data.scenario_name, goal: data.goal }
}

/**
 * 提交孩子的一次回答。
 * 后端只收文字（最长 255 字）；text 为空字符串表示孩子没说话（后端判为 silence）。
 * 重试、给词块、请家长、下一轮、结束，全部由后端决定，看返回的 nextAction。
 *
 * requestKey 作为 Idempotency-Key 发给后端：同一个 key 重复提交时，
 * 后端直接返回第一次的结果，不会把一次回答记成两次。
 * 网络断了重发同一个回答时要传同一个 key。
 */
export async function submitAnswer(sessionId, text, requestKey, asrConfidence) {
  const body = { text: text || '' }
  // 只有语音作答才带置信度；点选/打字不带，后端按原逻辑判断。
  // 置信度低于 0.6 时后端不评判，直接请孩子再说一遍。
  if (typeof asrConfidence === 'number') body.asr_confidence = asrConfidence
  const data = await request({
    url: `/training/sessions/${sessionId}/answers`,
    method: 'POST',
    data: body,
    header: requestKey ? { 'Idempotency-Key': requestKey } : {}
  })
  return toTurn(data)
}

/**
 * 语音转文字（POST /speech/transcriptions）。只转写，不记训练、不推进轮次。
 * 后端要求 16 kHz MP3、≤ 2.25 MB、≤ 60 秒；录音模块已经按这个格式产出。
 * @param {Blob|string} audio 网页是 Blob，小程序是临时文件路径
 * @returns {{ text: string, confidence: number|null }} text 为空表示没听出文字
 */
export async function transcribe(audio) {
  const data = await upload('/speech/transcriptions', audio)
  return {
    text: data.text || '',
    confidence: typeof data.asr_confidence === 'number' ? data.asr_confidence : null
  }
}

/** 主动退出或中止，reason 为自由文本（见 EXIT_REASON） */
export async function abortSession(sessionId, reason) {
  await request({
    url: `/training/sessions/${sessionId}/abort`,
    method: 'POST',
    data: { reason: reason || '' }
  })
}

/**
 * 训练详情（会话 + 每一次作答记录）
 *
 * 后端 turns 是「每一次作答」一条，同一轮重试几次就有几条（attempt 递增）。
 * 这里按轮次分组，页面按「第几轮 → 这一轮试了几次」展示。
 */
export async function getSessionDetail(sessionId) {
  const data = await request({ url: `/training/sessions/${sessionId}` })
  const s = data.session || {}

  const rounds = []
  ;(data.turns || []).forEach((t) => {
    let group = rounds.find((r) => r.round === t.round_no)
    if (!group) {
      group = { round: t.round_no, question: t.ai_question, attempts: [] }
      rounds.push(group)
    }
    group.attempts.push({
      attempt: t.attempt,
      childText: t.child_text || '',
      validity: t.validity,
      feedback: t.child_feedback,
      nextAction: t.next_action,
      targetSentence: t.target_sentence || '',
      parentTip: t.parent_tip || '',
      riskFlag: !!t.risk_flag
    })
  })
  rounds.sort((a, b) => a.round - b.round)
  rounds.forEach((r) => r.attempts.sort((a, b) => a.attempt - b.attempt))

  return {
    id: s.id,
    scenarioId: s.scenario_id,
    status: s.status,
    totalRounds: s.total_rounds,
    independentCount: s.independent_count || 0,
    hintCount: s.hint_count || 0,
    parentAssistCount: s.parent_assist_count || 0,
    skipCount: s.skip_count || 0,
    summary: s.summary || '',
    exitReason: s.exit_reason || '',
    startedAt: s.started_at,
    endedAt: s.ended_at,
    rounds
  }
}

/* ============================================================
 * 任务卡（流程 9）
 * 任务卡由后端在训练结束时自动生成，随最后一次 answers 的响应一起返回，
 * 没有单独的"生成任务卡"接口。
 * ========================================================== */

/** 最近 10 张任务卡，按时间倒序 */
export async function getTaskCardList() {
  const data = await request({ url: '/task-cards' })
  return (data.task_cards || []).map(toTaskCard)
}

/**
 * 回填完成情况
 * @param {number} cardId
 * @param {number} feedback 1~5，见 TASK_FEEDBACK_OPTIONS
 * @param {string} [note]  最多 500 字
 */
export async function backfillTaskCard(cardId, feedback, note = '') {
  const data = await request({
    url: `/task-cards/${cardId}/backfill`,
    method: 'POST',
    data: { feedback, note }
  })
  return toTaskCard(data)
}
