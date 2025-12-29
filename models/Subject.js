const router = require("express").Router();
const auth = require("../middleware/auth.middleware");
const role = require("../middleware/role.middleware");
const mongoose = require("mongoose");


const SubjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },
    level: {
      type: String,
      required: true
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Subject", SubjectSchema);
