const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const path = require("path");
const connectDB = require("./config/db");
const formatMessage = require("./utils/messages");
const {
  userJoin,
  getCurrentUser,
  userLeave,
  getRoomUsers,
} = require("./utils/users");
const Message = require("./models/Message");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("./models/User");

// Connect Database
connectDB();

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Init Middleware
app.use(express.json({ extended: false }));

// Set static folder
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "register.html"));
});

// Authentication Routes
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    console.log("Registration attempt:", { username, email });

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      console.log("User already exists:", { email, username });
      return res.status(400).json({ msg: "User already exists" });
    }

    // Create new user (password will be hashed by the User model's pre-save hook)
    const user = new User({
      username,
      email,
      password,
    });

    await user.save();
    console.log("User created successfully:", { username, email });

    // Create JWT token
    const token = jwt.sign({ id: user._id }, "your_jwt_secret", {
      expiresIn: "1h",
    });
    console.log("Generated token for new user");

    const responseData = {
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
      msg: "User registered successfully",
    };

    console.log("Sending registration response");
    res.status(201).json(responseData);
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ msg: "Server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const loginIdentifier = email; // This will now contain either username or email

    console.log("Login attempt with identifier:", loginIdentifier);
    console.log("Request body:", { email, password });

    // Check if user exists by either username or email
    const user = await User.findOne({
      $or: [{ email: loginIdentifier }, { username: loginIdentifier }],
    });

    if (!user) {
      console.log("User not found for identifier:", loginIdentifier);
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    console.log("User found:", {
      username: user.username,
      email: user.email,
      hasPassword: !!user.password,
    });

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    console.log("Password verification result:", isMatch);

    if (!isMatch) {
      console.log("Password mismatch for user:", user.username);
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    console.log("Password verified successfully");

    // Create JWT token
    const token = jwt.sign({ id: user._id }, "your_jwt_secret", {
      expiresIn: "1h",
    });
    console.log("Generated token:", token);

    const responseData = {
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    };

    console.log("Sending response:", responseData);
    res.json(responseData);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ msg: "Server error" });
  }
});

// Update Profile Route
app.put("/api/auth/update-profile", async (req, res) => {
  try {
    const { newUsername, email, currentPassword, newPassword } = req.body;
    const authHeader = req.headers.authorization;
    console.log("Auth header:", authHeader);

    const token = authHeader?.split(" ")[1];
    console.log("Extracted token:", token);

    if (!token) {
      return res.status(401).json({ msg: "No token, authorization denied" });
    }

    // Verify token
    try {
      const decoded = jwt.verify(token, "your_jwt_secret");
      console.log("Decoded token:", decoded);
      const user = await User.findById(decoded.id);
      console.log("Found user:", user ? user.username : "not found");

      if (!user) {
        return res.status(404).json({ msg: "User not found" });
      }

      // Update username if provided
      if (newUsername && newUsername !== user.username) {
        // Check if username is already taken
        const existingUser = await User.findOne({ username: newUsername });
        if (existingUser) {
          return res.status(400).json({ msg: "Username already taken" });
        }
        user.username = newUsername;
      }

      // Update email if provided
      if (email && email !== user.email) {
        // Check if email is already taken
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          return res.status(400).json({ msg: "Email already taken" });
        }
        user.email = email;
      }

      // Update password if provided
      if (currentPassword && newPassword) {
        console.log("=== Password Update Process Start ===");
        console.log("User before update:", {
          id: user._id,
          username: user.username,
          hasPassword: !!user.password,
        });

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        console.log("Current password verification:", {
          provided: currentPassword,
          matches: isMatch,
        });

        if (!isMatch) {
          console.log("Current password verification failed");
          return res.status(400).json({ msg: "Current password is incorrect" });
        }

        // Update user object with new password (will be hashed by User model)
        user.password = newPassword;
        console.log("User object updated with new password");

        // Save to database
        try {
          const savedUser = await user.save();
          console.log("User saved successfully:", {
            id: savedUser._id,
            username: savedUser.username,
            hasPassword: !!savedUser.password,
          });

          // Verify the password was saved correctly
          const verifyUser = await User.findById(user._id);
          const verifyMatch = await bcrypt.compare(
            newPassword,
            verifyUser.password
          );
          console.log("Password verification after save:", {
            matches: verifyMatch,
            hasPassword: !!verifyUser.password,
          });

          console.log("=== Password Update Process Complete ===");
        } catch (saveError) {
          console.error("Error saving user:", saveError);
          return res.status(500).json({ msg: "Error updating password" });
        }
      } else {
        console.log("No password update requested:", {
          currentPassword: !!currentPassword,
          newPassword: !!newPassword,
        });
      }

      await user.save();

      res.json({
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
        },
        msg: "Profile updated successfully",
      });
    } catch (jwtError) {
      console.error("JWT verification error:", jwtError);
      return res.status(401).json({ msg: "Invalid token" });
    }
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ msg: "Server error" });
  }
});

// Also handle POST requests for the same endpoint
app.post("/api/auth/update-profile", (req, res) => {
  // Forward to the PUT handler
  req.method = "PUT";
  return app._router.handle(req, res);
});

const botName = "ChatApp Bot";

// Run when client connects
io.on("connection", (socket) => {
  console.log("New WebSocket connection");

  // Join room
  socket.on("joinRoom", async ({ username, room, userId }) => {
    const user = userJoin(socket.id, username, room, userId);

    socket.join(user.room);

    // Welcome current user
    socket.emit("message", formatMessage(botName, "Welcome to ChatApp!"));

    // Broadcast when a user connects
    socket.broadcast
      .to(user.room)
      .emit(
        "message",
        formatMessage(botName, `${user.username} has joined the chat`)
      );

    // Send users and room info
    io.to(user.room).emit("roomUsers", {
      room: user.room,
      users: getRoomUsers(user.room),
    });

    // Send messages history
    try {
      const messages = await Message.find({ room })
        .sort({ createdAt: 1 })
        .limit(100);
      socket.emit("messageHistory", messages);
    } catch (err) {
      console.error(err);
    }
  });

  // Listen for chatMessage
  socket.on("chatMessage", async (msg) => {
    const user = getCurrentUser(socket.id);
    if (user) {
      const newMessage = new Message({
        user: user.mongoId,
        username: user.username,
        room: user.room,
        text: msg.text,
      });
      try {
        await newMessage.save();
        io.to(user.room).emit(
          "message",
          formatMessage(user.username, msg.text)
        );
      } catch (err) {
        console.error(err);
      }
    }
  });

  // Listen for privateMessage
  socket.on("privateMessage", async ({ recipientId, text }) => {
    const sender = getCurrentUser(socket.id);
    if (sender) {
      // Find the recipient's socket ID (assuming they are online and in the users array)
      const recipientUser = getRoomUsers(sender.room).find(
        (user) => user.mongoId === recipientId
      );

      const newMessage = new Message({
        user: sender.mongoId,
        username: sender.username,
        recipient: recipientId,
        text: text,
      });

      try {
        await newMessage.save();
        // Emit to sender
        socket.emit(
          "message",
          formatMessage(
            sender.username,
            `(Private to ${
              recipientUser ? recipientUser.username : "unknown user"
            }): ${text}`
          )
        );
        // Emit to recipient
        if (recipientUser) {
          io.to(recipientUser.id).emit(
            "message",
            formatMessage(
              sender.username,
              `(Private from ${sender.username}): ${text}`
            )
          );
        }
      } catch (err) {
        console.error(err);
      }
    }
  });

  // Listen for typing
  socket.on("typing", ({ room, isPrivate, recipientId }) => {
    const user = getCurrentUser(socket.id);
    if (user) {
      if (isPrivate && recipientId) {
        const recipientUser = getRoomUsers(user.room).find(
          (u) => u.mongoId === recipientId
        );
        if (recipientUser) {
          // Emit to recipient and sender themselves
          io.to(recipientUser.id).emit("typing", {
            username: user.username,
            isPrivate: true,
            senderId: user.mongoId,
          });
          io.to(user.id).emit("typing", {
            username: user.username,
            isPrivate: true,
            senderId: user.mongoId,
          });
        }
      } else if (room) {
        // Broadcast to all other users in the room
        socket.broadcast
          .to(room)
          .emit("typing", { username: user.username, isPrivate: false });
      }
    }
  });

  // Listen for stop typing
  socket.on("stopTyping", ({ room, isPrivate, recipientId }) => {
    const user = getCurrentUser(socket.id);
    if (user) {
      if (isPrivate && recipientId) {
        const recipientUser = getRoomUsers(user.room).find(
          (u) => u.mongoId === recipientId
        );
        if (recipientUser) {
          // Emit to recipient and sender themselves
          io.to(recipientUser.id).emit("stopTyping", {
            username: user.username,
            isPrivate: true,
            senderId: user.mongoId,
          });
          io.to(user.id).emit("stopTyping", {
            username: user.username,
            isPrivate: true,
            senderId: user.mongoId,
          });
        }
      } else if (room) {
        // Broadcast to all other users in the room
        socket.broadcast
          .to(room)
          .emit("stopTyping", { username: user.username, isPrivate: false });
      }
    }
  });

  // Runs when client disconnects
  socket.on("disconnect", () => {
    const user = userLeave(socket.id);
    if (user) {
      io.to(user.room).emit(
        "message",
        formatMessage(botName, `${user.username} has left the chat`)
      );

      // Send users and room info
      io.to(user.room).emit("roomUsers", {
        room: user.room,
        users: getRoomUsers(user.room),
      });
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
