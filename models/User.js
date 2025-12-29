const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  roles: {
    type: [String],
    enum: ["student", "leader", "doctor", "dean"],
    default: ["student"] // يمكن إضافة عميد فقط كدور كامل
  }
});

module.exports = mongoose.model("User", userSchema);
