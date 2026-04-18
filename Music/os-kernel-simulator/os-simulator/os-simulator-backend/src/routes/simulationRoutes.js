const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  runScheduling, runMemory, runSync,
  saveResult, getResults, getResultById, deleteResult,
} = require('../controllers/simulationController');

router.post('/scheduling', protect, runScheduling);
router.post('/memory', protect, runMemory);
router.post('/sync', protect, runSync);

router.post('/results', protect, saveResult);
router.get('/results', protect, getResults);
router.get('/results/:id', protect, getResultById);
router.delete('/results/:id', protect, deleteResult);

module.exports = router;
