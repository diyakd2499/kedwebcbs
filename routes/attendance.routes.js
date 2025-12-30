const router = require("express").Router();
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const auth = require("../middleware/auth.middleware");
const role = require("../middleware/role.middleware");

// جلب قائمة الطلاب لتسجيل الحضور
router.get("/students", auth, role("dean", "doctor"), async (req, res) => {
  try {
    const students = await User.find({ roles: "student" }).select("name email");
    res.json(students);
  } catch (err) {
    res.status(500).json(err.message);
  }
});

// تسجيل أو تحديث الحضور
router.post("/", auth, role("dean", "doctor"), async (req, res) => {
  const { subject, date, students } = req.body;
  try {
    const attendance = await Attendance.findOneAndUpdate(
      { subject, date, recordedBy: req.user.id },
      { students },
      { upsert: true, new: true }
    );
    res.json(attendance);
  } catch (err) {
    res.status(400).json(err.message);
  }
});

// جلب سجلات الحضور الخاصة بالمستخدم الحالي
router.get("/history", auth, role("dean", "doctor"), async (req, res) => {
  try {
    const history = await Attendance.find({ recordedBy: req.user.id })
      .populate("subject", "name")
      .sort({ date: -1 });
    res.json(history);
  } catch (err) {
    res.status(500).json(err.message);
  }
});

// جلب سجل حضور محدد
router.get("/:id", auth, role("dean", "doctor"), async (req, res) => {
  try {
    const record = await Attendance.findById(req.params.id)
      .populate("subject", "name")
      .populate("students.student", "name email");
    res.json(record);
  } catch (err) {
    res.status(404).json("Record not found");
  }
});

module.exports = router;
