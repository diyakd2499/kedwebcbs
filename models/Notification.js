const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    title: String,
    message: String,

    type: {
      type: String,
      enum: ["normal", "emergency"],
      default: "normal"
    },

    target: {
      type: String,
      enum: ["all", "students", "leaders"],
      default: "all"
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", NotificationSchema);
