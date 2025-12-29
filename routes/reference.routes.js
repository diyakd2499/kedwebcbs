const router = require("express").Router();
const Reference = require("../models/Reference");
const auth = require("../middleware/auth.middleware");
const role = require("../middleware/role.middleware");
const upload = require("../config/multer");

// إضافة مرجع (عميد أو ليدر)
// رفع محاضرة (يجب أن يكون العميد أو الدكتور أو الليدر)
router.post("/", auth, role("dean", "doctor", "leader"), upload.single("file"), async (req, res) => {
  // العملية لإضافة المحاضرة هنا
  try {
    const reference = await Reference.create({
      title: req.body.title,
      subject: req.body.subject,
      link: req.body.link,
      file: req.file ? req.file.filename : null,
      addedBy: req.user.id
    });

    res.json(reference);
  } catch (err) {
    res.status(400).json(err.message);
  }
});
// جلب مراجع مادة معينة
router.get("/by-subject/:subjectId", auth, async (req, res) => {
  try {
    const { subjectId } = req.params;

    // التحقق: إذا كان المعرف "null" أو غير صالح، نرجع رسالة خطأ بدلاً من استرجاع بيانات خاطئة
    if (!subjectId || subjectId === "null" || subjectId === "undefined" || !mongoose.Types.ObjectId.isValid(subjectId)) {
      return res.status(400).json({ message: "معرف المادة غير صالح" }); // إرجاع رسالة خطأ واضحة
    }

    const refs = await Reference.find({
      subject: subjectId
    }).sort({ createdAt: -1 });

    res.json(refs);
  } catch (error) {
    console.error("Error fetching references:", error);
    res.status(500).json({ message: "خطأ في السيرفر" }); // إرجاع رسالة خطأ في السيرفر
  }
});


// جلب كل المراجع (أي مستخدم مسجّل)
router.get("/", auth, async (req, res) => {
  const refs = await Reference.find()
    .populate("subject", "name")
    .populate("addedBy", "name");

  res.json(refs);
});

// جلب مراجع مادة معيّنة
router.get("/by-subject/:subjectId", auth, async (req, res) => {
  try {
    const { subjectId } = req.params;
    
    // التحقق مما إذا كان المعرف صالحاً أو قيمته "null"
    if (!subjectId || subjectId === "null" || subjectId === "undefined") {
      return res.status(400).json({ message: "معرف المادة غير صالح" });
    }

    const refs = await Reference.find({
      subject: subjectId
    }).sort({ createdAt: -1 });

    res.json(refs);
  } catch (error) {
    console.error("Error fetching references:", error);
    res.status(500).json({ message: "خطأ في السيرفر" });
  }
});

module.exports = router;
