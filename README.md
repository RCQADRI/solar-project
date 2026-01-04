# ☀️ SolarSQS: Smart Solar Telemetry & Monitoring System

SolarSQS is a full-stack IoT solution designed to monitor solar energy metrics in real-time. By integrating ESP32 hardware sensors with a Next.js web interface, this system provides live tracking of Voltage, Current, and Power consumption, backed by a robust cloud infrastructure.

## 🚀 Core Features

- Hardware-to-Cloud Integration: Seamless data transmission from ESP32 sensors via REST API.
- Dual-Database Architecture:
  - MongoDB Atlas: Stores time-series telemetry data for historical analysis.
  - Supabase: Handles user authentication and secure profile management.
- Real-time Dashboard: Visualizes solar performance using Recharts for interactive time-based graphs.
- Secure Authentication: Implements PKCE flow for email/password login, ensuring protection against authorization code injection.
- Responsive UI: Modern dashboard with Light/Dark mode support powered by Shadcn/UI and Tailwind CSS.

## 🛠️ Technical Stack

### Software (Web Ecosystem)

- Framework: Next.js 14/15 (App Router)
- Auth: Supabase Auth (@supabase/ssr)
- Database: MongoDB Atlas (Mongoose/MongoDB Driver)
- Visualization: Recharts (Area & Bar Charts)
- Styling: Tailwind CSS + Lucide Icons

### Hardware (IoT Layer)

- Microcontroller: ESP32
- Programming: C++ for hardware telemetry
- Protocol: HTTPS POST (JSON Payload)

## 📐 System Architecture

- Sensing: ESP32 measures solar parameters (V, I, P).
- Transmission: Data is sent as a JSON payload to the /api/telemetry endpoint.
- Authentication: Users log in via Supabase; sessions are persisted using secure cookies.
- Monitoring: The Next.js frontend fetches the latest data from MongoDB and renders it on a live dashboard.

## ⚙️ Setup & Installation

1. Environment Variables
   Create a .env.local file in your root directory and populate it with your credentials:

   Code snippet

   ```bash
   # Supabase Keys
   NEXT_PUBLIC_SUPABASE_URL=your_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

   # MongoDB Connection
   MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/
   MONGODB_DB=solar_monitoring

   # Site Config
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

2. Supabase Configuration (Critical)
   To ensure the authentication flow works, configure your Redirect URLs in the Supabase Dashboard:

   - Site URL: https://your-app.vercel.app/login
   - Redirect URLs:
     - https://your-app.vercel.app/auth/callback
     - http://localhost:3000/auth/callback (for local development)

3. Local Development

   Bash

   ```bash
   # Clone the repository
   git clone https://github.com/RCQADRI/solar-project.git

   # Install dependencies
   npm install

   # Run the development server
   npm run dev
   ```

## 📡 Hardware API Specs

To send data from your ESP32, use the following endpoint and payload structure:

Endpoint: POST /api/telemetry  
Payload:

JSON

```json
{
  "voltage": 19.2,
  "current": 2.5,
  "power": 48.0,
  "device_id": "ESP32_SOLAR_01"
}
```

## 🛡️ Security & Reliability

During development, the system was optimized to handle SMTP throttling and PKCE state synchronization issues. The implementation of @supabase/ssr ensures that the authentication handshake is resilient across server and client environments.