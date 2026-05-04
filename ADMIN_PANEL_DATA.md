# Admin Panel Backend API - Complete Data Structure

---

## 1. ADMIN DASHBOARD ENDPOINT

### GET `/admin/dashboard`

**Response:**
```json
{
  "success": true,
  "message": "Dashboard data retrieved",
  "data": {
    "stats": {
      "totalUsers": 248,
      "totalAdmins": 2,
      "totalDonors": 180,
      "totalHospitals": 12,
      "activeUsers": 220,
      "pendingReports": 1,
      "totalReports": 45,
      "totalDonations": 156,
      "totalBloodRequests": 32
    },
    "recentUsers": [
      {
        "_id": "user_001",
        "name": "Mostak Shahariyar",
        "email": "22203208@luhot.edu",
        "phone": "+92-300-1234567",
        "avatar": null,
        "role": "donor",
        "bloodType": "O+",
        "isVerified": true,
        "isActive": true,
        "isDonorVerified": true,
        "communityFlags": 0,
        "createdAt": "2024-04-15T10:30:00Z"
      },
      {
        "_id": "user_002",
        "name": "Rakibul Islam Rifat",
        "email": "rakibulislamrefat26@gmail.com",
        "phone": "+92-300-2345678",
        "avatar": null,
        "role": "donor",
        "bloodType": "A+",
        "isVerified": true,
        "isActive": true,
        "isDonorVerified": true,
        "communityFlags": 0,
        "createdAt": "2024-04-10T14:20:00Z"
      },
      {
        "_id": "user_003",
        "name": "Jamil Hossain",
        "email": "jamilmd524@gmail.com",
        "phone": "+92-300-3456789",
        "avatar": null,
        "role": "donor",
        "bloodType": "B+",
        "isVerified": false,
        "isActive": true,
        "isDonorVerified": false,
        "communityFlags": 1,
        "createdAt": "2024-04-08T09:15:00Z"
      },
      {
        "_id": "user_004",
        "name": "Mehedi Hasan",
        "email": "rakibkhani880@gmail.com",
        "phone": "+92-300-4567890",
        "avatar": null,
        "role": "user",
        "bloodType": "AB+",
        "isVerified": true,
        "isActive": true,
        "isDonorVerified": false,
        "communityFlags": 0,
        "createdAt": "2024-04-05T11:45:00Z"
      }
    ],
    "recentReports": [
      {
        "_id": "report_001",
        "reason": "Inappropriate behavior",
        "status": "pending",
        "description": "User posted offensive content on donation request",
        "reportedBy": {
          "_id": "user_010",
          "name": "Ayesha Khan",
          "email": "ayesha.khan@example.com"
        },
        "reportedUser": {
          "_id": "user_005",
          "name": "Ali Ahmed",
          "email": "ali.ahmed@example.com"
        },
        "reviewedBy": null,
        "reviewNote": null,
        "createdAt": "2024-04-19T15:00:00Z"
      }
    ]
  }
}
```

---

## 2. ADMIN USERS ENDPOINT

### GET `/admin/users?page=1&limit=20&role=&search=`

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Records per page (default: 20)
- `role` - Filter by role (optional): "donor", "user", "hospital", "admin"
- `search` - Search by name or email (optional)

**Response:**
```json
{
  "success": true,
  "message": "Users retrieved",
  "data": {
    "users": [
      {
        "_id": "user_001",
        "name": "Mostak Shahariyar",
        "email": "22203208@luhot.edu",
        "phone": "+92-300-1234567",
        "avatar": null,
        "role": "donor",
        "bloodType": "O+",
        "isVerified": true,
        "isActive": true,
        "isDonorVerified": true,
        "communityFlags": 0,
        "createdAt": "2024-04-15T10:30:00Z"
      },
      {
        "_id": "user_002",
        "name": "Rakibul Islam Rifat",
        "email": "rakibulislamrefat26@gmail.com",
        "phone": "+92-300-2345678",
        "avatar": null,
        "role": "donor",
        "bloodType": "A+",
        "isVerified": true,
        "isActive": true,
        "isDonorVerified": true,
        "communityFlags": 0,
        "createdAt": "2024-04-10T14:20:00Z"
      },
      {
        "_id": "user_003",
        "name": "Jamil Hossain",
        "email": "jamilmd524@gmail.com",
        "phone": "+92-300-3456789",
        "avatar": null,
        "role": "donor",
        "bloodType": "B+",
        "isVerified": false,
        "isActive": true,
        "isDonorVerified": false,
        "communityFlags": 1,
        "createdAt": "2024-04-08T09:15:00Z"
      },
      {
        "_id": "user_004",
        "name": "Mehedi Hasan",
        "email": "rakibkhani880@gmail.com",
        "phone": "+92-300-4567890",
        "avatar": null,
        "role": "user",
        "bloodType": "AB+",
        "isVerified": true,
        "isActive": true,
        "isDonorVerified": false,
        "communityFlags": 0,
        "createdAt": "2024-04-05T11:45:00Z"
      },
      {
        "_id": "user_005",
        "name": "Fatima Ali",
        "email": "fatima.ali@example.com",
        "phone": "+92-300-5678901",
        "avatar": null,
        "role": "donor",
        "bloodType": "O-",
        "isVerified": true,
        "isActive": false,
        "isDonorVerified": true,
        "communityFlags": 5,
        "createdAt": "2024-03-20T08:00:00Z"
      },
      {
        "_id": "user_006",
        "name": "Hassan Khan",
        "email": "hassan.khan@example.com",
        "phone": "+92-300-6789012",
        "avatar": null,
        "role": "user",
        "bloodType": "A-",
        "isVerified": false,
        "isActive": true,
        "isDonorVerified": false,
        "communityFlags": 0,
        "createdAt": "2024-03-15T12:30:00Z"
      },
      {
        "_id": "user_007",
        "name": "Zainab Ahmed",
        "email": "zainab.ahmed@example.com",
        "phone": "+92-300-7890123",
        "avatar": null,
        "role": "donor",
        "bloodType": "B-",
        "isVerified": true,
        "isActive": true,
        "isDonorVerified": false,
        "communityFlags": 0,
        "createdAt": "2024-03-10T16:45:00Z"
      }
    ],
    "pagination": {
      "total": 248,
      "page": 1,
      "limit": 20,
      "totalPages": 13,
      "hasPrevPage": false,
      "hasNextPage": true
    }
  }
}
```

---

## 3. UPDATE USER STATUS ENDPOINT

### PATCH `/admin/users/:id/status`

**Request:**
```json
{
  "isActive": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "User status updated successfully",
  "data": {
    "_id": "user_001",
    "isActive": false
  }
}
```

---

## 4. VERIFY DONOR ENDPOINT

### PATCH `/admin/users/:id/verify-donor`

**Request:** (No body needed)

**Response:**
```json
{
  "success": true,
  "message": "Donor verified successfully",
  "data": {
    "_id": "user_001",
    "isDonorVerified": true
  }
}
```

---

## 5. VERIFY USER ENDPOINT

### PATCH `/admin/users/:id/verify-user`

**Request:** (No body needed)

**Response:**
```json
{
  "success": true,
  "message": "User verified successfully",
  "data": {
    "_id": "user_001",
    "isVerified": true
  }
}
```

---

## 6. UPDATE COMMUNITY FLAGS ENDPOINT

### PATCH `/admin/users/:id/community-flags`

**Request:**
```json
{
  "action": "increment",
  "value": 5
}
```

**Actions:**
- `increment` - Add to flags
- `decrement` - Remove from flags
- `set` - Set specific value

**Response:**
```json
{
  "success": true,
  "message": "Community flags updated successfully",
  "data": {
    "_id": "user_001",
    "communityFlags": 5
  }
}
```

---

## 7. ADMIN REPORTS ENDPOINT

### GET `/admin/reports?page=1&limit=20&status=pending`

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Records per page (default: 20)
- `status` - Filter by status: "pending", "reviewed", "dismissed"

**Response:**
```json
{
  "success": true,
  "message": "Reports retrieved",
  "data": {
    "reports": [
      {
        "_id": "report_001",
        "reason": "Inappropriate behavior",
        "status": "pending",
        "description": "User posted offensive content",
        "reportedBy": {
          "_id": "user_010",
          "name": "Ayesha Khan",
          "email": "ayesha.khan@example.com",
          "role": "user"
        },
        "reportedUser": {
          "_id": "user_005",
          "name": "Ali Ahmed",
          "email": "ali.ahmed@example.com",
          "role": "donor"
        },
        "reviewedBy": null,
        "reviewNote": null,
        "createdAt": "2024-04-19T15:00:00Z"
      },
      {
        "_id": "report_002",
        "reason": "Spam",
        "status": "pending",
        "description": "Multiple false blood requests",
        "reportedBy": {
          "_id": "user_012",
          "name": "Muhammad Sami",
          "email": "sami@example.com",
          "role": "user"
        },
        "reportedUser": {
          "_id": "user_008",
          "name": "Hassan Raza",
          "email": "hassan.raza@example.com",
          "role": "user"
        },
        "reviewedBy": null,
        "reviewNote": null,
        "createdAt": "2024-04-18T10:30:00Z"
      },
      {
        "_id": "report_003",
        "reason": "Fraud",
        "status": "reviewed",
        "description": "Fake verification documents",
        "reportedBy": {
          "_id": "user_009",
          "name": "Sarah Johnson",
          "email": "sarah@example.com",
          "role": "admin"
        },
        "reportedUser": {
          "_id": "user_011",
          "name": "Ahmed Khan",
          "email": "ahmed.khan@example.com",
          "role": "donor"
        },
        "reviewedBy": {
          "_id": "admin_001",
          "name": "System Admin",
          "email": "admin@bloodconnect.com",
          "role": "admin"
        },
        "reviewNote": "User banned for 30 days",
        "createdAt": "2024-04-15T14:20:00Z"
      }
    ],
    "pagination": {
      "total": 45,
      "page": 1,
      "limit": 20,
      "totalPages": 3,
      "hasPrevPage": false,
      "hasNextPage": true
    }
  }
}
```

---

## 8. REVIEW REPORT ENDPOINT

### PATCH `/admin/reports/:id/review`

**Request:**
```json
{
  "status": "reviewed",
  "reviewNote": "User warned about behavior",
  "banUser": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Report reviewed successfully",
  "data": {
    "_id": "report_001",
    "status": "reviewed",
    "reviewedBy": "admin_001",
    "reviewNote": "User warned about behavior",
    "banUser": false
  }
}
```

---

## 9. ADMIN BLOOD REQUESTS ENDPOINT

### GET `/admin/blood-requests?page=1&limit=20&status=pending`

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Records per page (default: 20)
- `status` - Filter by status: "pending", "accepted", "fulfilled", "cancelled"

**Response:**
```json
{
  "success": true,
  "message": "Blood requests retrieved",
  "data": {
    "requests": [
      {
        "_id": "request_001",
        "hospital": {
          "_id": "hospital_001",
          "hospitalName": "City Medical Center",
          "email": "admin@cityhospital.com",
          "phone": "+92-300-5678901",
          "address": "123 Main Street, Lahore",
          "city": "Lahore"
        },
        "bloodType": "O+",
        "unitsNeeded": 2,
        "urgencyLevel": "critical",
        "reason": "Emergency surgery",
        "patientName": "Patient One",
        "status": "pending",
        "respondents": 5,
        "fulfilledUnits": 0,
        "createdAt": "2024-04-20T12:00:00Z",
        "expiresAt": "2024-04-27T12:00:00Z"
      },
      {
        "_id": "request_002",
        "hospital": {
          "_id": "hospital_002",
          "hospitalName": "National Hospital",
          "email": "admin@nationalhospital.com",
          "phone": "+92-300-1111111",
          "address": "456 Health Street, Islamabad",
          "city": "Islamabad"
        },
        "bloodType": "A+",
        "unitsNeeded": 1,
        "urgencyLevel": "high",
        "reason": "Scheduled surgery",
        "patientName": "Patient Two",
        "status": "accepted",
        "respondents": 3,
        "fulfilledUnits": 1,
        "createdAt": "2024-04-18T09:30:00Z"
      },
      {
        "_id": "request_003",
        "hospital": {
          "_id": "hospital_001",
          "hospitalName": "City Medical Center",
          "email": "admin@cityhospital.com",
          "phone": "+92-300-5678901",
          "address": "123 Main Street, Lahore",
          "city": "Lahore"
        },
        "bloodType": "B+",
        "unitsNeeded": 3,
        "urgencyLevel": "normal",
        "reason": "Regular transfusion",
        "patientName": "Patient Three",
        "status": "fulfilled",
        "respondents": 8,
        "fulfilledUnits": 3,
        "createdAt": "2024-04-15T14:00:00Z"
      }
    ],
    "pagination": {
      "total": 32,
      "page": 1,
      "limit": 20,
      "totalPages": 2,
      "hasPrevPage": false,
      "hasNextPage": true
    }
  }
}
```

---

## 10. ADMIN DONATIONS ENDPOINT

### GET `/admin/donations?page=1&limit=20`

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Records per page (default: 20)

**Response:**
```json
{
  "success": true,
  "message": "Donations retrieved",
  "data": {
    "donations": [
      {
        "_id": "donation_001",
        "donor": {
          "_id": "user_001",
          "name": "Mostak Shahariyar",
          "email": "22203208@luhot.edu",
          "bloodType": "O+"
        },
        "bloodBank": "Central Blood Bank",
        "bloodType": "O+",
        "unitsCollected": 1,
        "donationDate": "2024-04-15T10:00:00Z",
        "nextEligibleDate": "2024-07-15",
        "status": "completed",
        "notes": "Successful donation"
      },
      {
        "_id": "donation_002",
        "donor": {
          "_id": "user_002",
          "name": "Rakibul Islam Rifat",
          "email": "rakibulislamrefat26@gmail.com",
          "bloodType": "A+"
        },
        "bloodBank": "Central Blood Bank",
        "bloodType": "A+",
        "unitsCollected": 1,
        "donationDate": "2024-04-10T14:30:00Z",
        "nextEligibleDate": "2024-07-10",
        "status": "completed",
        "notes": "Donation process was smooth"
      },
      {
        "_id": "donation_003",
        "donor": {
          "_id": "user_003",
          "name": "Jamil Hossain",
          "email": "jamilmd524@gmail.com",
          "bloodType": "B+"
        },
        "bloodBank": "South Blood Bank",
        "bloodType": "B+",
        "unitsCollected": 1,
        "donationDate": "2024-04-08T11:15:00Z",
        "nextEligibleDate": "2024-07-08",
        "status": "completed",
        "notes": ""
      }
    ],
    "pagination": {
      "total": 156,
      "page": 1,
      "limit": 20,
      "totalPages": 8,
      "hasPrevPage": false,
      "hasNextPage": true
    }
  }
}
```

---

## 11. ADMIN VERIFICATIONS ENDPOINT

### GET `/admin/verifications?page=1&limit=20&status=pending`

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Records per page (default: 20)
- `status` - Filter by status: "pending", "verified", "rejected"

**Response:**
```json
{
  "success": true,
  "message": "Verifications retrieved",
  "data": {
    "verifications": [
      {
        "_id": "verification_001",
        "user": {
          "_id": "user_003",
          "name": "Jamil Hossain",
          "email": "jamilmd524@gmail.com",
          "bloodType": "B+",
          "phone": "+92-300-3456789"
        },
        "documentType": "donor_license",
        "documentUrl": "https://...",
        "status": "pending",
        "submittedAt": "2024-04-19T10:00:00Z",
        "notes": "Waiting for review"
      },
      {
        "_id": "verification_002",
        "user": {
          "_id": "user_006",
          "name": "Hassan Khan",
          "email": "hassan.khan@example.com",
          "bloodType": "A-",
          "phone": "+92-300-6789012"
        },
        "documentType": "health_certificate",
        "documentUrl": "https://...",
        "status": "pending",
        "submittedAt": "2024-04-18T14:30:00Z",
        "notes": ""
      },
      {
        "_id": "verification_003",
        "user": {
          "_id": "user_007",
          "name": "Zainab Ahmed",
          "email": "zainab.ahmed@example.com",
          "bloodType": "B-",
          "phone": "+92-300-7890123"
        },
        "documentType": "donor_license",
        "documentUrl": "https://...",
        "status": "verified",
        "submittedAt": "2024-04-15T09:00:00Z",
        "verifiedAt": "2024-04-16T11:30:00Z",
        "verifiedBy": "admin_001",
        "notes": "Document verified and approved"
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 20,
      "totalPages": 1,
      "hasPrevPage": false,
      "hasNextPage": false
    }
  }
}
```

---

## 12. APPROVE/REJECT VERIFICATION ENDPOINT

### PATCH `/admin/verifications/:id/verify`

**Request:**
```json
{
  "status": "verified",
  "notes": "Document verified and approved",
  "approvedBy": "admin_001"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Verification updated successfully",
  "data": {
    "_id": "verification_001",
    "status": "verified",
    "verifiedAt": "2024-04-20T10:30:00Z"
  }
}
```

---

## 13. ADMIN SETTINGS ENDPOINT

### GET `/admin/settings`

**Response:**
```json
{
  "success": true,
  "message": "Settings retrieved",
  "data": {
    "systemSettings": {
      "appName": "BloodConnect",
      "version": "1.0.0",
      "maintenanceMode": false,
      "donationEligibilityDays": 90,
      "autoEmailNotifications": true,
      "emailNotificationDelay": 24
    },
    "bloodBankSettings": {
      "minDonorsPerBank": 50,
      "maxRequestsPerDay": 100,
      "requestExpirationDays": 7
    },
    "userSettings": {
      "maxReportsPerDay": 5,
      "minCommunityFlagsToBlock": 10,
      "autoVerifyDonors": false
    }
  }
}
```

---

## 14. UPDATE SETTINGS ENDPOINT

### PATCH `/admin/settings`

**Request:**
```json
{
  "maintenanceMode": false,
  "donationEligibilityDays": 90,
  "autoEmailNotifications": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Settings updated successfully",
  "data": {
    "maintenanceMode": false,
    "donationEligibilityDays": 90,
    "autoEmailNotifications": true
  }
}
```

---

## 15. ADMIN ME ENDPOINT

### GET `/admin/me`

**Response:**
```json
{
  "success": true,
  "message": "Admin profile retrieved",
  "data": {
    "_id": "admin_001",
    "name": "System Admin",
    "email": "admin@bloodconnect.com",
    "phone": "+92-300-9999999",
    "avatar": null,
    "role": "admin",
    "isVerified": true,
    "isActive": true,
    "createdAt": "2023-01-01T00:00:00Z",
    "updatedAt": "2024-04-20T15:00:00Z"
  }
}
```

---

## ADMIN DATABASE COLLECTIONS

### MongoDB Users Collection (Admin Users)
```javascript
db.users.insertMany([
  {
    _id: ObjectId(),
    name: "Mostak Shahariyar",
    email: "22203208@luhot.edu",
    password: "hashed_password",
    phone: "+92-300-1234567",
    avatar: null,
    role: "donor",
    bloodType: "O+",
    isVerified: true,
    isActive: true,
    isDonorVerified: true,
    communityFlags: 0,
    totalDonations: 5,
    lastLoginAt: new Date("2024-04-20T10:00:00Z"),
    createdAt: new Date("2024-04-15T10:30:00Z"),
    updatedAt: new Date("2024-04-20T10:00:00Z")
  },
  {
    _id: ObjectId(),
    name: "Rakibul Islam Rifat",
    email: "rakibulislamrefat26@gmail.com",
    password: "hashed_password",
    phone: "+92-300-2345678",
    avatar: null,
    role: "donor",
    bloodType: "A+",
    isVerified: true,
    isActive: true,
    isDonorVerified: true,
    communityFlags: 0,
    totalDonations: 3,
    lastLoginAt: new Date("2024-04-19T14:30:00Z"),
    createdAt: new Date("2024-04-10T14:20:00Z"),
    updatedAt: new Date("2024-04-19T14:30:00Z")
  },
  {
    _id: ObjectId(),
    name: "Jamil Hossain",
    email: "jamilmd524@gmail.com",
    password: "hashed_password",
    phone: "+92-300-3456789",
    avatar: null,
    role: "donor",
    bloodType: "B+",
    isVerified: false,
    isActive: true,
    isDonorVerified: false,
    communityFlags: 1,
    totalDonations: 1,
    lastLoginAt: new Date("2024-04-18T09:00:00Z"),
    createdAt: new Date("2024-04-08T09:15:00Z"),
    updatedAt: new Date("2024-04-18T09:00:00Z")
  },
  {
    _id: ObjectId(),
    name: "Mehedi Hasan",
    email: "rakibkhani880@gmail.com",
    password: "hashed_password",
    phone: "+92-300-4567890",
    avatar: null,
    role: "user",
    bloodType: "AB+",
    isVerified: true,
    isActive: true,
    isDonorVerified: false,
    communityFlags: 0,
    totalDonations: 0,
    lastLoginAt: new Date("2024-04-17T12:15:00Z"),
    createdAt: new Date("2024-04-05T11:45:00Z"),
    updatedAt: new Date("2024-04-17T12:15:00Z")
  },
  {
    _id: ObjectId(),
    name: "Fatima Ali",
    email: "fatima.ali@example.com",
    password: "hashed_password",
    phone: "+92-300-5678901",
    avatar: null,
    role: "donor",
    bloodType: "O-",
    isVerified: true,
    isActive: false,
    isDonorVerified: true,
    communityFlags: 5,
    totalDonations: 8,
    lastLoginAt: new Date("2024-04-01T08:30:00Z"),
    createdAt: new Date("2024-03-20T08:00:00Z"),
    updatedAt: new Date("2024-04-01T08:30:00Z")
  }
])
```

---

### MongoDB Reports Collection
```javascript
db.reports.insertMany([
  {
    _id: ObjectId(),
    reason: "Inappropriate behavior",
    description: "User posted offensive content",
    reportedBy: ObjectId("user_010"),
    reportedUser: ObjectId("user_005"),
    status: "pending",
    reviewedBy: null,
    reviewNote: null,
    createdAt: new Date("2024-04-19T15:00:00Z"),
    updatedAt: new Date("2024-04-19T15:00:00Z")
  },
  {
    _id: ObjectId(),
    reason: "Spam",
    description: "Multiple false blood requests",
    reportedBy: ObjectId("user_012"),
    reportedUser: ObjectId("user_008"),
    status: "pending",
    reviewedBy: null,
    reviewNote: null,
    createdAt: new Date("2024-04-18T10:30:00Z"),
    updatedAt: new Date("2024-04-18T10:30:00Z")
  },
  {
    _id: ObjectId(),
    reason: "Fraud",
    description: "Fake verification documents",
    reportedBy: ObjectId("user_009"),
    reportedUser: ObjectId("user_011"),
    status: "reviewed",
    reviewedBy: ObjectId("admin_001"),
    reviewNote: "User banned for 30 days",
    createdAt: new Date("2024-04-15T14:20:00Z"),
    updatedAt: new Date("2024-04-16T10:00:00Z")
  }
])
```

---

### MongoDB Donations Collection
```javascript
db.donations.insertMany([
  {
    _id: ObjectId(),
    donorId: ObjectId("user_001"),
    bloodBank: "Central Blood Bank",
    bloodType: "O+",
    unitsCollected: 1,
    donationDate: new Date("2024-04-15T10:00:00Z"),
    nextEligibleDate: new Date("2024-07-15"),
    status: "completed",
    notes: "Successful donation",
    createdAt: new Date("2024-04-15T10:00:00Z")
  },
  {
    _id: ObjectId(),
    donorId: ObjectId("user_002"),
    bloodBank: "Central Blood Bank",
    bloodType: "A+",
    unitsCollected: 1,
    donationDate: new Date("2024-04-10T14:30:00Z"),
    nextEligibleDate: new Date("2024-07-10"),
    status: "completed",
    notes: "Donation process was smooth",
    createdAt: new Date("2024-04-10T14:30:00Z")
  }
])
```

---

### MongoDB Blood Requests Collection
```javascript
db.bloodRequests.insertMany([
  {
    _id: ObjectId(),
    hospital: ObjectId("hospital_001"),
    bloodType: "O+",
    unitsNeeded: 2,
    urgencyLevel: "critical",
    reason: "Emergency surgery",
    patientName: "Patient One",
    status: "pending",
    respondents: [
      {
        donor: ObjectId("user_001"),
        action: "accept",
        responseDate: new Date("2024-04-20T14:00:00Z")
      }
    ],
    createdAt: new Date("2024-04-20T12:00:00Z"),
    expiresAt: new Date("2024-04-27T12:00:00Z")
  }
])
```

---

### MongoDB Verifications Collection
```javascript
db.verifications.insertMany([
  {
    _id: ObjectId(),
    userId: ObjectId("user_003"),
    documentType: "donor_license",
    documentUrl: "https://...",
    status: "pending",
    submittedAt: new Date("2024-04-19T10:00:00Z"),
    verifiedAt: null,
    verifiedBy: null,
    notes: "Waiting for review"
  },
  {
    _id: ObjectId(),
    userId: ObjectId("user_007"),
    documentType: "donor_license",
    documentUrl: "https://...",
    status: "verified",
    submittedAt: new Date("2024-04-15T09:00:00Z"),
    verifiedAt: new Date("2024-04-16T11:30:00Z"),
    verifiedBy: ObjectId("admin_001"),
    notes: "Document verified and approved"
  }
])
```

---

## ERROR RESPONSES

### Standard Error
```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE",
  "statusCode": 400
}
```

### Unauthorized (401)
```json
{
  "success": false,
  "message": "Unauthorized - Invalid or expired token",
  "code": "UNAUTHORIZED",
  "statusCode": 401
}
```

### Forbidden (403)
```json
{
  "success": false,
  "message": "Forbidden - You don't have permission to access this resource",
  "code": "FORBIDDEN",
  "statusCode": 403
}
```

### Not Found (404)
```json
{
  "success": false,
  "message": "Resource not found",
  "code": "NOT_FOUND",
  "statusCode": 404
}
```

---

## SUMMARY OF ENDPOINTS

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/dashboard` | Dashboard stats & recent data |
| GET | `/admin/users` | List all users with pagination |
| PATCH | `/admin/users/:id/status` | Ban/Activate user |
| PATCH | `/admin/users/:id/verify-donor` | Verify donor |
| PATCH | `/admin/users/:id/verify-user` | Verify user |
| PATCH | `/admin/users/:id/community-flags` | Update community flags |
| GET | `/admin/reports` | List all reports |
| PATCH | `/admin/reports/:id/review` | Review report |
| GET | `/admin/blood-requests` | List blood requests |
| GET | `/admin/donations` | List all donations |
| GET | `/admin/verifications` | List verifications |
| PATCH | `/admin/verifications/:id/verify` | Approve/Reject verification |
| GET | `/admin/settings` | Get system settings |
| PATCH | `/admin/settings` | Update settings |
| GET | `/admin/me` | Get admin profile |

---

**Use the demo data provided and MongoDB collections structure to build your admin backend!**
