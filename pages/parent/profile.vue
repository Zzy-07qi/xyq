<script setup>
/**
 * 最小画像页（项目书 流程 2）
 *
 * 字段按 PRD：称呼、年龄、语言水平、兴趣、提示偏好、等待时间、停止信号。
 * 称呼和年龄是后端必填（name required、age 1~18），其余都有默认值。
 *
 * 后端这些字段都是自由文本，而且会原样交给判断模型参考，
 * 所以提交的是中文说法（"会说短句"），不是代码（"sentence"）。
 */
import { ref, reactive, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useAppStore } from '@/store/app'
import { errorMessage } from '@/core/request'

const appStore = useAppStore()

const form = reactive({
  name: '',
  age: 0,
  languageLevel: '',
  interests: [],
  hintPreference: '',
  waitSeconds: 5,
  stopSignal: ''
})

const submitting = ref(false)

/** 从家长首页进来是修改，引导流里进来是首次填写 */
const isEdit = ref(false)

onLoad(() => {
  const p = appStore.profile
  if (p) {
    isEdit.value = true
    Object.assign(form, {
      name: p.name || '',
      age: p.age || 0,
      languageLevel: p.languageLevel || '',
      interests: [...(p.interests || [])],
      hintPreference: p.hintPreference || '',
      waitSeconds: p.waitSeconds || 5,
      stopSignal: p.stopSignal || ''
    })
  }
})

/* ---------- 选项定义（value 即提交给后端的中文） ---------- */

const AGE_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => ({
  value: n,
  label: n === 12 ? '12+' : String(n)
}))

const LEVEL_OPTIONS = [
  { value: '会说单个词', label: '会说单个词', desc: '比如"水""要"' },
  { value: '会说两三个字', label: '会说两三个字', desc: '比如"要喝水"' },
  { value: '会说短句', label: '会说短句', desc: '比如"我想喝水"' },
  { value: '能来回聊几句', label: '能来回聊几句', desc: '' }
]

const INTEREST_OPTIONS = [
  { value: '积木', label: '积木', icon: '🧱' },
  { value: '车', label: '小汽车', icon: '🚗' },
  { value: '动物', label: '小动物', icon: '🐱' },
  { value: '户外', label: '户外玩', icon: '🌤️' },
  { value: '零食', label: '吃的', icon: '🍪' },
  { value: '音乐', label: '听音乐', icon: '🎵' },
  { value: '绘本', label: '看绘本', icon: '📖' },
  { value: '画画', label: '画画', icon: '🖍️' }
]

const HINT_OPTIONS = [
  { value: '轻声提醒', label: '轻声提醒就好', desc: '不要重复太多次' },
  { value: '图片优先', label: '给点看得见的提示', desc: '指一指图或者词卡' },
  { value: '先示范', label: '先示范一遍', desc: '我自己说一次给他听' },
  { value: '不勉强', label: '说不出来就算了', desc: '不要勉强，跳过就好' }
]

/**
 * 停止信号：孩子想停下来时会说的话。
 * 后端会在孩子每次的回答里找这句话（server/safety.go matchesStopSignal），
 * 找到就直接结束这次训练，所以这里只能填说出来的话，不能填动作。
 * 太短太常见的词（比如单独一个「不要」）会在正常回答里被误触发，选项里不放。
 */
const STOP_SIGNAL_OPTIONS = [
  { value: '不玩了', label: '「不玩了」' },
  { value: '我累了', label: '「我累了」' },
  { value: '我不想说', label: '「我不想说」' },
  { value: '停下来', label: '「停下来」' }
]

const WAIT_OPTIONS = [
  { value: 5, label: '5 秒', desc: '推荐' },
  { value: 8, label: '8 秒' },
  { value: 12, label: '12 秒', desc: '需要更多时间' }
]

/* ---------- 交互 ---------- */

function pickSingle(key, value) {
  form[key] = value
}

function toggleInterest(value) {
  const idx = form.interests.indexOf(value)
  if (idx >= 0) form.interests.splice(idx, 1)
  else if (form.interests.length < 3) form.interests.push(value)
  else uni.showToast({ title: '选三个就够啦', icon: 'none' })
}

/** 点已选中的再点一次就取消 */
function toggleStopSignal(value) {
  form.stopSignal = form.stopSignal === value ? '' : value
}

/** 当前停止信号是不是家长自己写的（不在预设选项里） */
const customStopSignal = computed(
  () => !!form.stopSignal && !STOP_SIGNAL_OPTIONS.some((o) => o.value === form.stopSignal)
)

/** 自定义停止信号：用系统弹窗输入，避免引入额外编辑器组件 */
function handleCustomSignal() {
  uni.showModal({
    title: '他想停下来时会说什么',
    editable: true,
    placeholderText: '比如：我要回家',
    success: (res) => {
      if (!res.confirm) return
      const v = (res.content || '').trim().replace(/^[「"']+|[」"']+$/g, '')
      if (!v) return
      // 后端上限 128 字；太短的词在正常回答里容易误触发
      if ([...v].length < 2) {
        uni.showToast({ title: '至少写两个字，不然容易误停', icon: 'none' })
        return
      }
      form.stopSignal = v.slice(0, 32)
    }
  })
}

const canSubmit = computed(() => {
  // 后端必填：称呼、年龄；语言水平决定起始难度，也要求选
  return !!form.name.trim() && form.age >= 1 && !!form.languageLevel
})

async function handleNext() {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true

  const profile = {
    name: form.name.trim(),
    age: form.age,
    languageLevel: form.languageLevel,
    interests: form.interests,
    hintPreference: form.hintPreference || '轻声提醒',
    waitSeconds: form.waitSeconds,
    // 不选就不设：随时都可以用屏幕上的暂停按钮停下来
    stopSignal: form.stopSignal,
    // 后端是全量覆盖，修改时要把这两个原值带回去，否则会被清空
    sensorySensitive: (appStore.profile && appStore.profile.sensorySensitive) || '',
    riskNote: (appStore.profile && appStore.profile.riskNote) || ''
  }

  try {
    await appStore.saveProfile(profile)
  } catch (err) {
    uni.showToast({ title: errorMessage(err), icon: 'none' })
    submitting.value = false
    return
  }
  submitting.value = false

  if (isEdit.value) {
    uni.showToast({ title: '保存好了', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 800)
    return
  }
  // #ifdef H5
  // 网页版目前只用点选/文字作答，用不到麦克风，跳过设备检查
  appStore.setOnboardingStep('notice')
  uni.navigateTo({ url: '/pages/parent/notice' })
  // #endif
  // #ifndef H5
  appStore.setOnboardingStep('permission')
  uni.navigateTo({ url: '/pages/parent/permission-test' })
  // #endif
}
</script>

<template>
  <view class="page page--parent">
    <view class="pf__head">
      <text class="t-h1">先认识一下孩子</text>
      <text class="pf__lead">
        这些信息只用来调整训练的难度和例子。填得越贴近他的日常，练习就越自然。
      </text>
      <text class="pf__required-tip">带 <text class="pf__star">*</text> 的三项需要填一下，其他都有默认值</text>
    </view>

    <!-- 称呼 -->
    <view class="card pf__card">
      <view class="pf__label-row">
        <text class="pf__label">怎么称呼孩子<text class="pf__star"> *</text></text>
        <text class="pf__why">小名或昵称就行</text>
      </view>
      <input
        v-model="form.name"
        class="pf__input"
        type="text"
        maxlength="12"
        placeholder="比如：豆豆"
        placeholder-class="pf__input-ph"
      />
      <text class="pf__hint">只用来在界面上称呼他，不需要真实姓名</text>
    </view>

    <!-- 年龄 -->
    <view class="card pf__card">
      <view class="pf__label-row">
        <text class="pf__label">孩子几岁了<text class="pf__star"> *</text></text>
        <text class="pf__why">年龄决定句子长度</text>
      </view>
      <view class="pf__chips pf__chips--wrap">
        <view
          v-for="opt in AGE_OPTIONS"
          :key="opt.value"
          class="pf__chip"
          :class="{ 'pf__chip--on': form.age === opt.value }"
          @tap="pickSingle('age', opt.value)"
        >
          <text class="pf__chip-text">{{ opt.label }}</text>
        </view>
      </view>
    </view>

    <!-- 语言水平 -->
    <view class="card pf__card">
      <view class="pf__label-row">
        <text class="pf__label">现在大概能说到什么程度<text class="pf__star"> *</text></text>
      </view>
      <text class="pf__hint">选最接近的那个就好，之后会跟着他的表现调整</text>
      <view class="pf__list">
        <view
          v-for="opt in LEVEL_OPTIONS"
          :key="opt.value"
          class="pf__row"
          :class="{ 'pf__row--on': form.languageLevel === opt.value }"
          @tap="pickSingle('languageLevel', opt.value)"
        >
          <view class="pf__row-main">
            <text class="pf__row-label">{{ opt.label }}</text>
            <text v-if="opt.desc" class="pf__row-desc">{{ opt.desc }}</text>
          </view>
          <view class="pf__radio" :class="{ 'pf__radio--on': form.languageLevel === opt.value }">
            <text v-if="form.languageLevel === opt.value" class="pf__radio-icon">✓</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 兴趣 -->
    <view class="card pf__card">
      <view class="pf__label-row">
        <text class="pf__label">他喜欢什么</text>
        <text class="pf__why">最多选三个</text>
      </view>
      <text class="pf__hint">训练里的例子会换成他熟悉的东西，他会更愿意开口</text>
      <view class="pf__grid">
        <view
          v-for="opt in INTEREST_OPTIONS"
          :key="opt.value"
          class="pf__grid-item"
          :class="{ 'pf__grid-item--on': form.interests.includes(opt.value) }"
          @tap="toggleInterest(opt.value)"
        >
          <text class="pf__grid-icon">{{ opt.icon }}</text>
          <text class="pf__grid-label">{{ opt.label }}</text>
        </view>
      </view>
    </view>

    <!-- 提示偏好 -->
    <view class="card pf__card">
      <view class="pf__label-row">
        <text class="pf__label">你希望怎么提示他</text>
      </view>
      <text class="pf__hint">卡住的时候，我们会按你的习惯来，不会突然一直催</text>
      <view class="pf__list">
        <view
          v-for="opt in HINT_OPTIONS"
          :key="opt.value"
          class="pf__row"
          :class="{ 'pf__row--on': form.hintPreference === opt.value }"
          @tap="pickSingle('hintPreference', opt.value)"
        >
          <view class="pf__row-main">
            <text class="pf__row-label">{{ opt.label }}</text>
            <text v-if="opt.desc" class="pf__row-desc">{{ opt.desc }}</text>
          </view>
          <view class="pf__radio" :class="{ 'pf__radio--on': form.hintPreference === opt.value }">
            <text v-if="form.hintPreference === opt.value" class="pf__radio-icon">✓</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 等待时间 -->
    <view class="card pf__card">
      <view class="pf__label-row">
        <text class="pf__label">问完之后等多久</text>
        <text class="pf__why">默认 5 秒</text>
      </view>
      <text class="pf__hint">有些孩子需要多等一会儿，急着催反而会让他放弃</text>
      <view class="pf__chips">
        <view
          v-for="opt in WAIT_OPTIONS"
          :key="opt.value"
          class="pf__chip"
          :class="{ 'pf__chip--on': form.waitSeconds === opt.value }"
          @tap="pickSingle('waitSeconds', opt.value)"
        >
          <text class="pf__chip-text">{{ opt.label }}</text>
          <text v-if="opt.desc" class="pf__chip-badge">{{ opt.desc }}</text>
        </view>
      </view>
    </view>

    <!-- 停止信号 -->
    <view class="card pf__card">
      <view class="pf__label-row">
        <text class="pf__label">他想停下来的时候，会说什么</text>
        <text class="pf__why">可以不选</text>
      </view>
      <text class="pf__hint">训练中他说出这句话，就直接停下来，不会勉强他。再点一次可以取消。</text>
      <view class="pf__chips pf__chips--wrap">
        <view
          v-for="opt in STOP_SIGNAL_OPTIONS"
          :key="opt.value"
          class="pf__chip"
          :class="{ 'pf__chip--on': form.stopSignal === opt.value }"
          @tap="toggleStopSignal(opt.value)"
        >
          <text class="pf__chip-text">{{ opt.label }}</text>
        </view>
      </view>
      <view class="pf__custom" @tap="handleCustomSignal">
        <text class="pf__custom-text">
          {{ customStopSignal ? `自己写的：「${form.stopSignal}」` : '他会说别的，我来写' }}
        </text>
      </view>
    </view>

    <view class="pf__pad" />

    <!-- 底部操作 -->
    <view class="pf__footer safe-bottom">
      <view
        class="btn btn--primary btn--block"
        :class="{ 'btn--disabled': !canSubmit || submitting }"
        @tap="handleNext"
      >
        <text>{{ submitting ? '正在保存' : '下一步' }}</text>
      </view>
      <text class="pf__footer-note">
        这些都可以在家长中心随时修改
      </text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.pf__head {
  padding: $sp-4 0 $sp-3;
}

.pf__lead {
  display: block;
  margin-top: $sp-3;
  font-size: $fs-body;
  color: $c-text-sub;
  line-height: 1.8;
}

.pf__required-tip {
  display: block;
  margin-top: $sp-3;
  font-size: $fs-cap;
  color: $c-text-weak;
}

.pf__star {
  color: $c-coral;
}

.pf__input {
  margin-top: $sp-3;
  height: $tap-min;
  padding: 0 $sp-3;
  border-radius: $r-md;
  background: $c-primary-mist;
  font-size: $fs-body;
  color: $c-text;
}

.pf__input-ph {
  color: $c-text-weak;
}

/* ---------- 卡片通用 ---------- */
.pf__card {
  margin-bottom: $sp-3;
}

.pf__label-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: $sp-2;
}

.pf__label {
  font-size: $fs-h3;
  font-weight: 600;
  color: $c-text;
}

.pf__why {
  font-size: $fs-cap;
  color: $c-text-weak;
  flex-shrink: 0;
}

.pf__hint {
  display: block;
  margin-top: $sp-2;
  font-size: $fs-sub;
  color: $c-text-sub;
  line-height: 1.65;
}

/* ---------- 胶囊选项 ---------- */
.pf__chips {
  display: flex;
  gap: $sp-2;
  margin-top: $sp-3;

  &--wrap {
    flex-wrap: wrap;
  }
}

.pf__chip {
  flex: 1;
  min-width: 160rpx;
  height: 88rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: $r-md;
  background: $c-primary-mist;
  border: 3rpx solid transparent;
  transition: all $t-fast $ease-soft;

  &--on {
    background: #fff;
    border-color: $c-primary;
  }
}

.pf__chip-text {
  font-size: $fs-sub;
  color: $c-text;
  font-weight: 500;
}

.pf__chip--on .pf__chip-text {
  color: $c-primary;
}

.pf__chip-badge {
  font-size: 20rpx;
  color: $c-text-weak;
  margin-top: 2rpx;
}

/* ---------- 列表选项 ---------- */
.pf__list {
  margin-top: $sp-3;
}

.pf__row {
  display: flex;
  align-items: center;
  gap: $sp-3;
  padding: $sp-3;
  border-radius: $r-md;
  background: $c-primary-mist;
  border: 3rpx solid transparent;
  transition: all $t-fast $ease-soft;

  & + & {
    margin-top: $sp-2;
  }

  &--on {
    background: #fff;
    border-color: $c-primary;
  }
}

.pf__row-main {
  flex: 1;
}

.pf__row-label {
  display: block;
  font-size: $fs-body;
  color: $c-text;
  font-weight: 500;
}

.pf__row-desc {
  display: block;
  margin-top: 4rpx;
  font-size: $fs-cap;
  color: $c-text-sub;
}

.pf__radio {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  border: 3rpx solid $c-primary-soft;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &--on {
    background: $c-primary;
    border-color: $c-primary;
  }
}

.pf__radio-icon {
  font-size: 24rpx;
  color: #fff;
  font-weight: 700;
  line-height: 1;
}

/* ---------- 兴趣宫格 ---------- */
.pf__grid {
  display: flex;
  flex-wrap: wrap;
  gap: $sp-2;
  margin-top: $sp-3;
}

.pf__grid-item {
  width: calc((100% - #{$sp-2} * 3) / 4);
  padding: $sp-3 0;
  border-radius: $r-md;
  background: $c-primary-mist;
  border: 3rpx solid transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  transition: all $t-fast $ease-soft;

  &--on {
    background: $c-leaf-soft;
    border-color: $c-leaf;
  }
}

.pf__grid-icon {
  font-size: 48rpx;
  line-height: 1;
}

.pf__grid-label {
  font-size: $fs-cap;
  color: $c-text-sub;
}

.pf__grid-item--on .pf__grid-label {
  color: $c-leaf-deep;
  font-weight: 500;
}

/* ---------- 自定义 ---------- */
.pf__custom {
  margin-top: $sp-3;
  padding: $sp-2 $sp-3;
  border-radius: $r-md;
  background: $c-page;
  align-self: flex-start;
}

.pf__custom-text {
  font-size: $fs-sub;
  color: $c-primary;
}

/* ---------- 底部 ---------- */
.pf__pad {
  height: 180rpx;
}

.pf__footer {
  position: fixed;
  left: var(--window-left, 0);
  right: var(--window-right, 0);
  bottom: 0;
  background: #fff;
  padding: $sp-3 $sp-4;
  border-top: 2rpx solid $c-line;
  box-shadow: 0 -8rpx 32rpx rgba(34, 48, 63, 0.05);
}

.pf__footer-note {
  display: block;
  margin-top: $sp-2;
  text-align: center;
  font-size: $fs-cap;
  color: $c-text-weak;
}
</style>
