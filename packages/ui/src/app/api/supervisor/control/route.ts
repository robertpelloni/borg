import { NextResponse } from "next/server";
import { updateSupervisor, getSupervisorStatus } from "@/lib/server-supervisor";

export async function GET() {
  return NextResponse.json(getSupervisorStatus());
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const status = updateSupervisor(body);
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
