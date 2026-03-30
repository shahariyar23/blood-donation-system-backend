import nodemailer from "nodemailer";
import env from "../../config/env";
interface EmailOptions {
  to:      string;
  subject: string;
  html:    string;
}

const transporter = nodemailer.createTransport({
  host:   env.SMTP_HOST,
  port:   env.SMTP_PORT,
  secure: false,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});
export const sendEmail = async (options: EmailOptions): Promise<void> => {
  await transporter.sendMail({
    from:    `"BloodConnect" <${env.SMTP_USER}>`,
    to:      options.to,
    subject: options.subject,
    html:    options.html,
  });
};