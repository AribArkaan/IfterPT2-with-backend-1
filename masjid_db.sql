-- phpMyAdmin SQL Dump
-- version 5.2.0
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Waktu pembuatan: 22 Feb 2026 pada 11.44
-- Versi server: 10.4.25-MariaDB
-- Versi PHP: 8.1.10

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `masjid_db`
--

-- --------------------------------------------------------

--
-- Struktur dari tabel `content`
--

CREATE TABLE `content` (
  `id` int(11) NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content_text` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `content_type` enum('text','image','video','announcement') COLLATE utf8mb4_unicode_ci DEFAULT 'text',
  `image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `video_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `display_order` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data untuk tabel `content`
--

INSERT INTO `content` (`id`, `title`, `content_text`, `content_type`, `image_url`, `video_url`, `display_order`, `is_active`, `created_at`, `updated_at`) VALUES
(8, 'asdasdasd', NULL, 'image', '/uploads/upload-1771520027202-426051776.jpg', NULL, 1, 1, '2026-02-16 18:08:27', '2026-02-19 16:53:47'),
(10, 'Jumatan', '{\"text\":\"halo\",\"font_family\":\"Inter\",\"title_font_size\":58,\"desc_font_size\":16,\"color\":\"#000000\",\"bg_color\":\"#0d94e7\",\"bg_opacity\":100,\"bold\":true,\"italic\":false,\"underline\":false,\"text_align\":\"center\",\"position\":\"center\"}', 'announcement', NULL, NULL, 2, 1, '2026-02-18 10:29:47', '2026-02-19 16:53:57');

-- --------------------------------------------------------

--
-- Struktur dari tabel `events`
--

CREATE TABLE `events` (
  `id` int(11) NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `target_date` datetime NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data untuk tabel `events`
--

INSERT INTO `events` (`id`, `title`, `description`, `target_date`, `is_active`, `created_at`, `updated_at`) VALUES
(4, 'Maulid Nabi Muhammad SAW', 'Peringatan Maulid Nabi Besar Muhammad SAW', '2026-03-14 23:42:36', 1, '2026-02-14 23:42:37', '2026-02-14 23:42:37'),
(6, 'Maulid Nabi Muhammad SAW', 'Peringatan Maulid Nabi Besar Muhammad SAW', '2026-03-18 22:21:22', 1, '2026-02-18 22:21:22', '2026-02-18 22:21:22'),
(8, 'Maulid Nabi Muhammad SAW', 'Peringatan Maulid Nabi Besar Muhammad SAW', '2026-03-20 07:31:38', 1, '2026-02-20 07:31:38', '2026-02-20 07:31:38');

-- --------------------------------------------------------

--
-- Struktur dari tabel `finances`
--

CREATE TABLE `finances` (
  `id` int(11) NOT NULL,
  `type` enum('masuk','keluar') COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `transaction_date` date NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data untuk tabel `finances`
--

INSERT INTO `finances` (`id`, `type`, `category`, `amount`, `description`, `transaction_date`, `created_at`) VALUES
(1, 'masuk', 'Infaq Jumat', '2500000.00', 'Infaq Jumat', '2026-02-10', '2026-02-10 06:49:33'),
(2, 'keluar', 'Listrik', '850000.00', 'Pembayaran listrik bulanan', '2026-02-10', '2026-02-10 06:49:33'),
(3, 'masuk', 'Zakat Fitrah', '1500000.00', 'Zakat fitrah Ramadan', '2026-02-10', '2026-02-10 06:49:33'),
(4, 'masuk', 'Infaq Jumat', '2500000.00', 'Infaq Jumat', '2026-02-10', '2026-02-10 07:26:39'),
(5, 'keluar', 'Listrik', '850000.00', 'Pembayaran listrik bulanan', '2026-02-10', '2026-02-10 07:26:39'),
(6, 'masuk', 'Zakat Fitrah', '1500000.00', 'Zakat fitrah Ramadan', '2026-02-10', '2026-02-10 07:26:39'),
(7, 'masuk', 'test', '15000.00', 'test', '2026-02-11', '2026-02-11 12:31:05'),
(8, 'masuk', 'Infaq Jumat', '2500000.00', 'Infaq Jumat', '2026-02-14', '2026-02-14 23:42:37'),
(9, 'keluar', 'Listrik', '850000.00', 'Pembayaran listrik bulanan', '2026-02-14', '2026-02-14 23:42:37'),
(10, 'masuk', 'Zakat Fitrah', '1500000.00', 'Zakat fitrah Ramadan', '2026-02-14', '2026-02-14 23:42:37'),
(11, 'masuk', 'Infaq Jumat', '2500000.00', 'Infaq Jumat', '2026-02-18', '2026-02-18 22:21:22'),
(12, 'keluar', 'Listrik', '850000.00', 'Pembayaran listrik bulanan', '2026-02-18', '2026-02-18 22:21:22'),
(13, 'masuk', 'Zakat Fitrah', '1500000.00', 'Zakat fitrah Ramadan', '2026-02-18', '2026-02-18 22:21:22'),
(14, 'masuk', 'Infaq Jumat', '2500000.00', 'Infaq Jumat', '2026-02-20', '2026-02-20 07:31:38'),
(15, 'keluar', 'Listrik', '850000.00', 'Pembayaran listrik bulanan', '2026-02-20', '2026-02-20 07:31:38'),
(16, 'masuk', 'Zakat Fitrah', '1500000.00', 'Zakat fitrah Ramadan', '2026-02-20', '2026-02-20 07:31:38');

-- --------------------------------------------------------

--
-- Struktur dari tabel `finance_summary`
--

CREATE TABLE `finance_summary` (
  `id` int(11) NOT NULL,
  `date` date NOT NULL,
  `total_income` decimal(15,2) DEFAULT 0.00,
  `total_expense` decimal(15,2) DEFAULT 0.00,
  `balance` decimal(15,2) DEFAULT 0.00,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data untuk tabel `finance_summary`
--

INSERT INTO `finance_summary` (`id`, `date`, `total_income`, `total_expense`, `balance`, `updated_at`) VALUES
(1, '2026-02-10', '8000000.00', '1700000.00', '6300000.00', '2026-02-10 07:26:39'),
(3, '2026-02-11', '15000.00', '0.00', '15000.00', '2026-02-11 12:31:05'),
(4, '2026-02-14', '4000000.00', '850000.00', '3150000.00', '2026-02-14 23:42:37'),
(5, '2026-02-18', '4000000.00', '850000.00', '3150000.00', '2026-02-18 22:21:22'),
(6, '2026-02-20', '4000000.00', '850000.00', '3150000.00', '2026-02-20 07:31:38');

-- --------------------------------------------------------

--
-- Struktur dari tabel `iqomah_running_text`
--

CREATE TABLE `iqomah_running_text` (
  `id` int(11) NOT NULL,
  `text` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `font_family` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'Inter',
  `font_size` int(11) DEFAULT 16,
  `speed` int(11) DEFAULT 30,
  `is_active` tinyint(1) DEFAULT 1,
  `display_order` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data untuk tabel `iqomah_running_text`
--

INSERT INTO `iqomah_running_text` (`id`, `text`, `font_family`, `font_size`, `speed`, `is_active`, `display_order`, `created_at`, `updated_at`) VALUES
(1, 'halo ini running text 2', 'Inter', 16, 30, 1, 0, '2026-02-18 22:54:52', '2026-02-18 22:54:52');

-- --------------------------------------------------------

--
-- Struktur dari tabel `iqomah_times`
--

CREATE TABLE `iqomah_times` (
  `id` int(11) NOT NULL,
  `prayer_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `minutes` int(11) NOT NULL DEFAULT 10,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data untuk tabel `iqomah_times`
--

INSERT INTO `iqomah_times` (`id`, `prayer_name`, `minutes`, `updated_at`) VALUES
(1, 'Subuh', 15, '2026-02-15 00:02:16'),
(2, 'Dzuhur', 10, '2026-02-16 09:34:58'),
(3, 'Ashar', 10, '2026-02-10 06:49:33'),
(4, 'Maghrib', 10, '2026-02-10 06:49:33'),
(5, 'Isya', 10, '2026-02-10 06:49:33');

-- --------------------------------------------------------

--
-- Struktur dari tabel `prayer_times`
--

CREATE TABLE `prayer_times` (
  `id` int(11) NOT NULL,
  `prayer_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `time` time NOT NULL,
  `ihtiyat` int(11) DEFAULT 0,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data untuk tabel `prayer_times`
--

INSERT INTO `prayer_times` (`id`, `prayer_name`, `time`, `ihtiyat`, `updated_at`) VALUES
(1, 'Subuh', '04:38:00', 3, '2026-02-18 10:31:42'),
(2, 'Terbit', '05:47:00', -7, '2026-02-19 16:51:55'),
(3, 'Dzuhur', '12:06:00', 3, '2026-02-19 16:51:55'),
(4, 'Ashar', '15:13:00', 2, '2026-02-20 21:31:58'),
(5, 'Maghrib', '18:13:00', 2, '2026-02-20 21:31:58'),
(6, 'Isya', '19:25:00', 3, '2026-02-20 21:31:58');

-- --------------------------------------------------------

--
-- Struktur dari tabel `running_text`
--

CREATE TABLE `running_text` (
  `id` int(11) NOT NULL,
  `text` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `font_family` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'Inter',
  `font_size` int(11) DEFAULT 16,
  `speed` int(11) DEFAULT 30,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data untuk tabel `running_text`
--

INSERT INTO `running_text` (`id`, `text`, `font_family`, `font_size`, `speed`, `is_active`, `created_at`) VALUES
(48, '📿 Semoga ibadah kita diterima Allah SWT', 'Inter', 16, 30, 1, '2026-02-18 22:29:23'),
(49, '🔊 Mohon tenang, matikan HP atau mode silent', 'Inter', 16, 30, 1, '2026-02-18 22:29:23'),
(50, '⭐ Rapatkan dan luruskan shaf', 'Inter', 16, 30, 1, '2026-02-18 22:29:23'),
(54, 'Mari rapatkan dan luruskan shaf shalat', 'Inter', 16, 30, 1, '2026-02-20 07:31:38'),
(55, 'halo 1', 'Inter', 16, 30, 1, '2026-02-21 04:51:36'),
(56, 'alo 2', 'Inter', 16, 30, 1, '2026-02-21 04:51:36'),
(57, 'halllo 3', 'Inter', 16, 30, 1, '2026-02-21 04:51:36');

-- --------------------------------------------------------

--
-- Struktur dari tabel `settings`
--

CREATE TABLE `settings` (
  `setting_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `setting_value` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data untuk tabel `settings`
--

INSERT INTO `settings` (`setting_key`, `setting_value`, `updated_at`) VALUES
('adzan_redirect_minutes', '5', '2026-02-14 23:42:36'),
('adzan_volume', '80', '2026-02-10 06:49:33'),
('auto_adzan', '1', '2026-02-10 06:49:33'),
('chart_rotation', '25', '2026-02-10 06:49:33'),
('date_rotation', '5', '2026-02-19 16:55:16'),
('display_rotation', '5', '2026-02-19 16:55:11'),
('finance_display', '1', '2026-02-21 03:59:43'),
('fokus_duration_ashar', '10', '2026-02-22 10:39:48'),
('fokus_duration_dzuhur', '10', '2026-02-22 10:39:48'),
('fokus_duration_isya', '10', '2026-02-22 10:39:48'),
('fokus_duration_jumat', '30', '2026-02-22 10:39:48'),
('fokus_duration_maghrib', '10', '2026-02-22 10:39:48'),
('fokus_duration_subuh', '10', '2026-02-22 10:39:48'),
('hijri_date', '2 Ramaḍān 1447 H', '2026-02-19 16:51:55'),
('hijri_date_cache', '3 Ramaḍān 1447 H', '2026-02-19 17:14:58'),
('iqomah_default', '10', '2026-02-10 06:49:33'),
('iqomah_duration', '10', '2026-02-14 23:42:36'),
('latitude', '-6.9419', '2026-02-10 06:49:33'),
('longitude', '107.6824', '2026-02-10 06:49:33'),
('masjid_address', 'Jl. Riung Wulan No. 01', '2026-02-14 23:26:06'),
('masjid_name', 'MASJID AL-IKHLAS', '2026-02-10 06:49:33'),
('prayer_calculation_method', '11', '2026-02-19 16:55:11'),
('timezone', 'Asia/Jakarta', '2026-02-10 06:49:33');

--
-- Indexes for dumped tables
--

--
-- Indeks untuk tabel `content`
--
ALTER TABLE `content`
  ADD PRIMARY KEY (`id`);

--
-- Indeks untuk tabel `events`
--
ALTER TABLE `events`
  ADD PRIMARY KEY (`id`);

--
-- Indeks untuk tabel `finances`
--
ALTER TABLE `finances`
  ADD PRIMARY KEY (`id`);

--
-- Indeks untuk tabel `finance_summary`
--
ALTER TABLE `finance_summary`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `date` (`date`);

--
-- Indeks untuk tabel `iqomah_running_text`
--
ALTER TABLE `iqomah_running_text`
  ADD PRIMARY KEY (`id`);

--
-- Indeks untuk tabel `iqomah_times`
--
ALTER TABLE `iqomah_times`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `prayer_name` (`prayer_name`);

--
-- Indeks untuk tabel `prayer_times`
--
ALTER TABLE `prayer_times`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `prayer_name` (`prayer_name`);

--
-- Indeks untuk tabel `running_text`
--
ALTER TABLE `running_text`
  ADD PRIMARY KEY (`id`);

--
-- Indeks untuk tabel `settings`
--
ALTER TABLE `settings`
  ADD PRIMARY KEY (`setting_key`);

--
-- AUTO_INCREMENT untuk tabel yang dibuang
--

--
-- AUTO_INCREMENT untuk tabel `content`
--
ALTER TABLE `content`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT untuk tabel `events`
--
ALTER TABLE `events`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT untuk tabel `finances`
--
ALTER TABLE `finances`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT untuk tabel `finance_summary`
--
ALTER TABLE `finance_summary`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT untuk tabel `iqomah_running_text`
--
ALTER TABLE `iqomah_running_text`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT untuk tabel `iqomah_times`
--
ALTER TABLE `iqomah_times`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT untuk tabel `prayer_times`
--
ALTER TABLE `prayer_times`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT untuk tabel `running_text`
--
ALTER TABLE `running_text`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=58;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
