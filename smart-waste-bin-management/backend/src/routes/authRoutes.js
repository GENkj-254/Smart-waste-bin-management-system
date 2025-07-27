const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/user');
require('dotenv').config();

// REGISTER route
router.post('/register', async (req, res) => {
  const { username, email, phoneNumber, password, role } = req.body;

  if (!username || !email || !phoneNumber || !password || !role) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    const normalizedUsername = username.toLowerCase();
    const existingUser = await User.findOne({
      $or: [{ username: normalizedUsername }, { email }]
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User with that email or username already exists.' });
    }

    const newUser = new User({
      username: normalizedUsername,
      email,
      phoneNumber,
      password,
      role
    });

    await newUser.save();

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        username: newUser.username,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

// LOGIN route
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  try {
    const normalizedUsername = username.toLowerCase();
    const user = await User.findOne({ username: normalizedUsername });

    if (!user) {
      console.log('[DEBUG] User not found for:', normalizedUsername);
      return res.status(401).json({ message: 'Invalid credentials - user not found' });
    }

    if (!user.isActive) {
      console.log('[DEBUG] User is not active:', normalizedUsername);
      return res.status(401).json({ message: 'User account is deactivated' });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      console.log('[DEBUG] Password mismatch for user:', normalizedUsername);
      return res.status(401).json({ message: 'Invalid credentials - password mismatch' });
    }

    console.log('[DEBUG] Login successful for:', normalizedUsername);

    const token = jwt.sign(
      {
        userId: user._id,
        username: user.username,
        role: user.role
      },
      process.env.JWT_SECRET || 'fallbacksecret',
      { expiresIn: '1h' }
    );

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        username: user.username,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Server error during login.' });
  }
});


module.exports = router;
