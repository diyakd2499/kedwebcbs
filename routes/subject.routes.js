const router = require("express").Router();
const Subject = require("../models/Subject");
const auth = require("../middleware/auth.middleware");
const role = require("../middleware/role.middleware");
const mongoose = require("mongoose"); // لإجراء التحقق من المعرفات

// إنشاء مادة (عميد أو دكتور)
router.post("/", auth, role("dean", "doctor"), async (req, res) => {
  try {
    const subject = await Subject.create({
      name: req.body.name,
      level: req.body.level,
      doctor: req.user.id
    });
    res.json(subject);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// جلب كل المواد (أي مستخدم مسجّل)
router.get("/", auth, async (req, res) => {
  try {
    const subjects = await Subject.find().populate("doctor", "name email");
    res.json(subjects);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// جلب مادة واحدة
router.get("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    // التحقق: إذا كان المعرف "null" أو غير صالح
    if (!id || id === "null" || id === "undefined" || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "معرف المادة غير صالح" }); // إرجاع رسالة خطأ واضحة
    }

    const subject = await Subject.findById(id).populate("doctor", "name email");
    if (!subject) return res.status(404).json({ message: "Subject not found" });
    res.json(subject);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// تحديث مادة (عميد أو دكتور)
router.put("/:id", auth, role("dean", "doctor"), async (req, res) => {
  try {
    const { id } = req.params;

    // التحقق: إذا كان المعرف "null" أو غير صالح
    if (!id || id === "null" || id === "undefined" || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "معرف المادة غير صالح" });
    }

    const subject = await Subject.findByIdAndUpdate(id, req.body, { new: true }).populate("doctor", "name email");
    if (!subject) return res.status(404).json({ message: "Subject not found" });
    res.json(subject);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// حذف مادة (عميد أو دكتور)
router.delete("/:id", auth, role("dean", "doctor"), async (req, res) => {
  try {
    const { id } = req.params;

    // التحقق: إذا كان المعرف "null" أو غير صالح
    if (!id || id === "null" || id === "undefined" || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "معرف المادة غير صالح" });
    }

    const subject = await Subject.findByIdAndDelete(id);
    if (!subject) return res.status(404).json({ message: "Subject not found" });
    res.json({ message: "Subject deleted successfully" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
