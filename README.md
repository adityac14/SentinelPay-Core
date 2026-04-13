# SentinelPay API

A payment risk assessment REST API built for the Canadian fintech ecosystem. SentinelPay evaluates incoming payment requests against a multi-factor risk scoring engine and returns a detailed risk assessment — helping financial institutions detect and prevent fraudulent transactions before they are processed. Inspired by Symcor's Payee Verify product and Canada's push toward Real-Time Rail (RTR) and open banking in 2026.

**Deployed on Microsoft Azure App Service — Canada Central**

| | |
|---|---|
| **Base URL** | `https://sentinelpay-core-api-b4b0fzdvgwdnhtgc.canadacentral-01.azurewebsites.net` |
| **Health Check** | `https://sentinelpay-core-api-b4b0fzdvgwdnhtgc.canadacentral-01.azurewebsites.net/health` |
| **API Docs** | `https://sentinelpay-core-api-b4b0fzdvgwdnhtgc.canadacentral-01.azurewebsites.net/api-docs` |

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

| | Technology | Version |
|---|---|---|
| **Runtime** | Node.js | v22 LTS |
| **Language** | TypeScript | v6 |
| **Framework** | Express | v5 |
| **Database** | MongoDB Atlas | v6 (Azure-hosted) |
| **Validation** | Zod | v4 |
| **Cloud** | Microsoft Azure App Service | Canada Central |
| **CI/CD** | GitHub Actions | — |
| **Dev tools** | ts-node-dev, Git | — |

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
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority&appName=SentinelPay-Core
DB_NAME=sentinelpay
```

> **Note for Azure deployment:** Add your Azure App Service outbound IP addresses to MongoDB Atlas Network Access under **Security → Network Access**. Your outbound IPs are listed in the Azure Portal under **Networking → Outbound addresses**.

> **Note for Windows 11 local development:** Use the standard MongoDB connection string (not SRV format) to bypass a Windows DNS resolver issue with SRV records.

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

Full interactive API documentation is available via Swagger UI:

```
https://sentinelpay-core-api-b4b0fzdvgwdnhtgc.canadacentral-01.azurewebsites.net/api-docs
```

The docs page lets you explore all endpoints, view request and response schemas, and test the API live directly in the browser.

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
