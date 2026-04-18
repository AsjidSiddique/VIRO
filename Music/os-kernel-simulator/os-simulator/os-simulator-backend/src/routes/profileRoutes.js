const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { uploadAvatar } = require('../middleware/uploadMiddleware');
const {
  getProfile, updateProfile,
  uploadAvatar: uploadAvatarHandler,
  deleteAvatar, changePassword,
} = require('../controllers/profileController');

router.use(protect);

router.get('/', getProfile);
router.put('/', updateProfile);
router.post('/avatar', uploadAvatar, uploadAvatarHandler);
router.delete('/avatar', deleteAvatar);
router.put('/password', changePassword);

module.exports = router;
