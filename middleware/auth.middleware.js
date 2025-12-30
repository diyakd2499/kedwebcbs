const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ 
      success: false,
      message: "التوكن مطلوب للوصول إلى هذا المورد" 
    });
  }

  // التحقق من تنسيق التوكن (Bearer TOKEN)
  const parts = authHeader.split(" ");
  
  if (parts.length !== 2) {
    return res.status(401).json({ 
      success: false,
      message: "تنسيق التوكن غير صحيح" 
    });
  }

  const [scheme, token] = parts;

  if (!/^Bearer$/i.test(scheme)) {
    return res.status(401).json({ 
      success: false,
      message: "تنسيق التوكن غير صحيح (يجب أن يبدأ بـ Bearer)" 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key-change-in-production");
    
    // إضافة معلومات المستخدم إلى request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      roles: decoded.roles,
      name: decoded.name,
      firstLogin: decoded.firstLogin || false
    };
    
    next();
  } catch (err) {
    console.error("Token verification error:", err);
    
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ 
        success: false,
        message: "انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى" 
      });
    }
    
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ 
        success: false,
        message: "توكن غير صالح" 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: "حدث خطأ في المصادقة" 
    });
  }
};
