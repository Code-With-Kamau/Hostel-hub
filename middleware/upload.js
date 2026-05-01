const multer = require('multer');
const path = require('path');

function makeStorage(dest) {
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dest),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random()*1e6) + path.extname(file.originalname)),
  });
}

const hostelUpload = multer({ storage: makeStorage('uploads/hostels/'), limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /image|video/.test(file.mimetype)) });

const profileUpload = multer({ storage: makeStorage('uploads/profiles/'), limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /image/.test(file.mimetype)) });

module.exports = { hostelUpload, profileUpload };
