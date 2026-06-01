const mongoose = require("mongoose");

const challengeSchema = new mongoose.Schema({
  deviceId: {
   type: String,
   required: true,
  },
  day: {
    type: Number,
    required: true,
  },

  title: {
    type: String,
    required: true,
  },

  hours: {
    type: Number,
    required: true,
  },

  notes: {
    type: String,
    default: "",
  },

  completedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Challenge", challengeSchema);