import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GrafanaClient } from "@/lib/grafana/client";

const grafana = new GrafanaClient();

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dashboardUid = searchParams.get("dashboardUid");
    const dashboardSlug = searchParams.get("dashboardSlug") || "overview";
    const panelId = Number(searchParams.get("panelId") || "0");

    if (!dashboardUid || !Number.isFinite(panelId) || panelId <= 0) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid dashboardUid/panelId" },
        { status: 400 }
      );
    }

    const width = parseOptionalInt(searchParams.get("width"), 100, 2000);
    const height = parseOptionalInt(searchParams.get("height"), 100, 2000);
    const from = searchParams.get("from") || "now-6h";
    const to = searchParams.get("to") || "now";
    const theme = (searchParams.get("theme") as "light" | "dark" | null) || undefined;

    const buf = await grafana.renderPanelPng({
      dashboardUid,
      dashboardSlug,
      panelId,
      from,
      to,
      width,
      height,
      theme,
    });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error rendering Grafana panel:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to render Grafana panel",
        message: error instanceof Error ? error.message : "Unknown error",
        hint: "Grafana image renderer may not be installed/enabled.",
      },
      { status: 500 }
    );
  }
}

function parseOptionalInt(value: string | null, min: number, max: number): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  const t = Math.trunc(n);
  if (t < min || t > max) return undefined;
  return t;
}
