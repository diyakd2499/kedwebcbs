const router = require("express").Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const auth = require("../middleware/auth.middleware");
const role = require("../middleware/role.middleware");

// تسجيل مستخدم جديد
router.post("/register", async (req, res) => {
  const hashed = await bcrypt.hash(req.body.password, 10);
  const user = await User.create({
    ...req.body,
    password: hashed
  });
  res.json(user);
});

// تسجيل الدخول
router.post("/login", async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) return res.status(401).json("User not found");

  const ok = await bcrypt.compare(req.body.password, user.password);
  if (!ok) return res.status(401).json("Wrong password");

  const token = jwt.sign(
    { id: user._id, roles: user.roles },
    process.env.JWT_SECRET
  );

  res.json({ token, user });
});

// جلب جميع المستخدمين (عميد فقط)
router.get("/", auth, role("dean"), async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (err) {
    res.status(400).json(err.message);
  }
});

// حذف مستخدم (عميد فقط)
router.delete("/:id", auth, role("dean"), async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json("User not found");
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(400).json(err.message);
  }
});

// تحديث بيانات المستخدم (عميد فقط)
router.put("/:id", auth, role("dean"), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select("-password");
    if (!user) return res.status(404).json("User not found");
    res.json(user);
  } catch (err) {
    res.status(400).json(err.message);
  }
});

module.exports = router;
