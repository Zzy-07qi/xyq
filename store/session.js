import { defineStore } from 'pinia'
import {
  PHASE,
  NEXT_ACTION,
  HINT_LEVEL,
  SESSION_STATUS,
  EXIT_REASON
} from '@/config/constants'
import * as api from '@/core/api'

/**
 * 训练会话 store
 *
 * 之前：前端自己维护一套状态机，自己决定重试几次、什么时候给词卡、什么时候结束。
 * 现在：这些全由后端决定（server/dialogue.go 的 decideAction），
 *       前端每提交一次回答，按返回的 next_action 换界面就行。
 *
 * 后端的降级节奏（partial / unclear / off_topic 时）：
 *   第 1 次 → retry          请再说一遍
 *   第 2 次 → show_hint      显示词块
 *   第 3 次 → parent_assist  显示完整句，请家长帮忙
 *   第 4 次 → next_turn / finish
 * 答对或明确拒绝 → 直接 next_turn / finish
 * 沉默（空文本）→ 第 1 次 retry，第 2 次 next_turn / finish（记为跳过）
 */

/** 每次提交回答用的幂等键，后端限 128 字节 */
function newRequestKey() {
  return `ans-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** next_action → 提示层级（只用于界面展示） */
function hintLevelOf(action) {
  switch (action) {
    case NEXT_ACTION.RETRY:
      return HINT_LEVEL.L1
    case NEXT_ACTION.SHOW_HINT:
      return HINT_LEVEL.L2
    case NEXT_ACTION.PARENT_ASSIST:
      return HINT_LEVEL.L3
    default:
      return HINT_LEVEL.NONE
  }
}

export const useSessionStore = defineStore('session', {
  state: () => ({
    /* ---- 会话身份 ---- */
    sessionId: 0,
    scenario: null, // 前端情境对象（来自 api.getScenarioDetail）

    /* ---- 界面阶段 ---- */
    phase: PHASE.IDLE,
    /** 暂停：冻结音频与动画，不改 phase */
    paused: false,
    /** 正在等后端返回，用来禁用按钮防止重复提交 */
    busy: false,

    /* ---- 当前这一轮（以后端返回为准） ---- */
    round: 1,
    totalRounds: 0,
    question: '',
    wordBlocks: [],
    parentTip: '',
    /** 只在 show_hint / parent_assist 时后端才给 */
    targetSentence: '',

    /* ---- 最近一次判断 ---- */
    lastAnswer: '',
    /** 已发出但还没拿到结果的回答 { text, confidence, key }，断网重发时复用 key */
    pendingAnswer: null,
    /** 孩子说了停止信号，后端已结束本次训练 */
    stoppedByChild: false,
    validity: '',
    nextAction: '',
    feedback: '',
    hintLevel: HINT_LEVEL.NONE,
    retryCount: 0,

    /**
     * 反馈展示完以后要进入的下一题。
     * next_turn 时后端已经把下一轮的问题一起返回了，但要等孩子看完反馈再换题，
     * 所以先存在这里。
     */
    pendingTurn: null,

    /* ---- 结束 ---- */
    summary: '',
    taskCard: null,
    /** 本次训练里孩子在第一次就说对的轮次数，奖励页用 */
    independentRounds: 0,
    /** 用过提示（词块/家长）才完成的轮次数 */
    helpedRounds: 0,
    /** 跳过的轮次数 */
    skippedRounds: 0,

    /* ---- 中止 ---- */
    exitReason: '',
    /** 后端安全中止时给家长看的话 */
    safetyParentTip: '',
    safetyChildTip: ''
  }),

  getters: {
    /** 已经完成的轮数（进度星星用） */
    doneRounds(state) {
      if (state.phase === PHASE.FINISHED) return state.totalRounds
      return Math.max(0, state.round - 1)
    },

    isLastRound(state) {
      return state.round >= state.totalRounds
    },

    /** 当前是否在等孩子说话 */
    isListening(state) {
      return state.phase === PHASE.LISTENING
    },

    /** 是否显示词块 */
    showWordBlocks(state) {
      return state.phase === PHASE.LISTENING && state.hintLevel >= HINT_LEVEL.L2
    },

    /** 是否需要家长出手 */
    needsParent(state) {
      return state.hintLevel >= HINT_LEVEL.L3
    },

    /** 是否还在进行中（可以暂停/退出） */
    isActive(state) {
      return ![PHASE.IDLE, PHASE.FINISHED, PHASE.ABORTED, PHASE.SAFETY].includes(state.phase)
    }
  },

  actions: {
    /* ==========================================================
     * 开始
     * ======================================================== */

    /**
     * 选定情境、拿到详情（场景介绍页用）。还不创建后端会话 ——
     * 孩子可能看了介绍又退回去，不想留一个没开始的会话。
     */
    async prepare(scenarioId) {
      this.$reset()
      this.scenario = await api.getScenarioDetail(scenarioId)
      this.totalRounds = this.scenario.roundCount
      return this.scenario
    },

    /** 真正开始：创建后端会话，拿到第一题 */
    async start() {
      if (!this.scenario) throw new Error('还没有选择情境')
      this.busy = true
      try {
        const turn = await api.startSession(this.scenario.id)
        this.sessionId = turn.sessionId
        this.applyQuestion(turn)
        this.phase = PHASE.QUESTION
      } finally {
        this.busy = false
      }
    },

    /** 把后端返回的题目写进当前轮 */
    applyQuestion(turn) {
      this.round = turn.round
      this.totalRounds = turn.totalRounds
      this.question = turn.question
      this.wordBlocks = turn.wordBlocks
      this.parentTip = turn.parentTip
      this.targetSentence = ''
      this.hintLevel = HINT_LEVEL.NONE
      this.retryCount = 0
    },

    /** 题目读完，开始等孩子回答 */
    onQuestionPlayed() {
      if (this.phase === PHASE.QUESTION) this.phase = PHASE.LISTENING
    },

    /* ==========================================================
     * 作答
     * ======================================================== */

    /**
     * 提交一次回答
     * @param {string} text 孩子说的话；空字符串表示没说话
     * @param {number|null} [confidence] 语音识别置信度；点选/打字时不传
     * @returns 后端结果（toTurn），出错时抛 ApiError
     */
    async answer(text, confidence = null) {
      if (this.busy || !this.sessionId) return null
      const value = (text || '').slice(0, 255) // 后端上限 255 字
      this.busy = true
      this.phase = PHASE.SUBMITTING
      this.lastAnswer = value

      // 上一次同样的回答没收到结果（多半是断网）：沿用同一个 key，
      // 如果其实已经提交成功，后端会直接把那次的结果还回来。
      // 后端按「文字 + 置信度」判断是不是同一个回答，两者都要一样才复用。
      const same =
        this.pendingAnswer &&
        this.pendingAnswer.text === value &&
        this.pendingAnswer.confidence === confidence
      const key = same ? this.pendingAnswer.key : newRequestKey()
      this.pendingAnswer = { text: value, confidence, key }

      let turn
      try {
        turn = await api.submitAnswer(this.sessionId, value, key, confidence)
      } catch (err) {
        // 提交失败：回到等待作答，保留现场，让家长重试
        this.phase = PHASE.LISTENING
        this.busy = false
        throw err
      }
      this.pendingAnswer = null
      this.busy = false

      this.validity = turn.validity
      this.nextAction = turn.nextAction
      this.feedback = turn.feedback
      this.retryCount = turn.retryCount

      // 1. 后端检测到风险内容：会话已被后端中止
      if (turn.riskFlag) {
        this.phase = PHASE.SAFETY
        this.exitReason = EXIT_REASON.SAFETY
        this.safetyChildTip = turn.feedback
        this.safetyParentTip = turn.parentTip
        return turn
      }

      // 2. 孩子说出了画像里填的停止信号：后端已经结束这次训练（不是风险，不走安全页）。
      //    先展示后端给的那句「好的，我们先休息一下。」，点继续去温和的退出页。
      if (turn.status === SESSION_STATUS.ABORTED) {
        this.exitReason = EXIT_REASON.STOP_SIGNAL
        this.stoppedByChild = true
        this.parentTip = turn.parentTip || this.parentTip
        this.pendingTurn = null
        this.phase = PHASE.FEEDBACK
        return turn
      }

      // 3. 记一下这一轮的结果，奖励页的统计用
      if (turn.nextAction === NEXT_ACTION.NEXT_TURN || turn.nextAction === NEXT_ACTION.FINISH) {
        this.countRound(turn)
      }

      // 4. 训练结束：后端同时返回总结和任务卡
      if (turn.nextAction === NEXT_ACTION.FINISH || turn.status === SESSION_STATUS.FINISHED) {
        this.summary = turn.summary
        this.taskCard = turn.taskCard
        this.pendingTurn = null
        this.phase = PHASE.FEEDBACK
        return turn
      }

      // 5. 进入下一轮：先展示反馈，看完再换题
      if (turn.nextAction === NEXT_ACTION.NEXT_TURN) {
        this.pendingTurn = turn
        this.phase = PHASE.FEEDBACK
        return turn
      }

      // 6. 同一题再来：retry / show_hint / parent_assist
      this.pendingTurn = null
      this.hintLevel = hintLevelOf(turn.nextAction)
      if (turn.targetSentence) this.targetSentence = turn.targetSentence
      if (turn.wordBlocks.length) this.wordBlocks = turn.wordBlocks
      if (turn.parentTip) this.parentTip = turn.parentTip
      this.phase = PHASE.FEEDBACK
      return turn
    },

    /** 统计这一轮怎么完成的（和后端 countOutcome 口径一致） */
    countRound(turn) {
      const skipped = turn.validity === 'silence' || turn.validity === 'refused'
      if (skipped) {
        this.skippedRounds += 1
      } else if (turn.validity === 'valid' && this.hintLevel === HINT_LEVEL.NONE) {
        this.independentRounds += 1
      } else {
        this.helpedRounds += 1
      }
    },

    /**
     * 反馈看完了，继续。
     * @returns {'next'|'same'|'finished'|'stopped'} 下一步界面去向
     */
    continueAfterFeedback() {
      if (this.stoppedByChild) {
        this.phase = PHASE.ABORTED
        return 'stopped'
      }
      if (this.nextAction === NEXT_ACTION.FINISH) {
        this.phase = PHASE.FINISHED
        return 'finished'
      }
      if (this.pendingTurn) {
        this.applyQuestion(this.pendingTurn)
        this.pendingTurn = null
        this.phase = PHASE.QUESTION
        return 'next'
      }
      // 同一题：直接回到等待作答，不再重读题目
      this.phase = PHASE.LISTENING
      return 'same'
    },

    /**
     * 家长选择「这一轮跳过」。
     *
     * 后端没有跳过接口。提交空回答会被判为沉默：
     *   第一次沉默 → retry，第二次 → next_turn / finish，并记为跳过。
     * 所以这里最多连发两次空回答，直到后端换题或结束。
     * 如果这一轮已经在部分作答的降级中途，可能需要更多次，循环上限给 4。
     */
    async skipRound() {
      const startRound = this.round
      for (let i = 0; i < 4; i += 1) {
        const turn = await this.answer('')
        if (!turn) return
        if (
          this.phase === PHASE.SAFETY ||
          turn.nextAction === NEXT_ACTION.FINISH ||
          turn.round !== startRound ||
          turn.nextAction === NEXT_ACTION.NEXT_TURN
        ) {
          return turn
        }
      }
    },

    /* ==========================================================
     * 暂停 / 退出
     * ======================================================== */

    pause() {
      this.paused = true
    },

    resume() {
      this.paused = false
    },

    /**
     * 主动退出（家长或孩子）。不是安全中止 —— 安全中止由后端 risk_flag 触发，
     * 或家长明确选择「孩子不舒服」时走 abortForSafety。
     */
    async exit(reason = EXIT_REASON.USER_STOP) {
      this.exitReason = reason
      this.phase = PHASE.ABORTED
      if (this.sessionId) {
        try {
          await api.abortSession(this.sessionId, reason)
        } catch (e) {
          // 上报失败不阻止退出，页面照常离开
          console.warn('[session] 退出上报失败', e)
        }
      }
    },

    /** 家长判断孩子不舒服：走安全中止页 */
    async abortForSafety(reason = EXIT_REASON.CHILD_UNWELL) {
      this.exitReason = reason
      this.phase = PHASE.SAFETY
      if (this.sessionId) {
        try {
          await api.abortSession(this.sessionId, reason)
        } catch (e) {
          console.warn('[session] 中止上报失败', e)
        }
      }
    },

    reset() {
      this.$reset()
    }
  }
})
