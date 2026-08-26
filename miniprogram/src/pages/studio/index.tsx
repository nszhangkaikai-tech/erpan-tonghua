import { useState, useRef, useEffect } from 'react'
import { View, Text, Input, Button, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useStore } from '../../store'
import Icon from '../../components/Icon'
import request, { uploadFile } from '../../utils/request'
import NavBar from '../../components/NavBar'
import BottomNav from '../../components/BottomNav'
import './index.scss'

// 录音临时文件路径的兜底 key（与 stopRecording 写入保持一致）
const REC_TEMP_KEY = 'bm_record_temp'

const SPEAKER_TYPES = [
  { key: 'mother', label: '妈妈' },
  { key: 'father', label: '爸爸' },
  { key: 'grandmother', label: '奶奶/外婆' },
  { key: 'grandfather', label: '爷爷/外公' },
  { key: 'custom', label: '其他声音' },
]

// 克隆朗读示范文本：StepFun 要求录音实际朗读内容 == 克隆请求的 text（内部 ASR 比对），
// 且音频时长需 5~10 秒。文本越短、朗读越清晰，CER（字符错误率）越低，克隆成功率越高。
// 优先选用：常见字、无生僻字、少轻声/儿化、亲子睡前语境。
const CLONE_SAMPLE_TEXT = '太阳下山了，小鸟回家了，小宝宝闭上眼睛，乖乖睡个好觉。'

// 克隆录音时长约束：StepFun 要求 5~10 秒，超长会被拒、过短 ASR 比对不准
const CLONE_MIN_SEC = 5
const CLONE_MAX_SEC = 15
// 理想朗读窗口：缩短后的示范文本正常语速约 5~7 秒
const CLONE_IDEAL_MIN = 5
const CLONE_IDEAL_MAX = 10
// 录音采样率：22.05kHz 单声道 16bit PCM（比 16kHz 更利于 ASR 识别准确率）
const CLONE_SAMPLE_RATE = 22050

// StepFun 克隆要求 WAV（实测其 MP3 解码器无法处理微信 RecorderManager 生成的 MP3）。
// 微信 PCM 录音为裸 16bit 小端单声道数据，此处用纯 JS 包成标准 WAV 头部（44 字节），零依赖。
function pcmToWav(pcmBuffer: ArrayBuffer, sampleRate: number, numChannels = 1, bitsPerSample = 16): ArrayBuffer {
  const pcmBytes = new Uint8Array(pcmBuffer)
  const dataSize = pcmBytes.length
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)              // PCM chunk size
  view.setUint16(20, 1, true)               // PCM format
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, (sampleRate * numChannels * bitsPerSample) / 8, true) // byte rate
  view.setUint16(32, (numChannels * bitsPerSample) / 8, true) // block align
  view.setUint16(34, bitsPerSample, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)
  new Uint8Array(buffer, 44).set(pcmBytes)
  return buffer
}

export default function Studio() {
  const { state, dispatch, refreshDb, invalidateCache } = useStore()
  const { db } = state

  const [speakerType, setSpeakerType] = useState('mother')
  const [voiceName, setVoiceName] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recordSec, setRecordSec] = useState(0)
  const [recorded, setRecorded] = useState(false)
  const [creating, setCreating] = useState(false)
  const [playing, setPlaying] = useState(false)

  const recorderRef = useRef<any>(null)
  const timerRef = useRef<any>(null)
  // 录音文件路径：用 ref 兜底，避免 onStop 异步回调里读不到最新 state
  const tempPathRef = useRef<string>('')
  // 试听播放器实例
  const audioRef = useRef<any>(null)
  // 触顶自动停止标记：区分手动停止与到达 10 秒硬上限自动停止
  const autoStopRef = useRef(false)
  // onStart 是否已触发（用于检测录音静默失败）
  const startedRef = useRef(false)

  useDidShow(() => {
    refreshDb()
  })

  // 一次性注册 recorder 回调（必须在 start/stop 之前注册，否则停止事件已派发、
  // 回调永不触发，导致录音文件丢失、克隆无法执行）。
  useEffect(() => {
    const recorder = Taro.getRecorderManager()
    recorderRef.current = recorder

    recorder.onStart(() => {
      startedRef.current = true
      setIsRecording(true)
      setRecordSec(0)
      setRecorded(false)
      tempPathRef.current = ''
      autoStopRef.current = false
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        setRecordSec(prev => {
          const next = prev + 1
          // 到达 10 秒硬上限 → 自动停止，避免超出 StepFun 克隆时长约束
          if (next >= CLONE_MAX_SEC) {
            if (timerRef.current) {
              clearInterval(timerRef.current)
              timerRef.current = null
            }
            autoStopRef.current = true
            Taro.nextTick(() => {
              if (recorderRef.current) recorderRef.current.stop()
            })
          }
          return next
        })
      }, 1000)
    })

    recorder.onStop((res: any) => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      setIsRecording(false)
      setRecorded(true)
      const pcmPath = res?.tempFilePath || ''
      // 读取 PCM 裸数据并包成 WAV（StepFun 克隆要求 WAV，且能正确解码）
      try {
        const fs: any = Taro.getFileSystemManager()
        fs.readFile({
          filePath: pcmPath,
          success: (r: any) => {
            const wavBuf = pcmToWav(r.data, CLONE_SAMPLE_RATE, 1, 16)
            const wavPath = `${Taro.env.USER_DATA_PATH}/clone_${Date.now()}.wav`
            fs.writeFile({
              filePath: wavPath,
              data: wavBuf,
              success: () => {
                tempPathRef.current = wavPath
                Taro.setStorageSync(REC_TEMP_KEY, wavPath)
              },
              fail: () => {
                // WAV 写出失败则退回用原始 PCM 路径（后端嗅探会按实际字节处理）
                tempPathRef.current = pcmPath
                Taro.setStorageSync(REC_TEMP_KEY, pcmPath)
              },
            })
          },
          fail: () => {
            tempPathRef.current = pcmPath
            Taro.setStorageSync(REC_TEMP_KEY, pcmPath)
          },
        })
      } catch (e) {
        tempPathRef.current = pcmPath
        Taro.setStorageSync(REC_TEMP_KEY, pcmPath)
      }
      // 触顶自动停止时给出提示
      if (autoStopRef.current) {
        autoStopRef.current = false
        Taro.showToast({ title: `已达 ${CLONE_MAX_SEC} 秒上限，已自动停止`, icon: 'none' })
      }
    })

    recorder.onError(() => {
      Taro.showToast({ title: '录音失败，请确认麦克风权限已开启', icon: 'none' })
      setIsRecording(false)
    })

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // 录音前确保麦克风权限已授予，避免直接触发微信被动弹窗导致「授权超时未确认」。
  // 三种情况：已授权→直接录；从未授权→主动申请；曾被拒→引导去设置页开启。
  const ensureRecordPermission = async (): Promise<boolean> => {
    try {
      const setting: any = await Taro.getSetting()
      if (setting.authSetting['scope.record']) return true

      // 已被用户拒绝过，不再弹系统窗，直接引导去设置
      if (setting.authSetting['scope.record'] === false) {
        const go = await new Promise<boolean>(resolve => {
          Taro.showModal({
            title: '需要麦克风权限',
            content: '录制家庭声音需要先开启麦克风权限，是否前往设置开启？',
            confirmText: '去设置',
            cancelText: '暂不',
            success: r => resolve(r.confirm),
          })
        })
        if (!go) return false
        const opened: any = await Taro.openSetting()
        return !!opened.authSetting['scope.record']
      }

      // 从未授权过，主动申请（同样会弹系统授权窗，但由我们控制流程）
      await Taro.authorize({ scope: 'scope.record' })
      return true
    } catch (e: any) {
      const errMsg = e?.errMsg || ''
      // 用户在系统弹窗点了「拒绝」或超时未确认 → 引导去设置
      if (errMsg.includes('auth deny') || errMsg.includes('authorize:fail') || errMsg.includes('system denied')) {
        const go = await new Promise<boolean>(resolve => {
          Taro.showModal({
            title: '需要麦克风权限',
            content: '录音需要先开启麦克风权限，是否前往设置开启？',
            confirmText: '去设置',
            cancelText: '暂不',
            success: r => resolve(r.confirm),
          })
        })
        if (!go) return false
        const opened: any = await Taro.openSetting()
        return !!opened.authSetting['scope.record']
      }
      return false
    }
  }

  const startRecording = async () => {
    const granted = await ensureRecordPermission()
    if (!granted) {
      Taro.showToast({ title: '未获得麦克风权限，无法录音', icon: 'none' })
      return
    }
    // 兜底：recorder 未就绪时尝试重新获取，避免「点击录音没反应」的静默失败
    if (!recorderRef.current) {
      try {
        recorderRef.current = Taro.getRecorderManager()
      } catch (e) {
        /* 忽略，下面会统一提示 */
      }
    }
    if (!recorderRef.current) {
      Taro.showToast({ title: '录音组件未就绪，请返回重试', icon: 'none' })
      return
    }
    try {
      startedRef.current = false
      recorderRef.current.start({
        duration: CLONE_MAX_SEC * 1000,
        sampleRate: CLONE_SAMPLE_RATE,
        numberOfChannels: 1,
        format: 'pcm',           // 录裸 PCM，停止后用 pcmToWav 包成 WAV 上传（StepFun 克隆要求 WAV）
      })
      // 安全检测：1.5s 内 onStart 未触发 → 录音静默失败（部分设备不支持该格式），提示用户
      setTimeout(() => {
        if (!startedRef.current) {
          setIsRecording(false)
          Taro.showToast({ title: '录音启动失败，请重试或重启小程序', icon: 'none' })
        }
      }, 1500)
    } catch (e) {
      console.error('[studio] start recording failed', e)
      Taro.showToast({ title: '录音启动失败，请重试', icon: 'none' })
    }
  }

  const stopRecording = () => {
    if (recorderRef.current) recorderRef.current.stop()
  }

  // 试听刚录制的声音（验证录音质量）
  const playRecorded = () => {
    const path = tempPathRef.current || Taro.getStorageSync(REC_TEMP_KEY)
    if (!path) {
      Taro.showToast({ title: '还没有可试听的录音', icon: 'none' })
      return
    }
    // 正在播放 → 停止
    if (audioRef.current) {
      audioRef.current.stop()
      audioRef.current = null
      setPlaying(false)
      return
    }
    const audio: any = Taro.createInnerAudioContext()
    audio.src = path
    audio.onPlay(() => setPlaying(true))
    audio.onEnded(() => {
      setPlaying(false)
      audioRef.current = null
    })
    audio.onError(() => {
      setPlaying(false)
      audioRef.current = null
      Taro.showToast({ title: '试听播放失败', icon: 'none' })
    })
    audio.play()
    audioRef.current = audio
  }

  const resetRecording = () => {
    if (audioRef.current) {
      audioRef.current.stop()
      audioRef.current = null
    }
    setPlaying(false)
    setRecordSec(0)
    setRecorded(false)
    setVoiceName('')
    tempPathRef.current = ''
    Taro.removeStorageSync(REC_TEMP_KEY)
  }

  const handleCreateVoice = async () => {
    if (!voiceName.trim()) {
      Taro.showToast({ title: '请给声音起个名字', icon: 'none' })
      return
    }
    if (recordSec < CLONE_MIN_SEC) {
      Taro.showToast({ title: `录音至少需要 ${CLONE_MIN_SEC} 秒哦`, icon: 'none' })
      return
    }
    if (recordSec > CLONE_MAX_SEC) {
      Taro.showToast({ title: `录音不能超过 ${CLONE_MAX_SEC} 秒哦`, icon: 'none' })
      return
    }

    const filePath = tempPathRef.current || Taro.getStorageSync(REC_TEMP_KEY)
    if (!filePath) {
      Taro.showToast({ title: '录音文件丢失，请重新录制', icon: 'none' })
      return
    }

    setCreating(true)
    Taro.showLoading({ title: '正在克隆声音...', mask: true })

    try {
      // 1) 先把录音上传到云存储（云函数通过其自动注入的 openid 判定归属）
      const openid = Taro.getStorageSync('bm_openid') || 'tmp'
      const ts = Date.now()
      // 录音已在前端 onStop 阶段由 PCM 包成 WAV（StepFun 克隆要求 WAV 格式）
      const ext = 'wav'
      const cloudRes: any = await uploadFile({
        cloudPath: `voice/${openid}/rec_${ts}.${ext}`,
        filePath,
      })
      const fileID = cloudRes.fileID

      // 2) 调用云函数完成克隆（真正把录音发给 StepFun）
      const result: any = await request({
        url: '/api/voice/clone',
        method: 'POST',
        data: {
          fileID,
          name: voiceName.trim(),
          speakerType,
          recordDuration: String(recordSec),
          text: CLONE_SAMPLE_TEXT,
        },
      })

      // 3) 立即把返回的新声音写回 store，避免依赖 refreshDb 时序导致列表不刷新
      const newVoice = result?.voice
      if (newVoice && state.db) {
        const mapped = {
          id: newVoice.id,
          name: newVoice.name,
          isReady: newVoice.isReady,
          usageCount: newVoice.usageCount || 0,
          createTime: newVoice.createTime,
          recordDuration: newVoice.recordDuration,
          speakerType: newVoice.speakerType,
          stepfunVoiceId: newVoice.stepfunVoiceId,
          stepfunSucceeded: newVoice.stepfunSucceeded,
        }
        dispatch({ type: 'UPDATE_VOICES', payload: [...(state.db.voiceClones || []), mapped] })
      }

      Taro.hideLoading()
      invalidateCache()
      await refreshDb()
      resetRecording()
      if (newVoice && newVoice.stepfunSucceeded) {
        Taro.showToast({ title: '声音克隆成功', icon: 'success' })
      } else {
        Taro.showToast({ title: '克隆未生效，将使用默认音色', icon: 'none' })
      }
    } catch (e: any) {
      Taro.hideLoading()
      const errMsg = e?.data?.error || e?.message || '克隆失败，请重试'
      // 用 Modal 展示完整错误（Toast 会被截断，看不到 StepFun 真实原因）
      Taro.showModal({
        title: '克隆失败',
        content: errMsg.length > 120 ? errMsg.slice(0, 120) + '...' : errMsg,
        showCancel: false,
        confirmText: '知道了',
      })
    } finally {
      setCreating(false)
    }
  }

  const deleteVoice = async (id: string) => {
    const res = await new Promise<boolean>(resolve => {
      Taro.showModal({
        title: '删除声音',
        content: '确定要删除这个克隆声音吗？',
        success: r => resolve(r.confirm),
      })
    })
    if (!res) return

    try {
      const result: any = await request({ url: '/api/voice/delete', method: 'POST', data: { id } })
      // 后端 delete 动作返回 { success } —— 记录未找到/已删时 success=false，需与后端语义对齐
      if (result && result.success === false) {
        Taro.showToast({ title: '删除失败，记录可能已不存在', icon: 'none' })
        return
      }
      invalidateCache()
      await refreshDb()
      Taro.showToast({ title: '已删除', icon: 'success' })
    } catch (e) {
      Taro.showToast({ title: '删除失败', icon: 'none' })
    }
  }

  const voiceClones = db?.voiceClones || []

  return (
    <View className='studio'>
      <NavBar title='录音室' showBack={false} />
      <ScrollView className='studio__scroll' scrollY enableFlex>
        <View className='studio__scroll-inner'>
        {/* 说明卡片 */}
        <View className='studio__intro'>
          <View className='studio__intro-title-row'>
            <Icon name='mic' size={32} color='#6C8EEF' />
            <Text className='studio__intro-title'>声音克隆系统说明</Text>
          </View>
            <Text className='studio__intro-text'>
            耳畔有声克隆基于业内顶尖的深度合成模型，仅需录制一段<Text className='studio__intro-bold'>5~10秒</Text>的故事散句（请朗读下方示范文本），即可完美还原家庭成员独一无二的音色、情感和讲故事的节奏，给孩子最本真的睡前陪伴。
          </Text>
          <View className='studio__intro-warn'>
            <Icon name='info' size={24} color='#d97706' />
            <Text>提示：克隆非本人声音前，请确保已获得本人的确认授权。</Text>
          </View>
        </View>

        {/* 录音面板 */}
        <View className='studio__panel'>
          <View className='studio__panel-title-row'>
            <Icon name='headphones' size={28} color='#6C8EEF' />
            <Text className='studio__panel-title'>创建新的家庭声音</Text>
          </View>

          {/* 选择类型和名字 */}
          <View className='studio__form-row'>
            <View className='studio__form-field'>
              <Text className='studio__form-label'>说话人性别/身份</Text>
              <View className='studio__speaker-types'>
                {SPEAKER_TYPES.map(s => (
                  <View
                    key={s.key}
                    className={`studio__speaker-type ${speakerType === s.key ? 'studio__speaker-type--active' : ''}`}
                    onClick={() => setSpeakerType(s.key)}
                  >
                    <Text className='studio__speaker-type-text'>{s.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View className='studio__form-field'>
            <Text className='studio__form-label'>给声音起个名字</Text>
            <Input
              className='studio__form-input'
              placeholder='如：妈妈的温柔讲故事声音'
              value={voiceName}
              maxlength={20}
              confirmType='done'
              cursorSpacing={24}
              adjustPosition
              onInput={e => setVoiceName(e.detail.value)}
            />
          </View>

          {/* 示范文本 */}
          <View className='studio__sample'>
            <Text className='studio__sample-label'>请对准话筒，朗读以下示范文本（需与克隆内容一致）：</Text>

            {/* 醒目引导：理想朗读时长窗口 */}
            <View className='studio__sample-tip'>
              <View className='studio__sample-tip-icon'>⏱</View>
              <View className='studio__sample-tip-body'>
                <Text className='studio__sample-tip-title'>理想朗读时长：约 {CLONE_IDEAL_MIN}~{CLONE_IDEAL_MAX} 秒</Text>
                <Text className='studio__sample-tip-sub'>请用清晰、中等语速大声朗读（每秒 3~4 字），安静环境效果最佳</Text>
              </View>
            </View>

            <Text className='studio__sample-text'>
              『{CLONE_SAMPLE_TEXT}』
            </Text>
            <Text className='studio__sample-foot'>可接受范围 {CLONE_MIN_SEC}~{CLONE_MAX_SEC} 秒，勿快读或拖太长</Text>
          </View>

          {/* 录音控制 */}
          {isRecording ? (
            <View className='studio__recording'>
              <View className='studio__recording-status'>
                <View className='studio__recording-dot' />
                <Text className='studio__recording-text'>录音中：已录 {recordSec} 秒 / 剩余 {Math.max(0, CLONE_MAX_SEC - recordSec)} 秒</Text>
              </View>

              {/* 时长进度条：理想窗口(7~9s)绿色高亮带 + 5s 合格线，进度随录音增长 */}
              <View className='studio__recording-progress'>
                {/* 理想窗口绿色带 */}
                <View
                  className='studio__recording-progress-ideal'
                  style={{
                    left: `${(CLONE_IDEAL_MIN / CLONE_MAX_SEC) * 100}%`,
                    width: `${((CLONE_IDEAL_MAX - CLONE_IDEAL_MIN) / CLONE_MAX_SEC) * 100}%`,
                  }}
                />
                <View
                  className='studio__recording-progress-bar'
                  style={{ width: `${Math.min(100, (recordSec / CLONE_MAX_SEC) * 100)}%` }}
                />
                {/* 5 秒合格线标记 */}
                <View
                  className='studio__recording-progress-mark'
                  style={{ left: `${(CLONE_MIN_SEC / CLONE_MAX_SEC) * 100}%` }}
                />
              </View>
              <Text className='studio__recording-hint'>
                绿色区间为理想时长（{CLONE_IDEAL_MIN}~{CLONE_IDEAL_MAX}秒），进度进入绿区后停止最稳妥
              </Text>

              {/* 波形动画 */}
              <View className='studio__wave'>
                {[1, 2, 3, 4, 3, 2, 4, 5, 3, 4, 1, 3, 4, 5, 2, 3].map((h, i) => (
                  <View key={i} className='studio__wave-bar' style={{ height: `${h * 8}rpx` }} />
                ))}
              </View>

              <View className='studio__recording-btn' onClick={stopRecording}>
                <Text className='studio__recording-btn-text'>完成并停止</Text>
              </View>
            </View>
          ) : (
            <View className='studio__record-start'>
              <View className='studio__record-btn' onClick={startRecording}>
                <Icon name='mic' size={36} color='#6C8EEF' className='studio__record-btn-icon' />
                <Text className='studio__record-btn-text'>开始录音克隆（免费）</Text>
              </View>
            </View>
          )}

          {/* 录音完成 */}
          {!isRecording && recorded && recordSec > 0 && (
            <View className='studio__recorded'>
              <Icon name='mic' size={20} color='#6C8EEF' className='studio__recorded-icon' />
              <Text className='studio__recorded-text'>录制成功：已录制 {recordSec} 秒散句！</Text>
              {recordSec >= CLONE_IDEAL_MIN && recordSec <= CLONE_IDEAL_MAX && (
                <Text className='studio__recorded-ok'>✓ 落进理想时长窗口，克隆成功率最高，可直接确认</Text>
              )}
              {recordSec >= CLONE_MIN_SEC && recordSec < CLONE_IDEAL_MIN && (
                <Text className='studio__recorded-warn'>稍短（{CLONE_IDEAL_MIN}秒以上更稳），可确认试试或重录</Text>
              )}
              {recordSec > CLONE_IDEAL_MAX && recordSec <= CLONE_MAX_SEC && (
                <Text className='studio__recorded-warn'>稍长（{CLONE_IDEAL_MAX}秒以内更稳），可确认试试或重录</Text>
              )}
              {recordSec < CLONE_MIN_SEC && (
                <Text className='studio__recorded-warn'>录音不足 {CLONE_MIN_SEC} 秒，克隆可能失败，建议重录</Text>
              )}
              <View className='studio__recorded-btns'>
                <View className='studio__recorded-btn studio__recorded-btn--reset' onClick={resetRecording}>
                  <Text className='studio__recorded-btn-text'>重录</Text>
                </View>
                <View className='studio__recorded-btn studio__recorded-btn--play' onClick={playRecorded}>
                  <Text className='studio__recorded-btn-text'>{playing ? '停止试听' : '试听录音'}</Text>
                </View>
                <View className='studio__recorded-btn studio__recorded-btn--confirm' onClick={handleCreateVoice}>
                  <Text className='studio__recorded-btn-text studio__recorded-btn-text--white'>确认克隆声音</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* 已保存声音列表 */}
        <View className='studio__voices'>
          <Text className='studio__voices-title'>已保存的家庭声音（{voiceClones.length}）</Text>

          {voiceClones.map(v => (
            <View key={v.id} className='studio__voice-card'>
              <View className='studio__voice-left'>
                <View className='studio__voice-icon'>
                  <Icon name='volume' size={28} color='#6C8EEF' />
                </View>
                <View className='studio__voice-info'>
                  <Text className='studio__voice-name'>{v.name}</Text>
                  <View className='studio__voice-meta'>
                    <Text className='studio__voice-meta-text'>角色：{SPEAKER_TYPES.find(s => s.key === v.speakerType)?.label || '其他'}</Text>
                    <Text className='studio__voice-meta-sep'>•</Text>
                    <Text className='studio__voice-meta-text'>已用于故事：{v.usageCount} 次</Text>
                  </View>
                </View>
              </View>
              <View className='studio__voice-del' onClick={() => deleteVoice(v.id)}>
                <Icon name='trash' size={28} color='#ef4444' />
              </View>
            </View>
          ))}
        </View>
        </View>
      </ScrollView>
      <BottomNav active='studio' />
    </View>
  )
}
