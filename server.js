const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

// الإعدادات الأساسية
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// --- إضافة مسار اختباري للصفحة الرئيسية لإنهاء مشكلة الـ 404 ---
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Server is running successfully!",
    status: "Healthy"
  });
});

// تعريف المسارات الخاصة بك
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/subjects", require("./routes/subject.routes"));
app.use("/api/lectures", require("./routes/lecture.routes"));
app.use("/api/notifications", require("./routes/notification.routes"));
app.use("/api/attendance", require("./routes/attendance.routes"));
app.use("/api/references", require("./routes/reference.routes"));

// الاتصال بقاعدة البيانات
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected Successfully"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

// --- تعديل المنفذ ليتوافق مع Render ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
