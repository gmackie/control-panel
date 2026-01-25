import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  TemplateConfig,
  TemplateMetadata,
  PlaceholdersConfig,
  IntegrationModule,
  InstantiateTemplateInput,
  ProvisioningStepResult,
  TemplateSource,
} from './types';

const execAsync = promisify(exec);

export class TemplateEngine {
  private workDir: string;

  constructor(workDir?: string) {
    this.workDir = workDir ?? '/tmp/template-engine';
  }

  async loadTemplateMetadata(source: TemplateSource): Promise<TemplateMetadata> {
    const templatePath = await this.getTemplatePath(source);
    
    const configPath = path.join(templatePath, '.template', 'config.json');
    const placeholdersPath = path.join(templatePath, '.template', 'placeholders.json');
    const integrationsDir = path.join(templatePath, '.template', 'integrations');

    const [configRaw, placeholdersRaw] = await Promise.all([
      fs.readFile(configPath, 'utf-8').catch(() => '{}'),
      fs.readFile(placeholdersPath, 'utf-8').catch(() => '{"placeholders":{}}'),
    ]);

    const config = JSON.parse(configRaw) as TemplateConfig;
    const placeholders = JSON.parse(placeholdersRaw) as PlaceholdersConfig;

    const integrations: IntegrationModule[] = [];
    try {
      const files = await fs.readdir(integrationsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(integrationsDir, file), 'utf-8');
          integrations.push(JSON.parse(content) as IntegrationModule);
        }
      }
    } catch {
      // No integrations directory
    }

    return { config, placeholders, integrations };
  }

  async instantiate(
    source: TemplateSource,
    input: InstantiateTemplateInput,
    metadata: TemplateMetadata
  ): Promise<{ localPath: string; steps: ProvisioningStepResult[] }> {
    const steps: ProvisioningStepResult[] = [];
    const instanceId = `${input.appSlug}-${Date.now()}`;
    const instancePath = path.join(this.workDir, 'instances', instanceId);

    await fs.mkdir(instancePath, { recursive: true });

    const cloneStep: ProvisioningStepResult = {
      step: 'clone',
      provider: 'template',
      status: 'pending',
      message: 'Cloning template repository',
    };
    steps.push(cloneStep);

    try {
      await this.cloneTemplate(source, instancePath);
      cloneStep.status = 'success';
      cloneStep.message = 'Template cloned successfully';
    } catch (error) {
      cloneStep.status = 'failed';
      cloneStep.message = `Clone failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      throw error;
    }

    const placeholderStep: ProvisioningStepResult = {
      step: 'placeholders',
      provider: 'template',
      status: 'pending',
      message: 'Replacing placeholders',
    };
    steps.push(placeholderStep);

    try {
      const placeholderValues = this.buildPlaceholderValues(input, metadata.placeholders);
      await this.replacePlaceholders(instancePath, placeholderValues, metadata.placeholders);
      placeholderStep.status = 'success';
      placeholderStep.message = `Replaced ${Object.keys(placeholderValues).length} placeholders`;
    } catch (error) {
      placeholderStep.status = 'failed';
      placeholderStep.message = `Placeholder replacement failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      throw error;
    }

    const modulesStep: ProvisioningStepResult = {
      step: 'modules',
      provider: 'template',
      status: 'pending',
      message: 'Configuring modules',
    };
    steps.push(modulesStep);

    try {
      await this.configureModules(instancePath, input.modules, metadata.integrations);
      modulesStep.status = 'success';
      modulesStep.message = `Configured ${input.modules.length} modules`;
    } catch (error) {
      modulesStep.status = 'failed';
      modulesStep.message = `Module configuration failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      throw error;
    }

    const cleanupStep: ProvisioningStepResult = {
      step: 'cleanup',
      provider: 'template',
      status: 'pending',
      message: 'Cleaning up template files',
    };
    steps.push(cleanupStep);

    try {
      await this.cleanupTemplateFiles(instancePath);
      cleanupStep.status = 'success';
      cleanupStep.message = 'Template files cleaned up';
    } catch (error) {
      cleanupStep.status = 'failed';
      cleanupStep.message = `Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    return { localPath: instancePath, steps };
  }

  private async getTemplatePath(source: TemplateSource): Promise<string> {
    if (source.type === 'local') {
      return source.path ?? source.url;
    }

    const cacheDir = path.join(this.workDir, 'cache');
    const templateId = this.hashSource(source);
    const cachedPath = path.join(cacheDir, templateId);

    try {
      await fs.access(cachedPath);
      return cachedPath;
    } catch {
      await fs.mkdir(cachedPath, { recursive: true });
      await this.cloneTemplate(source, cachedPath);
      return cachedPath;
    }
  }

  private async cloneTemplate(source: TemplateSource, targetPath: string): Promise<void> {
    if (source.type === 'local') {
      await execAsync(`cp -r "${source.path ?? source.url}/." "${targetPath}"`);
      return;
    }

    const branch = source.branch ?? 'main';
    await execAsync(`git clone --depth 1 --branch ${branch} "${source.url}" "${targetPath}"`);
    
    const gitDir = path.join(targetPath, '.git');
    await fs.rm(gitDir, { recursive: true, force: true });
  }

  private buildPlaceholderValues(
    input: InstantiateTemplateInput,
    placeholders: PlaceholdersConfig
  ): Record<string, string> {
    const values: Record<string, string> = {
      '{{APP_NAME}}': input.appName,
      '{{APP_SLUG}}': input.appSlug,
      '{{PACKAGE_SCOPE}}': `@${input.appSlug}`,
      '{{APP_DESCRIPTION}}': input.description ?? '',
    };

    for (const [key, def] of Object.entries(placeholders.placeholders)) {
      if (def.derived?.from && def.derived.transform) {
        const sourceKey = `{{${def.derived.from}}}`;
        const sourceValue = values[sourceKey];
        if (sourceValue) {
          values[key] = this.applyTransform(sourceValue, def.derived.transform);
        }
      }
    }

    return values;
  }

  private applyTransform(value: string, transform: string): string {
    if (transform.includes('`@${value}`')) {
      return `@${value}`;
    }
    if (transform.includes('toLowerCase')) {
      return value.toLowerCase();
    }
    if (transform.includes('toUpperCase')) {
      return value.toUpperCase();
    }
    if (transform.includes('replace')) {
      const match = transform.match(/replace\(['"](.+?)['"],\s*['"](.+?)['"]\)/);
      if (match && match[1] && match[2]) {
        return value.replace(new RegExp(match[1], 'g'), match[2]);
      }
    }
    return value;
  }

  private async replacePlaceholders(
    instancePath: string,
    values: Record<string, string>,
    placeholders: PlaceholdersConfig
  ): Promise<void> {
    const filesToProcess = new Set<string>();

    for (const def of Object.values(placeholders.placeholders)) {
      for (const pattern of def.files) {
        const files = await this.globFiles(instancePath, pattern);
        files.forEach(f => filesToProcess.add(f));
      }
    }

    if (filesToProcess.size === 0) {
      const defaultPatterns = [
        '**/*.json',
        '**/*.ts',
        '**/*.tsx',
        '**/*.js',
        '**/*.jsx',
        '**/*.md',
        '**/*.yaml',
        '**/*.yml',
      ];
      for (const pattern of defaultPatterns) {
        const files = await this.globFiles(instancePath, pattern);
        files.forEach(f => filesToProcess.add(f));
      }
    }

    for (const file of filesToProcess) {
      await this.replaceInFile(file, values);
    }
  }

  private async replaceInFile(filePath: string, values: Record<string, string>): Promise<void> {
    try {
      let content = await fs.readFile(filePath, 'utf-8');
      let modified = false;

      for (const [placeholder, value] of Object.entries(values)) {
        if (content.includes(placeholder)) {
          content = content.split(placeholder).join(value);
          modified = true;
        }
      }

      if (modified) {
        await fs.writeFile(filePath, content, 'utf-8');
      }
    } catch {
      // Skip binary files or files that can't be read
    }
  }

  private async configureModules(
    instancePath: string,
    enabledModules: string[],
    availableModules: IntegrationModule[]
  ): Promise<void> {
    const allModuleIds = availableModules.map(m => m.id);
    const disabledModules = allModuleIds.filter(id => !enabledModules.includes(id));

    for (const module of availableModules) {
      if (disabledModules.includes(module.id)) {
        await this.removeModuleFiles(instancePath, module);
      }
    }

    await this.updatePackageJson(instancePath, enabledModules, availableModules);
  }

  private async removeModuleFiles(instancePath: string, module: IntegrationModule): Promise<void> {
    if (!module.files.excludeWithout) return;

    for (const pattern of module.files.excludeWithout) {
      const files = await this.globFiles(instancePath, pattern);
      for (const file of files) {
        await fs.rm(file, { recursive: true, force: true });
      }
    }

    if (module.package?.path) {
      const packagePath = path.join(instancePath, module.package.path);
      try {
        await fs.rm(packagePath, { recursive: true, force: true });
      } catch {
        // Package path might not exist
      }
    }
  }

  private async updatePackageJson(
    instancePath: string,
    enabledModules: string[],
    availableModules: IntegrationModule[]
  ): Promise<void> {
    const rootPackageJsonPath = path.join(instancePath, 'package.json');
    
    try {
      const content = await fs.readFile(rootPackageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);

      for (const module of availableModules) {
        if (!enabledModules.includes(module.id) && module.package?.dependencies) {
          for (const dep of Object.keys(module.package.dependencies)) {
            delete packageJson.dependencies?.[dep];
            delete packageJson.devDependencies?.[dep];
          }
        }
      }

      await fs.writeFile(rootPackageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');
    } catch {
      // No root package.json or can't parse
    }
  }

  private async cleanupTemplateFiles(instancePath: string): Promise<void> {
    const templateDir = path.join(instancePath, '.template');
    await fs.rm(templateDir, { recursive: true, force: true });

    const gitignorePath = path.join(instancePath, '.gitignore');
    try {
      let gitignore = await fs.readFile(gitignorePath, 'utf-8');
      gitignore = gitignore.replace(/\.template\/?/g, '');
      await fs.writeFile(gitignorePath, gitignore, 'utf-8');
    } catch {
      // No gitignore
    }
  }

  private async globFiles(basePath: string, pattern: string): Promise<string[]> {
    const results: string[] = [];
    
    const walkDir = async (dir: string): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        
        if (entry.isDirectory()) {
          await walkDir(fullPath);
        } else if (entry.isFile()) {
          const relativePath = path.relative(basePath, fullPath);
          if (this.matchesPattern(relativePath, pattern)) {
            results.push(fullPath);
          }
        }
      }
    };

    await walkDir(basePath);
    return results;
  }

  private matchesPattern(filePath: string, pattern: string): boolean {
    const ext = path.extname(filePath);
    
    if (pattern.startsWith('**/*.')) {
      const targetExt = '.' + pattern.slice(4);
      return ext === targetExt;
    }
    
    if (pattern.includes('*')) {
      const regexPattern = pattern
        .replace(/\*\*/g, '{{GLOBSTAR}}')
        .replace(/\*/g, '[^/]*')
        .replace(/{{GLOBSTAR}}/g, '.*');
      return new RegExp(`^${regexPattern}$`).test(filePath);
    }
    
    return filePath.endsWith(pattern) || filePath === pattern;
  }

  private hashSource(source: TemplateSource): string {
    const str = `${source.type}-${source.url}-${source.branch ?? 'main'}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  async initGitRepo(localPath: string): Promise<void> {
    await execAsync('git init', { cwd: localPath });
    await execAsync('git add .', { cwd: localPath });
    await execAsync('git commit -m "Initial commit from template"', { cwd: localPath });
  }

  async cleanup(localPath: string): Promise<void> {
    await fs.rm(localPath, { recursive: true, force: true });
  }
}

export function createTemplateEngine(workDir?: string): TemplateEngine {
  return new TemplateEngine(workDir);
}
