import asyncio
import json
import markdown
import yaml
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Any, Callable, Union
from enum import Enum
import logging
import uuid
import re
import hashlib
import base64
from pathlib import Path

class DocumentationType(Enum):
    API_REFERENCE = "api_reference"
    TUTORIAL = "tutorial"
    GUIDE = "guide"
    SDK = "sdk"
    CHANGELOG = "changelog"
    FAQ = "faq"
    QUICKSTART = "quickstart"
    WEBHOOK_DOCS = "webhook_docs"

class CodeLanguage(Enum):
    CURL = "curl"
    JAVASCRIPT = "javascript"
    PYTHON = "python"
    JAVA = "java"
    PHP = "php"
    RUBY = "ruby"
    GO = "go"
    CSHARP = "csharp"
    SWIFT = "swift"
    KOTLIN = "kotlin"

class ExampleType(Enum):
    REQUEST = "request"
    RESPONSE = "response"
    FULL_EXAMPLE = "full_example"
    SDK_SNIPPET = "sdk_snippet"

class UserRole(Enum):
    DEVELOPER = "developer"
    ADMIN = "admin"
    MAINTAINER = "maintainer"
    VIEWER = "viewer"

@dataclass
class CodeExample:
    id: str
    language: CodeLanguage
    example_type: ExampleType
    title: str
    code: str
    description: Optional[str] = None
    endpoint: Optional[str] = None
    tags: List[str] = field(default_factory=list)

@dataclass
class APIEndpointDoc:
    id: str
    path: str
    method: str
    title: str
    description: str
    parameters: List[Dict[str, Any]] = field(default_factory=list)
    request_body: Optional[Dict[str, Any]] = None
    responses: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    code_examples: List[CodeExample] = field(default_factory=list)
    authentication_required: bool = True
    rate_limits: Optional[Dict[str, int]] = None
    deprecated: bool = False
    deprecation_message: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    last_updated: datetime = field(default_factory=datetime.now)

@dataclass
class DocumentationPage:
    id: str
    title: str
    content: str
    doc_type: DocumentationType
    slug: str
    parent_id: Optional[str] = None
    order: int = 0
    is_published: bool = True
    author: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class SDKInfo:
    id: str
    name: str
    language: CodeLanguage
    version: str
    download_url: str
    documentation_url: str
    github_url: Optional[str] = None
    installation_guide: str = ""
    examples: List[CodeExample] = field(default_factory=list)
    is_official: bool = True
    last_updated: datetime = field(default_factory=datetime.now)

@dataclass
class DeveloperUser:
    id: str
    username: str
    email: str
    full_name: str
    role: UserRole
    api_keys: List[str] = field(default_factory=list)
    organization: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    last_login: Optional[datetime] = None
    preferences: Dict[str, Any] = field(default_factory=dict)
    is_active: bool = True

@dataclass
class InteractiveExample:
    id: str
    title: str
    description: str
    endpoint: str
    method: str
    default_parameters: Dict[str, Any] = field(default_factory=dict)
    default_headers: Dict[str, str] = field(default_factory=dict)
    default_body: Optional[str] = None
    expected_response: Dict[str, Any] = field(default_factory=dict)

class OpenAPIGenerator:
    """Generate OpenAPI 3.0 specifications from endpoint documentation"""
    
    def __init__(self):
        self.spec_template = {
            "openapi": "3.0.3",
            "info": {
                "title": "API Documentation",
                "description": "Comprehensive API documentation",
                "version": "1.0.0",
                "contact": {
                    "name": "API Support",
                    "email": "support@example.com"
                }
            },
            "servers": [
                {
                    "url": "https://api.example.com/v1",
                    "description": "Production server"
                }
            ],
            "paths": {},
            "components": {
                "schemas": {},
                "securitySchemes": {
                    "ApiKeyAuth": {
                        "type": "apiKey",
                        "in": "header",
                        "name": "X-API-Key"
                    },
                    "BearerAuth": {
                        "type": "http",
                        "scheme": "bearer"
                    }
                }
            }
        }
        
    async def generate_openapi_spec(self, endpoints: List[APIEndpointDoc], 
                                  api_info: Dict[str, Any] = None) -> Dict[str, Any]:
        """Generate complete OpenAPI specification"""
        
        spec = self.spec_template.copy()
        
        # Update API info if provided
        if api_info:
            spec["info"].update(api_info)
            
        # Process endpoints
        for endpoint in endpoints:
            await self._add_endpoint_to_spec(spec, endpoint)
            
        return spec
        
    async def _add_endpoint_to_spec(self, spec: Dict[str, Any], endpoint: APIEndpointDoc):
        """Add endpoint documentation to OpenAPI spec"""
        
        path = endpoint.path
        method = endpoint.method.lower()
        
        if path not in spec["paths"]:
            spec["paths"][path] = {}
            
        # Build operation object
        operation = {
            "summary": endpoint.title,
            "description": endpoint.description,
            "tags": endpoint.tags,
            "operationId": f"{method}_{path.replace('/', '_').replace('{', '').replace('}', '')}"
        }
        
        # Add parameters
        if endpoint.parameters:
            operation["parameters"] = []
            for param in endpoint.parameters:
                operation["parameters"].append({
                    "name": param["name"],
                    "in": param.get("in", "query"),
                    "description": param.get("description", ""),
                    "required": param.get("required", False),
                    "schema": {
                        "type": param.get("type", "string")
                    }
                })
        
        # Add request body
        if endpoint.request_body:
            operation["requestBody"] = {
                "required": endpoint.request_body.get("required", True),
                "content": {
                    "application/json": {
                        "schema": endpoint.request_body.get("schema", {})
                    }
                }
            }
        
        # Add responses
        operation["responses"] = {}
        for status_code, response_info in endpoint.responses.items():
            operation["responses"][status_code] = {
                "description": response_info.get("description", ""),
                "content": {
                    "application/json": {
                        "schema": response_info.get("schema", {})
                    }
                }
            }
        
        # Add security if authentication required
        if endpoint.authentication_required:
            operation["security"] = [
                {"ApiKeyAuth": []},
                {"BearerAuth": []}
            ]
        
        # Add deprecation info
        if endpoint.deprecated:
            operation["deprecated"] = True
            if endpoint.deprecation_message:
                operation["description"] += f"\n\n**Deprecated:** {endpoint.deprecation_message}"
        
        spec["paths"][path][method] = operation

class CodeExampleGenerator:
    """Generate code examples in multiple languages"""
    
    def __init__(self):
        self.templates = {
            CodeLanguage.CURL: self._generate_curl_example,
            CodeLanguage.JAVASCRIPT: self._generate_javascript_example,
            CodeLanguage.PYTHON: self._generate_python_example,
            CodeLanguage.JAVA: self._generate_java_example,
            CodeLanguage.PHP: self._generate_php_example,
            CodeLanguage.RUBY: self._generate_ruby_example,
            CodeLanguage.GO: self._generate_go_example,
            CodeLanguage.CSHARP: self._generate_csharp_example
        }
        
    async def generate_examples(self, endpoint: APIEndpointDoc, 
                              languages: List[CodeLanguage] = None) -> List[CodeExample]:
        """Generate code examples for an endpoint"""
        
        if languages is None:
            languages = [CodeLanguage.CURL, CodeLanguage.JAVASCRIPT, CodeLanguage.PYTHON]
            
        examples = []
        
        for language in languages:
            if language in self.templates:
                example = await self.templates[language](endpoint)
                if example:
                    examples.append(example)
                    
        return examples
        
    async def _generate_curl_example(self, endpoint: APIEndpointDoc) -> CodeExample:
        """Generate cURL example"""
        
        url = f"https://api.example.com/v1{endpoint.path}"
        method = endpoint.method.upper()
        
        # Replace path parameters with example values
        url = re.sub(r'\{(\w+)\}', r'<\1>', url)
        
        curl_parts = [f"curl -X {method}"]
        
        # Add headers
        if endpoint.authentication_required:
            curl_parts.append('-H "Authorization: Bearer YOUR_API_KEY"')
        curl_parts.append('-H "Content-Type: application/json"')
        
        # Add query parameters example
        if any(p.get("in") == "query" for p in endpoint.parameters):
            query_params = []
            for param in endpoint.parameters:
                if param.get("in") == "query":
                    example_value = param.get("example", "value")
                    query_params.append(f"{param['name']}={example_value}")
            if query_params:
                url += "?" + "&".join(query_params)
        
        # Add request body
        if endpoint.request_body and method in ["POST", "PUT", "PATCH"]:
            example_body = endpoint.request_body.get("example", {})
            if example_body:
                curl_parts.append(f'-d \'{json.dumps(example_body, indent=2)}\'')
        
        curl_parts.append(f'"{url}"')
        
        code = " \\\n  ".join(curl_parts)
        
        return CodeExample(
            id=str(uuid.uuid4()),
            language=CodeLanguage.CURL,
            example_type=ExampleType.REQUEST,
            title=f"{method} {endpoint.path}",
            code=code,
            endpoint=endpoint.path
        )
        
    async def _generate_javascript_example(self, endpoint: APIEndpointDoc) -> CodeExample:
        """Generate JavaScript/fetch example"""
        
        url = f"'https://api.example.com/v1{endpoint.path}'"
        method = endpoint.method.upper()
        
        # Replace path parameters
        url = re.sub(r'\{(\w+)\}', r"' + \1 + '", url)
        if url.endswith(" + ''"):
            url = url[:-5]
        
        code_lines = [
            f"const response = await fetch({url}, {{",
            f"  method: '{method}',",
            "  headers: {"
        ]
        
        if endpoint.authentication_required:
            code_lines.append("    'Authorization': 'Bearer ' + apiKey,")
        code_lines.append("    'Content-Type': 'application/json'")
        code_lines.append("  }")
        
        # Add request body
        if endpoint.request_body and method in ["POST", "PUT", "PATCH"]:
            code_lines.append(",")
            example_body = endpoint.request_body.get("example", {})
            code_lines.append(f"  body: JSON.stringify({json.dumps(example_body)})")
        
        code_lines.extend([
            "});",
            "",
            "const data = await response.json();",
            "console.log(data);"
        ])
        
        return CodeExample(
            id=str(uuid.uuid4()),
            language=CodeLanguage.JAVASCRIPT,
            example_type=ExampleType.REQUEST,
            title=f"{method} {endpoint.path}",
            code="\n".join(code_lines),
            endpoint=endpoint.path
        )
        
    async def _generate_python_example(self, endpoint: APIEndpointDoc) -> CodeExample:
        """Generate Python requests example"""
        
        url = f"'https://api.example.com/v1{endpoint.path}'"
        method = endpoint.method.lower()
        
        # Replace path parameters
        url = re.sub(r'\{(\w+)\}', r"' + str(\1) + '", url)
        if url.endswith(" + ''"):
            url = url[:-5]
        
        code_lines = [
            "import requests",
            "",
            f"url = {url}",
            "headers = {"
        ]
        
        if endpoint.authentication_required:
            code_lines.append("    'Authorization': 'Bearer ' + api_key,")
        code_lines.append("    'Content-Type': 'application/json'")
        code_lines.append("}")
        
        # Add request body
        if endpoint.request_body and method in ["post", "put", "patch"]:
            example_body = endpoint.request_body.get("example", {})
            code_lines.extend([
                "",
                f"data = {json.dumps(example_body, indent=4)}",
                "",
                f"response = requests.{method}(url, headers=headers, json=data)"
            ])
        else:
            code_lines.extend([
                "",
                f"response = requests.{method}(url, headers=headers)"
            ])
        
        code_lines.extend([
            "",
            "if response.status_code == 200:",
            "    print(response.json())",
            "else:",
            "    print(f'Error: {response.status_code}')"
        ])
        
        return CodeExample(
            id=str(uuid.uuid4()),
            language=CodeLanguage.PYTHON,
            example_type=ExampleType.REQUEST,
            title=f"{method.upper()} {endpoint.path}",
            code="\n".join(code_lines),
            endpoint=endpoint.path
        )
        
    async def _generate_java_example(self, endpoint: APIEndpointDoc) -> CodeExample:
        """Generate Java example"""
        
        method = endpoint.method.upper()
        
        code_lines = [
            "import java.net.http.*;",
            "import java.net.URI;",
            "",
            "HttpClient client = HttpClient.newHttpClient();",
            f"HttpRequest request = HttpRequest.newBuilder()",
            f"    .uri(URI.create(\"https://api.example.com/v1{endpoint.path}\"))",
            f"    .{method.lower()}()"
        ]
        
        if endpoint.authentication_required:
            code_lines.append("    .header(\"Authorization\", \"Bearer \" + apiKey)")
        code_lines.append("    .header(\"Content-Type\", \"application/json\")")
        
        # Add request body for POST/PUT/PATCH
        if endpoint.request_body and method in ["POST", "PUT", "PATCH"]:
            example_body = json.dumps(endpoint.request_body.get("example", {}))
            code_lines.append(f"    .{method.lower()}(HttpRequest.BodyPublishers.ofString(\"{example_body}\"))")
        
        code_lines.extend([
            "    .build();",
            "",
            "HttpResponse<String> response = client.send(request,",
            "    HttpResponse.BodyHandlers.ofString());",
            "",
            "System.out.println(response.body());"
        ])
        
        return CodeExample(
            id=str(uuid.uuid4()),
            language=CodeLanguage.JAVA,
            example_type=ExampleType.REQUEST,
            title=f"{method} {endpoint.path}",
            code="\n".join(code_lines),
            endpoint=endpoint.path
        )
        
    async def _generate_php_example(self, endpoint: APIEndpointDoc) -> CodeExample:
        """Generate PHP example"""
        
        method = endpoint.method.upper()
        
        code_lines = [
            "<?php",
            "$url = 'https://api.example.com/v1" + endpoint.path + "';",
            "$headers = ["
        ]
        
        if endpoint.authentication_required:
            code_lines.append("    'Authorization: Bearer ' . $apiKey,")
        code_lines.append("    'Content-Type: application/json'")
        code_lines.append("];")
        
        code_lines.extend([
            "",
            "$ch = curl_init();",
            "curl_setopt($ch, CURLOPT_URL, $url);",
            "curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);",
            "curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);"
        ])
        
        if method != "GET":
            code_lines.append(f"curl_setopt($ch, CURLOPT_CUSTOMREQUEST, '{method}');")
            
        if endpoint.request_body and method in ["POST", "PUT", "PATCH"]:
            example_body = json.dumps(endpoint.request_body.get("example", {}))
            code_lines.append(f"curl_setopt($ch, CURLOPT_POSTFIELDS, '{example_body}');")
        
        code_lines.extend([
            "",
            "$response = curl_exec($ch);",
            "curl_close($ch);",
            "",
            "echo $response;",
            "?>"
        ])
        
        return CodeExample(
            id=str(uuid.uuid4()),
            language=CodeLanguage.PHP,
            example_type=ExampleType.REQUEST,
            title=f"{method} {endpoint.path}",
            code="\n".join(code_lines),
            endpoint=endpoint.path
        )
        
    async def _generate_ruby_example(self, endpoint: APIEndpointDoc) -> CodeExample:
        """Generate Ruby example"""
        
        method = endpoint.method.lower()
        
        code_lines = [
            "require 'net/http'",
            "require 'json'",
            "",
            f"uri = URI('https://api.example.com/v1{endpoint.path}')",
            "http = Net::HTTP.new(uri.host, uri.port)",
            "http.use_ssl = true",
            "",
            f"request = Net::HTTP::{method.capitalize()}.new(uri)"
        ]
        
        if endpoint.authentication_required:
            code_lines.append("request['Authorization'] = 'Bearer ' + api_key")
        code_lines.append("request['Content-Type'] = 'application/json'")
        
        if endpoint.request_body and method in ["post", "put", "patch"]:
            example_body = endpoint.request_body.get("example", {})
            code_lines.append(f"request.body = {json.dumps(example_body)}.to_json")
        
        code_lines.extend([
            "",
            "response = http.request(request)",
            "puts response.body"
        ])
        
        return CodeExample(
            id=str(uuid.uuid4()),
            language=CodeLanguage.RUBY,
            example_type=ExampleType.REQUEST,
            title=f"{method.upper()} {endpoint.path}",
            code="\n".join(code_lines),
            endpoint=endpoint.path
        )
        
    async def _generate_go_example(self, endpoint: APIEndpointDoc) -> CodeExample:
        """Generate Go example"""
        
        method = endpoint.method.upper()
        
        code_lines = [
            "package main",
            "",
            "import (",
            "    \"bytes\"",
            "    \"fmt\"",
            "    \"io/ioutil\"",
            "    \"net/http\"",
            ")",
            "",
            "func main() {",
            f"    url := \"https://api.example.com/v1{endpoint.path}\"",
            ""
        ]
        
        if endpoint.request_body and method in ["POST", "PUT", "PATCH"]:
            example_body = json.dumps(endpoint.request_body.get("example", {}))
            code_lines.extend([
                f"    jsonData := []byte(`{example_body}`)",
                "    req, err := http.NewRequest(\"" + method + "\", url, bytes.NewBuffer(jsonData))"
            ])
        else:
            code_lines.append(f"    req, err := http.NewRequest(\"{method}\", url, nil)")
        
        code_lines.extend([
            "    if err != nil {",
            "        panic(err)",
            "    }",
            ""
        ])
        
        if endpoint.authentication_required:
            code_lines.append("    req.Header.Set(\"Authorization\", \"Bearer \" + apiKey)")
        code_lines.append("    req.Header.Set(\"Content-Type\", \"application/json\")")
        
        code_lines.extend([
            "",
            "    client := &http.Client{}",
            "    resp, err := client.Do(req)",
            "    if err != nil {",
            "        panic(err)",
            "    }",
            "    defer resp.Body.Close()",
            "",
            "    body, _ := ioutil.ReadAll(resp.Body)",
            "    fmt.Println(string(body))",
            "}"
        ])
        
        return CodeExample(
            id=str(uuid.uuid4()),
            language=CodeLanguage.GO,
            example_type=ExampleType.REQUEST,
            title=f"{method} {endpoint.path}",
            code="\n".join(code_lines),
            endpoint=endpoint.path
        )
        
    async def _generate_csharp_example(self, endpoint: APIEndpointDoc) -> CodeExample:
        """Generate C# example"""
        
        method = endpoint.method.upper()
        
        code_lines = [
            "using System;",
            "using System.Net.Http;",
            "using System.Text;",
            "using System.Threading.Tasks;",
            "",
            "class Program",
            "{",
            "    static async Task Main()",
            "    {",
            "        using var client = new HttpClient();",
            f"        var url = \"https://api.example.com/v1{endpoint.path}\";",
            ""
        ]
        
        if endpoint.authentication_required:
            code_lines.append("        client.DefaultRequestHeaders.Authorization = ")
            code_lines.append("            new System.Net.Http.Headers.AuthenticationHeaderValue(\"Bearer\", apiKey);")
        
        if endpoint.request_body and method in ["POST", "PUT", "PATCH"]:
            example_body = json.dumps(endpoint.request_body.get("example", {}))
            code_lines.extend([
                f"        var json = @\"{example_body}\";",
                "        var content = new StringContent(json, Encoding.UTF8, \"application/json\");",
                f"        var response = await client.{method.capitalize()}Async(url, content);"
            ])
        else:
            code_lines.append(f"        var response = await client.{method.capitalize()}Async(url);")
        
        code_lines.extend([
            "",
            "        var result = await response.Content.ReadAsStringAsync();",
            "        Console.WriteLine(result);",
            "    }",
            "}"
        ])
        
        return CodeExample(
            id=str(uuid.uuid4()),
            language=CodeLanguage.CSHARP,
            example_type=ExampleType.REQUEST,
            title=f"{method} {endpoint.path}",
            code="\n".join(code_lines),
            endpoint=endpoint.path
        )

class DocumentationSearchEngine:
    """Search engine for documentation content"""
    
    def __init__(self):
        self.search_index = {}
        self.document_content = {}
        
    async def index_document(self, doc_id: str, title: str, content: str, tags: List[str] = None):
        """Index a document for search"""
        
        # Create searchable text
        searchable_text = f"{title} {content}".lower()
        if tags:
            searchable_text += " " + " ".join(tags).lower()
        
        # Simple keyword extraction
        keywords = re.findall(r'\b\w+\b', searchable_text)
        keywords = [word for word in keywords if len(word) > 2]  # Filter short words
        
        # Update search index
        for keyword in set(keywords):
            if keyword not in self.search_index:
                self.search_index[keyword] = []
            self.search_index[keyword].append(doc_id)
        
        # Store document content
        self.document_content[doc_id] = {
            'title': title,
            'content': content,
            'tags': tags or []
        }
        
    async def search(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Search for documents matching the query"""
        
        query_keywords = re.findall(r'\b\w+\b', query.lower())
        query_keywords = [word for word in query_keywords if len(word) > 2]
        
        if not query_keywords:
            return []
        
        # Find matching documents
        doc_scores = {}
        
        for keyword in query_keywords:
            if keyword in self.search_index:
                for doc_id in self.search_index[keyword]:
                    if doc_id not in doc_scores:
                        doc_scores[doc_id] = 0
                    doc_scores[doc_id] += 1
        
        # Sort by relevance score
        sorted_docs = sorted(doc_scores.items(), key=lambda x: x[1], reverse=True)
        
        # Build results
        results = []
        for doc_id, score in sorted_docs[:limit]:
            if doc_id in self.document_content:
                doc = self.document_content[doc_id]
                
                # Create excerpt
                content = doc['content']
                excerpt = content[:200] + "..." if len(content) > 200 else content
                
                results.append({
                    'id': doc_id,
                    'title': doc['title'],
                    'excerpt': excerpt,
                    'score': score,
                    'tags': doc['tags']
                })
        
        return results

class DeveloperPortalSystem:
    def __init__(self):
        self.documentation_pages = {}
        self.api_endpoints = {}
        self.sdks = {}
        self.users = {}
        self.interactive_examples = {}
        self.openapi_generator = OpenAPIGenerator()
        self.code_generator = CodeExampleGenerator()
        self.search_engine = DocumentationSearchEngine()
        
    async def initialize(self):
        """Initialize the developer portal with sample content"""
        await self._create_sample_documentation()
        await self._create_sample_api_docs()
        await self._create_sample_sdks()
        
    async def _create_sample_documentation(self):
        """Create sample documentation pages"""
        
        # Getting Started Guide
        getting_started = DocumentationPage(
            id="getting-started",
            title="Getting Started",
            content="""
# Getting Started with Our API

Welcome to our API! This guide will help you get up and running quickly.

## Authentication

All API requests require authentication using an API key. Include your API key in the `Authorization` header:

```
Authorization: Bearer YOUR_API_KEY
```

## Rate Limits

- Free plan: 1,000 requests per hour
- Starter plan: 10,000 requests per hour  
- Professional plan: 100,000 requests per hour

## Base URL

All API requests should be made to:
```
https://api.example.com/v1
```

## Quick Example

Here's a simple example to get you started:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://api.example.com/v1/users
```

## Next Steps

- [API Reference](/docs/api-reference)
- [Tutorials](/docs/tutorials)
- [SDKs](/docs/sdks)
""",
            doc_type=DocumentationType.QUICKSTART,
            slug="getting-started",
            order=1
        )
        
        # API Reference
        api_reference = DocumentationPage(
            id="api-reference",
            title="API Reference",
            content="""
# API Reference

Complete reference documentation for all API endpoints.

## Authentication

### API Key Authentication
Include your API key in the Authorization header of every request.

### Rate Limiting
API calls are subject to rate limiting based on your subscription plan.

## Endpoints

### Users
- `GET /users` - List all users
- `POST /users` - Create a new user
- `GET /users/{id}` - Get user details
- `PUT /users/{id}` - Update user
- `DELETE /users/{id}` - Delete user

### Posts
- `GET /posts` - List all posts
- `POST /posts` - Create a new post
- `GET /posts/{id}` - Get post details

## Error Handling

All errors return a JSON response with the following structure:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message"
  }
}
```

Common error codes:
- `INVALID_API_KEY` - The provided API key is invalid
- `RATE_LIMIT_EXCEEDED` - You have exceeded your rate limit
- `RESOURCE_NOT_FOUND` - The requested resource was not found
""",
            doc_type=DocumentationType.API_REFERENCE,
            slug="api-reference",
            order=2
        )
        
        # Tutorials
        tutorial = DocumentationPage(
            id="tutorial-user-management",
            title="User Management Tutorial",
            content="""
# User Management Tutorial

Learn how to manage users with our API.

## Creating a User

To create a new user, send a POST request to the `/users` endpoint:

```python
import requests

url = "https://api.example.com/v1/users"
headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
}
data = {
    "name": "John Doe",
    "email": "john@example.com"
}

response = requests.post(url, headers=headers, json=data)
user = response.json()
print(f"Created user with ID: {user['id']}")
```

## Retrieving Users

Get a list of all users:

```python
response = requests.get(url, headers=headers)
users = response.json()
print(f"Found {len(users)} users")
```

## Updating a User

Update an existing user:

```python
user_id = "123"
update_url = f"{url}/{user_id}"
update_data = {"name": "Jane Doe"}

response = requests.put(update_url, headers=headers, json=update_data)
updated_user = response.json()
print(f"Updated user: {updated_user['name']}")
```

## Best Practices

1. Always validate user input
2. Handle API errors gracefully
3. Implement proper error handling
4. Use pagination for large datasets
""",
            doc_type=DocumentationType.TUTORIAL,
            slug="user-management-tutorial",
            parent_id="tutorials",
            order=1
        )
        
        for page in [getting_started, api_reference, tutorial]:
            await self.add_documentation_page(page)
            
    async def _create_sample_api_docs(self):
        """Create sample API endpoint documentation"""
        
        # Users endpoint
        users_endpoint = APIEndpointDoc(
            id="get-users",
            path="/users",
            method="GET",
            title="List Users",
            description="Retrieve a list of all users with optional filtering and pagination.",
            parameters=[
                {
                    "name": "limit",
                    "in": "query",
                    "type": "integer",
                    "description": "Maximum number of users to return",
                    "required": False,
                    "example": 10
                },
                {
                    "name": "offset",
                    "in": "query", 
                    "type": "integer",
                    "description": "Number of users to skip",
                    "required": False,
                    "example": 0
                },
                {
                    "name": "email",
                    "in": "query",
                    "type": "string",
                    "description": "Filter users by email",
                    "required": False
                }
            ],
            responses={
                "200": {
                    "description": "Successful response",
                    "schema": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {"type": "string"},
                                "name": {"type": "string"},
                                "email": {"type": "string"},
                                "created_at": {"type": "string", "format": "date-time"}
                            }
                        }
                    }
                },
                "401": {
                    "description": "Unauthorized - Invalid API key"
                },
                "429": {
                    "description": "Rate limit exceeded"
                }
            },
            rate_limits={"requests_per_hour": 1000},
            tags=["users"]
        )
        
        # Create user endpoint
        create_user_endpoint = APIEndpointDoc(
            id="create-user",
            path="/users",
            method="POST",
            title="Create User",
            description="Create a new user account.",
            request_body={
                "required": True,
                "schema": {
                    "type": "object",
                    "required": ["name", "email"],
                    "properties": {
                        "name": {"type": "string", "description": "User's full name"},
                        "email": {"type": "string", "format": "email", "description": "User's email address"},
                        "role": {"type": "string", "enum": ["user", "admin"], "default": "user"}
                    }
                },
                "example": {
                    "name": "John Doe",
                    "email": "john@example.com",
                    "role": "user"
                }
            },
            responses={
                "201": {
                    "description": "User created successfully",
                    "schema": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string"},
                            "name": {"type": "string"},
                            "email": {"type": "string"},
                            "role": {"type": "string"},
                            "created_at": {"type": "string", "format": "date-time"}
                        }
                    }
                },
                "400": {
                    "description": "Bad request - Invalid input"
                },
                "409": {
                    "description": "Conflict - Email already exists"
                }
            },
            tags=["users"]
        )
        
        await self.add_api_endpoint_doc(users_endpoint)
        await self.add_api_endpoint_doc(create_user_endpoint)
        
    async def _create_sample_sdks(self):
        """Create sample SDK information"""
        
        python_sdk = SDKInfo(
            id="python-sdk",
            name="Python SDK",
            language=CodeLanguage.PYTHON,
            version="1.2.0",
            download_url="https://pypi.org/project/example-api-sdk/",
            documentation_url="/docs/python-sdk",
            github_url="https://github.com/example/python-sdk",
            installation_guide="pip install example-api-sdk",
            is_official=True
        )
        
        javascript_sdk = SDKInfo(
            id="javascript-sdk",
            name="JavaScript SDK",
            language=CodeLanguage.JAVASCRIPT,
            version="2.1.0",
            download_url="https://www.npmjs.com/package/example-api-sdk",
            documentation_url="/docs/javascript-sdk",
            github_url="https://github.com/example/javascript-sdk",
            installation_guide="npm install example-api-sdk",
            is_official=True
        )
        
        for sdk in [python_sdk, javascript_sdk]:
            await self.add_sdk(sdk)
            
    async def add_documentation_page(self, page: DocumentationPage):
        """Add a documentation page"""
        self.documentation_pages[page.id] = page
        
        # Index for search
        await self.search_engine.index_document(
            page.id, page.title, page.content, page.tags
        )
        
    async def add_api_endpoint_doc(self, endpoint: APIEndpointDoc):
        """Add API endpoint documentation"""
        self.api_endpoints[endpoint.id] = endpoint
        
        # Generate code examples
        examples = await self.code_generator.generate_examples(endpoint)
        endpoint.code_examples = examples
        
        # Index for search
        search_content = f"{endpoint.title} {endpoint.description} {endpoint.path}"
        await self.search_engine.index_document(
            f"endpoint_{endpoint.id}", endpoint.title, search_content, endpoint.tags
        )
        
    async def add_sdk(self, sdk: SDKInfo):
        """Add SDK information"""
        self.sdks[sdk.id] = sdk
        
    async def register_developer(self, user: DeveloperUser):
        """Register a new developer user"""
        self.users[user.id] = user
        
    async def generate_openapi_spec(self) -> Dict[str, Any]:
        """Generate complete OpenAPI specification"""
        endpoints = list(self.api_endpoints.values())
        
        api_info = {
            "title": "Developer API",
            "description": "Comprehensive API for developers",
            "version": "1.0.0"
        }
        
        return await self.openapi_generator.generate_openapi_spec(endpoints, api_info)
        
    async def search_documentation(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Search documentation content"""
        return await self.search_engine.search(query, limit)
        
    async def get_documentation_tree(self) -> Dict[str, Any]:
        """Get hierarchical documentation structure"""
        
        # Group pages by parent
        root_pages = []
        child_pages = {}
        
        for page in self.documentation_pages.values():
            if page.parent_id is None:
                root_pages.append(page)
            else:
                if page.parent_id not in child_pages:
                    child_pages[page.parent_id] = []
                child_pages[page.parent_id].append(page)
        
        # Build tree structure
        def build_tree_node(page):
            node = {
                'id': page.id,
                'title': page.title,
                'slug': page.slug,
                'type': page.doc_type.value,
                'children': []
            }
            
            if page.id in child_pages:
                for child in sorted(child_pages[page.id], key=lambda x: x.order):
                    node['children'].append(build_tree_node(child))
            
            return node
        
        tree = []
        for page in sorted(root_pages, key=lambda x: x.order):
            tree.append(build_tree_node(page))
        
        return {'documentation_tree': tree}
        
    async def get_api_reference_data(self) -> Dict[str, Any]:
        """Get complete API reference data"""
        
        # Group endpoints by tags
        endpoints_by_tag = {}
        
        for endpoint in self.api_endpoints.values():
            for tag in endpoint.tags or ['general']:
                if tag not in endpoints_by_tag:
                    endpoints_by_tag[tag] = []
                endpoints_by_tag[tag].append({
                    'id': endpoint.id,
                    'path': endpoint.path,
                    'method': endpoint.method,
                    'title': endpoint.title,
                    'description': endpoint.description,
                    'deprecated': endpoint.deprecated
                })
        
        return {
            'endpoints_by_tag': endpoints_by_tag,
            'total_endpoints': len(self.api_endpoints)
        }
        
    async def get_dashboard_data(self, user_id: str) -> Dict[str, Any]:
        """Get developer dashboard data"""
        
        if user_id not in self.users:
            return {}
        
        user = self.users[user_id]
        
        # Get recent documentation updates
        recent_docs = sorted(
            self.documentation_pages.values(),
            key=lambda x: x.updated_at,
            reverse=True
        )[:5]
        
        # Get popular endpoints (mock data)
        popular_endpoints = [
            {'path': '/users', 'method': 'GET', 'usage_count': 1250},
            {'path': '/users', 'method': 'POST', 'usage_count': 890},
            {'path': '/posts', 'method': 'GET', 'usage_count': 760}
        ]
        
        return {
            'user': {
                'id': user.id,
                'name': user.full_name,
                'role': user.role.value,
                'api_keys_count': len(user.api_keys)
            },
            'recent_documentation': [
                {
                    'id': doc.id,
                    'title': doc.title,
                    'updated_at': doc.updated_at.isoformat(),
                    'type': doc.doc_type.value
                }
                for doc in recent_docs
            ],
            'popular_endpoints': popular_endpoints,
            'quick_links': [
                {'title': 'Getting Started', 'url': '/docs/getting-started'},
                {'title': 'API Reference', 'url': '/docs/api-reference'},
                {'title': 'Tutorials', 'url': '/docs/tutorials'},
                {'title': 'SDKs', 'url': '/docs/sdks'}
            ]
        }
        
    async def get_portal_analytics(self) -> Dict[str, Any]:
        """Get developer portal analytics"""
        
        total_pages = len(self.documentation_pages)
        total_endpoints = len(self.api_endpoints)
        total_users = len(self.users)
        total_sdks = len(self.sdks)
        
        # Page views by type (mock data)
        page_views_by_type = {
            'api_reference': 2500,
            'tutorial': 1800,
            'guide': 1200,
            'quickstart': 900,
            'sdk': 600
        }
        
        # Top search queries (mock data)
        top_searches = [
            {'query': 'authentication', 'count': 156},
            {'query': 'rate limits', 'count': 134},
            {'query': 'webhooks', 'count': 98},
            {'query': 'pagination', 'count': 87},
            {'query': 'error codes', 'count': 76}
        ]
        
        return {
            'content_stats': {
                'total_pages': total_pages,
                'total_endpoints': total_endpoints,
                'total_sdks': total_sdks
            },
            'user_stats': {
                'total_developers': total_users,
                'active_developers': sum(1 for u in self.users.values() if u.is_active)
            },
            'engagement': {
                'page_views_by_type': page_views_by_type,
                'top_searches': top_searches,
                'total_page_views': sum(page_views_by_type.values())
            }
        }

# Example usage
async def main():
    portal = DeveloperPortalSystem()
    await portal.initialize()
    
    # Register a developer
    developer = DeveloperUser(
        id="dev_001",
        username="john_dev",
        email="john@developer.com",
        full_name="John Developer",
        role=UserRole.DEVELOPER,
        api_keys=["ak_12345"],
        organization="Acme Corp"
    )
    
    await portal.register_developer(developer)
    
    # Generate OpenAPI spec
    openapi_spec = await portal.generate_openapi_spec()
    print(f"Generated OpenAPI spec with {len(openapi_spec['paths'])} endpoints")
    
    # Search documentation
    search_results = await portal.search_documentation("authentication user")
    print(f"Found {len(search_results)} search results")
    
    # Get documentation tree
    doc_tree = await portal.get_documentation_tree()
    print(f"Documentation tree: {json.dumps(doc_tree, indent=2)}")
    
    # Get API reference data
    api_ref = await portal.get_api_reference_data()
    print(f"API Reference: {len(api_ref['endpoints_by_tag'])} tag groups")
    
    # Get dashboard data
    dashboard = await portal.get_dashboard_data("dev_001")
    print(f"Dashboard data: {json.dumps(dashboard, indent=2, default=str)}")
    
    # Get analytics
    analytics = await portal.get_portal_analytics()
    print(f"Portal Analytics: {json.dumps(analytics, indent=2)}")

if __name__ == "__main__":
    asyncio.run(main())