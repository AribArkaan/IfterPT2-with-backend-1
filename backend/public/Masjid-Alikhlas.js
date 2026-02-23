document.addEventListener('DOMContentLoaded', async () => {
  // ================================================================
  // 1. KONFIGURASI SISTEM (MASJID AL-IKHLAS)
  // ================================================================
  const CONFIG = {
    LOCATION: { LATITUDE: -6.9419, LONGITUDE: 107.6824 },
    CALCULATION: {
      METHOD: 11, // Kemenag RI
      IHTIYAT: { Subuh: 3, Dzuhur: 3, Ashar: 2, Maghrib: 2, Isya: 3, Terbit: -7 }
    },
    DISPLAY: {
      ROTATION_INTERVALS: { DATE_EVENT: 15000, MAIN_CONTENT: 20000 },
      PRAYER_NAMES: { id: ['Subuh', 'Terbit', 'Dzuhur', 'Ashar', 'Maghrib', 'Isya'] }
    },
    FALLBACK_TIMINGS: {
      Subuh: "04:15",
      Terbit: "05:30",
      Dzuhur: "11:45",
      Ashar: "15:00",
      Maghrib: "17:55",
      Isya: "19:05"
    }
  };

  // State management
  const STATE = {
    currentPrayerTimes: [],
    currentNextPrayer: null,
    contentRotationInterval: null,
    dateEventRotationInterval: null,
    clockInterval: null,
    dateUpdateInterval: null,
    isWebSocketConnected: false,
    lastFinanceUpdate: null,
    runningTexts: [],
    events: [],
    contentItems: [],
    hijriDate: null,
    hijriDay: null,
    hijriMonth: null,
    hijriYear: null,
    masjidName: 'MASJID AL-IKHLAS',
    masjidAddress: 'Jl. Riung Wulan No. 01',
    lastHijriUpdate: null,
    hijriSource: null,
    financeSummary: null,
    settings: {
      adzan_redirect_minutes: 5,
      iqomah_duration: 10
    },
    iqomahTimes: [],
    nextPrayer: null,
    isAdzanMode: false,
    isIqomahMode: false,
    adzanCheckInterval: null,
    ramadhanMode: false,
    imsakTime: null

  };

  async function shouldShowFinanceDisplay() {
    try {
      // Cek dari STATE dulu
      if (STATE.settings && STATE.settings.finance_display !== undefined) {
        return STATE.settings.finance_display === '1' || STATE.settings.finance_display === true;
      }

      // Cek dari localStorage sebagai fallback
      const localSetting = localStorage.getItem('finance_display');
      if (localSetting !== null) {
        return localSetting === '1';
      }

      // Cek dari API
      const response = await fetch('/api/settings/finance_display');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const isEnabled = result.data.finance_display;
          // Simpan ke STATE
          if (!STATE.settings) STATE.settings = {};
          STATE.settings.finance_display = isEnabled ? '1' : '0';
          // Simpan ke localStorage
          localStorage.setItem('finance_display', isEnabled ? '1' : '0');
          return isEnabled;
        }
      }
    } catch (error) {
      console.error('❌ Error checking finance display:', error);
    }

    return true; // Default true jika gagal
  }



  // WebSocket connection
  let ws = null;
  let financeChartInstance = null;

  function showToast(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);

    // Buat element toast jika belum ada
    let toast = document.getElementById('system-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'system-toast';
      toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-family: 'Jost', sans-serif;
      font-size: 14px;
      z-index: 9999;
      opacity: 0;
      transition: opacity 0.3s ease;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
      document.body.appendChild(toast);
    }

    // Set warna berdasarkan type
    const colors = {
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6'
    };

    toast.style.backgroundColor = colors[type] || colors.info;
    toast.textContent = message;

    // Tampilkan toast
    setTimeout(() => {
      toast.style.opacity = '1';
    }, 10);

    // Sembunyikan setelah 3 detik
    setTimeout(() => {
      toast.style.opacity = '0';
    }, 3000);
  }

  // ================================================================
  // 2. FUNGSI UTAMA LOAD DATA
  // ================================================================

  // Load prayer times dari API
  async function loadPrayerTimes() {
    try {
      console.log('🔄 Loading prayer times from API...');

      const response = await fetch('/api/prayer-times');
      if (!response.ok) {
        throw new Error('Failed to fetch prayer times');
      }

      const result = await response.json();
      if (result.success && result.data) {
        STATE.currentPrayerTimes = result.data;

        // Update tampilan waktu shalat
        updatePrayerTimes(result.data);

        // Hitung shalat berikutnya
        calculateNextPrayer();

        // Update countdown
        updateNextPrayerDisplay();

        // Highlight shalat berikutnya
        highlightCurrentPrayer();

        console.log('✅ Prayer times loaded:', result.data.length, 'prayers');
      } else {
        console.error('❌ Invalid prayer times data');
        useFallbackTimings();
      }
    } catch (error) {
      console.error('❌ Error loading prayer times:', error);
      useFallbackTimings();
    }
  }

  // Update prayer times display
  function updatePrayerTimes(prayers) {
    if (!Array.isArray(prayers) || prayers.length === 0) return;

    const prayerOrder = ['Subuh', 'Terbit', 'Dzuhur', 'Ashar', 'Maghrib', 'Isya'];

    prayerOrder.forEach(prayerName => {
      const prayer = prayers.find(p => p.prayer_name === prayerName);
      const timeElement = document.getElementById(`time-${prayerName}`);

      if (timeElement && prayer && prayer.time) {
        // Format waktu ke HH:MM
        let timeStr = prayer.time;
        if (timeStr.includes(':')) {
          const parts = timeStr.split(':');
          timeStr = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
        }
        timeElement.textContent = timeStr;
      }
    });
  }

  // Load Ramadhan mode
  async function loadRamadhanMode() {
    try {
      const response = await fetch('/api/ramadhan-mode');
      const data = await response.json();
      STATE.ramadhanMode = data.isRamadhan;
      console.log(`🌙 Ramadhan mode: ${STATE.ramadhanMode ? 'ON' : 'OFF'}`);
    } catch (error) {
      console.error('Error loading ramadhan mode:', error);
      STATE.ramadhanMode = false;
    }
  }

  // Load imsak time (dihitung otomatis dari Subuh)
  async function loadImsakTime() {
    try {
      const response = await fetch('/api/imsak-time');
      const result = await response.json();

      if (result.success && result.data) {
        STATE.imsakTime = result.data.imsak_time;
        console.log(`🌙 Imsak time: ${STATE.imsakTime} (Subuh - 10 menit)`);
        return result.data.imsak_time;
      }
    } catch (error) {
      console.error('Error loading imsak time:', error);
    }
    return null;
  }

  // Tambahkan item imsak ke sidebar
  function addImsakToSidebar() {
    const prayerContainer = document.querySelector('.flex.flex-col.justify-between.font-jaldi');
    if (!prayerContainer) return;

    // Hapus jika sudah ada
    removeImsakFromSidebar();

    // Buat elemen baru
    const imsakItem = document.createElement('div');
    imsakItem.id = 'prayer-Imsak';
    imsakItem.className = 'prayer-item flex justify-between items-center px-[1vw] py-[0.5vw] rounded-lg border-b border-gray-600 border-dashed bg-purple-50/50';

    imsakItem.innerHTML = `
        <span class="font-regular flex items-center">
            <i class="fas fa-moon text-purple-600 text-sm"></i>
            IMSAK
            <span class="text-[0.7vw] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Ramadhan</span>
        </span>
        <span id="time-Imsak" class="font-bold">${STATE.imsakTime || '--:--'}</span>
    `;

    // Insert setelah Subuh
    const subuhElement = document.getElementById('prayer-Subuh');

    if (subuhElement) {      
      prayerContainer.insertBefore(imsakItem, subuhElement);
      console.log('✅ Imsak ditempatkan di ATAS Subuh');
    } else {    
      prayerContainer.insertBefore(imsakItem, prayerContainer.firstChild);
    }
  }

  // Hapus item imsak
  function removeImsakFromSidebar() {
    const imsakElement = document.getElementById('prayer-Imsak');
    if (imsakElement) {
      imsakElement.remove();
    }
  }

  // Update display imsak
  async function updateImsakDisplay() {
    await loadRamadhanMode();

    if (STATE.ramadhanMode) {
      await loadImsakTime();
      addImsakToSidebar();

      // Auto-refresh setiap jam (untuk jaga-jaga jika Subuh berubah)
      setTimeout(() => {
        updateImsakDisplay();
      }, 3600000); // 1 jam
    } else {
      removeImsakFromSidebar();
    }
  }

  // Calculate next prayer
  function calculateNextPrayer() {
    const prayers = STATE.currentPrayerTimes;
    if (!Array.isArray(prayers) || prayers.length === 0) {
      console.log('❌ Tidak ada data jadwal shalat');
      return null;
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const currentSeconds = now.getSeconds();
    const currentTotalSeconds = currentMinutes * 60 + currentSeconds;

    let nextPrayer = null;
    let smallestDiff = Infinity;

    // Urutan shalat yang benar
    const prayerOrder = ['Subuh', 'Terbit', 'Dzuhur', 'Ashar', 'Maghrib', 'Isya'];

    // Urutkan prayers berdasarkan urutan shalat
    const sortedPrayers = prayerOrder
      .map(name => prayers.find(p => p.prayer_name === name))
      .filter(p => p && p.time); // Hanya yang punya waktu

    if (sortedPrayers.length === 0) {
      console.log('❌ Tidak ada waktu shalat yang valid');
      return null;
    }

    // Cari shalat berikutnya
    for (const prayer of sortedPrayers) {
      if (!prayer.time) continue;

      const [hours, minutes] = prayer.time.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes)) continue;

      const prayerMinutes = hours * 60 + minutes;
      let diff = prayerMinutes - currentMinutes;

      // Jika waktu shalat sudah lewat hari ini, tambah 24 jam
      if (diff < 0) {
        diff += 24 * 60;
      }

      // Skip Terbit jika sudah lewat (kecuali untuk besok)
      if (prayer.prayer_name === 'Terbit' && diff > 12 * 60) {
        continue;
      }

      // Cari dengan selisih waktu terkecil
      if (diff < smallestDiff) {
        smallestDiff = diff;
        nextPrayer = {
          name: prayer.prayer_name,
          time: prayer.time,
          timeMinutes: prayerMinutes,
          diffMinutes: diff,
          diffHours: Math.floor(diff / 60),
          diffRemainingMinutes: diff % 60,
          isTomorrow: diff > 12 * 60 // Lebih dari 12 jam = besok
        };
      }
    }

    // Jika tidak ada shalat berikutnya (sudah lewat Isya), ambil Subuh besok
    if (!nextPrayer) {
      const subuh = prayers.find(p => p.prayer_name === 'Subuh');
      if (subuh && subuh.time) {
        const [hours, minutes] = subuh.time.split(':').map(Number);
        const prayerMinutes = hours * 60 + minutes;
        const diff = (24 * 60 - currentMinutes) + prayerMinutes;

        nextPrayer = {
          name: 'Subuh',
          time: subuh.time,
          timeMinutes: prayerMinutes,
          diffMinutes: diff,
          diffHours: Math.floor(diff / 60),
          diffRemainingMinutes: diff % 60,
          isTomorrow: true
        };
      }
    }

    STATE.currentNextPrayer = nextPrayer;

    if (nextPrayer) {
      console.log(`✅ Next prayer: ${nextPrayer.name} at ${nextPrayer.time} (in ${nextPrayer.diffMinutes} minutes)`);
    } else {
      console.log('❌ Tidak dapat menentukan shalat berikutnya');
    }

    return nextPrayer;
  }

  // Update next prayer display
  function updateNextPrayerDisplay() {
    const nextPrayer = STATE.currentNextPrayer;

    // PERBAIKAN: Gunakan id yang sesuai dengan HTML
    const countdownElement = document.getElementById('next-prayer-countdown');

    if (!countdownElement) {
      console.error('❌ Element next-prayer-countdown tidak ditemukan!');
      return;
    }

    if (nextPrayer) {
      // Hitung selisih waktu dalam detik
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const currentSeconds = now.getSeconds();

      // Parse waktu shalat
      const [hours, minutes] = nextPrayer.time.split(':').map(Number);
      let prayerMinutes = hours * 60 + minutes;

      // Jika sudah lewat, tambah 24 jam
      if (prayerMinutes < currentMinutes) {
        prayerMinutes += 24 * 60;
      }

      // Hitung selisih dalam detik
      const diffSeconds = (prayerMinutes * 60) - (currentMinutes * 60 + currentSeconds);

      // Konversi ke jam, menit, detik
      const hours_left = Math.floor(diffSeconds / 3600);
      const minutes_left = Math.floor((diffSeconds % 3600) / 60);
      const seconds_left = diffSeconds % 60;

      // Format countdown dengan HTML
      let countdownHTML = '';

      if (diffSeconds < 60) {
        // Kurang dari 1 menit - tampilkan detik
        countdownHTML = `
        <span class="text-2xl font-bold">${nextPrayer.name}</span>
        <span class="text-4xl ">: -</span>
        <span class="text-4xl font-bold text-yellow-600 ">${seconds_left}</span>
      `;
      } else if (hours_left > 24) {
        // Lebih dari 24 jam - tampilkan hari
        const days = Math.floor(hours_left / 24);
        const remainingHours = hours_left % 24;
        countdownHTML = `
        <span class="text-4xl font-bold">${nextPrayer.name}</span>
        <span class="text-4xl ">: -</span>
        <span class="text-2xl font-bold text-yellow-600">${days}</span>
        <span class="text-4xl text-gray-400 ">:</span>
        <span class="text-4xl font-bold text-yellow-600">${remainingHours}</span>
        <span class="text-4xl text-gray-400 ">:</span>
        <span class="text-4xl font-bold text-yellow-600 ">${minutes_left}</span>
        <span class="text-xl; font-bold text-yellow-600">${seconds_left}</span>
      `;
      } else if (hours_left > 0) {
        // Lebih dari 1 jam - tampilkan jam, menit, detik
        countdownHTML = `
        <span class="text-4xl font-bold">${nextPrayer.name}</span>
        <span class="text-4xl ">: -</span>
        <span class="text-4xl font-bold text-yellow-600">${hours_left}</span>
        <span class="text-4xl text-gray-400 ">:</span>
        <span class="text-4xl font-bold text-yellow-600 ">${minutes_left}</span>
        <span class="text-xl; font-bold text-yellow-600">${seconds_left}</span>
      `;
      } else {
        // Kurang dari 1 jam - tampilkan menit dan detik
        countdownHTML = `
        <span class="text-4xl font-bold">${nextPrayer.name}</span>
        <span class="text-4xl ">: -</span>
        <span class="text-4xl font-bold text-yellow-600 ">${minutes_left}</span>
        <span class="text-xl; font-bold text-yellow-600">${seconds_left}</span>
      `;
      }

      // Tambahkan label "besok" jika shalat untuk hari berikutnya
      if (nextPrayer.isTomorrow) {
        countdownHTML += `<span class="text-sm text-gray-400 ml-2">(besok)</span>`;
      }

      countdownElement.innerHTML = countdownHTML;
      countdownElement.classList.remove('text-gray-500');
      countdownElement.classList.add('text-yellow-600', 'font-bold');

      console.log(`⏰ Next prayer: ${nextPrayer.name} at ${nextPrayer.time}, in ${diffSeconds} seconds`);
    } else {
      countdownElement.innerHTML = 'Tidak ada jadwal shalat berikutnya';
      countdownElement.classList.remove('text-yellow-600');
      countdownElement.classList.add('text-gray-500');
    }
  }

  async function loadAdzanSettings() {
    try {
      const response = await fetch('/api/settings');
      if (!response.ok) throw new Error('Gagal load settings');

      const result = await response.json();
      if (result.success && result.data) {
        const settingsObj = {};
        result.data.forEach(setting => {
          settingsObj[setting.setting_key] = setting.setting_value;
        });

        STATE.settings = {
          adzan_redirect_minutes: parseInt(settingsObj.adzan_redirect_minutes) || 5,
          iqomah_duration: parseInt(settingsObj.iqomah_duration) || 10
        };

        console.log('✅ Adzan settings loaded:', STATE.settings);
      }
    } catch (error) {
      console.error('❌ Error loading adzan settings:', error);
    }
  }

  // Highlight current prayer
  function highlightCurrentPrayer() {
    const nextPrayer = STATE.currentNextPrayer;
    if (!nextPrayer || !nextPrayer.name) return;

    // Reset semua highlight
    document.querySelectorAll('.prayer-item').forEach(el => {
      el.classList.remove('bg-yellow-100', 'border-yellow-500', 'next-prayer', 'ring-2', 'ring-yellow-300');
    });

    // Highlight shalat berikutnya
    const prayerElement = document.getElementById(`prayer-${nextPrayer.name}`);
    if (prayerElement) {
      prayerElement.classList.add('bg-yellow-100', 'border-yellow-500', 'next-prayer', 'ring-2', 'ring-yellow-300');
    }
  }

  // Fallback jika semua sumber gagal
  function useFallbackTimings() {
    console.log('⚠️ Using fallback timings');

    const fallbackPrayers = CONFIG.DISPLAY.PRAYER_NAMES.id.map(name => ({
      prayer_name: name,
      time: CONFIG.FALLBACK_TIMINGS[name] || '--:--',
      ihtiyat: CONFIG.CALCULATION.IHTIYAT[name] || 0
    }));

    STATE.currentPrayerTimes = fallbackPrayers;
    updatePrayerTimes(fallbackPrayers);
    calculateNextPrayer();
    updateNextPrayerDisplay();
    highlightCurrentPrayer();
  }

  function renderAnnouncement(content) {
    try {
      console.log('🎨 renderAnnouncement called for:', content.title);

      // Parse JSON content_text jika berupa string JSON
      let announcementData;

      if (!content.content_text) {
        console.log('⚠️ content_text kosong');
        announcementData = {};
      } else if (typeof content.content_text === 'string') {
        try {
          // Coba parse sebagai JSON
          if (content.content_text.trim().startsWith('{')) {
            announcementData = JSON.parse(content.content_text);
            console.log('✅ JSON parsed successfully');
          } else {
            // Bukan JSON, treat sebagai plain text
            announcementData = { text: content.content_text };
          }
        } catch (e) {
          console.log('⚠️ JSON parse failed, using as plain text');
          announcementData = { text: content.content_text };
        }
      } else {
        announcementData = content.content_text || {};
      }

      console.log('📊 Announcement data:', announcementData);

      // Default values - DIUTAMAKAN UNTUK DISPLAY BESAR
      const {
        text = '',
        font_family = 'Inter',
        title_font_size = 48,
        desc_font_size = 32,
        color = '#000000',
        bg_color = '#ffffff',
        bg_opacity = 100,
        bold = true,
        italic = false,
        underline = false,
        text_align = 'center',
        position = 'center'
      } = announcementData;

      // Parse position ke flexbox alignment
      let justifyContent = 'center';
      let alignItems = 'center';

      switch (position) {
        case 'top-left': justifyContent = 'flex-start'; alignItems = 'flex-start'; break;
        case 'top-center': justifyContent = 'center'; alignItems = 'flex-start'; break;
        case 'top-right': justifyContent = 'flex-end'; alignItems = 'flex-start'; break;
        case 'middle-left': justifyContent = 'flex-start'; alignItems = 'center'; break;
        case 'center': justifyContent = 'center'; alignItems = 'center'; break;
        case 'middle-right': justifyContent = 'flex-end'; alignItems = 'center'; break;
        case 'bottom-left': justifyContent = 'flex-start'; alignItems = 'flex-end'; break;
        case 'bottom-center': justifyContent = 'center'; alignItems = 'flex-end'; break;
        case 'bottom-right': justifyContent = 'flex-end'; alignItems = 'flex-end'; break;
      }

      // Font styling
      const fontWeight = bold ? 'bold' : 'normal';
      const fontStyle = italic ? 'italic' : 'normal';
      const textDecoration = underline ? 'underline' : 'none';

      // Convert hex to rgba untuk background
      let bgColorWithOpacity;
      try {
        const r = parseInt(bg_color.slice(1, 3), 16) || 255;
        const g = parseInt(bg_color.slice(3, 5), 16) || 255;
        const b = parseInt(bg_color.slice(5, 7), 16) || 255;
        bgColorWithOpacity = `rgba(${r}, ${g}, ${b}, ${bg_opacity / 100})`;
      } catch (e) {
        bgColorWithOpacity = 'rgba(255, 255, 255, 1)';
      }

      // Escape HTML untuk keamanan
      const escapeHTML = (str) => {
        if (!str) return '';
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      };

      // Buat HTML container
      const html = `
      <div class="announcement-container w-full h-full flex" style="
        justify-content: ${justifyContent}; 
        align-items: ${alignItems}; 
        background: ${bgColorWithOpacity};
        padding: 4vw;
        box-sizing: border-box;
        overflow: hidden;
      ">
        <div class="announcement-content" style="
          max-width: 95%;
          max-height: 95%;
          overflow: auto;
          text-align: ${text_align};
        ">
          ${content.title ? `
            <div class="announcement-title" style="
              font-family: '${font_family}', sans-serif;
              font-size: ${title_font_size}px;
              font-weight: ${fontWeight};
              font-style: ${fontStyle};
              text-decoration: ${textDecoration};
              color: ${color};
              margin-bottom: 2vw;
              line-height: 1.4;
              word-wrap: break-word;
            ">
              ${escapeHTML(content.title)}
            </div>
          ` : ''}
          
          ${text ? `
            <div class="announcement-text" style="
              font-family: '${font_family}', sans-serif;
              font-size: ${desc_font_size}px;
              color: ${color};
              line-height: 1.6;
              word-wrap: break-word;
            ">
              ${escapeHTML(text).replace(/\n/g, '<br>')}
            </div>
          ` : ''}
        </div>
      </div>
    `;

      console.log('✅ HTML generated successfully');
      return html;

    } catch (error) {
      console.error('❌ Error rendering announcement:', error);
      // Fallback ke tampilan sederhana
      return `
      <div class="w-full h-full flex items-center justify-center bg-gray-100 p-8">
        <div class="text-center">
          <h3 class="text-6xl font-bold text-gray-800 mb-4">${escapeHTML(content.title || 'Pengumuman')}</h3>
          ${content.content_text ? `<p class="text-4xl text-gray-600">${escapeHTML(String(content.content_text))}</p>` : ''}
        </div>
      </div>
    `;
    }
  }
  // ================================================================
  // 3. WEBSOCKET CONNECTION & REAL-TIME UPDATES
  // ================================================================

  // Initialize WebSocket
  function initWebSocket() {
    try {
      // Close existing connection if any
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;

      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ WebSocket terhubung ke display');
        STATE.isWebSocketConnected = true;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📡 WebSocket message received:', data.type);
          handleWebSocketUpdate(data);
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      };

      ws.onclose = () => {
        console.log('❌ WebSocket terputus, mencoba reconnect...');
        STATE.isWebSocketConnected = false;
        setTimeout(initWebSocket, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        STATE.isWebSocketConnected = false;
      };
    } catch (error) {
      console.error('Gagal menghubungkan WebSocket:', error);
      STATE.isWebSocketConnected = false;
    }
  }

  function startHijriDateAutoRefresh() {
    // Refresh setiap jam untuk cek cache
    setInterval(async () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();

      // Refresh pada jam 00:00, 06:00, 12:00, 18:00
      if ((hours === 0 || hours === 6 || hours === 12 || hours === 18) && minutes === 0) {
        console.log('🔄 Auto-refresh tanggal Hijriyah...');

        // Hapus cache untuk memaksa update
        localStorage.removeItem('hijri_date_cache_timestamp');

        // Update display
        await updateDateDisplay();
      }

      // Cek kadaluarsa cache (24 jam)
      const cachedTimestamp = localStorage.getItem('hijri_date_cache_timestamp');
      if (cachedTimestamp) {
        const age = Date.now() - parseInt(cachedTimestamp);
        if (age > 24 * 60 * 60 * 1000) {
          console.log('🔄 Cache tanggal Hijriyah kadaluarsa, refresh...');
          localStorage.removeItem('hijri_date_cache_timestamp');
          await updateDateDisplay();
        }
      }
    }, 60000); // Cek setiap menit
  }

  // Handle WebSocket updates
  function handleWebSocketUpdate(data) {
    console.log('🔄 Processing WebSocket update:', data.type);

    switch (data.type) {
      case 'running_text_updated':
        console.log('📝 Running text updated via WebSocket, reloading...');
        loadRunningText();
        break;

      case 'ramadhan_mode_updated':
        console.log(`🌙 Ramadhan mode ${data.enabled ? 'ON' : 'OFF'} via WebSocket`);
        STATE.ramadhanMode = data.enabled;
        updateImsakDisplay();
        break;

      case 'prayer_times_updated':
        console.log('🕌 Prayer times updated, recalculating imsak...');
        if (STATE.ramadhanMode) {
          loadImsakTime().then(() => {
            addImsakToSidebar();
          });
        }
        break;



      case 'settings_updated':
        console.log('⚙️ Settings diperbarui');

        // Cek apakah ada update untuk finance_display
        if (data.data) {
          // Single setting update
          if (data.data.key === 'finance_display') {
            const showFinance = data.data.value === '1';
            console.log(`💰 Finance display setting updated via WebSocket: ${showFinance ? 'SHOW' : 'HIDE'}`);

            // Update STATE
            if (!STATE.settings) STATE.settings = {};
            STATE.settings.finance_display = data.data.value;

            // Update localStorage
            localStorage.setItem('finance_display', data.data.value);

            // Reload content untuk menampilkan/menyembunyikan finance item
            refreshContentDisplay();
          }

          // Update masjid info jika ada
          if (data.data.key === 'masjid_name' || data.data.key === 'masjid_address') {
            loadMasjidInfo();
          }
        }

        // Bulk settings update
        if (Array.isArray(data.data)) {
          const financeSetting = data.data.find(s => s.key === 'finance_display');
          if (financeSetting) {
            if (!STATE.settings) STATE.settings = {};
            STATE.settings.finance_display = financeSetting.value;
            localStorage.setItem('finance_display', financeSetting.value);
            refreshContentDisplay();
          }
        }

        loadSettings();
        loadAdzanSettings();
        break;

      case 'events_updated':
        console.log('📅 Events diperbarui');
        loadEvents();
        break;

      case 'iqomah_times_updated':
        console.log('⏰ Iqomah times updated');
        loadIqomahTimes();
        break;

      case 'finances_updated':
      case 'finance_summary_updated':
        console.log('💰 Data keuangan diperbarui');
        loadFinanceData();
        break;

      case 'content_updated':
        console.log('🖼️ Content updated');
        loadContent();
        break;

      default:
        console.log('Unknown WebSocket message type:', data.type);
    }
  }

  async function loadMasjidInfo() {
    try {
      const response = await fetch('/api/settings');
      if (!response.ok) throw new Error('Gagal mengambil settings');

      const result = await response.json();
      if (result.success && result.data) {
        const settings = result.data;

        // Convert array ke object untuk mudah diakses
        const settingsObj = {};
        settings.forEach(setting => {
          settingsObj[setting.setting_key] = setting.setting_value;
        });

        // Update STATE
        STATE.masjidName = settingsObj.masjid_name || 'MASJID AL-IKHLAS';
        STATE.masjidAddress = settingsObj.masjid_address || 'Jl. Riung Wulan No. 01';

        // Update tampilan
        updateMasjidInfo();

        console.log('✅ Masjid info loaded:', STATE.masjidName);
      }
    } catch (error) {
      console.error('❌ Error loading masjid info:', error);
      // Tetap pakai default jika error
      updateMasjidInfo();
    }
  }

  function updateMasjidInfo() {
    const titleElement = document.querySelector('h2.font-jockey-one');
    const addressElement = document.querySelector('p.font-jost.text-gray-600');

    if (titleElement) {
      titleElement.textContent = STATE.masjidName;
    }

    if (addressElement) {
      addressElement.textContent = STATE.masjidAddress;
    }
  }

  // ================================================================
  // 4. FUNGSI LOAD DATA LAINNYA
  // ================================================================

  // Load running text
  async function loadRunningText() {
    try {
      console.log('🔄 Loading running text from API...');
      const response = await fetch('/api/running-text');
      if (!response.ok) throw new Error('Gagal mengambil running text');

      const result = await response.json();
      if (result.success && result.data) {

        STATE.runningTexts = result.data.filter(text => text.is_active == 1 || text.is_active === true);

        // Update display
        updateRunningTextDisplay();

        console.log(`✅ Running text loaded: ${STATE.runningTexts.length} active texts`);
      }
    } catch (error) {
      console.error('❌ Error loading running text:', error);
      // Fallback: tampilkan teks default
      const container = document.querySelector('.running-text-content');
      if (container) {
        container.innerHTML = '<span class="text-gray-500">Selamat datang di Masjid Al-Ikhlas</span>';
      }
    }
  }

  // Update running text display
  function updateRunningTextDisplay() {
    const container = document.querySelector('.running-text-content');
    if (!container) {
      console.error('❌ Running text container not found');
      return;
    }

    // Hanya gunakan teks yang aktif
    const activeTexts = STATE.runningTexts;
    if (activeTexts.length === 0) {
      // Tampilkan pesan default jika kosong, tapi styling tetap rapi
      container.innerHTML = '<div class="h-full flex items-center px-4"><span class="text-gray-400 italic">Selamat Datang di Masjid Al-Ikhlas</span></div>';
      return;
    }

    // Clear container
    container.innerHTML = '';

    // 1. Buat Wrapper Utama (Flexbox)
    const marqueeWrapper = document.createElement('div');
    marqueeWrapper.className = 'marquee-wrapper flex overflow-hidden w-full h-full items-center';

    // 2. Buat Elemen Animasi
    const marqueeContent = document.createElement('div');
    marqueeContent.className = 'animate-marquee flex whitespace-nowrap items-center';

    // 3. Susun HTML untuk SATU set teks
    let singleSetHTML = '';
    activeTexts.forEach((text, index) => {
      const fontFamily = text.font_family || 'Inter';
      const fontSize = text.font_size || 16;

      // Tambahkan text item
      singleSetHTML += `
            <span class="inline-block px-4 running-text-item" 
                  style="font-family: '${fontFamily}', sans-serif; font-size: ${fontSize}px;">
                ${escapeHTML(text.text)}
            </span>
        `;

      //separator agar ada jarak antar teks
      singleSetHTML += `
            <span class="inline-block px-4 text-yellow-500 separator" 
                  style="font-size: ${fontSize}px;">★</span>
        `;
    });

    // 4. DUPLIKASI KONTEN 
    marqueeContent.innerHTML = singleSetHTML + singleSetHTML;

    // 5. Hitung Durasi Kecepatan
    const totalLength = activeTexts.reduce((acc, t) => acc + t.text.length, 0);
    const baseSpeed = activeTexts[0]?.speed || 30;
    // Jika teks sangat panjang, kita perlambat sedikit agar tidak pusing membacanya
    const calculatedSpeed = Math.max(baseSpeed, totalLength * 0.15);

    marqueeContent.style.animationDuration = `${calculatedSpeed}s`;

    // 6. Masukkan ke DOM
    marqueeWrapper.appendChild(marqueeContent);
    container.appendChild(marqueeWrapper);

    console.log(`✅ Running text displayed. Speed: ${calculatedSpeed}s`);
  }

  function addRunningTextStyles() {
    // Cek agar tidak menumpuk style tag jika fungsi dipanggil berulang
    if (document.getElementById('dynamic-marquee-style')) return;

    const style = document.createElement('style');
    style.id = 'dynamic-marquee-style';
    style.textContent = `
        @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); } 
        }
        
        .animate-marquee {
            display: flex;
            width: fit-content; /* Penting agar lebar sesuai konten */
            animation: marquee linear infinite;
            will-change: transform;
        }
        
        .marquee-wrapper {
            position: relative;
            width: 100%;
            height: 100%;
            overflow: hidden;
            mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent);
            -webkit-mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent);
        }

        /* Responsive font size override jika perlu */
        .running-text-item {
            white-space: nowrap;
        }
    `;
    document.head.appendChild(style);
  }

  addRunningTextStyles();

  function escapeHTML(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ================================================================
  // loadContent() - DENGAN DEBUGGING
  // ================================================================

  async function loadContent() {
    try {
      console.log('🔄 Loading content from API...');
      const response = await fetch('/api/content');
      if (!response.ok) throw new Error('Gagal mengambil konten');

      const result = await response.json();
      console.log('📦 API Response:', result);

      if (result.success && result.data) {
        STATE.contentItems = result.data;
        console.log(`✅ ${STATE.contentItems.length} konten dimuat`);
        initContentRotator();
      } else {
        console.error('❌ Invalid response format:', result);
      }
    } catch (error) {
      console.error('❌ Error loading content:', error);
    }
  }

  // Initialize content rotator
  function initContentRotator() {
    // Clear existing rotation interval
    if (STATE.contentRotationInterval) {
      clearInterval(STATE.contentRotationInterval);
    }

    const rotator = document.getElementById('main-content-rotator');
    if (!rotator) {
      console.error('❌ main-content-rotator tidak ditemukan!');
      return;
    }

    // Clear existing content
    rotator.innerHTML = '';

    // Filter hanya konten yang aktif
    const activeContents = STATE.contentItems.filter(item => item.is_active);

    console.log('📋 Konten aktif:', activeContents.length, 'items');
    console.log('📋 Data konten:', activeContents.map(c => ({ id: c.id, type: c.content_type, title: c.title })));

    // Jika tidak ada konten, tampilkan default
    if (activeContents.length === 0) {
      console.log('⚠️ Tidak ada konten aktif, menampilkan default');
      const defaultItem = document.createElement('div');
      defaultItem.className = 'content-item active default-content';
      defaultItem.innerHTML = `
      <div class="w-full h-full flex items-center justify-center bg-gradient-to-r from-blue-50 to-indigo-50">
        <div class="text-center p-8">
          <h3 class="text-4xl font-bold text-gray-800 mb-4">Selamat Datang</h3>
          <p class="text-2xl text-gray-600">Masjid Al-Ikhlas</p>
        </div>
      </div>
    `;
      rotator.appendChild(defaultItem);
      return;
    }

    // Add content items
    activeContents.forEach((content, index) => {
      const item = document.createElement('div');
      item.className = `content-item ${index === 0 ? 'active' : ''}`;
      item.dataset.contentId = content.id;
      item.dataset.contentType = content.content_type;

      // PERBAIKAN: Normalisasi tipe konten
      const rawType = content.content_type?.toLowerCase() || 'text';

      console.log(`🎨 Rendering konten #${content.id}: ${content.title} (type: ${rawType})`);

      if (rawType === 'image' && content.image_url) {
        // IMAGE CONTENT
        item.innerHTML = `
        <div class="w-full h-full flex items-center justify-center bg-gray-900">
          <img src="${content.image_url}" alt="${escapeHTML(content.title)}" 
               class="max-w-full max-h-full object-contain">
        </div>
      `;
      } else if (rawType === 'video' && content.video_url) {
        // VIDEO CONTENT
        item.innerHTML = `
        <div class="w-full h-full flex items-center justify-center bg-gray-900">
          <video src="${content.video_url}" autoplay muted loop playsinline 
                 class="max-w-full max-h-full object-contain">
            Browser Anda tidak mendukung tag video.
          </video>
        </div>
      `;
      } else if (rawType === 'announcement' || rawType === 'text') {
        // ANNOUNCEMENT/TEXT CONTENT - DENGAN STYLING
        console.log('📢 Rendering announcement dengan styling:', content.title);
        console.log('📝 Content text:', content.content_text?.substring(0, 100));
        item.innerHTML = renderAnnouncement(content);
      } else {
        // FALLBACK
        console.log('⚠️ Fallback rendering untuk tipe:', rawType);
        item.innerHTML = `
        <div class="w-full h-full flex items-center justify-center p-8 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div class="text-center">
            <h3 class="text-4xl font-bold text-gray-800 mb-4">${escapeHTML(content.title || 'Judul')}</h3>
            ${content.content_text ? `<p class="text-2xl text-gray-600">${escapeHTML(content.content_text)}</p>` : ''}
          </div>
        </div>
      `;
      }

      rotator.appendChild(item);
    });

    // PERBAIKAN: Tambahkan Finance Item sebagai content-item terpisah
    addFinanceContentItem(rotator);

    console.log(`✅ Total items in rotator: ${rotator.children.length}`);

    // Start rotation jika ada lebih dari 1 konten
    if (rotator.children.length > 1) {
      startContentRotation();
    }

    checkFinanceDisplaySetting().then(showFinance => {
      if (showFinance) {
        addFinanceContentItem(rotator);
      }

      console.log(`✅ Total items in rotator: ${rotator.children.length}`);

      // Start rotation jika ada lebih dari 1 konten
      if (rotator.children.length > 1) {
        startContentRotation();
      }
    });
  }

  async function checkFinanceDisplaySetting() {
    try {
      // Coba ambil dari STATE dulu (jika sudah di-load)
      if (STATE.settings && STATE.settings.finance_display !== undefined) {
        return STATE.settings.finance_display === '1' || STATE.settings.finance_display === true;
      }

      // Jika belum, ambil dari API
      const response = await fetch('/api/settings/finance_display');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const isEnabled = result.data.finance_display;
          // Simpan ke STATE
          if (!STATE.settings) STATE.settings = {};
          STATE.settings.finance_display = isEnabled ? '1' : '0';
          return isEnabled;
        }
      }
    } catch (error) {
      console.error('Error checking finance display setting:', error);
    }

    return true;
  }



  function addFinanceContentItem(rotator) {
    const financeItem = document.createElement('div');
    financeItem.className = 'content-item'; // Jangan set active di sini
    financeItem.id = 'finance-content-item';
    financeItem.innerHTML = `
<div class="flex flex-col p-8 gap-6 h-full bg-gradient-to-br from-slate-50 to-slate-100">
  <!-- Header -->
  <div class="flex justify-between items-end border-b border-slate-200 pb-4">
    <h2 class="font-kanit font-bold text-3xl text-slate-800 tracking-tight">Laporan Keuangan Masjid</h2>
    <p id="finance-last-update" class="font-jost text-sm text-slate-500 font-medium">Update: ...</p>
  </div>

  <!-- Saldo Card (Full Width) -->
 <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
  <div class="flex items-center justify-center gap-4">
    <span class="font-kanit text-4xl text-slate-400 uppercase tracking-widest font-semibold">Saldo Akhir</span>
    <div class="h-8 w-px bg-slate-200"></div>
    <span id="fin-saldo" class="font-jockey-one text-4xl text-slate-800 tracking-tight">Rp 0</span>
  </div>
</div>

  <!-- Recent Transactions (2 Columns - 5 Left, 5 Right) -->
  <div class="grid grid-cols-2 gap-6 flex-grow">
    <!-- Left Column: No 1-5 -->
    <div class="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
      <div class="flex-grow p-4">
        <table class="w-full text-sm font-jost">
          <thead class="text-slate-400 border-b border-slate-100">
            <tr>            
              <th class="text-left py-2 font-medium">Tanggal</th>
              <th class="text-left py-2 font-medium">Keterangan</th>
              <th class="text-right py-2 font-medium">Nominal</th>
            </tr>
          </thead>
          <tbody id="recent-transactions-body" class="divide-y divide-slate-50"></tbody>
        </table>
      </div>
    </div>

    <!-- Right Column: No 6-10 -->
    <div class="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
      <div class="flex-grow p-4">
        <table class="w-full text-sm font-jost">
          <thead class="text-slate-400 border-b border-slate-100">
            <tr>             
              <th class="text-left py-2 font-medium">Tanggal</th>
              <th class="text-left py-2 font-medium">Keterangan</th>
              <th class="text-right py-2 font-medium">Nominal</th>
            </tr>
          </thead>
          <tbody id="recent-transactions-right" class="divide-y divide-slate-50"></tbody>
        </table>
      </div>
    </div>
  </div>
</div>
  `;

    rotator.appendChild(financeItem);

    // Trigger load data keuangan
    setTimeout(() => {
      loadFinanceData();
    }, 500);
  }

  // Start content rotation
  function startContentRotation() {
    STATE.contentRotationInterval = setInterval(() => {
      const rotator = document.getElementById('main-content-rotator');
      if (!rotator) {
        clearInterval(STATE.contentRotationInterval);
        return;
      }

      const items = rotator.querySelectorAll('.content-item');
      if (items.length <= 1) return;

      const currentActive = rotator.querySelector('.content-item.active');
      if (!currentActive) return;

      currentActive.classList.remove('active');

      let nextItem = currentActive.nextElementSibling;
      if (!nextItem) {
        nextItem = items[0];
      }

      if (nextItem) {
        nextItem.classList.add('active');
      }
    }, CONFIG.DISPLAY.ROTATION_INTERVALS.MAIN_CONTENT);
  }

  // Load events
  async function loadEvents() {
    try {
      const response = await fetch('/api/events');
      if (!response.ok) throw new Error('Gagal mengambil events');

      const result = await response.json();
      if (result.success && result.data) {
        STATE.events = result.data.filter(event => event.is_active);
        initDateEventRotator();
      }
    } catch (error) {
      console.error('Error loading events:', error);
    }
  }

  // Initialize date/event rotator
  function initDateEventRotator() {
    // Clear existing rotation interval
    if (STATE.dateEventRotationInterval) {
      clearInterval(STATE.dateEventRotationInterval);
    }

    const rotator = document.getElementById('date-event-rotator');
    if (!rotator) return;

    // Clear existing items
    rotator.innerHTML = '';

    // Tambah date display sebagai item pertama
    const dateItem = document.createElement('div');
    dateItem.className = 'content-item active';
    dateItem.id = 'date-display';
    rotator.appendChild(dateItem);

    // Tambah event displays dengan layout yang diperbaiki
    STATE.events.forEach((event, index) => {
      const eventDate = new Date(event.target_date);
      const today = new Date();
      const timeDiff = eventDate.getTime() - today.getTime();
      const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));

      const eventItem = document.createElement('div');
      eventItem.className = 'content-item event-item';
      eventItem.dataset.eventId = event.id;

      // HTML structure: judul event di atas dengan marquee, sisa hari di bawah
      eventItem.innerHTML = `
            <div class="event-container flex flex-col items-end justify-center w-full h-full">
                <!-- Container untuk judul event dengan marquee -->
                <div class="event-title-container w-full text-right overflow-hidden mb-1">
                    <div class="event-title-text font-jost font-bold text-[2vw] whitespace-nowrap text-right" 
                         data-original-text="${escapeHTML(event.title)}">
                        ${escapeHTML(event.title)}
                    </div>
                </div>
                <!-- Sisa hari - berada di bawah judul -->
                <div class="event-days text-right">
                    <span class="font-jost text-[1.5vw] ${daysLeft <= 7 ? 'text-red-600 font-bold' : daysLeft <= 30 ? 'text-yellow-600' : 'text-green-600'}">
                        ${daysLeft > 0 ? `${daysLeft} Hari Lagi` : 'Hari Ini'}
                    </span>
                </div>
            </div>
        `;

      rotator.appendChild(eventItem);
    });

    // Update date display pertama kali
    updateDateDisplay();

    // Cek dan aktifkan marquee untuk judul yang terlalu panjang
    setTimeout(() => {
      document.querySelectorAll('.event-title-container').forEach(container => {
        checkAndAnimateTitle(container);
      });
    }, 100);

    // Start rotation jika ada lebih dari 1 item
    if (rotator.children.length > 1) {
      startDateEventRotation();
    }
  }

  function checkAndAnimateTitle(container) {
    if (!container) return;

    const titleElement = container.querySelector('.event-title-text');
    if (!titleElement) return;

    // Reset class dan style
    titleElement.classList.remove('needs-marquee', 'animate-marquee-title');
    titleElement.style.animation = 'none';
    titleElement.style.transform = 'translateX(0)';
    titleElement.style.paddingRight = '0';

    // Force reflow
    void titleElement.offsetWidth;

    const titleWidth = titleElement.scrollWidth;
    const containerWidth = container.clientWidth;

    console.log(`📏 Title width: ${titleWidth}px, Container width: ${containerWidth}px`);

    // Jika title lebih panjang dari container, aktifkan marquee
    if (titleWidth > containerWidth) {
      titleElement.classList.add('needs-marquee', 'animate-marquee-title');

      // Hitung durasi berdasarkan panjang teks (semakin panjang, semakin lambat)
      const duration = Math.max(8, titleWidth / 30);

      titleElement.style.animationDuration = `${duration}s`;
      // Tambah padding kanan untuk jeda di akhir
      titleElement.style.paddingRight = '100px';

      console.log(`🎬 Marquee activated for: "${titleElement.textContent.trim()}" (${titleWidth}px > ${containerWidth}px), duration: ${duration}s`);
    } else {
      console.log(`✅ No marquee needed for: "${titleElement.textContent.trim()}"`);
    }
  }

  function addEventMarqueeStyles() {
    if (document.getElementById('event-marquee-styles')) return;

    const style = document.createElement('style');
    style.id = 'event-marquee-styles';
    style.textContent = `
        /* Container untuk event item */
        .event-item {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: flex-end;
        }

        /* Container event - flex column untuk judul di atas, sisa hari di bawah */
        .event-container {
            width: 100%;
            height: 100%;
            padding: 0 1vw;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }

        /* Container untuk title dengan overflow hidden */
        .event-title-container {
            width: 100%;
            position: relative;
            overflow: hidden;
            mask-image: linear-gradient(to right, transparent, black 3%, black 97%, transparent);
            -webkit-mask-image: linear-gradient(to right, transparent, black 3%, black 97%, transparent);
            height: auto;
            min-height: 2.5vw;
        }

        /* Default style untuk title */
        .event-title-text {
            display: inline-block;
            white-space: nowrap;
            transition: transform 0.3s ease;
            float: right; /* Untuk memastikan teks rata kanan */
            will-change: transform;
        }

        /* Animasi marquee yang lebih smooth dan visible */
        @keyframes eventMarqueeSlide {
            0% {
                transform: translateX(0);
            }
            5% {
                transform: translateX(0); /* Pause di awal */
            }
            45% {
                transform: translateX(calc(-100% + 100%)); /* Gerak ke kiri */
            }
            55% {
                transform: translateX(calc(-100% + 100%)); /* Pause di akhir */
            }
            95% {
                transform: translateX(0); /* Kembali ke awal */
            }
            100% {
                transform: translateX(0); /* Pause sebelum loop */
            }
        }

        /* Class untuk mengaktifkan animasi */
        .event-title-text.animate-marquee-title {
            animation: eventMarqueeSlide linear infinite;
        }

        /* Styling untuk sisa hari */
        .event-days {
            width: 100%;
            margin-top: 0.5vh;
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
            .event-title-text {
                font-size: 4vw !important;
            }
            .event-days span {
                font-size: 3vw !important;
            }
        }
    `;
    document.head.appendChild(style);
  }

  function handleResize() {
    clearTimeout(window.resizeTimeout);
    window.resizeTimeout = setTimeout(() => {
      console.log('📐 Window resized, rechecking marquee...');
      document.querySelectorAll('.event-title-container').forEach(container => {
        checkAndAnimateTitle(container);
      });
    }, 250);
  }

  // Start date/event rotation
  function startDateEventRotation() {
    STATE.dateEventRotationInterval = setInterval(() => {
      const rotator = document.getElementById('date-event-rotator');
      if (!rotator) {
        clearInterval(STATE.dateEventRotationInterval);
        return;
      }

      const items = rotator.querySelectorAll('.content-item');
      if (items.length <= 1) return;

      const currentActive = rotator.querySelector('.content-item.active');
      if (!currentActive) return;

      currentActive.classList.remove('active');

      let nextItem = currentActive.nextElementSibling;
      if (!nextItem) {
        nextItem = items[0];
      }

      if (nextItem) {
        nextItem.classList.add('active');
      }
    }, CONFIG.DISPLAY.ROTATION_INTERVALS.DATE_EVENT);
  }

  async function getHijriDate() {
    try {
      // 1. COBA DARI DATABASE (SETTINGS) - PRIORITAS TERTINGGI
      //    Ini adalah data yang diinput admin
      try {
        const response = await fetch('/api/settings/hijri_date_cache');
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            const hijriFromSettings = result.data.setting_value;
            if (hijriFromSettings && hijriFromSettings !== '1 Muharram 1445 H') {
              console.log('📅 Menggunakan tanggal Hijriyah dari database (admin)');

              // Parse tanggal dari settings
              const parsed = parseHijriDate(hijriFromSettings);
              if (parsed) {
                // Simpan ke cache
                localStorage.setItem('hijri_date_cache', hijriFromSettings);
                localStorage.setItem('hijri_date_cache_timestamp', Date.now().toString());

                return {
                  formatted: hijriFromSettings,
                  day: parsed.day,
                  month: parsed.month,
                  year: parsed.year,
                  source: 'settings'
                };
              }
            }
          }
        }
      } catch (error) {
        console.log('Settings API tidak tersedia untuk tanggal Hijriyah');
      }

      // 2. COBA DARI LOCALSTORAGE (CACHE)
      const cachedHijri = localStorage.getItem('hijri_date_cache');
      const cachedTimestamp = localStorage.getItem('hijri_date_cache_timestamp');

      // Cache valid untuk 24 jam
      const isCacheValid = cachedTimestamp &&
        (Date.now() - parseInt(cachedTimestamp)) < 24 * 60 * 60 * 1000;

      if (cachedHijri && isCacheValid) {
        console.log('📅 Menggunakan tanggal Hijriyah dari cache');

        const parsed = parseHijriDate(cachedHijri);
        if (parsed) {
          return {
            formatted: cachedHijri,
            day: parsed.day,
            month: parsed.month,
            year: parsed.year,
            source: 'cache'
          };
        }
      }

      // 3. COBA DARI API ALADHAN
      try {
        const hijriFromAPI = await fetchHijriDateFromAPI();
        if (hijriFromAPI) {
          console.log('📅 Menggunakan tanggal Hijriyah dari API Aladhan');

          // Simpan ke localStorage
          localStorage.setItem('hijri_date_cache', hijriFromAPI.formatted);
          localStorage.setItem('hijri_date_cache_timestamp', Date.now().toString());

          // Simpan ke database (background)
          saveHijriDateToDatabase(hijriFromAPI.formatted).catch(err =>
            console.log('Gagal menyimpan ke database:', err)
          );

          return hijriFromAPI;
        }
      } catch (error) {
        console.log('API Aladhan tidak tersedia');
      }

      // 4. GUNAKAN PERHITUNGAN LOKAL (FALLBACK)
      console.log('📅 Menggunakan perhitungan tanggal Hijriyah lokal');
      const calculatedHijri = calculateHijriDate(new Date());

      // Simpan ke cache
      localStorage.setItem('hijri_date_cache', calculatedHijri.formatted);
      localStorage.setItem('hijri_date_cache_timestamp', Date.now().toString());

      return calculatedHijri;

    } catch (error) {
      console.error('Error getting Hijri date:', error);

      // Ultimate fallback
      return {
        formatted: '1 Muharram 1445 H',
        day: '1',
        month: 'Muharram',
        year: '1445',
        source: 'fallback'
      };
    }
  }

  // Fetch tanggal Hijriyah dari API Aladhan
  async function fetchHijriDateFromAPI() {
    try {
      const today = new Date();
      const day = today.getDate();
      const month = today.getMonth() + 1;
      const year = today.getFullYear();

      // Gunakan lokasi dari settings atau default
      const latitude = CONFIG.LOCATION.LATITUDE || -6.9419;
      const longitude = CONFIG.LOCATION.LONGITUDE || 107.6824;
      const method = CONFIG.CALCULATION.METHOD || 11;

      const apiUrl = `https://api.aladhan.com/v1/timings/${day}-${month}-${year}?latitude=${latitude}&longitude=${longitude}&method=${method}`;

      console.log('🌐 Fetching Hijri date from API:', apiUrl);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(apiUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.code === 200 && data.data && data.data.date && data.data.date.hijri) {
          const hijri = data.data.date.hijri;
          const formatted = `${hijri.day} ${hijri.month.en} ${hijri.year} H`;

          return {
            formatted: formatted,
            day: hijri.day,
            month: hijri.month.en,
            year: hijri.year,
            source: 'api'
          };
        }
      }
    } catch (error) {
      console.error('Error fetching from Aladhan API:', error);
    }
    return null;
  }

  function parseHijriDate(hijriString) {
    try {
      // Format: "1 Muharram 1445 H"
      const match = hijriString.match(/^(\d+)\s+([A-Za-z]+)\s+(\d+)\s+H$/);
      if (match) {
        return {
          day: match[1],
          month: match[2],
          year: match[3]
        };
      }
    } catch (error) {
      console.error('Error parsing Hijri date:', error);
    }
    return null;
  }

  async function saveHijriDateToDatabase(hijriDate) {
    try {
      const response = await fetch('/api/settings/hijri_date_cache', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: hijriDate })
      });

      if (response.ok) {
        console.log('✅ Tanggal Hijriyah disimpan ke database');
      }
    } catch (error) {
      console.error('Error saving Hijri date to database:', error);
    }
  }

  function getJulianDay(year, month, day) {
    if (month <= 2) {
      year -= 1;
      month += 12;
    }

    const a = Math.floor(year / 100);
    const b = 2 - a + Math.floor(a / 4);

    return Math.floor(365.25 * (year + 4716)) +
      Math.floor(30.6001 * (month + 1)) +
      day + b - 1524.5;
  }

  // Update date display - DIPERBAIKI
  async function updateDateDisplay() {
    const dateItem = document.getElementById('date-display');
    if (!dateItem) return;

    const now = new Date();

    // Gregorian date
    const gregorianOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    const gregorianDate = now.toLocaleDateString('id-ID', gregorianOptions);

    // Ambil tanggal Hijriyah dari berbagai sumber
    const hijriData = await getHijriDate();

    // Simpan ke STATE
    STATE.hijriDate = hijriData.formatted;
    STATE.hijriDay = hijriData.day;
    STATE.hijriMonth = hijriData.month;
    STATE.hijriYear = hijriData.year;
    STATE.hijriSource = hijriData.source;
    STATE.lastHijriUpdate = new Date();

    // Tampilkan di element
    dateItem.innerHTML = `
        <div class="text-right">
            <p class="font-bold text-2xl">${gregorianDate}</p>
            <p class="text-xl text-gray-600" title="Sumber: ${hijriData.source}">
                ${hijriData.formatted}
                ${hijriData.source === 'cache' ? '📦' :
        hijriData.source === 'settings' ? '⚙️' :
          hijriData.source === 'api' ? '' : '📅'}
            </p>
        </div>
    `;

    console.log(`📅 Hijri date updated: ${hijriData.formatted} (${hijriData.source})`);
  }

  function julianToHijriUmmAlQura(jd) {
    jd = Math.floor(jd) + 0.5;

    // Z adalah jumlah hari sejak epoch Hijriyah (15 Juli 622 M)
    const Z = jd - 1948439.5;
    const cyc = Math.floor(Z / 10631);
    const Zrem = Z % 10631;
    const year = 30 * cyc + 1;

    let month = 0;
    let day = 0;

    if (Zrem === 10630) {
      month = 12;
      day = 30;
    } else {
      const cyc2 = Math.floor(Zrem / 354 + 0.5);
      const year2 = cyc2 + 1;
      const Zrem2 = Zrem - 354 * cyc2 - Math.floor((3 + 11 * year2) / 30);

      if (Zrem2 < 0) {
        month = Math.floor((Zrem2 + 30) / 29.5);
        day = Math.floor(Zrem2 + 30 - 29.5 * month);
      } else {
        month = Math.floor(Zrem2 / 29.5);
        day = Math.floor(Zrem2 - 29.5 * month);
      }

      month += 1;
      day += 1;
    }

    return {
      year: year,
      month: month,
      day: day
    };
  }

  // Simplified Hijri date calculation
  function calculateHijriDate(gregorianDate) {
    // Konversi Gregorian ke Julian Day
    const gYear = gregorianDate.getFullYear();
    const gMonth = gregorianDate.getMonth() + 1;
    const gDay = gregorianDate.getDate();

    // Rumus konversi Gregorian ke Julian Day
    let jd = (1461 * (gYear + 4800 + Math.floor((gMonth - 14) / 12))) / 4;
    jd += (367 * (gMonth - 2 - 12 * Math.floor((gMonth - 14) / 12))) / 12;
    jd -= (3 * Math.floor((gYear + 4900 + Math.floor((gMonth - 14) / 12)) / 100)) / 4;
    jd += gDay - 32075;
    jd = Math.floor(jd);

    // Konversi Julian Day ke Hijriyah
    const hijriYear = Math.floor((jd - 1948440) / 354.367);
    const remainder = jd - (1948440 + hijriYear * 354.367);
    const hijriMonth = Math.floor(remainder / 29.53) + 1;
    const hijriDay = Math.floor(remainder - (hijriMonth - 1) * 29.53) + 1;

    // Daftar nama bulan Hijriyah
    const hijriMonths = [
      'Muharram', 'Safar', 'Rabiul Awal', 'Rabiul Akhir',
      'Jumadil Awal', 'Jumadil Akhir', 'Rajab', 'Sya\'ban',
      'Ramadan', 'Syawal', 'Dzulqadah', 'Dzulhijjah'
    ];

    // Validasi
    const monthIndex = Math.min(Math.max(hijriMonth - 1, 0), 11);
    const day = Math.min(Math.max(hijriDay, 1), 30);
    const year = Math.max(hijriYear, 1445); // Minimal tahun

    const formatted = `${day} ${hijriMonths[monthIndex]} ${year} H`;

    return {
      formatted: formatted,
      day: day.toString(),
      month: hijriMonths[monthIndex],
      year: year.toString(),
      source: 'calculation'
    };
  }

  // Load finance data
  async function loadFinanceData() {
    try {
      console.log('💰 Loading finance data...');

      // 1. Ambil Summary tanpa parameter
      let summaryResult = { success: false, data: [] };

      try {
        const summaryResponse = await fetch('/api/finances/summary');
        if (summaryResponse.ok) {
          summaryResult = await summaryResponse.json();
        } else {
          console.log('Summary API tidak tersedia, menggunakan fallback');
        }
      } catch (summaryError) {
        console.log('Error fetching summary:', summaryError);
      }

      // 2. Ambil 5 Transaksi Terakhir
      let recentResult = { success: false, data: [] };
      try {
        const recentResponse = await fetch('/api/finances?limit=5');
        if (recentResponse.ok) {
          recentResult = await recentResponse.json();
        }
      } catch (recentError) {
        console.log('Error fetching recent transactions:', recentError);
      }

      // Hitung summary dari transaksi jika tidak ada dari API
      let summary;
      if (summaryResult.success && summaryResult.data && summaryResult.data.length > 0) {
        // Jika API mengembalikan array, ambil yang pertama atau akumulasi
        const summaries = summaryResult.data;
        summary = {
          total_income: summaries.reduce((sum, item) => sum + (parseFloat(item.total_income) || 0), 0),
          total_expense: summaries.reduce((sum, item) => sum + (parseFloat(item.total_expense) || 0), 0),
          balance: summaries.reduce((sum, item) => sum + (parseFloat(item.balance) || 0), 0)
        };
      } else {
        // Hitung manual dari transaksi
        const transactions = recentResult.data || [];
        const totalIncome = transactions
          .filter(t => t.type === 'masuk')
          .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        const totalExpense = transactions
          .filter(t => t.type === 'keluar')
          .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        summary = {
          total_income: totalIncome,
          total_expense: totalExpense,
          balance: totalIncome - totalExpense
        };
      }

      // Update tampilan
      updateFinanceDisplay(summary, recentResult.data || []);
      STATE.financeSummary = summary;

      console.log('✅ Finance data loaded:', summary);

    } catch (error) {
      console.error('❌ Error loading finance data:', error);
      updateFinanceDisplay({ total_income: 0, total_expense: 0, balance: 0 }, []);
    }
  }

  // Update finance display
  function updateFinanceDisplay(summary, transactions) {
    // A. Update Kartu Atas (Format Rupiah)
    const formatRupiah = (num) => {
      if (num === undefined || num === null) return 'Rp 0';
      return 'Rp ' + Number(num).toLocaleString('id-ID');
    };

    // Gunakan balance dari summary, fallback ke 0
    const balance = summary.balance || summary.current_balance || 0;
    const income = summary.total_income || 0;
    const expense = summary.total_expense || 0;

    setText('fin-saldo', formatRupiah(balance));
    setText('fin-masuk', formatRupiah(income));
    setText('fin-keluar', formatRupiah(expense));

    setText('finance-last-update', `Update: ${new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })}`);

    // B. Update Tabel Transaksi Terakhir (5 kiri, 5 kanan)
    updateTransactionTables(transactions);

    // C. Render Grafik Donut
    renderFinanceChart(income, expense);
  }

  function updateTransactionTables(transactions) {
    const leftTableBody = document.getElementById('recent-transactions-body');
    const rightTableBody = document.getElementById('recent-transactions-right');

    if (!leftTableBody || !rightTableBody) {
      console.log('❌ Table bodies tidak ditemukan');
      return;
    }

    // Bersihkan kedua tabel
    leftTableBody.innerHTML = '';
    rightTableBody.innerHTML = '';

    if (!transactions || transactions.length === 0) {
      // Tampilkan pesan kosong di kedua tabel
      const emptyMessage = '<tr><td colspan="3" class="text-center py-4 text-gray-400">Belum ada data transaksi</td></tr>';
      leftTableBody.innerHTML = emptyMessage;
      rightTableBody.innerHTML = emptyMessage;
      return;
    }

    // Format fungsi untuk membuat baris transaksi
    const createTransactionRow = (trx) => {
      const isMasuk = trx.type === 'masuk';
      const colorClass = isMasuk ? 'text-green-600' : 'text-red-600';
      const date = new Date(trx.transaction_date).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short'
      });

      return `
        <tr class="border-b border-gray-100 last:border-0">
            <td class="py-[0.8vw] text-gray-500 w-[20%]">${date}</td>
            <td class="py-[0.8vw] font-medium w-[50%] truncate pr-[1vw]" title="${trx.category || trx.description || '-'}">
                ${trx.category || trx.description || '-'}
            </td>
            <td class="py-[0.8vw] font-bold text-right ${colorClass} w-[30%]">
                ${formatRupiah(trx.amount)}
            </td>
        </tr>
        `;
    };

    // Urutkan transaksi berdasarkan tanggal (terbaru ke terlama)
    const sortedTransactions = [...transactions].sort((a, b) =>
      new Date(b.transaction_date) - new Date(a.transaction_date)
    );

    // Ambil 10 transaksi terbaru
    const latestTransactions = sortedTransactions.slice(0, 10);

    // Pisahkan menjadi 2 bagian: kiri (index 0-4) dan kanan (index 5-9)
    const leftTransactions = latestTransactions.slice(0, 5);
    const rightTransactions = latestTransactions.slice(5, 10);

    // Isi tabel kiri
    leftTransactions.forEach(trx => {
      leftTableBody.insertAdjacentHTML('beforeend', createTransactionRow(trx));
    });

    // Jika tabel kiri kurang dari 5, tambahkan baris kosong
    if (leftTransactions.length < 5) {
      const emptyRows = 5 - leftTransactions.length;
      for (let i = 0; i < emptyRows; i++) {
        leftTableBody.insertAdjacentHTML('beforeend', `
            <tr class="border-b border-gray-100 last:border-0">
                <td class="py-[0.8vw] text-gray-300 w-[20%]">-</td>
                <td class="py-[0.8vw] text-gray-300 w-[50%]">-</td>
                <td class="py-[0.8vw] text-gray-300 text-right w-[30%]">-</td>
            </tr>
            `);
      }
    }

    // Isi tabel kanan
    rightTransactions.forEach(trx => {
      rightTableBody.insertAdjacentHTML('beforeend', createTransactionRow(trx));
    });

    // Jika tabel kanan kurang dari 5, tambahkan baris kosong
    if (rightTransactions.length < 5) {
      const emptyRows = 5 - rightTransactions.length;
      for (let i = 0; i < emptyRows; i++) {
        rightTableBody.insertAdjacentHTML('beforeend', `
            <tr class="border-b border-gray-100 last:border-0">
                <td class="py-[0.8vw] text-gray-300 w-[20%]">-</td>
                <td class="py-[0.8vw] text-gray-300 w-[50%]">-</td>
                <td class="py-[0.8vw] text-gray-300 text-right w-[30%]">-</td>
            </tr>
            `);
      }
    }

    console.log(`✅ Transaction tables updated: ${leftTransactions.length} left, ${rightTransactions.length} right`);
  }

  // Tambahkan fungsi formatRupiah di dalam scope yang sama
  function formatRupiah(num) {
    if (num === undefined || num === null) return 'Rp 0';
    return 'Rp ' + Number(num).toLocaleString('id-ID');
  }

  // Helper untuk set text aman
  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function renderFinanceChart(income, expense) {
    const ctx = document.getElementById('financeChart');
    if (!ctx) {
      console.log('Chart canvas not found');
      return;
    }

    // Hancurkan chart lama jika ada
    if (financeChartInstance) {
      financeChartInstance.destroy();
    }

    // Jika data 0, tampilkan data dummy agar chart tidak kosong
    const hasData = income > 0 || expense > 0;
    const dataValues = hasData ? [income, expense] : [1, 1];
    const bgColors = hasData
      ? ['#15803d', '#b91c1c'] // Green-700 & Red-700
      : ['#e5e7eb', '#e5e7eb']; // Gray untuk data kosong

    try {
      financeChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Pemasukan', 'Pengeluaran'],
          datasets: [{
            data: dataValues,
            backgroundColor: bgColors,
            borderWidth: 0,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                font: {
                  size: Math.max(10, window.innerWidth * 0.012),
                  family: "'Jost', sans-serif"
                },
                padding: 20,
                usePointStyle: true
              }
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  if (!hasData) return 'Belum ada data';
                  let value = context.raw;
                  return 'Rp ' + value.toLocaleString('id-ID');
                }
              }
            }
          },
          cutout: '65%',
          animation: {
            animateScale: true,
            animateRotate: true
          }
        }
      });
      console.log('✅ Chart rendered');
    } catch (error) {
      console.error('❌ Error rendering chart:', error);
    }
  }

  // Format number dengan separator
  function formatNumber(num) {
    return Number(num).toLocaleString('id-ID');
  }

  // Load settings
  async function loadSettings() {
    try {
      const response = await fetch('/api/settings');
      if (!response.ok) throw new Error('Gagal mengambil pengaturan');

      const result = await response.json();
      if (result.success && result.data) {
        updateSettings(result.data);

        // Simpan finance display setting ke STATE
        const settingsObj = {};
        result.data.forEach(setting => {
          settingsObj[setting.setting_key] = setting.setting_value;
        });

        if (!STATE.settings) STATE.settings = {};
        STATE.settings.finance_display = settingsObj.finance_display || '1';

        console.log(`💰 Finance display setting from settings: ${STATE.settings.finance_display === '1' ? 'AKTIF' : 'NONAKTIF'}`);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  async function loadIqomahTimes() {
    try {
      const response = await fetch('/api/iqomah-times');
      if (!response.ok) throw new Error('Gagal load iqomah times');

      const result = await response.json();
      if (result.success && result.data) {
        STATE.iqomahTimes = result.data;
        console.log('✅ Iqomah times loaded:', STATE.iqomahTimes);
      }
    } catch (error) {
      console.error('❌ Error loading iqomah times:', error);
      // Default values
      STATE.iqomahTimes = [
        { prayer_name: 'Subuh', minutes: 10 },
        { prayer_name: 'Dzuhur', minutes: 10 },
        { prayer_name: 'Ashar', minutes: 10 },
        { prayer_name: 'Maghrib', minutes: 10 },
        { prayer_name: 'Isya', minutes: 10 }
      ];
    }
  }

  function checkAdzanRedirect() {
    if (!STATE.currentNextPrayer || !STATE.currentNextPrayer.name) return;

    const nextPrayer = STATE.currentNextPrayer;

    // Jangan redirect untuk Terbit
    if (nextPrayer.name === 'Terbit') return;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const currentSeconds = now.getSeconds();

    // Parse waktu shalat berikutnya
    const [hours, minutes] = nextPrayer.time.split(':').map(Number);
    const prayerMinutes = hours * 60 + minutes;

    // Hitung selisih menit
    let diffMinutes = prayerMinutes - currentMinutes;
    if (diffMinutes < 0) {
      diffMinutes += 24 * 60; // Shalat besok
    }

    // Ambil setting redirect minutes dari admin
    const redirectMinutes = STATE.settings.adzan_redirect_minutes;

    // Jika waktu shalat kurang dari redirectMinutes menit
    if (diffMinutes > 0 && diffMinutes <= redirectMinutes) {
      // Cari durasi iqomah untuk shalat ini
      const iqomahData = STATE.iqomahTimes.find(
        i => i.prayer_name.toLowerCase() === nextPrayer.name.toLowerCase()
      );
      const iqomahDuration = iqomahData ? iqomahData.minutes : 10;

      // Hitung timestamp adzan
      const adzanTime = new Date();
      adzanTime.setHours(hours, minutes, 0, 0);

      // Simpan ke localStorage untuk digunakan di halaman adzan/iqomah
      localStorage.setItem('adzan_prayer_name', nextPrayer.name);
      localStorage.setItem('adzan_timestamp', adzanTime.getTime().toString());
      localStorage.setItem('iqomah_duration', iqomahDuration.toString());
      localStorage.setItem('iqomah_redirect_minutes', redirectMinutes.toString());

      console.log(`🚀 Redirecting to adzan page for ${nextPrayer.name} in ${diffMinutes} minutes`);
      console.log(`📊 Iqomah duration: ${iqomahDuration} minutes`);
      window.location.href = './time-pray.html';
    }
  }

  function startAdzanChecking() {
    if (STATE.adzanCheckInterval) {
      clearInterval(STATE.adzanCheckInterval);
    }

    // Cek setiap detik
    STATE.adzanCheckInterval = setInterval(() => {
      checkAdzanRedirect();
    }, 1000);

    console.log('✅ Adzan checking started');
  }

  // Update settings
  function updateSettings(settings) {
    // Convert array to object
    const settingsObj = {};
    settings.forEach(setting => {
      settingsObj[setting.setting_key] = setting.setting_value;
    });

    // Update CONFIG dengan settings dari database
    if (settingsObj.latitude && settingsObj.longitude) {
      CONFIG.LOCATION.LATITUDE = parseFloat(settingsObj.latitude);
      CONFIG.LOCATION.LONGITUDE = parseFloat(settingsObj.longitude);
    }

    if (settingsObj.prayer_calculation_method) {
      CONFIG.CALCULATION.METHOD = parseInt(settingsObj.prayer_calculation_method);
    }

    if (settingsObj.display_rotation) {
      CONFIG.DISPLAY.ROTATION_INTERVALS.MAIN_CONTENT = parseInt(settingsObj.display_rotation) * 1000;
    }

    if (settingsObj.date_rotation) {
      CONFIG.DISPLAY.ROTATION_INTERVALS.DATE_EVENT = parseInt(settingsObj.date_rotation) * 1000;
    }

    // Update interval jika sedang berjalan
    if (STATE.contentRotationInterval && CONFIG.DISPLAY.ROTATION_INTERVALS.MAIN_CONTENT) {
      clearInterval(STATE.contentRotationInterval);
      if (STATE.contentItems.length > 1) {
        startContentRotation();
      }
    }

    if (STATE.dateEventRotationInterval && CONFIG.DISPLAY.ROTATION_INTERVALS.DATE_EVENT) {
      clearInterval(STATE.dateEventRotationInterval);
      const rotator = document.getElementById('date-event-rotator');
      if (rotator && rotator.children.length > 1) {
        startDateEventRotation();
      }
    }
  }

  // ================================================================
  // 5. FUNGSI CLOCK DAN AUTO-UPDATE
  // ================================================================

  // Update live clock
  function updateLiveClock() {
    const clockElement = document.getElementById('live-clock');
    if (!clockElement) return;

    const now = new Date();
    const timeString = now.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    clockElement.textContent = timeString;

    // Update countdown setiap detik
    if (STATE.currentPrayerTimes.length > 0) {
      calculateNextPrayer();
      updateNextPrayerDisplay();
      highlightCurrentPrayer();
    }
  }

  // Start clock interval
  function startClock() {
    // Update immediately
    updateLiveClock();

    // Update every second
    if (STATE.clockInterval) {
      clearInterval(STATE.clockInterval);
    }

    STATE.clockInterval = setInterval(updateLiveClock, 1000);
  }

  // Auto-refresh data
  function startAutoRefresh() {
    // Refresh running text setiap 30 detik
    setInterval(() => {
      loadRunningText();
    }, 30000);

    // Refresh data lain setiap 5 menit
    setInterval(() => {
      loadPrayerTimes();
      loadFinanceData();
    }, 300000);
  }

  async function initContentRotator() {
    // Clear existing rotation interval
    if (STATE.contentRotationInterval) {
      clearInterval(STATE.contentRotationInterval);
    }

    const rotator = document.getElementById('main-content-rotator');
    if (!rotator) {
      console.error('❌ main-content-rotator tidak ditemukan!');
      return;
    }

    // Clear existing content
    rotator.innerHTML = '';

    // Filter hanya konten yang aktif
    const activeContents = STATE.contentItems.filter(item => item.is_active);
    console.log('📋 Konten aktif:', activeContents.length, 'items');

    // Jika tidak ada konten, tampilkan default
    if (activeContents.length === 0) {
      console.log('⚠️ Tidak ada konten aktif, menampilkan default');
      const defaultItem = document.createElement('div');
      defaultItem.className = 'content-item active default-content';
      defaultItem.innerHTML = `
      <div class="w-full h-full flex items-center justify-center bg-gradient-to-r from-blue-50 to-indigo-50">
        <div class="text-center p-8">
          <h3 class="text-4xl font-bold text-gray-800 mb-4">Selamat Datang</h3>
          <p class="text-2xl text-gray-600">Masjid Al-Ikhlas</p>
        </div>
      </div>
    `;
      rotator.appendChild(defaultItem);
      return;
    }

    // Add content items
    activeContents.forEach((content, index) => {
      const item = document.createElement('div');
      item.className = `content-item ${index === 0 ? 'active' : ''}`;
      item.dataset.contentId = content.id;
      item.dataset.contentType = content.content_type;

      // Normalisasi tipe konten
      const rawType = content.content_type?.toLowerCase() || 'text';
      console.log(`🎨 Rendering konten #${content.id}: ${content.title} (type: ${rawType})`);

      if (rawType === 'image' && content.image_url) {
        item.innerHTML = `
        <div class="w-full h-full flex items-center justify-center bg-gray-900">
          <img src="${content.image_url}" alt="${escapeHTML(content.title)}"
               class="max-w-full max-h-full object-contain">
        </div>
      `;
      } else if (rawType === 'video' && content.video_url) {
        item.innerHTML = `
        <div class="w-full h-full flex items-center justify-center bg-gray-900">
          <video src="${content.video_url}" autoplay muted loop playsinline
                 class="max-w-full max-h-full object-contain">
            Browser Anda tidak mendukung tag video.
          </video>
        </div>
      `;
      } else if (rawType === 'announcement' || rawType === 'text') {
        item.innerHTML = renderAnnouncement(content);
      } else {
        item.innerHTML = `
        <div class="w-full h-full flex items-center justify-center p-8 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div class="text-center">
            <h3 class="text-4xl font-bold text-gray-800 mb-4">${escapeHTML(content.title || 'Judul')}</h3>
            ${content.content_text ? `<p class="text-2xl text-gray-600">${escapeHTML(content.content_text)}</p>` : ''}
          </div>
        </div>
      `;
      }

      rotator.appendChild(item);
    });

    // CEK SETTING FINANCE DISPLAY SEBELUM MENAMBAHKAN FINANCE CONTENT
    const showFinance = await shouldShowFinanceDisplay();
    console.log(`💰 Finance display setting: ${showFinance ? 'SHOW' : 'HIDE'}`);

    if (showFinance) {
      addFinanceContentItem(rotator);
    }

    console.log(`✅ Total items in rotator: ${rotator.children.length}`);

    // Start rotation jika ada lebih dari 1 konten
    if (rotator.children.length > 1) {
      startContentRotation();
    }
  }

  async function refreshContentDisplay() {
    console.log('🔄 Refreshing content display due to setting change...');
    // Reload content dari API
    await loadContent();
  }

  // ================================================================
  // 6. INITIALIZE SYSTEM
  // ================================================================

  async function initializeSystem() {
    console.log('🚀 Initializing Masjid Display System...');

    try {
      addEventMarqueeStyles();
      await loadSettings();
      await loadAdzanSettings();
      await loadIqomahTimes();
      await loadPrayerTimes();
      await loadMasjidInfo();
      await updateImsakDisplay();
      initFinanceDisplay();

      // Start clock
      startClock();
      setInterval(checkAdzanRedirect, 1000);
      startAdzanChecking();

      // Load semua data termasuk running text
      console.log('📥 Loading all data...');
      const loadPromises = [
        loadRunningText(),
        loadContent(),
        loadEvents(),
        loadFinanceData(),
        updateDateDisplay()
      ];

      await Promise.allSettled(loadPromises);

      // Initialize WebSocket untuk real-time updates
      initWebSocket();

      // Start auto-refresh untuk running text (setiap 30 detik)
      setInterval(() => {
        console.log('🔄 Auto-refresh running text...');
        loadRunningText();
      }, 30000);

      console.log('✅ System initialized successfully');

    } catch (error) {
      console.error('❌ Error initializing system:', error);
    }
  }

  async function initFinanceDisplay() {
    try {
      const response = await fetch('/api/settings/finance_display');
      const result = await response.json();

      if (result.success) {
        const isEnabled = result.data.finance_display; // bernilai true atau false
        console.log("📊 Status awal keuangan dari DB:", isEnabled ? "Tampil" : "Sembunyi");

        // Terapkan logika untuk menyembunyikan/menampilkan slide keuangan
        // --- SESUAIKAN DENGAN KODE ANDA ---
        // Contoh 1: Jika Anda menggunakan variabel global untuk rotasi
        window.showFinanceSlide = isEnabled;

        // Contoh 2: Jika Anda menyembunyikan elemen div secara langsung
        const financeContainer = document.getElementById('finance-container'); // Ganti dengan ID div keuangan Anda
        if (financeContainer) {
          financeContainer.style.display = isEnabled ? 'block' : 'none'; // atau 'flex'
        }
      }
    } catch (error) {
      console.error('❌ Gagal memuat status awal pengaturan keuangan:', error);
    }
  }

  window.refreshHijriDate = async function () {
    console.log('🔄 Manual refresh tanggal Hijriyah...');

    // Hapus cache
    localStorage.removeItem('hijri_date_cache');
    localStorage.removeItem('hijri_date_cache_timestamp');

    // Reset state
    STATE.hijriDate = null;
    STATE.hijriSource = null;

    // Update display
    await updateDateDisplay();

    showToast(`📅 Tanggal Hijriyah: ${STATE.hijriDate}`, 'info');
  };

  window.showHijriDateInfo = function () {
    console.log('📊 Hijri Date Info:', {
      formatted: STATE.hijriDate,
      day: STATE.hijriDay,
      month: STATE.hijriMonth,
      year: STATE.hijriYear,
      source: STATE.hijriSource,
      lastUpdate: STATE.lastHijriUpdate?.toLocaleString(),
      cached: localStorage.getItem('hijri_date_cache'),
      cacheAge: localStorage.getItem('hijri_date_cache_timestamp')
        ? `${Math.round((Date.now() - parseInt(localStorage.getItem('hijri_date_cache_timestamp'))) / 1000 / 60)} menit`
        : 'N/A'
    });

    alert(`📅 Tanggal Hijriyah: ${STATE.hijriDate}\nSumber: ${STATE.hijriSource}\nUpdate: ${STATE.lastHijriUpdate?.toLocaleString() || 'N/A'}`);
  };

  // Cleanup function
  function cleanup() {
    if (STATE.contentRotationInterval) {
      clearInterval(STATE.contentRotationInterval);
    }

    if (STATE.dateEventRotationInterval) {
      clearInterval(STATE.dateEventRotationInterval);
    }

    if (STATE.clockInterval) {
      clearInterval(STATE.clockInterval);
    }

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  }

  // Setup cleanup on page unload
  window.addEventListener('beforeunload', cleanup);

  // ================================================================
  // 7. MANUAL FUNCTIONS (untuk debugging)
  // ================================================================

  // Fungsi untuk manual refresh
  window.refreshAllData = function () {
    console.log('🔄 Manual refresh triggered');
    loadPrayerTimes();
    loadRunningText();
    loadContent();
    loadEvents();
    loadFinanceData();
  };

  // Fungsi untuk cek status
  window.showSystemStatus = function () {
    console.log('📊 System Status:', {
      websocket: STATE.isWebSocketConnected ? 'Connected' : 'Disconnected',
      prayers: STATE.currentPrayerTimes,
      nextPrayer: STATE.currentNextPrayer,
      events: STATE.events.length,
      content: STATE.contentItems.length,
      runningTexts: STATE.runningTexts.length,
      finance: STATE.financeSummary
    });
  };

  window.addEventListener('resize', handleResize);

  // const adzanScript = document.createElement('script');
  // adzanScript.src = '/adzan-check.js';
  // document.head.appendChild(adzanScript);

  // Start the system
  initializeSystem();
});














