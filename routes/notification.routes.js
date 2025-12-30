const router = require("express").Router();
const Notification = require("../models/Notification");
const User = require("../models/User");
const auth = require("../middleware/auth.middleware");
const role = require("../middleware/role.middleware");

// إنشاء تنبيه (عميد أو دكتور أو ليدر فقط - الطلاب لا يمكنهم)
router.post("/", auth, role("dean", "doctor", "leader"), async (req, res) => {
  try {
    const notification = await Notification.create({
      title: req.body.title,
      message: req.body.message,
      type: req.body.type || "normal",
      createdBy: req.user.id
    });

    // جلب معلومات المرسل مع الدور
    const populatedNotification = await Notification.findById(notification._id)
      .populate({
        path: "createdBy",
        select: "name roles email",
        // تحويل الأدوار إلى نص مقروء للعربية
        transform: (doc) => {
          if (doc) {
            const userObj = doc.toObject();
            // إضافة اسم الدور بالعربية للاستخدام في الواجهة
            userObj.roleName = getRoleNameInArabic(userObj.roles[0]);
            return userObj;
          }
          return doc;
        }
      });

    res.json(populatedNotification);
  } catch (err) {
    console.error("Error creating notification:", err);
    res.status(400).json({ error: err.message });
  }
});

// جلب جميع التنبيهات
router.get("/", auth, async (req, res) => {
  try {
    const notifications = await Notification.find()
      .sort({
        type: -1, // الإشعارات الطارئة أولاً
        createdAt: -1 // الأحدث أولاً
      })
      .populate({
        path: "createdBy",
        select: "name roles email profileImage",
        transform: (doc) => {
          if (doc) {
            const userObj = doc.toObject();
            userObj.roleName = getRoleNameInArabic(userObj.roles[0]);
            return userObj;
          }
          return doc;
        }
      });

    res.json(notifications);
  } catch (err) {
    console.error("Error fetching notifications:", err);
    res.status(400).json({ error: err.message });
  }
});

// جلب عدد التنبيهات غير المقروءة للمستخدم الحالي
router.get("/unread-count", auth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      readBy: { $ne: req.user.id }
    });
    res.json({ count });
  } catch (err) {
    console.error("Error fetching unread count:", err);
    res.status(400).json({ error: err.message });
  }
});

// جلب الإشعارات الطارئة الجديدة فقط (لمنع التكرار في dashboard)
router.get("/emergency/new", auth, async (req, res) => {
  try {
    const lastCheckTime = parseInt(req.query.lastCheck) || 0;
    
    const emergencyNotifications = await Notification.find({
      type: "emergency",
      createdAt: { $gt: new Date(lastCheckTime) }
    })
    .sort({ createdAt: -1 })
    .populate({
      path: "createdBy",
      select: "name roles",
      transform: (doc) => {
        if (doc) {
          const userObj = doc.toObject();
          userObj.roleName = getRoleNameInArabic(userObj.roles[0]);
          return userObj;
        }
        return doc;
      }
    })
    .limit(10); // الحد الأقصى 10 إشعارات طارئة

    res.json(emergencyNotifications);
  } catch (err) {
    console.error("Error fetching emergency notifications:", err);
    res.status(400).json({ error: err.message });
  }
});

// تحديد تنبيه كمقروء للمستخدم الحالي
router.post("/read/:id", auth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ error: "التنبيه غير موجود" });
    }

    // إضافة المستخدم الحالي إلى قائمة المقروءين إذا لم يكن موجوداً
    if (!notification.readBy.includes(req.user.id)) {
      notification.readBy.push(req.user.id);
      await notification.save();
    }

    res.json({ 
      message: "تم تحديد التنبيه كمقروء",
      readBy: notification.readBy.length
    });
  } catch (err) {
    console.error("Error marking notification as read:", err);
    res.status(400).json({ error: err.message });
  }
});

// تحديد جميع التنبيهات كمقروءة للمستخدم الحالي
router.post("/read-all", auth, async (req, res) => {
  try {
    // تحديث جميع التنبيهات التي لم يقرأها المستخدم الحالي
    const result = await Notification.updateMany(
      { readBy: { $ne: req.user.id } },
      { $push: { readBy: req.user.id } }
    );

    res.json({ 
      message: "تم تحديد جميع التنبيهات كمقروءة",
      modifiedCount: result.modifiedCount
    });
  } catch (err) {
    console.error("Error marking all notifications as read:", err);
    res.status(400).json({ error: err.message });
  }
});

// حذف تنبيه (عميد أو دكتور أو ليدر فقط)
router.delete("/:id", auth, role("dean", "doctor", "leader"), async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ error: "التنبيه غير موجود" });
    }

    // يمكن إضافة تحقق إضافي: فقط منشئ الإشعار أو العميد يمكنه حذفه
    if (!req.user.roles.includes("dean") && notification.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ error: "ليس لديك صلاحية لحذف هذا التنبيه" });
    }

    await notification.deleteOne();
    
    res.json({ 
      message: "تم حذف التنبيه بنجاح",
      deletedId: req.params.id
    });
  } catch (err) {
    console.error("Error deleting notification:", err);
    res.status(400).json({ error: err.message });
  }
});

// دالة مساعدة: تحويل اسم الدور إلى العربية
function getRoleNameInArabic(role) {
  const roleMap = {
    "dean": "العميد",
    "doctor": "الدكتور",
    "leader": "الليدر", 
    "student": "الطالب",
    "admin": "المسؤول",
    "system": "النظام"
  };
  
  return roleMap[role] || role;
}

// دالة مساعدة: تنظيف الإشعارات القديمة (يمكن تفعيلها بواسطة Cron Job)
router.post("/cleanup-old", auth, role("dean", "admin"), async (req, res) => {
  try {
    const days = req.body.days || 30; // حذف الإشعارات الأقدم من 30 يوم افتراضياً
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const result = await Notification.deleteMany({
      type: "normal", // فقط الإشعارات العادية
      createdAt: { $lt: cutoffDate }
    });
    
    res.json({
      message: `تم تنظيف الإشعارات القديمة`,
      deletedCount: result.deletedCount,
      cutoffDate: cutoffDate.toISOString()
    });
  } catch (err) {
    console.error("Error cleaning up old notifications:", err);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
