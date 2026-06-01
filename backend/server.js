const Challenge = require("./models/Challenge");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const connectDB = require("./config/db");

dotenv.config();

connectDB();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
  res.send("21 Days Challenge Backend Running 🚀");
});

app.get("/health", (req, res) => {
  res.json({
    status: "success",
    message: "Server is healthy",
  });
});


app.post("/api/challenges", async (req, res) => {
  try {
    const challenge = await Challenge.create(req.body);

    res.status(201).json({
      success: true,
      data: challenge,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

app.get("/api/challenges", async (req, res) => {
  try {
    const challenges = await Challenge.find().sort({
      completedAt: -1,
    });

    res.json(challenges);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

app.get("/api/challenges/:deviceId", async (req, res) => {
  try {

    const challenges = await Challenge.find({
      deviceId: req.params.deviceId,
    }).sort({
      completedAt: -1,
    });

    res.json(challenges);

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

app.delete("/api/challenges/:deviceId", async (req, res) => {
  try {
    await Challenge.deleteMany({
      deviceId: req.params.deviceId,
    });

    res.json({
      success: true,
      message: "Challenge reset successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

