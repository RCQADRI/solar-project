# Solar Monitoring System

Next.js web app for solar monitoring with:
- Supabase Auth (email/password)
- MongoDB telemetry storage
- Dashboard showing Voltage/Current/Power + Recharts graphs
- Light/Dark mode

## Setup

1) Create a Supabase project
- Enable Email/Password auth in Supabase Auth settings
- Copy your project URL + anon key

2) Create `.env.local`

```bash
cp .env.example .env.local
```

Fill:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `MONGODB_URI` and `MONGODB_DB`

3) Run MongoDB (example)

### Option A: MongoDB Atlas (cloud)

1) MongoDB Atlas → your cluster → **Database Access**
- Create a Database User (example: `qadri786926_db_user`) and set a password

2) Atlas → **Network Access**
- Add your IP (or for testing: allow `0.0.0.0/0`)

3) Atlas → **Connect** → Drivers
- Copy the `mongodb+srv://...` connection string
- Put it in `.env.local` as `MONGODB_URI`

If your password has special characters, URL-encode it.

### Option B: Local MongoDB (Docker)

If you have MongoDB locally, start it normally. Otherwise (Docker):

```bash
docker run --name solar-mongo -p 27017:27017 -d mongo:7
```

4) Install & run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Demo data

After login, on the dashboard click **Seed Demo Data**. This calls `POST /api/seed` and populates the last 24h telemetry so charts work.

## API

- `GET /api/telemetry/latest` (auth required)
- `GET /api/telemetry/hourly` (auth required, last 24h grouped hourly)
- `POST /api/seed` (demo seed)
- `POST /api/auth/logout`
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
