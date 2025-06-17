const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/auth");

// @route   POST api/auth/register
// @desc    Register user
// @access  Public
router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  try {
    let user = await User.findOne({ email });

    if (user) {
      return res.status(400).json({ msg: "User already exists" });
    }

    user = new User({
      username,
      email,
      password,
    });

    await user.save();

    const payload = {
      user: {
        id: user.id,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: 360000 },
      (err, token) => {
        if (err) throw err;
        res.json({ token, userId: user.id, _id: user._id });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    let user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ msg: "Invalid Credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid Credentials" });
    }

    const payload = {
      user: {
        id: user.id,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: 360000 },
      (err, token) => {
        if (err) throw err;
        res.json({ token, userId: user.id, _id: user._id });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Update user profile
router.put("/update-profile", auth, async (req, res) => {
  try {
    const { newUsername, currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    console.log("Update profile request:", {
      newUsername,
      currentPassword,
      newPassword,
      userId,
    });

    // Get user from database
    const user = await User.findById(userId);
    if (!user) {
      console.log("User not found:", userId);
      return res.status(404).json({ msg: "User not found" });
    }

    // Update username if provided
    if (newUsername) {
      console.log("Updating username to:", newUsername);
      // Check if username is already taken
      const existingUser = await User.findOne({ username: newUsername });
      if (existingUser && existingUser._id.toString() !== userId) {
        console.log("Username already taken:", newUsername);
        return res.status(400).json({ msg: "Username is already taken" });
      }
      user.username = newUsername;
    }

    // Update password if provided
    if (newPassword) {
      console.log("Updating password");
      // Verify current password only if updating password
      if (!currentPassword) {
        console.log("Current password missing");
        return res
          .status(400)
          .json({ msg: "Current password is required to update password" });
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        console.log("Current password incorrect");
        return res.status(400).json({ msg: "Current password is incorrect" });
      }
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
    }

    await user.save();
    console.log("Profile updated successfully");

    res.json({
      msg: "Profile updated successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("Error updating profile:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
