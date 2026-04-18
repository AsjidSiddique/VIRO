const User = require('../models/User');
const { generateToken } = require('../utils/jwt');
const logger = require('../utils/logger');

exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: 'All fields are required.' });

    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'Email already registered.' });

    const user = await User.create({ name, email, password });
    const token = generateToken(user._id);
    logger.info(`New user registered: ${email}`);

    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar, createdAt: user.createdAt },
    });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password required.' });

    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(401).json({ message: 'Invalid credentials.' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials.' });

    const token = generateToken(user._id);
    logger.info(`User logged in: ${email}`);

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar, createdAt: user.createdAt },
    });
  } catch (err) {
    next(err);
  }
};

exports.getMe = async (req, res) => {
  const u = req.user;
  res.json({
    user: { id: u._id, name: u.name, email: u.email, avatar: u.avatar, bio: u.bio, university: u.university, department: u.department, semester: u.semester, createdAt: u.createdAt },
  });
};

exports.logout = (req, res) => {
  res.json({ message: 'Logged out successfully.' });
};
