import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMultiClusterManager } from "@/lib/cluster/multi-cluster-manager";
import type { ClusterId } from "@/types/k8s";
import * as k8s from "@kubernetes/client-node";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const clusterId = params.get("clusterId") as ClusterId | null;
  const namespace = params.get("namespace");
  const pod = params.get("pod");
  const container = params.get("container") || undefined;
  const tail = parseInt(params.get("tail") || "100", 10);
  const follow = params.get("follow") === "true";

  if (!clusterId || !namespace || !pod) {
    return NextResponse.json(
      { error: "Missing required params: clusterId, namespace, pod" },
      { status: 400 }
    );
  }

  // Get the kubeconfig for the target cluster
  const manager = getMultiClusterManager();
  const kc = manager.getKubeConfig(clusterId);
  if (!kc) {
    return NextResponse.json(
      { error: `Cluster ${clusterId} not found` },
      { status: 404 }
    );
  }

  if (!follow) {
    // Non-streaming: return last N lines as JSON
    try {
      const coreApi = kc.makeApiClient(k8s.CoreV1Api);
      const { body } = await coreApi.readNamespacedPodLog(
        pod,
        namespace,
        container,
        undefined, // follow
        undefined, // insecureSkipTLSVerifyBackend
        undefined, // limitBytes
        undefined, // pretty
        undefined, // previous
        undefined, // sinceSeconds
        tail,      // tailLines
        undefined  // timestamps
      );
      const lines = (typeof body === "string" ? body : String(body))
        .split("\n")
        .filter(Boolean);
      return NextResponse.json({ lines });
    } catch (err) {
      console.error("[K8s Logs] Failed to fetch logs:", err);
      return NextResponse.json(
        { error: "Failed to fetch pod logs" },
        { status: 500 }
      );
    }
  }

  // Streaming: SSE via k8s.Log
  const logApi = new k8s.Log(kc);

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const passthrough = new (require("stream").PassThrough)();
      passthrough.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf-8");
        const lines = text.split("\n");
        for (const line of lines) {
          if (line) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(line)}\n\n`)
            );
          }
        }
      });
      passthrough.on("end", () => {
        controller.enqueue(encoder.encode("event: done\ndata: stream ended\n\n"));
        controller.close();
      });
      passthrough.on("error", (err: Error) => {
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify(err.message)}\n\n`)
        );
        controller.close();
      });

      logApi
        .log(namespace, pod, container || "", passthrough, {
          follow: true,
          tailLines: tail,
          pretty: false,
        })
        .catch((err: Error) => {
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify(err.message)}\n\n`)
          );
          controller.close();
        });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
