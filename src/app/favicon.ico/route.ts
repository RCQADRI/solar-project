import { NextRequest, NextResponse } from "next/server";

export function GET(req: NextRequest) {
  // Many browsers always request /favicon.ico.
  // Redirect to our SVG favicon so the tab icon is correct.
  return NextResponse.redirect(new URL("/favicon.svg", req.url));
}
