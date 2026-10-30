<script setup>
/**
 * 隐私与授权（家长端）
 *
 * 项目书 5.6 / 9.4：监护人可以随时撤回同意。
 * 撤回调用 POST /user/consent { consent: 2 }，之后前端不再进入儿童模式、不再提交任何孩子数据，
 * 回到启动页；想再用时重新走一遍同意流程即可。
 *
 * 要说实话的地方：后端目前没有删除画像和训练记录的接口，
 * 撤回只能「停止使用」，删除要人工处理。页面上照实写，不承诺做不到的事。
 */
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useAppStore } from '@/store/app'
import { useSessionStore } from '@/store/session'
import * as api from '@/core/api'
import { errorMessage, LOGIN_PAGE } from '@/core/request'

const appStore = useAppStore()
const session = useSessionStore()

const loading = ref(true)
const loadError = ref('')
const withdrawing = ref(false)

onShow(async () => {
  loading.value = true
  loadError.value = ''
  try {
    await appStore.syncFromServer()
  } catch (err) {
    loadError.value = errorMessage(err)
  } finally {
    loading.value = false
  }
})

const statusText = computed(() =>
  appStore.consentConfirmed ? '已同意' : '未同意或已撤回'
)

const profileName = computed(() => (appStore.profile && appStore.profile.name) || '')

function goConsent() {
  uni.navigateTo({ url: '/pages/parent/consent' })
}

function goProfile() {
  uni.navigateTo({ url: '/pages/parent/profile' })
}

/** 撤回要二次确认，并且把后果说清楚 */
function confirmWithdraw() {
  uni.showModal({
    title: '确定要撤回同意吗',
    content:
      '撤回后将停止使用孩子的信息，也不能再开始训练。已保存的记录如需删除，请联系我们处理。之后想继续用，重新同意一次就行。',
    confirmText: '撤回',
    cancelText: '再想想',
    success: (res) => {
      if (res.confirm) withdraw()
    }
  })
}

/** 网页版退出登录：共用电脑时用。只清本机，不影响后端数据 */
function confirmLogout() {
  uni.showModal({
    title: '退出登录',
    content: '退出后需要用手机号和密码重新登录，孩子的记录不会丢。',
    confirmText: '退出',
    cancelText: '取消',
    success: (res) => {
      if (!res.confirm) return
      api.logout()
      appStore.resetForAccountChange()
      session.reset()
      uni.reLaunch({ url: LOGIN_PAGE })
    }
  })
}

async function withdraw() {
  if (withdrawing.value) return
  withdrawing.value = true
  try {
    await appStore.setConsent(false)
    uni.showToast({ title: '已撤回', icon: 'none' })
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/parent/onboarding' })
    }, 1000)
  } catch (err) {
    // 撤回没有提交成功时必须告诉家长，不能假装成功
    uni.showModal({
      title: '这次没有撤回成功',
      content: `${errorMessage(err)}。请检查网络后再试一次。`,
      showCancel: false,
      confirmText: '知道了'
    })
  } finally {
    withdrawing.value = false
  }
}
</script>

<template>
  <view class="page page--parent">
    <x-empty v-if="loading" type="loading" />

    <x-empty
      v-else-if="loadError"
      type="offline"
      :title="loadError"
      desc="连上网络以后才能查看和修改授权"
    />

    <template v-else>
      <!-- ============ 当前状态 ============ -->
      <view class="pv__status card">
        <view class="pv__row">
          <text class="pv__label">知情同意</text>
          <view class="tag" :class="appStore.consentConfirmed ? 'tag--safe' : 'tag--sun'">
            <text>{{ statusText }}</text>
          </view>
        </view>
        <view v-if="profileName" class="pv__row">
          <text class="pv__label">孩子的称呼</text>
          <text class="pv__value">{{ profileName }}</text>
        </view>
      </view>

      <!-- ============ 我们保存了什么 ============ -->
      <view class="pv__section card">
        <text class="pv__title">我们保存了哪些信息</text>
        <text class="pv__p">· 你填写的孩子小档案：称呼、年龄、语言水平、喜好、提示方式、停止信号</text>
        <text class="pv__p">· 每次训练里孩子回答的文字，以及得到的回应</text>
        <text class="pv__p">· 家庭任务卡和你的回填记录</text>
        <text class="pv__p pv__p--weak">
          语音回答的录音只用于转成文字（由腾讯云语音识别处理），转完即丢弃，不保存录音文件。不保存真实姓名、学校、住址。
        </text>
      </view>

      <!-- ============ 操作 ============ -->
      <view class="pv__actions card">
        <view class="pv__action" @tap="goConsent">
          <text class="pv__action-text">再看一遍知情同意说明</text>
          <text class="pv__arrow">›</text>
        </view>
        <view v-if="appStore.consentConfirmed" class="pv__action" @tap="goProfile">
          <text class="pv__action-text">修改孩子的小档案</text>
          <text class="pv__arrow">›</text>
        </view>
      </view>

      <!-- ============ 撤回 ============ -->
      <view v-if="appStore.consentConfirmed" class="pv__withdraw card">
        <text class="pv__title">撤回同意</text>
        <text class="pv__p">
          撤回后，我们会停止使用孩子的信息，你也不能再开始训练。
        </text>
        <text class="pv__p">
          已经保存的记录目前需要人工删除，如有需要请联系我们。
        </text>
        <view
          class="btn btn--block pv__withdraw-btn"
          :class="{ 'btn--disabled': withdrawing }"
          @tap="confirmWithdraw"
        >
          <text>{{ withdrawing ? '正在撤回' : '撤回同意' }}</text>
        </view>
      </view>

      <view v-else class="notice pv__notice">
        <text>目前没有同意记录。想继续使用的话，先看一遍说明并同意就好。</text>
      </view>

      <!-- #ifdef H5 -->
      <view class="pv__logout" @tap="confirmLogout">
        <text class="pv__logout-text">退出登录</text>
      </view>
      <!-- #endif -->
    </template>
  </view>
</template>

<style lang="scss" scoped>
.pv__status {
  margin-top: $sp-3;
}

.pv__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $sp-2 0;

  & + & {
    border-top: 2rpx solid $c-line;
  }
}

.pv__label {
  font-size: $fs-body;
  color: $c-text;
}

.pv__value {
  font-size: $fs-body;
  color: $c-text-sub;
}

.pv__section,
.pv__actions,
.pv__withdraw {
  margin-top: $sp-3;
}

.pv__title {
  display: block;
  font-size: $fs-h3;
  font-weight: 600;
  color: $c-text;
  margin-bottom: $sp-2;
}

.pv__p {
  display: block;
  font-size: $fs-sub;
  color: $c-text-sub;
  line-height: 1.75;

  &--weak {
    margin-top: $sp-2;
    color: $c-text-weak;
  }
}

.pv__action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $sp-3 0;
  min-height: $tap-min;

  & + & {
    border-top: 2rpx solid $c-line;
  }
}

.pv__action-text {
  font-size: $fs-body;
  color: $c-text;
}

.pv__arrow {
  font-size: 36rpx;
  color: $c-text-weak;
  line-height: 1;
}

/* 撤回按钮用柔和陶土色，与安全相关操作一致，不用告警红 */
.pv__withdraw-btn {
  margin-top: $sp-4;
  background: $c-abort-soft;
  color: #a05a49;
  border: 2rpx solid rgba(201, 139, 125, 0.3);
}

.pv__notice {
  margin-top: $sp-3;
}

.pv__logout {
  margin: $sp-5 0 $sp-4;
  padding: $sp-3;
  text-align: center;
}

.pv__logout-text {
  font-size: $fs-body;
  color: $c-text-sub;
}
</style>
