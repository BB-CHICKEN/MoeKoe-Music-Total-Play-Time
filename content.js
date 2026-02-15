// MoeKoe Music Helper - 核心统计模块
(function() {
  'use strict';
  
  const STATS_KEY = 'moekoe_playback_stats';
  const PROGRESS_KEY = 'player_progress';
  
  const defaultStats = {
    totalSeconds: 0,
    lastTrackId: '',
    lastPosition: 0,
    lastCheckTime: 0,
    lastPlayedTrack: null
  };
  
  // 存储工具
  function loadStats() {
    try {
      const encoded = localStorage.getItem(STATS_KEY);
      if (encoded) {
        const decoded = atob(encoded);
        const jsonStr = decodeURIComponent(decoded);
        return JSON.parse(jsonStr);
      }
    } catch (e) {
      console.warn('[MoeKoe Stats] 读取统计失败，使用默认值', e);
    }
    return { ...defaultStats };
  }
  
  function saveStats(stats) {
    try {
      const jsonStr = JSON.stringify(stats);
      const encodedStr = encodeURIComponent(jsonStr);
      const base64 = btoa(encodedStr);
      localStorage.setItem(STATS_KEY, base64);
    } catch (e) {
      console.error('[MoeKoe Stats] 保存统计失败', e);
    }
  }
  
  function formatHM(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return hrs > 0 ? `${hrs}小时 ${mins}分钟` : `${mins}分钟`;
  }
  
  function getCurrentPlaybackInfo() {
    let currentTime = 0;
    try {
      const saved = localStorage.getItem(PROGRESS_KEY);
      if (saved !== null) {
        currentTime = parseFloat(saved);
        if (isNaN(currentTime)) currentTime = 0;
      }
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
  
  const stats = {
    _data: loadStats(),
    
    update: function() {
      const track = getCurrentPlaybackInfo();
      const now = Date.now();
      const data = this._data;
      
      if (!track.title || track.title === '未知歌曲') {
        data.lastTrackId = '';
        data.lastCheckTime = now;
        saveStats(data);
        return;
      }
      
      const trackId = `${track.title}|${track.artist}`;
      data.lastPlayedTrack = { title: track.title, artist: track.artist, time: now };
      
      if (trackId !== data.lastTrackId) {
        data.lastTrackId = trackId;
        data.lastPosition = track.currentTime;
        data.lastCheckTime = now;
        saveStats(data);
        return;
      }
      
      const timeDiffSec = (now - data.lastCheckTime) / 1000;
      const posDiff = track.currentTime - data.lastPosition;
      
      if (posDiff > 0 && posDiff <= timeDiffSec + 2) {
        data.totalSeconds += posDiff;
        data.lastPosition = track.currentTime;
      } else if (posDiff !== 0) {
        data.lastPosition = track.currentTime;
      }
      
      data.lastCheckTime = now;
      saveStats(data);
    },
    
    getTotalSeconds: function() {
      return this._data.totalSeconds;
    },
    
    getFormatted: function() {
      return formatHM(this._data.totalSeconds);
    },
    
    reset: function() {
      this._data = { ...defaultStats };
      saveStats(this._data);
    },
    
    getRaw: function() {
      return { ...this._data };
    }
  };
  
  setInterval(() => stats.update(), 1000);
  window.addEventListener('beforeunload', () => stats.update());
  
  window.MoeKoeStatsCore = stats;
  
  console.log('[MoeKoe Stats] 核心模块已加载，当前累计:', stats.getFormatted());
})();


/* 渲染部分 */

// MoeKoe Music Helper - 独立UI显示模块（不依赖核心模块）
(function() {
  'use strict';
  
  const STATS_KEY = 'moekoe_playback_stats';
  
  // ---------- 独立存储读取函数（与核心模块保持一致）----------
  function loadStats() {
    const defaultStats = {
      totalSeconds: 0,
      lastTrackId: '',
      lastPosition: 0,
      lastCheckTime: 0,
      lastPlayedTrack: null
    };
    try {
      const encoded = localStorage.getItem(STATS_KEY);
      if (encoded) {
        const decoded = atob(encoded);
        const jsonStr = decodeURIComponent(decoded);
        return JSON.parse(jsonStr);
      }
    } catch (e) {
      console.warn('[MoeKoe UI] 读取统计失败，使用默认值', e);
    }
    return { ...defaultStats };
  }
  
  function formatHM(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return hrs > 0 ? `${hrs}小时 ${mins}分钟` : `${mins}分钟`;
  }
  
  // 获取当前累计时长文本
  function getCurrentDisplayText() {
    const stats = loadStats();
    return `你已使用MoeKoe Music播放 ${formatHM(stats.totalSeconds)}`;
  }
  
  // ---------- DOM 操作 ----------
  let displayElement = null;
  
  function updateDisplay() {
    if (!displayElement) return;
    displayElement.textContent = getCurrentDisplayText();
  }
  
  function ensureDisplayElement() {
    const userActions = document.querySelector('.user-actions');
    if (!userActions) return false;
    
    // 查找是否已存在我们的元素
    let existing = userActions.querySelector('.moekoe-custom-duration');
    if (existing) {
      if (displayElement !== existing) {
        displayElement = existing;
        updateDisplay();
      }
      return true;
    }
    
    // 创建新元素（样式与原有听歌时长标签一致）
    const el = document.createElement('span');
    el.className = 'moekoe-custom-duration';
    el.style.backgroundColor = '#fff3';
    el.style.padding = '3px 8px';
    el.style.borderRadius = '10px';
    el.style.color = '#fff';
    el.style.marginLeft = 'auto';   // 在 flex 容器中靠右
    el.style.fontSize = '12px';
    el.style.whiteSpace = 'nowrap';
    
    userActions.appendChild(el);
    displayElement = el;
    updateDisplay();
    return true;
  }
  
  // 监听 DOM 变化（处理 SPA 路由切换）
  const observer = new MutationObserver(() => {
    ensureDisplayElement();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  
  // 立即尝试插入
  ensureDisplayElement();
  
  // 定时更新显示（每秒）
  setInterval(updateDisplay, 30000);
  
  // 页面卸载时清理
  window.addEventListener('beforeunload', () => {
    observer.disconnect();
  });
  
  console.log('[MoeKoe UI] 独立UI模块已启动，直接读取本地存储');
})();