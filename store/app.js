import { defineStore } from 'pinia'
import { STORAGE_KEYS, VOICE_INPUT_ENABLED } from '@/config/constants'
import * as api from '@/core/api'
import * as recorder from '@/core/audio/recorder'

/**
 * 全局 App 状态：知情同意、孩子画像、设备权限、引导进度
 *
 * 知情同意和画像以后端为准，本地不再缓存一份（之前存在 storage 里，
 * 换设备或清缓存就和后端对不上）。引导进度只是本机的界面状态，仍存本地。
 *
 * 合规要点（项目书 5.6）：
 *   后端不会按同意状态拦截任何接口，所以拦截必须由前端做 ——
 *   consentConfirmed 为 false 时，不得进入儿童模式、不得提交画像和训练。
 */
export const useAppStore = defineStore('app', {
  state: () => ({
    /* ---- 是否已从后端拉过一次 ---- */
    synced: false,

    /* ---- 引导流（本机） ---- */
    onboardingDone: false,
    onboardingStep: '',

    /* ---- 知情同意（后端 consent：0 未确认 / 1 已同意 / 2 已撤回） ---- */
    consentConfirmed: false,

    /* ---- 孩子画像（后端） ---- */
    profile: null,

    /* ---- 设备权限 ---- */
    micGranted: false,
    speakerOk: false,
    audioTestDone: false,
    /** 网页里不能录音的原因（如没有 https），为空表示可以录 */
    voiceUnavailableReason: '',
    /** 本次打开期间家长手动切到了点选（比如环境太吵） */
    preferText: false
  }),

  getters: {
    /** 能否进入儿童模式：必须已同意且已有画像 */
    canEnterChildMode: (state) => state.consentConfirmed && !!state.profile,

    /**
     * 训练页是否用点选/文字作答。
     * 关了语音、家长选了点选、或者设备录不了音时都为 true。
     * 小程序看设备检查结果；网页没有设备检查这一步，看 checkVoiceSupport 的结果。
     */
    textMode: (state) => {
      if (!VOICE_INPUT_ENABLED || state.preferText) return true
      // #ifdef H5
      return !!state.voiceUnavailableReason
      // #endif
      // #ifndef H5
      return !state.micGranted
      // #endif
    }
  },

  actions: {
    /** 读本机的引导进度（App onLaunch 调用，同步、不发请求） */
    restoreLocal() {
      try {
        const onboarding = uni.getStorageSync(STORAGE_KEYS.ONBOARDING)
        if (onboarding) {
          this.onboardingDone = !!onboarding.done
          this.onboardingStep = onboarding.step || ''
        }
      } catch (e) {
        console.warn('[app] 读取引导进度失败', e)
      }
    },

    /**
     * 从后端同步同意状态与画像。
     * 登录在 request 层自动完成，这里不用管。
     * 失败时抛错，由调用页决定提示方式。
     */
    async syncFromServer() {
      const me = await api.getMe()
      this.consentConfirmed = me.consent === 1
      // 未同意时不拉画像（不读取儿童数据）
      this.profile = this.consentConfirmed ? await api.getProfile() : null
      this.synced = true
      // 后端已有同意和画像，说明在别的设备或之前完成过引导
      if (this.consentConfirmed && this.profile && !this.onboardingDone) {
        this.finishOnboarding()
      }
      return { consentConfirmed: this.consentConfirmed, profile: this.profile }
    },

    /** 记录引导流进度，支持中途退出后继续 */
    setOnboardingStep(step) {
      this.onboardingStep = step
      try {
        uni.setStorageSync(STORAGE_KEYS.ONBOARDING, { done: false, step })
      } catch (e) {
        console.warn('[app] 保存引导进度失败', e)
      }
    },

    finishOnboarding() {
      this.onboardingDone = true
      this.onboardingStep = ''
      try {
        uni.setStorageSync(STORAGE_KEYS.ONBOARDING, { done: true, step: '' })
      } catch (e) {
        console.warn('[app] 保存引导完成状态失败', e)
      }
    },

    /**
     * 提交知情同意（流程 2）。
     * @param {boolean} agree true 同意，false 撤回
     */
    async setConsent(agree) {
      await api.submitConsent(agree)
      this.consentConfirmed = agree
      if (!agree) {
        // 撤回后前端不再持有儿童数据。
        // 后端目前没有删除画像的接口，服务端数据的删除需要后端补。
        this.profile = null
        this.onboardingDone = false
        try {
          uni.removeStorageSync(STORAGE_KEYS.ONBOARDING)
          uni.removeStorageSync(STORAGE_KEYS.TASK_FEEDBACK_CACHE)
        } catch (e) {
          /* ignore */
        }
      }
    },

    /** 保存画像到后端 */
    async saveProfile(profile) {
      if (!this.consentConfirmed) {
        throw new Error('未确认知情同意，不能保存孩子信息')
      }
      this.profile = await api.saveProfile(profile)
      return this.profile
    },

    /**
     * 换账号（登录、注册、退出）时清掉本机上属于上一个账号的东西。
     * 网页版可能是几个家庭共用一台电脑，引导进度和没传上去的回填不能串到别人账号里。
     */
    resetForAccountChange() {
      try {
        uni.removeStorageSync(STORAGE_KEYS.ONBOARDING)
        uni.removeStorageSync(STORAGE_KEYS.TASK_FEEDBACK_CACHE)
      } catch (e) {
        /* ignore */
      }
      this.$reset()
    },

    /** 更新设备测试结果 */
    setAudioTest({ micGranted, speakerOk }) {
      this.micGranted = !!micGranted
      this.speakerOk = !!speakerOk
      this.audioTestDone = true
    },

    /** 网页：检查能不能录音（https、浏览器支持），训练页进入时调用 */
    async checkVoiceSupport() {
      // #ifdef H5
      const s = await recorder.getSupport()
      this.voiceUnavailableReason = s.ok ? '' : s.reason
      // #endif
      return !this.textMode
    },

    /** 录音时浏览器拒绝了麦克风：本次打开不再弹录音按钮 */
    markVoiceDenied(reason) {
      this.voiceUnavailableReason = reason || '没有拿到麦克风权限'
      this.micGranted = false
    },

    setPreferText(v) {
      this.preferText = !!v
    }
  }
})
