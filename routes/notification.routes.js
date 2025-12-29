const router = require("express").Router();
const Notification = require("../models/Notification");
const auth = require("../middleware/auth.middleware");
const role = require("../middleware/role.middleware");

// إنشاء تنبيه (عميد أو دكتور أو ليدر)
router.post("/", auth, role("dean", "doctor", "leader"), async (req, res) => {
  try {
    const notification = await Notification.create({
      title: req.body.title,
      message: req.body.message,
      type: req.body.type || "normal",
      createdBy: req.user.id
    });

    res.json(notification);
  } catch (err) {
    res.status(400).json(err.message);
  }
});

// جلب جميع التنبيهات
router.get("/", auth, async (req, res) => {
  try {
    const notifications = await Notification.find().sort({
      type: -1,
      createdAt: -1
    });

    res.json(notifications);
  } catch (err) {
    res.status(400).json(err.message);
  }
});

// جلب عدد التنبيهات غير المقروءة
router.get("/unread-count", auth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      readBy: { $ne: req.user.id }
    });
    res.json({ count });
  } catch (err) {
    res.status(400).json(err.message);
  }
});

// تحديد تنبيه كمقروء
router.post("/read/:id", auth, async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, {
      $addToSet: { readBy: req.user.id }
    });
    res.json({ message: "Notification marked as read" });
  } catch (err) {
    res.status(400).json(err.message);
  }
});

// تحديد جميع التنبيهات كمقروءة
router.post("/read-all", auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { readBy: { $ne: req.user.id } },
      { $addToSet: { readBy: req.user.id } }
    );
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    res.status(400).json(err.message);
  }
});

// حذف تنبيه (عميد أو دكتور أو ليدر)
router.delete("/:id", auth, role("dean", "doctor", "leader"), async (req, res) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id);
    if (!notification) return res.status(404).json("Notification not found");
    res.json({ message: "Notification deleted successfully" });
  } catch (err) {
    res.status(400).json(err.message);
  }
});

module.exports = router;
