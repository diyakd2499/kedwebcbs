const router = require("express").Router();
const mongoose = require("mongoose"); // أضفنا هذا السطر للتحقق من المعرفات
const Lecture = require("../models/Lecture");
const auth = require("../middleware/auth.middleware");
const role = require("../middleware/role.middleware");
const upload = require("../config/multer");

// رفع محاضرة (يجب أن يكون العميد أو الدكتور أو الليدر)
router.post("/", auth, role("dean", "doctor", "leader"), upload.single("file"), async (req, res) => {
  try {
    const lecture = await Lecture.create({
      title: req.body.title,
      subject: req.body.subject,
      videoUrl: req.body.videoUrl,
      file: req.file ? req.file.filename : null,
      uploadedBy: req.user.id
    });
    res.json(lecture);
  } catch (err) {
    res.status(400).json(err.message);
  }
});


// جلب جميع المحاضرات
router.get("/", auth, async (req, res) => {
  try {
    const lectures = await Lecture.find().populate("subject", "name").sort({ createdAt: -1 });
    res.json(lectures);
  } catch (err) {
    res.status(400).json(err.message);
  }
});

// حذف محاضرة
router.delete("/:id", auth, role("dean", "doctor", "leader"), async (req, res) => {
  try {
    const lecture = await Lecture.findByIdAndDelete(req.params.id);
    if (!lecture) return res.status(404).json("Lecture not found");
    res.json({ message: "Lecture deleted successfully" });
  } catch (err) {
    res.status(400).json(err.message);
  }
});

// جلب محاضرات مادة معينة (تم تعديله لمنع خطأ 400)
router.get("/by-subject/:subjectId", auth, async (req, res) => {
  try {
    const { subjectId } = req.params;
    
    // التحقق: إذا كان المعرف "null" أو غير صالح، نرجع قائمة فارغة فوراً
    if (!subjectId || subjectId === "null" || subjectId === "undefined" || !mongoose.Types.ObjectId.isValid(subjectId)) {
      return res.json([]); 
    }

    const lectures = await Lecture.find({
      subject: subjectId
    }).sort({ createdAt: -1 });
    
    res.json(lectures);
  } catch (err) {
    console.error("Lecture Error:", err.message);
    res.status(200).json([]); // نرجع قائمة فارغة حتى في حالة الخطأ لضمان استقرار الواجهة
  }
});

module.exports = router;