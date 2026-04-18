const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { uploadCSV } = require('../middleware/uploadMiddleware');
const { uploadSchedulingCSV, uploadMemoryCSV } = require('../controllers/csvController');

router.post('/scheduling', protect, uploadCSV, uploadSchedulingCSV);
router.post('/memory', protect, uploadCSV, uploadMemoryCSV);

module.exports = router;
