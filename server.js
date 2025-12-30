const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path"); // أضفنا هذا السطر للتعامل مع المسارات
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// تشغيل ملفات المرفقات
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --- إضافة تشغيل ملفات الواجهة (Frontend) ---
// افترضنا هنا أن ملفات الـ HTML والـ CSS موجودة في المجلد الرئيسي
// إذا كانت في مجلد اسمه public، غير '.' إلى 'public'
app.use(express.static(path.join(__dirname, "."))); 

// تعريف مسارات الـ API
app.use("/api/auth", require("./routes/auth.routes.js"));
app.use("/api/subjects", require("./routes/subject.routes.js"));
app.use("/api/lectures", require("./routes/lecture.routes.js"));
app.use("/api/notifications", require("./routes/notification.routes.js"));
app.use("/api/references", require("./routes/reference.routes.js"));
app.use("/api/attendance", require("./routes/attendance.routes"));

// تعديل المسار الرئيسي لفتح ملف index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html")); 
});

// الاتصال بقاعدة البيانات
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("DB Connected"))
  .catch(err => console.log(err));

// ملاحظة لـ Render: يفضل استخدام المنفذ من متغيرات البيئة
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
