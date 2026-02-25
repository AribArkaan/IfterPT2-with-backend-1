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

  function isHijriDatePlausible(hijriString) {
    try {
      const parsed = parseHijriDate(hijriString);
      if (!parsed) return false;

      const day = parseInt(parsed.day);
      const year = parseInt(parsed.year);

      if (day < 1 || day > 30) return false;
      if (year < 1440 || year > 1450) return false;

      // Cek dengan perhitungan lokal (toleransi ±3 hari)
      const calculated = calculateHijriDate(new Date());
      const calculatedDay = parseInt(calculated.day);

      if (Math.abs(day - calculatedDay) > 3) {
        console.warn('⚠️ DB date seems off:', hijriString, 'vs', calculated.formatted);
        return false;
      }

      return true;
    } catch (e) {
      return false;
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
        loadPrayerTimes();
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

          if (data.data.key === 'masjid_name' || data.data.key === 'masjid_address') {
            loadMasjidInfo();
          }
        }

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
        console.log('📅 Events diperbarui via WebSocket');
        refreshEventDisplay(); // Gunakan fungsi baru
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
    // Cek apakah sudah ada finance item
    const existingFinance = document.getElementById('finance-content-item');
    if (existingFinance) {
      existingFinance.remove();
    }

    const financeItem = document.createElement('div');
    financeItem.className = 'content-item';
    financeItem.id = 'finance-content-item';
    financeItem.innerHTML = `
        <div class="flex flex-col p-8 gap-6 h-full bg-gradient-to-br from-slate-50 to-slate-100 overflow-auto">
            <!-- Header -->
            <div class="flex justify-between items-end border-b border-slate-200 pb-4">
                <h2 class="font-kanit font-bold text-3xl text-slate-800 tracking-tight">Laporan Keuangan Masjid</h2>
                <p id="finance-last-update" class="font-jost text-sm text-slate-500 font-medium">Update: ...</p>
            </div>

            <!-- Saldo Card -->
            <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div class="flex items-center justify-center gap-4">
                    <span class="font-kanit text-4xl text-slate-400 uppercase tracking-widest font-semibold">Saldo Akhir</span>
                    <div class="h-8 w-px bg-slate-200"></div>
                    <span id="fin-saldo" class="font-jockey-one text-4xl text-slate-800 tracking-tight">Rp 0</span>
                </div>
            </div>

            <!-- Recent Transactions (2 Columns) -->
            <div class="grid grid-cols-2 gap-6 flex-grow min-h-[300px]">
                <!-- Left Column -->
                <div class="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
                    <div class="flex-grow p-4">
                        <table class="w-full text-sm font-jost">
                            <thead class="text-slate-400 border-b border-slate-100">
                                <tr>            
                                    <th class="text-left py-2 font-medium w-[25%]">Tanggal</th>
                                    <th class="text-left py-2 font-medium w-[50%]">Keterangan</th>
                                    <th class="text-right py-2 font-medium w-[25%]">Nominal</th>
                                </tr>
                            </thead>
                            <tbody id="recent-transactions-body" class="divide-y divide-slate-50"></tbody>
                        </table>
                    </div>
                </div>

                <!-- Right Column -->
                <div class="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
                    <div class="flex-grow p-4">
                        <table class="w-full text-sm font-jost">
                            <thead class="text-slate-400 border-b border-slate-100">
                                <tr>             
                                    <th class="text-left py-2 font-medium w-[25%]">Tanggal</th>
                                    <th class="text-left py-2 font-medium w-[50%]">Keterangan</th>
                                    <th class="text-right py-2 font-medium w-[25%]">Nominal</th>
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
    console.log('✅ Finance item added to rotator');
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
      console.log('📥 Loading events...');
      const response = await fetch('/api/events');
      if (!response.ok) throw new Error('Gagal mengambil events');

      const result = await response.json();
      if (result.success && result.data) {
        // Filter hanya event yang aktif dan urutkan berdasarkan tanggal terdekat
        STATE.events = result.data
          .filter(event => event.is_active)
          .sort((a, b) => new Date(a.target_date) - new Date(b.target_date));

        console.log(`✅ Events loaded: ${STATE.events.length} events`);
        initDateEventRotator();
      }
    } catch (error) {
      console.error('❌ Error loading events:', error);
      STATE.events = [];
    }
  }

  // Initialize date/event rotator
  function initDateEventRotator() {
    // Clear existing rotation interval
    if (STATE.dateEventRotationInterval) {
      clearInterval(STATE.dateEventRotationInterval);
    }

    const rotator = document.getElementById('date-event-rotator');
    if (!rotator) {
      console.error('❌ Rotator element not found');
      return;
    }

    // Clear existing items
    rotator.innerHTML = '';

    // ==========================================================
    // POLA SELANG-SELING: Tanggal → Event → Tanggal → Event
    // ==========================================================
    const rotationItems = [];

    if (STATE.events && STATE.events.length > 0) {
      STATE.events.forEach((event, index) => {
        // Tambah TANGGAL sebelum setiap event
        rotationItems.push({
          type: 'date',
          id: `date-slot-${index}`
        });

        // Tambah EVENT
        rotationItems.push({
          type: 'event',
          id: `event-${event.id}`,
          event: event
        });
      });
    } else {
      // Fallback jika tidak ada event
      rotationItems.push({
        type: 'date',
        id: 'date-only'
      });
    }

    // Render items ke DOM
    rotationItems.forEach((item, index) => {
      const div = document.createElement('div');
      div.id = item.id;
      div.className = `content-item ${index === 0 ? 'active' : ''}`;

      if (item.type === 'event') {
        div.dataset.eventId = item.event.id;
        div.classList.add('event-item');
      } else {
        div.classList.add('date-display-item');
      }

      rotator.appendChild(div);
    });

    // Update konten
    updateAllDateDisplays();
    STATE.events.forEach(event => updateEventDisplay(event));

    console.log(`✅ Rotator ready: ${rotationItems.map(i => i.type === 'date' ? '📅' : '📢').join('→')}`);

    if (rotationItems.length > 1) {
      startDateEventRotation();
    }
  }

  // Start date/event rotation
  function startDateEventRotation() {
    if (STATE.dateEventRotationInterval) {
      clearInterval(STATE.dateEventRotationInterval);
    }

    const rotator = document.getElementById('date-event-rotator');
    if (!rotator) return;

    const items = rotator.querySelectorAll('.content-item');
    if (items.length <= 1) return;

    STATE.dateEventRotationInterval = setInterval(() => {
      const current = rotator.querySelector('.content-item.active');
      if (!current) {
        items[0]?.classList.add('active');
        return;
      }

      current.classList.remove('active');
      let next = current.nextElementSibling || items[0];
      next.classList.add('active');

      // Refresh date jika tanggal (untuk update realtime)
      if (next.classList.contains('date-display-item')) {
        updateAllDateDisplays();
      }

      console.log(`🔄 Rotated to: ${next.classList.contains('event-item') ? 'Event' : 'Date'}`);
    }, CONFIG.DISPLAY.ROTATION_INTERVALS.DATE_EVENT);
  }

  function addEventMarqueeStyles() {
    if (document.getElementById('event-marquee-styles')) return;

    const style = document.createElement('style');
    style.id = 'event-marquee-styles';
    style.textContent = `
    /* Container dasar */
    .date-container, .event-container {
      width: 100%;
      height: 100%;
      padding: 0 1vw;
      display: flex;
      flex-direction: column;
      justify-content: center;
      box-sizing: border-box;
    }

    /* Styling tanggal */
    .gregorian-date {
      line-height: 1.2;
    }
    
    .hijri-date {
      line-height: 1.2;
      opacity: 0.8;
    }

    /* Styling judul event - WRAP KE BAWAH */
    .event-title-wrap {
      /* white-space: normal sudah di-set inline */
      /* text-align: right sudah di-set via class Tailwind */
      max-width: 100%;
    }

    /* Visibility control */
    .content-item { 
      display: none; 
      width: 100%; 
      height: 100%; 
    }
    .content-item.active { 
      display: block; 
    }

    /* Responsive */
    @media (max-width: 768px) {
      .event-title-wrap {
        font-size: 4vw !important;
      }
      .event-container span {
        font-size: 3vw !important;
      }
      .gregorian-date {
        font-size: 3.5vw !important;
      }
      .hijri-date {
        font-size: 2.8vw !important;
      }
    }
  `;
    document.head.appendChild(style);
    console.log('✅ Event styles added (no marquee)');
  }

  async function refreshEventDisplay() {
    console.log('🔄 Refreshing event displays...');

    // Reload events dari API
    await loadEvents();

    // Update semua event display
    STATE.events.forEach(event => {
      updateEventDisplay(event);
    });

    console.log('✅ Event displays refreshed');
  }

  const HIJRI_CONFIG = {
    CACHE_DURATION: 60 * 60 * 1000,  // 1 jam
    AUTO_REFRESH_TIMES: ['00:00', '06:00', '12:00', '18:00'],
    API_TIMEOUT: 8000,
    MAX_RETRY: 3
  };

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
  async function updateAllDateDisplays() {
    const dateElements = document.querySelectorAll('.date-display-item');
    if (dateElements.length === 0) return;

    const now = new Date();
    const gregorianDate = now.toLocaleDateString('id-ID', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    // Ambil Hijri date jika belum ada
    if (!STATE.hijriDate) {
      try {
        const hijriData = await getHijriDate();
        STATE.hijriDate = hijriData.formatted;
      } catch (e) {
        STATE.hijriDate = '...';
      }
    }

    dateElements.forEach(el => {
      el.innerHTML = `
      <div class="date-container">
        <div class="gregorian-date font-jost font-bold text-[2.2vw] text-right w-full leading-tight">
          ${gregorianDate}
        </div>
        <div class="hijri-date font-jost text-[1.8vw] text-gray-600 text-right w-full mt-1 leading-tight">
          ${STATE.hijriDate}
        </div>
      </div>
    `;
    });
  }

  function updateEventDisplay(event) {
    const el = document.getElementById(`event-${event.id}`);
    if (!el) return;

    const eventDate = new Date(event.target_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);

    const daysLeft = Math.ceil((eventDate - today) / (1000 * 3600 * 24));

    // Tentukan teks dan warna sisa hari
    let text, cls;
    if (daysLeft < 0) {
      text = 'Telah Berlalu';
      cls = 'text-gray-500';
    }
    else if (daysLeft === 0) {
      text = 'Hari Ini';
      cls = 'text-purple-600 font-bold';
    }
    else if (daysLeft <= 3) {
      text = `${daysLeft} Hari Lagi`;
      cls = 'text-red-600 font-bold';
    }
    else if (daysLeft <= 7) {
      text = `${daysLeft} Hari Lagi`;
      cls = 'text-orange-600';
    }
    else {
      text = `${daysLeft} Hari Lagi`;
      cls = 'text-green-600';
    }

    // ==========================================================
    // PERUBAHAN UTAMA: Judul wrap ke bawah dengan rata kanan
    // - white-space: normal (bukan nowrap)
    // - text-align: right
    // - word-break: break-word untuk menghindari overflow
    // ==========================================================
    el.innerHTML = `
    <div class="event-container">
      <!-- Judul: wrap ke bawah, rata kanan -->
      <div class="event-title-wrap font-jost font-bold text-[2.2vw] text-right w-full leading-tight"
           style="white-space: normal; word-break: break-word; line-height: 1.3;">
        ${escapeHTML(event.title)}
      </div>
      <!-- Sisa hari di bawah judul -->
      <div class="text-right mt-2">
        <span class="font-jost text-[1.8vw] ${cls}">${text}</span>
      </div>
    </div>
  `;

    console.log(`✅ Event #${event.id} rendered: "${event.title.substring(0, 30)}${event.title.length > 30 ? '...' : ''}"`);
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

 // Load finance data - DIPERBAIKI UNTUK AMBIL SEMUA DATA
async function loadFinanceData() {
    try {
        console.log('💰 Loading finance data...');

        // 1. AMBIL SEMUA TRANSAKSI (tanpa limit) untuk menghitung saldo total
        let allTransactions = [];
        try {
            const response = await fetch('/api/finances'); // TANPA PARAMETER LIMIT
            if (response.ok) {
                const result = await response.json();
                allTransactions = result.data || [];
                console.log(`✅ Berhasil mengambil ${allTransactions.length} transaksi (semua data)`);
            } else {
                console.log('⚠️ Gagal mengambil transaksi, status:', response.status);
            }
        } catch (error) {
            console.error('❌ Error fetching all transactions:', error);
        }

        // 2. HITUNG SALDO TOTAL dari SEMUA transaksi
        const totalIncome = allTransactions
            .filter(t => t.type === 'masuk')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        const totalExpense = allTransactions
            .filter(t => t.type === 'keluar')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        const totalBalance = totalIncome - totalExpense;

        console.log('💰 Total dari semua transaksi:', {
            income: totalIncome,
            expense: totalExpense,
            balance: totalBalance
        });

        // 3. AMBIL 10 TRANSAKSI TERBARU UNTUK DITAMPILKAN DI TABEL
        let recentTransactions = [];
        try {
            const recentResponse = await fetch('/api/finances?limit=10');
            if (recentResponse.ok) {
                const recentResult = await recentResponse.json();
                recentTransactions = recentResult.data || [];
                console.log(`✅ Berhasil mengambil ${recentTransactions.length} transaksi terbaru untuk tabel`);
            }
        } catch (error) {
            console.error('❌ Error fetching recent transactions:', error);
        }

        // 4. UPDATE TAMPILAN
        updateFinanceDisplay({
            total_income: totalIncome,
            total_expense: totalExpense,
            balance: totalBalance
        }, recentTransactions);

        STATE.financeSummary = {
            total_income: totalIncome,
            total_expense: totalExpense,
            balance: totalBalance
        };

    } catch (error) {
        console.error('❌ Error loading finance data:', error);
        updateFinanceDisplay({ total_income: 0, total_expense: 0, balance: 0 }, []);
    }
}

// Update finance display - DIPERBAIKI
function updateFinanceDisplay(summary, transactions) {
    // Format Rupiah
    const formatRupiah = (num) => {
        if (num === undefined || num === null) return 'Rp 0';
        return 'Rp ' + Number(num).toLocaleString('id-ID');
    };

    const balance = summary.balance || 0;
    const income = summary.total_income || 0;
    const expense = summary.total_expense || 0;

    console.log('📊 Update display dengan saldo:', balance);

    // Update saldo
    setText('fin-saldo', formatRupiah(balance));

    // Update last update dengan format hari, tanggal, tahun
    const now = new Date();
    const options = { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
    };
    setText('finance-last-update', `Update: ${now.toLocaleDateString('id-ID', options)}`);

    // Update tabel transaksi (hanya untuk tampilan, tidak mempengaruhi saldo)
    updateTransactionTables(transactions);

    // Render chart jika ada elemen chart
    renderFinanceChart(income, expense);
}

  // Update finance display
  function updateFinanceDisplay(summary, transactions) {
    // Format Rupiah
    const formatRupiah = (num) => {
      if (num === undefined || num === null) return 'Rp 0';
      return 'Rp ' + Number(num).toLocaleString('id-ID');
    };

    const balance = summary.balance || 0;
    const income = summary.total_income || 0;
    const expense = summary.total_expense || 0;

    // Update saldo
    setText('fin-saldo', formatRupiah(balance));

    // Update last update dengan format hari, tanggal, tahun
    const now = new Date();
    const options = {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    };
    setText('finance-last-update', `Update: ${now.toLocaleDateString('id-ID', options)}`);

    // Update tabel transaksi
    updateTransactionTables(transactions);

    // Render chart jika ada elemen chart
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

    // Jika tidak ada transaksi
    if (!transactions || transactions.length === 0) {
      const emptyMessage = '<tr><td colspan="3" class="text-center py-4 text-gray-400">Belum ada data transaksi</td></tr>';
      leftTableBody.innerHTML = emptyMessage;
      rightTableBody.innerHTML = emptyMessage;
      return;
    }

    // Format tanggal Indonesia
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short'
      });
    };

    // Buat baris transaksi
    const createRow = (trx, index) => {
      const isMasuk = trx.type === 'masuk';
      const colorClass = isMasuk ? 'text-green-600' : 'text-red-600';
      const amount = parseFloat(trx.amount) || 0;

      return `
            <tr class="border-b border-gray-100 last:border-0">
                <td class="py-[0.8vw] text-gray-500 w-[20%]">${formatDate(trx.transaction_date)}</td>
                <td class="py-[0.8vw] font-medium w-[50%] truncate pr-[1vw]" title="${trx.category || trx.description || '-'}">
                    ${trx.category || trx.description || '-'}
                </td>
                <td class="py-[0.8vw] font-bold text-right ${colorClass} w-[30%]">
                    Rp ${amount.toLocaleString('id-ID')}
                </td>
            </tr>
        `;
    };

    // Urutkan transaksi dari yang terbaru
    const sorted = [...transactions].sort((a, b) =>
      new Date(b.transaction_date) - new Date(a.transaction_date)
    );

    // Ambil 10 transaksi terbaru (atau semua jika kurang)
    const latest = sorted.slice(0, 10);

    // Pisahkan menjadi kiri (0-4) dan kanan (5-9)
    const leftItems = latest.slice(0, 5);
    const rightItems = latest.slice(5, 10);

    console.log(`📊 Transaksi: ${leftItems.length} kiri, ${rightItems.length} kanan`);

    // Isi tabel kiri
    if (leftItems.length > 0) {
      leftItems.forEach((trx, idx) => {
        leftTableBody.insertAdjacentHTML('beforeend', createRow(trx, idx));
      });
    } else {
      leftTableBody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-gray-400">Tidak ada transaksi</td></tr>';
    }

    // Isi tabel kanan
    if (rightItems.length > 0) {
      rightItems.forEach((trx, idx) => {
        rightTableBody.insertAdjacentHTML('beforeend', createRow(trx, idx + 5));
      });
    } else {
      // Jika tidak ada transaksi di kanan, tampilkan baris kosong agar tetap rapi
      let emptyRows = '';
      for (let i = 0; i < 5; i++) {
        emptyRows += `
                <tr class="border-b border-gray-100 last:border-0">
                    <td class="py-[0.8vw] text-gray-300 w-[20%]">-</td>
                    <td class="py-[0.8vw] text-gray-300 w-[50%]">-</td>
                    <td class="py-[0.8vw] text-gray-300 text-right w-[30%]">-</td>
                </tr>
            `;
      }
      rightTableBody.innerHTML = emptyRows;
    }

    console.log(`✅ Transaction tables updated: ${leftItems.length} kiri, ${rightItems.length} kanan`);
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
      localStorage.setItem('currentPrayer', nextPrayer.name.toLowerCase());

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
    } else {
      // Add content items
      activeContents.forEach((content, index) => {
        const item = document.createElement('div');
        item.className = `content-item ${index === 0 ? 'active' : ''}`;
        item.dataset.contentId = content.id;
        item.dataset.contentType = content.content_type;

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
    }

    // CEK SETTING FINANCE DISPLAY SEBELUM MENAMBAHKAN FINANCE CONTENT
    const showFinance = await shouldShowFinanceDisplay();
    console.log(`💰 Finance display setting: ${showFinance ? 'SHOW' : 'HIDE'}`);

    if (showFinance) {
      // Tambahkan finance item di posisi setelah konten terakhir
      addFinanceContentItem(rotator);

      // Load data keuangan
      setTimeout(() => {
        loadFinanceData();
      }, 500);
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

      // Start clock
      startClock();
      startAdzanChecking();
      startHijriDateAutoRefresh();

      // Load semua data
      console.log('📥 Loading all data...');
      const loadPromises = [
        loadRunningText(),
        loadContent(),  // Ini akan memuat konten dan finance item
        loadEvents(),
        updateDateDisplay()
      ];

      await Promise.allSettled(loadPromises);

      // Initialize WebSocket
      initWebSocket();

      // Auto-refresh running text
      setInterval(() => {
        console.log('🔄 Auto-refresh running text...');
        loadRunningText();
      }, 30000);

      // Auto-refresh finance data setiap 2 menit
      setInterval(() => {
        console.log('🔄 Auto-refresh finance data...');
        loadFinanceData();
      }, 120000);

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

  window.refreshHijriDate = async function (force = true) {
    console.log('🔄 Manual refresh Hijri...');

    if (force) {
      localStorage.removeItem('hijri_date_cache');
      localStorage.removeItem('hijri_date_cache_timestamp');
      localStorage.removeItem('hijri_date_cache_date');
    }

    STATE.hijriDate = null;
    STATE.hijriSource = null;

    const result = await getHijriDate();
    await updateAllDateDisplays();

    showToast(`📅 Hijriyah: ${result.formatted} (${result.source})`, 'success');
    return result;
  };

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

  // const adzanScript = document.createElement('script');
  // adzanScript.src = '/adzan-check.js';
  // document.head.appendChild(adzanScript);

  // Start the system
  initializeSystem();
});