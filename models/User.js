const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

// Helper function to check if a string is already hashed
const isHashed = (str) => {
  return str.startsWith("$2a$") || str.startsWith("$2b$");
};

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  // Only hash if the password is not already hashed
  if (!isHashed(this.password)) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }

  next();
});

module.exports = mongoose.model("User", userSchema);
