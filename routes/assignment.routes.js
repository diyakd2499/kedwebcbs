const router = require("express").Router();
const Assignment = require("../models/Assignment");
const auth = require("../middleware/auth.middleware");
const role = require("../middleware/role.middleware");
const upload = require("../config/multer");
const mongoose = require("mongoose");

// إضافة تكليف جديد (عميد، دكتور، ليدر)
router.post("/", auth, role("dean", "doctor", "leader"), upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "يجب رفع ملف التكليف" });
    }

    const assignment = await Assignment.create({
      title: req.body.title,
      description: req.body.description,
      type: req.body.type, // exercise, research, project
      subject: req.body.subject,
      file: req.file.filename,
      dueDate: req.body.dueDate,
      dueTime: req.body.dueTime || "23:59",
      addedBy: req.user.id
    });

    res.status(201).json(assignment);
  } catch (err) {
    console.error("Error creating assignment:", err);
    res.status(400).json({ message: err.message });
  }
});

// جلب التكاليف حسب النوع (تمارين، بحوث، مشاريع)
router.get("/type/:type", auth, async (req, res) => {
  try {
    const { type } = req.params;
    const assignments = await Assignment.find({ type })
      .populate("subject", "name")
      .populate("addedBy", "name")
      .sort({ createdAt: -1 });
    res.json(assignments);
  } catch (err) {
    res.status(500).json({ message: "خطأ في السيرفر" });
  }
});

// جلب التكاليف لمادة معينة حسب النوع
router.get("/by-subject/:subjectId/:type", auth, async (req, res) => {
  try {
    const { subjectId, type } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(subjectId)) {
      return res.status(400).json({ message: "معرف المادة غير صالح" });
    }

    const assignments = await Assignment.find({
      subject: subjectId,
      type: type
    }).populate("addedBy", "name").sort({ createdAt: -1 });

    res.json(assignments);
  } catch (err) {
    res.status(500).json({ message: "خطأ في السيرفر" });
  }
});

// حذف تكليف (الذي أضافه أو العميد)
router.delete("/:id", auth, role("dean", "doctor", "leader"), async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: "التكليف غير موجود" });
    }

    // التحقق من الصلاحية: العميد يمكنه حذف أي شيء، الآخرون يحذفون ما أضافوه فقط
    if (req.user.roles.includes("dean") || assignment.addedBy.toString() === req.user.id) {
      await Assignment.findByIdAndDelete(req.params.id);
      return res.json({ message: "تم حذف التكليف بنجاح" });
    }

    res.status(403).json({ message: "ليس لديك صلاحية لحذف هذا التكليف" });
  } catch (err) {
    res.status(500).json({ message: "خطأ في السيرفر" });
  }
});

module.exports = router;
