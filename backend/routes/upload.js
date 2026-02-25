const path = require('path');
const express = require('express');
const { upload, detectFileType } = require('../utils/fileUpload');
const { broadcast } = require('../utils/broadcast');

const router = express.Router();

router.post('/', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('❌ Multer error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'File terlalu besar. Maksimal 20MB'
        });
      }
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Tidak ada file yang diupload'
        });
      }

      const extname = path.extname(req.file.originalname).toLowerCase();
      const detectedType = detectFileType(req.file.mimetype, extname);

      const fileUrl = `/uploads/${req.file.filename}`;

      console.log('✅ File uploaded:', {
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        type: detectedType,
        path: fileUrl
      });

      broadcast('file_uploaded', {
        filename: req.file.filename,
        originalname: req.file.originalname,
        type: detectedType
      });

      res.json({
        success: true,
        filePath: fileUrl,
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        type: detectedType
      });

    } catch (error) {
      console.error('❌ Upload error:', error);
      res.status(500).json({
        success: false,
        error: 'Gagal mengupload file',
        details: error.message
      });
    }
  });
});

module.exports = router;
