<script setup>
/**
 * 情境选择页（项目书 流程 3 / 表 3-1）
 *
 * 儿童端的选择页有两条不同于常规列表设计的约束：
 *  1. 一屏能看到全部选项 —— 滚动本身就是一种认知负担
 *  2. 每个选项要有图、有颜色、有具体名词，不出现抽象描述
 *
 * 所以这里用两列大卡片，卡片上直接画场景，不用"点击查看详情"这种二次跳转。
 */
import { ref, onMounted } from 'vue'
import { useAppStore } from '@/store/app'
import { useSessionStore } from '@/store/session'
import * as api from '@/core/api'
import * as player from '@/core/audio/player'

const appStore = useAppStore()
const session = useSessionStore()

const scenarios = ref([])
const loading = ref(true)
const offline = ref(false)
const picking = ref(false)

/** 每个场景的插画是否可用（未提供图片时用 emoji + 配色降级） */
const imgOk = ref({})

onMounted(async () => {
  await load()
})

async function load() {
  loading.value = true
  offline.value = false
  try {
    const list = await api.getScenarioList()
    scenarios.value = Array.isArray(list) ? list : []
    const ok = {}
    scenarios.value.forEach((s) => {
      ok[s.id] = true
    })
    imgOk.value = ok
  } catch (e) {
    console.warn('[scenario-select] 加载失败', e)
    offline.value = true
  } finally {
    loading.value = false
  }
}

function onImgError(id) {
  imgOk.value = { ...imgOk.value, [id]: false }
}

/**
 * 选中情境 → 拉详情 → 进入场景介绍（流程 3）。
 * 这里还不创建后端会话，等孩子在介绍页点「开始」才创建。
 */
async function pick(scenario) {
  if (picking.value) return
  if (!appStore.canEnterChildMode) {
    uni.showToast({ title: '请家长先完成设置', icon: 'none' })
    return
  }
  picking.value = true
  player.playBeep()
  try {
    await session.prepare(scenario.id)
    uni.navigateTo({ url: '/pages/child/scenario-intro' })
  } catch (e) {
    uni.showToast({ title: '这个场景暂时打不开，换一个试试', icon: 'none' })
  } finally {
    picking.value = false
  }
}

/** 孩子想休息：还没开始训练，直接回儿童首页，不用走退出流程 */
function handleStop() {
  player.forceStop()
  uni.reLaunch({ url: '/pages/child/home' })
}

function goBack() {
  uni.navigateBack({
    fail: () => uni.reLaunch({ url: '/pages/child/home' })
  })
}
</script>

<template>
  <view class="sel page--child">
    <x-navbar title="" theme="child" :on-back="goBack">
      <template #right>
        <x-stop-signal @stop="handleStop" />
      </template>
    </x-navbar>

    <view class="sel__head">
      <text class="sel__title">想玩哪一个</text>
      <text class="sel__sub">选一个就好</text>
    </view>

    <x-empty v-if="loading" type="loading" />

    <x-empty
      v-else-if="offline"
      type="offline"
      :retry="true"
      retry-text="再看一次"
      @retry="load"
    />

    <x-empty v-else-if="!scenarios.length" type="empty" title="暂时还没有场景" />

    <!-- ============ 场景卡片 ============ -->
    <view v-else class="sel__grid">
      <view
        v-for="s in scenarios"
        :key="s.id"
        class="sel__card"
        :style="{ background: s.themeColor + '1f' }"
        @tap="pick(s)"
      >
        <!-- 场景插画 -->
        <view class="sel__cover">
          <image
            v-if="imgOk[s.id] && s.cover"
            class="sel__cover-img"
            :src="s.cover"
            mode="aspectFill"
            @error="onImgError(s.id)"
          />
          <view v-else class="sel__cover-fallback" :style="{ background: s.themeColor + '33' }">
            <text class="sel__cover-emoji">{{ s.emoji }}</text>
          </view>
        </view>

        <text class="sel__card-title">{{ s.title }}</text>

        <!-- 一句场景提示，帮助孩子建立预期 -->
        <text class="sel__card-scene">{{ s.sceneDesc }}</text>

        <view class="sel__card-go">
          <text class="sel__card-go-text">看看</text>
        </view>
      </view>
    </view>

    <view class="sel__pad" />
  </view>
</template>

<style lang="scss" scoped>
.sel {
  min-height: 100vh;
}

.sel__head {
  padding: $sp-3 $sp-4 $sp-4;
}

.sel__title {
  display: block;
  font-size: 56rpx;
  font-weight: 700;
  color: $c-primary-deep;
  letter-spacing: 2rpx;
}

.sel__sub {
  display: block;
  margin-top: $sp-2;
  font-size: $fs-child;
  color: $c-text-sub;
}

/* ================= 卡片 ================= */
.sel__grid {
  padding: 0 $sp-4;
  display: flex;
  flex-wrap: wrap;
  gap: $sp-3;
}

.sel__card {
  width: calc((100% - #{$sp-3}) / 2);
  border-radius: $r-lg;
  padding: $sp-3;
  display: flex;
  flex-direction: column;
  box-shadow: $sh-card;
  transition: transform $t-base $ease-soft;

  &:active {
    transform: scale(0.97);
  }
}

.sel__cover {
  width: 100%;
  height: 200rpx;
  border-radius: $r-md;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.6);
  margin-bottom: $sp-2;
}

.sel__cover-img {
  width: 100%;
  height: 100%;
}

.sel__cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sel__cover-emoji {
  font-size: 100rpx;
  line-height: 1;
}

.sel__card-title {
  display: block;
  font-size: 38rpx;
  font-weight: 700;
  color: $c-primary-deep;
  line-height: 1.4;
}

.sel__card-scene {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: $c-text-sub;
  line-height: 1.55;
  flex: 1;
}

.sel__card-go {
  margin-top: $sp-2;
  height: 64rpx;
  border-radius: $r-pill;
  background: rgba(255, 255, 255, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
}

.sel__card-go-text {
  font-size: $fs-sub;
  font-weight: 600;
  color: $c-primary;
}

.sel__pad {
  height: $sp-6;
}
</style>
