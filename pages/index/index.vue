<template>
  <view class="page">
    <view class="topbar" @tap="hideKeyboard">
      <view class="status-space" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="title-row" :style="{ paddingRight: navRightPadding + 'px' }">
        <view class="brand">
          <text class="brand-name">images-generate</text>
        </view>
        <view class="mode-chip" @tap="toggleMode">{{ currentModeLabel }}</view>
      </view>

      <scroll-view class="quota-row" scroll-x :show-scrollbar="false">
        <view class="quota-chip primary">剩余额度 {{ quotaLeft }}/{{ quotaTotal }}</view>
        <view class="quota-chip">User {{ userId }}</view>
        <view class="quota-chip">公网 IP {{ ipText }}</view>
      </scroll-view>
    </view>

    <view class="action-row" @tap="hideKeyboard">
      <view class="history-button" @tap="openHistory">
        <text class="history-dot"></text>
        <text>历史记录（{{ conversations.length }}）</text>
      </view>
      <view class="new-button" @tap="newDraft">+ 新建</view>
      <view :class="activeConversationId ? 'delete-button' : 'delete-button disabled'" @tap="deleteActive">删除</view>
    </view>

    <scroll-view class="result-scroll" scroll-y :show-scrollbar="false" :scroll-with-animation="true" @tap="hideKeyboard">
      <view v-if="activeConversation" class="turn-list">
        <view v-for="(turn, index) in activeConversation.turns" :key="turn.id" class="turn">
          <view class="prompt-wrap">
            <view class="prompt-card">
              <view class="prompt-meta">
                <text>第 {{ index + 1 }} 轮</text>
                <text>{{ turn.mode === 'edit' ? '图片编辑' : '文生图' }}</text>
                <text>{{ statusText(turn.status) }}</text>
                <text>{{ turn.time }}</text>
              </view>
              <text class="prompt-text">{{ turn.prompt }}</text>
            </view>
          </view>

          <view v-if="turn.sourcePath" class="source-preview">
            <text class="source-label">参考图</text>
            <image class="source-image" :src="turn.sourcePath" mode="aspectFill" @tap="previewImage(turn.sourcePath)"></image>
          </view>

          <view class="result-tags">
            <text>{{ turn.count }} 张</text>
            <text>{{ turn.ratio }}</text>
            <text>{{ turn.quality }}</text>
            <text>{{ statusText(turn.status) }}</text>
          </view>

          <view class="image-card">
            <view v-if="turn.status === 'generating'" class="loading-card">
              <view class="loading-dot"></view>
              <text>正在生成图片</text>
              <text class="loading-sub">请稍等，结果会显示在这里</text>
            </view>
            <image
              v-else
              class="result-image"
              :src="turn.imageUrl || mockImage"
              :mode="turn.ratio === '9:16' || turn.ratio === '3:4' ? 'aspectFill' : 'widthFix'"
              @tap="previewImage(turn.imageUrl || mockImage)"
            ></image>
            <view class="image-footer">
              <view>
                <text class="result-title">结果 1</text>
                <text class="result-meta">{{ turn.meta }}</text>
              </view>
              <text class="result-status">{{ turn.hasRealImage ? '模型输出' : 'Mock 预览' }}</text>
            </view>
          </view>

          <view class="result-actions">
            <view class="small-action" @tap="copyPrompt(turn.prompt)">复制提示词</view>
            <view class="small-action" @tap="regenerate(turn)">重新生成</view>
            <view class="small-action dark" @tap="saveImage(turn)">保存图片</view>
          </view>
        </view>
      </view>

      <view v-else class="empty-state">
        <text class="empty-title">开始一轮图片创作</text>
        <text class="empty-copy">输入画面描述生成图片，上传参考图后会自动进入图片编辑模式。</text>
      </view>
    </scroll-view>

    <view class="composer" :style="{ transform: keyboardTransform }" @tap.stop="keepKeyboard">
      <textarea
        v-model="prompt"
        class="prompt-input"
        maxlength="800"
        :focus="inputFocused"
        :placeholder="placeholder"
        placeholder-class="placeholder"
        :auto-height="false"
        :cursor-spacing="0"
        :adjust-position="false"
        :show-confirm-bar="false"
        :hold-keyboard="true"
        @keyboardheightchange="handleKeyboardHeightChange"
        @focus="handleInputFocus"
        @blur="handleInputBlur"
      ></textarea>

      <view v-if="sourcePath" class="reference-strip">
        <view class="reference-thumb" @tap.stop="keepKeyboardPreview(sourcePath)">
          <image class="reference-image" :src="sourcePath" mode="aspectFill"></image>
          <view class="reference-remove" @tap.stop="keepKeyboardClearImage">×</view>
        </view>
      </view>

      <view class="tool-row">
        <view :class="sourcePath ? 'tool-button active' : 'tool-button'" @tap.stop="keepKeyboardChooseImage">
          <text class="tool-plus">+</text>
        </view>
        <view class="quota-mini">{{ quotaLeft }}/{{ quotaTotal }}</view>
        <view class="tool-pill" @tap.stop="keepKeyboardOpenCountSheet">
          <text>张数</text>
          <text>{{ imageCount }}</text>
        </view>
        <view class="tool-pill ratio" @tap.stop="keepKeyboardOpenRatioSheet">
          <text>比例</text>
          <text class="ratio-text">{{ ratioLabel }}</text>
        </view>
        <view :class="canSubmit ? 'send-button' : 'send-button disabled'" @tap.stop="submit">
          <text class="send-arrow">↑</text>
        </view>
      </view>
    </view>

    <view v-if="showRatioSheet || showCountSheet" class="sheet-mask" @tap="hideKeyboard">
      <view class="option-sheet" :style="{ transform: keyboardTransform }" @tap.stop="keepKeyboard">
        <text class="sheet-title">{{ showRatioSheet ? '选择画幅比例' : '选择生成张数' }}</text>
        <view v-if="showRatioSheet">
          <view
            v-for="item in ratioOptions"
            :key="item.value"
            :class="ratio === item.value ? 'sheet-item selected' : 'sheet-item'"
            @tap.stop="keepKeyboardSelectRatio(item.value)"
          >
            <text>{{ item.label }}</text>
            <text v-if="ratio === item.value" class="check-mark">已选</text>
          </view>
        </view>
        <view v-else>
          <view
            v-for="item in countOptions"
            :key="item"
            :class="imageCount === item ? 'sheet-item selected' : 'sheet-item'"
            @tap.stop="keepKeyboardSelectCount(item)"
          >
            <text>{{ item }} 张</text>
            <text v-if="imageCount === item" class="check-mark">已选</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="showHistoryPanel" class="history-mask" @tap="showHistoryPanel = false">
      <view class="history-panel">
        <view class="history-header" @tap.stop>
          <view>
            <text class="history-title">历史记录</text>
            <text class="history-subtitle">{{ conversations.length }} 个会话</text>
          </view>
          <view class="history-close" @tap="showHistoryPanel = false">关闭</view>
        </view>

        <view v-if="conversations.length === 0" class="history-empty">暂无历史记录</view>
        <view
          v-for="item in conversations"
          :key="item.id"
          :class="item.id === activeConversationId ? 'history-item active' : 'history-item'"
          @tap.stop="selectConversation(item.id)"
        >
          <view class="history-main">
            <text class="history-name">{{ item.title }}</text>
            <text class="history-meta">{{ item.turns.length }} 轮 · {{ item.updatedAt }}</text>
          </view>
          <view class="history-delete" @tap.stop="removeConversation(item.id)">删除</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import {
  createArtwork,
  createEditTask,
  hasImageModelApi
} from '@/common/image-service.js'

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function pad(value) {
  return String(value).padStart(2, '0')
}

function formatTime(date) {
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export default {
  data() {
    return {
      mode: 'generate',
      prompt: '',
      sourcePath: '',
      ratio: '9:16',
      imageCount: 1,
      quality: '标准',
      quotaLeft: 18,
      quotaTotal: 20,
      userId: 'c262d2cbb12d',
      ipText: '95.40.88.*',
      loading: false,
      statusBarHeight: 0,
      navRightPadding: 24,
      keyboardHeight: 0,
      inputFocused: false,
      keepKeyboardNextBlur: false,
      hasModelApi: hasImageModelApi(),
      mockImage: '/static/mock-result.jpg',
      conversations: [],
      activeConversationId: '',
      showRatioSheet: false,
      showCountSheet: false,
      showHistoryPanel: false,
      ratioOptions: [
        { label: '未指定', value: 'auto' },
        { label: '1:1 正方形', value: '1:1' },
        { label: '16:9 横版', value: '16:9' },
        { label: '4:3 横版', value: '4:3' },
        { label: '3:4 竖版', value: '3:4' },
        { label: '9:16 竖版', value: '9:16' }
      ],
      countOptions: [1, 2]
    }
  },
  onLoad() {
    const info = uni.getSystemInfoSync()
    this.statusBarHeight = info.statusBarHeight || 0
    if (uni.getMenuButtonBoundingClientRect) {
      const menu = uni.getMenuButtonBoundingClientRect()
      this.navRightPadding = Math.max(24, (info.windowWidth || 0) - menu.left + 12)
    }
    this.seedDemo()
  },
  computed: {
    activeConversation() {
      return this.conversations.find(item => item.id === this.activeConversationId) || null
    },
    currentModeLabel() {
      return this.sourcePath || this.mode === 'edit' ? '图片编辑' : '文生图'
    },
    placeholder() {
      return this.sourcePath ? '输入你想要修改的画面' : '输入你想要生成的画面'
    },
    ratioLabel() {
      const option = this.ratioOptions.find(item => item.value === this.ratio)
      return option ? option.label : this.ratio
    },
    canSubmit() {
      return !this.loading && this.prompt.trim().length > 0
    },
    keyboardTransform() {
      return this.keyboardHeight ? `translateY(-${this.keyboardHeight}px)` : 'translateY(0)'
    }
  },
  methods: {
    seedDemo() {
      const id = makeId()
      this.conversations = [{
        id,
        title: '许嵩',
        updatedAt: '05/03 23:33',
        turns: [{
          id: makeId(),
          prompt: '许嵩',
          mode: 'generate',
          status: 'success',
          time: '05/03 23:33',
          count: 1,
          ratio: '9:16',
          quality: '标准',
          sourcePath: '',
          imageUrl: '',
          hasRealImage: false,
          meta: '1.79 MB · 941 x 1672'
        }]
      }]
      this.activeConversationId = id
    },
    statusText(status) {
      if (status === 'generating') return '处理中'
      if (status === 'error') return '失败'
      return '已完成'
    },
    handleInputFocus() {
      this.inputFocused = true
    },
    handleKeyboardHeightChange(event) {
      const height = event && event.detail ? Number(event.detail.height || 0) : 0
      this.keyboardHeight = height > 0 ? height : 0
    },
    handleInputBlur() {
      if (this.keepKeyboardNextBlur) {
        this.keepKeyboardNextBlur = false
        return
      }
      this.inputFocused = false
      this.keyboardHeight = 0
    },
    keepKeyboard() {
      this.keepKeyboardNextBlur = true
    },
    hideKeyboard() {
      this.keepKeyboardNextBlur = false
      this.inputFocused = false
      this.keyboardHeight = 0
      this.closeSheets()
      if (uni.hideKeyboard) {
        uni.hideKeyboard()
      }
    },
    keepKeyboardPreview(src) {
      this.keepKeyboard()
      this.previewImage(src)
    },
    keepKeyboardClearImage() {
      this.keepKeyboard()
      this.clearImage()
    },
    keepKeyboardChooseImage() {
      this.keepKeyboard()
      this.chooseImage()
    },
    keepKeyboardOpenRatioSheet() {
      this.keepKeyboard()
      this.openRatioSheet()
    },
    keepKeyboardOpenCountSheet() {
      this.keepKeyboard()
      this.openCountSheet()
    },
    keepKeyboardSelectRatio(value) {
      this.keepKeyboard()
      this.selectRatio(value)
    },
    keepKeyboardSelectCount(value) {
      this.keepKeyboard()
      this.selectCount(value)
    },
    toggleMode() {
      this.mode = this.mode === 'generate' ? 'edit' : 'generate'
      if (this.mode === 'generate') {
        this.sourcePath = ''
      }
    },
    newDraft() {
      this.prompt = ''
      this.sourcePath = ''
      this.mode = 'generate'
      this.activeConversationId = ''
      this.closeSheets()
    },
    openHistory() {
      this.showHistoryPanel = true
    },
    selectConversation(id) {
      this.activeConversationId = id
      this.showHistoryPanel = false
      this.closeSheets()
    },
    removeConversation(id) {
      this.conversations = this.conversations.filter(item => item.id !== id)
      if (this.activeConversationId === id) {
        this.activeConversationId = this.conversations[0] ? this.conversations[0].id : ''
      }
    },
    deleteActive() {
      if (!this.activeConversationId) {
        uni.showToast({ title: '当前没有可删除的会话', icon: 'none' })
        return
      }
      this.removeConversation(this.activeConversationId)
      uni.showToast({ title: '已删除', icon: 'none' })
    },
    chooseImage() {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed', 'original'],
        sourceType: ['album', 'camera'],
        success: res => {
          this.sourcePath = res.tempFilePaths[0]
          this.mode = 'edit'
          this.imageCount = 1
        },
        complete: () => {
          this.keepKeyboardNextBlur = true
        }
      })
    },
    clearImage() {
      this.sourcePath = ''
      this.mode = 'generate'
    },
    openRatioSheet() {
      this.showCountSheet = false
      this.showRatioSheet = true
    },
    openCountSheet() {
      this.showRatioSheet = false
      this.showCountSheet = true
    },
    closeSheets() {
      this.showRatioSheet = false
      this.showCountSheet = false
    },
    selectRatio(value) {
      this.ratio = value
      this.closeSheets()
    },
    selectCount(value) {
      this.imageCount = value
      this.closeSheets()
    },
    ensureConversation(prompt, time) {
      if (this.activeConversation) return this.activeConversation
      const id = makeId()
      const title = prompt.length > 12 ? `${prompt.slice(0, 12)}...` : prompt
      const conversation = { id, title, updatedAt: time, turns: [] }
      this.conversations.unshift(conversation)
      this.activeConversationId = id
      return conversation
    },
    async submit() {
      this.hideKeyboard()
      if (!this.prompt.trim()) {
        uni.showToast({ title: '请先输入提示词', icon: 'none' })
        return
      }
      if (this.loading) return

      const prompt = this.prompt.trim()
      const time = formatTime(new Date())
      const mode = this.sourcePath ? 'edit' : 'generate'
      const sourcePath = this.sourcePath
      const conversation = this.ensureConversation(prompt, time)
      const turn = {
        id: makeId(),
        prompt,
        mode,
        status: 'generating',
        time,
        count: this.imageCount,
        ratio: this.ratio,
        quality: this.quality,
        sourcePath,
        imageUrl: '',
        hasRealImage: false,
        meta: this.ratio === '9:16' ? '预计 941 x 1672' : '预计 1024 x 1024'
      }

      conversation.turns.push(turn)
      conversation.updatedAt = time
      conversation.title = conversation.title || (prompt.length > 12 ? `${prompt.slice(0, 12)}...` : prompt)
      this.loading = true

      try {
        let modelResult = null
        if (this.hasModelApi) {
          modelResult = mode === 'edit'
            ? await createEditTask({
              sourcePath,
              prompt,
              style: '写实摄影',
              ratio: this.ratio,
              quality: 'standard'
            })
            : await createArtwork({
              prompt,
              negativePrompt: '',
              style: '写实摄影',
              ratio: this.ratio,
              quality: 'standard'
            })
        } else {
          await wait(700)
        }

        turn.status = 'success'
        turn.imageUrl = modelResult ? modelResult.imageUrl : ''
        turn.hasRealImage = Boolean(modelResult && modelResult.imageUrl)
        turn.meta = this.ratio === '9:16' ? '1.79 MB · 941 x 1672' : '1.42 MB · 1024 x 1024'
        this.quotaLeft = Math.max(0, this.quotaLeft - this.imageCount)
        this.prompt = ''
        this.sourcePath = ''
        this.mode = 'generate'
      } catch (error) {
        turn.status = 'error'
        turn.meta = error.message || '生成失败'
        uni.showToast({ title: error.message || '生成失败', icon: 'none' })
      } finally {
        this.loading = false
      }
    },
    copyPrompt(prompt) {
      uni.setClipboardData({
        data: prompt,
        success: () => uni.showToast({ title: '提示词已复制', icon: 'none' })
      })
    },
    previewImage(src) {
      if (!src) return
      uni.previewImage({
        current: src,
        urls: [src]
      })
    },
    regenerate(turn) {
      this.prompt = turn.prompt
      this.sourcePath = turn.sourcePath || turn.imageUrl || this.mockImage
      this.mode = 'edit'
      this.ratio = turn.ratio || this.ratio
      this.imageCount = turn.count || 1
      this.inputFocused = true
      uni.showToast({ title: '图片和提示词已回填', icon: 'none' })
    },
    saveImage(turn) {
      const src = turn.imageUrl || this.mockImage
      uni.getImageInfo({
        src,
        success: info => {
          uni.saveImageToPhotosAlbum({
            filePath: info.path,
            success: () => uni.showToast({ title: '已保存到相册', icon: 'none' }),
            fail: () => uni.showToast({ title: '保存失败，请检查相册权限', icon: 'none' })
          })
        },
        fail: () => uni.showToast({ title: '图片暂不可保存', icon: 'none' })
      })
    }
  }
}
</script>

<style scoped>
.page {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  height: auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f6f6f6;
  color: #111111;
}

.topbar {
  flex: 0 0 auto;
  background: #ffffff;
  border-bottom: 1rpx solid #eeeeee;
}

.status-space {
  width: 100%;
}

.title-row {
  height: 82rpx;
  padding: 0 24rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
}

.brand {
  display: flex;
  align-items: center;
  min-width: 0;
}

.brand-name {
  max-width: 320rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #0b0b0b;
  font-size: 34rpx;
  font-weight: 800;
}

.mode-chip {
  flex: 0 0 auto;
  height: 54rpx;
  margin-left: 12rpx;
  padding: 0 16rpx;
  border-radius: 999rpx;
  background: #111111;
  color: #ffffff;
  line-height: 54rpx;
  font-size: 24rpx;
  font-weight: 700;
}

.quota-row {
  width: 100%;
  height: 76rpx;
  padding: 10rpx 0 10rpx 24rpx;
  white-space: nowrap;
  box-sizing: border-box;
}

.quota-chip {
  display: inline-block;
  height: 54rpx;
  margin-right: 14rpx;
  padding: 0 22rpx;
  border-radius: 999rpx;
  background: #f1f1f1;
  color: #5c5c5c;
  line-height: 54rpx;
  font-size: 24rpx;
  font-weight: 600;
}

.quota-chip.primary {
  background: #101010;
  color: #ffffff;
}

.action-row {
  flex: 0 0 auto;
  height: 88rpx;
  padding: 10rpx 24rpx;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  background: #f6f6f6;
}

.history-button,
.new-button,
.delete-button {
  height: 68rpx;
  border-radius: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  font-weight: 700;
  box-sizing: border-box;
}

.history-button {
  flex: 1;
  min-width: 0;
  background: #ffffff;
  color: #111111;
  box-shadow: 0 8rpx 22rpx rgba(0, 0, 0, 0.08);
}

.history-dot {
  width: 16rpx;
  height: 16rpx;
  margin-right: 14rpx;
  border-radius: 50%;
  background: #111111;
}

.new-button {
  flex: 0 0 136rpx;
  margin-left: 14rpx;
  background: #111111;
  color: #ffffff;
}

.delete-button {
  flex: 0 0 82rpx;
  margin-left: 12rpx;
  background: #ffffff;
  color: #666666;
  box-shadow: 0 8rpx 22rpx rgba(0, 0, 0, 0.08);
}

.delete-button.disabled {
  color: #c3c3c3;
}

.result-scroll {
  flex: 1;
  min-height: 0;
  padding: 12rpx 24rpx 20rpx;
  box-sizing: border-box;
}

.turn {
  margin-bottom: 34rpx;
}

.prompt-wrap {
  display: flex;
  justify-content: flex-end;
}

.prompt-card {
  max-width: 82%;
  padding: 20rpx 22rpx;
  border-radius: 24rpx;
  background: #ffffff;
  box-shadow: 0 6rpx 18rpx rgba(0, 0, 0, 0.08);
  box-sizing: border-box;
}

.prompt-meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  color: #9a9a9a;
  font-size: 22rpx;
}

.prompt-meta text {
  margin: 0 0 8rpx 16rpx;
}

.prompt-text {
  display: block;
  text-align: right;
  color: #111111;
  font-size: 30rpx;
  font-weight: 700;
  line-height: 1.45;
  word-break: break-all;
}

.source-preview {
  margin-top: 22rpx;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.source-label {
  margin-right: 14rpx;
  color: #777777;
  font-size: 24rpx;
}

.source-image {
  width: 112rpx;
  height: 112rpx;
  border-radius: 18rpx;
  background: #eeeeee;
}

.result-tags {
  margin: 26rpx 0 18rpx;
  display: flex;
  flex-wrap: wrap;
}

.result-tags text {
  height: 50rpx;
  margin: 0 12rpx 12rpx 0;
  padding: 0 20rpx;
  border-radius: 999rpx;
  background: #ffffff;
  color: #777777;
  line-height: 50rpx;
  font-size: 23rpx;
  font-weight: 600;
}

.image-card {
  overflow: hidden;
  border-radius: 24rpx;
  background: #ffffff;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.08);
}

.result-image {
  width: 100%;
  min-height: 360rpx;
  max-height: 700rpx;
  display: block;
  background: #111111;
}

.loading-card {
  height: 520rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #f0f0f0;
  color: #333333;
  font-size: 28rpx;
  font-weight: 700;
}

.loading-dot {
  width: 42rpx;
  height: 42rpx;
  margin-bottom: 22rpx;
  border: 6rpx solid #d8d8d8;
  border-top-color: #111111;
  border-radius: 50%;
}

.loading-sub {
  margin-top: 12rpx;
  color: #888888;
  font-size: 24rpx;
  font-weight: 500;
}

.image-footer {
  min-height: 82rpx;
  padding: 18rpx 22rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
}

.result-title,
.result-meta {
  display: block;
}

.result-title {
  color: #222222;
  font-size: 25rpx;
  font-weight: 700;
}

.result-meta {
  margin-top: 6rpx;
  color: #999999;
  font-size: 22rpx;
}

.result-status {
  flex: 0 0 auto;
  color: #999999;
  font-size: 22rpx;
}

.result-actions {
  margin-top: 16rpx;
  display: flex;
  gap: 12rpx;
}

.small-action {
  flex: 1;
  height: 62rpx;
  border-radius: 18rpx;
  background: #ffffff;
  color: #333333;
  line-height: 62rpx;
  text-align: center;
  font-size: 24rpx;
  font-weight: 700;
}

.small-action.dark {
  background: #111111;
  color: #ffffff;
}

.empty-state {
  margin-top: 140rpx;
  padding: 42rpx 34rpx;
  border-radius: 28rpx;
  background: #ffffff;
  text-align: center;
}

.empty-title {
  display: block;
  color: #111111;
  font-size: 36rpx;
  font-weight: 800;
}

.empty-copy {
  display: block;
  margin-top: 16rpx;
  color: #888888;
  font-size: 26rpx;
  line-height: 1.6;
}

.composer {
  flex: 0 0 auto;
  margin: 0 24rpx 22rpx;
  overflow: hidden;
  border: 1rpx solid #e8e8e8;
  border-radius: 30rpx;
  background: #ffffff;
  box-shadow: 0 -4rpx 24rpx rgba(0, 0, 0, 0.05);
  transition: transform 0.22s ease;
  will-change: transform;
}

.prompt-input {
  width: 100%;
  height: 132rpx;
  padding: 24rpx 24rpx 10rpx;
  color: #111111;
  font-size: 30rpx;
  line-height: 1.45;
  box-sizing: border-box;
}

.placeholder {
  color: #a8a8a8;
}

.reference-strip {
  margin: 0 24rpx 14rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.reference-thumb {
  position: relative;
  flex: 0 0 76rpx;
  width: 76rpx;
  height: 76rpx;
  overflow: visible;
  border-radius: 14rpx;
  background: #f1f1f1;
  box-sizing: border-box;
}

.reference-image {
  width: 100%;
  height: 100%;
  display: block;
  border-radius: 14rpx;
}

.reference-remove {
  position: absolute;
  right: -10rpx;
  top: -10rpx;
  width: 30rpx;
  height: 30rpx;
  border-radius: 50%;
  background: #111111;
  color: #ffffff;
  line-height: 28rpx;
  text-align: center;
  font-size: 22rpx;
  font-weight: 700;
}

.tool-row {
  min-height: 88rpx;
  padding: 10rpx 14rpx;
  display: flex;
  align-items: center;
  border-top: 1rpx solid #f1f1f1;
  box-sizing: border-box;
}

.tool-button,
.quota-mini,
.tool-pill,
.send-button {
  flex: 0 0 auto;
  height: 60rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  font-size: 23rpx;
  font-weight: 700;
}

.tool-button {
  width: 58rpx;
  border: 0;
  background: transparent;
  color: #888888;
}

.tool-button.active {
  width: 58rpx;
  background: transparent;
  color: #111111;
}

.tool-plus {
  margin-top: -4rpx;
  font-size: 40rpx;
  font-weight: 300;
  line-height: 1;
}

.quota-mini {
  width: 82rpx;
  margin-left: 8rpx;
  background: #f6f6f6;
  color: #555555;
}

.tool-pill {
  margin-left: 8rpx;
  padding: 0 16rpx;
  border: 1rpx solid #e1e1e1;
  background: #ffffff;
  color: #111111;
}

.tool-pill text:first-child {
  margin-right: 8rpx;
  color: #777777;
}

.tool-pill.ratio {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
}

.ratio-text {
  max-width: 128rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.send-button {
  width: 68rpx;
  height: 68rpx;
  margin-left: 8rpx;
  background: #111111;
  color: #ffffff;
  box-shadow: 0 8rpx 18rpx rgba(0, 0, 0, 0.14);
}

.send-button.disabled {
  background: #d9d9d9;
  box-shadow: none;
}

.send-arrow {
  margin-top: -4rpx;
  color: #ffffff;
  font-size: 40rpx;
  font-weight: 700;
  line-height: 1;
}

.sheet-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 20;
  background: rgba(0, 0, 0, 0.14);
}

.option-sheet {
  position: absolute;
  left: 24rpx;
  right: 24rpx;
  bottom: 218rpx;
  padding: 22rpx;
  border-radius: 28rpx;
  background: #ffffff;
  box-shadow: 0 18rpx 60rpx rgba(0, 0, 0, 0.16);
  box-sizing: border-box;
  transition: transform 0.22s ease;
  will-change: transform;
}

.sheet-title {
  display: block;
  padding: 8rpx 18rpx 18rpx;
  color: #888888;
  font-size: 24rpx;
  font-weight: 700;
}

.sheet-item {
  height: 82rpx;
  padding: 0 24rpx;
  border-radius: 18rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #333333;
  font-size: 28rpx;
}

.sheet-item.selected {
  background: #f4f4f4;
  color: #111111;
  font-weight: 800;
}

.check-mark {
  color: #111111;
  font-size: 22rpx;
}

.history-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 30;
  padding: 170rpx 24rpx 60rpx;
  background: rgba(0, 0, 0, 0.38);
  box-sizing: border-box;
}

.history-panel {
  max-height: 100%;
  min-height: 360rpx;
  padding: 42rpx 34rpx;
  overflow: auto;
  border-radius: 34rpx;
  background: #ffffff;
  box-sizing: border-box;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.history-title {
  display: block;
  color: #111111;
  font-size: 40rpx;
  font-weight: 800;
}

.history-subtitle {
  display: block;
  margin-top: 8rpx;
  color: #888888;
  font-size: 24rpx;
}

.history-close {
  height: 58rpx;
  padding: 0 22rpx;
  border-radius: 999rpx;
  background: #f4f4f4;
  color: #333333;
  line-height: 58rpx;
  font-size: 24rpx;
  font-weight: 700;
}

.history-empty {
  margin-top: 76rpx;
  color: #999999;
  font-size: 28rpx;
  text-align: center;
}

.history-item {
  margin-top: 24rpx;
  padding: 26rpx 24rpx;
  border-radius: 22rpx;
  display: flex;
  align-items: center;
  background: #f7f7f7;
}

.history-item.active {
  background: #eeeeee;
}

.history-main {
  flex: 1;
  min-width: 0;
}

.history-name {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #111111;
  font-size: 30rpx;
  font-weight: 800;
}

.history-meta {
  display: block;
  margin-top: 12rpx;
  color: #888888;
  font-size: 23rpx;
}

.history-delete {
  flex: 0 0 78rpx;
  height: 52rpx;
  border-radius: 999rpx;
  background: #ffffff;
  color: #777777;
  line-height: 52rpx;
  text-align: center;
  font-size: 22rpx;
  font-weight: 700;
}
</style>
