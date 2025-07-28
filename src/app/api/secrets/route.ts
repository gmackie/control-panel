import { NextRequest, NextResponse } from "next/server";
import { getK3sSecrets } from "@/lib/monitoring/secrets-monitor";

export async function GET(request: NextRequest) {
  try {
    const secrets = await getK3sSecrets();
    return NextResponse.json(secrets);
  } catch (error) {
    console.error("Failed to fetch secrets:", error);
    return NextResponse.json(
      { error: "Failed to fetch secrets" },
      { status: 500 }
    );
  }
}