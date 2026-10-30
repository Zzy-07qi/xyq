<script setup>
/**
 * 训练记录详情（家长端）
 *
 * 对应后端 GET /training/sessions/:id。
 * 入口：任务卡列表 / 回填页，每张任务卡都带着它来自哪次训练（sessionId）。
 * 后端没有「训练列表」接口，所以只能从任务卡进来。
 *
 * 展示原则同全局：只陈述孩子说了什么、得到什么回应，不出现「错误」「失败」类评价。
 * validity 这类内部判断结果不直接给家长看，翻译成中性的说法。
 */
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import * as api from '@/core/api'
import { errorMessage } from '@/core/request'
import { EXIT_REASON_LABEL, SESSION_STATUS } from '@/config/constants'

const sessionId = ref(0)
const detail = ref(null)
const scenarioTitle = ref('')
const loading = ref(true)
const loadError = ref('')

onLoad((options) => {
  sessionId.value = Number(options && options.id) || 0
  load()
})

async function load() {
  if (!sessionId.value) {
    loading.value = false
    loadError.value = '没有找到这次训练'
    return
  }
  loading.value = true
  loadError.value = ''
  try {
    detail.value = await api.getSessionDetail(sessionId.value)
    // 详情只给情境 id，名称从情境列表里取；取不到就不显示，不影响主体
    try {
      const list = await api.getScenarioList()
      const s = list.find((x) => x.id === detail.value.scenarioId)
      scenarioTitle.value = s ? s.title : ''
    } catch (e) {
      scenarioTitle.value = ''
    }
  } catch (err) {
    loadError.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

/* ---------- 展示用的翻译 ---------- */

/** 本次训练的状态，用中性措辞 */
const statusText = computed(() => {
  if (!detail.value) return ''
  switch (detail.value.status) {
    case SESSION_STATUS.FINISHED:
      return '完整做完了'
    case SESSION_STATUS.ABORTED:
      return EXIT_REASON_LABEL[detail.value.exitReason]
        ? `中途停下（${EXIT_REASON_LABEL[detail.value.exitReason]}）`
        : '中途停下了'
    default:
      return '还没做完'
  }
})

/** 开始时间：只显示月日时分 */
const startedText = computed(() => {
  const t = detail.value && detail.value.startedAt
  if (!t) return ''
  const d = new Date(t)
  if (isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 ${pad(d.getHours())}:${pad(d.getMinutes())}`
})

const stats = computed(() => {
  const d = detail.value
  if (!d) return []
  return [
    { label: '自己说出来的', value: d.independentCount, tone: 'gold' },
    { label: '看了词块后说的', value: d.hintCount, tone: 'leaf' },
    { label: '家长帮忙的', value: d.parentAssistCount, tone: 'blue' },
    { label: '跳过的', value: d.skipCount, tone: 'plain' }
  ]
})

/**
 * 一次作答的说明，给家长看的。
 * 不说「答错」，只说这一次之后发生了什么。
 */
function attemptNote(a) {
  if (a.riskFlag) return '这里停下来了，请留意孩子当时的状态'
  if (!a.childText) return '这一次没有说话'
  switch (a.nextAction) {
    case 'retry':
      return '请他再说了一遍'
    case 'show_hint':
      return '给他看了词块'
    case 'parent_assist':
      return '请家长帮了一下'
    case 'next_turn':
    case 'finish':
      if (a.validity === 'valid') return '说清楚了'
      if (a.validity === 'refused') return '他选择不说，我们尊重他'
      return '这一题先到这里'
    default:
      return ''
  }
}

/** 一次作答的圆点颜色 */
function attemptTone(a) {
  if (a.riskFlag) return 'abort'
  if (a.validity === 'valid') return 'gold'
  if (a.validity === 'partial') return 'leaf'
  return 'plain'
}
</script>

<template>
  <view class="page page--parent">
    <x-empty v-if="loading" type="loading" />

    <x-empty
      v-else-if="loadError"
      type="offline"
      :title="loadError"
      :retry="true"
      @retry="load"
    />

    <template v-else-if="detail">
      <!-- ============ 概览 ============ -->
      <view class="sd__head card">
        <text class="sd__title">{{ scenarioTitle || '一次训练' }}</text>
        <view class="sd__meta">
          <text v-if="startedText" class="sd__meta-text">{{ startedText }}</text>
          <text class="sd__meta-text">{{ statusText }}</text>
        </view>

        <view class="sd__stats">
          <view v-for="s in stats" :key="s.label" class="sd__stat">
            <text class="sd__stat-num" :class="`sd__stat-num--${s.tone}`">{{ s.value }}</text>
            <text class="sd__stat-label">{{ s.label }}</text>
          </view>
        </view>

        <text v-if="detail.summary" class="sd__summary">{{ detail.summary }}</text>
      </view>

      <!-- ============ 每一轮 ============ -->
      <view v-if="detail.rounds.length" class="sd__rounds">
        <view v-for="r in detail.rounds" :key="r.round" class="sd__round card">
          <view class="sd__round-head">
            <view class="tag">
              <text>第 {{ r.round }} 轮</text>
            </view>
            <text v-if="r.attempts.length > 1" class="sd__round-count">
              试了 {{ r.attempts.length }} 次
            </text>
          </view>

          <text class="sd__question">{{ r.question }}</text>

          <view
            v-for="a in r.attempts"
            :key="a.attempt"
            class="sd__attempt"
          >
            <view class="sd__dot" :class="`sd__dot--${attemptTone(a)}`" />
            <view class="sd__attempt-main">
              <text class="sd__child">
                {{ a.childText ? `「${a.childText}」` : '（没有说话）' }}
              </text>
              <text class="sd__note">{{ attemptNote(a) }}</text>
              <text v-if="a.feedback" class="sd__feedback">回应：{{ a.feedback }}</text>
            </view>
          </view>
        </view>
      </view>

      <x-empty
        v-else
        type="empty"
        title="这次还没有作答记录"
        desc="可能刚开始就停下了"
      />

      <view class="sd__foot">
        <text class="sd__foot-text">
          这里只记录说了什么、得到了什么回应，不代表能力评估。
        </text>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
/* ---------- 概览 ---------- */
.sd__head {
  margin-top: $sp-3;
}

.sd__title {
  display: block;
  font-size: $fs-h2;
  font-weight: 600;
  color: $c-text;
}

.sd__meta {
  margin-top: $sp-2;
  display: flex;
  flex-wrap: wrap;
  gap: $sp-3;
}

.sd__meta-text {
  font-size: $fs-sub;
  color: $c-text-sub;
}

.sd__stats {
  margin-top: $sp-4;
  display: flex;
  gap: $sp-2;
}

.sd__stat {
  flex: 1;
  padding: $sp-3 0;
  border-radius: $r-md;
  background: $c-page;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
}

.sd__stat-num {
  font-size: 48rpx;
  font-weight: 700;
  line-height: 1.1;
  color: $c-text-sub;

  &--gold {
    color: #c99a1a;
  }

  &--leaf {
    color: #7a9a1f;
  }

  &--blue {
    color: $c-primary;
  }
}

.sd__stat-label {
  font-size: 22rpx;
  color: $c-text-sub;
  text-align: center;
  line-height: 1.4;
}

.sd__summary {
  display: block;
  margin-top: $sp-3;
  font-size: $fs-sub;
  color: $c-text-sub;
  line-height: 1.7;
}

/* ---------- 每一轮 ---------- */
.sd__rounds {
  margin-top: $sp-3;
}

.sd__round {
  margin-bottom: $sp-3;
}

.sd__round-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sd__round-count {
  font-size: $fs-cap;
  color: $c-text-weak;
}

.sd__question {
  display: block;
  margin-top: $sp-2;
  margin-bottom: $sp-2;
  font-size: $fs-body;
  font-weight: 500;
  color: $c-primary-deep;
  line-height: 1.6;
}

.sd__attempt {
  display: flex;
  gap: $sp-3;
  align-items: flex-start;
  padding: $sp-2 0;

  & + & {
    border-top: 2rpx solid $c-line;
  }
}

.sd__dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  margin-top: 16rpx;
  flex-shrink: 0;
  background: $c-line;

  &--gold {
    background: $c-sun;
  }

  &--leaf {
    background: $c-leaf;
  }

  &--abort {
    background: $c-abort;
  }
}

.sd__attempt-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.sd__child {
  font-size: $fs-body;
  color: $c-text;
  line-height: 1.6;
}

.sd__note {
  font-size: $fs-cap;
  color: $c-text-sub;
}

.sd__feedback {
  font-size: $fs-cap;
  color: $c-text-weak;
  line-height: 1.6;
}

.sd__foot {
  margin: $sp-4 0;
  text-align: center;
}

.sd__foot-text {
  font-size: $fs-cap;
  color: $c-text-weak;
}
</style>
