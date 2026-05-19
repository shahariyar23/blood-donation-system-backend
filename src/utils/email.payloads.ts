import env from "../config/env";

const BRAND = {
  name: "BloodConnect",
  logo:
    process.env.EMAIL_LOGO_URL ||
    "https://raw.githubusercontent.com/shahariyar23/bloodBankApiData/refs/heads/main/logo.png",
  primary: "#C0392B",
  primaryDark: "#96231A",
  bg: "#F8F8F8",
  cardBg: "#FFFFFF",
  text: "#2D2D2D",
  muted: "#666666",
  border: "#E0E0E0",
  site: env.CLIENT_URL,
};

const baseTemplate = (content: string): string => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${BRAND.name}</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.bg};font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.bg};padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0"
          style="background-color:${BRAND.cardBg};border-radius:10px;overflow:hidden;border:1px solid ${BRAND.border};max-width:600px;width:100%;">
          <tr>
            <td align="center" style="background-color:${BRAND.primary};padding:28px 32px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <img src="${BRAND.logo}" alt="${BRAND.name}" height="40"
                      onerror="this.style.display='none'"
                      style="display:block;height:40px;" />
                  </td>
                  <td style="padding-left:12px;">
                    <span style="color:#FFFFFF;font-size:22px;font-weight:700;letter-spacing:1px;">${BRAND.name}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px 28px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td align="center" style="background-color:#F2F2F2;border-top:1px solid ${BRAND.border};padding:20px 32px;">
              <p style="margin:0;font-size:12px;color:${BRAND.muted};">
                © ${new Date().getFullYear()} ${BRAND.name} · All rights reserved
              </p>
              <p style="margin:6px 0 0;font-size:12px;color:${BRAND.muted};">
                <a href="${BRAND.site}" style="color:${BRAND.primary};text-decoration:none;">Visit our website</a>
                &nbsp;·&nbsp;
                <a href="${BRAND.site}/support" style="color:${BRAND.primary};text-decoration:none;">Support</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const ctaButton = (label: string, href: string) => `
  <table cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
    <tr>
      <td align="center" style="background-color:${BRAND.primary};border-radius:6px;">
        <a href="${href}"
          style="display:inline-block;padding:13px 32px;color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;border-radius:6px;">
          ${label}
        </a>
      </td>
    </tr>
  </table>
`;

const infoRow = (label: string, value: string, highlight = false) => `
  <tr>
    <td style="padding:10px 14px;font-size:13px;font-weight:700;color:${BRAND.muted};background-color:#FAFAFA;border-bottom:1px solid ${BRAND.border};width:38%;border-right:1px solid ${BRAND.border};">
      ${label}
    </td>
    <td style="padding:10px 14px;font-size:14px;color:${highlight ? BRAND.primary : BRAND.text};font-weight:${highlight ? "700" : "400"};background-color:#FFFFFF;border-bottom:1px solid ${BRAND.border};">
      ${value}
    </td>
  </tr>
`;

const infoTable = (rows: string) => `
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
    style="border:1px solid ${BRAND.border};border-radius:8px;overflow:hidden;margin:20px 0;border-collapse:collapse;">
    ${rows}
  </table>
`;

const sectionHeading = (text: string) => `
  <h2 style="margin:0 0 6px;font-size:22px;font-weight:700;color:${BRAND.text};">
    ${text}
  </h2>
  <div style="width:40px;height:3px;background-color:${BRAND.primary};border-radius:2px;margin-bottom:20px;"></div>
`;

const greeting = (name: string) => `
  <p style="margin:0 0 18px;font-size:15px;color:${BRAND.text};">
    Hi <strong>${name}</strong>,
  </p>
`;

const para = (text: string) => `
  <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:${BRAND.muted};">
    ${text}
  </p>
`;

const alertBox = (text: string, color = BRAND.primary) => `
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background-color:#FFF5F5;border-left:4px solid ${color};border-radius:4px;margin:16px 0;">
    <tr>
      <td style="padding:14px 18px;font-size:14px;color:${BRAND.text};line-height:1.6;">
        ${text}
      </td>
    </tr>
  </table>
`;

const divider = () => `
  <hr style="border:none;border-top:1px solid ${BRAND.border};margin:24px 0;" />
`;

const signOff = (team = "BloodConnect Team") => `
  <p style="margin:20px 0 0;font-size:13px;color:${BRAND.muted};">
    Warm regards,<br/>
    <strong style="color:${BRAND.text};">${team}</strong>
  </p>
`;

export const emailVerificationOTPTemplate = (params: {
  name: string;
  code: string;
}): string =>
  baseTemplate(`
    ${sectionHeading("Email Verification")}
    ${greeting(params.name)}
    ${para("Use the verification code below to confirm your email address. This code is valid for <strong>10 minutes</strong>.")}
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
      <tr>
        <td align="center" style="background-color:#FFF5F5;border:2px dashed ${BRAND.primary};border-radius:10px;padding:28px;">
          <p style="margin:0 0 6px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.muted};">
            Your verification code
          </p>
          <span style="font-size:42px;font-weight:700;letter-spacing:10px;color:${BRAND.primary};">
            ${params.code}
          </span>
        </td>
      </tr>
    </table>
    ${alertBox("⚠️ If you did not request this code, please ignore this email. Do not share this code with anyone.")}
    ${signOff()}
  `);

export const userPasswordResetTemplate = (params: {
  name: string;
  resetUrl: string;
  attemptsRemaining: number;
}): string =>
  baseTemplate(`
    ${sectionHeading("Password Reset Request")}
    ${greeting(params.name)}
    ${para("We received a request to reset your password. Click the button below to proceed. The link expires in <strong>30 minutes</strong>.")}
    ${infoTable(
      infoRow("Attempts remaining", `${params.attemptsRemaining} of 3`, params.attemptsRemaining === 1),
    )}
    ${ctaButton("Reset My Password", params.resetUrl)}
    ${alertBox("🔒 If you didn't request a password reset, you can safely ignore this email. Your password will not change.")}
    ${signOff()}
  `);

export const hospitalRegistrationTemplate = (params: {
  hospitalName: string;
  email: string;
  password: string;
}): string =>
  baseTemplate(`
    ${sectionHeading("Hospital Registration Successful")}
    ${para(`Welcome to <strong>${BRAND.name}</strong>! Your hospital has been successfully registered.`)}
    ${infoTable(`
      ${infoRow("Hospital Name", params.hospitalName, true)}
      ${infoRow("Login Email", params.email)}
      ${infoRow("Temporary Password", params.password)}
    `)}
    ${alertBox("⏳ Your account is currently <strong>pending verification</strong> by our admin team. You will be notified once approved.")}
    ${para("For security, please change your password after your first login.")}
    ${signOff("Blood Donation System Team")}
  `);

export const hospitalPasswordResetRequestTemplate = (params: {
  resetLink: string;
}): string =>
  baseTemplate(`
    ${sectionHeading("Password Reset Request")}
    ${para("We received a request to reset the password for your hospital account. Click the button below to set a new password. This link is valid for <strong>15 minutes</strong>.")}
    ${ctaButton("Reset Password", params.resetLink)}
    ${infoTable(infoRow("Link expires in", "15 minutes", true))}
    ${para(`Or copy and paste this link into your browser:<br/>
      <a href="${params.resetLink}" style="color:${BRAND.primary};word-break:break-all;font-size:13px;">
        ${params.resetLink}
      </a>`)}
    ${alertBox("🔒 If you didn't request this, please ignore this email. Your password remains unchanged.")}
    ${signOff("Blood Donation System Team")}
  `);

export const hospitalPasswordResetSuccessTemplate = (): string =>
  baseTemplate(`
    ${sectionHeading("Password Reset Successful")}
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
      <tr>
        <td align="center">
          <div style="width:64px;height:64px;background-color:#EAF7ED;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:32px;line-height:64px;text-align:center;">
            ✅
          </div>
        </td>
      </tr>
    </table>
    ${para("Your hospital account password has been successfully reset. You can now log in with your new password.")}
    ${ctaButton("Login to Your Account", `${BRAND.site}/hospital/login`)}
    ${alertBox("⚠️ If you did not make this change, please contact our support team immediately.")}
    ${signOff("Blood Donation System Team")}
  `);

export const hospitalPasswordChangedTemplate = (params: {
  hospitalName: string;
  ipAddress?: string;
}): string =>
  baseTemplate(`
    ${sectionHeading("Password Changed")}
    ${para(`The password for your hospital account <strong>${params.hospitalName}</strong> was successfully changed.`)}
    ${infoTable(`
      ${infoRow("Hospital", params.hospitalName)}
      ${infoRow("Changed at", new Date().toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" }))}
      ${infoRow("IP Address", params.ipAddress ?? "Unknown")}
    `)}
    ${alertBox("⚠️ If you did not make this change, please contact our support team immediately so we can secure your account.")}
    ${signOff("Blood Donation System Team")}
  `);

export const donationConfirmationTemplate = (params: {
  donorName: string;
  donationDate: string;
  bloodType: string;
  units: number;
  nextDonationDate: string;
}): string =>
  baseTemplate(`
    ${sectionHeading("Thank You for Donating Blood! 🩸")}
    ${greeting(params.donorName)}
    ${para("Your donation has been recorded. You have made a real difference — one donation can save up to <strong>3 lives</strong>!")}
    ${infoTable(`
      ${infoRow("Donation Date", params.donationDate)}
      ${infoRow("Blood Type", params.bloodType, true)}
      ${infoRow("Units Donated", `${params.units} unit${params.units > 1 ? "s" : ""}`)}
      ${infoRow("Next Eligible Date", params.nextDonationDate, true)}
    `)}
    ${alertBox("🔔 When you're ready to donate again, please toggle your <strong>availability to ON</strong> in your profile so patients can find you.")}
    ${divider()}
    ${para("Thank you for saving lives! ❤️")}
    ${signOff("Blood Donation Team")}
  `);

export const requestAlreadyFulfilledTemplate = (params: {
  donorName: string;
}): string =>
  baseTemplate(`
    ${sectionHeading("Request Already Fulfilled")}
    ${greeting(params.donorName)}
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FFF5F5;border-radius:8px;margin:16px 0 24px;">
      <tr>
        <td align="center" style="padding:24px;">
          <p style="margin:0;font-size:16px;font-weight:700;color:${BRAND.primary};">
            The blood has been collected ✅
          </p>
          <p style="margin:8px 0 0;font-size:14px;color:${BRAND.muted};">
            The blood request you responded to has already been fulfilled.
          </p>
        </td>
      </tr>
    </table>
    ${para("Thank you for being ready to donate and support the patient. Your willingness to help is greatly appreciated — heroes like you make this community thrive.")}
    ${divider()}
    ${para("Keep your availability <strong>ON</strong> so you can be notified of future requests.")}
    ${signOff("Blood Donation Team")}
  `);

export const donorRespondedTemplate = (params: {
  bloodType: string;
  patientName: string;
  donorInfo: string;
  message?: string;
}): string =>
  baseTemplate(`
    ${sectionHeading("A Donor Has Responded! 🩸")}
    ${para("Great news! A donor has responded to your blood request. Please log in to coordinate the donation.")}
    ${infoTable(`
      ${infoRow("Blood Type Needed", params.bloodType, true)}
      ${infoRow("Patient Name", params.patientName)}
    `)}
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="border:1px solid ${BRAND.border};border-radius:8px;overflow:hidden;margin:20px 0;">
      <tr>
        <td style="background-color:${BRAND.primary};padding:10px 16px;">
          <span style="color:#FFFFFF;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">
            Donor Details
          </span>
        </td>
      </tr>
      <tr>
        <td style="padding:16px;font-size:14px;color:${BRAND.text};line-height:1.8;">
          ${params.donorInfo}
        </td>
      </tr>
    </table>
    ${
      params.message
        ? `${alertBox(`<strong>Message from donor:</strong><br/>${params.message}`)}`
        : ""
    }
    ${ctaButton("View Request & Coordinate", `${BRAND.site}/requests`)}
    ${signOff("BloodConnect Team")}
  `);
