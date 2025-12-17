import { NextResponse } from "next/server";

const DEV_COOKIE_NAME = "dev_admin";

function devAdminEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.DEV_ADMIN_AUTH === "1";
}

export async function POST(request: Request) {
  if (!devAdminEnabled()) {
    return NextResponse.json(
      { ok: false, message: "Dev admin login is disabled." },
      { status: 403 }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const email = String(body?.email ?? "");
  const password = String(body?.password ?? "");

  if (email !== "admin" || password !== "admin") {
    return NextResponse.json(
      { ok: false, message: "Invalid credentials." },
      { status: 401 }
    );
  }

  const res = NextResponse.json({ ok: true, email: "admin@local" });
  res.cookies.set(DEV_COOKIE_NAME, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24, // 1 day
  });
  return res;
}
