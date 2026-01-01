const router = require("express").Router();
const StudentSubmission = require("../models/StudentSubmission");
const Assignment = require("../models/Assignment");
const auth = require("../middleware/auth.middleware");
const role = require("../middleware/role.middleware");
const upload = require("../config/multer");
const mongoose = require("mongoose");

// ============ مسارات الطلاب ============

// تسليم واجب جديد (الطلاب فقط)
router.post("/submit", auth, role("student"), upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "يجب رفع ملف التسليم" });
    }

    const { assignmentId, submissionType, notes } = req.body;

    // التحقق من صحة معرف التكليف
    if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
      return res.status(400).json({ message: "معرف التكليف غير صالح" });
    }

    // جلب بيانات التكليف
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: "التكليف غير موجود" });
    }

    // التحقق من موعد التسليم
    const now = new Date();
    const dueDateTime = new Date(assignment.dueDate);
    
    // تعيين الوقت المحدد للتسليم
    const [hours, minutes] = assignment.dueTime.split(":").map(Number);
    dueDateTime.setHours(hours, minutes, 0, 0);

    const isLate = now > dueDateTime;

    // منع التسليم بعد انتهاء الموعد
    if (isLate) {
      return res.status(400).json({ 
        message: "انتهى موعد التسليم. لا يمكن تسليم الواجب بعد الموعد المحدد.",
        dueDateTime: dueDateTime
      });
    }

    // التحقق من عدم تسليم الطالب للتكليف مسبقاً
    const existingSubmission = await StudentSubmission.findOne({
      assignment: assignmentId,
      student: req.user.id
    });

    if (existingSubmission) {
      return res.status(400).json({ message: "لقد قمت بتسليم هذا التكليف مسبقاً" });
    }

    // تحديد نوع الملف
    let fileType = "document";
    if (req.file.mimetype.startsWith("image/")) {
      fileType = "image";
    } else if (req.file.mimetype === "application/pdf") {
      fileType = "pdf";
    }

    // إنشاء التسليم الجديد
    const submission = await StudentSubmission.create({
      assignment: assignmentId,
      student: req.user.id,
      submissionType: submissionType,
      file: req.file.filename,
      fileType: fileType,
      notes: notes,
      isLate: false,
      submissionDate: now
    });

    // ملء البيانات المرجعية
    await submission.populate("assignment student");

    res.status(201).json({
      message: "تم تسليم الواجب بنجاح",
      submission: submission
    });
  } catch (err) {
    console.error("Error submitting assignment:", err);
    res.status(400).json({ message: err.message });
  }
});

// جلب تسليمات الطالب
router.get("/my-submissions", auth, role("student"), async (req, res) => {
  try {
    const submissions = await StudentSubmission.find({ student: req.user.id })
      .populate("assignment")
      .sort({ submissionDate: -1 });

    res.json(submissions);
  } catch (err) {
    res.status(500).json({ message: "خطأ في السيرفر" });
  }
});

// جلب تفاصيل تسليم واحد
router.get("/:id", auth, async (req, res) => {
  try {
    const submission = await StudentSubmission.findById(req.params.id)
      .populate("assignment")
      .populate("student", "name email")
      .populate("reviewedBy", "name");

    if (!submission) {
      return res.status(404).json({ message: "التسليم غير موجود" });
    }

    // التحقق من الصلاحية (الطالب صاحب التسليم أو الدكتور/العميد)
    if (req.user.id !== submission.student._id.toString() && 
        !req.user.roles.includes("dean") && 
        !req.user.roles.includes("doctor") &&
        !req.user.roles.includes("leader")) {
      return res.status(403).json({ message: "ليس لديك صلاحية للوصول إلى هذا التسليم" });
    }

    res.json(submission);
  } catch (err) {
    res.status(500).json({ message: "خطأ في السيرفر" });
  }
});

// ============ مسارات الدكاترة والعمداء والليدر ============

// جلب جميع التسليمات لتكليف معين
router.get("/assignment/:assignmentId/submissions", auth, role("dean", "doctor", "leader"), async (req, res) => {
  try {
    const { assignmentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
      return res.status(400).json({ message: "معرف التكليف غير صالح" });
    }

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: "التكليف غير موجود" });
    }

    // جلب التسليمات
    const submissions = await StudentSubmission.find({ assignment: assignmentId })
      .populate("student", "name email")
      .populate("reviewedBy", "name")
      .sort({ submissionDate: -1 });

    res.json(submissions);
  } catch (err) {
    res.status(500).json({ message: "خطأ في السيرفر" });
  }
});

// جلب الطلاب الذين لم يسلموا التكليف
router.get("/assignment/:assignmentId/not-submitted", auth, role("dean", "doctor", "leader"), async (req, res) => {
  try {
    const { assignmentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
      return res.status(400).json({ message: "معرف التكليف غير صالح" });
    }

    const assignment = await Assignment.findById(assignmentId).populate("subject");
    if (!assignment) {
      return res.status(404).json({ message: "التكليف غير موجود" });
    }

    // جلب جميع التسليمات للتكليف
    const submissions = await StudentSubmission.find({ assignment: assignmentId });
    const submittedStudentIds = submissions.map(s => s.student.toString());

    // جلب جميع الطلاب وتصفية من لم يسلموا
    const User = require("../models/User");
    const allStudents = await User.find({ roles: "student" }, "name email");
    const notSubmittedStudents = allStudents.filter(
      student => !submittedStudentIds.includes(student._id.toString())
    );

    res.json({
      assignment: assignment,
      notSubmitted: notSubmittedStudents,
      totalStudents: allStudents.length,
      submitted: submissions.length
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ message: "خطأ في السيرفر" });
  }
});

// تقييم التسليم (الدكتور/العميد/الليدر)
router.put("/:id/grade", auth, role("dean", "doctor", "leader"), async (req, res) => {
  try {
    const { grade, feedback } = req.body;

    // التحقق من صحة التقييم
    if (grade < 0 || grade > 100) {
      return res.status(400).json({ message: "التقييم يجب أن يكون بين 0 و 100" });
    }

    const submission = await StudentSubmission.findByIdAndUpdate(
      req.params.id,
      {
        grade: grade,
        feedback: feedback,
        status: "graded",
        reviewedBy: req.user.id,
        reviewDate: new Date()
      },
      { new: true }
    ).populate("student", "name email");

    if (!submission) {
      return res.status(404).json({ message: "التسليم غير موجود" });
    }

    res.json({
      message: "تم تقييم التسليم بنجاح",
      submission: submission
    });
  } catch (err) {
    res.status(500).json({ message: "خطأ في السيرفر" });
  }
});

// تحديث حالة التسليم
router.put("/:id/status", auth, role("dean", "doctor", "leader"), async (req, res) => {
  try {
    const { status } = req.body;

    if (!["pending", "reviewed", "graded"].includes(status)) {
      return res.status(400).json({ message: "حالة غير صحيحة" });
    }

    const submission = await StudentSubmission.findByIdAndUpdate(
      req.params.id,
      { status: status },
      { new: true }
    );

    if (!submission) {
      return res.status(404).json({ message: "التسليم غير موجود" });
    }

    res.json(submission);
  } catch (err) {
    res.status(500).json({ message: "خطأ في السيرفر" });
  }
});

module.exports = router;
