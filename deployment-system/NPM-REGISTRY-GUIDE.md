# NPM Private Registry Guide

Complete guide for using Harbor as a private NPM registry for the gmac.io cluster.

## 🚀 Initial Setup

### 1. Setup Harbor NPM Repository
First time only - creates NPM project in Harbor:

```bash
./harbor-npm-setup.sh
```

This will:
- Create `npm` project in Harbor
- Create robot account for publishing
- Save credentials in `npm-robot-credentials.env`

### 2. Configure NPM Locally
Configure your local NPM to use the private registry:

```bash
# Global configuration (for your user)
./setup-npm-registry.sh --global

# Project-specific configuration
./setup-npm-registry.sh --project /path/to/your/project
```

## 📦 Publishing Packages

### 1. Package Naming
All private packages must use the `@gmac` scope:

```json
{
  "name": "@gmac/my-package",
  "version": "1.0.0",
  "publishConfig": {
    "registry": "https://registry.gmac.io/npm/"
  }
}
```

### 2. Publish Process
```bash
# Login (first time)
npm login --registry https://registry.gmac.io/npm/
# Username: admin
# Password: Harbor12345

# Publish
npm publish

# Or use the helper script created in your project
./npm-publish.sh
```

### 3. Version Management
```bash
# Patch version (1.0.0 → 1.0.1)
npm version patch

# Minor version (1.0.0 → 1.1.0)
npm version minor

# Major version (1.0.0 → 2.0.0)
npm version major

# Publish after versioning
npm publish
```

## 📥 Installing Private Packages

### In Development
```bash
# Install a private package
npm install @gmac/my-package

# Install specific version
npm install @gmac/my-package@1.2.3

# List available versions
npm view @gmac/my-package versions
```

### In Docker Builds
The Dockerfile created by `setup-project.sh` automatically handles NPM authentication:

```dockerfile
# Configure NPM for private registry
ARG NPM_AUTH_TOKEN
ARG HARBOR_URL=registry.gmac.io
RUN echo "@gmac:registry=https://${HARBOR_URL}/npm/" > ~/.npmrc && \
    echo "//${HARBOR_URL}/npm/:_auth=${NPM_AUTH_TOKEN}" >> ~/.npmrc
```

## 🔐 Authentication

### Local Development
Your `.npmrc` should contain:
```ini
@gmac:registry=https://registry.gmac.io/npm/
//registry.gmac.io/npm/:_auth=<base64-encoded-user:pass>
//registry.gmac.io/npm/:always-auth=true
registry=https://registry.npmjs.org/
```

### CI/CD Authentication
1. Get the auth token from `npm-robot-credentials.env`:
   ```bash
   cat npm-robot-credentials.env | grep NPM_AUTH_TOKEN
   ```

2. Add to your CI/CD as secret `NPM_AUTH_TOKEN`

3. GitHub Actions example:
   ```yaml
   - name: Setup NPM
     run: |
       echo "@gmac:registry=${{ vars.HARBOR_URL }}/npm/" > ~/.npmrc
       echo "//${{ vars.HARBOR_URL }}/npm/:_auth=${{ secrets.NPM_AUTH_TOKEN }}" >> ~/.npmrc
   ```

### Kubernetes Secrets
The auth token is automatically added to your app secrets:
```bash
kubectl get secret my-app-secrets -n my-app -o json | \
  jq -r '.data.NPM_AUTH_TOKEN' | base64 -d
```

## 🏗️ Project Setup Integration

When you run `setup-project.sh` for a Node.js project:

1. **Automatic Configuration**:
   - Dockerfile includes NPM registry setup
   - GitHub Actions workflow includes NPM auth
   - Creates `.npmrc.example` for reference
   - Creates `.npmignore` for publishing

2. **Manual Steps**:
   - Copy `.npmrc.example` to `.npmrc`
   - Add your auth token
   - Add `.npmrc` to `.gitignore`

## 📁 File Structure

### `.npmrc`
```ini
# Private packages
@gmac:registry=https://registry.gmac.io/npm/
//registry.gmac.io/npm/:_auth=YWRtaW46SGFyYm9yMTIzNDU=
//registry.gmac.io/npm/:always-auth=true

# Public packages fallback
registry=https://registry.npmjs.org/
```

### `.npmignore`
```
.npmrc
.env*
node_modules/
coverage/
test/
k8s/
Dockerfile
*.log
```

### `package.json`
```json
{
  "name": "@gmac/my-service",
  "version": "1.0.0",
  "publishConfig": {
    "registry": "https://registry.gmac.io/npm/",
    "access": "restricted"
  },
  "repository": {
    "type": "git",
    "url": "https://git.gmac.io/gmackie/my-service.git"
  }
}
```

## 🔍 Troubleshooting

### Authentication Failed
```bash
# Check current auth
npm whoami --registry https://registry.gmac.io/npm/

# Re-login
npm logout --registry https://registry.gmac.io/npm/
npm login --registry https://registry.gmac.io/npm/
```

### 404 Not Found
```bash
# Ensure scope is configured
npm config get @gmac:registry
# Should output: https://registry.gmac.io/npm/

# Check if package exists
curl -u admin:Harbor12345 https://registry.gmac.io/api/v2.0/projects/npm/repositories
```

### Permission Denied
```bash
# Check robot account permissions
cat npm-robot-credentials.env

# Verify in Harbor UI
# Projects → npm → Robot Accounts
```

### Cache Issues
```bash
# Clear NPM cache
npm cache clean --force

# Remove and reinstall
rm -rf node_modules package-lock.json
npm install
```

## 🎯 Best Practices

1. **Scoped Packages**: Always use `@gmac/` prefix
2. **Version Tags**: Use semantic versioning
3. **Git Tags**: Tag releases in Git
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
4. **Changelog**: Maintain CHANGELOG.md
5. **Testing**: Run tests before publishing
6. **Documentation**: Update README with install instructions

## 🔗 Quick Commands

```bash
# Setup new package
npm init --scope=@gmac
./setup-npm-registry.sh --project .

# Publish workflow
npm test
npm version patch
npm publish
git push --tags

# Install in another project
npm install @gmac/package-name

# Update all @gmac packages
npm update --scope=@gmac
```

## 🏢 Harbor UI Access

View your packages in Harbor:
1. Navigate to https://registry.gmac.io
2. Login with admin/Harbor12345
3. Go to Projects → npm
4. View repositories (packages)

## 🚨 Security Notes

1. **Never commit `.npmrc` with auth tokens**
2. **Use robot accounts for CI/CD**
3. **Rotate tokens periodically**
4. **Limit scope permissions**
5. **Audit package access in Harbor**

## 📞 Support

- Check Harbor logs: `kubectl logs -n harbor`
- NPM registry endpoint: `https://registry.gmac.io/npm/`
- Test connection: `curl -u admin:Harbor12345 https://registry.gmac.io/api/v2.0/projects/npm`