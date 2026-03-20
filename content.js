// ==================== 核心统计模块 ====================
(function() {
  'use strict';

  const TOTAL_KEY = 'moekoe_playback_total';     // 存储总秒数
  const STATE_KEY = 'moekoe_playback_state';     // 存储播放状态
  const PROGRESS_KEY = 'player_progress';

  // 默认数据
  const defaultTotal = { totalSeconds: 0 };
  const defaultState = {
    lastTrackId: '',
    lastPosition: 0,
    lastCheckTime: 0,
    lastPlayedTrack: null
  };

  // ---------- 读取存储（分离）----------
  function loadTotal() {
    try {
      const raw = localStorage.getItem(TOTAL_KEY);
      if (raw === null) return { ...defaultTotal };
      const data = JSON.parse(raw);
      if (typeof data.totalSeconds === 'number') {
        data.totalSeconds = Math.round(data.totalSeconds * 10) / 10;
      }
      return data;
    } catch (e) {
      console.warn('[MoeKoe Stats] 读取总时长失败，使用默认值');
      return { ...defaultTotal };
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (raw === null) return { ...defaultState };
      return JSON.parse(raw);
    } catch (e) {
      console.warn('[MoeKoe Stats] 读取状态失败，使用默认值');
      return { ...defaultState };
    }
  }

  // ---------- 保存存储（分离）----------
  function saveTotal(total) {
    try {
      const toSave = { ...total };
      toSave.totalSeconds = Math.round(toSave.totalSeconds * 10) / 10;
      localStorage.setItem(TOTAL_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.error('[MoeKoe Stats] 保存总时长失败', e);
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('[MoeKoe Stats] 保存状态失败', e);
    }
  }

  // 格式化显示
  function formatHM(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return hrs > 0 ? `${hrs}小时 ${mins}分钟` : `${mins}分钟`;
  }

  // 获取当前播放信息
  function getCurrentPlaybackInfo() {
    let currentTime = 0;
    try {
      const saved = localStorage.getItem(PROGRESS_KEY);
      if (saved !== null) currentTime = parseFloat(saved) || 0;
    } catch (e) {}

    const titleEl = document.querySelector('.song-title, .track-title, [class*="title"], .music-title');
    const artistEl = document.querySelector('.song-artist, .track-artist, [class*="artist"], .music-artist');

    let title = titleEl?.textContent?.trim() || '未知歌曲';
    let artist = artistEl?.textContent?.trim() || '未知艺术家';

    if (title === '未知歌曲') {
      try { const t = localStorage.getItem('current_song_title'); if (t) title = t; } catch (e) {}
    }
    if (artist === '未知艺术家') {
      try { const a = localStorage.getItem('current_song_artist'); if (a) artist = a; } catch (e) {}
    }

    return { title, artist, currentTime, timestamp: Date.now() };
  }

  // 核心统计对象
  const stats = {
    _total: loadTotal(),      // { totalSeconds }
    _state: loadState(),      // 其他状态

    // 每秒更新统计
    update: function() {
      // 1. 同步外部对 totalSeconds 的修改
      try {
        const raw = localStorage.getItem(TOTAL_KEY);
        if (raw) {
          const storedTotal = JSON.parse(raw);
          if (storedTotal.totalSeconds !== undefined && storedTotal.totalSeconds !== this._total.totalSeconds) {
            this._total.totalSeconds = Math.round(storedTotal.totalSeconds * 10) / 10;
            console.log('[MoeKoe Stats] 检测到外部修改 totalSeconds，已同步为', this._total.totalSeconds);
          }
        }
      } catch (e) {}

      const track = getCurrentPlaybackInfo();
      const now = Date.now();
      const state = this._state;

      // 无有效歌曲时清空状态
      if (!track.title || track.title === '未知歌曲') {
        state.lastTrackId = '';
        state.lastCheckTime = now;
        saveState(state);
        saveTotal(this._total);
        return;
      }

      const trackId = `${track.title}|${track.artist}`;
      state.lastPlayedTrack = { title: track.title, artist: track.artist, time: now };

      // 切换歌曲时重置位置
      if (trackId !== state.lastTrackId) {
        state.lastTrackId = trackId;
        state.lastPosition = track.currentTime;
        state.lastCheckTime = now;
        saveState(state);
        saveTotal(this._total);
        return;
      }

      const timeDiffSec = (now - state.lastCheckTime) / 1000;
      const posDiff = track.currentTime - state.lastPosition;

      // 正常播放：累加有效时间
      if (posDiff > 0 && posDiff <= timeDiffSec + 2) {
        this._total.totalSeconds += posDiff;
        this._total.totalSeconds = Math.round(this._total.totalSeconds * 10) / 10;
        state.lastPosition = track.currentTime;
      } else if (posDiff !== 0) {
        state.lastPosition = track.currentTime; // 跳转时修正位置
      }

      state.lastCheckTime = now;
      saveState(state);
      saveTotal(this._total);
    },

    // 获取总秒数（供UI使用）
    getTotalSeconds: function() {
      return this._total.totalSeconds;
    }
  };

  // 定时更新（每秒）
  setInterval(() => stats.update(), 1000);
  window.addEventListener('beforeunload', () => stats.update());

  // 暴露核心对象（仅用于查看，不提供修改）
  window.MoeKoeStatsCore = {
    getTotalSeconds: stats.getTotalSeconds.bind(stats),
    getFormatted: () => formatHM(stats.getTotalSeconds())
  };

  console.log('[MoeKoe Stats] 核心模块已加载，当前累计:', formatHM(stats.getTotalSeconds()));
})();


// ==================== UI 显示模块 ====================
(function() {
  'use strict';

  const TOTAL_KEY = 'moekoe_playback_total';     // 与核心模块保持一致

  function loadTotal() {
    try {
      const raw = localStorage.getItem(TOTAL_KEY);
      if (!raw) return { totalSeconds: 0 };
      const data = JSON.parse(raw);
      if (typeof data.totalSeconds === 'number') {
        data.totalSeconds = Math.round(data.totalSeconds * 10) / 10;
      }
      return data;
    } catch (e) {
      console.warn('[MoeKoe UI] 读取总时长失败，使用默认值');
      return { totalSeconds: 0 };
    }
  }

  function formatHM(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return hrs > 0 ? `${hrs}小时 ${mins}分钟` : `${mins}分钟`;
  }

  function getDisplayText() {
    const total = loadTotal();
    return `你已使用MoeKoe Music播放 ${formatHM(total.totalSeconds)}`;
  }

  let displayElement = null;

  function updateDisplay() {
    if (displayElement) displayElement.textContent = getDisplayText();
  }

  function ensureDisplayElement() {
    const container = document.querySelector('.user-actions');
    if (!container) return false;

    let el = container.querySelector('.moekoe-custom-duration');
    if (el) {
      if (displayElement !== el) {
        displayElement = el;
        updateDisplay();
      }
      return true;
    }

    el = document.createElement('span');
    el.className = 'moekoe-custom-duration';
    el.style.cssText = 'background-color:#fff3; padding:3px 8px; border-radius:10px; color:#fff; margin-left:auto; font-size:12px; white-space:nowrap;';
    container.appendChild(el);
    displayElement = el;
    updateDisplay();
    return true;
  }

  const observer = new MutationObserver(() => ensureDisplayElement());
  observer.observe(document.body, { childList: true, subtree: true });

  ensureDisplayElement();
  setInterval(updateDisplay, 30000);
  window.addEventListener('beforeunload', () => observer.disconnect());

  console.log('[MoeKoe UI] 独立UI模块已启动，直接读取本地存储');
})();