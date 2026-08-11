# Fundsroom Operations Intelligence

A compact, production-minded ERP/CRM system designed for wholesale and distribution business operations. It connects customer relationships, sales order drafting, and real-time inventory levels to an intelligence layer that explains operational risks and simulates future demand.

## Tech Stack
- **Frontend**: React, TypeScript, Vite, Vanilla CSS (Higgsfield-inspired premium dark theme)
- **Backend**: Node.js, Express, TypeScript, REST APIs
- **Database**: PostgreSQL (Knex.js query builder with SQLite fallback for zero-configuration local development)
- **Auth**: JWT (JSON Web Tokens) with Role-Based Access Control (RBAC)

---

## Local Setup & Run

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org/) installed.

### 2. Configure Environment Variables
Create a `.env` file in the `backend/` directory:
```env
PORT=5000
JWT_SECRET=fundsroom-default-secret-key-12345
# Optional: Set a PostgreSQL connection string. Omit to run on local SQLite.
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fundsroom
```

### 3. Installation & Booting

Open two terminal sessions:

#### Run Backend Server
```bash
cd backend
npm install
npm run dev
```
*Note: Schema migrations and demo dataset seeding run automatically on launch.*

#### Run Frontend Dev Server
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173/](http://localhost:5173/) in your web browser.

---

## Default Test Credentials

Use the **Demo Quick Login** buttons on the login screen or enter these credentials:

| Role | Email | Password |
|---|---|---|
| **ADMIN** | `admin@fundsroom.com` | `Admin123!` |
| **SALES** | `sales@sales.com` (or `sales@fundsroom.com`) | `Sales123!` |
| **WAREHOUSE** | `warehouse@fundsroom.com` | `Warehouse123!` |
| **ACCOUNTS** | `accounts@fundsroom.com` | `Accounts123!` |

---

## Business Rules & Logic

1. **Challan States**:
   - **Draft**: Does NOT deduct stock.
   - **Confirmed**: Atomically validates stock levels, reduces inventory, logs stock movements, and locks status.
   - **Cancelled**: Reverses confirmed stock levels, creating balancing inward stock movements.
2. **Atomic stock validation**:
   - All confirmations are executed inside database transactions.
   - If requested quantity exceeds current stock, the transaction rollbacks, returns `409 Conflict: INSUFFICIENT_STOCK`, and leaves no partial updates.
3. **Product Snapshots**:
   - When items are added to a challan, their price, name, and SKU are screenshotted and saved inside the challan item row, keeping historical receipts accurate if product properties change.
