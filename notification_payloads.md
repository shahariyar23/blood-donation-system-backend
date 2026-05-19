# Notification Payloads Reference

This file contains all the Email and SMS payloads currently used across the backend codebase.
It is intended as a reference, no code in the application was modified.

---

## 📱 SMS Payloads

### 1. Self-Response to Blood Request Error
**Location:** `src/modules/bloodRequest/bloodRequest.service.ts`
```text
You created this blood request, so you cannot respond to it.
```

### 2. Blood Donation Confirmation
**Location:** `src/modules/donation/donation.service.ts`
```text
Thank you for donating blood! 🩸 You donated on ${donationDateStr}. You can donate again after ${nextDonationDateStr}. Toggle your availability to ON when ready to donate.
```

---

## 📧 Email Payloads

### 1. User Email Verification OTP
**Location:** `src/modules/auth/auth.service.ts`
```html
<h2>Email Verification</h2>
<p>Hi ${user.name},</p>
<p>Your verification code is:</p>
<div style="font-size:28px;font-weight:700;letter-spacing:4px;">${code}</div>
<p>This code expires in <strong>10 minutes</strong>.</p>
<p>If you did not request this, please ignore this email.</p>
<p>— BloodConnect Team</p>
```

### 2. User Password Reset Request
**Location:** `src/modules/auth/auth.service.ts`
```html
<h2>Password Reset Request</h2>
<p>Hi ${user.name},</p>
<p>
  You have <strong>${3 - user.passwordResetAttempts} attempt(s)</strong>
  remaining before lockout.
</p>
<p>Click below to reset your password. Expires in <strong>30 minutes</strong>.</p>
<a href="${resetUrl}"
   style="display:inline-block;padding:12px 28px;background:#e53e3e;
          color:white;border-radius:6px;text-decoration:none;margin:16px 0">
  Reset Password
</a>
<p>If you didn't request this, ignore this email.</p>
<p>— BloodConnect Team</p>
```

### 3. Hospital Registration Successful
**Location:** `src/modules/hospital/hospital.service.ts`
```html
<h2>Welcome to Blood Donation System</h2>
<p>Your hospital <strong>${data.hospitalName}</strong> has been successfully registered.</p>
<p><strong>Login Credentials:</strong></p>
<ul>
  <li>Email: ${data.email}</li>
  <li>Please use your password to login: ${data.password}</li>
</ul>
<p>Your hospital account is pending verification by our admin team.</p>
<p>Regards,<br/>Blood Donation System Team</p>
```

### 4. Hospital Password Reset Request
**Location:** `src/modules/hospital/hospital.service.ts`
```html
<h2>Password Reset Request</h2>
<p>You have requested to reset your password.</p>
<p>Click the link below to reset your password (valid for 15 minutes):</p>
<a href="${resetLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
  Reset Password
</a>
<p>Or copy this link: ${resetLink}</p>
<p>If you didn't request this, please ignore this email.</p>
<p>Regards,<br/>Blood Donation System Team</p>
```

### 5. Hospital Password Reset Successful
**Location:** `src/modules/hospital/hospital.service.ts`
```html
<h2>Password Reset Successful</h2>
<p>Your password has been successfully reset.</p>
<p>You can now login with your new password.</p>
<p>If you didn't make this change, please contact our support team immediately.</p>
<p>Regards,<br/>Blood Donation System Team</p>
```

### 6. Hospital Password Change Confirmation
**Location:** `src/modules/hospital/hospital.service.ts`
```html
<h2>Password Changed Successfully</h2>
<p>Your password for <strong>${hospital.hospitalName}</strong> has been successfully changed.</p>
<p><strong>Change Details:</strong></p>
<ul>
  <li>Changed at: ${new Date().toISOString()}</li>
  <li>IP Address: ${ipAddress || "unknown"}</li>
</ul>
<p>If you didn't make this change, please contact our support team immediately.</p>
<p>Regards,<br/>Blood Donation System Team</p>
```

### 7. Blood Donation Confirmation
**Location:** `src/modules/donation/donation.service.ts`
```html
<h2>Thank You for Donating Blood!</h2>
<p>Hi ${donorUser.name || "there"},</p>
<p><strong>Donation Date:</strong> ${donationDateStr}</p>
<p><strong>Blood Type Donated:</strong> ${donation.bloodType}</p>
<p><strong>Units Donated:</strong> ${donation.units} unit(s)</p>
<hr>
<p>You can donate again after <strong>${nextDonationDateStr}</strong></p>
<p>Please toggle your availability to "ON" when you're ready to donate again.</p>
<p>Thank you for saving lives! ❤️</p>
<p>Regards,<br/>Blood Donation Team</p>
```

### 8. Request Already Fulfilled (Notification to other Donors)
**Location:** `src/modules/donation/donation.service.ts`
```html
<h2>Thank you for your willingness to help</h2>
<p>Hi ${donorUser.name || "there"},</p>
<p>The blood request you responded to has already been fulfilled and the blood has been collected.</p>
<p>Thank you for being ready to donate and support the patient.</p>
<p>Regards,<br/>Blood Donation Team</p>
```

### 9. Donor Responded to Blood Request
**Location:** `src/modules/bloodRequest/bloodRequest.service.ts`
```html
<p>Hello,</p>
<p>A donor has responded to your blood request for <strong>${request.bloodType}</strong> (patient: ${request.patientName}).</p>
${donorInfo}
${message ? `<p><strong>Message from donor:</strong> ${message}</p>` : ""}
<p>Please login to your account to view and coordinate the donation.</p>
```
