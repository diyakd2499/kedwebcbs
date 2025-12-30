const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "عنوان التنبيه مطلوب"],
      trim: true,
      maxlength: [100, "العنوان يجب أن يكون أقل من 100 حرف"]
    },
    
    message: {
      type: String,
      required: [true, "رسالة التنبيه مطلوبة"],
      trim: true,
      maxlength: [500, "الرسالة يجب أن تكون أقل من 500 حرف"]
    },

    type: {
      type: String,
      enum: ["normal", "emergency"],
      default: "normal",
      index: true // فهرسة لتحسين أداء الاستعلامات حسب النوع
    },

    target: {
      type: String,
      enum: ["all", "students", "doctors", "leaders"],
      default: "all"
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true // فهرسة لتحسين أداء الاستعلامات حسب المنشئ
    },

    seenBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }],
    
    readBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }],
    
    // حقل للتحقق من الإشعارات المعروضة في dashboard لمنع التكرار
    shownInDashboard: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      shownAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  { 
    timestamps: true,
    // إضافة فهرسة إضافية لتحسين أداء الاستعلامات
    indexes: [
      { createdAt: -1 }, // للترتيب حسب الأحدث
      { type: 1, createdAt: -1 }, // للجمع بين النوع والوقت
      { createdBy: 1, createdAt: -1 } // للبحث حسب المنشئ والوقت
    ]
  }
);

// Middleware قبل الحفظ لتنظيف البيانات
NotificationSchema.pre('save', function(next) {
  if (this.title) {
    this.title = this.title.trim();
  }
  if (this.message) {
    this.message = this.message.trim();
  }
  next();
});

// دالة ستاتيكية لعد الإشعارات غير المقروءة لمستخدم معين
NotificationSchema.statics.countUnreadForUser = async function(userId) {
  return await this.countDocuments({
    readBy: { $ne: userId }
  });
};

// دالة ستاتيكية لجلب الإشعارات الطارئة الجديدة بعد وقت محدد
NotificationSchema.statics.getNewEmergencies = async function(lastCheckTime, limit = 10) {
  return await this.find({
    type: "emergency",
    createdAt: { $gt: new Date(lastCheckTime) }
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .populate('createdBy', 'name roles email');
};

// دالة لحذف الإشعارات القديمة تلقائياً (يمكن تفعيلها بواسطة Cron Job)
NotificationSchema.statics.cleanupOldNotifications = async function(days = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return await this.deleteMany({
    type: "normal", // حذف الإشعارات العادية فقط
    createdAt: { $lt: cutoffDate }
  });
};

// Virtual للحصول على عدد القراء
NotificationSchema.virtual('readCount').get(function() {
  return this.readBy.length;
});

// Virtual للحصول على عدد المشاهدين
NotificationSchema.virtual('seenCount').get(function() {
  return this.seenBy.length;
});

// Virtual للتحقق إذا كان الإشعار طارئ
NotificationSchema.virtual('isEmergency').get(function() {
  return this.type === "emergency";
});

// التحقق من أن المستخدم قد قرأ الإشعار
NotificationSchema.methods.hasRead = function(userId) {
  return this.readBy.some(id => id.toString() === userId.toString());
};

// التحقق من أن المستخدم قد شاهد الإشعار
NotificationSchema.methods.hasSeen = function(userId) {
  return this.seenBy.some(id => id.toString() === userId.toString());
};

// إضافة المستخدم إلى قائمة القراء
NotificationSchema.methods.markAsRead = function(userId) {
  if (!this.hasRead(userId)) {
    this.readBy.push(userId);
  }
  return this.save();
};

// إضافة المستخدم إلى قائمة المشاهدين
NotificationSchema.methods.markAsSeen = function(userId) {
  if (!this.hasSeen(userId)) {
    this.seenBy.push(userId);
  }
  return this.save();
};

// تسجيل عرض الإشعار في dashboard لمستخدم معين (لمنع التكرار)
NotificationSchema.methods.markAsShownInDashboard = function(userId) {
  const alreadyShown = this.shownInDashboard.some(
    entry => entry.userId.toString() === userId.toString()
  );
  
  if (!alreadyShown) {
    this.shownInDashboard.push({
      userId: userId,
      shownAt: new Date()
    });
  }
  
  return this.save();
};

// التحقق إذا تم عرض الإشعار في dashboard لمستخدم معين
NotificationSchema.methods.hasBeenShownInDashboard = function(userId) {
  return this.shownInDashboard.some(
    entry => entry.userId.toString() === userId.toString()
  );
};

module.exports = mongoose.model("Notification", NotificationSchema);
