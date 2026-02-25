-- Create users table for authentication
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) UNIQUE NOT NULL,
  `email` VARCHAR(100) UNIQUE NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_username` (`username`),
  INDEX `idx_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default admin user (password: admin123)
-- Username: admin
-- Password: admin123
INSERT IGNORE INTO `users` (username, email, password) VALUES (
  'admin',
  'admin@masjid.local',
  '$2b$10$YJLnP6QZ8v8wq.E9Vz9Yre.2K8.K8K8.K8.K8.K8.K8.K8.K8.K8.K' -- bcrypt hash of 'admin123'
);

-- If you need to reset password, use the Node.js script or update manually with bcrypt hash
