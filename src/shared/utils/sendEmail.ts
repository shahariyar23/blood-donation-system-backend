import nodemailer from "nodemailer";

interface EmailOptions {
  to:      string;
  subject: string;
  html:    string;
}

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || "smtp.gmail.com",
  port:   Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  await transporter.sendMail({
    from:    `"BloodConnect" <${process.env.SMTP_USER}>`,
    to:      options.to,
    subject: options.subject,
    html:    options.html,
  });
};