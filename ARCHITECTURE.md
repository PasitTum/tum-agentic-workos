# 🏗️ Architecture Blueprint — TUM Agentic WorkOS
**Classification:** Confidential — TUM Technical Architecture Document  
**Target Architecture:** Clean Architecture / Hexagonal Architecture (Domain, Application, Infrastructure, Presentation)

---

## 1. Architectural Layers

```
┌─────────────────────────────────────────────────────────────┐
│                 Presentation Layer (Web HUD / CLI)          │
│        (React 19 / TypeScript / Tailwind / Design System)   │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Application & API Layer                     │
│         (REST / gRPC / DTOs / CQRS Handlers / Zod)          │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Domain Layer (Core Logic)                   │
│        (Entities / Business Rules / Cryptographic Specs)    │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Infrastructure Layer                        │
│        (Database, eBPF Sockets, PQC Engine, Legacy Bridges) │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Security & Compliance Boundary
- ทุกการสื่อสารภายนอกต้องผ่านการเข้ารหัส TLS 1.3 และ Zero-Trust Mutual Authentication
- ทุกการยืนยันธุรกรรมต้องรองรับ NIST FIPS 204 PQC Envelope
