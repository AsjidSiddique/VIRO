const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ── Ensure upload dirs exist ──────────────────────
const avatarDir = path.join(__dirname, '../../uploads/avatars');
const csvDir = path.join(__dirname, '../../uploads/csv');

[avatarDir, csvDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ── AVATAR STORAGE ────────────────────────────────
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarDir),
  filename: (req, file, cb) => {
    const userId = req.user ? req.user._id.toString() : 'unknown';
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${userId}_${Date.now()}${ext}`);
  },
});

const avatarFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WEBP images are allowed.'), false);
  }
};

// ── CSV STORAGE ───────────────────────────────────
const csvStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, csvDir),
  filename: (req, file, cb) => {
    const userId = req.user ? req.user._id.toString() : 'unknown';
    const safeName = path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);
    cb(null, `${userId}_${safeName}_${Date.now()}.csv`);
  },
});

const csvFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (file.mimetype.includes('csv') || file.mimetype.includes('text') || ext === '.csv') {
    cb(null, true);
  } else {
    cb(new Error('Only CSV files are allowed.'), false);
  }
};

// ── Wrapper: converts multer callback errors to JSON ─
const handleUpload = (uploadFn) => (req, res, next) => {
  uploadFn(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: `Upload error: ${err.message}` });
    }
    return res.status(400).json({ message: err.message });
  });
};

const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter: avatarFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
}).single('avatar');

const uploadCSV = multer({
  storage: csvStorage,
  fileFilter: csvFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('file');

module.exports = {
  uploadAvatar: handleUpload(uploadAvatar),
  uploadCSV: handleUpload(uploadCSV),
  avatarDir,
  csvDir,
};
