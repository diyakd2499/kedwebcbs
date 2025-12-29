const router = require("express").Router();
const Subject = require("../models/Subject");
const auth = require("../middleware/auth.middleware");
const role = require("../middleware/role.middleware");

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
    res.status(400).json(err.message);
  }
});

// جلب كل المواد (أي مستخدم مسجّل)
router.get("/", auth, async (req, res) => {
  const subjects = await Subject.find().populate("doctor", "name email");
  res.json(subjects);
});

// جلب مادة واحدة
router.get("/:id", auth, async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id).populate("doctor", "name email");
    if (!subject) return res.status(404).json("Subject not found");
    res.json(subject);
  } catch (err) {
    res.status(400).json(err.message);
  }
});

// تحديث مادة (عميد أو دكتور)
router.put("/:id", auth, role("dean", "doctor"), async (req, res) => {
  try {
    const subject = await Subject.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate("doctor", "name email");
    if (!subject) return res.status(404).json("Subject not found");
    res.json(subject);
  } catch (err) {
    res.status(400).json(err.message);
  }
});

// حذف مادة (عميد أو دكتور)
router.delete("/:id", auth, role("dean", "doctor"), async (req, res) => {
  try {
    const subject = await Subject.findByIdAndDelete(req.params.id);
    if (!subject) return res.status(404).json("Subject not found");
    res.json({ message: "Subject deleted successfully" });
  } catch (err) {
    res.status(400).json(err.message);
  }
});

module.exports = router;
