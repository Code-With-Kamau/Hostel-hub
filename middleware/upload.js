const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const ALLOWED_TYPES = /^image\/(jpeg|jpg|png|webp|gif)$/i;
const MAX_SIZE      = 10 * 1024 * 1024; // 10 MB

function makeStorage(subdir) {
  const dest = path.join(__dirname, '..', 'uploads', subdir);
  fs.mkdirSync(dest, { recursive: true });

  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename:    (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      cb(null, unique + path.extname(file.originalname).toLowerCase());
    },
  });
}

function fileFilter(_req, file, cb) {
  if (ALLOWED_TYPES.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, WebP, GIF) are allowed'), false);
  }
}

const hostelUpload  = multer({ storage: makeStorage('hostels'),  fileFilter, limits: { fileSize: MAX_SIZE } });
const profileUpload = multer({ storage: makeStorage('profiles'), fileFilter, limits: { fileSize: MAX_SIZE } });

// Error handler for multer errors
function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10 MB.' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
}

module.exports = { hostelUpload, profileUpload, handleUploadError };
