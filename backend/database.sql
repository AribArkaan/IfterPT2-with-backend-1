-- database-full.sql (FIXED)
CREATE DATABASE IF NOT EXISTS `masjid_db` 
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `masjid_db`;

-- 1. Tabel settings
CREATE TABLE IF NOT EXISTS `settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `key` varchar(100) NOT NULL,
  `value` text DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabel jadwal shalat
CREATE TABLE IF NOT EXISTS `prayer_times` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `prayer_name` varchar(50) NOT NULL,
  `time` time NOT NULL,
  `ihtiyat` int(11) DEFAULT 0,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `prayer_name` (`prayer_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabel iqomah
CREATE TABLE IF NOT EXISTS `iqomah_times` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `prayer_name` varchar(50) NOT NULL,
  `minutes` int(11) DEFAULT 10,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `prayer_name` (`prayer_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabel running text
CREATE TABLE IF NOT EXISTS `running_text` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `text` text NOT NULL,
  `font_family` varchar(50) DEFAULT 'Inter',
  `font_size` int(11) DEFAULT 16,
  `speed` int(11) DEFAULT 30,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tabel content
CREATE TABLE IF NOT EXISTS `contents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `type` varchar(50) NOT NULL,
  `file_path` text DEFAULT NULL,
  `display_order` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Tabel events
CREATE TABLE IF NOT EXISTS `events` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `target_date` date NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Tabel keuangan - FIXED curdate() issue
CREATE TABLE IF NOT EXISTS `finances` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `type` enum('masuk','keluar') NOT NULL,
  `category` varchar(100) NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `description` text DEFAULT NULL,
  `transaction_date` date DEFAULT (CURRENT_DATE),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Tabel untuk grafik keuangan
CREATE TABLE IF NOT EXISTS `finance_summary` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `total_income` decimal(15,2) DEFAULT 0,
  `total_expense` decimal(15,2) DEFAULT 0,
  `balance` decimal(15,2) DEFAULT 0,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========== INSERT DATA DEFAULT ==========

-- Settings
INSERT IGNORE INTO `settings` (`key`, `value`) VALUES
('masjid_name', 'MASJID AL-IKHLAS'),
('masjid_address', 'Jl. Riung Wulan No. 01'),
('latitude', '-6.9419'),
('longitude', '107.6824'),
('prayer_calculation_method', '11'),
('timezone', 'Asia/Jakarta'),
('auto_adzan', '1'),
('adzan_volume', '80'),
('iqomah_default', '10'),
('display_rotation', '20'),
('date_rotation', '15'),
('chart_rotation', '25');

-- Jadwal shalat
INSERT IGNORE INTO `prayer_times` (`prayer_name`, `time`, `ihtiyat`) VALUES
('Subuh', '04:15:00', 3),
('Terbit', '05:30:00', -7),
('Dzuhur', '11:45:00', 3),
('Ashar', '15:00:00', 2),
('Maghrib', '17:50:00', 2),
('Isya', '19:05:00', 3);

-- Iqomah
INSERT IGNORE INTO `iqomah_times` (`prayer_name`, `minutes`) VALUES
('Subuh', 10),
('Dzuhur', 10),
('Ashar', 10),
('Maghrib', 10),
('Isya', 10);

-- Running text
INSERT IGNORE INTO `running_text` (`text`, `font_family`, `font_size`, `speed`, `is_active`) VALUES
('Selamat datang di Masjid Al-Ikhlas', 'Inter', 16, 30, 1),
('Jaga kebersihan dan ketertiban masjid', 'Inter', 16, 30, 1),
('Mari rapatkan dan luruskan shaf shalat', 'Inter', 16, 30, 1);

-- Event
INSERT IGNORE INTO `events` (`title`, `description`, `target_date`, `is_active`) VALUES
('Maulid Nabi Muhammad SAW', 'Peringatan Maulid Nabi Besar Muhammad SAW', DATE_ADD(CURDATE(), INTERVAL 1 MONTH), 1);

-- Data keuangan contoh
INSERT IGNORE INTO `finances` (`type`, `category`, `amount`, `description`, `transaction_date`) VALUES
('masuk', 'Infaq Jumat', 2500000, 'Infaq Jumat', CURDATE()),
('keluar', 'Listrik', 850000, 'Pembayaran listrik bulanan', CURDATE()),
('masuk', 'Zakat Fitrah', 1500000, 'Zakat fitrah Ramadan', CURDATE());

-- Tampilkan semua tabel
SELECT 'Database berhasil dibuat!' as status;
SHOW TABLES;