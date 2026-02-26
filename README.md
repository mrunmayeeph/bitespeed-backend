# 🚀 FluxKart Identity Reconciliation Service

This service is a backend implementation of the **Bitespeed Identity Reconciliation Task**.
It enables **FluxKart** to link multiple customer purchases made using different contact information (email/phone) into a single, unified customer identity.

---

## 🌐 Live Demo

### Endpoint

```
POST https://bitespeed-identity-api-iiod.onrender.com
```

### Headers

```
Content-Type: application/json
```

---

# 🛠️ Technical Design Decisions

## 1️⃣ Atomic Transactions for Data Integrity

The core reconciliation logic is wrapped inside a **Prisma database transaction (`$transaction`)**.

### Why?

In production, multiple orders from the same user could arrive simultaneously.  
Transactions prevent race conditions where two requests might create conflicting primary records at the exact same time.

---

## 2️⃣ The "Oldest is King" Merger Strategy

When a request bridges two previously separate customer clusters, the system performs a **Primary-to-Secondary Merge**.

### Logic

- Identify all involved primary contacts.
- Select the one with the earliest `createdAt` timestamp.
- Convert all other primaries into **secondary** contacts.
- Re-map all existing children to the oldest primary.
- Maintain a flat hierarchy.

This guarantees deterministic identity resolution.

---

## 3️⃣ Smart Search & Normalization

### 🔹 Input Normalization

- Emails are trimmed.
- Emails are converted to lowercase.

Example:

```
Doc@Brown.com → doc@brown.com
```
Prevents duplicate identities caused by case sensitivity.

### 🔹 Recursive Discovery

The search logic:

1. Finds direct matches (email or phone).
2. Extracts their `primaryContactId`.
3. Fetches the entire related cluster.

Even if a user provides:
- An old secondary email
- A brand-new phone number

The link to the original primary is preserved.
---

## 4️⃣ Efficient Response Formatting

The response consolidation ensures:

- Primary contact information is prioritized.
- All unique emails and phone numbers are collected.
- Null values are removed.
- Duplicate entries are purged.

---

# 🏗️ Project Structure

```
├── src/
│   ├── controllers/
│   │   └── contact.controller.ts
│   ├── services/
│   │   └── identity.service.ts
│   ├── lib/
│   │   └── prisma.ts
│   ├── routes.ts
│   └── server.ts
├── prisma/
│   └── schema.prisma
└── package.json
```

---

# 🧪 Testing the Service

You can test using `curl` or Postman.

---

## ✅ Test Case 1: Create New Primary

```bash
curl -X POST https://your-app-name.onrender.com/identify \
-H "Content-Type: application/json" \
-d '{"email": "lorraine@hillvalley.edu", "phoneNumber": "123456"}'
```
---

## ✅ Test Case 2: Create Secondary (New Email)

```bash
curl -X POST https://your-app-name.onrender.com/identify \
-H "Content-Type: application/json" \
-d '{"email": "mcfly@hillvalley.edu", "phoneNumber": "123456"}'
```
---

## ✅ Test Case 3: Merge Two Primaries

If:

- `george@hillvalley.edu` (Primary A)
- `biffsucks@hillvalley.edu` (Primary B)
  
Both exist, sending:

```bash
curl -X POST https://your-app-name.onrender.com/identify \
-H "Content-Type: application/json" \
-d '{"email": "george@hillvalley.edu", "phoneNumber": "phoneNumber_of_biff"}'
```

Will merge both clusters under the oldest primary.

---
# ⚙️ Local Setup

## 1️⃣ Clone Repository

```bash
git clone <your-repo-link>
cd bitespeed-identity
```

---

## 2️⃣ Install Dependencies

```bash
npm install
```
---

## 3️⃣ Configure Environment

Create a `.env` file:

```
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
```
---

## 4️⃣ Sync Database

```bash
npx prisma db push
```
---

## 5️⃣ Run Development Server

```bash
npm run dev
```
---

# 📌 Tech Stack

- Node.js
- Express
- TypeScript
- Prisma ORM
- PostgreSQL
- Render (Deployment)

---
# 📄 License

This project was built as part of the **Bitespeed Backend Task**.
