const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const logger = require('../utils/logger');
const { avatarDir } = require('../middleware/uploadMiddleware');

exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ success: true, data: user.toPublicJSON() });
  } catch (err) { next(err); }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { name, bio, university, department, semester } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (bio !== undefined) updates.bio = bio;
    if (university !== undefined) updates.university = university.trim();
    if (department !== undefined) updates.department = department.trim();
    if (semester !== undefined) updates.semester = parseInt(semester) || null;

    if (Object.keys(updates).length === 0)
      return res.status(400).json({ message: 'No fields to update.' });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    logger.info(`Profile updated for user: ${user.email}`);
    res.json({ success: true, data: user.toPublicJSON() });
  } catch (err) { next(err); }
};

exports.uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });

    const user = await User.findById(req.user._id);

    // Delete old avatar from disk
    if (user.avatar && user.avatar.filename) {
      const oldPath = path.join(avatarDir, user.avatar.filename);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
        logger.info(`Deleted old avatar: ${user.avatar.filename}`);
      }
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    user.avatar = {
      filename: req.file.filename,
      url: avatarUrl,
      mimetype: req.file.mimetype,
      size: req.file.size,
    };

    await user.save();
    logger.info(`Avatar uploaded for: ${user.email} → ${req.file.filename}`);

    res.json({
      success: true,
      message: 'Avatar uploaded successfully.',
      data: { avatar: user.avatar },
    });
  } catch (err) { next(err); }
};

exports.deleteAvatar = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user.avatar || !user.avatar.filename)
      return res.status(404).json({ message: 'No avatar to delete.' });

    const filePath = path.join(avatarDir, user.avatar.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    user.avatar = { filename: null, url: null, mimetype: null, size: null };
    await user.save();

    logger.info(`Avatar deleted for: ${user.email}`);
    res.json({ success: true, message: 'Avatar deleted.' });
  } catch (err) { next(err); }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ message: 'currentPassword and newPassword are required.' });
    if (newPassword.length < 6)
      return res.status(400).json({ message: 'New password must be at least 6 characters.' });

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) return res.status(401).json({ message: 'Current password is incorrect.' });

    user.password = newPassword;
    await user.save();

    logger.info(`Password changed for: ${user.email}`);
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) { next(err); }
};
