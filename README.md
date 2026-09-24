# Yeum-IT: IT Equipment Borrowing System (LINE LIFF + Next.js + Supabase)

A mobile-first IT Equipment Borrowing Web Application designed to operate seamlessly inside the **LINE messaging app** using **LINE Front-end Framework (LIFF)**, **Next.js App Router**, **Supabase (PostgreSQL)**, and **LINE Notify**.

---

## 🌟 Key Features

- 📱 **Mobile-First LIFF Integration**: Designed for iOS and Android inside the LINE in-app browser with native close window capabilities (`liff.closeWindow()`).
- 🛠️ **Local Development Mock Mode**: Runs seamlessly on `localhost:3000` with an automatic mock LIFF fallback profile without requiring HTTPS or pre-configured LIFF IDs.
- 🔒 **Row Level Security (RLS) & Atomic Stock Control**: Uses `SUPABASE_SERVICE_ROLE_KEY` exclusively on server-side Next.js route handlers (`/api/borrow`) to safely decrement inventory and insert transaction records.
- 📦 **Real-Time Out-of-Stock Protection**: Prevents users from selecting or submitting requests for depleted IT equipment.
- 🔔 **Instant LINE Notify Alerts**: Automatically sends formatted notifications to IT admin group chats upon request confirmation.

---

## 🏗️ Tech Stack

- **Framework**: Next.js 14 (App Router, TypeScript)
- **Styling**: Tailwind CSS with LINE green branding accent
- **Database & Auth**: Supabase (PostgreSQL with RLS & Stored Procedures)
- **LINE Integration**: `@line/liff` SDK & LINE Notify API

---

## 🚀 Getting Started

### 1. Clone & Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Fill in your actual keys in `.env.local`:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# LINE LIFF Configuration
NEXT_PUBLIC_LIFF_ID=1234567890-AbCdEfGh

# LINE Notify API Token
LINE_NOTIFY_TOKEN=your-line-notify-token
```

### 3. Setup Supabase Database

1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to **SQL Editor**.
3. Copy and run the entire contents of [`schema.sql`](./schema.sql).
   - This creates the `equipments` and `transactions` tables.
   - Sets up Row Level Security (RLS) policies.
   - Creates atomic stored procedures (`borrow_equipment_atomic`, `return_equipment_atomic`) to prevent race conditions.

### 4. Setup LINE LIFF

1. Open [LINE Developers Console](https://developers.line.biz/console/).
2. Create or select a **Provider** and create a **LINE Login** channel.
3. In the **LIFF** tab, click **Add**:
   - **LIFF app name**: Yeum-IT
   - **Size**: Full / Tall
   - **Endpoint URL**: Your deployed domain (or Ngrok URL during testing, e.g., `https://your-domain.vercel.app`)
   - **Scopes**: `profile`, `openid`
4. Copy the generated **LIFF ID** and place it in `NEXT_PUBLIC_LIFF_ID`.

### 5. Setup LINE Notify

1. Log in to [LINE Notify](https://notify-bot.line.me/my/).
2. Generate an **Access Token** for the group chat or 1-on-1 chat where borrow alerts should be dispatched.
3. Invite the `@LINE Notify` bot into your target chat group.
4. Copy the token into `LINE_NOTIFY_TOKEN`.

---

## 💻 Development & Testing

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
- **Mock LIFF Mode** will automatically engage on localhost, allowing you to test UI interactions, validation, and equipment selection without requiring a live LINE client.

---

## 📁 Project Structure

```
Yeum-IT/
├── app/
│   ├── api/
│   │   └── borrow/
│   │       └── route.ts         # Server-side route handler (Service Role + LINE Notify)
│   ├── globals.css              # Tailwind and custom UI styles
│   ├── layout.tsx               # Root layout with mobile LIFF viewport settings
│   └── page.tsx                 # Client Component ("use client") for borrowing form
├── lib/
│   ├── liff.ts                  # LIFF initializer & graceful mock fallback
│   ├── supabaseAdmin.ts         # Server-side Supabase client (service_role)
│   ├── supabaseClient.ts        # Browser-side Supabase client (anon key)
│   └── types.ts                 # Shared TypeScript types
├── .env.example                 # Template for required environment variables
├── package.json                 # Project dependencies & scripts
├── schema.sql                   # Complete PostgreSQL/Supabase database schema
└── tailwind.config.ts           # Tailwind CSS configuration
```
