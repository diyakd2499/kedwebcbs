module.exports = (...allowedRoles) => {
  return (req, res, next) => {
    const userRoles = req.user.roles;  // صلاحيات المستخدم الذي قام بتسجيل الدخول

    console.log("USER ROLES:", userRoles);  // هذا فقط للاختبار
    console.log("ALLOWED ROLES:", allowedRoles);  // هذا فقط للاختبار

    // تحقق مما إذا كانت صلاحيات المستخدم تحتوي على أي من الأدوار المسموح بها
    const hasPermission = allowedRoles.some(role =>
      userRoles.includes(role)
    );

    // إذا لم يكن للمستخدم أي من الأدوار المسموح بها، قم برفض الوصول
    if (!hasPermission) {
      return res.status(403).json("Access denied");  // رفض الوصول
    }

    next();  // المتابعة في المسار إذا كان لدى المستخدم الصلاحيات
  };
};
