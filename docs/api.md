# 耳畔童话云函数接口设计

> 技术栈：微信小程序 `Taro.cloud.callFunction`、CloudBase 云函数、CloudBase NoSQL、Cloud Storage
>
> 环境：`blacke-d7g0wczgza0632d5a`
>
> 本文同时记录“本地已有云函数 action”和“上线验收所需的目标契约”。标记为“现有”的接口已经在 `cloudfunctions/*/index.js` 中有入口；标记为“待补齐”的接口不能当作已经上线。

## 1. 调用和返回约定

### 1.1 小程序调用方式

```ts
const result = await Taro.cloud.callFunction({
  name: 'mp-story',
  data: {
    action: 'generateText',
    theme: '睡前安抚',
    educationalGoal: '情绪放松',
    scene: '温馨家庭',
    age: 4,
    duration: 'short',
    mainCharacters: [
      { name: '团团', role: '需要晚安陪伴的小熊', personality: '温柔敏感' },
    ],
  },
});

const data = result.result;
```

- 身份由云函数 `cloud.getWXContext().OPENID` 获取，前端不传 `openid`，也不依赖本地伪造 token。
- `miniprogram/src/utils/request.ts` 当前保留旧 `/api/...` 调用签名，并映射到下面的云函数名和 `action`。
- 云函数成功时返回业务对象；业务失败时返回 `{ error: string }`。生成安全拦截使用 `safetyBlocked` 或 `safetyRewriteSuggestion`，前端必须优先判断这两个标记，不能只判断 `error`。
- 文件上传不走云函数 JSON：先用 `wx.cloud.uploadFile`/`Taro.cloud.uploadFile` 上传到私有 Cloud Storage，再把 `fileID` 传给云函数。

### 1.2 统一错误处理

| 场景 | 返回字段 | 前端处理 |
| --- | --- | --- |
| 参数缺失 | `{error: "..."}` | 立即提示，不扣额度 |
| 未登录/身份缺失 | `{error: "身份缺失"}` | 重新初始化云环境并回到登录页 |
| 无权访问 | `{error: "故事不存在或无权限"}` | 不展示资源详情 |
| 额度不足 | `{error: "...额度已用尽..."}` | 跳转兑换/邀请页 |
| 输入安全拦截 | `safetyBlocked: true` | 显示温和提示，不扣额度 |
| 输入可改写 | `safetyRewriteSuggestion: true` | 展示建议，用户确认后重新提交，不扣额度 |
| 生成内容拦截 | `safetyBlocked: true` | 不展示、不播放、不保存；云函数退款并记录审核 |
| 外部服务失败 | `{error: "..."}` 或任务 `status: failed` | 展示重试入口，避免重复扣费 |

### 1.3 所有接口必须满足的规则

1. 归属字段只来自云函数上下文；查询 `users`、`userStories`、`generationJobs`、`voiceClones`、`notifications`、`assets` 和 `quotaLedger` 时必须带当前 OPENID。
2. 读取列表必须分页，默认 `pageSize <= 20`，最大 `pageSize <= 50`；不得把全部故事、全部任务和全部资源一次性塞进首页响应。
3. 响应只返回小程序需要的字段；管理员、密钥、敏感词原文、第三方 voice ID 不得返回用户端。
4. 生成接口必须保存 `inputHash`，对相同用户、相同输入和相同 voiceId 做幂等处理。
5. 任何扣额度动作必须和业务写入、流水写入处于同一原子流程；安全拦截或明确失败时退款。

## 2. 当前函数总表

| 云函数 | 当前 action | 页面/用途 | 状态 |
| --- | --- | --- | --- |
| `mp-user` | `login`、`getUserData`、`updateProfile`、`updateConfig`、`notifReadAll`、`notifDelete`、`statsPlay` | 登录、首页/我的、档案、通知、播放统计 | 现有 |
| `mp-story` | `generateText`、`generateAudio`、`audioStatus`、`saveToggle`、`rename`、`delete` | 绘本向导、预览、播放器、故事日记本 | 现有，但音频异步契约未完成 |
| `mp-voice` | `clone`、`delete` | 录音室 | 现有 |
| `mp-cdkey` | `redeem`、`bind` | 兑换码、邀请 | 现有 |
| `mp-admin` | `login`、`register`、`simulate-api-call`、模板管理、安全词管理 | 可视化后台 | 现有 |
| `mp-admin` | `reset` | 重置模板/统计/审计 | 禁止上线调用；不纳入验收 |
| `mp-seed` | `run` | 首次播种全局测试数据 | 临时函数；播种完成后删除或禁用 |

## 3. 首页与全局数据接口

### 3.1 `mp-user.login`：微信云开发登录

状态：现有。

请求参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `action` | string | 是 | 固定 `login` |
| `nickname` | string | 否 | 首次登录时的展示昵称 |
| `avatar` | string | 否 | 安全头像标识；不能传任意 URL 脚本 |

成功返回：

```json
{
  "success": true,
  "token": "cloud",
  "openid": "openid_demo_001",
  "user": {
    "_id": "openid_demo_001",
    "nickname": "小星妈妈",
    "profile": {},
    "rights": {
      "freeVoiceClonesRemaining": 5,
      "storyGenerationsRemaining": 3,
      "isVip": false,
      "inviteCode": "BMTH-DEMO1"
    }
  }
}
```

业务逻辑：通过云函数上下文确保用户文档存在；不得使用前端传来的 openid 创建或切换用户。当前返回 `openid` 仅为兼容调试，正式前端不应把它当作鉴权凭证。

### 3.2 `mp-user.getUserData`：兼容型全量引导数据

状态：现有；只作为迁移兼容，不作为长期首页接口。

请求参数：`{ "action": "getUserData" }`，无其他参数。

当前成功返回：

```json
{
  "success": true,
  "profile": {},
  "voiceClones": [],
  "userStories": [],
  "notifications": [],
  "rights": {},
  "templates": [],
  "config": {},
  "stats": {},
  "generationJobs": [],
  "quotaLedger": []
}
```

业务逻辑：聚合用户档案、声纹、故事、通知、权益、模板和统计。

当前阻断：实现还会查询并返回管理员摘要、敏感词配置摘要、兑换码摘要和 API 统计给普通用户；上线前必须拆分为用户端最小响应，不能让 `getUserData` 继续承担管理端数据出口。

### 3.3 `mp-user.getHomeData`：首页最小响应

状态：待补齐，建议作为正式首页接口。

请求参数：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `action` | string | 是 | `getHomeData` | 首页动作 |
| `templateLimit` | number | 否 | `3` | 1–6 |
| `storyLimit` | number | 否 | `1` | 最近播放/最近创建数量 |

目标返回：

```json
{
  "success": true,
  "data": {
    "profile": {"nickname": "星星", "age": 4},
    "rights": {"storyGenerationsRemaining": 7, "freeVoiceClonesRemaining": 4, "isVip": false},
    "unreadNotificationCount": 2,
    "recommendedTemplates": [],
    "recentStory": null,
    "config": {"themes": [], "scenes": []}
  }
}
```

业务逻辑：只读取首页需要的最小字段；推荐模板按 `isRecommended` 和 `useCount` 排序；最近故事按用户 OPENID 和 `createTime` 倒序；不返回 `admins`、`sensitiveWordsConfig`、`cdkeys`、`apiStats`。

### 3.4 `mp-user.updateProfile`：保存孩子档案

状态：现有。

请求参数：

```json
{
  "action": "updateProfile",
  "nickname": "星星",
  "age": 4,
  "gender": "girl",
  "interests": ["月亮", "小动物"],
  "parentName": "小星妈妈",
  "bedTime": "21:00"
}
```

返回：`{ "success": true, "profile": { ... }, "notifications": [ ... ] }`。

业务逻辑：校验年龄范围、性别枚举、兴趣数组长度和文本长度；只更新当前用户的嵌入式 `users.profile`，并写一条系统通知。不能因为重复保存页面而无限增加统计，生产应按“首次完成/实际变更”计数。

### 3.5 `mp-user.updateConfig`：更新创建配置

状态：现有入口，但权限错误，必须改为管理员 action 或增加管理员校验后才能上线。

请求参数：`{ "action":"updateConfig", "themes":[], "educationalGoals":{}, "scenes":[] }`。

返回：`{ "success":true, "config": {"themes":[],"educationalGoals":{},"scenes":[]} }`。

业务逻辑：写入唯一 `config` 文档；主题、教育目标、场景必须做长度和内容安全校验。普通小程序用户调用必须返回无权错误，不能通过旧路径 `/api/config` 修改全局配置。

## 4. 模板列表页接口

### 4.1 `mp-user.listTemplates`：模板列表

状态：待补齐；当前页面暂时从 `getUserData.templates` 读取。

请求参数：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `action` | string | 是 | `listTemplates` | 列表动作 |
| `theme` | string | 否 | 空 | 主题筛选 |
| `scene` | string | 否 | 空 | 场景筛选 |
| `age` | number | 否 | 空 | 按适龄范围筛选 |
| `recommendedOnly` | boolean | 否 | `false` | 只看推荐 |
| `page` | number | 否 | `1` | 从 1 开始 |
| `pageSize` | number | 否 | `20` | 最大 50 |

目标返回：

```json
{
  "success": true,
  "data": {
    "items": [],
    "page": 1,
    "pageSize": 20,
    "total": 6,
    "hasMore": false
  }
}
```

业务逻辑：只返回模板展示字段和两套提示词种子，不返回任何用户私有资源；主题和场景组合必须能命中 `templates.theme + templates.scene`，没有命中时由 `getStorybookTemplate` 生成 `tpl_dynamic`，但动态模板不落库，除非用户实际生成成功。

### 4.2 `mp-user.getTemplate`：模板详情

状态：待补齐。

请求参数：`{ "action": "getTemplate", "templateId": "tpl_bedtime_family" }`。

返回：`{ "success": true, "data": { "template": {"id":"...", "theme":"...", "scene":"...", "visualStyle":{}, "coverPromptSeed":"...", "contentPromptSeed":"..."} } }`。

业务逻辑：按模板 ID 查询，缺失返回 `error`；不能接受前端直接覆盖 `coverPromptSeed` 或 `contentPromptSeed`。

## 5. 绘本定制与生成接口

### 5.1 `mp-story.generateText`：生成文本和生成提示词

状态：现有。

请求参数：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `action` | string | 是 | `generateText` | 固定动作 |
| `templateId` | string | 否 | `tpl_dynamic` | 已选模板 ID |
| `theme` | string | 是 | `睡前安抚` | 主题 |
| `educationalGoal` | string | 是 | `情绪放松` | 教育目标 |
| `scene` | string | 是 | `温馨家庭` | 场景 |
| `age` | number | 是 | `4` | 目标年龄 |
| `duration` | string | 是 | `short` | `short`、`medium`、`long` 或 `long_10m` |
| `mainCharacter` | object | 否 | 小宝贝 | 单主角兼容参数 |
| `mainCharacters` | object[] | 否 | `[]` | 多主角；优先使用该字段 |
| `mainCharacters[].name` | string | 否 | `宝贝` | 主角名 |
| `mainCharacters[].role` | string | 否 | `小伙伴` | 身份/物种 |
| `mainCharacters[].personality` | string | 否 | `活泼可爱` | 性格 |
| `mainCharacters[].customDescription` | string | 否 | 空 | 完全自定义描述 |
| `isRetry` | boolean | 否 | `false` | 是否重试 |
| `retryCount` | number | 否 | `0` | 重试次数 |

成功返回：

```json
{
  "success": true,
  "consumed": true,
  "rights": {"storyGenerationsRemaining": 6, "isVip": false},
  "story": {
    "title": "月光下的晚安抱抱",
    "abstract": "团团在月光下学会安心入睡。",
    "coverUrl": "cloud://.../images/openid_demo_001/cover.webp",
    "coverPrompt": "独立生成的封面提示词……",
    "templateId": "tpl_bedtime_family",
    "visualStyle": {"medium": "soft digital storybook illustration", "palette": "月光蓝、奶油白", "lighting": "柔和夜景", "characterContinuity": "固定角色外观"},
    "chapters": [
      {
        "chapterNumber": 1,
        "title": "床头的小月亮",
        "text": "……",
        "imageUrl": "",
        "imagePrompt": "独立生成的第 1 章内页提示词……"
      }
    ]
  }
}
```

业务逻辑顺序：

1. 校验主题、教育目标、场景、角色输入安全；命中拦截或改写建议时不扣额度。
2. 检查用户权益；普通用户首次生成扣 1 次，符合规则的第一次重试不额外扣减。
3. 用 `templateId` 或 `theme + scene` 解析模板，生成 `visualStyle`、章节节奏和文本提示词。
4. 使用 `buildStoryTextPrompt` 只生成故事文本 JSON。
5. 使用 `buildCoverImagePrompt` 生成封面提示词；使用 `buildChapterImagePrompt` 为每个章节分别生成内页提示词。
6. 对生成文本做二次安全检查；被拦截时不展示、不保存、不播放并退款。

### 5.2 封面与内页提示词的独立生成策略

这是上线验收的硬规则：

| 项目 | 封面 `coverPrompt` | 内页 `chapters[].imagePrompt` |
| --- | --- | --- |
| 输入重点 | 主题、故事标题/摘要、整体氛围、主角、场景 | 当前章节标题、章节正文、当前动作和情绪 |
| 视觉目标 | 让孩子想打开绘本；一个明确焦点角色、整体故事氛围、层次和吸引力 | 推进具体情节；清晰前景动作、角色表情和场景道具 |
| 禁止内容 | 不描绘某一章具体事件，不放文字/标题/Logo/水印 | 不把整本故事摘要当画面，不复用封面构图，不放文字/Logo/水印 |
| 共享内容 | `visualStyle.medium/palette/lighting/characterContinuity` | 同上，用于保持角色与画风连续 |
| 生成函数 | `buildCoverImagePrompt` | `buildChapterImagePrompt` |

验收样例：同一个故事的 `coverPrompt` 不应出现“第 1 章”“章节动作”；任何 `imagePrompt` 都应出现当前章节号或当前章节动作，并且两者的策略种子不同。

当前代码核对：本地 `mp-story.generateText` 已返回独立的 `coverPrompt` 和章节 `imagePrompt`；但章节图片当前仍使用库存图，尚未对每个章节实际调用图片模型，属于“提示词逻辑完成、内页 AI 图片生成未闭环”。

### 5.3 `mp-story.generateAudio`：有声任务创建

状态：现有入口；当前实现是同步执行的生产阻断项。目标契约如下。

请求参数：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `action` | string | 是 | `generateAudio` | 固定动作 |
| `story` | object | 是 | 无 | 文本预览结果；云函数应重新校验归属和字段 |
| `voiceId` | string | 否 | `voice_default_mom` | 声音 ID |
| `voiceMode` | string | 否 | `single` | 声音模式 |
| `theme` | string | 否 | 故事字段 | 记录任务快照 |
| `educationalGoal` | string | 否 | 故事字段 | 记录任务快照 |
| `scene` | string | 否 | 故事字段 | 记录任务快照 |
| `mainCharacterName` | string | 否 | `主角` | 记录任务快照 |
| `duration` | string | 否 | `short` | 记录任务快照 |
| `targetAge` | number | 否 | `4` | 记录任务快照 |
| `bgmType` | string | 否 | `none` | 固定白噪音选择；只给客户端播放器 |

目标立即返回：

```json
{
  "success": true,
  "accepted": true,
  "inProgress": true,
  "jobId": "job_demo_queued",
  "jobStatus": "queued",
  "audioMode": "narration_plus_client_noise"
}
```

后台任务流程：

```text
queued -> compressing -> tts_generating -> ready
                         \-> failed
```

只有用户主动选择白噪音时，播放器在小程序端增加固定白噪音轨道；默认 `bgmType=none`。旁白生成路径不等待 TTS、FFmpeg 或 BGM 混音后才返回；也不在服务端把白噪音混入旁白文件。

### 5.4 `mp-story.audioStatus`：查询有声任务

状态：现有。

请求参数：`{ "action": "audioStatus", "jobId": "job_demo_queued" }`。

成功返回：

```json
{
  "success": true,
  "jobId": "job_demo_queued",
  "status": "compressing",
  "progress": 25,
  "error": null,
  "story": null
}
```

当 `status=ready` 时返回 `story`；其中所有 Cloud Storage fileID 先由云函数换成短期临时 URL，不能把过期 URL 持久化到数据库。

### 5.5 图片和音频压缩返回规范

| 资源 | 生成/处理 | 返回前要求 | 失败策略 |
| --- | --- | --- | --- |
| 封面 | 生成后限制尺寸并真正编码 WebP | 推荐长边 1024、目标 <= 350 KB；响应只返回 fileID/临时 URL和大小 | 保留任务失败状态，不把原始大图直接返回 |
| 内页图 | 生成后统一尺寸、WebP 压缩 | 推荐最长边 1024、目标 <= 250 KB/张；先存 Storage，再写 `assets` | 单张失败可标记 `assets.failed`，不能阻塞文本预览 |
| 旁白 | 使用供应商已压缩音频，校验格式/大小 | 推荐 MP3/AAC 48–64 kbps；每章返回 `audioSizeBytes` | 章节失败导致有声任务 `failed`，支持重试和幂等 |
| 白噪音 | 固定预置音频，客户端独立播放 | 默认不加载；不进入旁白文件 | 无白噪音时直接播放旁白 |

当前代码阻断：`processCoverImage` 和 `processChapterImage` 目前上传原始 buffer，只把文件名写成 `.webp`，没有实际 WebP 编码；`mp-story.generateAudio` 也在云函数内同步等待图片和 TTS。以上两项完成前不能判定不卡顿或可上线。

## 6. 播放、日记本和故事操作接口

### 6.1 `mp-story.listStories`：故事列表

状态：待补齐；当前由 `mp-user.getUserData.userStories` 兼容返回。

请求参数：

```json
{"action":"listStories","page":1,"pageSize":20,"savedOnly":true,"favoriteOnly":false}
```

目标返回：

```json
{"success":true,"data":{"items":[],"page":1,"pageSize":20,"total":0,"hasMore":false}}
```

业务逻辑：强制按上下文 OPENID 过滤；按现有故事字段 `createTime desc` 排序；列表只返回封面、标题、摘要、音频状态和收藏状态，不返回全部章节正文和音频 URL。

### 6.2 `mp-story.getStory`：故事详情

状态：待补齐。

请求参数：`{ "action": "getStory", "id": "story_demo_001" }`。

业务逻辑：校验故事归属，返回章节正文、封面、内页图和音频临时 URL；按需解析 Cloud Storage fileID。

### 6.3 `mp-story.saveToggle`：收藏/保存日记本

状态：现有。

请求参数：`{ "action": "saveToggle", "id": "story_demo_001", "type": "favorite" }`，`type` 还可以是 `diary`。

返回：`{ "success": true, "story": {"id":"story_demo_001", "isFavorite": true, "isSavedToDiary": true} }`。

业务逻辑：先按 OPENID 读取故事，再只更新一个布尔字段；跨用户访问返回错误，不得仅凭客户端传来的故事 ID 更新。

### 6.4 `mp-story.rename`：重命名故事

状态：现有。

请求参数：`{ "action": "rename", "id": "story_demo_001", "title": "星星的晚安小旅程" }`。

返回：`{ "success": true, "story": {"id":"story_demo_001", "title":"星星的晚安小旅程"} }`。

业务逻辑：校验标题长度、控制字符和敏感词；仅修改所属用户故事。

### 6.5 `mp-story.delete`：删除故事

状态：现有。

请求参数：`{ "action": "delete", "id": "story_demo_001" }`。

返回：`{ "success": true }`。

业务逻辑：软删除优先，或在确认后删除故事文档并异步清理其 `assets` 和 Storage 文件；不能因删除故事而误删用户声纹或其他故事共享资源。

### 6.6 `mp-user.statsPlay`：播放统计

状态：现有。

请求参数：`{ "action": "statsPlay", "storyId": "story_demo_001", "chapterNumber": 1 }`。

返回：`{ "success": true }`。

业务逻辑：统计接口需要限频/幂等，避免播放器每次进度变化都重复计数；当前实现只做全局自增，生产应记录必要的去重键。

## 7. 录音室接口

### 7.1 录音文件上传

调用：`Taro.cloud.uploadFile`，不是云函数 action。

```ts
const upload = await Taro.cloud.uploadFile({
  cloudPath: `voice-samples/${openid}/voice_demo_${Date.now()}.wav`,
  filePath: localFilePath,
});
// upload.fileID -> 传给 mp-voice.clone
```

约束：云函数应检查 `fileID` 为当前环境的 `cloud://` 文件、路径归属当前用户、音频 MIME/时长/大小在白名单内；上传完成后原始录音保持私有。

### 7.2 `mp-voice.clone`：创建声纹

状态：现有。

请求参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `action` | string | 是 | 固定 `clone` |
| `name` | string | 是 | 声音昵称，先做安全检查 |
| `speakerType` | string | 是 | `father`、`mother`、`grandfather`、`grandmother`、`custom` |
| `recordDuration` | number | 否 | 录音秒数，默认 30 |
| `fileID` | string | 否 | 已上传录音；缺失时当前代码会走模拟声纹，不应作为生产成功标准 |

成功返回：

```json
{
  "success": true,
  "voice": {"id":"voice_demo_001","name":"妈妈的晚安声","isReady":true,"usageCount":0},
  "rights": {"freeVoiceClonesRemaining":4,"storyGenerationsRemaining":7},
  "notifications": []
}
```

业务逻辑：昵称安全检查 → 校验录音归属 → 扣减免费声纹次数/必要时扣故事额度 → 调用第三方克隆 → 写入 `voiceClones`、额度流水和通知。第三方失败不能伪装成生产可用声纹；若保留模拟模式，响应必须明确 `stepfunSucceeded=false`。

### 7.3 `mp-voice.delete`：删除声纹

状态：现有。

请求参数：`{ "action":"delete", "id":"voice_demo_001" }`。

返回：`{ "success": true, "voiceClones": [] }`。

业务逻辑：仅删除当前 OPENID 的声纹文档；若有外部声纹 ID，先执行供应商侧注销/解绑策略，再异步清理原始录音。

## 8. 我的、兑换和邀请接口

### 8.1 `mp-cdkey.redeem`：兑换激活码

状态：现有，但需要补原子性。

请求参数：`{ "action":"redeem", "code":"STORY-DEMO-10" }`。

返回：

```json
{"success":true,"rights":{"storyGenerationsRemaining":17,"isVip":false},"notifications":[],"message":"兑换成功，获得10次故事生成额度"}
```

业务逻辑：规范化大写 → 在 `cdkeys.code` 上执行“未使用条件更新” → 同一事务内增加权益、写 `quotaLedger`、更新统计和通知。当前实现是先读后写，存在并发重复兑换风险，完成事务前不能上线。

### 8.2 `mp-cdkey.bind`：绑定邀请码

状态：现有，但需要补原子性和推荐人关系。

请求参数：`{ "action":"bind", "inviteCode":"BMTH-DEMO1" }`。

返回：

```json
{"success":true,"rights":{"storyGenerationsRemaining":9,"usedInviteCode":"BMTH-DEMO1"},"invitationRecords":[],"notifications":[]}
```

业务逻辑：禁止绑定自己、重复绑定；同时写 `invitationRecords`、双方奖励（若业务确认仍为双方奖励）、额度流水和通知。建议通过 `referrerOpenid` 找到真实推荐人，不能只凭用户输入的邀请码发放奖励。

### 8.3 我的页面读取

当前：使用 `mp-user.getUserData` 的 `profile`、`rights`、`voiceClones`、`notifications`。

目标：增加 `mp-user.getMyData`，仅返回当前用户的档案、权益、声纹摘要、未读数和邀请摘要；兑换码、管理员、审计配置全部不在用户响应中。

## 9. 通知接口

### 9.1 `mp-user.notifReadAll`：全部已读

状态：现有。

请求：`{ "action":"notifReadAll" }`。

返回：`{ "success":true, "notifications":[] }`。

业务逻辑：只更新当前 OPENID 且 `isRead=false` 的通知。

### 9.2 `mp-user.notifDelete`：删除一条通知

状态：现有。

请求：`{ "action":"notifDelete", "id":"notif_demo_001" }`。

返回：`{ "success":true, "notifications":[] }`。

业务逻辑：先校验通知归属再删除；前端旧路径 `/api/notifications/:id` 会被 `request.ts` 映射到此 action。

## 10. 可视化后台接口

管理端必须使用独立管理员会话或 CloudBase Auth 管理员角色，不能复用小程序用户身份。当前 `mp-admin` 的 token 只应由管理端内存保存，不能写入小程序缓存。

### 10.1 `mp-admin.login`

状态：现有。

请求：`{ "action":"login", "username":"admin_demo", "password":"仅测试环境使用的密码" }`。

返回：`{ "success":true, "user":{"username":"admin_demo"}, "adminToken":"短期会话令牌" }`。

业务逻辑：校验哈希密码，创建 8 小时会话。生产建议 token 只存哈希，不在数据库保存明文 token。

### 10.2 `mp-admin.register`

状态：现有。

请求：`{ "action":"register", "adminToken":"...", "username":"reviewer_demo", "password":"..." }`。

返回：`{ "success":true, "message":"管理员账号新建成功" }`。

业务逻辑：必须由有效管理员会话发起；密码最小长度、复杂度和角色都应服务端校验。

### 10.3 `mp-admin.template/add`

状态：现有。

请求字段：`name:string`、`cover:string`、`ageGroup:string`、`theme:string`、`educationalGoal:string`、`scene:string`、`mainCharacter:{name,role,personality}`、`duration:string`、`description:string`，另带 `action` 和 `adminToken`。

返回：`{ "success":true, "templates":[] }`。

业务逻辑：校验主题/场景合法性；创建模板时必须同时生成 `visualStyle`、`coverPromptSeed`、`contentPromptSeed` 和 `chapterBeats`，不能只创建一个缺少提示词策略的模板。

### 10.4 `mp-admin.template/delete`

状态：现有。

请求：`{ "action":"template/delete", "adminToken":"...", "id":"tpl_demo" }`。

返回：`{ "success":true, "templates":[] }`。

业务逻辑：已有故事引用的模板不应物理删除；建议改为 `isPublished=false` 或软删除。

### 10.5 `mp-admin.template/toggle-recommend`

状态：现有。

请求：`{ "action":"template/toggle-recommend", "adminToken":"...", "id":"tpl_demo" }`。

返回：`{ "success":true, "tpl":{} }`。

### 10.6 `mp-admin.safety-config/update`

状态：现有。

请求：`{ "action":"safety-config/update", "adminToken":"...", "categories":[], "sensitiveWords":[] }`。

返回：`{ "success":true, "sensitiveWordsConfig":{"categories":[],"sensitiveWords":[],"auditLogs":[]} }`。

业务逻辑：只有审核管理员可修改；更新前保留版本或审计记录；敏感词原文不返回小程序。

### 10.7 `mp-admin.safety-config/audit-resolve`

状态：现有。

请求：`{ "action":"safety-config/audit-resolve", "adminToken":"...", "id":"audit_demo_001", "status":"approved" }`。

`status` 允许 `approved` 或 `overridden`。返回更新后的审核日志。

### 10.8 `mp-admin.simulate-api-call`：写入测试 API 统计

状态：现有，仅限测试/演示环境；生产管理端不应通过随机模拟数据覆盖真实监控。

请求：`{ "action":"simulate-api-call", "adminToken":"...", "type":"gemini" }`。

`type` 可为 `gemini`、`tts`、`clone` 或 `other`。返回 `{ "success":true, "type":"gemini", "apiStats":{} }`，不返回完整数据库。

业务逻辑：仅用于验收后台图表；真实调用应由 `mp-story`/`mp-voice` 写入脱敏的 `apiStats`，不能依赖此 action 判断第三方服务真实可用性。

### 10.9 后台查询接口（建议新增）

当前后台还没有完整的分页查询 action，不能依赖用户端 `getUserData` 作为管理数据接口。建议增加以下接口：

| action | 参数 | 返回 | 权限 |
| --- | --- | --- | --- |
| `dashboard` | `adminToken`、`dateRange` | `stats`、API 延迟摘要、任务失败数 | 管理员 |
| `listUsers` | `adminToken`、`page`、`pageSize`、`keyword` | 用户脱敏列表 | 管理员 |
| `listStories` | `adminToken`、`page`、`pageSize`、`status` | 故事摘要列表 | 管理员 |
| `listGenerationJobs` | `adminToken`、`page`、`pageSize`、`status` | 任务状态和失败原因 | 管理员 |
| `listAssets` | `adminToken`、`page`、`pageSize`、`kind`、`status` | 资源大小和处理状态 | 管理员 |
| `listAuditLogs` | `adminToken`、`page`、`pageSize`、`status` | 脱敏审核记录 | 审核员/超级管理员 |

### 10.10 `mp-admin.reset`

状态：禁止上线调用。

虽然本地代码存在该 action，项目监工规则明确禁止调用 `admin/reset`。生产验收不允许把它作为初始化、修复或迁移手段；初始数据应使用一次性的 `mp-seed.run` 或受审查的迁移脚本，并在播种后删除/禁用临时入口。

## 11. `mp-seed.run`：一次性测试数据播种

状态：临时函数。

请求：`{ "action":"run" }`。

返回：`{ "success":true, "added": 0 }`。

业务逻辑：显式创建全局集合并写入 `templates`、`config`、`stats`、`sensitiveWordsConfig`、`cdkeys`、`admins`。不能把 `mp-seed` 留在生产函数列表，也不能用它覆盖用户数据。

## 12. 旧 HTTP 路径到云函数的映射

`miniprogram/src/utils/request.ts` 当前保留的路径映射如下。小程序上线时不应再依赖 `localhost:3000` 或 CloudRun 临时服务。

| 旧路径 | 云函数 action |
| --- | --- |
| `/api/auth/wx-login` | `mp-user.login` |
| `/api/db` | `mp-user.getUserData` |
| `/api/profile` | `mp-user.updateProfile` |
| `/api/config` | `mp-user.updateConfig`（必须改为管理员权限） |
| `/api/notifications/read-all` | `mp-user.notifReadAll` |
| `/api/notifications/:id` | `mp-user.notifDelete` |
| `/api/stats/play` | `mp-user.statsPlay` |
| `/api/voice/clone` | `mp-voice.clone` |
| `/api/voice/delete` | `mp-voice.delete` |
| `/api/cdkey/redeem` | `mp-cdkey.redeem` |
| `/api/referral/bind` | `mp-cdkey.bind` |
| `/api/story/generate-text` | `mp-story.generateText` |
| `/api/story/generate-audio` | `mp-story.generateAudio` |
| `/api/story/audio-status/:jobId` | `mp-story.audioStatus` |
| `/api/story/save-toggle` | `mp-story.saveToggle` |
| `/api/story/rename` | `mp-story.rename` |
| `/api/story/delete` | `mp-story.delete` |
| `/api/admin/login` | `mp-admin.login` |
| `/api/admin/register` | `mp-admin.register` |
| `/api/admin/template/add` | `mp-admin.template/add` |
| `/api/admin/template/delete` | `mp-admin.template/delete` |
| `/api/admin/template/toggle-recommend` | `mp-admin.template/toggle-recommend` |
| `/api/admin/safety-config/update` | `mp-admin.safety-config/update` |
| `/api/admin/safety-config/audit-resolve` | `mp-admin.safety-config/audit-resolve` |
| `/api/admin/reset` | 禁止使用 |

## 13. 上线前接口验收清单

### 用户链路

- [ ] 新用户首次 `login` 自动创建 `users`，重复登录不重复创建。
- [ ] `getHomeData` 不返回管理员、敏感词、兑换码原文和第三方密钥。
- [ ] 资料更新只影响当前 OPENID，通知能正确写入。
- [ ] 故事列表分页、详情权限和收藏/删除均通过跨用户测试。
- [ ] 录音上传路径、大小、格式和归属校验通过。

### 生成链路

- [ ] 主题 + 场景命中模板，未命中时生成动态模板策略。
- [ ] `coverPrompt` 与 `chapters[].imagePrompt` 独立生成，封面不包含章节事件，内页包含当前章节动作。
- [ ] 文本生成安全拦截、改写建议、输出拦截和退款均有测试。
- [ ] 图片实际压缩为目标格式，返回响应不含 Base64 或原始大图。
- [ ] 有声请求先返回 `jobId`，前端能读取任务状态；不会等待 TTS/FFmpeg/BGM 混音后才返回。
- [ ] 白噪音默认 `none`，选择后由播放器单独播放，不修改旁白文件。
- [ ] 相同 `inputHash` 重复提交不会重复扣费或重复生成。

### 管理链路

- [ ] 管理员登录、角色校验、会话过期和退出策略通过测试。
- [ ] `updateConfig` 普通用户调用失败。
- [ ] 模板下线不破坏历史故事引用。
- [ ] 兑换码并发兑换只成功一次。
- [ ] `admin/reset` 未被部署验收流程调用。

## 14. 当前核对结论

本地正式目录已经有 `mp-user`、`mp-story`、`mp-voice`、`mp-cdkey`、`mp-admin` 和临时 `mp-seed` 云函数代码，且小程序请求层已映射到 CloudBase。本文只完成接口和数据契约文档，不代表 CloudBase 环境已经完成函数部署、集合创建、权限配置或真实 StepFun 密钥配置；这些需要在已认证的 CloudBase 控制台中逐项核验。
