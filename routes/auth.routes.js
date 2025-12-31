const router = require("express").Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const auth = require("../middleware/auth.middleware");
const role = require("../middleware/role.middleware");
const crypto = require("crypto");

// إعدادات JWT
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

// ========== تسجيل مستخدم جديد (للعميد فقط) ==========
router.post("/register", auth, role("dean"), async (req, res) => {
  try {
    const { name, email, password, roles } = req.body;

    // التحقق من البيانات المطلوبة
    if (!name || !email || !password || !roles) {
      return res.status(400).json({ 
        success: false, 
        message: "الاسم، البريد الإلكتروني، كلمة المرور، والأدوار مطلوبة" 
      });
    }

    // التحقق من أن البريد الإلكتروني غير مستخدم
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: "البريد الإلكتروني مسجل مسبقاً" 
      });
    }

    // إنشاء المستخدم الجديد مع firstLogin = true
    // ملاحظة: يتم تشفير كلمة المرور تلقائياً في User model middleware
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: password,
      roles: Array.isArray(roles) ? roles : [roles],
      firstLogin: true, // إجبار تغيير كلمة المرور عند أول دخول
      isActive: true
    });

    // إرجاع بيانات المستخدم بدون كلمة المرور
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.resetPasswordCode;

    res.status(201).json({
      success: true,
      message: "تم إنشاء المستخدم بنجاح",
      user: userResponse
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(400).json({ 
      success: false, 
      message: err.message 
    });
  }
});

// ========== تسجيل الدخول ==========
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // التحقق من وجود البيانات
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "البريد الإلكتروني وكلمة المرور مطلوبان"
      });
    }

    // البحث عن المستخدم
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "بيانات الدخول غير صحيحة"
      });
    }

    // التحقق من حالة الحساب
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "الحساب غير نشط، يرجى التواصل مع الإدارة"
      });
    }

    // التحقق من قفل الحساب
    if (user.isLocked()) {
      const remainingTime = user.getLockRemainingTime();
      const minutes = Math.floor(remainingTime / 60);
      const seconds = remainingTime % 60;
      
      return res.status(423).json({
        success: false,
        message: `الحساب مقفل مؤقتاً. يرجى المحاولة بعد ${minutes} دقيقة و ${seconds} ثانية`,
        locked: true,
        remainingTime
      });
    }

    // التحقق من كلمة المرور
    const ok = await bcrypt.compare(password, user.password);

    if (!ok) {
      // تم إيقاف زيادة المحاولات والقفل بناءً على طلب المستخدم
      return res.status(401).json({
        success: false,
        message: "بيانات الدخول غير صحيحة"
      });
    }

    // إعادة تعيين المحاولات الفاشلة بعد تسجيل الدخول الناجح
    await user.resetFailedAttempts();

    // إنشاء توكن مع معلومات firstLogin
    const token = jwt.sign(
      { 
        id: user._id,
        email: user.email,
        roles: user.roles,
        name: user.name,
        firstLogin: user.firstLogin
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // إرجاع البيانات
    res.json({
      success: true,
      message: "تم تسجيل الدخول بنجاح",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        roles: user.roles,
        firstLogin: user.firstLogin
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({
      success: false,
      message: "حدث خطأ في الخادم"
    });
  }
});

// ========== طلب إعادة تعيين كلمة المرور (نسيت كلمة المرور) ==========
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "البريد الإلكتروني مطلوب"
      });
    }

    // البحث عن المستخدم
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // لأسباب أمنية، نعطي نفس الرسالة سواء كان المستخدم موجوداً أم لا
    if (!user) {
      return res.json({
        success: true,
        message: "إذا كان البريد الإلكتروني مسجل لدينا، ستصلك رسالة بالتعليمات خلال دقائق"
      });
    }

    // التحقق من حالة الحساب
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "الحساب غير نشط"
      });
    }

    // التحقق من إمكانية إعادة إرسال الكود (كل 30 ثانية)
    if (!user.canResendCode()) {
      return res.status(429).json({
        success: false,
        message: "الرجاء الانتظار 30 ثانية قبل طلب كود جديد",
        canResend: false
      });
    }

    // إنشاء كود جديد (6 أرقام)
    const resetCode = crypto.randomInt(100000, 999999).toString();
    user.resetPasswordCode = resetCode;
    user.resetPasswordExpires = new Date(Date.now() + 20 * 60 * 1000); // 20 دقيقة
    user.lastCodeSentAt = new Date();
    
    await user.save();

    // TODO: هنا يجب إرسال البريد الإلكتروني بالفعل
    // يمكنك استخدام nodemailer أو أي خدمة بريد أخرى
    console.log(`Password reset code for ${user.email}: ${resetCode}`);
    
    // في بيئة الإنتاج، أزل console.log واستخدم خدمة البريد الإلكتروني

    res.json({
      success: true,
      message: "تم إرسال كود إعادة التعيين إلى بريدك الإلكتروني",
      email: user.email,
      expiresIn: 20 // بالدقائق
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({
      success: false,
      message: "حدث خطأ في الخادم"
    });
  }
});

// ========== التحقق من كود إعادة التعيين ==========
router.post("/verify-reset-code", async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: "البريد الإلكتروني والكود مطلوبان"
      });
    }

    // البحث عن المستخدم
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "المستخدم غير موجود"
      });
    }

    // التحقق من صحة الكود وانتهاء الصلاحية
    if (!user.resetPasswordCode || 
        user.resetPasswordCode !== code || 
        new Date() > user.resetPasswordExpires) {
      return res.status(400).json({
        success: false,
        message: "الكود غير صالح أو منتهي الصلاحية"
      });
    }

    // إنشاء توكن مؤقت للتحقق (صلاحية 10 دقائق)
    const tempToken = jwt.sign(
      { 
        id: user._id,
        email: user.email,
        resetCode: code,
        purpose: "password_reset"
      },
      JWT_SECRET,
      { expiresIn: "10m" }
    );

    res.json({
      success: true,
      message: "الكود صحيح",
      tempToken,
      email: user.email
    });
  } catch (err) {
    console.error("Verify code error:", err);
    res.status(500).json({
      success: false,
      message: "حدث خطأ في الخادم"
    });
  }
});

// ========== إعادة إرسال كود التحقق ==========
router.post("/resend-reset-code", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "البريد الإلكتروني مطلوب"
      });
    }

    // البحث عن المستخدم
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // لأسباب أمنية، نعطي نفس الرسالة
    if (!user) {
      return res.json({
        success: true,
        message: "إذا كان البريد الإلكتروني مسجل لدينا، ستصلك رسالة بالتعليمات خلال دقائق"
      });
    }

    // التحقق من إمكانية إعادة الإرسال
    if (!user.canResendCode()) {
      return res.status(429).json({
        success: false,
        message: "الرجاء الانتظار 30 ثانية قبل طلب كود جديد",
        canResend: false
      });
    }

    // إنشاء كود جديد
    const newCode = crypto.randomInt(100000, 999999).toString();
    user.resetPasswordCode = newCode;
    user.resetPasswordExpires = new Date(Date.now() + 20 * 60 * 1000);
    user.lastCodeSentAt = new Date();
    
    await user.save();

    // TODO: إرسال البريد الإلكتروني
    console.log(`New reset code for ${user.email}: ${newCode}`);

    res.json({
      success: true,
      message: "تم إعادة إرسال كود إعادة التعيين",
      email: user.email,
      expiresIn: 20
    });
  } catch (err) {
    console.error("Resend code error:", err);
    res.status(500).json({
      success: false,
      message: "حدث خطأ في الخادم"
    });
  }
});

// ========== إعادة تعيين كلمة المرور بعد التحقق ==========
router.post("/reset-password", async (req, res) => {
  try {
    const { tempToken, newPassword, confirmPassword } = req.body;

    if (!tempToken || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "جميع الحقول مطلوبة"
      });
    }

    // التحقق من تطابق كلمتي المرور
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "كلمتا المرور غير متطابقتين"
      });
    }

    // التحقق من قوة كلمة المرور
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل"
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "رابط إعادة التعيين منتهي الصلاحية أو غير صالح"
      });
    }

    // التحقق من الغرض من التوكن
    if (decoded.purpose !== "password_reset") {
      return res.status(401).json({
        success: false,
        message: "توكن غير صالح"
      });
    }

    // البحث عن المستخدم
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "المستخدم غير موجود"
      });
    }

    // التحقق من أن البريد الإلكتروني متطابق
    if (user.email !== decoded.email) {
      return res.status(401).json({
        success: false,
        message: "غير مصرح بهذه العملية"
      });
    }

    // التحقق من أن الكود لا يزال صالحاً
    if (!user.resetPasswordCode || 
        user.resetPasswordCode !== decoded.resetCode || 
        new Date() > user.resetPasswordExpires) {
      return res.status(400).json({
        success: false,
        message: "الكود منتهي الصلاحية. يرجى طلب كود جديد"
      });
    }

    // تحديث كلمة المرور (سيتم تشفيرها تلقائياً في User model middleware)
    user.password = newPassword;
    user.resetPasswordCode = null;
    user.resetPasswordExpires = null;
    user.firstLogin = false; // بعد إعادة التعيين، لم يعد أول دخول
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    
    await user.save();

    res.json({
      success: true,
      message: "تم إعادة تعيين كلمة المرور بنجاح"
    });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({
      success: false,
      message: "حدث خطأ في الخادم"
    });
  }
});

// ========== تغيير كلمة المرور عند أول دخول ==========
router.post("/force-change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "جميع الحقول مطلوبة"
      });
    }

    // التحقق من تطابق كلمتي المرور الجديدتين
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "كلمتا المرور الجديدتين غير متطابقتين"
      });
    }

    // التحقق من قوة كلمة المرور الجديدة
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل"
      });
    }

    // البحث عن المستخدم الحالي
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "المستخدم غير موجود"
      });
    }

    // التحقق من أن هذا هو أول دخول
    if (!user.firstLogin) {
      return res.status(400).json({
        success: false,
        message: "كلمة المرور تم تغييرها مسبقاً"
      });
    }

    // التحقق من كلمة المرور الحالية
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "كلمة المرور الحالية غير صحيحة"
      });
    }

    // التحقق من أن كلمة المرور الجديدة مختلفة عن القديمة
    const isSamePassword = await bcrypt.compare(newPassword, user.password);

    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "كلمة المرور الجديدة يجب أن تكون مختلفة عن القديمة"
      });
    }

    // تحديث كلمة المرور (سيتم تشفيرها تلقائياً في User model middleware)
    user.password = newPassword;
    user.firstLogin = false;
    user.passwordChangedAt = new Date();
    
    await user.save();

    // إنشاء توكن جديد بعد تغيير كلمة المرور
    const newToken = jwt.sign(
      { 
        id: user._id,
        email: user.email,
        roles: user.roles,
        name: user.name,
        firstLogin: false
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      message: "تم تغيير كلمة المرور بنجاح",
      token: newToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        roles: user.roles,
        firstLogin: false
      }
    });
  } catch (err) {
    console.error("Force change password error:", err);
    res.status(500).json({
      success: false,
      message: "حدث خطأ في الخادم"
    });
  }
});

// ========== تغيير كلمة المرور العادية ==========
router.post("/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "جميع الحقول مطلوبة"
      });
    }

    // التحقق من تطابق كلمتي المرور الجديدتين
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "كلمتا المرور الجديدتين غير متطابقتين"
      });
    }

    // التحقق من قوة كلمة المرور الجديدة
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل"
      });
    }

    // البحث عن المستخدم الحالي
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "المستخدم غير موجود"
      });
    }

    // التحقق من كلمة المرور الحالية
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "كلمة المرور الحالية غير صحيحة"
      });
    }

    // التحقق من أن كلمة المرور الجديدة مختلفة عن القديمة
    const isSamePassword = await bcrypt.compare(newPassword, user.password);

    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "كلمة المرور الجديدة يجب أن تكون مختلفة عن القديمة"
      });
    }

    // تحديث كلمة المرور (سيتم تشفيرها تلقائياً في User model middleware)
    user.password = newPassword;
    user.firstLogin = false;
    user.passwordChangedAt = new Date();
    
    await user.save();

    res.json({
      success: true,
      message: "تم تغيير كلمة المرور بنجاح"
    });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({
      success: false,
      message: "حدث خطأ في الخادم"
    });
  }
});

// ========== جلب جميع المستخدمين (للعميد فقط) ==========
router.get("/users", auth, role("dean"), async (req, res) => {
  try {
    const users = await User.find().select("-password -resetPasswordCode");
    res.json({
      success: true,
      count: users.length,
      users
    });
  } catch (err) {
    console.error("Get users error:", err);
    res.status(400).json({ 
      success: false, 
      message: err.message 
    });
  }
});

// ========== حذف مستخدم (للعميد فقط) ==========
router.delete("/users/:id", auth, role("dean"), async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ 
      success: false, 
      message: "المستخدم غير موجود" 
    });
    
    res.json({ 
      success: true, 
      message: "تم حذف المستخدم بنجاح" 
    });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(400).json({ 
      success: false, 
      message: err.message 
    });
  }
});

// ========== تحديث بيانات المستخدم (للعميد فقط) ==========
router.put("/users/:id", auth, role("dean"), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select("-password -resetPasswordCode");
    if (!user) return res.status(404).json({ 
      success: false, 
      message: "المستخدم غير موجود" 
    });
    
    res.json({
      success: true,
      message: "تم تحديث المستخدم بنجاح",
      user
    });
  } catch (err) {
    console.error("Update user error:", err);
    res.status(400).json({ 
      success: false, 
      message: err.message 
    });
  }
});

module.exports = router;
