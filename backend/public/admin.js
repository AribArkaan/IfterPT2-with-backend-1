let ws = null;
let currentTab = 'dashboard';
let editingEventId = null;
let editingTransactionId = null;
let eventsData = [];

// ==================== KONFIGURASI API ALADHAN ====================
const ALADHAN_API_CONFIG = {
    BASE_URL: 'https://api.aladhan.com/v1',
    DEFAULT_METHOD: 11, // Kemenag RI
    DEFAULT_LOCATION: {
        city: 'Bandung',
        country: 'Indonesia',
        latitude: -6.9419,
        longitude: 107.6824
    }
};

// Konfigurasi sistem
const CONFIG = {
    LOCATION: {
        LATITUDE: -6.9419,
        LONGITUDE: 107.6824
    },
    CALCULATION: {
        METHOD: 11, // Kemenag RI
        IHTIYAT: {
            Subuh: 3,
            Dzuhur: 3,
            Ashar: 2,
            Maghrib: 2,
            Isya: 3,
            Terbit: -7
        }
    },
    DISPLAY: {
        ROTATION_INTERVALS: {
            DATE_EVENT: 15000,
            MAIN_CONTENT: 20000
        },
        PRAYER_NAMES: {
            id: ['Subuh', 'Terbit', 'Dzuhur', 'Ashar', 'Maghrib', 'Isya']
        }
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

async function loadInitialToggleState() {
    try {
        const response = await fetch('/api/settings/finance_display');
        const result = await response.json();

        if (result.success) {
            const isEnabled = result.data.finance_display;
            const toggle = document.getElementById('finance-display-toggle');
            const label = document.getElementById('finance-toggle-label');

            if (toggle) toggle.checked = isEnabled;
            if (label) label.textContent = isEnabled ? 'Aktif' : 'Nonaktif';
        }
    } catch (error) {
        console.error('❌ Error memuat status toggle:', error);
    }
}

// Inisialisasi
document.addEventListener('DOMContentLoaded', function () {
    try {
        console.log('🚀 Initializing Masjid Admin System...');

        // Setup event listeners
        setupEventListeners();

        setupRunningTextListeners();

        // Set default dates
        setDefaultDates();

        // Load initial data
        loadAllData();

        // Load user info
        // loadUserInfo();

        loadRamadhanMode();

        // Connect WebSocket
        connectWebSocket();

        // Panggil fungsi pemuat status toggle di sini
        loadFinanceDisplaySetting();

        loadInitialToggleState();

        // Setup preview
        updatePreview();

        console.log('✅ System initialized successfully');

    } catch (error) {
        console.error('❌ Initialization error:', error);
        showToast('Error initializing system. Please refresh.', 'error');
    }

    const titleFontSlider = document.getElementById('title-font-size');
    const titleFontInput = document.getElementById('title-font-size-input');

    if (titleFontSlider && titleFontInput) {
        titleFontSlider.addEventListener('input', function () {
            titleFontInput.value = this.value;
            updateAnnouncementPreview();
        });

        titleFontInput.addEventListener('input', function () {
            titleFontSlider.value = this.value;
            updateAnnouncementPreview();
        });
    }

    const subuhInput = document.getElementById('edit-time-Subuh');
    if (subuhInput) {
        subuhInput.addEventListener('change', updateRamadhanPreview);
    }

    // Sync untuk ukuran font deskripsi
    const descFontSlider = document.getElementById('desc-font-size');
    const descFontInput = document.getElementById('desc-font-size-input');

    if (descFontSlider && descFontInput) {
        descFontSlider.addEventListener('input', function () {
            descFontInput.value = this.value;
            updateAnnouncementPreview();
        });

        descFontInput.addEventListener('input', function () {
            descFontSlider.value = this.value;
            updateAnnouncementPreview();
        });
    }

    const amountInput = document.getElementById('edit-transaction-amount');
    if (amountInput) {
        amountInput.addEventListener('keyup', function () {
            validateTransactionAmount(this);
        });
    }
});

function updateAnnouncementPreview() {
    const preview = document.getElementById('announcement-preview');
    if (!preview) return;

    const title = document.getElementById('content-title')?.value || 'Judul Pengumuman';
    const description = document.getElementById('content-description')?.value || '';
    const announcementText = document.getElementById('announcement-text')?.value || '';

    // Ambil pengaturan font
    const fontFamily = document.getElementById('announcement-font')?.value || 'Inter';
    const color = document.getElementById('announcement-color')?.value || '#000000';
    const bgColor = document.getElementById('announcement-bg-color')?.value || '#ffffff';
    const opacity = document.getElementById('announcement-bg-opacity')?.value || 100;

    // Ambil ukuran font judul dan deskripsi
    const titleFontSize = document.getElementById('title-font-size')?.value || 24;
    const descFontSize = document.getElementById('desc-font-size')?.value || 16;

    // Gaya font
    const bold = document.getElementById('announcement-bold')?.checked ? 'bold' : 'normal';
    const italic = document.getElementById('announcement-italic')?.checked ? 'italic' : 'normal';
    const underline = document.getElementById('announcement-underline')?.checked ? 'underline' : 'none';

    // Perataan teks
    const textAlign = document.querySelector('input[name="text-align"]:checked')?.value || 'left';

    // Posisi konten
    const position = document.querySelector('input[name="content-position"]:checked')?.value || 'center';

    // Konversi posisi ke flexbox alignment
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

    // Konversi opacity ke rgba
    const r = parseInt(bgColor.slice(1, 3), 16);
    const g = parseInt(bgColor.slice(3, 5), 16);
    const b = parseInt(bgColor.slice(5, 7), 16);
    const bgColorWithOpacity = `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;

    // Buat style untuk teks
    const textStyle = `font-family: '${fontFamily}', sans-serif; color: ${color};`;

    // Tampilkan preview
    preview.innerHTML = `
        <div style="display: flex; width: 100%; height: 100%; justify-content: ${justifyContent}; align-items: ${alignItems}; background: ${bgColorWithOpacity}; padding: 20px; box-sizing: border-box;">
            <div style="max-width: 90%; max-height: 90%; overflow: auto;">
                <div style="text-align: ${textAlign};">
                    <div style="${textStyle} font-size: ${titleFontSize}px; font-weight: ${bold}; font-style: ${italic}; text-decoration: ${underline}; margin-bottom: 10px;">
                        ${title}
                    </div>
                    ${description ? `
                        <div style="${textStyle} font-size: ${descFontSize}px; margin-top: 5px;">
                            ${description}
                        </div>
                    ` : ''}
                    ${announcementText ? `
                        <div style="${textStyle} font-size: 14px; margin-top: 15px; padding-top: 10px; border-top: 1px dashed #ccc;">
                            ${announcementText.replace(/\n/g, '<br>')}
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

function setDefaultDates() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const elements = {
        'event-date': tomorrowStr,
        'transaction-date': todayStr
    };

    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.value = value;
        }
    });

    const timeElement = document.getElementById('manual-gregorian-time');
    if (timeElement) {
        const hours = String(today.getHours()).padStart(2, '0');
        const minutes = String(today.getMinutes()).padStart(2, '0');
        timeElement.value = `${hours}:${minutes}`;
    }
}

// ==================== FUNGSI API ALADHAN YANG DIPERBAIKI ====================
async function fetchFromAPI() {
    const today = new Date().toISOString().split('T')[0];
    const lastUpdate = localStorage.getItem('last_api_update');

    // Batasi request: Jika sudah update hari ini, jangan panggil API lagi
    if (lastUpdate === today) {
        console.log('✅ Jadwal shalat sudah diperbarui hari ini. Melewati request API.');
        return;
    }

    try {
        console.log('🔄 Menarik data otomatis dari API Aladhan...');
        
        // Opsi API (Calendar/Timings) tetap menggunakan koordinat CONFIG [cite: 1, 54, 55]
        const calendarApiUrl = `https://api.aladhan.com/v1/calendar/${new Date().getFullYear()}/${new Date().getMonth() + 1}?latitude=${CONFIG.LOCATION.LATITUDE}&longitude=${CONFIG.LOCATION.LONGITUDE}&method=${CONFIG.CALCULATION.METHOD}`;
        
        const response = await fetch(calendarApiUrl);
        if (!response.ok) throw new Error('Gagal menghubungi API');
        
        const data = await response.json();
        const day = new Date().getDate();
        const apiData = data.data[day - 1];

        if (apiData) {
            const timings = apiData.timings;
            const formattedPrayers = formatAladhanTimings(timings); 
            
            if (apiData.date && apiData.date.hijri) {
                const hijri = apiData.date.hijri;
                localStorage.setItem('hijri_date_cache', `${hijri.day} ${hijri.month.en} ${hijri.year} H`);
            }

            // OTOMATIS: Simpan langsung ke database tanpa tunggu klik user
            await saveApiTimesToDatabase(formattedPrayers);
            
            // Tandai bahwa hari ini sudah berhasil update
            localStorage.setItem('last_api_update', today);
            showToast('✅ Jadwal otomatis diperbarui dari satelit', 'success');
        }
    } catch (error) {
        console.error('❌ Auto-fetch API gagal:', error);
        useFallbackData();
    }
}

function formatAladhanTimings(timings) {
    const prayers = [];

    // Subuh
    if (timings.Fajr) {
        const fajrTime = timings.Fajr.split(' ')[0]; // Ambil hanya waktu, hilangi (WIB/WITA/WIT)
        prayers.push({
            prayer_name: 'Subuh',
            time: fajrTime.substring(0, 5), // HH:MM
            ihtiyat: CONFIG.CALCULATION.IHTIYAT.Subuh || 3
        });
    }

    // Terbit
    if (timings.Sunrise) {
        const sunriseTime = timings.Sunrise.split(' ')[0];
        prayers.push({
            prayer_name: 'Terbit',
            time: sunriseTime.substring(0, 5),
            ihtiyat: CONFIG.CALCULATION.IHTIYAT.Terbit || -7
        });
    }

    // Dzuhur
    if (timings.Dhuhr) {
        const dhuhrTime = timings.Dhuhr.split(' ')[0];
        prayers.push({
            prayer_name: 'Dzuhur',
            time: dhuhrTime.substring(0, 5),
            ihtiyat: CONFIG.CALCULATION.IHTIYAT.Dzuhur || 3
        });
    }

    // Ashar
    if (timings.Asr) {
        const asrTime = timings.Asr.split(' ')[0];
        prayers.push({
            prayer_name: 'Ashar',
            time: asrTime.substring(0, 5),
            ihtiyat: CONFIG.CALCULATION.IHTIYAT.Ashar || 2
        });
    }

    // Maghrib
    if (timings.Maghrib) {
        const maghribTime = timings.Maghrib.split(' ')[0];
        prayers.push({
            prayer_name: 'Maghrib',
            time: maghribTime.substring(0, 5),
            ihtiyat: CONFIG.CALCULATION.IHTIYAT.Maghrib || 2
        });
    }

    // Isya
    if (timings.Isha) {
        const ishaTime = timings.Isha.split(' ')[0];
        prayers.push({
            prayer_name: 'Isya',
            time: ishaTime.substring(0, 5),
            ihtiyat: CONFIG.CALCULATION.IHTIYAT.Isya || 3
        });
    }

    return prayers;
}

// Load user info ke sidebar
// function loadUserInfo() {
//     const user = getCurrentUser();
//     const userInfoEl = document.getElementById('user-info');
//     const userNameEl = document.getElementById('user-name');
//     const userRoleEl = document.getElementById('user-role');

//     if (user && user.username) {
//         userNameEl.textContent = user.full_name || user.username;
//         userRoleEl.textContent = user.role || 'operator';
//         userInfoEl.classList.remove('hidden');
//     }
// }

function displayApiResult(prayers) {
    const resultDiv = document.getElementById('api-result');

    let html = `
            <div class="bg-green-50 border border-green-200 rounded-lg p-6">
                <div class="flex items-center mb-4">
                    <div class="bg-green-100 p-2 rounded-full mr-3">
                        <i class="fas fa-check-circle text-green-600"></i>
                    </div>
                    <div>
                        <h4 class="font-semibold text-green-800">✅ Data Berhasil Diambil</h4>
                        <p class="text-green-600 text-sm">Dari API Aladhan</p>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
    `;

    prayers.forEach(prayer => {
        // Hitung waktu dengan ihtiyat
        const [hours, minutes] = prayer.time.split(':').map(Number);
        const date = new Date();
        date.setHours(hours);
        date.setMinutes(minutes + (prayer.ihtiyat || 0));

        const adjustedTime = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

        html += `
                <div class="bg-white p-3 rounded border">
                    <div class="flex justify-between items-center">
                        <span class="font-medium text-gray-700">${prayer.prayer_name}</span>
                        <div class="text-right">
                            <div class="font-bold text-blue-600">${adjustedTime}</div>
                            <div class="text-xs text-gray-400">Original: ${prayer.time}</div>
                        </div>
                    </div>                    
                </div>
            `;
    });

    // Tambahkan tanggal Hijriyah jika ada
    const hijriDate = localStorage.getItem('hijri_date_cache');
    if (hijriDate) {
        html += `
                </div>
                
                <div class="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <div class="flex items-center">
                        <i class="fas fa-moon text-yellow-600 mr-2"></i>
                        <span class="font-medium text-yellow-800">Tanggal Hijriyah:</span>
                        <span class="ml-2 text-yellow-700">${hijriDate}</span>
                    </div>
                </div>
                
                <div class="flex space-x-3 mt-4">
        `;
    } else {
        html += `
                </div>
                
                <div class="flex space-x-3 mt-4">
        `;
    }

    html += `
                    <button onclick="saveApiTimesToForm()" class="btn-primary flex-1">
                        <i class="fas fa-edit mr-2"></i> Isi ke Form
                    </button>
                    <button onclick="saveApiTimesToDatabase()" class="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600">
                        <i class="fas fa-save mr-2"></i> Simpan ke Database
                    </button>
                </div>
                
                <p class="text-gray-500 text-xs mt-4">
                    <i class="fas fa-info-circle mr-1"></i>
                    Klik "Isi ke Form" untuk mengisi tabel, lalu "Update" masing-masing shalat
                </p>
            </div>
        `;

    resultDiv.innerHTML = html;

    // Simpan data ke variabel global untuk digunakan nanti
    window.lastApiPrayers = prayers.map(prayer => {
        const [hours, minutes] = prayer.time.split(':').map(Number);
        const date = new Date();
        date.setHours(hours);
        date.setMinutes(minutes + (prayer.ihtiyat || 0));

        return {
            prayer_name: prayer.prayer_name,
            time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
            ihtiyat: prayer.ihtiyat
        };
    });
}

function useFallbackData() {
    const resultDiv = document.getElementById('api-result');

    // Data fallback untuk Bandung dengan ihtiyat
    const fallbackPrayers = CONFIG.DISPLAY.PRAYER_NAMES.id.map(name => {
        const fallbackTime = CONFIG.FALLBACK_TIMINGS[name];
        const [hours, minutes] = fallbackTime.split(':').map(Number);
        const date = new Date();
        date.setHours(hours);
        date.setMinutes(minutes + (CONFIG.CALCULATION.IHTIYAT[name] || 0));

        return {
            prayer_name: name,
            time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
            ihtiyat: CONFIG.CALCULATION.IHTIYAT[name] || 0
        };
    });

    resultDiv.innerHTML = `
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <div class="flex items-center mb-4">
                    <div class="bg-yellow-100 p-2 rounded-full mr-3">
                        <i class="fas fa-exclamation-triangle text-yellow-600"></i>
                    </div>
                    <div>
                        <h4 class="font-semibold text-yellow-800">⚠️ Menggunakan Data Fallback</h4>
                        <p class="text-yellow-600 text-sm">API tidak dapat diakses, menggunakan data default Bandung</p>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                    ${fallbackPrayers.map(prayer => `
                        <div class="bg-white p-3 rounded border">
                            <div class="flex justify-between items-center">
                                <span class="font-medium text-gray-700">${prayer.prayer_name}</span>
                                <div class="text-right">
                                    <div class="font-bold text-blue-600">${prayer.time}</div>
                                    <div class="text-xs text-gray-400">Default: ${CONFIG.FALLBACK_TIMINGS[prayer.prayer_name]}</div>
                                </div>
                            </div>                            
                        </div>
                    `).join('')}
                </div>
                
                <div class="flex space-x-3">
                    <button onclick="applyFallbackData()" class="btn-primary flex-1">
                        <i class="fas fa-check mr-2"></i> Gunakan Data Ini
                    </button>
                    <button onclick="showManualInput()" class="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300">
                        <i class="fas fa-edit mr-2"></i> Input Manual
                    </button>
                </div>
                
                <p class="text-gray-500 text-xs mt-4">
                    <i class="fas fa-info-circle mr-1"></i>
                    Data ini berdasarkan jadwal Bandung. Edit jika perlu.
                </p>
            </div>
        `;

    // Simpan data fallback ke variabel global
    window.lastApiPrayers = fallbackPrayers;
}

async function saveApiTimesToForm() {
    if (!window.lastApiPrayers) {
        showToast('❌ Tidak ada data API yang tersedia', 'error');
        return;
    }

    // Isi form dengan data dari API
    window.lastApiPrayers.forEach(prayer => {
        const timeInput = document.getElementById(`edit-time-${prayer.prayer_name}`);
        const ihtiyatInput = document.getElementById(`edit-ihtiyat-${prayer.prayer_name}`);

        if (timeInput) {
            timeInput.value = prayer.time;
            // Efek visual
            timeInput.classList.add('border-green-300', 'bg-green-50');
            setTimeout(() => {
                timeInput.classList.remove('border-green-300', 'bg-green-50');
            }, 2000);
        }

        if (ihtiyatInput) {
            ihtiyatInput.value = prayer.ihtiyat;
        }
    });

    showToast('📋 Data API telah diterapkan ke form', 'success');
}

async function saveApiTimesToDatabase() {
    if (!window.lastApiPrayers) {
        showToast('❌ Tidak ada data API yang tersedia', 'error');
        return;
    }

    try {
        showToast('💾 Menyimpan ke sistem...', 'info');

        // Simpan ke database via API
        const response = await fetch('/api/prayer-times/bulk', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prayers: window.lastApiPrayers
            })
        });

        const result = await response.json();

        if (response.ok) {
            showToast('✅ Jadwal shalat berhasil disimpan ke database', 'success');
            loadPrayerTimes(); // Refresh tampilan
            loadAllData(); // Update dashboard juga

            // Update hijri date jika ada
            const hijriDate = localStorage.getItem('hijri_date_cache');
            if (hijriDate) {
                await updateHijriDate(hijriDate);
            }
        } else {
            showToast('❌ Gagal menyimpan data: ' + (result.error || 'Unknown error'), 'error');
        }

    } catch (error) {
        console.error('Error saving to database:', error);
        showToast('❌ Gagal menyimpan data', 'error');
    }
}

async function saveApiTimesToDatabase(prayersData) {
    const dataToSave = prayersData || window.lastApiPrayers; 
    
    if (!dataToSave) return;

    try {
        const response = await fetch('/api/prayer-times/bulk', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prayers: dataToSave })
        });

        if (response.ok) {
            loadPrayerTimes(); // Refresh tabel setelah simpan 
            
            const hijriDate = localStorage.getItem('hijri_date_cache');
            if (hijriDate) await updateHijriDate(hijriDate); 
        }
    } catch (error) {
        console.error('Error saving to DB:', error);
    }
}

// Fungsi untuk update tanggal Hijriyah ke database
async function updateHijriDate(hijriDate) {
    try {
        const response = await fetch('/api/settings/hijri_date', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: hijriDate })
        });

        if (response.ok) {
            console.log('✅ Tanggal Hijriyah disimpan ke database');
        }
    } catch (error) {
        console.error('Error saving Hijri date:', error);
    }
}

function applyFallbackData() {
    const fallbackPrayers = CONFIG.DISPLAY.PRAYER_NAMES.id.map(name => {
        const fallbackTime = CONFIG.FALLBACK_TIMINGS[name];
        const [hours, minutes] = fallbackTime.split(':').map(Number);
        const date = new Date();
        date.setHours(hours);
        date.setMinutes(minutes + (CONFIG.CALCULATION.IHTIYAT[name] || 0));

        return {
            prayer_name: name,
            time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
            ihtiyat: CONFIG.CALCULATION.IHTIYAT[name] || 0
        };
    });

    // Simpan ke variabel global
    window.lastApiPrayers = fallbackPrayers;

    // Isi ke form
    saveApiTimesToForm();
    showToast('📋 Data fallback diterapkan ke form', 'success');
}

// ==================== FUNGSI SHALAT BERIKUTNYA YANG DIPERBAIKI ====================
function calculateNextPrayer(prayers) {
    if (!Array.isArray(prayers) || prayers.length === 0) {
        return null;
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let nextPrayer = null;
    let smallestDiff = Infinity;

    // Urutan shalat: Subuh, Terbit, Dzuhur, Ashar, Maghrib, Isya
    const prayerOrder = ['Subuh', 'Terbit', 'Dzuhur', 'Ashar', 'Maghrib', 'Isya'];

    // Filter hanya shalat yang ada waktu-nya
    const validPrayers = prayers.filter(p => p.time && p.time.trim() !== '');

    if (validPrayers.length === 0) {
        return null;
    }

    // Cari shalat berikutnya
    validPrayers.forEach(prayer => {
        const [hours, minutes] = prayer.time.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) return;

        const prayerMinutes = hours * 60 + minutes;
        let diff = prayerMinutes - currentMinutes;

        // Jika waktu shalat sudah lewat hari ini, tambah 24 jam
        if (diff < 0) {
            diff += 24 * 60;
        }

        // Jika shalat Terbit (Sunrise) dan sudah lewat, skip
        if (prayer.prayer_name === 'Terbit' && diff >= 24 * 60) {
            return;
        }

        // Cari shalat dengan selisih waktu terkecil
        if (diff > 0 && diff < smallestDiff) {
            smallestDiff = diff;
            nextPrayer = {
                name: prayer.prayer_name,
                time: prayer.time,
                diffMinutes: diff,
                diffHours: Math.floor(diff / 60),
                diffRemainingMinutes: diff % 60
            };
        }
    });

    // Jika tidak ada shalat berikutnya (sudah lewat Isya), 
    // ambil Subuh besok
    if (!nextPrayer) {
        const subuh = validPrayers.find(p => p.prayer_name === 'Subuh');
        if (subuh) {
            const [hours, minutes] = subuh.time.split(':').map(Number);
            const prayerMinutes = hours * 60 + minutes;
            const diff = (24 * 60 - currentMinutes) + prayerMinutes;

            nextPrayer = {
                name: 'Subuh',
                time: subuh.time,
                diffMinutes: diff,
                diffHours: Math.floor(diff / 60),
                diffRemainingMinutes: diff % 60,
                isTomorrow: true
            };
        }
    }

    return nextPrayer;
}

function updateNextPrayerDisplay(prayers) {
    const nextPrayer = calculateNextPrayer(prayers);
    const nextPrayerInfo = document.getElementById('next-prayer-info');
    const nextPrayerTime = document.getElementById('next-prayer-time');

    if (!nextPrayerInfo || !nextPrayerTime) return;

    if (nextPrayer) {
        nextPrayerInfo.textContent = nextPrayer.name;

        // Format waktu countdown
        let timeText = '';
        if (nextPrayer.diffHours > 0) {
            timeText = `${nextPrayer.diffHours} jam ${nextPrayer.diffRemainingMinutes} menit lagi`;
        } else {
            timeText = `${nextPrayer.diffMinutes} menit lagi`;
        }

        if (nextPrayer.isTomorrow) {
            timeText += ' (besok)';
        }

        nextPrayerTime.textContent = `${nextPrayer.time} - ${timeText}`;

    } else {
        nextPrayerInfo.textContent = 'Tidak ada data';
        nextPrayerTime.textContent = 'Jadwal shalat tidak tersedia';
    }
}

// ==================== PERBAIKI FUNGSI loadPrayerTimes ====================
async function loadPrayerTimes() {
    try {
        const response = await fetch('/api/prayer-times');
        if (!response.ok) {
            throw new Error('Failed to fetch prayer times');
        }

        const result = await response.json();
        const prayers = result.data || [];

        // CEK OTOMATISASI: Jika database kosong, tarik dari API
        if (prayers.length === 0) {
            console.log('⚠️ Database kosong, memulai penarikan data API...');
            await fetchFromAPI();
            return;
        }

        const table = document.getElementById('prayer-table');
        if (!table) return;

        table.innerHTML = '';

        if (!Array.isArray(prayers) || prayers.length === 0) {
            table.innerHTML = `
                <tr>
                    <td colspan="4" class="p-4 text-center text-gray-500">
                        Belum ada jadwal shalat. 
                        <button onclick="fetchFromAPI()" class="text-blue-600 hover:text-blue-800 ml-1">
                            Ambil dari API Aladhan
                        </button>
                        atau
                        <button onclick="showManualInput()" class="text-blue-600 hover:text-blue-800 ml-1">
                            Input Manual
                        </button>
                    </td>
                </tr>
            `;
            return;
        }

        // Pastikan urutan shalat yang benar
        const prayerOrder = ['Subuh', 'Terbit', 'Dzuhur', 'Ashar', 'Maghrib', 'Isya'];

        prayerOrder.forEach(prayerName => {
            const prayer = prayers.find(p => p.prayer_name === prayerName) || {
                prayer_name: prayerName,
                time: '',
                ihtiyat: prayerName === 'Terbit' ? -7 : 3
            };

            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-gray-50';
            row.innerHTML = `
                <td class="p-3 font-semibold">${prayer.prayer_name}</td>
                <td class="p-3">
                    <input type="time" id="edit-time-${prayer.prayer_name}" 
                           class="p-2 border rounded w-full" value="${prayer.time || ''}"
                           onchange="validatePrayerTime('${prayer.prayer_name}')">
                </td>                
                <td class="p-3">
                    <button onclick="updatePrayerTime('${prayer.prayer_name}')" 
                            class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition">
                        <i class="fas fa-save mr-1"></i> Update
                    </button>
                </td>
            `;
            table.appendChild(row);
        });

        // Update display shalat berikutnya di dashboard
        updateNextPrayerDisplay(prayers);

    } catch (error) {
        console.error('Error loading prayer times:', error);

        const table = document.getElementById('prayer-table');
        if (table) {
            table.innerHTML = `
                <tr>
                    <td colspan="4" class="p-4 text-center text-red-500">
                        Gagal memuat jadwal shalat. 
                        <button onclick="fetchFromAPI()" class="text-blue-600 hover:text-blue-800 ml-1">
                            Coba ambil dari API
                        </button>
                    </td>
                </tr>
            `;
        }
    }
}

// ==================== TAMBAH STYLE UNTUK ANIMASI ====================
const style = document.createElement('style');
style.textContent = `
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        .animate-spin {
            animation: spin 1s linear infinite;
        }
    `;
document.head.appendChild(style);

// WebSocket Connection
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    try {
        ws = new WebSocket(wsUrl);

        ws.onopen = function () {
            console.log('WebSocket connected');
            updateConnectionStatus(true);
        };

        ws.onmessage = function (event) {
            const data = JSON.parse(event.data);
            console.log('WebSocket update:', data);
            handleRealTimeUpdate(data);
        };

        ws.onclose = function () {
            console.log('WebSocket disconnected');
            updateConnectionStatus(false);
            setTimeout(connectWebSocket, 3000);
        };

        ws.onerror = function (error) {
            console.error('WebSocket error:', error);
        };
    } catch (error) {
        console.error('Failed to connect WebSocket:', error);
    }
}

function updateConnectionStatus(connected) {
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
        if (connected) {
            statusEl.textContent = '● Terhubung';
            statusEl.className = 'text-green-400';
        } else {
            statusEl.textContent = '● Terputus';
            statusEl.className = 'text-red-400';
        }
    }
}

async function loadFokusSettings() {
    try {
        const response = await fetch('/api/settings');
        const result = await response.json();
        const settings = result.data || [];

        // Convert ke object agar mudah dibaca
        const settingsObj = {};
        settings.forEach(s => settingsObj[s.setting_key] = s.setting_value);

        // Loop ke form input
        const prayers = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya', 'jumat', 'tarawih'];
        prayers.forEach(prayer => {
            const input = document.getElementById(`fokus-${prayer}`);
            if (input && settingsObj[`fokus_duration_${prayer}`]) {
                input.value = settingsObj[`fokus_duration_${prayer}`];
            }
        });
    } catch (error) {
        console.error('Error loading fokus settings:', error);
        showToast('Gagal memuat pengaturan fokus', 'error');
    }
}

async function saveFokusSettings() {
    const prayers = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya', 'jumat'];
    const settings = [];

    prayers.forEach(prayer => {
        const input = document.getElementById(`fokus-${prayer}`);
        if (input) {
            settings.push({
                key: `fokus_duration_${prayer}`,
                value: input.value
            });
        }
    });

    try {
        showToast(' ⏳ Menyimpan pengaturan fokus...', 'info');
        const response = await fetch('/api/settings/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings }),
        });

        if (response.ok) {
            showToast(' ✅ Pengaturan Fokus Mode berhasil disimpan', 'success');
        } else {
            showToast('Gagal menyimpan pengaturan fokus', 'error');
        }
    } catch (error) {
        console.error('Error saving fokus settings:', error);
        showToast('Koneksi error. Coba lagi.', 'error');
    }
}

// Tab Navigation
function showTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('bg-blue-700');
    });

    if (event && event.currentTarget) {
        event.currentTarget.classList.add('bg-blue-700');
    }

    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    const tabElement = document.getElementById(tabName);
    if (tabElement) {
        tabElement.classList.add('active');
    }

    const titles = {
        'dashboard': 'Dashboard Admin',
        'prayer-times': 'Jadwal Shalat',
        'iqomah': 'Pengaturan Iqomah',
        'fokus-mode': 'Pengaturan Fokus Mode',
        'running-text': 'Running Text',
        'content': 'Manajemen Konten',
        'events': 'Event Keagamaan',
        'finance': 'Manajemen Keuangan',
        'settings': 'Pengaturan Sistem'
    };

    const titleElement = document.getElementById('page-title');
    if (titleElement) {
        titleElement.textContent = titles[tabName] || 'Admin Panel';
    }

    currentTab = tabName;

    switch (tabName) {
        case 'prayer-times':
            loadPrayerTimes();
            break;
        case 'iqomah':
            loadIqomahSettings();
            break;
        case 'fokus-mode':
            loadFokusSettings();
            break;
        case 'running-text':
            loadRunningText();
            break;
        case 'content':
            loadContent();
            break;
        case 'events':
            loadEvents();
            break;
        case 'finance':
            loadFinanceData();
            break;
        case 'settings':
            loadSettings();
            break;
    }
}

// Load Ramadhan mode
async function loadRamadhanMode() {
    try {
        const response = await fetch('/api/ramadhan-mode');
        const data = await response.json();

        const toggle = document.getElementById('ramadhan-mode-toggle');
        const label = document.getElementById('ramadhan-toggle-label');

        if (toggle) {
            toggle.checked = data.isRamadhan;
            if (label) {
                label.textContent = data.isRamadhan ? 'Aktif' : 'Nonaktif';
            }
        }

        // Update preview
        updateRamadhanPreview();

    } catch (error) {
        console.error('Error loading ramadhan mode:', error);
    }
}

// Toggle Ramadhan mode
async function toggleRamadhanMode() {
    const toggle = document.getElementById('ramadhan-mode-toggle');
    const label = document.getElementById('ramadhan-toggle-label');

    if (!toggle) return;

    const isEnabled = toggle.checked;
    const oldState = !isEnabled;
    const oldLabel = label ? (oldState ? 'Aktif' : 'Nonaktif') : '';

    try {
        const response = await fetch('/api/ramadhan-mode', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: isEnabled })
        });

        if (response.ok) {
            showToast(`🌙 Mode Ramadhan ${isEnabled ? 'diaktifkan' : 'dinonaktifkan'}`, 'success');
            if (label) {
                label.textContent = isEnabled ? 'Aktif' : 'Nonaktif';
            }
            updateRamadhanPreview();

            // Broadcast via WebSocket
            if (window.ws && window.ws.readyState === WebSocket.OPEN) {
                window.ws.send(JSON.stringify({
                    type: 'ramadhan_mode_updated',
                    enabled: isEnabled
                }));
            }
        } else {
            showToast('Gagal mengubah mode Ramadhan', 'error');
            toggle.checked = oldState;
            if (label) label.textContent = oldLabel;
        }
    } catch (error) {
        console.error('Error toggling ramadhan mode:', error);
        showToast('Koneksi error', 'error');
        toggle.checked = oldState;
        if (label) label.textContent = oldLabel;
    }
}

// Update preview imsak berdasarkan waktu Subuh
async function updateRamadhanPreview() {
    try {
        // Ambil waktu Subuh dari tabel
        const response = await fetch('/api/prayer-times');
        const result = await response.json();

        const prayers = result.data || [];
        const subuh = prayers.find(p => p.prayer_name === 'Subuh');

        const previewSubuh = document.getElementById('preview-subuh-ramadhan');
        const previewImsak = document.getElementById('preview-imsak-ramadhan');

        if (subuh && subuh.time) {
            if (previewSubuh) previewSubuh.textContent = subuh.time;

            // Hitung imsak = subuh - 10 menit
            const [hours, minutes] = subuh.time.split(':').map(Number);
            const date = new Date();
            date.setHours(hours, minutes - 10, 0, 0);

            const imsakHour = String(date.getHours()).padStart(2, '0');
            const imsakMinute = String(date.getMinutes()).padStart(2, '0');
            const imsakTime = `${imsakHour}:${imsakMinute}`;

            if (previewImsak) previewImsak.textContent = imsakTime;
        }
    } catch (error) {
        console.error('Error updating ramadhan preview:', error);
    }
}

// Load all initial data
async function loadAllData() {
    try {
        console.log('📥 Loading all data...');

        // Load prayer times
        const prayersResponse = await fetch('/api/prayer-times');
        const prayers = prayersResponse.ok ? (await prayersResponse.json()).data : [];

        // Load events dan finance
        let events = [];
        let financeSummary = {};

        try {
            const [eventsResponse, financeResponse] = await Promise.all([
                fetch('/api/events'),
                fetch('/api/finances/summary') // Hapus parameter start_date
            ]);

            if (eventsResponse.ok) {
                const eventsData = await eventsResponse.json();
                events = eventsData.data || [];
            }

            if (financeResponse.ok) {
                const financeData = await financeResponse.json();
                // Data bisa berupa array atau object, tangani dengan aman
                if (financeData.data) {
                    if (Array.isArray(financeData.data)) {
                        financeSummary = financeData.data.length > 0 ? financeData.data[0] : {};
                    } else {
                        financeSummary = financeData.data;
                    }
                }
            } else {
                console.log('⚠️ Finance API returned:', financeResponse.status);
            }
        } catch (apiError) {
            console.log('Some APIs not available, using defaults', apiError.message);
        }

        updateDashboard(prayers, events, financeSummary);
        showToast('Data berhasil dimuat', 'success');

    } catch (error) {
        console.error('Error loading data:', error);
        showToast('Gagal memuat beberapa data', 'warning');
    }

    try {
        console.log("🔄 Menarik status finance_display dari database...");
        const responseSettings = await fetch('/api/settings/finance_display');
        const resultSettings = await responseSettings.json();

        if (resultSettings.success) {
            // Nilai ini akan true atau false sesuai database
            const isEnabled = resultSettings.data.finance_display;
            console.log("✅ Status finance_display di DB:", isEnabled ? "Aktif" : "Nonaktif");

            const toggle = document.getElementById('finance-display-toggle');
            const label = document.getElementById('finance-toggle-label');

            if (toggle) {
                toggle.checked = isEnabled; // Mencentang atau menghapus centang sesuai DB
            } else {
                console.error("❌ Elemen toggle dengan ID 'finance-display-toggle' tidak ditemukan di HTML.");
            }

            if (label) {
                label.textContent = isEnabled ? 'Aktif' : 'Nonaktif';
            }
        }
    } catch (error) {
        console.error('❌ Gagal memuat status awal toggle keuangan:', error);
    }
}

// ==================== FUNGSI UPDATE DASHBOARD FINANCE ====================
// Update finance display di dashboard
async function updateDashboardFinance() {
    try {
        // Ambil data finance summary dari API
        // JANGAN gunakan parameter start_date jika ingin semua data
        const response = await fetch('/api/finances/summary');

        let totalIncome = 0;
        let totalExpense = 0;
        let currentBalance = 0;

        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
                const summaries = result.data;
                // Hitung total dari semua summary
                totalIncome = summaries.reduce((sum, item) => sum + (parseFloat(item.total_income) || 0), 0);
                totalExpense = summaries.reduce((sum, item) => sum + (parseFloat(item.total_expense) || 0), 0);
                currentBalance = summaries.reduce((sum, item) => sum + (parseFloat(item.balance) || 0), 0);
            }
        } else {
            // Fallback: hitung langsung dari transactions
            const txResponse = await fetch('/api/finances');
            if (txResponse.ok) {
                const txResult = await txResponse.json();
                const transactions = txResult.data || [];

                totalIncome = transactions
                    .filter(t => t.type === 'masuk')
                    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

                totalExpense = transactions
                    .filter(t => t.type === 'keluar')
                    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

                currentBalance = totalIncome - totalExpense;
            }
        }

        // Update dashboard cards
        updateFinanceDisplayCards(currentBalance, totalIncome, totalExpense);

    } catch (error) {
        console.error('❌ Error updating dashboard finance:', error);
    }
}

// Tambahkan tombol di bagian toolbar finance (di admin.html)
// <button onclick="syncToGoogleSheet()" class="bg-blue-600 text-white px-4 py-2 rounded-lg ml-2">
//     <i class="fab fa-google mr-2"></i> Sync ke Google Sheet
// </button>

// Fungsi sync ke Google Sheet
async function syncToGoogleSheet() {
    if (!confirm('Yakin ingin menyinkronkan data keuangan ke Google Sheet?')) {
        return;
    }
    
    showToast('📤 Menyinkronkan data...', 'info');
    
    try {
        const response = await fetch('/api/sync-to-google-sheet', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast(`✅ ${result.message}`, 'success');
            // Buka Google Sheet di tab baru
            if (confirm('Buka Google Sheet sekarang?')) {
                window.open(`https://docs.google.com/spreadsheets/d/${result.sheetId}`, '_blank');
            }
        } else {
            showToast('❌ Gagal sync: ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Sync error:', error);
        showToast('❌ Gagal sync ke Google Sheet', 'error');
    }
}

// Cek status koneksi Google Sheet saat load
async function checkGoogleSheetStatus() {
    try {
        const response = await fetch('/api/google-sheet-status');
        const result = await response.json();
        
        const statusBadge = document.getElementById('gsheet-status');
        if (statusBadge) {
            if (result.connected) {
                statusBadge.innerHTML = `<i class="fab fa-google text-green-500"></i> Terhubung ke: ${result.sheetTitle}`;
                statusBadge.title = result.sheetUrl;
            } else {
                statusBadge.innerHTML = `<i class="fab fa-google text-red-500"></i> Gagal terhubung`;
            }
        }
    } catch (error) {
        console.error('Error checking Google Sheet status:', error);
    }
}

// Panggil saat halaman finance dimuat
// Tambahkan di fungsi loadFinanceData():
// await checkGoogleSheetStatus();

// ==================== FUNGSI UPDATE DASHBOARD ALL ====================
async function updateDashboard(prayers, events, financeSummary) {
    // Next prayer
    if (prayers && prayers.length > 0) {
        updateNextPrayerDisplay(prayers);
    }

    // Next event - Filter hanya event yang belum lewat
    if (events && events.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcomingEvents = events
            .filter(event => {
                if (!event.target_date) return false;
                const eventDate = new Date(event.target_date);
                eventDate.setHours(0, 0, 0, 0);
                return eventDate >= today; // Hanya yang >= hari ini
            })
            .sort((a, b) => new Date(a.target_date) - new Date(b.target_date));

        if (upcomingEvents.length > 0) {
            const event = upcomingEvents[0];
            const eventDate = new Date(event.target_date);
            const timeDiff = eventDate.getTime() - today.getTime();
            const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));

            const nextEvent = document.getElementById('next-event');
            const eventDays = document.getElementById('event-days');

            if (nextEvent) {
                nextEvent.textContent = event.title;
            }
            if (eventDays) {
                if (daysLeft === 0) {
                    eventDays.textContent = 'HARI INI';
                    eventDays.className = 'text-purple-600 font-bold';
                } else {
                    eventDays.textContent = `${daysLeft} hari lagi`;
                    eventDays.className = 'text-gray-500 text-xs md:text-sm';
                }
            }
        } else {
            // Tidak ada event
            const nextEvent = document.getElementById('next-event');
            const eventDays = document.getElementById('event-days');
            if (nextEvent) nextEvent.textContent = 'Tidak ada event';
            if (eventDays) eventDays.textContent = '-';
        }
    } else {
        // Tidak ada data event
        const nextEvent = document.getElementById('next-event');
        const eventDays = document.getElementById('event-days');
        if (nextEvent) nextEvent.textContent = 'Tidak ada event';
        if (eventDays) eventDays.textContent = '-';
    }

    // Finance today
    await updateDashboardFinance();
}

// ==================== FUNGSI UNTUK HALAMAN FINANCE ====================
// Fungsi untuk mendapatkan summary keuangan lengkap
async function getFinanceSummary() {
    try {
        const response = await fetch('/api/finances/summary');

        if (!response.ok) {
            throw new Error('Failed to fetch finance summary');
        }

        const result = await response.json();

        if (!result.success || !result.data) {
            throw new Error('Invalid finance summary data');
        }

        const summaries = result.data;

        // Hitung total akumulasi
        const totalIncome = summaries.reduce((sum, item) => sum + (parseFloat(item.total_income) || 0), 0);
        const totalExpense = summaries.reduce((sum, item) => sum + (parseFloat(item.total_expense) || 0), 0);
        const currentBalance = summaries.reduce((sum, item) => sum + (parseFloat(item.balance) || 0), 0);

        // Hitung summary hari ini
        const today = new Date().toISOString().split('T')[0];
        const todaySummary = summaries.find(item => item.date === today) || {
            total_income: 0,
            total_expense: 0,
            balance: 0
        };

        return {
            total: {
                income: totalIncome,
                expense: totalExpense,
                balance: currentBalance
            },
            today: {
                income: parseFloat(todaySummary.total_income) || 0,
                expense: parseFloat(todaySummary.total_expense) || 0,
                balance: parseFloat(todaySummary.balance) || 0
            }
        };

    } catch (error) {
        console.error('Error getting finance summary:', error);
        return {
            total: { income: 0, expense: 0, balance: 0 },
            today: { income: 0, expense: 0, balance: 0 }
        };
    }
}

// ==================== WEBSOCKET HANDLER UPDATE ====================
function handleRealTimeUpdate(data) {
    console.log('Real-time update received:', data);

    // 1. Cek apakah ini update dari diri sendiri (untuk mencegah notif ganda saat kita yang edit)
    const isSelfUpdate = window._lastUpdateTimestamp &&
        (Date.now() - window._lastUpdateTimestamp < 2000);

    // 2. LOGIKA PENCEGAH LOOPING (PENTING!)
    // Jika update adalah 'settings_updated' TAPI isinya cuma cache hijriyah,
    // kita STOP di sini. Jangan tampilkan toast, jangan reload preview.
    if (data.type === 'settings_updated') {
        // Cek struktur data (bisa array atau object tunggal)
        const updates = Array.isArray(data.data) ? data.data : [data.data];
        const isOnlyCacheUpdate = updates.every(item =>
            item && (item.key === 'hijri_date_cache' || item.setting_key === 'hijri_date_cache')
        );

        if (isOnlyCacheUpdate) {
            console.log('Ignoring background cache update to prevent infinite loop');
            return; // KELUAR DARI FUNGSI SEKARANG
        }
    }

    // 3. Proses update normal
    switch (data.type) {
        case 'prayer_times_updated':
            if (!isSelfUpdate) showToast('Jadwal shalat diperbarui', 'info');
            if (currentTab === 'prayer-times') loadPrayerTimes();
            break;

        case 'running_text_updated':
            if (!isSelfUpdate) showToast('Running text diperbarui', 'info');
            if (currentTab === 'running-text') loadRunningText();
            break;

        case 'finances_updated':
        case 'finance_summary_updated':
            if (!isSelfUpdate) showToast('Data keuangan diperbarui', 'info');
            if (currentTab === 'finance') loadFinanceData();
            if (currentTab === 'dashboard') updateDashboardFinance();
            break;

        case 'settings_updated':
            // Karena kita sudah filter cache di atas, yang lolos ke sini adalah settingan penting
            if (!isSelfUpdate) showToast('Pengaturan diperbarui', 'info');
            if (currentTab === 'settings') loadSettings();
            break;

        case 'content_updated':
            if (!isSelfUpdate) showToast('Konten diperbarui', 'info');
            if (currentTab === 'content') loadContent();
            break;

        case 'events_updated':
            if (!isSelfUpdate) showToast('Event diperbarui', 'info');
            if (currentTab === 'events') loadEvents();
            if (currentTab === 'dashboard') loadAllData();
            break;

        case 'iqomah_times_updated':
            if (!isSelfUpdate) showToast('Iqomah diperbarui', 'info');
            if (currentTab === 'iqomah') loadIqomahSettings();
            break;
    }
    updatePreview();
}

// ==================== FORMAT CURRENCY HELPER ====================
function formatCurrency(amount) {
    return `Rp ${(amount || 0).toLocaleString('id-ID')}`;
}

// ==================== EXPORT FUNCTIONS ====================
// Export fungsi ke global scope
window.updateDashboardFinance = updateDashboardFinance;
window.getFinanceSummary = getFinanceSummary;
window.formatCurrency = formatCurrency;

async function updatePrayerTime(prayerName) {
    if (!validatePrayerTime(prayerName)) return;

    const time = document.getElementById(`edit-time-${prayerName}`).value;

    if (!time) {
        showToast(`Waktu ${prayerName} tidak boleh kosong`, 'warning');
        return;
    }

    try {
        // Set timestamp sebelum request
        window._lastUpdateTimestamp = Date.now();

        const prayersResponse = await fetch('/api/prayer-times');
        const prayersData = await prayersResponse.json();
        const prayer = prayersData.data.find(p => p.prayer_name === prayerName);

        if (!prayer) {
            showToast(`Data ${prayerName} tidak ditemukan`, 'error');
            return;
        }

        const response = await fetch(`/api/prayer-times/${prayer.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prayer_name: prayerName,
                time: time
            })
        });

        const result = await response.json();

        if (response.ok) {
            showToast(`✅ ${prayerName} berhasil diupdate`, 'success');
            loadPrayerTimes();
            loadAllData();
        } else {
            showToast(`❌ Gagal update ${prayerName}: ${result.error || 'Unknown error'}`, 'error');
        }

    } catch (error) {
        console.error('Error updating prayer time:', error);
        showToast(`❌ Gagal update ${prayerName}`, 'error');
    }
}

function validatePrayerTime(prayerName) {
    const input = document.getElementById(`edit-time-${prayerName}`);
    if (!input || !input.value) return true;

    const [hours, minutes] = input.value.split(':').map(Number);

    if (isNaN(hours) || isNaN(minutes)) {
        showToast(`Format waktu ${prayerName} tidak valid`, 'warning');
        input.classList.add('border-red-500');
        return false;
    }

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        showToast(`Waktu ${prayerName} di luar rentang valid`, 'warning');
        input.classList.add('border-red-500');
        return false;
    }

    // Validasi khusus untuk shalat tertentu
    if (prayerName === 'Terbit') {
        if (hours < 4 || hours > 7) {
            showToast('Waktu terbit biasanya antara jam 04:00 - 07:00', 'warning');
            input.classList.add('border-yellow-500');
        }
    }

    input.classList.remove('border-red-500', 'border-yellow-500');
    return true;
}

// Helper Functions
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) {
        console.error('Toast element not found');
        return;
    }

    toast.className = 'fixed bottom-4 right-4 p-4 rounded-lg shadow-lg transition-all duration-300';

    const colors = {
        success: 'bg-green-500 text-white',
        error: 'bg-red-500 text-white',
        warning: 'bg-yellow-500 text-white',
        info: 'bg-blue-500 text-white'
    };

    const typeClasses = colors[type] || colors.info;
    typeClasses.split(' ').forEach(className => {
        toast.classList.add(className);
    });

    toast.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.add('opacity-100');

    setTimeout(() => {
        toast.classList.add('hidden');
        toast.classList.remove('opacity-100');
    }, 3000);
}

function updatePreview() {
    const iframe = document.getElementById('preview-frame');
    if (iframe) {
        iframe.src = iframe.src;
    }
}

function openFullPreview() {
    window.open('/', '_blank');
}

function refreshPreview() {
    updatePreview();
    showToast('Preview diperbarui', 'info');
}

// Setup event listeners
function setupEventListeners() {
    const runningTextContent = document.getElementById('running-text-content');
    const runningFont = document.getElementById('running-font');
    const runningFontSize = document.getElementById('running-font-size');

    if (runningTextContent) {
        runningTextContent.addEventListener('input', updateRunningTextPreview);
    }
    if (runningFont) {
        runningFont.addEventListener('change', updateRunningTextPreview);
    }
    if (runningFontSize) {
        runningFontSize.addEventListener('input', updateRunningTextPreview);
    }

    const contentTypeSelect = document.getElementById('content-type');
    if (contentTypeSelect) {
        contentTypeSelect.addEventListener('change', toggleContentType);
    }

    // Preview file sebelum upload
    const fileInput = document.getElementById('content-file');
    if (fileInput) {
        fileInput.addEventListener('change', previewFile);
    }
}

function previewFile() {
    const fileInput = document.getElementById('content-file');
    const contentType = document.getElementById('content-type')?.value;
    const previewContainer = document.getElementById('file-preview-container');

    if (!previewContainer) {
        // Buat container preview jika belum ada
        const container = document.createElement('div');
        container.id = 'file-preview-container';
        container.className = 'mt-2';
        fileInput.parentNode.appendChild(container);
    }

    if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        const previewContainer = document.getElementById('file-preview-container');

        previewContainer.innerHTML = '';

        if (contentType === 'image') {
            const reader = new FileReader();
            reader.onload = (e) => {
                previewContainer.innerHTML = `
                    <div class="mt-2">
                        <p class="text-sm text-gray-600 mb-1">Preview:</p>
                        <img src="${e.target.result}" alt="Preview" class="w-32 h-24 object-cover rounded border">
                        <p class="text-xs text-gray-500 mt-1">${file.name} (${(file.size / 1024).toFixed(1)} KB)</p>
                    </div>
                `;
            };
            reader.readAsDataURL(file);
        } else if (contentType === 'video') {
            previewContainer.innerHTML = `
                <div class="mt-2">
                    <p class="text-sm text-gray-600 mb-1">Video dipilih:</p>
                    <div class="flex items-center space-x-2">
                        <div class="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                            <i class="fas fa-video text-gray-500"></i>
                        </div>
                        <div>
                            <p class="text-sm">${file.name}</p>
                            <p class="text-xs text-gray-500">${(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                    </div>
                </div>
            `;
        }
    }
}

function updateRunningTextPreview() {
    const text = document.getElementById('running-text-content')?.value || '';
    const font = document.getElementById('running-font')?.value || 'Inter';
    const fontSize = document.getElementById('running-font-size')?.value || 16;

    const preview = document.getElementById('preview-text');
    if (preview) {
        // Ambil baris pertama untuk preview
        const firstLine = text.split('\n')[0] || 'Preview teks...';
        preview.textContent = firstLine;
        preview.style.fontFamily = font;
        preview.style.fontSize = `${fontSize}px`;
    }
}

function resetRunningTextArea() {
    const textArea = document.getElementById('running-text-content');
    const fontSelect = document.getElementById('running-font');
    const fontSizeInput = document.getElementById('running-font-size');
    const speedInput = document.getElementById('running-speed');

    if (textArea) textArea.value = '';
    if (fontSelect) fontSelect.value = 'Inter';
    if (fontSizeInput) fontSizeInput.value = '16';
    if (speedInput) speedInput.value = '30';

    updateRunningTextPreview();
    showToast('Textarea dikosongkan', 'info');
}

function loadDefaultRunningText() {
    const defaultTexts = [
        "Selamat datang di Masjid Al-Ikhlas",
        "Jaga kebersihan dan ketertiban masjid",
        "Mari rapatkan dan luruskan shaf shalat",
        "Semoga ibadah kita diterima Allah SWT"
    ];

    const textArea = document.getElementById('running-text-content');
    if (textArea) {
        textArea.value = defaultTexts.join('\n');
        updateRunningTextPreview();
        showToast('Default text dimuat', 'info');
    }
}

function setupRunningTextListeners() {
    const textArea = document.getElementById('running-text-content');
    const fontSelect = document.getElementById('running-font');
    const fontSizeInput = document.getElementById('running-font-size');
    const speedInput = document.getElementById('running-speed');

    if (textArea) {
        textArea.addEventListener('input', updateRunningTextPreview);
    }

    if (fontSelect) {
        fontSelect.addEventListener('change', updateRunningTextPreview);
    }

    if (fontSizeInput) {
        fontSizeInput.addEventListener('input', updateRunningTextPreview);
    }

    if (speedInput) {
        speedInput.addEventListener('change', updateRunningTextPreview);
    }

    console.log('✅ Running text listeners setup complete');
}

// Form toggle functions
function showManualInput() {
    const manualInput = document.getElementById('manual-input');
    if (manualInput) {
        manualInput.classList.remove('hidden');
    }
}

function hideManualInput() {
    const manualInput = document.getElementById('manual-input');
    if (manualInput) {
        manualInput.classList.add('hidden');
    }
}

function showUploadForm() {
    const form = document.getElementById('upload-form');
    if (form) {
        form.classList.remove('hidden');
    }
}

function hideUploadForm() {
    const form = document.getElementById('upload-form');
    if (form) {
        form.classList.add('hidden');
    }
}

function showEventForm() {
    const form = document.getElementById('event-form');
    if (form) {
        form.classList.remove('hidden');
    }
}

function hideEventForm() {
    const form = document.getElementById('event-form');
    if (form) {
        form.classList.add('hidden');
    }
}

function showTransactionForm() {
    const form = document.getElementById('transaction-form');
    if (form) {
        form.classList.remove('hidden');
    }
}

function hideTransactionForm() {
    const form = document.getElementById('transaction-form');
    if (form) {
        form.classList.add('hidden');
    }
}

function toggleContentType() {
    const type = document.getElementById('content-type')?.value;
    const fileSection = document.getElementById('file-upload-section');
    const announcementSettings = document.getElementById('announcement-settings');
    const titleFontContainer = document.getElementById('title-font-size-container');
    const descFontContainer = document.getElementById('desc-font-size-container');

    if (type === 'announcement') {
        // Untuk pengumuman: sembunyikan file section, tampilkan announcement settings
        if (fileSection) fileSection.classList.add('hidden');
        if (announcementSettings) announcementSettings.classList.remove('hidden');

        // Tampilkan opsi ukuran font untuk judul dan deskripsi
        if (titleFontContainer) titleFontContainer.classList.remove('hidden');
        if (descFontContainer) descFontContainer.classList.remove('hidden');
    } else {
        // Untuk image/video: tampilkan file section, sembunyikan announcement settings
        if (fileSection) fileSection.classList.remove('hidden');
        if (announcementSettings) announcementSettings.classList.add('hidden');

        // Sembunyikan opsi ukuran font untuk judul dan deskripsi
        if (titleFontContainer) titleFontContainer.classList.add('hidden');
        if (descFontContainer) descFontContainer.classList.add('hidden');

        // Update accept attribute untuk file input
        const fileInput = document.getElementById('content-file');
        if (fileInput) {
            fileInput.accept = type === 'image' ? 'image/*' : 'video/*';
        }
    }
}

// Running Text Management
async function loadRunningText() {
    try {
        console.log('🔄 Loading running text UMUM from API...');

        // AMBIL HANYA DARI TABEL RUNNING_TEXT (BUKAN IQOMAH)
        const response = await fetch('/api/running-text');
        if (!response.ok) throw new Error('Gagal mengambil running text');

        const result = await response.json();

        // Filter: HANYA teks yang BUKAN mengandung kata kunci iqomah
        const allTexts = result.data || [];

        // Filter teks umum (exclude yang jelas-jelas iqomah)
        const umumTexts = allTexts.filter(t => {
            const text = (t.text || '').toLowerCase();
            // Exclude jika mengandung kata kunci iqomah
            const isIqomahKeyword =
                text.includes('🔊') ||
                text.includes('⭐') ||
                text.includes('📿') ||
                text.includes('shaf') ||
                text.includes('silent') ||
                text.includes('iqomah') ||
                text.includes('tenang') ||
                text.includes('matikan hp');

            return !isIqomahKeyword;
        });

        // TAMPILKAN DI TEXTAREA
        updateRunningTextArea(umumTexts);

        console.log(`✅ Running text UMUM loaded: ${umumTexts.length} active texts`);

    } catch (error) {
        console.error('❌ Error loading running text:', error);
        showToast('Gagal memuat running text', 'error');
    }
}

function updateRunningTextArea(texts) {
    const textArea = document.getElementById('running-text-content');
    if (!textArea) {
        console.error('❌ Textarea running-text-content tidak ditemukan');
        return;
    }

    if (texts.length === 0) {
        // Jika tidak ada teks, kosongkan textarea
        textArea.value = '';
        return;
    }

    // Urutkan berdasarkan ID (ascending) agar konsisten
    const sortedTexts = [...texts].sort((a, b) => a.id - b.id);

    // Gabungkan semua teks dengan newline (\n)
    const combinedText = sortedTexts.map(t => t.text).join('\n');

    // Set nilai textarea
    textArea.value = combinedText;

    // Ambil font dan ukuran dari teks pertama (asumsi semua sama)
    if (sortedTexts.length > 0) {
        const firstText = sortedTexts[0];

        const fontSelect = document.getElementById('running-font');
        const fontSizeInput = document.getElementById('running-font-size');
        const speedInput = document.getElementById('running-speed');

        if (fontSelect && firstText.font_family) {
            fontSelect.value = firstText.font_family;
        }

        if (fontSizeInput && firstText.font_size) {
            fontSizeInput.value = firstText.font_size;
        }

        if (speedInput && firstText.speed) {
            speedInput.value = firstText.speed;
        }
    }

    // Update preview
    updateRunningTextPreview();

    console.log(`✅ Textarea updated with ${texts.length} texts`);
}

async function saveRunningText() {
    const textArea = document.getElementById('running-text-content');
    const font = document.getElementById('running-font')?.value || 'Inter';
    const fontSize = document.getElementById('running-font-size')?.value || 16;
    const speed = document.getElementById('running-speed')?.value || 30;

    const rawText = textArea?.value || '';

    if (!rawText.trim()) {
        showToast('Harap masukkan teks!', 'warning');
        return;
    }

    // Pecah teks berdasarkan Enter/Baris Baru
    const textLines = rawText.split('\n')
        .map(line => line.trim())
        .filter(line => line !== '');

    if (textLines.length === 0) {
        showToast('Tidak ada teks yang valid!', 'warning');
        return;
    }

    showToast('⏳ Menyimpan running text...', 'info');

    try {
        // LANGKAH 1: Ambil semua running text yang ada di database
        const getRes = await fetch('/api/running-text');
        const getData = await getRes.json();
        const existingTexts = getData.data || [];

        // Filter teks umum (exclude yang jelas-jelas iqomah)
        const umumTexts = existingTexts.filter(t => {
            const text = (t.text || '').toLowerCase();
            const isIqomahKeyword =
                text.includes('🔊') ||
                text.includes('⭐') ||
                text.includes('📿') ||
                text.includes('shaf') ||
                text.includes('silent') ||
                text.includes('iqomah') ||
                text.includes('tenang') ||
                text.includes('matikan hp');
            return !isIqomahKeyword;
        });

        // Array untuk menyimpan semua operasi API
        const operations = [];

        // LANGKAH 2: Update SEMUA teks yang ada di DB dengan nilai baru
        // Jika teks masih ada di textarea -> Update (dengan font/size/speed baru)
        // Jika teks tidak ada di textarea -> Hapus
        umumTexts.forEach((existingText) => {
            const lineIndex = textLines.findIndex(line => line === existingText.text);
            
            if (lineIndex !== -1) {
                // Teks masih ada di textarea, UPDATE dengan nilai global baru
                operations.push(
                    fetch(`/api/running-text/${existingText.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            text: existingText.text,
                            font_family: font,        // Nilai baru dari form
                            font_size: parseInt(fontSize),
                            speed: parseInt(speed),
                            is_active: true,
                            display_order: lineIndex
                        })
                    })
                );
            } else {
                // Teks tidak ada lagi di textarea, HAPUS
                operations.push(
                    fetch(`/api/running-text/${existingText.id}`, { 
                        method: 'DELETE' 
                    })
                );
            }
        });

        // LANGKAH 3: Tambah teks baru yang belum ada di DB
        const existingTextsContent = umumTexts.map(t => t.text);
        
        textLines.forEach((lineText, index) => {
            if (!existingTextsContent.includes(lineText)) {
                // Teks baru, TAMBAH dengan nilai global
                operations.push(
                    fetch('/api/running-text', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            text: lineText,
                            font_family: font,
                            font_size: parseInt(fontSize),
                            speed: parseInt(speed),
                            is_active: true,
                            display_order: index
                        })
                    })
                );
            }
        });

        // Jalankan semua operasi secara paralel
        await Promise.all(operations);

        // Set timestamp untuk mencegah notifikasi ganda
        window._lastUpdateTimestamp = Date.now();

        showToast(`✅ Running Text berhasil disimpan! Semua teks menggunakan font: ${font}, size: ${fontSize}px, speed: ${speed}`, 'success');

        // Reload data untuk memastikan tampilan sesuai
        await loadRunningText();
        updatePreview();

    } catch (error) {
        console.error('Error saving running text:', error);
        showToast('Gagal menyimpan data: ' + error.message, 'error');
    }
}

async function editRunningText(id) {
    try {
        const response = await fetch(`/api/running-text/${id}`);
        if (!response.ok) throw new Error('Failed to fetch running text');

        const result = await response.json();
        const text = result.data;

        if (text) {
            // Set mode edit
            editingRunningTextId = id;

            // Isi form dengan data yang akan diedit
            document.getElementById('running-text-content').value = text.text || '';
            document.getElementById('running-font').value = text.font_family || 'Inter';
            document.getElementById('running-font-size').value = text.font_size || 16;
            document.getElementById('running-speed').value = text.speed || 30;

            // Ubah teks tombol
            const saveBtn = document.getElementById('save-running-text-btn');
            if (saveBtn) {
                saveBtn.innerHTML = '<i class="fas fa-edit mr-1"></i> Update Running Text';
            }

            // Update preview
            updateRunningTextPreview();

            showToast('✏️ Sedang mengedit running text', 'info');

            // Scroll ke form
            document.getElementById('running-text-content').scrollIntoView({ behavior: 'smooth' });
        }
    } catch (error) {
        console.error('Error editing running text:', error);
        showToast('Gagal memuat data running text', 'error');
    }
}

async function duplicateRunningText(id) {
    try {
        const response = await fetch(`/api/running-text/${id}`);
        if (!response.ok) throw new Error('Failed to fetch running text');

        const result = await response.json();
        const text = result.data;

        if (text) {
            // Reset mode edit
            editingRunningTextId = null;

            // Isi form dengan data yang akan diduplikat
            document.getElementById('running-text-content').value = text.text || '';
            document.getElementById('running-font').value = text.font_family || 'Inter';
            document.getElementById('running-font-size').value = text.font_size || 16;
            document.getElementById('running-speed').value = text.speed || 30;

            // Ubah teks tombol
            const saveBtn = document.getElementById('save-running-text-btn');
            if (saveBtn) {
                saveBtn.innerHTML = '<i class="fas fa-save mr-1"></i> Simpan Sebagai Baru';
            }

            updateRunningTextPreview();

            showToast('📋 Data telah diduplikat, silakan simpan sebagai baru', 'info');

            // Scroll ke form
            document.getElementById('running-text-content').scrollIntoView({ behavior: 'smooth' });
        }
    } catch (error) {
        console.error('Error duplicating running text:', error);
        showToast('Gagal menduplikat running text', 'error');
    }
}



async function activateRunningText(id) {
    try {
        // Ambil semua running text
        const allResponse = await fetch('/api/running-text');
        const allResult = await allResponse.json();
        const allTexts = allResult.data || [];

        // Nonaktifkan semua yang aktif
        for (const text of allTexts) {
            if (text.is_active && text.id !== id) {
                await fetch(`/api/running-text/${text.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: text.text,
                        font_family: text.font_family,
                        font_size: text.font_size,
                        speed: text.speed,
                        is_active: false
                    })
                });
            }
        }

        // Aktifkan yang dipilih
        const response = await fetch(`/api/running-text/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                is_active: true
            })
        });

        if (response.ok) {
            showToast('✅ Running text diaktifkan', 'success');
            loadRunningText(); // Reload tabel
            updatePreview();
        }
    } catch (error) {
        console.error('Error activating running text:', error);
        showToast('Gagal mengaktifkan running text', 'error');
    }
}

async function deleteRunningText(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus running text ini?')) {
        return;
    }

    try {
        const response = await fetch(`/api/running-text/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('✅ Running text berhasil dihapus', 'success');

            // Jika yang dihapus sedang diedit, reset form
            if (editingRunningTextId === id) {
                resetRunningTextForm();
            }

            loadRunningText();
            updatePreview();
        } else {
            showToast('Gagal menghapus running text', 'error');
        }
    } catch (error) {
        console.error('Error deleting running text:', error);
        showToast('Gagal menghapus running text', 'error');
    }
}

function resetRunningTextForm() {
    document.getElementById('running-text-content').value = '';
    document.getElementById('running-font').value = 'Inter';
    document.getElementById('running-font-size').value = '16';
    document.getElementById('running-speed').value = '30';

    // Reset mode edit
    editingRunningTextId = null;

    // Ubah teks tombol
    const saveBtn = document.getElementById('save-running-text-btn');
    if (saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-save mr-1"></i> Simpan Running Text Baru';
    }

    updateRunningTextPreview();
    showToast('Mode: Tambah Running Text Baru', 'info');
}

// Settings Management
async function loadSettings() {
    try {
        const response = await fetch('/api/settings');
        if (!response.ok) throw new Error('Failed to fetch settings');

        const result = await response.json();
        const settings = result.data || [];

        // Convert array to object for easier access
        const settingsObj = {};
        settings.forEach(setting => {
            settingsObj[setting.setting_key] = setting.setting_value;
        });

        // Update form inputs dengan pengecekan null
        const elements = {
            'setting-masjid-name': 'masjid_name',
            'setting-masjid-address': 'masjid_address',
            'setting-latitude': 'latitude',
            'setting-longitude': 'longitude',
            'setting-calculation-method': 'prayer_calculation_method',
            'setting-auto-adzan': 'auto_adzan',
            'setting-content-rotation': 'display_rotation',
            'setting-date-rotation': 'date_rotation',
            'setting-adzan-redirect': 'adzan_redirect_minutes',
            'setting-iqomah-duration': 'iqomah_duration'
        };

        Object.entries(elements).forEach(([elementId, settingKey]) => {
            const element = document.getElementById(elementId);
            if (element && settingsObj[settingKey] !== undefined) {
                element.value = settingsObj[settingKey];
            }
        });

        console.log('✅ Settings loaded successfully');

    } catch (error) {
        console.error('Error loading settings:', error);
        showToast('Gagal memuat pengaturan', 'error');
    }
}

async function saveSettings() {
    // Periksa apakah element-element yang diperlukan ada
    const masjidNameInput = document.getElementById('setting-masjid-name');
    const masjidAddressInput = document.getElementById('setting-masjid-address');
    const latitudeInput = document.getElementById('setting-latitude');
    const longitudeInput = document.getElementById('setting-longitude');
    const calculationMethodInput = document.getElementById('setting-calculation-method');
    const autoAdzanInput = document.getElementById('setting-auto-adzan');
    const contentRotationInput = document.getElementById('setting-content-rotation');
    const dateRotationInput = document.getElementById('setting-date-rotation');
    const adzanRedirectInput = document.getElementById('setting-adzan-redirect');
    const iqomahDurationInput = document.getElementById('setting-iqomah-duration');

    // Validasi input yang diperlukan
    if (!masjidNameInput || !masjidAddressInput) {
        showToast('❌ Elemen form tidak ditemukan', 'error');
        return;
    }

    const settings = [
        { key: 'masjid_name', value: masjidNameInput.value },
        { key: 'masjid_address', value: masjidAddressInput.value },
        { key: 'latitude', value: latitudeInput ? latitudeInput.value : '-6.9419' },
        { key: 'longitude', value: longitudeInput ? longitudeInput.value : '107.6824' },
        { key: 'prayer_calculation_method', value: calculationMethodInput ? calculationMethodInput.value : '11' },
        { key: 'auto_adzan', value: autoAdzanInput ? autoAdzanInput.value : '1' },
        { key: 'display_rotation', value: contentRotationInput ? contentRotationInput.value : '20' },
        { key: 'date_rotation', value: dateRotationInput ? dateRotationInput.value : '15' },
        { key: 'adzan_redirect_minutes', value: adzanRedirectInput ? adzanRedirectInput.value : '5' },
        { key: 'iqomah_duration', value: iqomahDurationInput ? iqomahDurationInput.value : '10' }
    ];

    try {
        // Set timestamp sebelum request
        window._lastUpdateTimestamp = Date.now();

        showToast('⏳ Menyimpan pengaturan...', 'info');

        const response = await fetch('/api/settings/bulk', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify({ settings })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            showToast('✅ Pengaturan berhasil disimpan', 'success');
            updatePreview();

            // Refresh data jika perlu
            if (typeof loadSettings === 'function') {
                loadSettings();
            }
        } else {
            showToast(result.error || 'Gagal menyimpan pengaturan', 'error');
        }

    } catch (error) {
        console.error('Error saving settings:', error);
        showToast('Koneksi error. Coba lagi.', 'error');
    }
}


async function exportFinanceToExcel() {
    try {
        showToast('📥 Menyiapkan data...', 'info');

        // Ambil semua data transaksi
        const response = await fetch('/api/finances');
        if (!response.ok) throw new Error('Gagal mengambil data');

        const result = await response.json();
        const transactions = result.data || [];

        if (transactions.length === 0) {
            showToast('Tidak ada data untuk diexport', 'warning');
            return;
        }

        // Format data sesuai dengan kolom tabel
        const data = transactions.map(t => ({
            'Tanggal': new Date(t.transaction_date).toLocaleDateString('id-ID'),
            'Tipe': t.type === 'masuk' ? 'Pemasukan' : 'Pengeluaran',
            'Kategori': t.category,
            'Jumlah': `Rp ${parseFloat(t.amount).toLocaleString('id-ID')}`,
            'Deskripsi': t.description || '-'
        }));

        // Buat worksheet dan workbook
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Keuangan Masjid');

        // Atur lebar kolom agar lebih rapi (opsional)
        const colWidths = [
            { wch: 12 }, // Tanggal
            { wch: 15 }, // Tipe
            { wch: 20 }, // Kategori
            { wch: 18 }, // Jumlah
            { wch: 30 }  // Deskripsi
        ];
        ws['!cols'] = colWidths;

        // Download file
        const fileName = `keuangan-masjid-${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);

        showToast('✅ Data berhasil diexport ke Excel', 'success');
    } catch (error) {
        console.error('Error exporting to Excel:', error);
        showToast('❌ Gagal mengexport data', 'error');
    }
}

// Fungsi untuk manajemen konten
async function loadContent() {
    try {
        const response = await fetch('/api/content');
        if (!response.ok) throw new Error('Failed to fetch content');

        const result = await response.json();
        const contents = result.data || [];
        const table = document.getElementById('content-table');

        if (!table) {
            console.error('Content table element not found');
            return;
        }

        table.innerHTML = '';

        if (contents.length === 0) {
            table.innerHTML = `
                <tr>
                    <td colspan="6" class="p-4 text-center text-gray-500">
                        Belum ada konten. Tambah konten baru.
                    </td>
                </tr>
            `;
            return;
        }

        contents.forEach(content => {
            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-gray-50';
            row.innerHTML = `
                <td class="p-3">${content.title || '-'}</td>
                <td class="p-3">
                    <span class="px-2 py-1 rounded text-xs ${content.content_type === 'image' ? 'bg-blue-100 text-blue-800' : content.content_type === 'video' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}">
                        ${content.content_type || 'text'}
                    </span>
                </td>
                <td class="p-3">
                    ${content.content_type === 'image' && content.image_url ?
                    `<img src="${content.image_url}" alt="${content.title}" class="w-16 h-12 object-cover rounded">` :
                    content.content_type === 'video' && content.video_url ?
                        `<div class="w-16 h-12 bg-gray-200 rounded flex items-center justify-center">
                            <i class="fas fa-video text-gray-500"></i>
                        </div>` :
                        '<span class="text-gray-400">-</span>'}
                </td>
                <td class="p-3">${content.display_order || 0}</td>
                <td class="p-3">
                    <span class="px-2 py-1 rounded text-xs ${content.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        ${content.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                </td>
                <td class="p-3">
                    <button onclick="editContent(${content.id})" class="text-blue-600 hover:text-blue-800 mr-2">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteContent(${content.id})" class="text-red-600 hover:text-red-800">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            table.appendChild(row);
        });

    } catch (error) {
        console.error('Error loading content:', error);
        showToast('Gagal memuat konten', 'error');
    }
}

// Fungsi untuk upload content dengan file - DIPERBAIKI LAGI
async function uploadContent() {
    const title = document.getElementById('content-title')?.value;
    const description = document.getElementById('content-description')?.value;
    const content_type = document.getElementById('content-type')?.value;
    const display_order = document.getElementById('content-order')?.value;
    const is_active = true;

    if (!title?.trim()) {
        showToast('Judul konten diperlukan', 'warning');
        return;
    }

    // Data dasar konten
    const contentData = {
        title: title,
        content_text: description || null,
        content_type: content_type,
        display_order: parseInt(display_order) || 0,
        is_active: is_active
    };

    // Jika tipe pengumuman, tambahkan data pengaturan
    if (content_type === 'announcement') {
        const announcementText = document.getElementById('announcement-text')?.value;
        const fontFamily = document.getElementById('announcement-font')?.value;
        const titleFontSize = document.getElementById('title-font-size')?.value;
        const descFontSize = document.getElementById('desc-font-size')?.value;
        const color = document.getElementById('announcement-color')?.value;
        const bgColor = document.getElementById('announcement-bg-color')?.value;
        const bgOpacity = document.getElementById('announcement-bg-opacity')?.value;
        const bold = document.getElementById('announcement-bold')?.checked;
        const italic = document.getElementById('announcement-italic')?.checked;
        const underline = document.getElementById('announcement-underline')?.checked;
        const textAlign = document.querySelector('input[name="text-align"]:checked')?.value;
        const position = document.querySelector('input[name="content-position"]:checked')?.value;

        // Simpan sebagai JSON string di content_text
        const announcementData = {
            text: announcementText,
            font_family: fontFamily,
            title_font_size: parseInt(titleFontSize) || 24,
            desc_font_size: parseInt(descFontSize) || 16,
            color: color,
            bg_color: bgColor,
            bg_opacity: parseInt(bgOpacity) || 100,
            bold: bold,
            italic: italic,
            underline: underline,
            text_align: textAlign,
            position: position
        };

        contentData.content_text = JSON.stringify(announcementData);
    }

    // Untuk image/video, perlu upload file via FormData
    if (content_type === 'image' || content_type === 'video') {
        const fileInput = document.getElementById('content-file');
        if (!fileInput?.files[0]) {
            showToast('File diperlukan untuk tipe image/video', 'warning');
            return;
        }

        const file = fileInput.files[0];

        // Validasi file client-side
        if (content_type === 'image') {
            const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
            if (!validImageTypes.includes(file.type)) {
                showToast('Format gambar tidak didukung. Gunakan JPEG, PNG, GIF, atau WebP.', 'error');
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                showToast('Ukuran gambar terlalu besar. Maksimal 5MB.', 'error');
                return;
            }
        } else if (content_type === 'video') {
            const validVideoTypes = ['video/mp4', 'video/webm', 'video/ogg'];
            if (!validVideoTypes.includes(file.type)) {
                showToast('Format video tidak didukung. Gunakan MP4, WebM, atau OGG.', 'error');
                return;
            }
            if (file.size > 20 * 1024 * 1024) {
                showToast('Ukuran video terlalu besar. Maksimal 20MB.', 'error');
                return;
            }
        }

        try {
            showToast('🔄 Mengupload file...', 'info');

            const formData = new FormData();
            formData.append('file', file);

            const uploadResponse = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const uploadResult = await uploadResponse.json();

            if (!uploadResponse.ok) {
                showToast(uploadResult.error || 'Gagal upload file', 'error');
                return;
            }

            // Tambahkan URL file ke data konten
            contentData.image_url = uploadResult.type === 'image' ? uploadResult.filePath : null;
            contentData.video_url = uploadResult.type === 'video' ? uploadResult.filePath : null;
            contentData.content_type = uploadResult.type; // Gunakan type dari server

        } catch (error) {
            console.error('Error uploading content:', error);
            showToast('Koneksi error. Coba lagi.', 'error');
            return;
        }
    }

    // Simpan konten ke database
    try {
        const response = await fetch('/api/content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(contentData)
        });

        const result = await response.json();

        if (response.ok) {
            showToast('Konten berhasil ditambahkan', 'success');
            hideUploadForm();
            resetContentForm();
            loadContent();
            updatePreview();
        } else {
            showToast(result.error || 'Gagal menambahkan konten', 'error');
        }
    } catch (error) {
        console.error('Error uploading content:', error);
        showToast('Koneksi error. Coba lagi.', 'error');
    }
}

function resetContentForm() {
    document.getElementById('content-title').value = '';
    document.getElementById('content-description').value = '';
    document.getElementById('content-type').value = 'text';
    document.getElementById('content-file').value = '';
    document.getElementById('content-order').value = '0';
    document.getElementById('content-active').checked = true;

    // Reset file section visibility
    toggleContentType();
}

async function editContent(id) {
    try {
        showToast('🔄 Memuat data konten...', 'info');

        // Ambil data konten
        const response = await fetch(`/api/content/${id}`);
        if (!response.ok) {
            throw new Error('Gagal mengambil data konten');
        }

        const result = await response.json();
        const content = result.data;

        if (!content) {
            showToast('Konten tidak ditemukan', 'error');
            return;
        }

        // PERBAIKAN: Parse content_text jika berupa JSON (untuk announcement)
        let announcementData = null;
        if (content.content_type === 'announcement' || content.content_type === 'text') {
            try {
                if (typeof content.content_text === 'string' && content.content_text.startsWith('{')) {
                    announcementData = JSON.parse(content.content_text);
                }
            } catch (e) {
                console.log('Content text bukan JSON, treat sebagai plain text');
            }
        }

        // Tampilkan modal/edit form
        createEditContentModal(content, announcementData);

    } catch (error) {
        console.error('Error editing content:', error);
        showToast('Gagal memuat data konten', 'error');
    }
}

function createEditContentModal(content, announcementData = null) {
    // Hapus modal lama jika ada
    const existingModal = document.getElementById('edit-content-modal');
    if (existingModal) {
        existingModal.remove();
    }

    // Tentukan apakah ini announcement
    const isAnnouncement = content.content_type === 'announcement' || content.content_type === 'text';

    // Default values untuk announcement
    const ad = announcementData || {};
    const fontFamily = ad.font_family || 'Inter';
    const titleFontSize = ad.title_font_size || 24;
    const descFontSize = ad.desc_font_size || 16;
    const color = ad.color || '#000000';
    const bgColor = ad.bg_color || '#ffffff';
    const bgOpacity = ad.bg_opacity || 100;
    const bold = ad.bold !== undefined ? ad.bold : true;
    const italic = ad.italic || false;
    const underline = ad.underline || false;
    const textAlign = ad.text_align || 'center';
    const position = ad.position || 'center';
    const announcementText = ad.text || '';

    const modalHTML = `
    <div id="edit-content-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
        <div class="p-6">
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-xl font-bold">Edit Konten</h3>
            <button onclick="closeEditModal()" class="text-gray-400 hover:text-gray-600">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="space-y-4">
            <!-- Judul -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Judul</label>
              <input type="text" id="edit-content-title" value="${escapeHTML(content.title || '')}" 
                     class="w-full p-2 border rounded" placeholder="Judul konten">
              
              <!-- Ukuran Font Judul -->
              <div class="mt-2">
                <label class="block text-sm font-medium text-gray-700 mb-1">Ukuran Font Judul (px)</label>
                <div class="flex items-center space-x-2">
                  <input type="range" id="edit-title-font-size" class="flex-1" min="12" max="72" value="${titleFontSize}">
                  <input type="number" id="edit-title-font-size-input" class="w-20 p-2 border rounded text-sm" value="${titleFontSize}" min="12" max="72">
                  <span class="text-sm text-gray-600">px</span>
                </div>
              </div>
            </div>
            
            <!-- Deskripsi -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
              <textarea id="edit-content-description" rows="2" 
                        class="w-full p-2 border rounded" placeholder="Deskripsi singkat...">${escapeHTML(content.description || '')}</textarea>
              
              <!-- Ukuran Font Deskripsi -->
              <div class="mt-2">
                <label class="block text-sm font-medium text-gray-700 mb-1">Ukuran Font Deskripsi (px)</label>
                <div class="flex items-center space-x-2">
                  <input type="range" id="edit-desc-font-size" class="flex-1" min="12" max="48" value="${descFontSize}">
                  <input type="number" id="edit-desc-font-size-input" class="w-20 p-2 border rounded text-sm" value="${descFontSize}" min="12" max="48">
                  <span class="text-sm text-gray-600">px</span>
                </div>
              </div>
            </div>
            
            <!-- Tipe Konten -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Tipe Konten</label>
              <select id="edit-content-type" class="w-full p-2 border rounded" onchange="toggleEditFileSection()">
                <option value="text" ${content.content_type === 'text' ? 'selected' : ''}>Text</option>
                <option value="announcement" ${content.content_type === 'announcement' ? 'selected' : ''}>Pengumuman</option>
                <option value="image" ${content.content_type === 'image' ? 'selected' : ''}>Gambar</option>
                <option value="video" ${content.content_type === 'video' ? 'selected' : ''}>Video</option>
              </select>
            </div>
            
            <!-- File Upload Section -->
            <div id="edit-file-section" class="${isAnnouncement ? 'hidden' : ''}">
              <label class="block text-sm font-medium text-gray-700 mb-1">
                ${content.content_type === 'image' ? 'Gambar' : 'Video'} Baru (opsional)
              </label>
              <input type="file" id="edit-content-file" 
                     accept="${content.content_type === 'image' ? 'image/*' : 'video/*'}" 
                     class="w-full p-2 border rounded">
              
              ${content.content_type === 'image' && content.image_url ? `
                <div class="mt-2">
                  <p class="text-sm text-gray-600 mb-1">Gambar saat ini:</p>
                  <img src="${content.image_url}" alt="Preview" class="w-32 h-24 object-cover rounded border">
                </div>
              ` : content.content_type === 'video' && content.video_url ? `
                <div class="mt-2">
                  <p class="text-sm text-gray-600 mb-1">Video saat ini:</p>
                  <div class="w-32 h-24 bg-gray-200 rounded flex items-center justify-center border">
                    <i class="fas fa-video text-gray-500 text-2xl"></i>
                  </div>
                </div>
              ` : ''}
            </div>

            <!-- ANNOUNCEMENT SETTINGS SECTION -->
            <div id="edit-announcement-settings" class="${!isAnnouncement ? 'hidden' : ''} p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h5 class="font-semibold text-blue-800 mb-3">
                <i class="fas fa-cog mr-2"></i>Pengaturan Pengumuman
              </h5>
              
              <!-- Isi Pengumuman -->
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">Isi Pengumuman</label>
                <textarea id="edit-announcement-text" rows="4" class="w-full p-2 border rounded"
                          placeholder="Tulis pengumuman di sini...">${escapeHTML(announcementText)}</textarea>
              </div>
              
              <!-- Font & Colors -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    <i class="fas fa-font mr-1"></i>Jenis Font
                  </label>
                  <select id="edit-announcement-font" class="w-full p-2 border rounded">
                    <option value="Inter" ${fontFamily === 'Inter' ? 'selected' : ''}>Inter</option>
                    <option value="Arial" ${fontFamily === 'Arial' ? 'selected' : ''}>Arial</option>
                    <option value="Helvetica" ${fontFamily === 'Helvetica' ? 'selected' : ''}>Helvetica</option>
                    <option value="Times New Roman" ${fontFamily === 'Times New Roman' ? 'selected' : ''}>Times New Roman</option>
                    <option value="Georgia" ${fontFamily === 'Georgia' ? 'selected' : ''}>Georgia</option>
                    <option value="Verdana" ${fontFamily === 'Verdana' ? 'selected' : ''}>Verdana</option>
                    <option value="Courier New" ${fontFamily === 'Courier New' ? 'selected' : ''}>Courier New</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    <i class="fas fa-palette mr-1"></i>Warna Teks
                  </label>
                  <div class="flex space-x-2">
                    <input type="color" id="edit-announcement-color" class="w-12 h-10 border rounded cursor-pointer" value="${color}">
                    <input type="text" id="edit-announcement-color-hex" class="flex-1 p-2 border rounded text-sm" value="${color}" placeholder="#000000">
                  </div>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    <i class="fas fa-fill-drip mr-1"></i>Warna Background
                  </label>
                  <div class="flex space-x-2">
                    <input type="color" id="edit-announcement-bg-color" class="w-12 h-10 border rounded cursor-pointer" value="${bgColor}">
                    <input type="text" id="edit-announcement-bg-color-hex" class="flex-1 p-2 border rounded text-sm" value="${bgColor}" placeholder="#ffffff">
                  </div>
                </div>
              </div>
              
              <!-- Font Style -->
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  <i class="fas fa-bold mr-1"></i>Gaya Font
                </label>
                <div class="flex flex-wrap gap-2">
                  <label class="inline-flex items-center px-3 py-2 border rounded cursor-pointer hover:bg-blue-100 ${bold ? 'bg-blue-100 border-blue-500' : ''}">
                    <input type="checkbox" id="edit-announcement-bold" class="mr-2" ${bold ? 'checked' : ''}>
                    <i class="fas fa-bold mr-1"></i> Bold
                  </label>
                  <label class="inline-flex items-center px-3 py-2 border rounded cursor-pointer hover:bg-blue-100 ${italic ? 'bg-blue-100 border-blue-500' : ''}">
                    <input type="checkbox" id="edit-announcement-italic" class="mr-2" ${italic ? 'checked' : ''}>
                    <i class="fas fa-italic mr-1"></i> Italic
                  </label>
                  <label class="inline-flex items-center px-3 py-2 border rounded cursor-pointer hover:bg-blue-100 ${underline ? 'bg-blue-100 border-blue-500' : ''}">
                    <input type="checkbox" id="edit-announcement-underline" class="mr-2" ${underline ? 'checked' : ''}>
                    <i class="fas fa-underline mr-1"></i> Underline
                  </label>
                </div>
              </div>
              
              <!-- Text Align -->
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  <i class="fas fa-align-left mr-1"></i>Perataan Teks
                </label>
                <div class="grid grid-cols-4 gap-2">
                  ${['left', 'center', 'right', 'justify'].map(align => `
                    <label class="flex-1">
                      <input type="radio" name="edit-text-align" value="${align}" class="hidden peer" ${textAlign === align ? 'checked' : ''}>
                      <div class="p-2 border rounded text-center cursor-pointer peer-checked:bg-blue-500 peer-checked:text-white hover:bg-blue-100 ${textAlign === align ? 'bg-blue-500 text-white' : ''}">
                        <i class="fas fa-align-${align === 'justify' ? 'justify' : align}"></i>
                        <div class="text-xs mt-1 capitalize">${align === 'justify' ? 'Rata' : align}</div>
                      </div>
                    </label>
                  `).join('')}
                </div>
              </div>
              
              <!-- Position -->
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  <i class="fas fa-arrows-alt mr-1"></i>Posisi Konten
                </label>
                <div class="grid grid-cols-3 gap-2">
                  ${[
            { val: 'top-left', icon: 'fa-arrow-up fa-arrow-left' },
            { val: 'top-center', icon: 'fa-arrow-up' },
            { val: 'top-right', icon: 'fa-arrow-up fa-arrow-right' },
            { val: 'middle-left', icon: 'fa-arrow-left' },
            { val: 'center', icon: 'fa-compress' },
            { val: 'middle-right', icon: 'fa-arrow-right' },
            { val: 'bottom-left', icon: 'fa-arrow-down fa-arrow-left' },
            { val: 'bottom-center', icon: 'fa-arrow-down' },
            { val: 'bottom-right', icon: 'fa-arrow-down fa-arrow-right' }
        ].map(pos => `
                    <label>
                      <input type="radio" name="edit-content-position" value="${pos.val}" class="hidden peer" ${position === pos.val ? 'checked' : ''}>
                      <div class="p-2 border rounded text-center cursor-pointer peer-checked:bg-blue-500 peer-checked:text-white hover:bg-blue-100 ${position === pos.val ? 'bg-blue-500 text-white' : ''}">
                        <i class="fas ${pos.icon}"></i>
                      </div>
                    </label>
                  `).join('')}
                </div>
              </div>
              
              <!-- Opacity -->
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  <i class="fas fa-adjust mr-1"></i>Transparansi BG (%)
                </label>
                <input type="range" id="edit-announcement-bg-opacity" class="w-full" min="0" max="100" value="${bgOpacity}" oninput="document.getElementById('edit-opacity-value').textContent = this.value">
                <div class="text-center text-sm text-gray-600">
                  <span id="edit-opacity-value">${bgOpacity}</span>%
                </div>
              </div>
              
              <!-- Preview -->
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  <i class="fas fa-eye mr-1"></i>Preview
                </label>
                <div id="edit-announcement-preview" class="w-full h-40 border-2 border-dashed border-gray-300 rounded-lg overflow-auto p-4" style="background: white;">
                  <p class="text-gray-400 italic">Preview pengumuman akan muncul di sini</p>
                </div>
              </div>
              
              <button onclick="updateEditAnnouncementPreview()" type="button" class="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600">
                <i class="fas fa-sync mr-2"></i> Update Preview
              </button>
            </div>
            
            <!-- Urutan & Status -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Urutan Tampilan</label>
                <input type="number" id="edit-content-order" value="${content.display_order || 0}" 
                       class="w-full p-2 border rounded" min="0">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select id="edit-content-active" class="w-full p-2 border rounded">
                  <option value="1" ${content.is_active ? 'selected' : ''}>Aktif</option>
                  <option value="0" ${!content.is_active ? 'selected' : ''}>Nonaktif</option>
                </select>
              </div>
            </div>
          </div>
          
          <div class="mt-6 flex justify-end space-x-3">
            <button onclick="closeEditModal()" class="px-4 py-2 border rounded text-gray-700 hover:bg-gray-50">
              Batal
            </button>
            <button onclick="updateContent(${content.id})" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
              <i class="fas fa-save mr-2"></i> Simpan Perubahan
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Setup event listeners untuk sync slider dan input
    setupEditModalListeners();

    // Update preview jika announcement
    if (isAnnouncement) {
        setTimeout(() => updateEditAnnouncementPreview(), 100);
    }
}

function setupEditModalListeners() {
    // Sync title font size
    const titleSlider = document.getElementById('edit-title-font-size');
    const titleInput = document.getElementById('edit-title-font-size-input');
    if (titleSlider && titleInput) {
        titleSlider.addEventListener('input', function () {
            titleInput.value = this.value;
            updateEditAnnouncementPreview();
        });
        titleInput.addEventListener('input', function () {
            titleSlider.value = this.value;
            updateEditAnnouncementPreview();
        });
    }

    // Sync desc font size
    const descSlider = document.getElementById('edit-desc-font-size');
    const descInput = document.getElementById('edit-desc-font-size-input');
    if (descSlider && descInput) {
        descSlider.addEventListener('input', function () {
            descInput.value = this.value;
            updateEditAnnouncementPreview();
        });
        descInput.addEventListener('input', function () {
            descSlider.value = this.value;
            updateEditAnnouncementPreview();
        });
    }

    // Color pickers
    const colorPicker = document.getElementById('edit-announcement-color');
    const colorHex = document.getElementById('edit-announcement-color-hex');
    if (colorPicker && colorHex) {
        colorPicker.addEventListener('input', function () {
            colorHex.value = this.value;
            updateEditAnnouncementPreview();
        });
        colorHex.addEventListener('change', function () {
            colorPicker.value = this.value;
            updateEditAnnouncementPreview();
        });
    }

    const bgColorPicker = document.getElementById('edit-announcement-bg-color');
    const bgColorHex = document.getElementById('edit-announcement-bg-color-hex');
    if (bgColorPicker && bgColorHex) {
        bgColorPicker.addEventListener('input', function () {
            bgColorHex.value = this.value;
            updateEditAnnouncementPreview();
        });
        bgColorHex.addEventListener('change', function () {
            bgColorPicker.value = this.value;
            updateEditAnnouncementPreview();
        });
    }

    // Checkboxes dan radio buttons
    ['edit-announcement-bold', 'edit-announcement-italic', 'edit-announcement-underline'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateEditAnnouncementPreview);
    });

    document.querySelectorAll('input[name="edit-text-align"]').forEach(el => {
        el.addEventListener('change', updateEditAnnouncementPreview);
    });

    document.querySelectorAll('input[name="edit-content-position"]').forEach(el => {
        el.addEventListener('change', updateEditAnnouncementPreview);
    });

    // Text inputs
    const annText = document.getElementById('edit-announcement-text');
    if (annText) annText.addEventListener('input', updateEditAnnouncementPreview);

    const titleEl = document.getElementById('edit-content-title');
    if (titleEl) titleEl.addEventListener('input', updateEditAnnouncementPreview);
}

function updateEditAnnouncementPreview() {
    const preview = document.getElementById('edit-announcement-preview');
    if (!preview) return;

    const title = document.getElementById('edit-content-title')?.value || 'Judul Pengumuman';
    const announcementText = document.getElementById('edit-announcement-text')?.value || '';

    const fontFamily = document.getElementById('edit-announcement-font')?.value || 'Inter';
    const color = document.getElementById('edit-announcement-color')?.value || '#000000';
    const bgColor = document.getElementById('edit-announcement-bg-color')?.value || '#ffffff';
    const opacity = document.getElementById('edit-announcement-bg-opacity')?.value || 100;
    const titleFontSize = document.getElementById('edit-title-font-size')?.value || 24;
    const descFontSize = document.getElementById('edit-desc-font-size')?.value || 16;
    const bold = document.getElementById('edit-announcement-bold')?.checked ? 'bold' : 'normal';
    const italic = document.getElementById('edit-announcement-italic')?.checked ? 'italic' : 'normal';
    const underline = document.getElementById('edit-announcement-underline')?.checked ? 'underline' : 'none';
    const textAlign = document.querySelector('input[name="edit-text-align"]:checked')?.value || 'center';
    const position = document.querySelector('input[name="edit-content-position"]:checked')?.value || 'center';

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

    const r = parseInt(bgColor.slice(1, 3), 16);
    const g = parseInt(bgColor.slice(3, 5), 16);
    const b = parseInt(bgColor.slice(5, 7), 16);
    const bgColorWithOpacity = `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;

    preview.innerHTML = `
    <div style="display: flex; width: 100%; height: 100%; justify-content: ${justifyContent}; align-items: ${alignItems}; background: ${bgColorWithOpacity}; padding: 20px; box-sizing: border-box;">
      <div style="max-width: 90%; max-height: 90%; overflow: auto;">
        <div style="text-align: ${textAlign};">
          <div style="font-family: '${fontFamily}', sans-serif; font-size: ${titleFontSize}px; font-weight: ${bold}; font-style: ${italic}; text-decoration: ${underline}; color: ${color}; margin-bottom: 10px;">
            ${title}
          </div>
          ${announcementText ? `
            <div style="font-family: '${fontFamily}', sans-serif; font-size: ${descFontSize}px; color: ${color}; margin-top: 15px; padding-top: 10px; border-top: 1px dashed #ccc;">
              ${announcementText.replace(/\n/g, '<br>')}
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

function populateEditForm(content) {
    document.getElementById('edit-content-title').value = content.title || '';
    document.getElementById('edit-content-description').value = content.content_text || '';
    document.getElementById('edit-content-type').value = content.content_type || 'text';
    document.getElementById('edit-content-order').value = content.display_order || 0;
    document.getElementById('edit-content-active').value = content.is_active ? '1' : '0';

    toggleEditFileSection();
}

function toggleEditFileSection() {
    const contentType = document.getElementById('edit-content-type')?.value;
    const fileSection = document.getElementById('edit-file-section');
    const announcementSettings = document.getElementById('edit-announcement-settings');

    if (fileSection) {
        fileSection.classList.toggle('hidden', contentType === 'announcement' || contentType === 'text');
    }

    if (announcementSettings) {
        announcementSettings.classList.toggle('hidden', contentType !== 'announcement' && contentType !== 'text');
    }

    // Update accept attribute
    const fileInput = document.getElementById('edit-content-file');
    if (fileInput) {
        fileInput.accept = contentType === 'image' ? 'image/*' : 'video/*';
    }
}

function closeEditModal() {
    const modal = document.getElementById('edit-content-modal');
    if (modal) {
        modal.remove();
    }
}

async function updateContent(id) {
    const title = document.getElementById('edit-content-title')?.value;
    const content_type = document.getElementById('edit-content-type')?.value;
    const display_order = document.getElementById('edit-content-order')?.value;
    const is_active = document.getElementById('edit-content-active')?.value === '1';

    if (!title?.trim()) {
        showToast('Judul konten diperlukan', 'warning');
        return;
    }

    const updateData = {
        title: title.trim(),
        content_type,
        display_order: parseInt(display_order) || 0,
        is_active
    };

    // Handle announcement type
    if (content_type === 'announcement' || content_type === 'text') {
        const announcementText = document.getElementById('edit-announcement-text')?.value || '';
        const fontFamily = document.getElementById('edit-announcement-font')?.value || 'Inter';
        const titleFontSize = document.getElementById('edit-title-font-size')?.value || 24;
        const descFontSize = document.getElementById('edit-desc-font-size')?.value || 16;
        const color = document.getElementById('edit-announcement-color')?.value || '#000000';
        const bgColor = document.getElementById('edit-announcement-bg-color')?.value || '#ffffff';
        const bgOpacity = document.getElementById('edit-announcement-bg-opacity')?.value || 100;
        const bold = document.getElementById('edit-announcement-bold')?.checked || false;
        const italic = document.getElementById('edit-announcement-italic')?.checked || false;
        const underline = document.getElementById('edit-announcement-underline')?.checked || false;
        const textAlign = document.querySelector('input[name="edit-text-align"]:checked')?.value || 'center';
        const position = document.querySelector('input[name="edit-content-position"]:checked')?.value || 'center';

        const announcementData = {
            text: announcementText,
            font_family: fontFamily,
            title_font_size: parseInt(titleFontSize) || 24,
            desc_font_size: parseInt(descFontSize) || 16,
            color: color,
            bg_color: bgColor,
            bg_opacity: parseInt(bgOpacity) || 100,
            bold: bold,
            italic: italic,
            underline: underline,
            text_align: textAlign,
            position: position
        };

        updateData.content_text = JSON.stringify(announcementData);
        updateData.description = document.getElementById('edit-content-description')?.value || '';
    } else {
        // Untuk tipe lain, gunakan content_text biasa
        updateData.content_text = document.getElementById('edit-content-description')?.value || '';
    }

    // Handle file upload jika ada file baru (untuk image/video)
    const fileInput = document.getElementById('edit-content-file');
    if ((content_type === 'image' || content_type === 'video') && fileInput?.files[0]) {
        try {
            showToast('🔄 Mengupload file...', 'info');

            const formData = new FormData();
            formData.append('file', fileInput.files[0]);

            const uploadResponse = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const uploadResult = await uploadResponse.json();
            if (!uploadResponse.ok) {
                throw new Error(uploadResult.error || 'Gagal upload file');
            }

            updateData.image_url = uploadResult.type === 'image' ? uploadResult.filePath : null;
            updateData.video_url = uploadResult.type === 'video' ? uploadResult.filePath : null;
        } catch (error) {
            console.error('Error uploading file:', error);
            showToast('Gagal upload file: ' + error.message, 'error');
            return;
        }
    }

    try {
        showToast('⏳ Menyimpan perubahan...', 'info');

        const response = await fetch(`/api/content/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });

        const result = await response.json();

        if (response.ok) {
            showToast('✅ Konten berhasil diperbarui', 'success');
            closeEditModal();
            loadContent();
            updatePreview();
        } else {
            showToast(result.error || 'Gagal memperbarui konten', 'error');
        }
    } catch (error) {
        console.error('Error updating content:', error);
        showToast('Koneksi error. Coba lagi.', 'error');
    }
}

async function deleteContent(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus konten ini?')) {
        return;
    }

    try {
        // Ambil data konten dulu untuk mendapatkan file path jika ada
        const getResponse = await fetch(`/api/content/${id}`);
        if (getResponse.ok) {
            const contentData = await getResponse.json();
            const content = contentData.data;

            // TODO: Implementasi hapus file dari server jika diperlukan
            // Note: Untuk produksi, perlu endpoint DELETE yang juga menghapus file
        }

        const response = await fetch(`/api/content/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('Konten berhasil dihapus', 'success');
            loadContent();
            updatePreview();
        } else {
            showToast('Gagal menghapus konten', 'error');
        }
    } catch (error) {
        console.error('Error deleting content:', error);
        showToast('Gagal menghapus konten', 'error');
    }
}

// Fungsi untuk manajemen events
async function loadEvents() {
    try {
        // Tampilkan loading
        const loadingEl = document.getElementById('events-loading');
        const tableEl = document.getElementById('events-table');
        const totalEl = document.getElementById('event-total');

        if (loadingEl) loadingEl.classList.remove('hidden');
        if (tableEl) tableEl.innerHTML = '';

        console.log('📥 Loading events...');

        const response = await fetch('/api/events');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('📊 Events response:', result);

        if (!result.success) {
            throw new Error(result.error || 'Failed to load events');
        }

        // Filter: Hanya tampilkan event yang belum lewat (hari ini atau mendatang)
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset jam ke 00:00

        const allEvents = result.data || [];
        const activeEvents = allEvents.filter(event => {
            if (!event.target_date) return false;
            const eventDate = new Date(event.target_date);
            eventDate.setHours(0, 0, 0, 0);
            // Tampilkan hanya event yang >= hari ini
            return eventDate >= today;
        });

        eventsData = activeEvents; // Simpan ke global variable

        // Sembunyikan loading
        if (loadingEl) loadingEl.classList.add('hidden');

        // Update total count
        if (totalEl) totalEl.textContent = activeEvents.length;

        if (!tableEl) {
            console.error('Events table element not found');
            return;
        }

        tableEl.innerHTML = '';

        if (activeEvents.length === 0) {
            tableEl.innerHTML = `
                <tr>
                    <td colspan="6" class="p-4 text-center text-gray-500">
                        <div class="flex flex-col items-center py-8">
                            <i class="fas fa-calendar-times text-4xl text-gray-300 mb-3"></i>
                            <p>Tidak ada event aktif.</p>
                            <p class="text-sm text-gray-400 mt-1">Event yang sudah lewat akan otomatis terhapus.</p>
                            <button onclick="showEventForm()" class="mt-3 text-blue-600 hover:text-blue-800">
                                <i class="fas fa-plus mr-1"></i> Tambah event baru
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        // Urutkan events berdasarkan tanggal (terdekat ke terakhir)
        const sortedEvents = [...activeEvents].sort((a, b) =>
            new Date(a.target_date) - new Date(b.target_date)
        );

        sortedEvents.forEach((event, index) => {
            // --- 1. VALIDASI TANGGAL ---
            const targetDate = new Date(event.target_date);
            const isValidDate = event.target_date && !isNaN(targetDate.getTime());

            // --- 2. SIAPKAN VARIABEL TAMPILAN ---
            let dateDisplay = '<span class="text-red-500 italic">Tanggal Invalid</span>';
            let timeDisplay = '';
            let daysClass = 'bg-gray-100 text-gray-800';
            let daysText = '-';

            // --- 3. JIKA TANGGAL VALID, HITUNG LOGIKA ---
            if (isValidDate) {
                // Format Tanggal
                try {
                    dateDisplay = targetDate.toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                    });

                    timeDisplay = targetDate.toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                } catch (e) {
                    console.error('Error formatting date:', e);
                }

                // Hitung Sisa Hari
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const dateOnly = new Date(targetDate);
                dateOnly.setHours(0, 0, 0, 0);

                const timeDiff = dateOnly.getTime() - today.getTime();
                const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));

                daysText = `${daysLeft} hari`;

                // Tentukan Warna Badge
                if (daysLeft < 0) {
                    daysClass = 'bg-gray-200 text-gray-600'; // Seharusnya sudah terhapus, tapi jaga-jaga
                    daysText = 'Selesai';
                } else if (daysLeft === 0) {
                    daysClass = 'bg-purple-100 text-purple-800 font-bold'; // Hari H
                    daysText = 'HARI INI';
                } else if (daysLeft <= 3) {
                    daysClass = 'bg-red-100 text-red-800'; // < 3 hari
                } else if (daysLeft <= 7) {
                    daysClass = 'bg-orange-100 text-orange-800'; // Seminggu
                } else {
                    daysClass = 'bg-green-100 text-green-800'; // Masih lama
                }
            }

            // --- 4. RENDER HTML ---
            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-gray-50';
            row.dataset.eventId = event.id;

            row.innerHTML = `
                <td class="p-3 text-sm text-gray-600">${index + 1}</td>
                <td class="p-3">
                    <div class="font-medium text-gray-900">${escapeHTML(event.title) || '(Tanpa Judul)'}</div>
                    ${event.description ?
                    `<div class="text-xs text-gray-500 truncate max-w-xs mt-0.5" title="${escapeHTML(event.description)}">
                            ${escapeHTML(event.description)}
                        </div>` : ''}
                </td>
                <td class="p-3">
                    <div class="font-medium">${dateDisplay}</div>
                    ${isValidDate ? `<div class="text-xs text-gray-500">${timeDisplay}</div>` : ''}
                </td>
                <td class="p-3">
                    <span class="px-2 py-1 rounded-full text-xs font-medium ${daysClass}">
                        ${daysText}
                    </span>
                </td>
                <td class="p-3">
                    <span class="px-2 py-1 rounded-full text-xs font-medium ${event.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        ${event.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                </td>
                <td class="p-3">
                    <div class="flex items-center space-x-2">
                        <button onclick="editEvent(${event.id})" 
                                class="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition" 
                                title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteEvent(${event.id})" 
                                class="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition" 
                                title="Hapus">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tableEl.appendChild(row);
        });

        // Setup filter dan search
        setupEventFilters(sortedEvents);

    } catch (error) {
        console.error('❌ Error loading events:', error);

        const loadingEl = document.getElementById('events-loading');
        if (loadingEl) loadingEl.classList.add('hidden');

        const tableEl = document.getElementById('events-table');
        if (tableEl) {
            tableEl.innerHTML = `
                <tr>
                    <td colspan="6" class="p-4 text-center text-red-500">
                        <div class="flex flex-col items-center py-8">
                            <i class="fas fa-exclamation-triangle text-4xl text-red-300 mb-3"></i>
                            <p class="font-medium">Gagal memuat events</p>
                            <p class="text-sm text-gray-500 mt-1">${error.message}</p>
                            <button onclick="loadEvents()" class="mt-3 text-blue-600 hover:text-blue-800">
                                <i class="fas fa-sync mr-1"></i> Coba lagi
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }

        showToast('Gagal memuat events: ' + error.message, 'error');
    }
}

function setupEventFilters(events) {
    const searchInput = document.getElementById('event-search');
    const statusFilter = document.getElementById('event-filter-status');

    if (searchInput) {
        // Hapus event listener lama jika ada
        const newSearchInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);

        newSearchInput.addEventListener('input', debounce(function () {
            filterEvents(events);
        }, 300));
    }

    if (statusFilter) {
        // Hapus event listener lama jika ada
        const newStatusFilter = statusFilter.cloneNode(true);
        statusFilter.parentNode.replaceChild(newStatusFilter, statusFilter);

        newStatusFilter.addEventListener('change', function () {
            filterEvents(events);
        });
    }
}

function filterEvents(allEvents) {
    const searchTerm = document.getElementById('event-search')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('event-filter-status')?.value || 'all';

    // Filter events berdasarkan search term dan status
    const filtered = allEvents.filter(event => {
        // Filter by search
        const matchesSearch = !searchTerm ||
            (event.title && event.title.toLowerCase().includes(searchTerm)) ||
            (event.description && event.description.toLowerCase().includes(searchTerm));

        // Filter by status
        let matchesStatus = true;
        if (statusFilter === 'active') matchesStatus = event.is_active === true;
        if (statusFilter === 'inactive') matchesStatus = event.is_active === false;

        return matchesSearch && matchesStatus;
    });

    // Update tabel dengan hasil filter
    updateEventsTable(filtered);

    // Tampilkan info filter
    const filterInfo = document.getElementById('filter-info');
    if (filterInfo) {
        if (searchTerm || statusFilter !== 'all') {
            const filters = [];
            if (searchTerm) filters.push(`"${searchTerm}"`);
            if (statusFilter === 'active') filters.push('Aktif');
            if (statusFilter === 'inactive') filters.push('Nonaktif');

            filterInfo.classList.remove('hidden');
        } else {
            filterInfo.classList.add('hidden');
        }
    }
}

function updateEventsTable(events) {
    const tableBody = document.getElementById('events-table');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (events.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="p-4 text-center text-gray-500">
                    <div class="flex flex-col items-center py-8">
                        <i class="fas fa-calendar-times text-4xl text-gray-300 mb-3"></i>
                        <p>Tidak ada event yang sesuai dengan filter.</p>
                        <button onclick="document.getElementById('event-search').value = ''; document.getElementById('event-filter-status').value = 'all'; loadEvents();" 
                                class="mt-3 text-blue-600 hover:text-blue-800">
                            <i class="fas fa-undo mr-1"></i> Reset Filter
                        </button>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    events.forEach((event, index) => {
        // Buat object Date dari target_date
        const targetDate = new Date(event.target_date);

        // Buat object Date untuk hari ini (tanpa waktu)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Set targetDate ke tengah malam untuk perbandingan yang akurat
        const targetDateOnly = new Date(targetDate);
        targetDateOnly.setHours(0, 0, 0, 0);

        // Hitung selisih hari
        const timeDiff = targetDateOnly.getTime() - today.getTime();
        const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));

        // Tentukan class dan teks untuk sisa hari
        let daysClass = 'bg-green-100 text-green-800';
        let daysText = `${daysLeft} hari lagi`;
        let daysIcon = 'fa-calendar-check';

        if (daysLeft < 0) {
            daysClass = 'bg-gray-100 text-gray-800';
            daysText = 'Terlewat';
            daysIcon = 'fa-calendar-times';
        } else if (daysLeft === 0) {
            daysClass = 'bg-purple-100 text-purple-800';
            daysText = 'Hari Ini';
            daysIcon = 'fa-calendar-day';
        } else if (daysLeft <= 7) {
            daysClass = 'bg-red-100 text-red-800';
            daysIcon = 'fa-exclamation-circle';
        } else if (daysLeft <= 30) {
            daysClass = 'bg-yellow-100 text-yellow-800';
            daysIcon = 'fa-clock';
        }

        // Format tanggal untuk display
        const formattedDate = targetDate.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        // Format waktu (jika ada)
        const hasTime = targetDate.getHours() !== 0 || targetDate.getMinutes() !== 0;
        const timeStr = hasTime ? targetDate.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        }) : '';

        // Buat row element
        const row = document.createElement('tr');
        row.className = 'border-b hover:bg-gray-50 transition';
        row.dataset.eventId = event.id;

        row.innerHTML = `
            <td class="p-3 text-sm text-gray-600 font-mono">${String(index + 1).padStart(2, '0')}</td>
            
            <td class="p-3">
                <div class="font-medium text-gray-800">${escapeHTML(event.title) || '-'}</div>
                ${event.description ? `
                    <div class="text-xs text-gray-500 truncate max-w-xs mt-1" title="${escapeHTML(event.description)}">
                        <i class="fas fa-align-left mr-1 text-gray-400"></i>
                        ${escapeHTML(event.description.substring(0, 50))}${event.description.length > 50 ? '...' : ''}
                    </div>
                ` : ''}
                <div class="text-xs text-gray-400 mt-1">
                    <i class="far fa-clock mr-1"></i>
                    ID: ${event.id}
                </div>
            </td>
            
            <td class="p-3">
                <div class="font-medium">${formattedDate}</div>
                ${timeStr ? `<div class="text-xs text-gray-500"><i class="far fa-clock mr-1"></i>${timeStr}</div>` : ''}
                <div class="text-xs text-gray-400 mt-1">
                    <i class="far fa-calendar-alt mr-1"></i>
                    ${targetDate.toLocaleDateString('id-ID', { weekday: 'long' })}
                </div>
            </td>
            
            <td class="p-3">
                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${daysClass}">
                    <i class="fas ${daysIcon} mr-1"></i>
                    ${daysText}
                </span>
                ${daysLeft < 0 ? `
                    <div class="text-xs text-gray-400 mt-1">
                        ${Math.abs(daysLeft)} hari yang lalu
                    </div>
                ` : ''}
            </td>
            
            <td class="p-3">
                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${event.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                    <i class="fas ${event.is_active ? 'fa-check-circle' : 'fa-times-circle'} mr-1"></i>
                    ${event.is_active ? 'Aktif' : 'Nonaktif'}
                </span>
            </td>
            
            <td class="p-3">
                <div class="flex items-center space-x-2">
                    <button onclick="editEvent(${event.id})" 
                            class="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50 transition group relative"
                            title="Edit event">
                        <i class="fas fa-edit"></i>
                        <span class="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                            Edit
                        </span>
                    </button>
                    
                    <button onclick="toggleEventStatus(${event.id}, ${!event.is_active})" 
                            class="text-gray-600 hover:text-gray-800 p-2 rounded-lg hover:bg-gray-50 transition group relative"
                            title="${event.is_active ? 'Nonaktifkan' : 'Aktifkan'}">
                        <i class="fas ${event.is_active ? 'fa-eye-slash' : 'fa-eye'}"></i>
                        <span class="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                            ${event.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        </span>
                    </button>
                    
                    <button onclick="deleteEvent(${event.id})" 
                            class="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition group relative"
                            title="Hapus event">
                        <i class="fas fa-trash"></i>
                        <span class="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                            Hapus
                        </span>
                    </button>
                </div>
            </td>
        `;

        tableBody.appendChild(row);
    });

    // Update total count di footer
    const totalEl = document.getElementById('event-total');
    if (totalEl) {
        totalEl.textContent = events.length;
    }

    // Update filter info (opsional)
    const filterInfo = document.getElementById('filter-info');
    if (filterInfo) {
        const searchTerm = document.getElementById('event-search')?.value;
        const statusFilter = document.getElementById('event-filter-status')?.value;

        if (searchTerm || statusFilter !== 'all') {
            let filterText = 'Filter: ';
            const filters = [];
            if (searchTerm) filters.push(`pencarian "${searchTerm}"`);
            if (statusFilter === 'active') filters.push('status Aktif');
            if (statusFilter === 'inactive') filters.push('status Nonaktif');

            filterInfo.innerHTML = `
                <div class="text-sm text-gray-500 mb-2">
                    <i class="fas fa-filter mr-1"></i>
                    ${filters.join(', ')} 
                    <span class="font-medium">(${events.length} hasil)</span>
                    <button onclick="document.getElementById('event-search').value = ''; document.getElementById('event-filter-status').value = 'all'; loadEvents();" 
                            class="ml-2 text-blue-600 hover:text-blue-800 text-xs">
                        <i class="fas fa-times mr-1"></i>Reset
                    </button>
                </div>
            `;
        } else {
            filterInfo.innerHTML = '';
        }
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

const IQOMAH_DEFAULT_RUNNING_TEXT = [
    "🔊 Mohon tenang, matikan HP atau mode silent",
    "⭐ Rapatkan dan luruskan shaf",
    "📿 Semoga ibadah kita diterima Allah SWT"
];

async function loadIqomahRunningText() {
    try {
        console.log('🔄 Loading running text IQOMAH dari API khusus...');

        // GUNAKAN API KHUSUS IQOMAH - TIDAK MENGGANGGU RUNNING TEXT UMUM
        const response = await fetch('/api/iqomah-running-text');
        if (!response.ok) throw new Error('Failed to fetch iqomah running text');

        const result = await response.json();
        const allTexts = result.data || [];

        // Filter hanya yang aktif
        const iqomahTexts = allTexts.filter(t => t.is_active == 1 || t.is_active === true);

        const textArea = document.getElementById('iqomah-running-text-content');
        const fontSelect = document.getElementById('iqomah-running-font');
        const fontSizeInput = document.getElementById('iqomah-running-font-size');
        const speedInput = document.getElementById('iqomah-running-speed');

        if (iqomahTexts.length > 0) {
            // Gabungkan teks dengan newline
            const combinedText = iqomahTexts.map(t => t.text).join('\n');
            if (textArea) textArea.value = combinedText;

            // Gunakan setting dari teks pertama
            const firstItem = iqomahTexts[0];
            if (fontSelect) fontSelect.value = firstItem.font_family || 'Inter';
            if (fontSizeInput) fontSizeInput.value = firstItem.font_size || 16;
            if (speedInput) speedInput.value = firstItem.speed || 30;
        } else {
            // Isi dengan default jika kosong
            if (textArea) textArea.value = IQOMAH_DEFAULT_RUNNING_TEXT.join('\n');
            if (fontSelect) fontSelect.value = 'Inter';
            if (fontSizeInput) fontSizeInput.value = 16;
            if (speedInput) speedInput.value = 30;
        }

        updateIqomahRunningTextPreview();
        console.log(`✅ Running text IQOMAH loaded: ${iqomahTexts.length} texts`);

    } catch (error) {
        console.error('Error loading iqomah running text:', error);
        // Isi dengan default jika error
        const textArea = document.getElementById('iqomah-running-text-content');
        if (textArea) textArea.value = IQOMAH_DEFAULT_RUNNING_TEXT.join('\n');
    }
}

function updateIqomahRunningTextPreview() {
    const text = document.getElementById('iqomah-running-text-content')?.value || '';
    const font = document.getElementById('iqomah-running-font')?.value || 'Inter';
    const fontSize = document.getElementById('iqomah-running-font-size')?.value || 16;

    const preview = document.getElementById('iqomah-preview-text');
    if (preview) {
        const firstLine = text.split('\n')[0] || 'Preview teks...';
        preview.textContent = firstLine;
        preview.style.fontFamily = font;
        preview.style.fontSize = `${fontSize}px`;
    }
}

function setupIqomahRunningTextListeners() {
    const textArea = document.getElementById('iqomah-running-text-content');
    const fontSelect = document.getElementById('iqomah-running-font');
    const fontSizeInput = document.getElementById('iqomah-running-font-size');
    const speedInput = document.getElementById('iqomah-running-speed');

    if (textArea) {
        textArea.addEventListener('input', updateIqomahRunningTextPreview);
    }
    if (fontSelect) {
        fontSelect.addEventListener('change', updateIqomahRunningTextPreview);
    }
    if (fontSizeInput) {
        fontSizeInput.addEventListener('input', updateIqomahRunningTextPreview);
    }
    if (speedInput) {
        speedInput.addEventListener('change', updateIqomahRunningTextPreview);
    }
}

async function saveIqomahRunningText() {
    const textArea = document.getElementById('iqomah-running-text-content');
    const font = document.getElementById('iqomah-running-font')?.value || 'Inter';
    const fontSize = document.getElementById('iqomah-running-font-size')?.value || 16;
    const speed = document.getElementById('iqomah-running-speed')?.value || 30;

    const rawText = textArea?.value || '';

    if (!rawText.trim()) {
        showToast('Harap masukkan teks!', 'warning');
        return;
    }

    // Pecah teks berdasarkan Enter/Baris Baru
    const textLines = rawText.split('\n').filter(line => line.trim() !== '');

    if (textLines.length === 0) return;

    showToast('⏳ Menyimpan running text IQOMAH...', 'info');

    try {
        // --- LANGKAH 1: Hapus SEMUA data lama dari tabel IQOMAH_RUNNING_TEXT ---
        // TIDAK MENYENTUH TABEL RUNNING_TEXT

        const getRes = await fetch('/api/iqomah-running-text');
        const getData = await getRes.json();
        const oldTexts = getData.data || [];

        // Hapus semua dari tabel iqomah_running_text
        const deletePromises = oldTexts.map(item =>
            fetch(`/api/iqomah-running-text/${item.id}`, { method: 'DELETE' })
        );

        await Promise.all(deletePromises);

        // --- LANGKAH 2: Simpan data baru per baris ke IQOMAH_RUNNING_TEXT ---
        const savePromises = textLines.map((lineText, index) => {
            return fetch('/api/iqomah-running-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: lineText.trim(),
                    font_family: font,
                    font_size: parseInt(fontSize),
                    speed: parseInt(speed),
                    is_active: true,
                    display_order: index // Urutan penting untuk iqomah
                })
            });
        });

        await Promise.all(savePromises);

        window._lastUpdateTimestamp = Date.now();
        showToast('✅ Running text IQOMAH berhasil disimpan!', 'success');

        // Refresh preview
        updatePreview();

    } catch (error) {
        console.error('Error saving iqomah running text:', error);
        showToast('Gagal menyimpan running text iqomah', 'error');
    }
}

function resetIqomahRunningText() {
    const textArea = document.getElementById('iqomah-running-text-content');
    const fontSelect = document.getElementById('iqomah-running-font');
    const fontSizeInput = document.getElementById('iqomah-running-font-size');
    const speedInput = document.getElementById('iqomah-running-speed');

    if (textArea) textArea.value = IQOMAH_DEFAULT_RUNNING_TEXT.join('\n');
    if (fontSelect) fontSelect.value = 'Inter';
    if (fontSizeInput) fontSizeInput.value = 16;
    if (speedInput) speedInput.value = 30;

    updateIqomahRunningTextPreview();
    showToast('Running text IQOMAH direset ke default. Klik simpan untuk menerapkan.', 'info');
}

function setupIqomahRunningTextListeners() {
    const textArea = document.getElementById('iqomah-running-text-content');
    const fontSelect = document.getElementById('iqomah-running-font');
    const fontSizeInput = document.getElementById('iqomah-running-font-size');
    const speedInput = document.getElementById('iqomah-running-speed');

    if (textArea) {
        textArea.addEventListener('input', updateIqomahRunningTextPreview);
    }
    if (fontSelect) {
        fontSelect.addEventListener('change', updateIqomahRunningTextPreview);
    }
    if (fontSizeInput) {
        fontSizeInput.addEventListener('input', updateIqomahRunningTextPreview);
    }
    if (speedInput) {
        speedInput.addEventListener('change', updateIqomahRunningTextPreview);
    }
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function refreshEvents() {
    loadEvents();
    showToast('Data events direfresh', 'info');
}

async function toggleEventStatus(id, newStatus) {
    try {
        // Tampilkan konfirmasi
        if (!confirm(`Apakah Anda yakin ingin ${newStatus ? 'mengaktifkan' : 'menonaktifkan'} event ini?`)) {
            return;
        }

        showToast('⏳ Mengubah status event...', 'info');

        // Ambil data event terlebih dahulu
        const getResponse = await fetch(`/api/events/${id}`);
        if (!getResponse.ok) {
            throw new Error('Gagal mengambil data event');
        }

        const getResult = await getResponse.json();
        const event = getResult.data;

        if (!event) {
            throw new Error('Event tidak ditemukan');
        }

        // Update status
        window._lastUpdateTimestamp = Date.now();

        const response = await fetch(`/api/events/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: event.title,
                description: event.description,
                target_date: event.target_date,
                is_active: newStatus
            })
        });

        const result = await response.json();

        if (response.ok) {
            showToast(`✅ Event berhasil ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}`, 'success');
            loadEvents(); // Refresh tabel
            updatePreview();
        } else {
            showToast(result.error || `Gagal ${newStatus ? 'mengaktifkan' : 'menonaktifkan'} event`, 'error');
        }
    } catch (error) {
        console.error('Error toggling event status:', error);
        showToast('Koneksi error. Coba lagi.', 'error');
    }
}

async function saveEvent() {
    const title = document.getElementById('event-title')?.value;
    const description = document.getElementById('event-description')?.value;
    const target_date = document.getElementById('event-date')?.value;
    const is_active = document.getElementById('event-is-active')?.value === '1';

    if (!title?.trim() || !target_date) {
        showToast('Judul dan tanggal target diperlukan', 'warning');
        return;
    }

    // Validasi tanggal
    const selectedDate = new Date(target_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
        if (!confirm('Tanggal yang dipilih sudah lewat. Tetap simpan?')) {
            return;
        }
    }

    try {
        showToast('⏳ Menyimpan event...', 'info');

        // Set timestamp sebelum request
        window._lastUpdateTimestamp = Date.now();

        const response = await fetch('/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: title.trim(),
                description: description?.trim() || null,
                target_date,
                is_active
            })
        });

        const result = await response.json();

        if (response.ok) {
            showToast('✅ Event berhasil ditambahkan', 'success');
            hideEventForm();
            resetEventForm();
            loadEvents(); // Refresh daftar event
            updatePreview();
        } else {
            showToast(result.error || 'Gagal menambahkan event', 'error');
        }
    } catch (error) {
        console.error('Error saving event:', error);
        showToast('Koneksi error. Coba lagi.', 'error');
    }
}

function resetEventForm() {
    document.getElementById('event-title').value = '';
    document.getElementById('event-description').value = '';
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('event-date').value = tomorrow.toISOString().split('T')[0];
}

async function editEvent(id) {
    try {
        showToast('🔄 Memuat data event...', 'info');

        // Ambil data event dari API
        const response = await fetch(`/api/events/${id}`);
        if (!response.ok) {
            throw new Error('Gagal mengambil data event');
        }

        const result = await response.json();
        const event = result.data;

        if (!event) {
            showToast('Event tidak ditemukan', 'error');
            return;
        }

        // Tampilkan modal edit
        const modal = document.getElementById('edit-event-modal');
        if (!modal) {
            // Buat modal jika belum ada
            createEditEventModal(event);
        } else {
            // Isi data ke form edit
            populateEditEventForm(event);
            modal.classList.remove('hidden');
        }

    } catch (error) {
        console.error('Error editing event:', error);
        showToast('Gagal memuat data event', 'error');
    }
}

function createEditEventModal(event) {
    const modalHTML = `
        <div id="edit-event-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div class="p-6">
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-xl font-bold">Edit Event</h3>
                        <button onclick="closeEditEventModal()" class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Judul Event</label>
                            <input type="text" id="edit-event-title" value="${event.title || ''}" 
                                   class="w-full p-2 border rounded" placeholder="Contoh: Maulid Nabi Muhammad SAW">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
                            <textarea id="edit-event-description" rows="3" 
                                      class="w-full p-2 border rounded" placeholder="Deskripsi event...">${event.description || ''}</textarea>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Tanggal Target</label>
                            <input type="date" id="edit-event-date" value="${event.target_date ? event.target_date.split('T')[0] : ''}" 
                                   class="w-full p-2 border rounded">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select id="edit-event-active" class="w-full p-2 border rounded">
                                <option value="1" ${event.is_active ? 'selected' : ''}>Aktif</option>
                                <option value="0" ${!event.is_active ? 'selected' : ''}>Nonaktif</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="mt-6 flex justify-end space-x-3">
                        <button onclick="closeEditEventModal()" class="px-4 py-2 border rounded text-gray-700 hover:bg-gray-50">
                            Batal
                        </button>
                        <button onclick="updateEvent(${event.id})" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                            Simpan Perubahan
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Set editingEventId
    editingEventId = event.id;
}

async function deleteEvent(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus event ini?')) {
        return;
    }

    try {
        const response = await fetch(`/api/events/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('Event berhasil dihapus', 'success');
            loadEvents();
            updatePreview();
        } else {
            showToast('Gagal menghapus event', 'error');
        }
    } catch (error) {
        console.error('Error deleting event:', error);
        showToast('Gagal menghapus event', 'error');
    }
}

function populateEditEventForm(event) {
    document.getElementById('edit-event-title').value = event.title || '';
    document.getElementById('edit-event-description').value = event.description || '';
    document.getElementById('edit-event-date').value = event.target_date ? event.target_date.split('T')[0] : '';
    document.getElementById('edit-event-active').value = event.is_active ? '1' : '0';

    editingEventId = event.id;
}

function closeEditEventModal() {
    const modal = document.getElementById('edit-event-modal');
    if (modal) {
        modal.remove();
    }
    editingEventId = null;
}

async function updateEvent(id) {
    const title = document.getElementById('edit-event-title')?.value;
    const description = document.getElementById('edit-event-description')?.value;
    const target_date = document.getElementById('edit-event-date')?.value;
    const is_active = document.getElementById('edit-event-active')?.value === '1';

    if (!title?.trim() || !target_date) {
        showToast('Judul dan tanggal target diperlukan', 'warning');
        return;
    }

    try {
        showToast('⏳ Menyimpan perubahan...', 'info');

        // Set timestamp untuk mencegah notif ganda
        window._lastUpdateTimestamp = Date.now();

        const response = await fetch(`/api/events/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                description: description || null,
                target_date,
                is_active
            })
        });

        const result = await response.json();

        if (response.ok) {
            showToast('✅ Event berhasil diperbarui', 'success');
            closeEditEventModal();
            loadEvents(); // Refresh daftar event
            updatePreview();
        } else {
            showToast(result.error || 'Gagal memperbarui event', 'error');
        }
    } catch (error) {
        console.error('Error updating event:', error);
        showToast('Koneksi error. Coba lagi.', 'error');
    }
}

// Fungsi untuk manajemen iqomah
async function loadIqomahSettings() {
    try {
        const response = await fetch('/api/iqomah-times');
        if (!response.ok) throw new Error('Failed to fetch iqomah settings');

        const result = await response.json();
        const iqomahs = result.data || [];

        // Update form inputs untuk waktu iqomah
        iqomahs.forEach(iqomah => {
            const input = document.getElementById(`iqomah-${iqomah.prayer_name.toLowerCase()}`);
            if (input) {
                input.value = iqomah.minutes;
            }
        });

        // Load running text untuk iqomah mode
        await loadIqomahRunningText();

        // Setup listeners untuk running text
        setupIqomahRunningTextListeners();

    } catch (error) {
        console.error('Error loading iqomah settings:', error);
        showToast('Gagal memuat pengaturan iqomah', 'error');
    }
}

async function saveIqomahSettings() {
    const prayers = ['Subuh', 'Dzuhur', 'Ashar', 'Maghrib', 'Isya'];
    const updates = [];

    prayers.forEach(prayer => {
        const input = document.getElementById(`iqomah-${prayer.toLowerCase()}`);
        if (input) {
            updates.push({
                prayer_name: prayer,
                minutes: parseInt(input.value) || 10
            });
        }
    });

    try {
        // Set timestamp sebelum request
        window._lastUpdateTimestamp = Date.now();

        const iqomahsResponse = await fetch('/api/iqomah-times');
        const iqomahsData = await iqomahsResponse.json();
        const iqomahs = iqomahsData.data || [];

        for (const update of updates) {
            const iqomah = iqomahs.find(i => i.prayer_name === update.prayer_name);
            if (iqomah) {
                await fetch(`/api/iqomah-times/${iqomah.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prayer_name: update.prayer_name,
                        minutes: update.minutes
                    })
                });
            }
        }

        showToast('✅ Pengaturan iqomah berhasil disimpan', 'success');
        updatePreview();

    } catch (error) {
        console.error('Error saving iqomah settings:', error);
        showToast('Gagal menyimpan pengaturan iqomah', 'error');
    }
}

// Fungsi untuk manajemen keuangan - DIPERBAIKI
// ==================== FUNGSI LOAD FINANCE DATA DENGAN DISPLAY TOGGLE ====================

async function loadFinanceData() {
    try {
        showToast('📊 Memuat data keuangan...', 'info');

        // ================================================
        // 0. LOAD FINANCE DISPLAY SETTING (TAMBAHAN)
        // ================================================
        await loadFinanceDisplaySetting();
        await checkGoogleSheetStatus();

        // ================================================
        // 1. LOAD FINANCE SUMMARY (SALDO, PEMASUKAN, PENGELUARAN)
        // ================================================

        // Ambil semua data summary tanpa filter tanggal untuk mendapatkan akumulasi semua transaksi
        const summaryResponse = await fetch('/api/finances/summary');

        let totalIncome = 0;
        let totalExpense = 0;
        let currentBalance = 0;

        if (summaryResponse.ok) {
            const summaryData = await summaryResponse.json();

            if (summaryData.success && summaryData.data) {
                const summaries = summaryData.data;

                // Hitung total dari semua summary (akumulasi semua transaksi)
                totalIncome = summaries.reduce((sum, item) => sum + (parseFloat(item.total_income) || 0), 0);
                totalExpense = summaries.reduce((sum, item) => sum + (parseFloat(item.total_expense) || 0), 0);
                currentBalance = summaries.reduce((sum, item) => sum + (parseFloat(item.balance) || 0), 0);

                console.log('📊 Finance Summary:', {
                    totalIncome,
                    totalExpense,
                    currentBalance,
                    records: summaries.length
                });
            }
        } else {
            // Fallback: hitung dari semua transaksi
            console.log('⚠️ Summary API tidak tersedia, menghitung dari transaksi...');
            const financeResponse = await fetch('/api/finances');

            if (financeResponse.ok) {
                const financeData = await financeResponse.json();
                const transactions = financeData.data || [];

                totalIncome = transactions
                    .filter(t => t.type === 'masuk')
                    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

                totalExpense = transactions
                    .filter(t => t.type === 'keluar')
                    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

                currentBalance = totalIncome - totalExpense;
            }
        }

        // ================================================
        // 2. UPDATE SUMMARY CARDS
        // ================================================

        // Update saldo saat ini
        const balanceElement = document.getElementById('current-balance');
        if (balanceElement) {
            balanceElement.textContent = `Rp ${currentBalance.toLocaleString('id-ID')}`;

            // Tambahkan class berdasarkan nilai saldo
            balanceElement.classList.remove('text-red-600', 'text-green-600');
            if (currentBalance < 0) {
                balanceElement.classList.add('text-red-600');
            } else {
                balanceElement.classList.add('text-green-600');
            }
        }

        // Update total pemasukan
        const incomeElement = document.getElementById('total-income');
        if (incomeElement) {
            incomeElement.textContent = `Rp ${totalIncome.toLocaleString('id-ID')}`;
        }

        // Update total pengeluaran
        const expenseElement = document.getElementById('total-expense');
        if (expenseElement) {
            expenseElement.textContent = `Rp ${totalExpense.toLocaleString('id-ID')}`;
        }

        // Update periode info
        const periodElement = document.getElementById('finance-period');
        if (periodElement) {
            const today = new Date();
            const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
            const monthName = monthNames[today.getMonth()];
            periodElement.textContent = `${monthName} ${today.getFullYear()}`;
        }

        // ================================================
        // 3. LOAD TRANSACTION HISTORY
        // ================================================

        const historyResponse = await fetch('/api/finances?limit=20'); // Batasi 20 transaksi terbaru

        if (!historyResponse.ok) {
            throw new Error('Gagal mengambil riwayat transaksi');
        }

        const historyData = await historyResponse.json();
        const history = historyData.data || [];
        const table = document.getElementById('finance-table');

        if (!table) {
            console.error('❌ Finance table element not found');
            return;
        }

        table.innerHTML = '';

        if (history.length === 0) {
            table.innerHTML = `
                <tr>
                    <td colspan="6" class="p-4 text-center text-gray-500">
                        <div class="flex flex-col items-center py-8">
                            <i class="fas fa-coins text-4xl text-gray-300 mb-3"></i>
                            <p>Belum ada transaksi keuangan.</p>
                            <button onclick="showTransactionForm()" class="mt-3 text-blue-600 hover:text-blue-800">
                                <i class="fas fa-plus mr-1"></i> Tambah Transaksi
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        // Urutkan dari yang terbaru
        const sortedHistory = [...history].sort((a, b) =>
            new Date(b.transaction_date) - new Date(a.transaction_date)
        );

        sortedHistory.forEach(transaction => {
            const transactionDate = new Date(transaction.transaction_date);
            const formattedDate = transactionDate.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });

            const amount = parseFloat(transaction.amount) || 0;
            const formattedAmount = amount.toLocaleString('id-ID');

            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-gray-50 transition';
            row.innerHTML = `
                <td class="p-3 text-sm">${formattedDate}</td>
                <td class="p-3">
                    <span class="px-2 py-1 rounded-full text-xs font-medium 
                        ${transaction.type === 'masuk'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'}">
                        <i class="fas ${transaction.type === 'masuk' ? 'fa-arrow-down' : 'fa-arrow-up'} mr-1"></i>
                        ${transaction.type === 'masuk' ? 'Pemasukan' : 'Pengeluaran'}
                    </span>
                </td>
                <td class="p-3 font-medium">${transaction.category || '-'}</td>
                <td class="p-3 font-medium ${transaction.type === 'masuk' ? 'text-green-700' : 'text-red-700'}">
                    Rp ${formattedAmount}
                </td>
                <td class="p-3 text-sm text-gray-600">${transaction.description || '-'}</td>
                <td class="p-3">
                    <div class="flex items-center space-x-2">
                        <button onclick="editTransaction(${transaction.id})" 
                                class="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50"
                                title="Edit transaksi">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteTransaction(${transaction.id})" 
                                class="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                                title="Hapus transaksi">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            table.appendChild(row);
        });

        // ================================================
        // 4. UPDATE STATISTICS
        // ================================================

        updateFinanceStats(history);

        showToast('✅ Data keuangan berhasil dimuat', 'success');

    } catch (error) {
        console.error('❌ Error loading finance data:', error);
        showToast('Gagal memuat data keuangan: ' + error.message, 'error');

        // Tampilkan error state di cards
        const elements = ['current-balance', 'total-income', 'total-expense'];
        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = 'Rp 0';
                element.classList.remove('text-red-600', 'text-green-600');
            }
        });
    }
}

// ==================== FUNGSI LOAD FINANCE DISPLAY SETTING ====================

async function loadFinanceDisplaySetting() {
    try {
        const response = await fetch('/api/settings/finance_display');

        if (!response.ok) {
            // Jika 404, gunakan default
            if (response.status === 404) {
                console.log('⚠️ Finance display setting not found, using default');
                const toggle = document.getElementById('finance-display-toggle');
                const label = document.getElementById('finance-toggle-label');

                if (toggle) toggle.checked = true;
                if (label) label.textContent = 'Aktif';
                localStorage.setItem('finance_display', '1');
                return;
            }
            throw new Error('Failed to fetch');
        }

        const result = await response.json();

        if (result.success && result.data) {
            const isEnabled = result.data.finance_display;
            const toggle = document.getElementById('finance-display-toggle');
            const label = document.getElementById('finance-toggle-label');

            if (toggle) {
                toggle.checked = isEnabled;
                if (label) {
                    label.textContent = isEnabled ? 'Aktif' : 'Nonaktif';
                }
            }

            localStorage.setItem('finance_display', isEnabled ? '1' : '0');
        }
    } catch (error) {
        console.error('Error loading setting:', error);
        // Fallback ke localStorage
        const saved = localStorage.getItem('finance_display');
        const defaultValue = saved ? saved === '1' : true;

        const toggle = document.getElementById('finance-display-toggle');
        const label = document.getElementById('finance-toggle-label');

        if (toggle) {
            toggle.checked = defaultValue;
            if (label) {
                label.textContent = defaultValue ? 'Aktif' : 'Nonaktif';
            }
        }
    }
}

// Helper function untuk set default
function setDefaultFinanceDisplay() {
    const toggle = document.getElementById('finance-display-toggle');
    const label = document.getElementById('finance-toggle-label');

    // Cek localStorage dulu
    const saved = localStorage.getItem('finance_display');
    const defaultValue = saved ? saved === '1' : true;

    if (toggle) {
        toggle.checked = defaultValue;
        if (label) {
            label.textContent = defaultValue ? 'Aktif' : 'Nonaktif';
        }
    }
}

// Helper function untuk update toggle
function updateFinanceDisplayToggle(isEnabled) {
    const toggle = document.getElementById('finance-display-toggle');
    const label = document.getElementById('finance-toggle-label');

    if (toggle) {
        toggle.checked = isEnabled;
        if (label) {
            label.textContent = isEnabled ? 'Aktif' : 'Nonaktif';
        }
    }

    // Simpan ke localStorage
    localStorage.setItem('finance_display', isEnabled ? '1' : '0');
}

// ==================== FUNGSI TOGGLE FINANCE DISPLAY ====================

async function toggleFinanceDisplay() {
    const toggle = document.getElementById('finance-display-toggle');
    const label = document.getElementById('finance-toggle-label');

    if (!toggle) {
        console.error('❌ Toggle element not found');
        return;
    }

    // Ambil nilai dari toggle
    const isEnabled = toggle.checked;

    // Simpan state lama untuk rollback
    const oldState = !isEnabled;
    const oldLabel = label ? (oldState ? 'Aktif' : 'Nonaktif') : '';

    try {
        console.log(`📤 Sending: enabled = ${isEnabled}`);

        const response = await fetch('/api/settings/finance_display', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ enabled: isEnabled })
        });

        const result = await response.json();
        console.log('📥 Response:', result);

        if (response.ok && result.success) {
            showToast(`✅ Informasi keuangan ${isEnabled ? 'akan' : 'tidak akan'} ditampilkan`, 'success');

            if (label) {
                label.textContent = isEnabled ? 'Aktif' : 'Nonaktif';
            }

            // Simpan ke localStorage
            localStorage.setItem('finance_display', isEnabled ? '1' : '0');

            // Broadcast via WebSocket
            if (window.ws && window.ws.readyState === WebSocket.OPEN) {
                window.ws.send(JSON.stringify({
                    type: 'settings_updated',
                    data: { key: 'finance_display', value: isEnabled ? '1' : '0' }
                }));
            }
        } else {
            showToast(result.error || 'Gagal menyimpan', 'error');
            // Rollback
            toggle.checked = oldState;
            if (label) label.textContent = oldLabel;
        }
    } catch (error) {
        console.error('❌ Error:', error);
        showToast('Gagal: ' + error.message, 'error');
        // Rollback
        toggle.checked = oldState;
        if (label) label.textContent = oldLabel;
    }
}

// ==================== FUNGSI UPDATE FINANCE STATS ====================

function updateFinanceStats(transactions) {
    if (!transactions || transactions.length === 0) return;

    try {
        // Hitung rata-rata pemasukan per transaksi
        const incomeTransactions = transactions.filter(t => t.type === 'masuk');
        const avgIncome = incomeTransactions.length > 0
            ? incomeTransactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0) / incomeTransactions.length
            : 0;

        const avgIncomeElement = document.getElementById('avg-income');
        if (avgIncomeElement) {
            avgIncomeElement.textContent = `Rp ${avgIncome.toLocaleString('id-ID')}`;
        }

        // Hitung rata-rata pengeluaran per transaksi
        const expenseTransactions = transactions.filter(t => t.type === 'keluar');
        const avgExpense = expenseTransactions.length > 0
            ? expenseTransactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0) / expenseTransactions.length
            : 0;

        const avgExpenseElement = document.getElementById('avg-expense');
        if (avgExpenseElement) {
            avgExpenseElement.textContent = `Rp ${avgExpense.toLocaleString('id-ID')}`;
        }

        // Hitung jumlah transaksi bulan ini
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const monthlyTransactions = transactions.filter(t => {
            const date = new Date(t.transaction_date);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        });

        const monthlyCountElement = document.getElementById('monthly-transactions');
        if (monthlyCountElement) {
            monthlyCountElement.textContent = `${monthlyTransactions.length} transaksi`;
        }

        // Hitung total pemasukan bulan ini
        const monthlyIncome = monthlyTransactions
            .filter(t => t.type === 'masuk')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        const monthlyIncomeElement = document.getElementById('monthly-income');
        if (monthlyIncomeElement) {
            monthlyIncomeElement.textContent = `Rp ${monthlyIncome.toLocaleString('id-ID')}`;
        }

        // Hitung total pengeluaran bulan ini
        const monthlyExpense = monthlyTransactions
            .filter(t => t.type === 'keluar')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        const monthlyExpenseElement = document.getElementById('monthly-expense');
        if (monthlyExpenseElement) {
            monthlyExpenseElement.textContent = `Rp ${monthlyExpense.toLocaleString('id-ID')}`;
        }

    } catch (error) {
        console.error('❌ Error updating finance stats:', error);
    }
}

// ==================== FUNGSI FORMAT CURRENCY ====================

function formatCurrency(amount) {
    if (amount === undefined || amount === null) return 'Rp 0';
    return 'Rp ' + Number(amount).toLocaleString('id-ID');
}

// ==================== FUNGSI EKSPOR KE EXCEL ====================

async function exportFinanceToExcel() {
    try {
        showToast('📥 Menyiapkan data untuk diekspor...', 'info');

        const response = await fetch('/api/finances');
        if (!response.ok) throw new Error('Gagal mengambil data');

        const result = await response.json();
        const transactions = result.data || [];

        if (transactions.length === 0) {
            showToast('Tidak ada data untuk diekspor', 'warning');
            return;
        }

        // Format data untuk Excel
        const data = transactions.map(t => ({
            'Tanggal': new Date(t.transaction_date).toLocaleDateString('id-ID'),
            'Tipe': t.type === 'masuk' ? 'Pemasukan' : 'Pengeluaran',
            'Kategori': t.category,
            'Jumlah': `Rp ${parseFloat(t.amount).toLocaleString('id-ID')}`,
            'Deskripsi': t.description || '-'
        }));

        // Buat worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);

        // Atur lebar kolom
        const colWidths = [
            { wch: 12 }, // Tanggal
            { wch: 15 }, // Tipe
            { wch: 20 }, // Kategori
            { wch: 18 }, // Jumlah
            { wch: 30 }  // Deskripsi
        ];
        ws['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(wb, ws, 'Keuangan Masjid');

        // Download file
        const fileName = `keuangan-masjid-${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);

        showToast('✅ Data berhasil diekspor ke Excel', 'success');

    } catch (error) {
        console.error('❌ Error exporting to Excel:', error);
        showToast('Gagal mengekspor data', 'error');
    }
}

// ==================== FUNGSI FILTER FINANCE ====================

async function filterFinanceByPeriod(period) {
    let startDate, endDate;
    const today = new Date();

    switch (period) {
        case 'today':
            startDate = today.toISOString().split('T')[0];
            endDate = startDate;
            break;

        case 'week':
            const weekAgo = new Date(today);
            weekAgo.setDate(today.getDate() - 7);
            startDate = weekAgo.toISOString().split('T')[0];
            endDate = today.toISOString().split('T')[0];
            break;

        case 'month':
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
            startDate = monthStart.toISOString().split('T')[0];
            endDate = today.toISOString().split('T')[0];
            break;

        case 'year':
            const yearStart = new Date(today.getFullYear(), 0, 1);
            startDate = yearStart.toISOString().split('T')[0];
            endDate = today.toISOString().split('T')[0];
            break;

        case 'all':
        default:
            await loadFinanceData();
            showToast('📊 Menampilkan semua transaksi', 'info');
            return;
    }

    try {
        showToast(`📊 Filter: ${period === 'today' ? 'Hari Ini' : period === 'week' ? 'Minggu Ini' : period === 'month' ? 'Bulan Ini' : 'Tahun Ini'}`, 'info');

        const response = await fetch(`/api/finances?start_date=${startDate}&end_date=${endDate}`);
        if (!response.ok) throw new Error('Gagal memuat data');

        const result = await response.json();
        const filteredTransactions = result.data || [];

        // Update table dengan data terfilter
        updateFinanceTable(filteredTransactions);

        // Hitung ulang summary untuk periode terfilter
        const filteredIncome = filteredTransactions
            .filter(t => t.type === 'masuk')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        const filteredExpense = filteredTransactions
            .filter(t => t.type === 'keluar')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        const filteredBalance = filteredIncome - filteredExpense;

        // Update cards dengan data terfilter
        const balanceElement = document.getElementById('current-balance');
        const incomeElement = document.getElementById('total-income');
        const expenseElement = document.getElementById('total-expense');

        if (balanceElement) balanceElement.textContent = `Rp ${filteredBalance.toLocaleString('id-ID')}`;
        if (incomeElement) incomeElement.textContent = `Rp ${filteredIncome.toLocaleString('id-ID')}`;
        if (expenseElement) expenseElement.textContent = `Rp ${filteredExpense.toLocaleString('id-ID')}`;

    } catch (error) {
        console.error('❌ Error filtering finance data:', error);
        showToast('Gagal memfilter data', 'error');
    }
}

// ==================== FUNGSI UPDATE FINANCE TABLE ====================

function updateFinanceTable(transactions) {
    const table = document.getElementById('finance-table');
    if (!table) return;

    table.innerHTML = '';

    if (transactions.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="6" class="p-4 text-center text-gray-500">
                    Tidak ada transaksi pada periode ini.
                </td>
            </tr>
        `;
        return;
    }

    transactions.forEach(transaction => {
        const row = document.createElement('tr');
        row.className = 'border-b hover:bg-gray-50 transition';
        row.innerHTML = `
            <td class="p-3">${new Date(transaction.transaction_date).toLocaleDateString('id-ID')}</td>
            <td class="p-3">
                <span class="px-2 py-1 rounded-full text-xs font-medium
                    ${transaction.type === 'masuk' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                    <i class="fas ${transaction.type === 'masuk' ? 'fa-arrow-down' : 'fa-arrow-up'} mr-1"></i>
                    ${transaction.type === 'masuk' ? 'Pemasukan' : 'Pengeluaran'}
                </span>
            </td>
            <td class="p-3 font-medium">${transaction.category || '-'}</td>
            <td class="p-3 font-medium ${transaction.type === 'masuk' ? 'text-green-700' : 'text-red-700'}">
                Rp ${parseFloat(transaction.amount).toLocaleString('id-ID')}
            </td>
            <td class="p-3 text-sm text-gray-600">${transaction.description || '-'}</td>
            <td class="p-3">
                <div class="flex items-center space-x-2">
                    <button onclick="editTransaction(${transaction.id})" class="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteTransaction(${transaction.id})" class="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        table.appendChild(row);
    });
}

function updateFinanceStats(transactions) {
    if (!transactions || transactions.length === 0) return;

    try {
        // Hitung rata-rata pemasukan per transaksi
        const incomeTransactions = transactions.filter(t => t.type === 'masuk');
        const avgIncome = incomeTransactions.length > 0
            ? incomeTransactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0) / incomeTransactions.length
            : 0;

        const avgIncomeElement = document.getElementById('avg-income');
        if (avgIncomeElement) {
            avgIncomeElement.textContent = `Rp ${avgIncome.toLocaleString('id-ID')}`;
        }

        // Hitung rata-rata pengeluaran per transaksi
        const expenseTransactions = transactions.filter(t => t.type === 'keluar');
        const avgExpense = expenseTransactions.length > 0
            ? expenseTransactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0) / expenseTransactions.length
            : 0;

        const avgExpenseElement = document.getElementById('avg-expense');
        if (avgExpenseElement) {
            avgExpenseElement.textContent = `Rp ${avgExpense.toLocaleString('id-ID')}`;
        }

        // Hitung jumlah transaksi bulan ini
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const monthlyTransactions = transactions.filter(t => {
            const date = new Date(t.transaction_date);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        });

        const monthlyCountElement = document.getElementById('monthly-transactions');
        if (monthlyCountElement) {
            monthlyCountElement.textContent = `${monthlyTransactions.length} transaksi`;
        }

        // Hitung total pemasukan bulan ini
        const monthlyIncome = monthlyTransactions
            .filter(t => t.type === 'masuk')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        const monthlyIncomeElement = document.getElementById('monthly-income');
        if (monthlyIncomeElement) {
            monthlyIncomeElement.textContent = `Rp ${monthlyIncome.toLocaleString('id-ID')}`;
        }

        // Hitung total pengeluaran bulan ini
        const monthlyExpense = monthlyTransactions
            .filter(t => t.type === 'keluar')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        const monthlyExpenseElement = document.getElementById('monthly-expense');
        if (monthlyExpenseElement) {
            monthlyExpenseElement.textContent = `Rp ${monthlyExpense.toLocaleString('id-ID')}`;
        }

    } catch (error) {
        console.error('Error updating finance stats:', error);
    }
}

async function exportFinanceData() {
    try {
        showToast('📤 Mengexport data keuangan...', 'info');

        const response = await fetch('/api/finances');
        if (!response.ok) throw new Error('Gagal mengambil data');

        const data = await response.json();
        const transactions = data.data || [];

        // Format data untuk export
        const exportData = transactions.map(t => ({
            Tanggal: new Date(t.transaction_date).toLocaleDateString('id-ID'),
            Tipe: t.type === 'masuk' ? 'Pemasukan' : 'Pengeluaran',
            Kategori: t.category,
            Jumlah: `Rp ${parseFloat(t.amount).toLocaleString('id-ID')}`,
            Keterangan: t.description || '-'
        }));

        // Convert ke CSV
        const headers = Object.keys(exportData[0] || {});
        const csv = [
            headers.join(','),
            ...exportData.map(row => headers.map(h => `"${row[h]}"`).join(','))
        ].join('\n');

        // Download file
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `keuangan-masjid-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();

        window.URL.revokeObjectURL(url);
        showToast('✅ Data keuangan berhasil diexport', 'success');

    } catch (error) {
        console.error('Error exporting finance data:', error);
        showToast('❌ Gagal mengexport data', 'error');
    }
}

async function filterFinanceByPeriod(period) {
    let startDate, endDate;
    const today = new Date();

    switch (period) {
        case 'today':
            startDate = today.toISOString().split('T')[0];
            endDate = startDate;
            break;
        case 'week':
            const weekAgo = new Date(today);
            weekAgo.setDate(today.getDate() - 7);
            startDate = weekAgo.toISOString().split('T')[0];
            endDate = today.toISOString().split('T')[0];
            break;
        case 'month':
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
            startDate = monthStart.toISOString().split('T')[0];
            endDate = today.toISOString().split('T')[0];
            break;
        case 'year':
            const yearStart = new Date(today.getFullYear(), 0, 1);
            startDate = yearStart.toISOString().split('T')[0];
            endDate = today.toISOString().split('T')[0];
            break;
        case 'all':
        default:
            await loadFinanceData(); // Load semua data tanpa filter
            showToast('📊 Menampilkan semua transaksi', 'info');
            return;
    }

    try {
        showToast(`📊 Filter: ${period}`, 'info');

        const response = await fetch(`/api/finances?start_date=${startDate}&end_date=${endDate}`);
        if (!response.ok) throw new Error('Gagal memuat data');

        const result = await response.json();
        const filteredTransactions = result.data || [];

        // Update table dengan data terfilter
        updateFinanceTable(filteredTransactions);

        // Hitung ulang summary untuk periode terfilter
        const filteredIncome = filteredTransactions
            .filter(t => t.type === 'masuk')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        const filteredExpense = filteredTransactions
            .filter(t => t.type === 'keluar')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        const filteredBalance = filteredIncome - filteredExpense;

        // Update cards dengan data terfilter
        const balanceElement = document.getElementById('current-balance');
        const incomeElement = document.getElementById('total-income');
        const expenseElement = document.getElementById('total-expense');

        if (balanceElement) balanceElement.textContent = `Rp ${filteredBalance.toLocaleString('id-ID')}`;
        if (incomeElement) incomeElement.textContent = `Rp ${filteredIncome.toLocaleString('id-ID')}`;
        if (expenseElement) expenseElement.textContent = `Rp ${filteredExpense.toLocaleString('id-ID')}`;

    } catch (error) {
        console.error('Error filtering finance data:', error);
        showToast('❌ Gagal memfilter data', 'error');
    }
}

async function saveTransaction() {
    const type = document.getElementById('transaction-type')?.value;
    const category = document.getElementById('transaction-category')?.value;
    const amount = document.getElementById('transaction-amount')?.value;
    const date = document.getElementById('transaction-date')?.value;
    const description = document.getElementById('transaction-description')?.value;

    if (!category?.trim() || !amount || parseFloat(amount) <= 0) {
        showToast('Kategori dan jumlah yang valid diperlukan', 'warning');
        return;
    }

    try {
        // Set timestamp sebelum request
        window._lastUpdateTimestamp = Date.now();

        const response = await fetch('/api/finances', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type,
                category,
                amount: parseFloat(amount),
                description: description || null,
                transaction_date: date
            })
        });

        const result = await response.json();

        if (response.ok) {
            showToast('✅ Transaksi berhasil ditambahkan', 'success');
            hideTransactionForm();
            resetTransactionForm();
            loadFinanceData();
            updatePreview();
        } else {
            showToast(result.error || 'Gagal menambahkan transaksi', 'error');
        }
    } catch (error) {
        console.error('Error saving transaction:', error);
        showToast('Koneksi error. Coba lagi.', 'error');
    }
}

function resetTransactionForm() {
    document.getElementById('transaction-category').value = '';
    document.getElementById('transaction-amount').value = '';
    document.getElementById('transaction-description').value = '';
    document.getElementById('transaction-date').value = new Date().toISOString().split('T')[0];
}

// Fungsi untuk update table transaksi
function updateFinanceTable(transactions) {
    const table = document.getElementById('finance-table');
    if (!table) return;

    table.innerHTML = '';

    if (transactions.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="6" class="p-4 text-center text-gray-500">
                    Tidak ada transaksi pada periode ini.
                </td>
            </tr>
        `;
        return;
    }

    transactions.forEach(transaction => {
        const row = document.createElement('tr');
        row.className = 'border-b hover:bg-gray-50 transition';
        row.innerHTML = `
            <td class="p-3">${new Date(transaction.transaction_date).toLocaleDateString('id-ID')}</td>
            <td class="p-3">
                <span class="px-2 py-1 rounded-full text-xs font-medium 
                    ${transaction.type === 'masuk' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                    <i class="fas ${transaction.type === 'masuk' ? 'fa-arrow-down' : 'fa-arrow-up'} mr-1"></i>
                    ${transaction.type === 'masuk' ? 'Pemasukan' : 'Pengeluaran'}
                </span>
            </td>
            <td class="p-3 font-medium">${transaction.category || '-'}</td>
            <td class="p-3 font-medium ${transaction.type === 'masuk' ? 'text-green-700' : 'text-red-700'}">
                Rp ${parseFloat(transaction.amount).toLocaleString('id-ID')}
            </td>
            <td class="p-3 text-sm text-gray-600">${transaction.description || '-'}</td>
            <td class="p-3">
                <div class="flex items-center space-x-2">
                    <button onclick="editTransaction(${transaction.id})" 
                            class="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteTransaction(${transaction.id})" 
                            class="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        table.appendChild(row);
    });
}

function updateFinanceDisplayCards(balance, income, expense) {
    const financeToday = document.getElementById('finance-today');
    if (financeToday) {
        financeToday.textContent = `Rp ${(balance || 0).toLocaleString('id-ID')}`;
        financeToday.classList.remove('text-red-600', 'text-green-600');
        financeToday.classList.add(balance < 0 ? 'text-red-600' : 'text-green-600');
    }

    // Update dashboard totals if they exist
    const totalIncomeElement = document.getElementById('dashboard-total-income');
    if (totalIncomeElement) {
        totalIncomeElement.textContent = `Rp ${(income || 0).toLocaleString('id-ID')}`;
    }

    const totalExpenseElement = document.getElementById('dashboard-total-expense');
    if (totalExpenseElement) {
        totalExpenseElement.textContent = `Rp ${(expense || 0).toLocaleString('id-ID')}`;
    }

    // Update last update time
    const lastUpdateElement = document.getElementById('finance-last-update');
    if (lastUpdateElement) {
        const now = new Date();
        const timeString = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        lastUpdateElement.textContent = `Update: ${timeString}`;
    }
}

async function editTransaction(id) {
    try {
        showToast('🔄 Memuat data transaksi...', 'info');

        // Ambil data transaksi dari API
        const response = await fetch(`/api/finances/${id}`);
        if (!response.ok) {
            throw new Error('Gagal mengambil data transaksi');
        }

        const result = await response.json();
        const transaction = result.data;

        if (!transaction) {
            showToast('Transaksi tidak ditemukan', 'error');
            return;
        }

        // Tampilkan modal edit
        const modal = document.getElementById('edit-transaction-modal');
        if (!modal) {
            createEditTransactionModal(transaction);
        } else {
            populateEditTransactionForm(transaction);
            modal.classList.remove('hidden');
        }

    } catch (error) {
        console.error('Error editing transaction:', error);
        showToast('Gagal memuat data transaksi: ' + error.message, 'error');
    }
}

function createEditTransactionModal(transaction) {
    // Format tanggal untuk input date
    const formattedDate = transaction.transaction_date
        ? new Date(transaction.transaction_date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

    const modalHTML = `
        <div id="edit-transaction-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div class="p-6">
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-xl font-bold">Edit Transaksi Keuangan</h3>
                        <button onclick="closeEditTransactionModal()" class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Tipe Transaksi</label>
                            <select id="edit-transaction-type" class="w-full p-2 border rounded">
                                <option value="masuk" ${transaction.type === 'masuk' ? 'selected' : ''}>Pemasukan</option>
                                <option value="keluar" ${transaction.type === 'keluar' ? 'selected' : ''}>Pengeluaran</option>
                            </select>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                            <input type="text" id="edit-transaction-category" value="${escapeHTML(transaction.category || '')}" 
                                   class="w-full p-2 border rounded" placeholder="Contoh: Infaq Jumat, Listrik, dll">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Jumlah (Rp)</label>
                            <input type="number" id="edit-transaction-amount" value="${transaction.amount || 0}" 
                                   class="w-full p-2 border rounded" min="0" step="1000" placeholder="1000000">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                            <input type="date" id="edit-transaction-date" value="${formattedDate}" 
                                   class="w-full p-2 border rounded">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
                            <textarea id="edit-transaction-description" rows="3" 
                                      class="w-full p-2 border rounded" placeholder="Keterangan transaksi...">${escapeHTML(transaction.description || '')}</textarea>
                        </div>
                    </div>
                    
                    <div class="mt-6 flex justify-end space-x-3">
                        <button onclick="closeEditTransactionModal()" class="px-4 py-2 border rounded text-gray-700 hover:bg-gray-50">
                            Batal
                        </button>
                        <button onclick="updateTransaction(${transaction.id})" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                            <i class="fas fa-save mr-2"></i> Simpan Perubahan
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    editingTransactionId = transaction.id;
}

function populateEditTransactionForm(transaction) {
    document.getElementById('edit-transaction-type').value = transaction.type || 'masuk';
    document.getElementById('edit-transaction-category').value = transaction.category || '';
    document.getElementById('edit-transaction-amount').value = transaction.amount || 0;

    const formattedDate = transaction.transaction_date
        ? new Date(transaction.transaction_date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
    document.getElementById('edit-transaction-date').value = formattedDate;

    document.getElementById('edit-transaction-description').value = transaction.description || '';

    editingTransactionId = transaction.id;
}

function closeEditTransactionModal() {
    const modal = document.getElementById('edit-transaction-modal');
    if (modal) {
        modal.remove();
    }
    editingTransactionId = null;
}

async function updateTransaction(id) {
    const type = document.getElementById('edit-transaction-type')?.value;
    const category = document.getElementById('edit-transaction-category')?.value;
    const amount = document.getElementById('edit-transaction-amount')?.value;
    const date = document.getElementById('edit-transaction-date')?.value;
    const description = document.getElementById('edit-transaction-description')?.value;

    if (!category?.trim()) {
        showToast('Kategori harus diisi', 'warning');
        return;
    }

    if (!amount || parseFloat(amount) <= 0) {
        showToast('Jumlah harus lebih dari 0', 'warning');
        return;
    }

    if (!date) {
        showToast('Tanggal harus diisi', 'warning');
        return;
    }

    try {
        showToast('⏳ Menyimpan perubahan...', 'info');

        // Set timestamp untuk mencegah notif ganda
        window._lastUpdateTimestamp = Date.now();

        const response = await fetch(`/api/finances/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type,
                category: category.trim(),
                amount: parseFloat(amount),
                description: description?.trim() || null,
                transaction_date: date
            })
        });

        const result = await response.json();

        if (response.ok) {
            showToast('✅ Transaksi berhasil diperbarui', 'success');
            closeEditTransactionModal();
            await loadFinanceData(); // Refresh data keuangan
            updatePreview();
        } else {
            showToast(result.error || 'Gagal memperbarui transaksi', 'error');
        }
    } catch (error) {
        console.error('Error updating transaction:', error);
        showToast('Koneksi error. Coba lagi.', 'error');
    }
}

function formatRupiah(angka) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(angka);
}

function validateTransactionAmount(input) {
    let value = input.value.replace(/[^0-9]/g, '');
    if (value) {
        input.value = parseInt(value);
    }
}

async function deleteTransaction(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) {
        return;
    }

    try {
        const response = await fetch(`/api/finances/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('Transaksi berhasil dihapus', 'success');
            loadFinanceData();
            updatePreview();
        } else {
            showToast('Gagal menghapus transaksi', 'error');
        }
    } catch (error) {
        console.error('Error deleting transaction:', error);
        showToast('Gagal menghapus transaksi', 'error');
    }
}

async function loadFinanceDisplaySetting() {
    try {
        const response = await fetch('/api/settings/finance_display');

        if (!response.ok) {
            throw new Error('Failed to fetch');
        }

        const result = await response.json();

        if (result.success && result.data) {
            const isEnabled = result.data.finance_display;
            const toggle = document.getElementById('finance-display-toggle');
            const label = document.getElementById('finance-toggle-label');

            if (toggle) {
                toggle.checked = isEnabled;
                if (label) {
                    label.textContent = isEnabled ? 'Aktif' : 'Nonaktif';
                }
            }

            localStorage.setItem('finance_display', isEnabled ? '1' : '0');
        }
    } catch (error) {
        console.error('Error loading setting:', error);
        // Fallback ke localStorage
        const saved = localStorage.getItem('finance_display');
        const defaultValue = saved ? saved === '1' : true;

        const toggle = document.getElementById('finance-display-toggle');
        const label = document.getElementById('finance-toggle-label');

        if (toggle) {
            toggle.checked = defaultValue;
            if (label) {
                label.textContent = defaultValue ? 'Aktif' : 'Nonaktif';
            }
        }
    }
}

async function toggleFinanceDisplay() {
    const toggle = document.getElementById('finance-display-toggle');
    const label = document.getElementById('finance-toggle-label');

    if (!toggle) {
        console.error(' ❌  Toggle element not found');
        return;
    }

    // Ambil nilai dari toggle (checkbox)
    const isEnabled = toggle.checked;

    // PERBAIKAN: Konversi ke string '1' atau '0' agar sesuai dengan database MySQL
    const valueToSend = isEnabled ? '1' : '0';

    // Simpan state lama untuk rollback jika terjadi error
    const oldState = !isEnabled;
    const oldLabel = label ? (oldState ? 'Aktif' : 'Nonaktif') : '';

    try {
        console.log(` 📤  Sending: setting_value = ${valueToSend}`);

        const response = await fetch('/api/settings/finance_display', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            // PERBAIKAN: Ubah property dari 'enabled' menjadi 'setting_value'
            body: JSON.stringify({ setting_value: valueToSend }),
        });

        const result = await response.json();
        console.log(' 📥  Response:', result);

        // Tambahkan fallback jika API tidak mereturn 'result.success' tapi response.ok
        if (response.ok) {
            showToast(` ✅  Informasi keuangan ${isEnabled ? 'akan' : 'tidak akan'} ditampilkan`, 'success');

            if (label) {
                label.textContent = isEnabled ? 'Aktif' : 'Nonaktif';
            }

            // Simpan ke localStorage
            localStorage.setItem('finance_display', valueToSend);

            // Broadcast via WebSocket
            if (window.ws && window.ws.readyState === WebSocket.OPEN) {
                window.ws.send(JSON.stringify({
                    type: 'settings_updated',
                    data: { key: 'finance_display', value: valueToSend }
                }));
            }
        } else {
            showToast(result.error || 'Gagal menyimpan', 'error');
            // Rollback jika gagal
            toggle.checked = oldState;
            if (label) label.textContent = oldLabel;
        }
    } catch (error) {
        console.error(' ❌  Error:', error);
        showToast('Gagal: ' + error.message, 'error');
        // Rollback jika error jaringan
        toggle.checked = oldState;
        if (label) label.textContent = oldLabel;
    }
}