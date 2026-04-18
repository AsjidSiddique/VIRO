const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { runProcessSim } = require('../controllers/processController');

router.post('/simulate', protect, runProcessSim);

module.exports = router;
