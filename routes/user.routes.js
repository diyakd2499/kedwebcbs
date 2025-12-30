const router = require("express").Router();
const User = require("../models/User");
const authMiddleware = require("../middleware/auth.middleware");
const roleMiddleware = require("../middleware/role.middleware");

// إنشاء مستخدم جديد (للعميد فقط)
router.post("/", authMiddleware, roleMiddleware("dean"), async (req, res) => {
  try {
    const { name, email, password, roles } = req.body;

    // التحقق من البيانات
    if (!name || !email || !password || !roles) {
      return res.status(400).json({
        success: false,
        message: "جميع الحقول مطلوبة"
      });
    }

    // التحقق من أن الأدوار صحيحة
    const validRoles = ["student", "leader", "doctor", "dean"];
    const invalidRoles = roles.filter(role => !validRoles.includes(role));
    
    if (invalidRoles.length > 0) {
      return res.status(400).json({
        success: false,
        message: `أدوار غير صحيحة: ${invalidRoles.join(", ")}`
      });
    }

    // التحقق من عدم وجود مستخدم بنفس البريد الإلكتروني
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "البريد الإلكتروني مسجل مسبقاً"
      });
    }

    // إنشاء المستخدم
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: password, // سيتم تشفيرها تلقائياً في middleware
      roles: Array.isArray(roles) ? roles : [roles],
      firstLogin: true, // إجبار تغيير كلمة السر عند أول دخول
      isActive: true
    });

    await user.save();

    // إرجاع بيانات المستخدم بدون كلمة السر
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: "تم إنشاء المستخدم بنجاح",
      user: userResponse
    });

  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({
      success: false,
      message: "حدث خطأ في الخادم"
    });
  }
});

// جلب جميع المستخدمين (للعميد فقط)
router.get("/", authMiddleware, roleMiddleware("dean"), async (req, res) => {
  try {
    const users = await User.find({})
      .select("-password -resetPasswordCode")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: users.length,
      users
    });

  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({
      success: false,
      message: "حدث خطأ في الخادم"
    });
  }
});

// جلب مستخدم محدد (للعميد فقط)
router.get("/:id", authMiddleware, roleMiddleware("dean"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password -resetPasswordCode");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "المستخدم غير موجود"
      });
    }

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      success: false,
      message: "حدث خطأ في الخادم"
    });
  }
});

// تحديث مستخدم (للعميد فقط)
router.put("/:id", authMiddleware, roleMiddleware("dean"), async (req, res) => {
  try {
    const { name, email, roles, isActive } = req.body;

    // التحقق من وجود المستخدم
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "المستخدم غير موجود"
      });
    }

    // التحقق من عدم تكرار البريد الإلكتروني
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ 
        email: email.toLowerCase().trim(),
        _id: { $ne: req.params.id }
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "البريد الإلكتروني مسجل لمستخدم آخر"
        });
      }
    }

    // تحديث البيانات
    const updateData = {};
    
    if (name) updateData.name = name.trim();
    if (email) updateData.email = email.toLowerCase().trim();
    if (roles) {
      const validRoles = ["student", "leader", "doctor", "dean"];
      const invalidRoles = roles.filter(role => !validRoles.includes(role));
      
      if (invalidRoles.length > 0) {
        return res.status(400).json({
          success: false,
          message: `أدوار غير صحيحة: ${invalidRoles.join(", ")}`
        });
      }
      
      updateData.roles = Array.isArray(roles) ? roles : [roles];
    }
    
    if (isActive !== undefined) updateData.isActive = isActive;

    // تنفيذ التحديث
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-password -resetPasswordCode");

    res.json({
      success: true,
      message: "تم تحديث المستخدم بنجاح",
      user: updatedUser
    });

  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({
      success: false,
      message: "حدث خطأ في الخادم"
    });
  }
});

// إعادة تعيين كلمة مرور مستخدم (للعميد فقط)
router.post("/:id/reset-password", authMiddleware, roleMiddleware("dean"), async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: "كلمة المرور الجديدة مطلوبة"
      });
    }

    // التحقق من قوة كلمة المرور
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل"
      });
    }

    // البحث عن المستخدم
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "المستخدم غير موجود"
      });
    }

    // تحديث كلمة المرور
    user.password = newPassword;
    user.firstLogin = true; // إجبار تغيير كلمة السر عند أول دخول
    await user.save();

    res.json({
      success: true,
      message: "تم إعادة تعيين كلمة المرور بنجاح"
    });

  } catch (error) {
    console.error("Reset user password error:", error);
    res.status(500).json({
      success: false,
      message: "حدث خطأ في الخادم"
    });
  }
});

// حذف مستخدم (للعميد فقط)
router.delete("/:id", authMiddleware, roleMiddleware("dean"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "المستخدم غير موجود"
      });
    }

    // لا يمكن حذف العميد الرئيسي
    if (user.roles.includes("dean") && user.email === "admin@university.edu") {
      return res.status(403).json({
        success: false,
        message: "لا يمكن حذف حساب العميد الرئيسي"
      });
    }

    await user.deleteOne();

    res.json({
      success: true,
      message: "تم حذف المستخدم بنجاح"
    });

  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "حدث خطأ في الخادم"
    });
  }
});

module.exports = router;
