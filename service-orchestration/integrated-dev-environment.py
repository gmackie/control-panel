"""
Integrated Development Environment for Application Management
Complete development lifecycle management within the control panel
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import json
import yaml
import hashlib
import tempfile
import subprocess
import aiohttp
import aioredis
import aiogit
from kubernetes import client, config
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import uvicorn
import docker
from jinja2 import Template

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ProjectType(Enum):
    NODEJS = "nodejs"
    PYTHON = "python"
    GO = "go"
    JAVA = "java"
    DOTNET = "dotnet"
    RUST = "rust"
    PHP = "php"
    RUBY = "ruby"
    STATIC = "static"
    CONTAINER = "container"

class BuildStatus(Enum):
    PENDING = "pending"
    BUILDING = "building"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"

class DeploymentEnvironment(Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    FEATURE = "feature"
    HOTFIX = "hotfix"

class SourceControlProvider(Enum):
    GITEA = "gitea"
    GITHUB = "github"
    GITLAB = "gitlab"
    BITBUCKET = "bitbucket"

@dataclass
class Project:
    project_id: str
    name: str
    description: str
    project_type: ProjectType
    repository_url: str
    source_provider: SourceControlProvider
    default_branch: str
    build_config: Dict[str, Any]
    deployment_config: Dict[str, Any]
    environment_variables: Dict[str, str]
    secrets: List[str]
    dependencies: List[str]
    team_members: List[str]
    created_at: datetime
    updated_at: datetime
    last_deployment: Optional[datetime]

@dataclass
class Build:
    build_id: str
    project_id: str
    commit_hash: str
    branch: str
    triggered_by: str
    build_status: BuildStatus
    build_type: str  # manual, webhook, scheduled
    started_at: datetime
    completed_at: Optional[datetime]
    duration: Optional[float]
    build_logs: List[str]
    artifacts: List[str]
    error_message: Optional[str]

@dataclass
class Deployment:
    deployment_id: str
    project_id: str
    build_id: str
    environment: DeploymentEnvironment
    version: str
    namespace: str
    replicas: int
    resources: Dict[str, Any]
    health_check: Dict[str, Any]
    rollout_status: str
    deployed_by: str
    deployed_at: datetime
    rollback_to: Optional[str]

@dataclass
class CodeAnalysis:
    analysis_id: str
    project_id: str
    commit_hash: str
    language_stats: Dict[str, int]  # lines of code per language
    complexity_score: float
    test_coverage: float
    security_issues: List[Dict[str, Any]]
    code_smells: List[Dict[str, Any]]
    dependencies_outdated: List[Dict[str, Any]]
    performance_suggestions: List[str]
    analyzed_at: datetime

@dataclass
class DevelopmentWorkspace:
    workspace_id: str
    project_id: str
    user_id: str
    environment_type: str  # vscode-server, jupyter, cloud9, etc.
    container_id: str
    access_url: str
    resources: Dict[str, Any]
    extensions: List[str]
    created_at: datetime
    last_accessed: datetime
    expires_at: datetime

class ProjectTemplateManager:
    def __init__(self):
        self.templates = self._load_default_templates()
    
    def _load_default_templates(self) -> Dict[str, Dict[str, Any]]:
        """Load default project templates"""
        return {
            ProjectType.NODEJS: {
                "dockerfile": """FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]""",
                "kubernetes": {
                    "deployment": self._get_deployment_template(),
                    "service": self._get_service_template(),
                    "ingress": self._get_ingress_template()
                },
                "ci_pipeline": self._get_nodejs_pipeline(),
                "default_deps": ["express", "dotenv", "helmet"],
                "dev_deps": ["nodemon", "eslint", "jest"],
                "scripts": {
                    "start": "node server.js",
                    "dev": "nodemon server.js",
                    "test": "jest",
                    "lint": "eslint ."
                }
            },
            ProjectType.PYTHON: {
                "dockerfile": """FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "app.py"]""",
                "kubernetes": {
                    "deployment": self._get_deployment_template(),
                    "service": self._get_service_template(),
                    "ingress": self._get_ingress_template()
                },
                "ci_pipeline": self._get_python_pipeline(),
                "default_deps": ["fastapi", "uvicorn", "pydantic"],
                "dev_deps": ["pytest", "black", "flake8", "mypy"],
                "scripts": {
                    "start": "uvicorn app:app --host 0.0.0.0 --port 8000",
                    "dev": "uvicorn app:app --reload",
                    "test": "pytest",
                    "format": "black .",
                    "lint": "flake8 ."
                }
            },
            ProjectType.GO: {
                "dockerfile": """FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN go build -o main .

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/main .
EXPOSE 8080
CMD ["./main"]""",
                "kubernetes": {
                    "deployment": self._get_deployment_template(),
                    "service": self._get_service_template(),
                    "ingress": self._get_ingress_template()
                },
                "ci_pipeline": self._get_go_pipeline(),
                "default_deps": ["github.com/gin-gonic/gin", "github.com/joho/godotenv"],
                "scripts": {
                    "build": "go build -o main .",
                    "run": "go run .",
                    "test": "go test ./...",
                    "fmt": "go fmt ./..."
                }
            }
        }
    
    def _get_deployment_template(self) -> str:
        """Get Kubernetes deployment template"""
        return """apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ app_name }}
  namespace: {{ namespace }}
spec:
  replicas: {{ replicas }}
  selector:
    matchLabels:
      app: {{ app_name }}
  template:
    metadata:
      labels:
        app: {{ app_name }}
        version: {{ version }}
    spec:
      containers:
      - name: {{ app_name }}
        image: {{ image }}
        ports:
        - containerPort: {{ port }}
        env:
        {{ env_vars }}
        resources:
          requests:
            memory: "{{ memory_request }}"
            cpu: "{{ cpu_request }}"
          limits:
            memory: "{{ memory_limit }}"
            cpu: "{{ cpu_limit }}"
        livenessProbe:
          httpGet:
            path: {{ health_path }}
            port: {{ port }}
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: {{ health_path }}
            port: {{ port }}
          initialDelaySeconds: 5
          periodSeconds: 5"""
    
    def _get_service_template(self) -> str:
        """Get Kubernetes service template"""
        return """apiVersion: v1
kind: Service
metadata:
  name: {{ app_name }}
  namespace: {{ namespace }}
spec:
  selector:
    app: {{ app_name }}
  ports:
  - port: 80
    targetPort: {{ port }}
    protocol: TCP
  type: ClusterIP"""
    
    def _get_ingress_template(self) -> str:
        """Get Kubernetes ingress template"""
        return """apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ app_name }}
  namespace: {{ namespace }}
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - {{ domain }}
    secretName: {{ app_name }}-tls
  rules:
  - host: {{ domain }}
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: {{ app_name }}
            port:
              number: 80"""
    
    def _get_nodejs_pipeline(self) -> str:
        """Get Node.js CI pipeline"""
        return """kind: pipeline
type: kubernetes
name: nodejs-build

steps:
- name: install
  image: node:18
  commands:
  - npm ci

- name: test
  image: node:18
  commands:
  - npm test

- name: lint
  image: node:18
  commands:
  - npm run lint

- name: build
  image: plugins/docker
  settings:
    repo: {{ registry }}/{{ app_name }}
    tags:
      - latest
      - ${DRONE_COMMIT_SHA:0:8}
    dockerfile: Dockerfile

- name: deploy
  image: bitnami/kubectl
  commands:
  - kubectl set image deployment/{{ app_name }} {{ app_name }}={{ registry }}/{{ app_name }}:${DRONE_COMMIT_SHA:0:8} -n {{ namespace }}
  when:
    branch:
    - main"""
    
    def _get_python_pipeline(self) -> str:
        """Get Python CI pipeline"""
        return """kind: pipeline
type: kubernetes
name: python-build

steps:
- name: test
  image: python:3.11
  commands:
  - pip install -r requirements.txt
  - pytest

- name: lint
  image: python:3.11
  commands:
  - pip install flake8 black
  - flake8 .
  - black --check .

- name: build
  image: plugins/docker
  settings:
    repo: {{ registry }}/{{ app_name }}
    tags:
      - latest
      - ${DRONE_COMMIT_SHA:0:8}
    dockerfile: Dockerfile

- name: deploy
  image: bitnami/kubectl
  commands:
  - kubectl set image deployment/{{ app_name }} {{ app_name }}={{ registry }}/{{ app_name }}:${DRONE_COMMIT_SHA:0:8} -n {{ namespace }}
  when:
    branch:
    - main"""
    
    def _get_go_pipeline(self) -> str:
        """Get Go CI pipeline"""
        return """kind: pipeline
type: kubernetes
name: go-build

steps:
- name: test
  image: golang:1.21
  commands:
  - go test ./...

- name: lint
  image: golangci/golangci-lint
  commands:
  - golangci-lint run

- name: build
  image: plugins/docker
  settings:
    repo: {{ registry }}/{{ app_name }}
    tags:
      - latest
      - ${DRONE_COMMIT_SHA:0:8}
    dockerfile: Dockerfile

- name: deploy
  image: bitnami/kubectl
  commands:
  - kubectl set image deployment/{{ app_name }} {{ app_name }}={{ registry }}/{{ app_name }}:${DRONE_COMMIT_SHA:0:8} -n {{ namespace }}
  when:
    branch:
    - main"""
    
    def generate_project_scaffold(self, project: Project) -> Dict[str, str]:
        """Generate project scaffolding files"""
        template = self.templates.get(project.project_type, {})
        
        if not template:
            return {}
        
        files = {}
        
        # Generate Dockerfile
        files["Dockerfile"] = template.get("dockerfile", "")
        
        # Generate Kubernetes manifests
        k8s_templates = template.get("kubernetes", {})
        context = {
            "app_name": project.name,
            "namespace": project.deployment_config.get("namespace", "default"),
            "replicas": project.deployment_config.get("replicas", 2),
            "version": "1.0.0",
            "image": f"registry/{project.name}:latest",
            "port": project.deployment_config.get("port", 8080),
            "health_path": project.deployment_config.get("health_path", "/health"),
            "memory_request": "128Mi",
            "memory_limit": "256Mi",
            "cpu_request": "100m",
            "cpu_limit": "500m",
            "domain": f"{project.name}.example.com",
            "env_vars": self._format_env_vars(project.environment_variables),
            "registry": "harbor.example.com"
        }
        
        for manifest_name, template_str in k8s_templates.items():
            tmpl = Template(template_str)
            files[f"k8s/{manifest_name}.yaml"] = tmpl.render(**context)
        
        # Generate CI pipeline
        pipeline_template = template.get("ci_pipeline", "")
        if pipeline_template:
            tmpl = Template(pipeline_template)
            files[".drone.yml"] = tmpl.render(**context)
        
        # Generate starter code based on project type
        if project.project_type == ProjectType.NODEJS:
            files["package.json"] = self._generate_package_json(project, template)
            files["server.js"] = self._generate_nodejs_server()
        elif project.project_type == ProjectType.PYTHON:
            files["requirements.txt"] = self._generate_requirements_txt(template)
            files["app.py"] = self._generate_python_app()
        elif project.project_type == ProjectType.GO:
            files["go.mod"] = self._generate_go_mod(project)
            files["main.go"] = self._generate_go_main()
        
        return files
    
    def _format_env_vars(self, env_vars: Dict[str, str]) -> str:
        """Format environment variables for Kubernetes"""
        formatted = []
        for key, value in env_vars.items():
            formatted.append(f"        - name: {key}")
            formatted.append(f"          value: \"{value}\"")
        return "\n".join(formatted)
    
    def _generate_package_json(self, project: Project, template: Dict) -> str:
        """Generate package.json for Node.js project"""
        package = {
            "name": project.name,
            "version": "1.0.0",
            "description": project.description,
            "main": "server.js",
            "scripts": template.get("scripts", {}),
            "dependencies": {dep: "latest" for dep in template.get("default_deps", [])},
            "devDependencies": {dep: "latest" for dep in template.get("dev_deps", [])}
        }
        return json.dumps(package, indent=2)
    
    def _generate_nodejs_server(self) -> str:
        """Generate basic Node.js server"""
        return """const express = require('express');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Node.js!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});"""
    
    def _generate_requirements_txt(self, template: Dict) -> str:
        """Generate requirements.txt for Python project"""
        deps = template.get("default_deps", [])
        return "\n".join(deps)
    
    def _generate_python_app(self) -> str:
        """Generate basic Python FastAPI app"""
        return """from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn
import os

app = FastAPI()

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.get("/")
async def root():
    return {"message": "Hello from Python!"}

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)"""
    
    def _generate_go_mod(self, project: Project) -> str:
        """Generate go.mod for Go project"""
        return f"""module github.com/{project.name}

go 1.21

require (
    github.com/gin-gonic/gin v1.9.1
    github.com/joho/godotenv v1.5.1
)"""
    
    def _generate_go_main(self) -> str:
        """Generate basic Go server"""
        return """package main

import (
    "net/http"
    "os"
    
    "github.com/gin-gonic/gin"
    _ "github.com/joho/godotenv/autoload"
)

func main() {
    r := gin.Default()
    
    r.GET("/health", func(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{
            "status": "healthy",
        })
    })
    
    r.GET("/", func(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{
            "message": "Hello from Go!",
        })
    })
    
    port := os.Getenv("PORT")
    if port == "" {
        port = "8080"
    }
    
    r.Run(":" + port)
}"""

class BuildManager:
    def __init__(self):
        self.docker_client = docker.from_env()
        self.builds: Dict[str, Build] = {}
        
    async def build_project(self, project: Project, commit_hash: str, 
                           triggered_by: str) -> Build:
        """Build a project"""
        build_id = f"build_{project.project_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        build = Build(
            build_id=build_id,
            project_id=project.project_id,
            commit_hash=commit_hash,
            branch=project.default_branch,
            triggered_by=triggered_by,
            build_status=BuildStatus.PENDING,
            build_type="manual",
            started_at=datetime.now(),
            completed_at=None,
            duration=None,
            build_logs=[],
            artifacts=[],
            error_message=None
        )
        
        self.builds[build_id] = build
        
        # Start build process
        asyncio.create_task(self._execute_build(build, project))
        
        return build
    
    async def _execute_build(self, build: Build, project: Project):
        """Execute the build process"""
        build.build_status = BuildStatus.BUILDING
        build.build_logs.append(f"Starting build for {project.name}")
        
        try:
            # Clone repository
            repo_dir = await self._clone_repository(project.repository_url, build.commit_hash)
            build.build_logs.append(f"Cloned repository at {build.commit_hash}")
            
            # Build Docker image
            image_tag = f"{project.name}:{build.commit_hash[:8]}"
            
            build.build_logs.append(f"Building Docker image: {image_tag}")
            
            # Use Docker SDK to build
            image, logs = self.docker_client.images.build(
                path=repo_dir,
                tag=image_tag,
                rm=True
            )
            
            for log in logs:
                if 'stream' in log:
                    build.build_logs.append(log['stream'].strip())
            
            # Push to registry
            registry_url = "harbor.local"  # Would be configured
            full_image_tag = f"{registry_url}/{image_tag}"
            
            build.build_logs.append(f"Pushing image to {full_image_tag}")
            
            # Tag and push
            image.tag(full_image_tag)
            # self.docker_client.images.push(full_image_tag)
            
            build.artifacts.append(full_image_tag)
            build.build_status = BuildStatus.SUCCESS
            build.build_logs.append("Build completed successfully")
            
        except Exception as e:
            build.build_status = BuildStatus.FAILED
            build.error_message = str(e)
            build.build_logs.append(f"Build failed: {e}")
            logger.error(f"Build {build.build_id} failed: {e}")
        
        finally:
            build.completed_at = datetime.now()
            build.duration = (build.completed_at - build.started_at).total_seconds()
    
    async def _clone_repository(self, repo_url: str, commit_hash: str) -> str:
        """Clone repository and checkout specific commit"""
        temp_dir = tempfile.mkdtemp()
        
        # Clone repository
        subprocess.run(["git", "clone", repo_url, temp_dir], check=True)
        
        # Checkout specific commit
        subprocess.run(["git", "checkout", commit_hash], cwd=temp_dir, check=True)
        
        return temp_dir
    
    def get_build_logs(self, build_id: str) -> List[str]:
        """Get logs for a build"""
        build = self.builds.get(build_id)
        if build:
            return build.build_logs
        return []
    
    def get_build_status(self, build_id: str) -> Optional[BuildStatus]:
        """Get status of a build"""
        build = self.builds.get(build_id)
        if build:
            return build.build_status
        return None

class CodeAnalyzer:
    def __init__(self):
        self.analysis_cache: Dict[str, CodeAnalysis] = {}
    
    async def analyze_code(self, project: Project, commit_hash: str) -> CodeAnalysis:
        """Analyze code quality and security"""
        analysis_id = f"analysis_{project.project_id}_{commit_hash[:8]}"
        
        # Simulate code analysis (would use actual tools like SonarQube, Snyk, etc.)
        analysis = CodeAnalysis(
            analysis_id=analysis_id,
            project_id=project.project_id,
            commit_hash=commit_hash,
            language_stats=await self._analyze_languages(project),
            complexity_score=await self._calculate_complexity(project),
            test_coverage=await self._calculate_coverage(project),
            security_issues=await self._scan_security(project),
            code_smells=await self._detect_code_smells(project),
            dependencies_outdated=await self._check_dependencies(project),
            performance_suggestions=await self._analyze_performance(project),
            analyzed_at=datetime.now()
        )
        
        self.analysis_cache[analysis_id] = analysis
        return analysis
    
    async def _analyze_languages(self, project: Project) -> Dict[str, int]:
        """Analyze language distribution"""
        # Simulated language analysis
        if project.project_type == ProjectType.NODEJS:
            return {"JavaScript": 5000, "JSON": 500, "Markdown": 200}
        elif project.project_type == ProjectType.PYTHON:
            return {"Python": 4000, "YAML": 300, "Markdown": 150}
        elif project.project_type == ProjectType.GO:
            return {"Go": 6000, "Makefile": 100, "Markdown": 200}
        return {}
    
    async def _calculate_complexity(self, project: Project) -> float:
        """Calculate code complexity score"""
        # Simulated complexity (would use cyclomatic complexity, etc.)
        return 7.5  # Scale of 1-10
    
    async def _calculate_coverage(self, project: Project) -> float:
        """Calculate test coverage"""
        # Simulated coverage
        return 75.5  # Percentage
    
    async def _scan_security(self, project: Project) -> List[Dict[str, Any]]:
        """Scan for security vulnerabilities"""
        # Simulated security scan
        return [
            {
                "severity": "medium",
                "type": "dependency",
                "package": "example-package",
                "version": "1.0.0",
                "vulnerability": "CVE-2024-1234",
                "description": "Potential XSS vulnerability",
                "fix": "Update to version 1.0.1"
            }
        ]
    
    async def _detect_code_smells(self, project: Project) -> List[Dict[str, Any]]:
        """Detect code smells"""
        # Simulated code smell detection
        return [
            {
                "type": "long_method",
                "file": "src/utils.js",
                "line": 45,
                "description": "Method exceeds 50 lines",
                "severity": "minor"
            }
        ]
    
    async def _check_dependencies(self, project: Project) -> List[Dict[str, Any]]:
        """Check for outdated dependencies"""
        # Simulated dependency check
        return [
            {
                "package": "express",
                "current": "4.17.1",
                "latest": "4.18.2",
                "type": "minor"
            }
        ]
    
    async def _analyze_performance(self, project: Project) -> List[str]:
        """Analyze performance optimization opportunities"""
        # Simulated performance analysis
        return [
            "Consider implementing caching for database queries",
            "Optimize image assets for web delivery",
            "Enable gzip compression for API responses"
        ]

class WorkspaceManager:
    def __init__(self):
        self.docker_client = docker.from_env()
        self.workspaces: Dict[str, DevelopmentWorkspace] = {}
    
    async def create_workspace(self, project: Project, user_id: str, 
                             environment_type: str = "vscode-server") -> DevelopmentWorkspace:
        """Create a development workspace"""
        workspace_id = f"workspace_{project.project_id}_{user_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Create container for workspace
        container = await self._create_workspace_container(project, environment_type)
        
        # Generate access URL
        access_url = f"https://workspace-{workspace_id}.dev.local"
        
        workspace = DevelopmentWorkspace(
            workspace_id=workspace_id,
            project_id=project.project_id,
            user_id=user_id,
            environment_type=environment_type,
            container_id=container.id,
            access_url=access_url,
            resources={"cpu": "2", "memory": "4Gi"},
            extensions=self._get_default_extensions(project.project_type),
            created_at=datetime.now(),
            last_accessed=datetime.now(),
            expires_at=datetime.now() + timedelta(hours=8)
        )
        
        self.workspaces[workspace_id] = workspace
        return workspace
    
    async def _create_workspace_container(self, project: Project, environment_type: str):
        """Create Docker container for workspace"""
        # Select base image based on environment type
        if environment_type == "vscode-server":
            image = "codercom/code-server:latest"
        elif environment_type == "jupyter":
            image = "jupyter/base-notebook:latest"
        else:
            image = "ubuntu:22.04"
        
        # Create and start container
        container = self.docker_client.containers.run(
            image,
            detach=True,
            environment={
                "PROJECT_NAME": project.name,
                "PROJECT_TYPE": project.project_type.value
            },
            volumes={
                f"/projects/{project.project_id}": {"bind": "/workspace", "mode": "rw"}
            },
            ports={'8080/tcp': None},
            remove=False
        )
        
        return container
    
    def _get_default_extensions(self, project_type: ProjectType) -> List[str]:
        """Get default extensions for project type"""
        extensions_map = {
            ProjectType.NODEJS: ["dbaeumer.vscode-eslint", "esbenp.prettier-vscode"],
            ProjectType.PYTHON: ["ms-python.python", "ms-python.vscode-pylance"],
            ProjectType.GO: ["golang.go"],
            ProjectType.JAVA: ["redhat.java", "vscjava.vscode-java-debug"],
            ProjectType.RUST: ["rust-lang.rust-analyzer"]
        }
        
        return extensions_map.get(project_type, [])
    
    async def terminate_workspace(self, workspace_id: str) -> bool:
        """Terminate a workspace"""
        workspace = self.workspaces.get(workspace_id)
        if not workspace:
            return False
        
        try:
            container = self.docker_client.containers.get(workspace.container_id)
            container.stop()
            container.remove()
            
            del self.workspaces[workspace_id]
            return True
            
        except Exception as e:
            logger.error(f"Error terminating workspace: {e}")
            return False

class IntegratedDevEnvironment:
    def __init__(self):
        self.template_manager = ProjectTemplateManager()
        self.build_manager = BuildManager()
        self.code_analyzer = CodeAnalyzer()
        self.workspace_manager = WorkspaceManager()
        self.projects: Dict[str, Project] = {}
        self.deployments: Dict[str, Deployment] = {}
        self.redis_client = None
    
    async def initialize(self):
        """Initialize the IDE system"""
        try:
            self.redis_client = await aioredis.from_url("redis://localhost:6379")
            logger.info("Connected to Redis")
        except Exception as e:
            logger.warning(f"Could not connect to Redis: {e}")
        
        logger.info("Integrated Development Environment initialized")
    
    async def create_project(self, project: Project) -> Dict[str, str]:
        """Create a new project with scaffolding"""
        self.projects[project.project_id] = project
        
        # Generate project files
        files = self.template_manager.generate_project_scaffold(project)
        
        # Initialize Git repository
        await self._initialize_git_repo(project, files)
        
        logger.info(f"Created project {project.name} with {len(files)} files")
        
        return files
    
    async def _initialize_git_repo(self, project: Project, files: Dict[str, str]):
        """Initialize Git repository for project"""
        # Would integrate with Gitea/GitHub API to create repo
        # and push initial files
        pass
    
    async def build_and_deploy(self, project_id: str, environment: DeploymentEnvironment,
                              triggered_by: str) -> Tuple[Build, Deployment]:
        """Build and deploy a project"""
        project = self.projects.get(project_id)
        if not project:
            raise ValueError(f"Project {project_id} not found")
        
        # Start build
        build = await self.build_manager.build_project(
            project, 
            "HEAD",  # Would get actual commit hash
            triggered_by
        )
        
        # Wait for build to complete (simplified)
        while build.build_status == BuildStatus.BUILDING:
            await asyncio.sleep(1)
        
        if build.build_status != BuildStatus.SUCCESS:
            raise Exception(f"Build failed: {build.error_message}")
        
        # Deploy
        deployment = await self._deploy_project(project, build, environment, triggered_by)
        
        return build, deployment
    
    async def _deploy_project(self, project: Project, build: Build, 
                            environment: DeploymentEnvironment, deployed_by: str) -> Deployment:
        """Deploy a project to specified environment"""
        deployment_id = f"deploy_{project.project_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        namespace = f"{project.name}-{environment.value}"
        
        deployment = Deployment(
            deployment_id=deployment_id,
            project_id=project.project_id,
            build_id=build.build_id,
            environment=environment,
            version=build.commit_hash[:8],
            namespace=namespace,
            replicas=project.deployment_config.get("replicas", 2),
            resources=project.deployment_config.get("resources", {}),
            health_check=project.deployment_config.get("health_check", {}),
            rollout_status="in_progress",
            deployed_by=deployed_by,
            deployed_at=datetime.now(),
            rollback_to=None
        )
        
        self.deployments[deployment_id] = deployment
        
        # Apply Kubernetes manifests
        # Would use Kubernetes API to deploy
        
        deployment.rollout_status = "completed"
        project.last_deployment = datetime.now()
        
        return deployment
    
    async def analyze_project_code(self, project_id: str) -> CodeAnalysis:
        """Analyze project code quality"""
        project = self.projects.get(project_id)
        if not project:
            raise ValueError(f"Project {project_id} not found")
        
        analysis = await self.code_analyzer.analyze_code(project, "HEAD")
        
        return analysis
    
    async def create_dev_workspace(self, project_id: str, user_id: str) -> DevelopmentWorkspace:
        """Create development workspace for project"""
        project = self.projects.get(project_id)
        if not project:
            raise ValueError(f"Project {project_id} not found")
        
        workspace = await self.workspace_manager.create_workspace(project, user_id)
        
        return workspace

# FastAPI Application
app = FastAPI(title="Integrated Development Environment", version="1.0.0")
ide = IntegratedDevEnvironment()

@app.on_event("startup")
async def startup():
    await ide.initialize()

class ProjectRequest(BaseModel):
    name: str
    description: str
    project_type: str
    repository_url: str
    source_provider: str
    default_branch: str = "main"
    environment_variables: Dict[str, str] = {}

class BuildRequest(BaseModel):
    environment: str = "development"
    triggered_by: str

class WorkspaceRequest(BaseModel):
    user_id: str
    environment_type: str = "vscode-server"

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "integrated-dev-environment"}

@app.post("/projects")
async def create_project(request: ProjectRequest):
    """Create a new project"""
    project = Project(
        project_id=f"proj_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
        name=request.name,
        description=request.description,
        project_type=ProjectType(request.project_type),
        repository_url=request.repository_url,
        source_provider=SourceControlProvider(request.source_provider),
        default_branch=request.default_branch,
        build_config={},
        deployment_config={},
        environment_variables=request.environment_variables,
        secrets=[],
        dependencies=[],
        team_members=[],
        created_at=datetime.now(),
        updated_at=datetime.now(),
        last_deployment=None
    )
    
    files = await ide.create_project(project)
    
    return {
        "project": asdict(project),
        "files_generated": list(files.keys()),
        "status": "created"
    }

@app.get("/projects")
async def list_projects():
    """List all projects"""
    projects = [asdict(p) for p in ide.projects.values()]
    return {"projects": projects, "total": len(projects)}

@app.get("/projects/{project_id}")
async def get_project(project_id: str):
    """Get project details"""
    project = ide.projects.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return asdict(project)

@app.post("/projects/{project_id}/build")
async def build_project(project_id: str, request: BuildRequest):
    """Build and deploy a project"""
    try:
        environment = DeploymentEnvironment(request.environment)
        build, deployment = await ide.build_and_deploy(
            project_id, environment, request.triggered_by
        )
        
        return {
            "build": asdict(build),
            "deployment": asdict(deployment),
            "status": "success"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/projects/{project_id}/builds")
async def get_project_builds(project_id: str):
    """Get builds for a project"""
    builds = [asdict(b) for b in ide.build_manager.builds.values() 
              if b.project_id == project_id]
    
    return {"builds": builds, "total": len(builds)}

@app.get("/builds/{build_id}/logs")
async def get_build_logs(build_id: str):
    """Get logs for a build"""
    logs = ide.build_manager.get_build_logs(build_id)
    
    return {
        "build_id": build_id,
        "logs": logs,
        "total_lines": len(logs)
    }

@app.post("/projects/{project_id}/analyze")
async def analyze_project(project_id: str):
    """Analyze project code quality"""
    try:
        analysis = await ide.analyze_project_code(project_id)
        return asdict(analysis)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/projects/{project_id}/workspace")
async def create_workspace(project_id: str, request: WorkspaceRequest):
    """Create development workspace"""
    try:
        workspace = await ide.create_dev_workspace(project_id, request.user_id)
        return asdict(workspace)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/workspaces/{workspace_id}")
async def terminate_workspace(workspace_id: str):
    """Terminate a workspace"""
    success = await ide.workspace_manager.terminate_workspace(workspace_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    return {"status": "terminated", "workspace_id": workspace_id}

@app.get("/templates/{project_type}")
async def get_project_template(project_type: str):
    """Get template for project type"""
    try:
        proj_type = ProjectType(project_type)
        template = ide.template_manager.templates.get(proj_type, {})
        
        return {
            "project_type": project_type,
            "template": template,
            "available": len(template) > 0
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)