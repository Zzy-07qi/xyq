# 星语 · AI赋能ASD儿童语言能力训练

UniApp + Vue3 小程序前端，已对接后端 [Cheerdoge/starlang-bridge](https://github.com/Cheerdoge/starlang-bridge)（Go + Gin + MySQL）。

---

## 网页版怎么跑（主要形态）

### 1. 后端要开网页登录

网页登录默认关闭，后端 `.env` 里要有：

```
WEB_LOGIN_ENABLED=true
```

改完重启后端。没开的话，注册和登录接口是 404，登录页会提示「服务暂时不可用」。

### 2. 本地开发

```bash
npm install
npm run dev:h5
```

终端会打印一个本地地址（一般是 `http://localhost:5173`），用浏览器打开，先看到的是登录页。

后端没有开 CORS，**网页必须和接口同源**。所以网页里只请求 `/api/v1/...`，由 `vite.config.js` 里的代理转给后端，默认转到部署好的服务器 `http://8.133.213.83`。想连本机后端：

```powershell
$env:API_TARGET = 'http://127.0.0.1:8080'; npm run dev:h5
```

### 3. 上线

```bash
npm run build:h5
```

产物在 `dist/build/h5`。上线时网页和接口也必须在同一个域名下：用 `deploy/Caddyfile` 替换后端仓库里的 Caddyfile，`/api/*` 转给后端，其余请求返回网页文件。挂载方式写在那个文件开头的注释里。

### 布局和登录

- 按手机竖屏设计。电脑上打开时页面限宽 480px 居中（`pages.json` 的 `maxWidth`）。
- 手机号 + 密码注册或登录（`POST /auth/register`、`POST /auth/login/password`）。密码 8–64 位，字母和数字都要有。后端没有找回密码，登录页上写了提示。
- 退出登录在「隐私与账号」页。后端是无状态 JWT，没有退出接口，退出就是清掉本机 token。
- token 过期或无效时自动跳回登录页。
- 后端说明网页账号和微信账号**互相隔离**：同一个手机号在小程序和网页上是两个账号，数据不互通。
- 网页版跳过「设备检查」这一步，因为目前不用语音作答。

---

## 小程序版怎么跑

### 1. 先把后端跑起来

按后端仓库 README 启动，默认监听 `127.0.0.1:8080`。`.env` 里确认：

```
WECHAT_APP_ID=wxe9d637f3abea56df
WECHAT_APP_SECRET=（小程序后台的 AppSecret，只放后端）
WECHAT_MOCK=false    # 前端走真实微信登录，这里必须是 false
AI_PROVIDER=mock     # 本地联调用 mock 判断器，结果固定、不花钱
```

验证后端起来了：浏览器打开 `http://127.0.0.1:8080/health`，看到 `{"status":"ok"}` 就对了。

### 2. 再跑前端

```bash
npm install
npm run dev:mp-weixin
```

微信开发者工具导入 `dist/dev/mp-weixin`，右上角「详情 → 本地设置」勾选**不校验合法域名**（后端是 http + IP 地址，不勾会被拦）。

接口地址在 `config/constants.js` 的 `apiBase`，目前指向部署好的服务器 `http://8.133.213.83/api/v1`。
想连本机后端时改成 `http://127.0.0.1:8080/api/v1`；真机预览连本机要用电脑的局域网 IP。

登录页只在网页版里编译（`pages.json` 里用 `#ifdef H5` 包着），小程序仍然用 `uni.login` 静默登录。

### 关于源码目录

uni CLI 默认从 `src/` 读源码，本项目是根目录布局，所以 scripts 里带了 `cross-env UNI_INPUT_DIR=.`。
这个变量在加载 `vite.config.js` 之前就被读取，只能走环境变量。

---

## 联调时你会遇到的几件事

**小程序登录走真实的微信登录。** 后端 `WECHAT_MOCK=true` 时每次 code 都不一样，会被当成新用户，表现是每次打开都要重新走引导。

**语音作答。** 孩子点大按钮说话，停顿 2.5 秒自动结束（也可以再点一次结束），最长 15 秒。流程：

1. 录成 16 kHz 单声道 MP3。后端只收这个格式，会真的解码检查采样率。网页里浏览器录不出 MP3，用 `@breezystack/lamejs` 在前端编码，代码在 `core/audio/web-recorder.js`。
2. 上传到 `POST /speech/transcriptions` 转成文字。这一步只是转写，不算一次作答；转写失败时提示「没听清，再说一次」，这一题不留记录。
3. 把文字和识别置信度一起提交给 `/answers`。置信度低于 0.6 时，后端不评判，直接请孩子再说一遍。

**录不了音时会自动退回点选**：网页没有 https、浏览器不支持、家长拒绝了麦克风。训练页上会写明原因。家长也可以手动点「太吵了？改成点一点」。候选句在 `config/scenarios.js` 的 `options` 里配。

**题目和反馈会读出来（仅网页）。** 用的是浏览器自带的朗读（`speechSynthesis`），不需要 https，也不经过后端。声音由手机系统决定；读不出来时只显示文字，停 1.2 秒后进入作答。小程序里没有这个能力，仍然只显示文字。

**网页要 https 才能用麦克风。** 浏览器只在 https 页面或 `localhost` 上允许录音。`http://8.133.213.83` 上打开时，只有朗读能用，作答会自动变成点选。本地 `npm run dev:h5` 用 `localhost` 打开可以录音。

**后端语音识别配置。** 后端 `.env` 里 `ASR_PROVIDER=mock` 时，不管说什么都返回「我想喝水。」，用来跑通流程。真实识别要用 `ASR_PROVIDER=tencent`，并配上 `TENCENTCLOUD_SECRET_ID` 和 `TENCENTCLOUD_SECRET_KEY`。生产环境后端会拒绝用 mock 启动。

**停止信号。** 画像里填的「他想停下来时会说的话」，后端会在每次回答里找。找到了就直接结束这次训练，前端显示「好的，我们先休息一下。」，然后去退出页，不走安全页。因为是按文字匹配，选项只放说得出来的短句，不放「摇头」这类动作。

**用 mock 判断器时，怎么让后端判"说得好"：** 回答里包含该轮的目标句、可接受说法或关键词任意一个即可（后端 `server/ai_mock.go` 的 `containsAny`）。比如搭积木第 1 轮，回答「我想一起玩」就是有效。候选句都是按这个规则挑的。

---

## 目录结构

```
├── config/
│   ├── constants.js          接口地址、联调开关、后端枚举、时长
│   ├── scenarios.js          情境展示配置（颜色、图、点选候选句）。内容在后端
│   └── copywriting.js        全局话术（唯一话术来源）
│
├── core/
│   ├── request.js            请求封装：自动登录、token、401 重登、错误外壳
│   ├── api/index.js          13 个接口 + 字段转换（snake_case → 前端形状）
│   ├── session-state.js      已废弃，可删除（状态机移到了后端）
│   └── audio/                录音、播放、权限（语音识别接好后启用）
│
├── store/
│   ├── app.js                知情同意、孩子画像（与后端同步）、设备权限
│   └── session.js            一次训练：按后端 next_action 切换界面
│
├── components/               公共组件（easycom 自动注册）
├── pages/auth/    (1 页)     网页版登录 / 注册（仅 H5）
├── pages/parent/  (12 页)    家长模式（含训练记录详情、隐私与授权）
├── pages/child/   (7 页)     儿童模式
├── styles/
└── static/                   静态资源（见 static/README.md）
```

---

## 训练流程：谁说了算

**之前**前端自己维护一套状态机，自己决定重试几次、什么时候给词卡、什么时候结束。
**现在**这些全由后端决定。前端每提交一次回答，按返回的 `next_action` 换界面：

| next_action | 后端什么时候给 | 前端怎么显示 |
| --- | --- | --- |
| `retry` | 第 1 次没说对 / 第 1 次没说话 | 同一题，「你可以再说一遍吗」 |
| `show_hint` | 第 2 次没说对 | 同一题，出现词块 |
| `parent_assist` | 第 3 次没说对 | 同一题，出现完整句 + 家长提示 |
| `next_turn` | 说对了 / 拒绝了 / 第 2 次没说话 / 第 4 次还没说对 | 先看反馈，再换下一题 |
| `finish` | 最后一轮走到 `next_turn` 的位置 | 去奖励页，任务卡随这次响应一起返回 |
| `risk_flag: true` | 回答里有风险内容 | 后端已中止会话，前端去安全页 |

逻辑在 `store/session.js` 的 `answer()`。页面 `pages/child/training.vue` 只看 `session.phase` 决定显示什么。

---

## 接口对照

全部在 `core/api/index.js`，页面和 store 不直接碰后端字段名。

| 前端函数 | 后端接口 | 说明 |
| --- | --- | --- |
| `register` | `POST /auth/register` | 网页注册，成功即登录；手机号已注册返回 409 |
| `passwordLogin` | `POST /auth/login/password` | 网页登录；15 分钟内失败 5 次返回 429 |
| （自动） | `POST /auth/login` | 仅小程序：没 token 或 401 时用 `uni.login` 自动调 |
| `getMe` | `GET /user/me` | 同意状态 |
| `submitConsent` | `POST /user/consent` | 1 同意（同意页）/ 2 撤回（隐私与授权页） |
| `getProfile` / `saveProfile` | `GET` / `PUT /user/child` | 画像，PUT 是全量覆盖 |
| `getScenarioList` | `GET /scenarios` | 不需要登录 |
| `getScenarioDetail` | `GET /scenarios/:id` | 需要登录 |
| `startSession` | `POST /training/sessions` | 返回第 1 题 |
| `transcribe` | `POST /speech/transcriptions` | multipart：`audio`（16 kHz MP3，≤2.25 MB，≤60 秒）+ `format=mp3`，只能这两个字段；返回 `text` 和 `asr_confidence`（可能为 null） |
| `submitAnswer` | `POST /training/sessions/:id/answers` | `text`（≤255 字，空 = 没说话）+ 语音作答时带 `asr_confidence`；带 `Idempotency-Key`，断网重发同一个回答不会记两次 |
| `abortSession` | `POST /training/sessions/:id/abort` | reason 自由文本 |
| `getSessionDetail` | `GET /training/sessions/:id` | 训练记录详情页，从任务卡进入 |
| `getTaskCardList` | `GET /task-cards` | 最近 10 张 |
| `backfillTaskCard` | `POST /task-cards/:id/backfill` | feedback 1~5 + 可选备注（≤500 字） |

`GET /health` 是运维探活用的，前端不调。

画像 `interests` 后端是逗号分隔字符串、前端是数组，在转换层处理。任务卡 `steps` 现在后端统一返回数组，转换层仍兼容旧的 JSON 字符串。

---

## 硬约束清单

### 文案
- 任何界面不得出现「错误」「失败」「答错」字样
- 话术统一在 `config/copywriting.js`
- 安全中止的儿童端话术「请家长来帮忙」不可改写

### 视觉
- 儿童端触控目标 ≥ 120rpx（`$tap-child`）
- 禁用纯红作为状态色，中止用柔和陶土色 `$c-abort`
- 动画统一慢速，无闪烁

### 合规
- 后端现在也会拦截：未同意时孩子画像、训练、任务卡接口返回 403、业务码 1002，前端收到后跳回引导页。前端自己的拦截（`store/app.js` 的 `canEnterChildMode`）保留，少一次无用请求
- 同意必须后端留痕成功才放行，失败就停在同意页
- 孩子称呼只收小名或昵称

---

## 需要后端补的

| 缺口 | 影响 | 前端现在怎么处理 |
| --- | --- | --- |
| 语音合成 | 小程序里题目没声音 | 网页用浏览器朗读；小程序只显示文字 |
| 跳过本轮的接口 | 家长点「跳过」要连发空回答凑出 next_turn | `session.skipRound()` 最多发 4 次 |
| 删除孩子数据的接口 | 撤回同意后服务端数据还在 | 同意书和隐私页都写的是「联系我们删除」 |
| 训练建议接口 | 首页「下一次的建议」 | 按最近一张已回填任务卡的结果本地给出 |
| 单张任务卡接口 | 只能在最近 10 张里找 | 超出 10 张的旧卡回填页显示空态 |
| 训练历史列表 | 没有任务卡的训练（比如中途退出的）家长看不到 | 只能从任务卡进入训练详情 |
| 情境图片 | 后端只给文件名 | 前端本地放图，见 static/README.md |

---

## 待办

- [ ] 补情境场景图：`static/scenarios/build_blocks.png`、`outdoor_needs.png`
- [x] 接语音识别：录音 → `/speech/transcriptions` → 带置信度提交
- [ ] 服务器换成 https 域名，网页才能用麦克风（后端 Caddy 填上 `DOMAIN` 会自动申请证书）
- [ ] 后端配腾讯云 `ASR_PROVIDER=tencent` 和密钥；真机实测识别效果，按需调 `core/audio/recorder.js` 的 `SILENCE_THRESHOLD`
- [x] `manifest.json` 填微信 `appid`（wxe9d637f3abea56df）
- [x] 前端改为真实微信登录（`uni.login`）
- [ ] 后端配同一个 appid 和 secret、`WECHAT_MOCK=false`
- [ ] 真机测试；安全中止链路全流程验证（项目书 8.3：通过后才能上线）
- [ ] 删除 `core/session-state.js`
- [ ] 网页版上线：后端 `WEB_LOGIN_ENABLED=true`，按 `deploy/Caddyfile` 同源部署
- [ ] 后端文档写明网页登录「仅供演示、生产环境不要开启」。正式上线网页版前要和后端确认：是否补短信验证、找回密码，以及演示账号的数据怎么处理
