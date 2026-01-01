const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // تم تغيير المسار ليكون المجلد الرئيسي مباشرة ليتوافق مع رابط الواجهة
    cb(null, "uploads"); 
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    // تأكد من كتابة null بحرفي l فقط
    cb(null, uniqueName + path.extname(file.originalname));
  }
});


const upload = multer({ storage });

module.exports = upload;
