"""
Main Backend API for GMAC.IO Control Panel
Unified API gateway for all control panel services
"""

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import os
import sys
from datetime import datetime
from typing import Dict, Any, Optional

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="GMAC.IO Control Panel Backend",
    description="Unified backend API for Kubernetes cluster management",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Service registry for dynamic service discovery
SERVICE_REGISTRY = {
    "service_orchestration": {
        "url": os.getenv("SERVICE_ORCHESTRATION_URL", "http://localhost:8001"),
        "health": "/health",
        "description": "Unified service orchestration and management"
    },
    "integrated_dev": {
        "url": os.getenv("INTEGRATED_DEV_URL", "http://localhost:8002"),
        "health": "/health",
        "description": "Integrated development environment"
    },
    "metrics_dashboard": {
        "url": os.getenv("METRICS_DASHBOARD_URL", "http://localhost:8003"),
        "health": "/health",
        "description": "Metrics and monitoring dashboard"
    },
    "cost_analytics": {
        "url": os.getenv("COST_ANALYTICS_URL", "http://localhost:8004"),
        "health": "/health",
        "description": "Cost analytics and optimization"
    },
    "performance_benchmarking": {
        "url": os.getenv("PERFORMANCE_BENCHMARK_URL", "http://localhost:8005"),
        "health": "/health",
        "description": "Performance benchmarking system"
    },
    "trend_forecasting": {
        "url": os.getenv("TREND_FORECAST_URL", "http://localhost:8006"),
        "health": "/health",
        "description": "Trend analysis and forecasting"
    },
    "incident_prediction": {
        "url": os.getenv("INCIDENT_PREDICTION_URL", "http://control-panel-incident-prediction:8001"),
        "health": "/health",
        "description": "AI-powered incident prediction"
    },
    "capacity_planning": {
        "url": os.getenv("CAPACITY_PLANNING_URL", "http://control-panel-capacity-planning:8001"),
        "health": "/health",
        "description": "Intelligent capacity planning"
    },
    "root_cause_analysis": {
        "url": os.getenv("ROOT_CAUSE_URL", "http://control-panel-root-cause-analysis:8001"),
        "health": "/health",
        "description": "Automated root cause analysis"
    },
    "resource_optimization": {
        "url": os.getenv("RESOURCE_OPT_URL", "http://control-panel-resource-optimization:8001"),
        "health": "/health",
        "description": "Smart resource optimization"
    },
    "anomaly_detection": {
        "url": os.getenv("ANOMALY_DETECTION_URL", "http://control-panel-anomaly-detection:8001"),
        "health": "/health",
        "description": "Anomaly detection and forecasting"
    },
    "predictive_maintenance": {
        "url": os.getenv("PREDICTIVE_MAINT_URL", "http://control-panel-predictive-maintenance:8001"),
        "health": "/health",
        "description": "Predictive maintenance system"
    },
    "chatbot_nlp": {
        "url": os.getenv("CHATBOT_URL", "http://control-panel-chatbot-nlp:8001"),
        "health": "/health",
        "description": "NLP chatbot interface"
    }
}

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "GMAC.IO Control Panel Backend",
        "version": "1.0.0",
        "status": "operational",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "control-panel-backend",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/health")
async def api_health():
    """API health check for frontend"""
    return {"status": "healthy"}

@app.get("/api/services")
async def list_services():
    """List all available backend services"""
    return {
        "services": SERVICE_REGISTRY,
        "total": len(SERVICE_REGISTRY),
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/services/{service_name}/health")
async def check_service_health(service_name: str):
    """Check health of a specific service"""
    if service_name not in SERVICE_REGISTRY:
        raise HTTPException(status_code=404, detail=f"Service {service_name} not found")
    
    service = SERVICE_REGISTRY[service_name]
    
    # In production, would make actual health check request
    # For now, return mock healthy status
    return {
        "service": service_name,
        "status": "healthy",
        "url": service["url"],
        "description": service["description"],
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/cluster/status")
async def get_cluster_status():
    """Get overall cluster status"""
    return {
        "cluster": {
            "name": "gmac-io-cluster",
            "status": "healthy",
            "nodes": 3,
            "total_cpu": "24 cores",
            "total_memory": "96 GB",
            "total_storage": "1 TB"
        },
        "services": {
            "total": 45,
            "healthy": 42,
            "degraded": 2,
            "unhealthy": 1
        },
        "workloads": {
            "deployments": 32,
            "statefulsets": 8,
            "daemonsets": 5,
            "jobs": 12
        },
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/applications")
async def list_applications():
    """List deployed applications"""
    return {
        "applications": [
            {
                "id": "app-001",
                "name": "web-frontend",
                "status": "running",
                "version": "1.2.3",
                "replicas": 3,
                "namespace": "production"
            },
            {
                "id": "app-002",
                "name": "api-service",
                "status": "running",
                "version": "2.1.0",
                "replicas": 2,
                "namespace": "production"
            },
            {
                "id": "app-003",
                "name": "worker-service",
                "status": "running",
                "version": "1.0.5",
                "replicas": 5,
                "namespace": "production"
            }
        ],
        "total": 3,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/metrics/summary")
async def get_metrics_summary():
    """Get metrics summary"""
    return {
        "cpu": {
            "usage": 45.2,
            "available": 54.8,
            "unit": "percent"
        },
        "memory": {
            "usage": 62.5,
            "available": 37.5,
            "unit": "percent"
        },
        "storage": {
            "usage": 35.8,
            "available": 64.2,
            "unit": "percent"
        },
        "network": {
            "ingress": 125.4,
            "egress": 89.2,
            "unit": "Mbps"
        },
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/costs/summary")
async def get_cost_summary():
    """Get cost summary"""
    return {
        "current_month": {
            "total": 2847.53,
            "compute": 1523.21,
            "storage": 423.18,
            "network": 234.67,
            "other": 666.47,
            "currency": "USD"
        },
        "forecast": {
            "end_of_month": 3245.00,
            "next_month": 3100.00
        },
        "savings_opportunities": [
            {
                "type": "right_sizing",
                "potential_savings": 234.50,
                "description": "Optimize instance sizes"
            },
            {
                "type": "reserved_instances",
                "potential_savings": 456.00,
                "description": "Use reserved instances for stable workloads"
            }
        ],
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/alerts")
async def get_alerts():
    """Get active alerts"""
    return {
        "alerts": [
            {
                "id": "alert-001",
                "severity": "warning",
                "service": "postgresql-primary",
                "message": "High memory usage (85%)",
                "triggered_at": "2024-01-15T10:30:00Z"
            },
            {
                "id": "alert-002",
                "severity": "info",
                "service": "nginx-ingress",
                "message": "Certificate expires in 30 days",
                "triggered_at": "2024-01-15T09:00:00Z"
            }
        ],
        "total": 2,
        "critical": 0,
        "warning": 1,
        "info": 1,
        "timestamp": datetime.now().isoformat()
    }

@app.post("/api/deployments")
async def create_deployment(deployment: Dict[str, Any]):
    """Create a new deployment"""
    # In production, would trigger actual deployment
    return {
        "status": "initiated",
        "deployment_id": f"deploy-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "message": "Deployment initiated successfully",
        "deployment": deployment,
        "timestamp": datetime.now().isoformat()
    }

@app.post("/api/services/{service_id}/scale")
async def scale_service(service_id: str, replicas: int):
    """Scale a service"""
    # In production, would trigger actual scaling
    return {
        "status": "scaling",
        "service_id": service_id,
        "target_replicas": replicas,
        "message": f"Scaling {service_id} to {replicas} replicas",
        "timestamp": datetime.now().isoformat()
    }

@app.post("/api/services/{service_id}/restart")
async def restart_service(service_id: str):
    """Restart a service"""
    # In production, would trigger actual restart
    return {
        "status": "restarting",
        "service_id": service_id,
        "message": f"Restarting {service_id}",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/logs/{service_id}")
async def get_service_logs(service_id: str, lines: int = 100):
    """Get service logs"""
    # In production, would fetch actual logs
    return {
        "service_id": service_id,
        "logs": [
            f"2024-01-15T10:00:00Z INFO Starting {service_id}",
            f"2024-01-15T10:00:01Z INFO Initializing connections",
            f"2024-01-15T10:00:02Z INFO Service ready"
        ],
        "lines": lines,
        "timestamp": datetime.now().isoformat()
    }

@app.exception_handler(404)
async def not_found_handler(request, exc):
    return JSONResponse(
        status_code=404,
        content={"error": "Not found", "path": str(request.url)}
    )

@app.exception_handler(500)
async def internal_error_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "message": str(exc)}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)