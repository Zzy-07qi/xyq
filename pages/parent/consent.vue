<script setup>
/**
 * 监护确认页（项目书 流程 2，表 3-1）
 *
 * 合规要点（项目书 5.6 / 9.4）：
 *  - 同意结果须留痕上报
 *  - 不同意时不得继续采集任何儿童数据
 *  - 因此"不同意"必须是一个真实可用的出口，而不是逼用户点同意
 *
 * 文案上不用法律术语堆砌，但把关键事实讲清楚：
 * 收什么、干什么用、存多久、怎么撤回。
 */
import { ref, computed } from 'vue'
import { useAppStore } from '@/store/app'
import { errorMessage } from '@/core/request'

const appStore = useAppStore()

/** 必须滚到底才能点同意 —— 保证说明被真正看到过一次 */
const scrolled = ref(false)
const agreed = ref(false)
const submitting = ref(false)

const canSubmit = computed(() => agreed.value)

/**
 * 进页面时是否已经同意过。
 * 只在进入时取一次：如果在本页同意后状态变了，不该瞬间切成只读。
 */
const alreadyConsented = ref(appStore.consentConfirmed)

function onScroll(e) {
  // 距底部 40px 以内视为读完
  const { scrollTop, scrollHeight, clientHeight } = e.detail
  if (scrollHeight - scrollTop - clientHeight < 40) {
    scrolled.value = true
  }
}

/** 采集项清单：逐条列明，便于监护人判断 */
const DATA_ITEMS = [
  {
    key: 'nickname',
    title: '怎么称呼孩子',
    why: '填小名或昵称就行，只用来在界面上称呼他，不需要真实姓名'
  },
  {
    key: 'age',
    title: '孩子的年龄段',
    why: '不同年龄能说出的句子长度不一样，我们据此调整难度'
  },
  {
    key: 'language',
    title: '目前大概的语言水平',
    why: '决定一开始给几个字的句子，避免太难或太简单'
  },
  {
    key: 'interest',
    title: '孩子喜欢什么',
    why: '把训练里的例子换成他熟悉的东西，他会更愿意开口'
  },
  {
    key: 'preference',
    title: '你希望怎么提示他',
    why: '有的孩子受不了被催，有的需要多等一会儿，这个由你定'
  },
  {
    key: 'answers',
    title: '训练中孩子说的话',
    why: '以文字形式记录，用来判断这一轮说得怎么样、生成家庭任务卡'
  },
  {
    key: 'voice',
    title: '孩子回答时的录音',
    why: '用语音回答时，录音会发给腾讯云语音识别转成文字，转完就丢弃，我们不保存录音。不想用语音的话，训练时可以改成点选。'
  }
]

const NOT_COLLECT = [
  '不采集孩子的面部影像',
  '不采集真实姓名、学校、住址等身份信息',
  '不保存录音，只保存转成的文字',
  '不做任何形式的能力评分或诊断',
  '除语音转文字外，不向其他第三方提供，不用于广告'
]

/**
 * 同意：必须后端确认留痕成功才往下走。
 * 合规要求同意结果留痕（项目书 5.6），所以这里失败就停住，不做「本地先放行」。
 */
async function handleAgree() {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  try {
    await appStore.setConsent(true)
    appStore.setOnboardingStep('profile')
    uni.redirectTo({ url: '/pages/parent/profile' })
  } catch (err) {
    uni.showToast({ title: errorMessage(err), icon: 'none' })
  } finally {
    submitting.value = false
  }
}

/** 不同意：明确给出口，并说明后果 */
function handleDecline() {
  uni.showModal({
    title: '先不用也没关系',
    content: '不同意的话，我们不会保存孩子的任何信息。你可以随时回来重新选择。',
    confirmText: '退出',
    cancelText: '再想想',
    success: async (res) => {
      if (!res.confirm) return
      // 如果之前同意过，这里会向后端提交撤回；后端不通时也照样退出，不卡住家长
      if (appStore.consentConfirmed) {
        try {
          await appStore.setConsent(false)
        } catch (e) {
          console.warn('[consent] 撤回提交失败', e)
        }
      }
      uni.showToast({ title: '已退出，没有保存任何信息', icon: 'none' })
      setTimeout(() => {
        uni.reLaunch({ url: '/pages/parent/onboarding' })
      }, 1200)
    }
  })
}

/** 稍后再决定 */
function handleLater() {
  uni.navigateBack({
    fail: () => {
      uni.reLaunch({ url: '/pages/parent/onboarding' })
    }
  })
}
</script>

<template>
  <view class="consent">
    <scroll-view class="consent__scroll" scroll-y :scroll-top="0" @scroll="onScroll">
      <view class="consent__inner">
        <text class="t-h1">开始之前，想先和你说明白</text>
        <text class="consent__lead">
          这件事关系到一个孩子的信息，所以在你点下同意之前，我希望你知道我们要用哪些、用来做什么。
        </text>

        <!-- 采集项 -->
        <view class="consent__section">
          <text class="consent__section-title">我们会用到的信息</text>
          <view
            v-for="item in DATA_ITEMS"
            :key="item.key"
            class="consent__item"
          >
            <view class="consent__item-dot" />
            <view class="consent__item-main">
              <text class="consent__item-title">{{ item.title }}</text>
              <text class="consent__item-why">{{ item.why }}</text>
            </view>
          </view>
        </view>

        <!-- 明确不采集 -->
        <view class="consent__section consent__section--safe">
          <text class="consent__section-title">我们不会做的事</text>
          <view v-for="(t, i) in NOT_COLLECT" :key="i" class="consent__never">
            <text class="consent__never-icon">✓</text>
            <text class="consent__never-text">{{ t }}</text>
          </view>
        </view>

        <!-- 数据保管 -->
        <view class="consent__section">
          <text class="consent__section-title">关于孩子说的话</text>
          <text class="consent__p">
            我们只保存孩子回答的文字，用来判断这一轮说得怎么样、生成家庭任务卡。
            用语音回答时，录音会上传给腾讯云语音识别转成文字，转完即丢弃，我们不保存录音文件。
          </text>
          <text class="consent__p">
            你可以随时撤回同意，撤回后我们会停止使用这些信息。
            如需删除已保存的记录，请联系我们处理。
          </text>
        </view>

        <!-- 这不是诊断 -->
        <view class="consent__section">
          <text class="consent__section-title">这个产品不能替代什么</text>
          <text class="consent__p">
            它不能替代专业的康复评估和干预训练，也不会给出任何诊断结论。
            它做的事情很有限：给孩子一个低压力的机会，练习把想说的话说出来。
          </text>
        </view>

        <view class="consent__bottom-pad" />
      </view>
    </scroll-view>

    <!-- 已同意过：从「隐私与授权」进来重看，只读 -->
    <view v-if="alreadyConsented" class="consent__footer safe-bottom">
      <text class="consent__readonly">你已经同意过这份说明。想撤回的话，在「隐私与授权」里操作。</text>
      <view class="btn btn--ghost btn--block" @tap="handleLater">
        <text>返回</text>
      </view>
    </view>

    <!-- 底部操作区 -->
    <view v-else class="consent__footer safe-bottom">
      <view class="consent__check" @tap="agreed = !agreed">
        <view class="consent__check-box" :class="{ 'consent__check-box--on': agreed }">
          <text v-if="agreed" class="consent__check-icon">✓</text>
        </view>
        <text class="consent__check-text">
          我是孩子的法定监护人，已阅读并同意上述说明
        </text>
      </view>

      <view
        class="btn btn--primary btn--block"
        :class="{ 'btn--disabled': !canSubmit || submitting }"
        @tap="handleAgree"
      >
        <text>{{ submitting ? '正在保存' : '同意，继续' }}</text>
      </view>

      <view class="consent__footer-links">
        <text class="consent__link" @tap="handleLater">稍后再决定</text>
        <text class="consent__link-sep">·</text>
        <text class="consent__link" @tap="handleDecline">不同意</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.consent {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: $c-page;
}

.consent__scroll {
  flex: 1;
  height: 0;
}

.consent__inner {
  padding: $sp-4 $sp-4 0;
}

.consent__lead {
  display: block;
  margin-top: $sp-3;
  font-size: $fs-body;
  color: $c-text-sub;
  line-height: 1.8;
}

/* ---------- 分段 ---------- */
.consent__section {
  margin-top: $sp-5;
  background: #fff;
  border-radius: $r-lg;
  padding: $sp-4;
  box-shadow: $sh-card;

  &--safe {
    background: $c-safe-soft;
    box-shadow: none;
  }
}

.consent__section-title {
  display: block;
  font-size: $fs-h3;
  font-weight: 600;
  color: $c-text;
  margin-bottom: $sp-3;
}

.consent__p {
  display: block;
  font-size: $fs-sub;
  color: $c-text-sub;
  line-height: 1.8;

  & + & {
    margin-top: $sp-2;
  }
}

/* ---------- 采集项 ---------- */
.consent__item {
  display: flex;
  gap: $sp-3;
  align-items: flex-start;

  & + & {
    margin-top: $sp-3;
    padding-top: $sp-3;
    border-top: 2rpx solid $c-line;
  }
}

.consent__item-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: $c-primary;
  margin-top: 14rpx;
  flex-shrink: 0;
}

.consent__item-main {
  flex: 1;
}

.consent__item-title {
  display: block;
  font-size: $fs-body;
  font-weight: 500;
  color: $c-text;
}

.consent__item-why {
  display: block;
  margin-top: 6rpx;
  font-size: $fs-sub;
  color: $c-text-sub;
  line-height: 1.65;
}

/* ---------- 不做的事 ---------- */
.consent__never {
  display: flex;
  align-items: flex-start;
  gap: $sp-2;

  & + & {
    margin-top: $sp-2;
  }
}

.consent__never-icon {
  font-size: 28rpx;
  color: #3f8f6d;
  font-weight: 700;
  line-height: 1.7;
  flex-shrink: 0;
}

.consent__never-text {
  flex: 1;
  font-size: $fs-sub;
  color: #3f8f6d;
  line-height: 1.7;
}

.consent__bottom-pad {
  height: $sp-5;
}

/* ---------- 底部 ---------- */
.consent__footer {
  background: #fff;
  padding: $sp-3 $sp-4;
  border-top: 2rpx solid $c-line;
  box-shadow: 0 -8rpx 32rpx rgba(34, 48, 63, 0.04);
  display: flex;
  flex-direction: column;
  gap: $sp-3;
}

.consent__check {
  display: flex;
  align-items: flex-start;
  gap: $sp-2;
}

.consent__check-box {
  width: 44rpx;
  height: 44rpx;
  border-radius: $r-sm;
  border: 3rpx solid $c-primary-soft;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2rpx;
  transition: all $t-fast $ease-soft;

  &--on {
    background: $c-primary;
    border-color: $c-primary;
  }
}

.consent__check-icon {
  font-size: 28rpx;
  color: #fff;
  font-weight: 700;
  line-height: 1;
}

.consent__check-text {
  flex: 1;
  font-size: $fs-sub;
  color: $c-text-sub;
  line-height: 1.6;
}

.consent__readonly {
  font-size: $fs-sub;
  color: $c-text-sub;
  line-height: 1.7;
}

.consent__footer-links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $sp-2;
  padding-top: $sp-1;
}

.consent__link {
  font-size: $fs-sub;
  color: $c-text-weak;
  padding: $sp-1 $sp-2;
}

.consent__link-sep {
  color: $c-line;
}
</style>
