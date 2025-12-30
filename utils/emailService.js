const nodemailer = require("nodemailer");

// إعدادات البريد الإلكتروني
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// دالة إرسال البريد الإلكتروني
const sendEmail = async ({ to, subject, html }) => {
  try {
    // في حالة التطوير، يمكن طباعة البريد في الكونسول بدلاً من إرساله
    if (process.env.NODE_ENV === "development") {
      console.log("=== DEVELOPMENT EMAIL ===");
      console.log("To:", to);
      console.log("Subject:", subject);
      console.log("HTML:", html);
      console.log("========================");
      return true;
    }

    const info = await transporter.sendMail({
      from: `"كلية تقنية المعلومات" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject,
      html
    });

    console.log("Email sent:", info.messageId);
    return true;
  } catch (error) {
    console.error("Email sending error:", error);
    return false;
  }
};

// دالة إرسال كود الاستعادة
const sendResetCodeEmail = async (user, code) => {
  const html = `
    <div dir="rtl">
      <h2>كود إعادة تعيين كلمة المرور</h2>
      <p>مرحباً ${user.name},</p>
      <p>لقد طلبت إعادة تعيين كلمة المرور لحسابك في نظام كلية تقنية المعلومات.</p>
      <p style="font-size: 24px; font-weight: bold; color: #0d3b66; padding: 10px; background: #f0f7ff; text-align: center; border-radius: 5px;">
        ${code}
      </p>
      <p>هذا الكود صالح لمدة <strong>20 دقيقة</strong> فقط.</p>
      <p>إذا لم تطلب إعادة تعيين كلمة المرور، يرجى تجاهل هذه الرسالة.</p>
      <hr>
      <p style="color: #666; font-size: 12px;">
        جامعة النصر التقنية - كلية تقنية المعلومات
      </p>
    </div>
  `;

  return await sendEmail({
    to: user.email,
    subject: "كود إعادة تعيين كلمة المرور",
    html
  });
};

module.exports = {
  sendEmail,
  sendResetCodeEmail
};
