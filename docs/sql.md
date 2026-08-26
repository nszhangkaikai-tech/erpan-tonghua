# 耳畔童话云开发 NoSQL 数据设计与测试数据

> 适用项目：耳畔童话微信小程序
>
> 技术栈：微信云开发、微信云函数、CloudBase Legacy NoSQL、Cloud Storage
>
> 环境：`blacke-d7g0wczgza0632d5a`；小程序 AppID：`wx231962cec75efb9e`
>
> 本文的集合名与 `cloudfunctions/common/db.js`、`cloudfunctions/*/index.js` 当前使用的名称保持一致。CloudBase NoSQL 没有固定 Schema，但生产数据必须遵循本文字段、类型和归属约定。

## 1. 设计约定

### 1.1 主键、归属与时间

- CloudBase 自动字段 `_id` 为字符串。需要通过 `doc(id)` 读取的业务对象，统一让 `_id` 与业务 `id` 相同；`users` 直接使用微信 `openid` 作为 `_id`。
- 所有用户数据都必须有 `openid`，并且只能由云函数从 `cloud.getWXContext().OPENID` 获取，不能信任前端传入的 `ownerId`、`userId` 或 `openid`。
- 时间字段统一使用 ISO-8601 字符串，例如 `2026-07-21T09:00:00.000Z`。这样 JSON 导入、云函数和小程序的排序规则一致；如果后续改用 CloudBase Date 类型，必须一次性迁移所有同名字段。
- 现有旧数据中同时出现 `ownerId`、`userId` 和 `openid`。生产集合以 `openid` 为唯一归属字段，迁移期间可保留兼容字段，但新代码不得继续写入 `ownerId`。
- 图片、录音、音频只保存 Cloud Storage `fileID`/`storageKey` 和大小、哈希等元数据，禁止把 Base64 或二进制直接写入 NoSQL。

### 1.2 业务状态枚举

| 字段 | 可选值 |
| --- | --- |
| `generationJobs.status` | `queued`、`compressing`、`tts_generating`、`mixing`、`ready`、`failed` |
| `assets.kind` | `image`、`audio`、`voice_sample` |
| `assets.status` | `processing`、`ready`、`failed` |
| `voiceClones.speakerType` | `father`、`mother`、`grandfather`、`grandmother`、`custom` |
| `userStories.voiceMode` | `single`、`multi`、`narrator_ai` |
| `userStories.duration` | `short`、`medium`、`long`；自定义长篇可用 `long_10m` 形式 |
| `notifications.type` | `system`、`story`、`voice`、`card`、`referral` |
| `invitationRecords.status` | `pending`、`success` |
| `quotaLedger.resourceType` | `story_generation`、`voice_clone`、`cdkey_times`、`invite_reward`、`refund` |

### 1.3 集合分层

| 层级 | 集合 | 说明 |
| --- | --- | --- |
| 用户业务 | `users`、`voiceClones`、`userStories`、`notifications` | 按 `openid` 隔离，面向小程序 |
| 生成与资源 | `generationJobs`、`assets` | 异步任务状态和云存储元数据 |
| 权益与运营 | `quotaLedger`、`invitationRecords`、`cdkeys` | 额度、邀请、兑换码 |
| 全局配置 | `templates`、`config`、`stats`、`sensitiveWordsConfig` | 由管理员或受信任云函数维护 |
| 管理与观测 | `admins`、`adminSessions`、`apiStats` | 只允许管理端云函数访问 |

## 2. 集合结构

### 2.1 `users`：用户、孩子档案和权益

每个微信用户一条文档。当前实现把 profile 和 rights 嵌入用户文档，暂不单独建立 `profiles` 集合。

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `_id` | string | 是 | `openid` | 文档主键；必须等于 `openid` |
| `id` | string | 否 | `user_` + hash | 业务用户 ID，兼容后台展示 |
| `openid` | string | 是 | 云函数上下文 OPENID | 用户归属，唯一 |
| `nickname` | string | 是 | `小宝贝家长` | 微信或用户自定义昵称，最多 20 字 |
| `avatar` | string | 否 | `parent` | 仅保存安全的头像标识，不保存不可信脚本 |
| `profile` | object | 是 | `{}` | 孩子档案 |
| `profile.nickname` | string | 否 | `小宝贝` | 孩子昵称 |
| `profile.age` | number | 否 | `4` | 2–9 岁，整数 |
| `profile.gender` | string | 否 | `other` | `boy`、`girl`、`other` |
| `profile.interests` | string[] | 否 | `[]` | 兴趣标签 |
| `profile.parentName` | string | 否 | `家长` | 家长称呼 |
| `profile.bedTime` | string | 否 | `21:00` | `HH:mm` |
| `rights` | object | 是 | 见下方 | 当前权益快照 |
| `rights.freeVoiceClonesRemaining` | number | 是 | `5` | 免费声纹次数 |
| `rights.storyGenerationsRemaining` | number | 是 | `3` | 故事生成次数；VIP 可不扣减 |
| `rights.isVip` | boolean | 是 | `false` | 是否 VIP |
| `rights.vipExpiry` | string/null | 否 | `null` | VIP 到期时间 |
| `rights.inviteCode` | string | 是 | 随机生成 | 用户自己的邀请码 |
| `rights.usedInviteCode` | string/null | 否 | `null` | 已绑定的邀请码；只能绑定一次 |
| `createdAt` | string | 是 | 当前时间 | 创建时间 |
| `updatedAt` | string | 否 | 当前时间 | 最近更新时间 |

### 2.2 `templates`：绘本模板

模板必须同时保存封面策略和内页策略。两者可以共享 `visualStyle`，但不能把 `coverPromptSeed` 当作 `contentPromptSeed` 使用。

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `_id` | string | 否 | CloudBase 自动生成 | 推荐与 `id` 相同 |
| `id` | string | 是 | `tpl_` 前缀 | 业务模板 ID |
| `name` | string | 是 | `未命名模板` | 模板名称 |
| `cover` | string | 是 | 空字符串 | 封面预览 URL 或 Cloud Storage fileID |
| `ageGroup` | string | 是 | `3-6岁` | 适用年龄段 |
| `theme` | string | 是 | `睡前安抚` | 主题 |
| `educationalGoal` | string | 是 | `情绪放松` | 教育目标 |
| `scene` | string | 是 | `温馨家庭` | 故事场景 |
| `mainCharacter` | object | 是 | `{}` | 默认主角 |
| `mainCharacter.name` | string | 是 | `小宝贝` | 主角名 |
| `mainCharacter.role` | string | 是 | `小伙伴` | 身份/物种 |
| `mainCharacter.personality` | string | 是 | `活泼可爱` | 性格 |
| `duration` | string | 是 | `short` | `short`、`medium`、`long` |
| `description` | string | 是 | 空字符串 | 面向家长的简介 |
| `isRecommended` | boolean | 是 | `false` | 首页/列表是否推荐 |
| `useCount` | number | 是 | `0` | 使用次数，仅云函数可递增 |
| `visualStyle` | object | 是 | 默认童话风格 | 封面和内页共用的视觉连续性约束 |
| `visualStyle.medium` | string | 是 | `soft digital storybook illustration` | 画面媒介/质感 |
| `visualStyle.palette` | string | 是 | 柔和儿童色 | 色盘 |
| `visualStyle.lighting` | string | 是 | 柔和安全光线 | 光照 |
| `visualStyle.characterContinuity` | string | 是 | 固定角色外观 | 跨页面角色一致性 |
| `coverPromptSeed` | string | 是 | 封面策略 | 突出整体氛围、焦点角色和吸引力，不描绘具体章节事件 |
| `contentPromptSeed` | string | 是 | 内页策略 | 聚焦当前章节动作、表情和情节推进 |
| `chapterBeats` | string[] | 是 | `[]` | 章节节奏节点 |
| `createdAt` | string | 否 | 当前时间 | 创建时间 |
| `updatedAt` | string | 否 | 当前时间 | 更新时间 |

### 2.3 `userStories`：用户绘本与有声绘本

章节内嵌在故事文档中，避免播放单章时多次查询。故事详情返回给小程序前，应把 `cloud://` fileID 换成临时 URL，并按需投影字段。

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `_id` | string | 是 | `story_` + ID | 必须可被 `doc(id)` 读取 |
| `id` | string | 是 | `story_` + ID | 业务故事 ID |
| `openid` | string | 是 | 上下文 OPENID | 故事归属 |
| `title` | string | 是 | `未命名故事` | 标题 |
| `abstract` | string | 是 | 空字符串 | 故事摘要 |
| `chapters` | object[] | 是 | `[]` | 内页章节数组 |
| `chapters[].chapterNumber` | number | 是 | 从 1 开始 | 章节号 |
| `chapters[].title` | string | 是 | `第 N 章` | 章节标题 |
| `chapters[].text` | string | 是 | 空字符串 | 章节正文 |
| `chapters[].imageUrl` | string | 是 | 空字符串 | 压缩后图片 fileID/临时 URL |
| `chapters[].imagePrompt` | string | 否 | 空字符串 | 独立内页图片提示词 |
| `chapters[].audioUrl` | string | 否 | 空字符串 | 旁白音频 fileID/临时 URL |
| `chapters[].audioAssetId` | string | 否 | 空字符串 | 对应 `assets.id` |
| `chapters[].audioSizeBytes` | number | 否 | `0` | 音频大小 |
| `coverUrl` | string | 是 | 空字符串 | 压缩后封面 fileID/临时 URL |
| `coverAssetId` | string | 否 | 空字符串 | 对应 `assets.id` |
| `coverPrompt` | string | 否 | 空字符串 | 独立封面图片提示词 |
| `templateId` | string | 否 | `tpl_dynamic` | 使用的模板 |
| `visualStyle` | object | 否 | 模板视觉风格 | 封面和内页的连续性约束 |
| `isAudioReady` | boolean | 是 | `false` | 是否所有章节音频可播放 |
| `voiceId` | string | 是 | `voice_default_mom` | 声音 ID |
| `voiceMode` | string | 是 | `single` | 声音模式 |
| `isSavedToDiary` | boolean | 是 | `false` | 是否保存到故事日记本 |
| `isFavorite` | boolean | 是 | `false` | 是否收藏 |
| `theme` | string | 是 | `睡前安抚` | 主题 |
| `educationalGoal` | string | 是 | `情绪放松` | 教育目标 |
| `scene` | string | 是 | `温馨家庭` | 场景 |
| `mainCharacterName` | string | 是 | `主角` | 主角名 |
| `duration` | string | 是 | `short` | 故事时长档位 |
| `targetAge` | number | 是 | `4` | 目标年龄 |
| `bgmType` | string | 是 | `none` | `none` 或固定白噪音标识；白噪音由播放器单独播放 |
| `createdAt` | string | 是 | 当前时间 | 创建时间 |
| `updatedAt` | string | 否 | 当前时间 | 更新时间 |

### 2.4 `generationJobs`：生成任务

文本生成可以同步返回预览；有声生成、图片处理等耗时流程必须使用任务文档，先返回 `jobId`，再由小程序订阅/轮询状态。

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `_id` | string | 是 | `job_` + ID | 任务主键 |
| `id` | string | 否 | 与 `_id` 相同 | 兼容旧数据 |
| `openid` | string | 是 | 上下文 OPENID | 任务归属 |
| `inputHash` | string | 是 | 输入哈希 | 用于幂等和去重 |
| `storyTitle` | string | 是 | `未命名故事` | 故事标题快照 |
| `storyAbstract` | string | 否 | 空字符串 | 故事摘要快照 |
| `coverUrl` | string | 否 | 空字符串 | 输入/输出封面 |
| `chapters` | object[] | 是 | `[]` | 章节快照，避免任务期间依赖前端状态 |
| `voiceId` | string | 否 | `voice_default_mom` | 音色 |
| `voiceMode` | string | 否 | `single` | 音色模式 |
| `bgmType` | string | 否 | `none` | 固定白噪音选择，不进入旁白文件 |
| `theme` | string | 是 | `睡前安抚` | 主题 |
| `educationalGoal` | string | 是 | `情绪放松` | 教育目标 |
| `scene` | string | 是 | `温馨家庭` | 场景 |
| `mainCharacterName` | string | 是 | `主角` | 主角名 |
| `duration` | string | 是 | `short` | 时长档位 |
| `targetAge` | number | 是 | `4` | 目标年龄 |
| `status` | string | 是 | `queued` | 任务状态枚举 |
| `progress` | number | 是 | `0` | 0–100 |
| `resultStoryId` | string/null | 否 | `null` | 完成后关联故事 |
| `errorMessage` | string/null | 否 | `null` | 面向日志的错误摘要，不能写密钥 |
| `createdAt` | string | 是 | 当前时间 | 创建时间 |
| `updatedAt` | string | 是 | 当前时间 | 更新时间 |

### 2.5 `voiceClones`：声纹

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `_id` | string | 是 | `voice_` + ID | 声纹主键 |
| `id` | string | 是 | 与 `_id` 相同 | 业务 ID |
| `openid` | string | 是 | 上下文 OPENID | 归属 |
| `name` | string | 是 | 空字符串 | 声音昵称，先做敏感词校验 |
| `speakerType` | string | 是 | `custom` | 家庭成员类型 |
| `recordDuration` | number | 是 | `30` | 录音秒数 |
| `fileID` | string | 否 | 空字符串 | 原始录音的私有存储 fileID |
| `stepfunVoiceId` | string | 否 | 空字符串 | 第三方声纹 ID，仅云函数可读取 |
| `stepfunSucceeded` | boolean | 否 | `false` | 是否真实克隆成功 |
| `isReady` | boolean | 是 | `false` | 是否可用于故事音频 |
| `usageCount` | number | 是 | `0` | 使用次数 |
| `createTime` | string | 是 | 当前时间 | 创建时间，兼容现有字段 |
| `updatedAt` | string | 否 | 当前时间 | 更新时间 |

### 2.6 `assets`：图片、音频和录音元数据

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `_id` | string | 是 | `asset_`/`aud_` + ID | 资源元数据主键 |
| `id` | string | 是 | 与 `_id` 相同 | 业务资源 ID |
| `openid` | string | 是 | 上下文 OPENID | 归属；全局模板资源可用 `system` |
| `kind` | string | 是 | `image` | `image`、`audio`、`voice_sample` |
| `storageKey` | string | 是 | 空字符串 | 云存储路径 |
| `fileID` | string | 是 | 空字符串 | Cloud Storage fileID |
| `mimeType` | string | 是 | `application/octet-stream` | MIME |
| `sizeBytes` | number | 是 | `0` | 压缩后大小 |
| `width` | number | 否 | `0` | 图片宽度 |
| `height` | number | 否 | `0` | 图片高度 |
| `durationMs` | number | 否 | `0` | 音频时长，仅作展示元数据 |
| `sha256` | string | 是 | 空字符串 | 内容哈希，用于去重 |
| `status` | string | 是 | `processing` | 处理状态 |
| `createdAt` | string | 是 | 当前时间 | 创建时间 |
| `updatedAt` | string | 是 | 当前时间 | 更新时间 |

### 2.7 `notifications`：用户通知

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `_id` | string | 是 | `notif_` + ID | 通知主键 |
| `id` | string | 是 | 与 `_id` 相同 | 业务 ID |
| `openid` | string | 是 | 上下文 OPENID | 接收用户 |
| `title` | string | 是 | 空字符串 | 标题 |
| `content` | string | 是 | 空字符串 | 内容 |
| `type` | string | 是 | `system` | 通知类型 |
| `isRead` | boolean | 是 | `false` | 是否已读 |
| `createdAt` | string | 是 | 当前时间 | 创建时间 |

### 2.8 `quotaLedger`：权益流水

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `_id` | string | 否 | CloudBase 自动生成 | 流水主键 |
| `id` | string | 是 | `qle_` + ID | 业务流水 ID |
| `openid` | string | 是 | 上下文 OPENID | 归属 |
| `userId` | string | 否 | 与 `openid` 相同 | 兼容旧数据 |
| `resourceType` | string | 是 | 空字符串 | 资源类型 |
| `amount` | number | 是 | `0` | 正数增加、负数消耗 |
| `balanceAfter` | number | 是 | `0` | 操作后的对应余额 |
| `reason` | string | 是 | 空字符串 | 可审计原因 |
| `createdAt` | string | 是 | 当前时间 | 创建时间 |

### 2.9 `invitationRecords`：邀请关系

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `_id` | string | 否 | CloudBase 自动生成 | 关系主键 |
| `id` | string | 是 | `invite_rec_` + ID | 业务 ID |
| `referrerId` | string | 是 | 邀请码或邀请人标识 | 当前实现保存邀请码；后续建议增加 `referrerOpenid` |
| `referrerOpenid` | string | 否 | `null` | 推荐的真实用户归属字段 |
| `referredId` | string | 是 | 当前用户 OPENID | 被邀请人 |
| `referredName` | string | 是 | `用户` | 展示名快照 |
| `status` | string | 是 | `pending` | 邀请状态 |
| `rewardValue` | number | 是 | `2` | 奖励故事次数 |
| `createdAt` | string | 是 | 当前时间 | 创建时间 |
| `completedAt` | string/null | 否 | `null` | 完成时间 |

### 2.10 `cdkeys`：兑换码

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `_id` | string | 否 | CloudBase 自动生成 | 文档主键 |
| `code` | string | 是 | 空字符串 | 大写兑换码，必须唯一 |
| `type` | string | 是 | `times` | `times` 或 `vip` |
| `value` | number | 是 | `0` | 次数或 VIP 天数 |
| `isUsed` | boolean | 是 | `false` | 是否已兑换 |
| `usedBy` | string/null | 否 | `null` | 兑换人 OPENID；旧数据可能是展示名 |
| `usedAt` | string/null | 否 | `null` | 兑换时间；旧字段 `usedTime` 只读兼容 |
| `channel` | string | 是 | `测试渠道` | 发放渠道 |
| `createdAt` | string | 是 | 当前时间 | 创建时间 |

### 2.11 `config`：全局创建配置

只允许一条文档，由云函数或管理端维护；普通用户不应直接写入。

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `_id` | string | 否 | 固定 `global` | 推荐固定文档 ID |
| `themes` | string[] | 是 | `[]` | 主题列表 |
| `educationalGoals` | object | 是 | `{}` | 主题到教育目标数组的映射 |
| `scenes` | string[] | 是 | `[]` | 场景列表 |
| `updatedAt` | string | 是 | 当前时间 | 更新时间 |

### 2.12 `stats`：全局统计

只允许一条文档。计数必须使用 CloudBase `_.inc()`，不能用“读出后加一再写回”的非原子流程。

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `_id` | string | 否 | 固定 `global` | 统计文档 ID |
| `todayNewUsers` | number | 是 | `0` | 今日新增 |
| `todayActiveUsers` | number | 是 | `0` | 今日活跃 |
| `profileCompletedCount` | number | 是 | `0` | 完成档案数 |
| `voiceClonedCount` | number | 是 | `0` | 克隆次数 |
| `textStoriesGenerated` | number | 是 | `0` | 文本生成数 |
| `audioStoriesGenerated` | number | 是 | `0` | 有声生成数 |
| `storiesPlayedCount` | number | 是 | `0` | 播放次数 |
| `storiesSavedCount` | number | 是 | `0` | 保存数 |
| `cdkeysRedeemedCount` | number | 是 | `0` | 兑换数 |
| `vipsActivatedCount` | number | 是 | `0` | VIP 激活数 |
| `invitesBoundCount` | number | 是 | `0` | 邀请绑定数 |
| `invitesCompletedCount` | number | 是 | `0` | 邀请完成数 |
| `updatedAt` | string | 是 | 当前时间 | 更新时间 |

### 2.13 `sensitiveWordsConfig`：安全配置与审计

只允许管理员云函数访问。`originalInput` 可能含敏感内容，后台展示时应脱敏，不能返回小程序。

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `_id` | string | 否 | 固定 `global` | 配置文档 ID |
| `categories` | object[] | 是 | `[]` | `{key,name,handling}` |
| `sensitiveWords` | object[] | 是 | `[]` | `{word,category}` |
| `auditLogs` | object[] | 是 | `[]` | `{id,timestamp,type,processedInput,actionTaken,category,status,message}`；原文仅后台受控读取 |
| `updatedAt` | string | 是 | 当前时间 | 更新时间 |

### 2.14 `apiStats`：接口调用统计

只允许管理员云函数写入和读取。不要把第三方密钥、完整提示词或音频文本写入日志。

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `_id` | string | 否 | CloudBase 自动生成 | 文档主键 |
| `id` | string | 是 | `apistat_` + ID | 统计记录 ID |
| `type` | string | 是 | `other` | `gemini`、`tts`、`clone`、`other` |
| `endpoint` | string | 是 | 空字符串 | 逻辑接口名 |
| `service` | string | 是 | 空字符串 | 外部服务名 |
| `status` | number | 是 | `200` | 调用结果 |
| `latencyMs` | number | 是 | `0` | 延迟 |
| `tokens` | number | 否 | `0` | 文本 token；音频可为 0 |
| `message` | string | 否 | 空字符串 | 脱敏摘要 |
| `createdAt` | string | 是 | 当前时间 | 创建时间 |

### 2.15 `admins`：管理员账号

密码只能保存带盐哈希，绝不保存明文；生产建议迁移到 CloudBase Auth + 管理员角色，减少自建账号风险。

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `_id` | string | 否 | CloudBase 自动生成 | 文档主键 |
| `username` | string | 是 | 空字符串 | 唯一管理员名 |
| `password` | string | 是 | 空字符串 | `sha256:<hex>`，不能是明文 |
| `role` | string | 是 | `operator` | `super_admin`、`operator`、`reviewer` |
| `createdAt` | string | 是 | 当前时间 | 创建时间 |
| `updatedAt` | string | 否 | 当前时间 | 更新时间 |

### 2.16 `adminSessions`：管理端会话

该集合不能开放给任何客户端。当前代码保存会话 token；生产建议只保存 token 哈希并设置 TTL/清理任务。

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `_id` | string | 否 | CloudBase 自动生成 | 文档主键 |
| `tokenHash` | string | 是 | 空字符串 | 推荐值；兼容旧代码的 `token` 不应暴露 |
| `username` | string | 是 | 空字符串 | 管理员名 |
| `createdAt` | string | 是 | 当前时间 | 创建时间 |
| `expiresAt` | string | 是 | 8 小时后 | 过期时间 |

## 3. 关联关系

| 关系 | 基数 | 关联字段 | 说明 |
| --- | --- | --- | --- |
| 用户 → 声纹 | 1:N | `users._id/openid` → `voiceClones.openid` | 一个用户可有多个家庭声纹 |
| 用户 → 故事 | 1:N | `users._id/openid` → `userStories.openid` | 故事只能被所属用户读取和修改 |
| 用户 → 生成任务 | 1:N | `users._id/openid` → `generationJobs.openid` | 任务状态轮询必须带归属过滤 |
| 用户 → 通知 | 1:N | `users._id/openid` → `notifications.openid` | 未读数按 `openid,isRead` 查询 |
| 用户 → 权益流水 | 1:N | `users._id/openid` → `quotaLedger.openid` | 余额快照与流水可对账 |
| 用户 → 资源 | 1:N | `users._id/openid` → `assets.openid` | 原始录音、封面、章节图、章节音频 |
| 用户 → 邀请记录 | 1:N | `users._id/openid` → `invitationRecords.referredId` | `referrerOpenid` 后续补齐 |
| 模板 → 故事 | 1:N | `templates.id` → `userStories.templateId` | 生成时保存模板快照 ID |
| 故事 → 生成任务 | 1:N/0:N | `userStories.id` ← `generationJobs.resultStoryId` | 重试和音频任务可产生多条任务 |
| 故事 → 资源 | 1:N | `userStories.coverAssetId`、`chapters[].audioAssetId` → `assets.id` | 资源表存大小与状态 |
| 兑换码 → 兑换用户 | 1:0..1 | `cdkeys.code` → `cdkeys.usedBy` | 兑换必须条件更新，防并发重复领取 |

## 4. 推荐索引

CloudBase 控制台创建索引时，以实际控制台字段格式为准；下面是逻辑索引，不代表可以跳过权限规则。

| 集合 | 索引字段 | 用途 |
| --- | --- | --- |
| `templates` | `isRecommended asc, useCount desc` | 首页推荐模板 |
| `templates` | `theme asc, scene asc, ageGroup asc` | 主题+场景筛选 |
| `userStories` | `openid asc, createTime desc` | 故事日记本分页 |
| `userStories` | `openid asc, isSavedToDiary asc, createTime desc` | 已保存故事 |
| `userStories` | `openid asc, isFavorite asc, createTime desc` | 收藏列表 |
| `generationJobs` | `openid asc, inputHash asc` | 幂等去重 |
| `generationJobs` | `openid asc, status asc, updatedAt desc` | 任务列表和恢复 |
| `voiceClones` | `openid asc, createTime desc` | 录音室列表 |
| `notifications` | `openid asc, isRead asc, createdAt desc` | 未读通知和时间排序 |
| `quotaLedger` | `openid asc, createdAt desc` | 额度对账 |
| `invitationRecords` | `referredId asc, createdAt desc` | 我的邀请关系 |
| `cdkeys` | `code asc`（唯一） | 兑换码查询 |
| `assets` | `openid asc, kind asc, createdAt desc` | 用户资源清理和列表 |
| `apiStats` | `createdAt desc` | 管理端统计 |
| `adminSessions` | `expiresAt asc` | 过期会话清理 |

## 5. 权限与安全规则

当前小程序统一通过云函数调用，建议生产集合全部关闭客户端写权限，仅对确需直读的公共配置开放只读。

| 集合 | 小程序客户端 | 云函数 | 管理端云函数 |
| --- | --- | --- | --- |
| `users` | 禁止直写；如直读必须 `openid == auth.openid` | 读写本人 | 按最小字段读 |
| `voiceClones`、`userStories`、`notifications`、`generationJobs`、`assets`、`quotaLedger` | 禁止直写 | 只读写本人 | 受控查询 |
| `templates`、`config` | 可只读公开字段，或统一由 `mp-user` 返回 | 读 | 读写 |
| `cdkeys`、`invitationRecords` | 禁止直读 | 兑换/绑定原子操作 | 管理查询 |
| `sensitiveWordsConfig` | 禁止 | 仅安全检查函数读取必要字段 | 读写、审计处理 |
| `stats`、`apiStats` | 禁止 | 原子递增指定统计 | 读写 |
| `admins`、`adminSessions` | 禁止 | 管理函数内部使用 | 管理函数内部使用 |

必须落实的安全条件：

1. 任何用户查询都以云函数上下文 `OPENID` 为条件，不接受客户端传入的归属 ID。
2. `cdkeys` 兑换必须使用事务或条件更新：只有 `isUsed == false` 的文档才能变更为已使用并发放权益。
3. 邀请码绑定必须防止自邀、重复绑定和并发重复奖励；推荐人应保存 `referrerOpenid`，不能只保存邀请码字符串。
4. `admins.password`、`adminSessions.token/tokenHash`、`voiceClones.stepfunVoiceId` 不得返回小程序。
5. `sensitiveWordsConfig.auditLogs.originalInput` 只允许安全审核人员访问，并在后台展示时脱敏。
6. 所有第三方密钥（StepFun、微信 AppSecret、管理员盐值）只放云函数环境变量，不进入 JSON、前端包或日志。

## 6. 可直接按集合导入的测试数据

说明：以下每个 JSON 数组对应一个集合，可在 CloudBase 数据库导入时逐集合导入。日期使用字符串，和当前云函数代码一致；`cloud://demo/...` 是演示 fileID，真实环境需要替换成实际上传返回的 fileID。`admins` 中的哈希仅用于测试，生产必须重新生成并修改 `ADMIN_SALT`；`adminSessions` 不导入运行态会话。

### 6.1 `users`

```json
[
  {
    "_id": "openid_demo_001",
    "id": "user_demo_001",
    "openid": "openid_demo_001",
    "nickname": "小星妈妈",
    "avatar": "parent",
    "profile": {
      "nickname": "星星",
      "age": 4,
      "gender": "girl",
      "interests": ["月亮", "小动物", "拼图"],
      "parentName": "小星妈妈",
      "bedTime": "21:00"
    },
    "rights": {
      "freeVoiceClonesRemaining": 4,
      "storyGenerationsRemaining": 7,
      "isVip": false,
      "vipExpiry": null,
      "inviteCode": "BMTH-DEMO1",
      "usedInviteCode": null
    },
    "createdAt": "2026-07-18T08:00:00.000Z",
    "updatedAt": "2026-07-21T08:30:00.000Z"
  },
  {
    "_id": "openid_demo_002",
    "id": "user_demo_002",
    "openid": "openid_demo_002",
    "nickname": "乐乐爸爸",
    "avatar": "parent",
    "profile": {
      "nickname": "乐乐",
      "age": 7,
      "gender": "boy",
      "interests": ["恐龙", "太空", "积木"],
      "parentName": "乐乐爸爸",
      "bedTime": "21:30"
    },
    "rights": {
      "freeVoiceClonesRemaining": 0,
      "storyGenerationsRemaining": 0,
      "isVip": true,
      "vipExpiry": "2026-08-20T23:59:59.000Z",
      "inviteCode": "BMTH-DEMO2",
      "usedInviteCode": "BMTH-DEMO1"
    },
    "createdAt": "2026-07-10T08:00:00.000Z",
    "updatedAt": "2026-07-20T12:00:00.000Z"
  },
  {
    "_id": "openid_demo_003",
    "id": "user_demo_003",
    "openid": "openid_demo_003",
    "nickname": "新用户家长",
    "avatar": "parent",
    "profile": {},
    "rights": {
      "freeVoiceClonesRemaining": 5,
      "storyGenerationsRemaining": 3,
      "isVip": false,
      "vipExpiry": null,
      "inviteCode": "BMTH-DEMO3",
      "usedInviteCode": null
    },
    "createdAt": "2026-07-21T09:00:00.000Z",
    "updatedAt": "2026-07-21T09:00:00.000Z"
  }
]
```

### 6.2 `templates`

```json
[
  {
    "_id": "tpl_bedtime_family",
    "id": "tpl_bedtime_family",
    "name": "月光下的晚安抱抱",
    "cover": "https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?w=500&q=80",
    "ageGroup": "2-5岁",
    "theme": "睡前安抚",
    "educationalGoal": "情绪放松",
    "scene": "温馨家庭",
    "mainCharacter": {"name": "团团", "role": "需要晚安陪伴的小熊", "personality": "温柔敏感，喜欢听故事"},
    "duration": "short",
    "description": "把睡前的小小不安变成一个温暖的晚安仪式，让孩子在熟悉的家中安心入睡。",
    "isRecommended": true,
    "useCount": 128,
    "visualStyle": {"medium": "soft digital storybook illustration", "palette": "月光蓝、奶油白、柔和薰衣草紫", "lighting": "窗边月光与床头暖灯交织的柔和夜景", "characterContinuity": "团团保持圆耳朵、棕色绒毛、蓝色睡衣和月亮抱枕"},
    "coverPromptSeed": "a memorable central composition with one clear focal character, an inviting bedtime atmosphere, layered depth, and a beautiful storybook sense of wonder",
    "contentPromptSeed": "show the concrete action and emotional beat of this chapter, with a readable foreground, a supportive middle ground, and scene details that move the story forward",
    "chapterBeats": ["准备晚安仪式", "发现并表达不安", "在陪伴中放松入睡"],
    "createdAt": "2026-07-19T01:00:00.000Z",
    "updatedAt": "2026-07-21T08:00:00.000Z"
  },
  {
    "_id": "tpl_courage_castle",
    "id": "tpl_courage_castle",
    "name": "城堡里的第一步",
    "cover": "https://images.unsplash.com/photo-1519052537078-e6302a4968d4?w=500&q=80",
    "ageGroup": "4-7岁",
    "theme": "勇敢自信",
    "educationalGoal": "面对困难不退缩",
    "scene": "魔法城堡",
    "mainCharacter": {"name": "勇勇", "role": "第一次参加任务的小骑士", "personality": "认真善良，偶尔会紧张"},
    "duration": "medium",
    "description": "小骑士在朋友的鼓励下迈出第一步，理解勇敢不是不害怕，而是愿意试一试。",
    "isRecommended": true,
    "useCount": 96,
    "visualStyle": {"medium": "soft gouache storybook illustration", "palette": "天空蓝、暖橙、彩虹黄", "lighting": "明亮的晨光和魔法星尘", "characterContinuity": "勇勇保持银色小头盔、橙色披风和圆润的儿童绘本比例"},
    "coverPromptSeed": "one memorable focal character presenting the whole courage-and-wonder mood with an inviting magical hook",
    "contentPromptSeed": "show the exact challenge, action, facial expression, and next plot beat of the current chapter",
    "chapterBeats": ["接受小任务", "遇到需要尝试的难题", "用自己的方法完成挑战", "把勇气分享给朋友"],
    "createdAt": "2026-07-19T01:00:00.000Z",
    "updatedAt": "2026-07-21T08:00:00.000Z"
  },
  {
    "_id": "tpl_friendship_undersea",
    "id": "tpl_friendship_undersea",
    "name": "海底王国的分享日",
    "cover": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&q=80",
    "ageGroup": "3-6岁",
    "theme": "友情人际",
    "educationalGoal": "学会分享",
    "scene": "海底世界",
    "mainCharacter": {"name": "泡泡", "role": "喜欢收集贝壳的小海马", "personality": "聪明可爱，正在学习倾听"},
    "duration": "medium",
    "description": "一场海底分享日让小海马学会倾听伙伴、表达需要，并和朋友一起找到更好的办法。",
    "isRecommended": true,
    "useCount": 74,
    "visualStyle": {"medium": "soft digital underwater storybook", "palette": "海水蓝、珊瑚橙、珍珠白", "lighting": "清透水波光和温暖珊瑚光", "characterContinuity": "泡泡保持紫色小海马、黄色贝壳包和弯弯笑眼"},
    "coverPromptSeed": "an inviting whole-story friendship mood with one focal character and a playful underwater visual hook",
    "contentPromptSeed": "focus on the current sharing action, the characters' expressions, and the concrete consequence in the underwater scene",
    "chapterBeats": ["遇到分享难题", "听见朋友的心情", "一起寻找解决办法", "体会分享后的快乐"],
    "createdAt": "2026-07-19T01:00:00.000Z",
    "updatedAt": "2026-07-21T08:00:00.000Z"
  },
  {
    "_id": "tpl_emotion_forest",
    "id": "tpl_emotion_forest",
    "name": "森林里的心情天气",
    "cover": "https://images.unsplash.com/photo-1495107334309-fcf20504a5ab?w=500&q=80",
    "ageGroup": "3-6岁",
    "theme": "情绪管理",
    "educationalGoal": "识别情绪",
    "scene": "静谧森林",
    "mainCharacter": {"name": "芽芽", "role": "会观察心情的小鹿", "personality": "细腻好奇，愿意慢慢表达"},
    "duration": "short",
    "description": "小鹿把心情比作天气，在森林伙伴的陪伴下学会发现、说出并照顾自己的感受。",
    "isRecommended": true,
    "useCount": 88,
    "visualStyle": {"medium": "soft watercolor storybook", "palette": "雾霾蓝、蜜桃粉、薄荷绿", "lighting": "穿过树叶的柔和晨光与情绪色彩", "characterContinuity": "芽芽保持浅棕鹿毛、绿色围巾和小鹿角"},
    "coverPromptSeed": "an attractive whole-story emotional-weather mood with one gentle focal deer and a welcoming forest composition",
    "contentPromptSeed": "show the chapter's concrete feeling, named emotion, body language, and the next safe coping action",
    "chapterBeats": ["察觉心情变化", "给情绪找到名字", "用呼吸和倾诉让心情变轻"],
    "createdAt": "2026-07-19T01:00:00.000Z",
    "updatedAt": "2026-07-21T08:00:00.000Z"
  },
  {
    "_id": "tpl_habits_dinosaur",
    "id": "tpl_habits_dinosaur",
    "name": "恐龙乐园的滴答任务",
    "cover": "https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?w=500&q=80",
    "ageGroup": "3-6岁",
    "theme": "习惯养成",
    "educationalGoal": "规律作息",
    "scene": "恐龙乐园",
    "mainCharacter": {"name": "滴滴", "role": "爱把事情留到最后的小恐龙", "personality": "活泼热心，需要一点提醒"},
    "duration": "short",
    "description": "小恐龙用游戏化的小任务安排一天，逐渐发现规律作息能让每天都更轻松好玩。",
    "isRecommended": true,
    "useCount": 61,
    "visualStyle": {"medium": "cute soft 3D storybook illustration", "palette": "柠檬黄、青草绿、奶油橙", "lighting": "明亮晴朗的日间阳光", "characterContinuity": "滴滴保持绿色圆肚皮、橙色背刺和滴答手表"},
    "coverPromptSeed": "a playful whole-story routine-adventure mood with one charming dinosaur and a clear magical time hook",
    "contentPromptSeed": "show the exact habit task, the dinosaur's action, expression, and the immediate story consequence",
    "chapterBeats": ["发现时间被打乱", "把习惯变成闯关任务", "完成一项小习惯", "享受有秩序的一天"],
    "createdAt": "2026-07-19T01:00:00.000Z",
    "updatedAt": "2026-07-21T08:00:00.000Z"
  },
  {
    "_id": "tpl_cognition_space",
    "id": "tpl_cognition_space",
    "name": "星球上的颜色旅行",
    "cover": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&q=80",
    "ageGroup": "3-6岁",
    "theme": "认知启蒙",
    "educationalGoal": "颜色认知",
    "scene": "太空星球",
    "mainCharacter": {"name": "星星", "role": "喜欢观察颜色的小宇航员", "personality": "好奇专注，善于提问"},
    "duration": "short",
    "description": "跟着小宇航员穿梭彩色星球，在观察、比较和寻找的过程中认识身边的颜色。",
    "isRecommended": true,
    "useCount": 53,
    "visualStyle": {"medium": "soft colorful cosmic storybook", "palette": "湖水蓝、明黄、珊瑚红", "lighting": "星光与彩色星球反射出的清晰柔光", "characterContinuity": "星星保持白色太空服、黄色星形徽章和透明头盔"},
    "coverPromptSeed": "a bright whole-story discovery mood with one focal child astronaut and a colorful planet hook",
    "contentPromptSeed": "show the current color clue, the child's observation and comparison action, and the next discovery",
    "chapterBeats": ["发现颜色线索", "比较不同颜色", "把颜色和物品联系起来"],
    "createdAt": "2026-07-19T01:00:00.000Z",
    "updatedAt": "2026-07-21T08:00:00.000Z"
  }
]
```

### 6.3 `userStories`

```json
[
  {
    "_id": "story_demo_001",
    "id": "story_demo_001",
    "openid": "openid_demo_001",
    "title": "月光下的晚安抱抱",
    "abstract": "团团在温馨的家里发现了睡前的不安，在家人的陪伴下把月光变成了一个柔软的晚安抱抱。",
    "chapters": [
      {"chapterNumber": 1, "title": "床头的小月亮", "text": "团团洗好脸，抱着月亮抱枕来到床边。窗外的月光轻轻落在被角上，像一条银色的小毯子。", "imageUrl": "https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?w=500&q=80", "imagePrompt": "Create an interior children's picture-book illustration for chapter 1: bedtime preparation beside a warm lamp and moon pillow; preserve the cover character design."},
      {"chapterNumber": 2, "title": "把不安说出来", "text": "团团小声说自己有一点点紧张。家人没有催它睡觉，而是陪它数三颗星星，听它慢慢讲完心里的话。", "imageUrl": "https://images.unsplash.com/photo-1495107334309-fcf20504a5ab?w=500&q=80", "imagePrompt": "Create an interior children's picture-book illustration for chapter 2: the bear expresses a small worry while a caregiver listens; focus on facial expression and safe emotional connection."},
      {"chapterNumber": 3, "title": "晚安抱抱", "text": "团团做了一个深呼吸，发现房间里的每一样东西都在安静陪伴它。它钻进被窝，带着安心的笑容进入甜甜的梦乡。", "imageUrl": "https://images.unsplash.com/photo-1415604930972-5bc40a5953d8?w=500&q=80", "imagePrompt": "Create an interior children's picture-book illustration for chapter 3: the bear relaxes under moonlight and falls asleep peacefully; show the final emotional landing, not a cover composition."}
    ],
    "coverUrl": "https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?w=500&q=80",
    "coverPrompt": "Create an attractive portrait children's picture-book COVER for a gentle bedtime story: one focal bear, moonlight, warm home atmosphere, no specific chapter event, no text.",
    "templateId": "tpl_bedtime_family",
    "visualStyle": {"medium": "soft digital storybook illustration", "palette": "月光蓝、奶油白、柔和薰衣草紫", "lighting": "窗边月光与床头暖灯交织的柔和夜景", "characterContinuity": "团团保持圆耳朵、棕色绒毛、蓝色睡衣和月亮抱枕"},
    "isAudioReady": false,
    "voiceId": "voice_default_mom",
    "voiceMode": "single",
    "createTime": "2026-07-21T08:30:00.000Z",
    "isSavedToDiary": true,
    "isFavorite": true,
    "theme": "睡前安抚",
    "educationalGoal": "情绪放松",
    "scene": "温馨家庭",
    "mainCharacterName": "团团",
    "duration": "short",
    "targetAge": 4,
    "bgmType": "none"
  },
  {
    "_id": "story_demo_002",
    "id": "story_demo_002",
    "openid": "openid_demo_001",
    "title": "芽芽的心情天气",
    "abstract": "小鹿芽芽在森林里学会给心情找到名字，并用呼吸和倾诉让乌云慢慢散开。",
    "chapters": [
      {"chapterNumber": 1, "title": "今天是小雨天", "text": "芽芽发现自己的耳朵有点耷拉，心里像飘着小雨。它停下来，先观察自己的感觉。", "imageUrl": "https://images.unsplash.com/photo-1495107334309-fcf20504a5ab?w=500&q=80", "imagePrompt": "Interior forest page: the little deer notices a cloudy feeling, readable foreground and gentle morning light."},
      {"chapterNumber": 2, "title": "给心情取名字", "text": "朋友问芽芽要不要一起坐在树下。芽芽说：我现在有一点失望，也需要安静一会儿。说出来以后，它觉得心里轻了一点。", "imageUrl": "https://images.unsplash.com/photo-1415604930972-5bc40a5953d8?w=500&q=80", "imagePrompt": "Interior forest page: the deer names its feeling while a friend listens; concrete action and warm expressions."},
      {"chapterNumber": 3, "title": "风把云朵吹散", "text": "芽芽和朋友一起慢慢吸气、呼气，再去找一片喜欢的叶子。心情没有马上消失，却已经变得可以被照顾了。", "imageUrl": "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=500&q=80", "imagePrompt": "Interior forest page: breathing and choosing a leaf as a coping action; match the cover visual language."}
    ],
    "coverUrl": "https://images.unsplash.com/photo-1495107334309-fcf20504a5ab?w=500&q=80",
    "coverPrompt": "Create an attractive portrait children's picture-book COVER about emotions as weather: a gentle little deer in a welcoming forest, overall calm hopeful mood, no text.",
    "templateId": "tpl_emotion_forest",
    "visualStyle": {"medium": "soft watercolor storybook", "palette": "雾霾蓝、蜜桃粉、薄荷绿", "lighting": "穿过树叶的柔和晨光与情绪色彩", "characterContinuity": "芽芽保持浅棕鹿毛、绿色围巾和小鹿角"},
    "isAudioReady": true,
    "voiceId": "voice_demo_001",
    "voiceMode": "single",
    "createTime": "2026-07-20T13:00:00.000Z",
    "isSavedToDiary": true,
    "isFavorite": false,
    "theme": "情绪管理",
    "educationalGoal": "识别情绪",
    "scene": "静谧森林",
    "mainCharacterName": "芽芽",
    "duration": "short",
    "targetAge": 4,
    "bgmType": "rain_soft"
  },
  {
    "_id": "story_demo_003",
    "id": "story_demo_003",
    "openid": "openid_demo_002",
    "title": "星星的颜色旅行",
    "abstract": "小宇航员星星在三个彩色星球上寻找线索，完成了一次有趣的颜色认知旅行。",
    "chapters": [],
    "coverUrl": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&q=80",
    "coverPrompt": "Create an attractive portrait children's picture-book COVER about a curious child astronaut exploring colorful planets, overall discovery mood, no text.",
    "templateId": "tpl_cognition_space",
    "visualStyle": {"medium": "soft colorful cosmic storybook", "palette": "湖水蓝、明黄、珊瑚红", "lighting": "星光与彩色星球反射出的清晰柔光", "characterContinuity": "星星保持白色太空服、黄色星形徽章和透明头盔"},
    "isAudioReady": false,
    "voiceId": "voice_default_mom",
    "voiceMode": "single",
    "createTime": "2026-07-21T09:10:00.000Z",
    "isSavedToDiary": false,
    "isFavorite": false,
    "theme": "认知启蒙",
    "educationalGoal": "颜色认知",
    "scene": "太空星球",
    "mainCharacterName": "星星",
    "duration": "short",
    "targetAge": 7,
    "bgmType": "none"
  }
]
```

### 6.4 `generationJobs`

```json
[
  {"_id": "job_demo_queued", "id": "job_demo_queued", "openid": "openid_demo_001", "inputHash": "hash_demo_queued", "storyTitle": "正在准备的晚安故事", "storyAbstract": "等待生成文本", "coverUrl": "", "chapters": [], "voiceId": "voice_default_mom", "voiceMode": "single", "bgmType": "none", "theme": "睡前安抚", "educationalGoal": "情绪放松", "scene": "温馨家庭", "mainCharacterName": "星星", "duration": "short", "targetAge": 4, "status": "queued", "progress": 0, "resultStoryId": null, "errorMessage": null, "createdAt": "2026-07-21T09:20:00.000Z", "updatedAt": "2026-07-21T09:20:00.000Z"},
  {"_id": "job_demo_compress", "id": "job_demo_compress", "openid": "openid_demo_001", "inputHash": "hash_demo_compress", "storyTitle": "封面正在优化", "storyAbstract": "已生成文本，正在处理图片资源", "coverUrl": "https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?w=500&q=80", "chapters": [], "voiceId": "voice_default_mom", "voiceMode": "single", "bgmType": "none", "theme": "睡前安抚", "educationalGoal": "情绪放松", "scene": "温馨家庭", "mainCharacterName": "团团", "duration": "short", "targetAge": 4, "status": "compressing", "progress": 25, "resultStoryId": null, "errorMessage": null, "createdAt": "2026-07-21T09:18:00.000Z", "updatedAt": "2026-07-21T09:19:00.000Z"},
  {"_id": "job_demo_ready", "id": "job_demo_ready", "openid": "openid_demo_002", "inputHash": "hash_demo_ready", "storyTitle": "芽芽的心情天气", "storyAbstract": "有声故事已完成", "coverUrl": "cloud://blacke-d7g0wczgza0632d5a/images/openid_demo_002/cover.webp", "chapters": [], "voiceId": "voice_demo_002", "voiceMode": "single", "bgmType": "rain_soft", "theme": "情绪管理", "educationalGoal": "识别情绪", "scene": "静谧森林", "mainCharacterName": "芽芽", "duration": "short", "targetAge": 7, "status": "ready", "progress": 100, "resultStoryId": "story_demo_003", "errorMessage": null, "createdAt": "2026-07-20T13:00:00.000Z", "updatedAt": "2026-07-20T13:08:00.000Z"},
  {"_id": "job_demo_failed", "id": "job_demo_failed", "openid": "openid_demo_003", "inputHash": "hash_demo_failed", "storyTitle": "未完成的故事", "storyAbstract": "第三方音频服务超时", "coverUrl": "", "chapters": [], "voiceId": "voice_default_mom", "voiceMode": "single", "bgmType": "none", "theme": "勇敢自信", "educationalGoal": "面对困难不退缩", "scene": "魔法城堡", "mainCharacterName": "勇勇", "duration": "medium", "targetAge": 5, "status": "failed", "progress": 100, "resultStoryId": null, "errorMessage": "音频服务超时，请稍后重试", "createdAt": "2026-07-20T16:00:00.000Z", "updatedAt": "2026-07-20T16:06:00.000Z"}
]
```

### 6.5 `voiceClones`

```json
[
  {"_id": "voice_demo_001", "id": "voice_demo_001", "openid": "openid_demo_001", "name": "妈妈的晚安声", "speakerType": "mother", "recordDuration": 32, "fileID": "cloud://blacke-d7g0wczgza0632d5a/voice-samples/openid_demo_001/mom.wav", "stepfunVoiceId": "voice_provider_demo_001", "stepfunSucceeded": true, "isReady": true, "usageCount": 6, "createTime": "2026-07-19T10:00:00.000Z", "updatedAt": "2026-07-20T13:00:00.000Z"},
  {"_id": "voice_demo_002", "id": "voice_demo_002", "openid": "openid_demo_002", "name": "爸爸的冒险声", "speakerType": "father", "recordDuration": 30, "fileID": "cloud://blacke-d7g0wczgza0632d5a/voice-samples/openid_demo_002/dad.wav", "stepfunVoiceId": "", "stepfunSucceeded": false, "isReady": true, "usageCount": 2, "createTime": "2026-07-20T09:00:00.000Z", "updatedAt": "2026-07-20T09:02:00.000Z"},
  {"_id": "voice_demo_processing", "id": "voice_demo_processing", "openid": "openid_demo_003", "name": "正在准备的声音", "speakerType": "custom", "recordDuration": 28, "fileID": "cloud://blacke-d7g0wczgza0632d5a/voice-samples/openid_demo_003/custom.wav", "stepfunVoiceId": "", "stepfunSucceeded": false, "isReady": false, "usageCount": 0, "createTime": "2026-07-21T09:25:00.000Z", "updatedAt": "2026-07-21T09:25:00.000Z"}
]
```

### 6.6 `assets`

```json
[
  {"_id": "asset_demo_cover_001", "id": "asset_demo_cover_001", "openid": "openid_demo_001", "kind": "image", "storageKey": "images/openid_demo_001/cover_001.webp", "fileID": "cloud://blacke-d7g0wczgza0632d5a/images/openid_demo_001/cover_001.webp", "mimeType": "image/webp", "sizeBytes": 186420, "width": 768, "height": 1024, "sha256": "sha256-demo-cover-001", "status": "ready", "createdAt": "2026-07-21T08:31:00.000Z", "updatedAt": "2026-07-21T08:31:02.000Z"},
  {"_id": "asset_demo_page_001", "id": "asset_demo_page_001", "openid": "openid_demo_001", "kind": "image", "storageKey": "images/openid_demo_001/page_001.webp", "fileID": "cloud://blacke-d7g0wczgza0632d5a/images/openid_demo_001/page_001.webp", "mimeType": "image/webp", "sizeBytes": 142880, "width": 1024, "height": 768, "sha256": "sha256-demo-page-001", "status": "ready", "createdAt": "2026-07-21T08:31:03.000Z", "updatedAt": "2026-07-21T08:31:05.000Z"},
  {"_id": "asset_demo_audio_001", "id": "asset_demo_audio_001", "openid": "openid_demo_001", "kind": "audio", "storageKey": "audio/openid_demo_001/story_demo_002_ch_0.mp3", "fileID": "cloud://blacke-d7g0wczgza0632d5a/audio/openid_demo_001/story_demo_002_ch_0.mp3", "mimeType": "audio/mpeg", "sizeBytes": 284600, "durationMs": 62000, "sha256": "sha256-demo-audio-001", "status": "ready", "createdAt": "2026-07-20T13:05:00.000Z", "updatedAt": "2026-07-20T13:05:00.000Z"},
  {"_id": "asset_demo_processing", "id": "asset_demo_processing", "openid": "openid_demo_003", "kind": "image", "storageKey": "images/openid_demo_003/pending.webp", "fileID": "", "mimeType": "image/webp", "sizeBytes": 0, "width": 0, "height": 0, "sha256": "", "status": "processing", "createdAt": "2026-07-21T09:26:00.000Z", "updatedAt": "2026-07-21T09:26:00.000Z"}
]
```

### 6.7 `notifications`

```json
[
  {"_id": "notif_demo_001", "id": "notif_demo_001", "openid": "openid_demo_001", "title": "欢迎来到耳畔童话", "content": "完成孩子档案后，就可以生成更贴合年龄的绘本。", "type": "system", "isRead": false, "createdAt": "2026-07-21T08:00:00.000Z"},
  {"_id": "notif_demo_002", "id": "notif_demo_002", "openid": "openid_demo_001", "title": "故事封面已准备好", "content": "《月光下的晚安抱抱》的封面已经完成，可以继续预览。", "type": "story", "isRead": false, "createdAt": "2026-07-21T08:35:00.000Z"},
  {"_id": "notif_demo_003", "id": "notif_demo_003", "openid": "openid_demo_002", "title": "声音克隆成功", "content": "爸爸的冒险声已经可以用于有声故事。", "type": "voice", "isRead": true, "createdAt": "2026-07-20T09:05:00.000Z"},
  {"_id": "notif_demo_004", "id": "notif_demo_004", "openid": "openid_demo_003", "title": "生成遇到一点小插曲", "content": "本次任务没有扣除额外次数，可以稍后重新尝试。", "type": "story", "isRead": false, "createdAt": "2026-07-21T09:30:00.000Z"}
]
```

### 6.8 `quotaLedger`

```json
[
  {"_id": "qle_demo_001", "id": "qle_demo_001", "openid": "openid_demo_001", "userId": "openid_demo_001", "resourceType": "story_generation", "amount": -1, "balanceAfter": 8, "reason": "文本故事生成", "createdAt": "2026-07-21T08:20:00.000Z"},
  {"_id": "qle_demo_002", "id": "qle_demo_002", "openid": "openid_demo_001", "userId": "openid_demo_001", "resourceType": "voice_clone", "amount": -1, "balanceAfter": 4, "reason": "声音克隆", "createdAt": "2026-07-19T10:00:00.000Z"},
  {"_id": "qle_demo_003", "id": "qle_demo_003", "openid": "openid_demo_001", "userId": "openid_demo_001", "resourceType": "cdkey_times", "amount": 10, "balanceAfter": 9, "reason": "CDKey兑换:STORY-DEMO-10", "createdAt": "2026-07-18T12:00:00.000Z"},
  {"_id": "qle_demo_004", "id": "qle_demo_004", "openid": "openid_demo_002", "userId": "openid_demo_002", "resourceType": "invite_reward", "amount": 2, "balanceAfter": 2, "reason": "邀请绑定奖励", "createdAt": "2026-07-20T12:00:00.000Z"},
  {"_id": "qle_demo_005", "id": "qle_demo_005", "openid": "openid_demo_003", "userId": "openid_demo_003", "resourceType": "refund", "amount": 1, "balanceAfter": 3, "reason": "安全拦截退款(生成内容)", "createdAt": "2026-07-21T09:32:00.000Z"}
]
```

### 6.9 `invitationRecords`

```json
[
  {"_id": "invite_demo_001", "id": "invite_demo_001", "referrerId": "BMTH-DEMO1", "referrerOpenid": "openid_demo_001", "referredId": "openid_demo_002", "referredName": "乐乐爸爸", "status": "success", "rewardValue": 2, "createdAt": "2026-07-20T12:00:00.000Z", "completedAt": "2026-07-20T12:10:00.000Z"},
  {"_id": "invite_demo_002", "id": "invite_demo_002", "referrerId": "BMTH-DEMO1", "referrerOpenid": "openid_demo_001", "referredId": "openid_demo_003", "referredName": "新用户家长", "status": "pending", "rewardValue": 2, "createdAt": "2026-07-21T09:05:00.000Z", "completedAt": null}
]
```

### 6.10 `cdkeys`

```json
[
  {"_id": "cdkey_demo_times", "code": "STORY-DEMO-10", "type": "times", "value": 10, "isUsed": false, "usedBy": null, "usedAt": null, "channel": "测试社群", "createdAt": "2026-07-21T08:00:00.000Z"},
  {"_id": "cdkey_demo_vip", "code": "VIP-DEMO-7", "type": "vip", "value": 7, "isUsed": false, "usedBy": null, "usedAt": null, "channel": "测试活动", "createdAt": "2026-07-21T08:00:00.000Z"},
  {"_id": "cdkey_demo_used", "code": "USED-DEMO-2", "type": "times", "value": 2, "isUsed": true, "usedBy": "openid_demo_001", "usedAt": "2026-07-19T12:00:00.000Z", "channel": "测试社群", "createdAt": "2026-07-19T08:00:00.000Z"},
  {"_id": "cdkey_demo_vip_used", "code": "USED-VIP-30", "type": "vip", "value": 30, "isUsed": true, "usedBy": "openid_demo_002", "usedAt": "2026-07-10T08:00:00.000Z", "channel": "测试活动", "createdAt": "2026-07-10T08:00:00.000Z"}
]
```

### 6.11 `config`

```json
[
  {
    "_id": "global",
    "themes": ["睡前安抚", "勇敢自信", "友情人际", "情绪管理", "习惯养成", "认知启蒙"],
    "educationalGoals": {
      "睡前安抚": ["情绪放松", "独立安静入睡", "克服怕黑恐惧"],
      "勇敢自信": ["面对困难不退缩", "拥抱独特自我", "勇于尝试新事物"],
      "友情人际": ["学会分享", "倾听伙伴", "表达需要"],
      "情绪管理": ["识别情绪", "表达感受", "学会自我安抚"],
      "习惯养成": ["规律作息", "玩具物归原位", "拒绝拖拉磨蹭"],
      "认知启蒙": ["颜色认知", "观察比较", "认识自然" ]
    },
    "scenes": ["静谧森林", "温馨家庭", "魔法城堡", "海底世界", "恐龙乐园", "太空星球"],
    "updatedAt": "2026-07-21T08:00:00.000Z"
  }
]
```

### 6.12 `stats`

```json
[
  {"_id": "global", "todayNewUsers": 3, "todayActiveUsers": 18, "profileCompletedCount": 2, "voiceClonedCount": 2, "textStoriesGenerated": 11, "audioStoriesGenerated": 4, "storiesPlayedCount": 27, "storiesSavedCount": 9, "cdkeysRedeemedCount": 2, "vipsActivatedCount": 1, "invitesBoundCount": 2, "invitesCompletedCount": 1, "updatedAt": "2026-07-21T09:35:00.000Z"}
]
```

### 6.13 `sensitiveWordsConfig`

```json
[
  {
    "_id": "global",
    "categories": [
      {"key": "politics", "name": "政治敏感", "handling": "intercept"},
      {"key": "violence", "name": "暴力血腥", "handling": "rewrite"},
      {"key": "adult", "name": "涉黄低俗", "handling": "intercept"},
      {"key": "abuse", "name": "侮辱及不良引导", "handling": "rewrite"}
    ],
    "sensitiveWords": [
      {"word": "打架", "category": "violence"},
      {"word": "流血", "category": "violence"},
      {"word": "裸体", "category": "adult"},
      {"word": "笨蛋", "category": "abuse"}
    ],
    "auditLogs": [
      {"id": "audit_demo_001", "timestamp": "2026-07-21T09:30:00.000Z", "type": "input_check", "originalInput": "测试原文请仅限审核人员查看", "processedInput": "儿童友好改写建议", "actionTaken": "rewrite", "category": "violence", "status": "pending_review", "message": "测试安全审计记录"}
    ],
    "updatedAt": "2026-07-21T09:30:00.000Z"
  }
]
```

### 6.14 `apiStats`

```json
[
  {"_id": "apistat_demo_001", "id": "apistat_demo_001", "type": "gemini", "endpoint": "mp-story.generateText", "service": "StepFun Text", "status": 200, "latencyMs": 1450, "tokens": 980, "message": "success", "createdAt": "2026-07-21T09:10:00.000Z"},
  {"_id": "apistat_demo_002", "id": "apistat_demo_002", "type": "tts", "endpoint": "mp-story.generateAudio", "service": "StepFun TTS", "status": 200, "latencyMs": 3200, "tokens": 0, "message": "narration only; client white noise", "createdAt": "2026-07-21T09:12:00.000Z"},
  {"_id": "apistat_demo_003", "id": "apistat_demo_003", "type": "clone", "endpoint": "mp-voice.clone", "service": "StepFun Voice Clone", "status": 200, "latencyMs": 1800, "tokens": 0, "message": "success", "createdAt": "2026-07-21T09:15:00.000Z"}
]
```

### 6.15 `admins`

```json
[
  {"_id": "admin_demo_001", "username": "admin_demo", "password": "sha256:eba2f8598ab6a8d23e727a301491693a9343a22bce2456ce5543ed2e940806e6", "role": "super_admin", "createdAt": "2026-07-21T08:00:00.000Z", "updatedAt": "2026-07-21T08:00:00.000Z"}
]
```

该哈希对应测试密码 `TestOnly-ChangeMe-2026!` 和默认盐值组合，仅用于本地/测试环境。生产导入前必须重新生成。

### 6.16 `adminSessions`

```json
[]
```

会话由 `mp-admin.login` 运行时创建，禁止把真实 token 写入种子文件。

## 7. 当前代码核对出的上线阻断项

以下不是数据库字段缺失，而是上线前必须闭环的实现问题：

1. 当前 `mp-user.getUserData` 会把管理员摘要、敏感词配置和兑换码摘要一起返回给普通用户；生产应拆分首页/我的数据接口，普通用户不得读取 `admins`、`sensitiveWordsConfig`。
2. 当前 `mp-user.updateConfig` 没有管理员鉴权；普通用户不能修改全局主题、教育目标和场景。
3. 当前 `mp-cdkey.redeem` 先查询再标记使用，不是原子条件更新；必须补事务或条件更新，防并发重复兑换。
4. 当前 `mp-story.generateAudio` 在同一个云函数调用内完成图片处理和 TTS 后才返回；应先写 `generationJobs` 并返回 `jobId`，耗时处理异步执行。
5. 当前 `processCoverImage`/`processChapterImage` 只是把原始 buffer 改成 `.webp` 文件名，没有真正编码压缩；需要实际 WebP/尺寸压缩，并把压缩后 `sizeBytes` 写入 `assets`。
6. 当前有声路径没有服务端 BGM 混音是符合需求的；`bgmType` 应保持为播放器独立的白噪音轨道，默认 `none`，不能为了返回音频而引入 FFmpeg。
7. 当前线上环境的集合和云函数是否已部署，必须用 CloudBase 控制台或已认证的只读查询核验；本次文档生成未创建、删除或重置任何云资源。
