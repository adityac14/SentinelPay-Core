# SentinelPay API

A payment risk assessment REST API built for the Canadian fintech ecosystem. SentinelPay evaluates incoming payment requests against a multi-factor risk scoring engine and returns a detailed risk assessment — helping financial institutions detect and prevent fraudulent transactions before they are processed. Inspired by Symcor's Payee Verify product and Canada's push toward Real-Time Rail (RTR) and open banking in 2026.

> Built with Node.js, TypeScript, Express, MongoDB Atlas, and Zod.

---

## The Problem

Authorised Push Payment (APP) fraud is one of the fastest growing threats in Canadian financial services. A sender is tricked into authorising a payment to a fraudulent account — and once processed, funds are rarely recovered. Traditional systems check account existence but not risk — SentinelPay fills that gap.

---

## The Solution

SentinelPay evaluates every payment against 5 weighted risk factors and returns a composite risk score, risk level, and actionable recommendation in real time.

| Risk Factor | Weight | What it checks |
|---|---|---|
| Bank Code Validity | 20% | Is this a recognized Canadian institution? |
| Amount Anomaly | 30% | Is this amount unusually large? |
| Account Number Pattern | 20% | Does the account number look suspicious? |
| Payee Name Risk | 15% | Does the name contain suspicious patterns? |
| Transaction Velocity | 15% | Is this a round number or probe amount? |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Language | TypeScript |
| Framework | Express v5 |
| Database | MongoDB Atlas (Azure-hosted) |
| Validation | Zod v4 |
| Dev tools | ts-node-dev, Git |

---

## Architecture

SentinelPay follows a layered N-tier architecture — each layer has a single responsibility and communicates only with the layer directly below it:

```
HTTP Request
     ↓
Routes          — defines endpoints and applies middleware
     ↓
Middleware       — validates request data using Zod schemas
     ↓
Controller       — handles HTTP request/response concerns
     ↓
Service          — contains all business logic and risk scoring
     ↓
Repository       — handles all MongoDB queries
     ↓
MongoDB Atlas    — persists assessment documents
```

---

## Getting Started

### Prerequisites

- Node.js v18 or higher
- A MongoDB Atlas account (free tier works)
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/adityac14/sentinelpay-core.git
cd sentinelpay-core

# Install dependencies
npm install
```

### Environment Setup

Create a `.env` file in the project root:

```
PORT=3000
MONGODB_URI=mongodb://username:password@host1:27017,host2:27017,host3:27017/?ssl=true&replicaSet=atlas-xxx&authSource=admin&appName=SentinelPay-Core
DB_NAME=sentinelpay
```

> Note: Use the standard connection string from MongoDB Atlas (not the SRV format) if you are on Windows 11.

### Running the Server

```bash
# Development mode with hot reload
npm run dev

# Production build
npm run build
npm start
```

### Running the PowerShell Test Script

With the server running in one terminal, open a second terminal and run:

```powershell
.\test-api.ps1
```

---

## API Reference

### Base URL
```
http://localhost:3000
```

---

### GET /health

Verifies the server is running and responsive.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-04-12T00:15:58.696Z",
  "service": "SentinelPay API",
  "version": "1.0.0"
}
```

---

### POST /api/assessments/assess

Submits a payment for risk assessment. Returns a full risk breakdown with score, level, and recommendation.

**Request Body:**
```json
{
  "accountNumber": "1234567",
  "payeeName": "John Smith",
  "bankCode": "004",
  "paymentAmount": 500
}
```

**Response — 201 Created:**
```json
{
  "status": "success",
  "message": "Payment assessment completed",
  "data": {
    "referenceId": "PAY-20260412-001558-4821",
    "accountNumber": "1234567",
    "payeeName": "John Smith",
    "paymentAmount": 500,
    "overallRiskScore": 9,
    "riskLevel": "Low",
    "assessmentStatus": "Cleared",
    "riskFactors": [
      {
        "factor": "Bank Code Validity",
        "score": 0,
        "weight": 0.2,
        "description": "Bank code 004 is a recognized Canadian financial institution"
      }
    ],
    "recommendation": "Risk score 9/100 — payment cleared. No significant risk factors detected. Safe to proceed.",
    "createdAt": "2026-04-12T00:15:58.696Z"
  }
}
```

**Response — 400 Validation Error:**
```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": [
    {
      "field": "accountNumber",
      "message": "Account number must be at least 7 digits"
    }
  ]
}
```

---

### GET /api/assessments/:referenceId

Retrieves a single assessment by its reference ID.

**Response — 200 OK:**
```json
{
  "status": "success",
  "data": {
    "referenceId": "PAY-20260412-001558-4821",
    "overallRiskScore": 9,
    "riskLevel": "Low",
    "assessmentStatus": "Cleared"
  }
}
```

**Response — 404 Not Found:**
```json
{
  "status": "error",
  "message": "Assessment with reference ID PAY-20260412-001558-4821 not found"
}
```

---

### GET /api/assessments

Retrieves a paginated and optionally filtered list of assessments.

**Query Parameters (all optional):**

| Parameter | Description | Example |
|---|---|---|
| riskLevel | Filter by risk level | Low, Medium, High, Critical |
| assessmentStatus | Filter by status | Cleared, Flagged, Blocked |
| limit | Records per page | 10 |
| skip | Records to skip | 0 |

**Response — 200 OK:**
```json
{
  "status": "success",
  "data": [...],
  "pagination": {
    "total": 42,
    "limit": 10,
    "skip": 0,
    "totalPages": 5,
    "currentPage": 1
  }
}
```

---

## Risk Scoring

| Score Range | Risk Level | Assessment Status | Action |
|---|---|---|---|
| 0 - 39 | Low | Cleared | Safe to proceed |
| 40 - 69 | Medium | Flagged | Manual review recommended |
| 70 - 89 | High | Flagged | Escalate for review |
| 90 - 100 | Critical | Blocked | Do not process |

---

## Author

**Aditya Chattopadhyay**
- LinkedIn: [linkedin.com/in/aditya-chattopadhyay](https://www.linkedin.com/in/aditya-chattopadhyay/)
- GitHub: [github.com/adityac14](https://github.com/adityac14)
