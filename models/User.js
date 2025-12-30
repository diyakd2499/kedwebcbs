const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, "الاسم مطلوب"],
    trim: true
  },
  
  email: { 
    type: String, 
    required: [true, "البريد الإلكتروني مطلوب"], 
    unique: true,
    trim: true,
    lowercase: true
  },
  
  password: { 
    type: String, 
    required: [true, "كلمة المرور مطلوبة"]
  },
  
  roles: {
    type: [String],
    enum: ["student", "leader", "doctor", "dean"],
    default: ["student"]
  },
  
  // ==== الحقول الجديدة ====
  
  // أول دخول للمستخدم (إجباري تغيير كلمة السر)
  firstLogin: {
    type: Boolean,
    default: true
  },
  
  // كود استعادة كلمة السر
  resetPasswordCode: {
    type: String,
    default: null
  },
  
  // تاريخ انتهاء صلاحية الكود (20 دقيقة)
  resetPasswordExpires: {
    type: Date,
    default: null
  },
  
  // تاريخ آخر تغيير لكلمة السر
  passwordChangedAt: {
    type: Date,
    default: null
  },
  
  // تاريخ آخر محاولة إرسال كود
  lastCodeSentAt: {
    type: Date,
    default: null
  },
  
  // حالة الحساب (نشط/موقوف)
  isActive: {
    type: Boolean,
    default: true
  },
  
  // عدد محاولات تسجيل الدخول الفاشلة
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  
  // وقت قفل الحساب بسبب محاولات فاشلة
  lockUntil: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// ==== Middleware قبل الحفظ ====

// تشفير كلمة السر قبل الحفظ
userSchema.pre('save', async function(next) {
  // فقط إذا تم تعديل كلمة السر
  if (!this.isModified('password')) return next();
  
  try {
    // تشفير كلمة السر
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    
    // تحديث وقت تغيير كلمة السر
    this.passwordChangedAt = Date.now();
    
    // إذا كان المستخدم جديداً، يتم تعيين firstLogin = true
    // إذا قام بتغيير كلمة السر، يتم تعيين firstLogin = false
    if (this.isNew) {
      this.firstLogin = true;
    } else {
      this.firstLogin = false;
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Middleware قبل التحديث: عند تغيير كلمة السر من قبل العميد (كلمة سر مؤقتة)
userSchema.pre('findOneAndUpdate', async function(next) {
  const update = this.getUpdate();
  
  // إذا تم تحديث كلمة السر في هذا التعديل
  if (update.password) {
    try {
      // تشفير كلمة السر الجديدة
      const salt = await bcrypt.genSalt(10);
      update.password = await bcrypt.hash(update.password, salt);
      
      // تعيين أول دخول = true لإجبار المستخدم على تغييرها
      update.firstLogin = true;
      update.passwordChangedAt = Date.now();
      
      this.setUpdate(update);
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

// ==== Methods ====

// مقارنة كلمة السر المدخلة مع المشفرة
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// التحقق إذا انتهت صلاحية كود الاستعادة
userSchema.methods.isResetCodeExpired = function() {
  if (!this.resetPasswordExpires) return true;
  return Date.now() > this.resetPasswordExpires;
};

// التحقق إذا كان يمكن إعادة إرسال الكود (كل 30 ثانية)
userSchema.methods.canResendCode = function() {
  if (!this.lastCodeSentAt) return true;
  
  const now = Date.now();
  const lastSent = new Date(this.lastCodeSentAt).getTime();
  const thirtySeconds = 30 * 1000; // 30 ثانية بالملي ثانية
  
  return (now - lastSent) > thirtySeconds;
};

// إنشاء كود استعادة عشوائي (6 أرقام)
userSchema.methods.generateResetCode = function() {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  this.resetPasswordCode = code;
  
  // صلاحية الكود 20 دقيقة
  this.resetPasswordExpires = new Date(Date.now() + 20 * 60 * 1000);
  
  // تحديث وقت آخر إرسال كود
  this.lastCodeSentAt = Date.now();
  
  return code;
};

// التحقق من صحة كود الاستعادة
userSchema.methods.verifyResetCode = function(code) {
  if (!this.resetPasswordCode || !this.resetPasswordExpires) return false;
  
  const isValidCode = this.resetPasswordCode === code;
  const isNotExpired = Date.now() < this.resetPasswordExpires;
  
  return isValidCode && isNotExpired;
};

// إعادة تعيين كلمة السر
userSchema.methods.resetPassword = async function(newPassword) {
  this.password = newPassword;
  this.resetPasswordCode = null;
  this.resetPasswordExpires = null;
  this.firstLogin = false;
  
  await this.save();
  return true;
};

// زيادة عدد محاولات الدخول الفاشلة
userSchema.methods.incrementFailedAttempts = function() {
  this.failedLoginAttempts += 1;
  
  // إذا كانت المحاولات 5 أو أكثر، قفل الحساب لمدة 15 دقيقة
  if (this.failedLoginAttempts >= 5) {
    this.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 دقيقة
  }
  
  return this.save();
};

// إعادة تعيين محاولات الدخول الفاشلة (عند تسجيل الدخول بنجاح)
userSchema.methods.resetFailedAttempts = function() {
  this.failedLoginAttempts = 0;
  this.lockUntil = null;
  return this.save();
};

// التحقق إذا كان الحساب مقفولاً
userSchema.methods.isLocked = function() {
  if (this.lockUntil) {
    return Date.now() < this.lockUntil;
  }
  return false;
};

// التحقق من صلاحية الحساب
userSchema.methods.isAccountActive = function() {
  return this.isActive && !this.isLocked();
};

// ==== Static Methods ====

// البحث عن مستخدم بالبريد الإلكتروني مع التحقق من النشاط
userSchema.statics.findByEmail = async function(email) {
  return await this.findOne({ 
    email: email.toLowerCase().trim(),
    isActive: true 
  });
};

// البحث عن مستخدم بكود الاستعادة الصالح
userSchema.statics.findByResetCode = async function(code) {
  return await this.findOne({
    resetPasswordCode: code,
    resetPasswordExpires: { $gt: Date.now() }
  });
};

// إلغاء جميع أكواد الاستعادة القديمة
userSchema.statics.invalidateOldCodes = async function() {
  return await this.updateMany(
    {
      resetPasswordExpires: { $lt: Date.now() }
    },
    {
      resetPasswordCode: null,
      resetPasswordExpires: null
    }
  );
};

module.exports = mongoose.model("User", userSchema);
