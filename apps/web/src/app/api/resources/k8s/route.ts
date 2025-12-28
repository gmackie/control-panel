import { NextResponse } from "next/server";
import { K3sService } from "@/lib/k3s/k3s-service";

const k3sService = new K3sService();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get("resource");
  const namespace = searchParams.get("namespace") || undefined;

  try {
    switch (resource) {
      case "pods": {
        const pods = await k3sService.getPods(namespace);
        return NextResponse.json({ data: pods });
      }
      case "deployments": {
        const deployments = await k3sService.getDeployments({ namespace });
        return NextResponse.json({ data: deployments });
      }
      case "services": {
        const services = await k3sService.getServices(namespace);
        return NextResponse.json({ data: services });
      }
      case "namespaces": {
        const namespaces = await k3sService.getNamespaces();
        return NextResponse.json({ data: namespaces });
      }
      case "nodes": {
        const nodes = await k3sService.getNodes();
        return NextResponse.json({ data: nodes });
      }
      case "ingresses": {
        const ingresses = await k3sService.getIngresses(namespace);
        return NextResponse.json({ data: ingresses });
      }
      case "info": {
        const info = await k3sService.getClusterInfo();
        return NextResponse.json({ data: info });
      }
      default:
        return NextResponse.json(
          { error: "Invalid resource type" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error(`Failed to fetch K8s ${resource}:`, error);
    return NextResponse.json(
      { error: `Failed to fetch ${resource}`, message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
