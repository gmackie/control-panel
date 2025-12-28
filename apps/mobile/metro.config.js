const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

// Find the project and workspace directories
const projectRoot = __dirname;
// This is the monorepo root
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [monorepoRoot];

// 2. Let Metro know where to resolve packages and their hoisted dependencies
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// 3. DO NOT disable hierarchical lookup - pnpm needs it for peer dependencies
// config.resolver.disableHierarchicalLookup = true;

// 4. Handle ESM packages properly (required for superjson -> copy-anything)
config.resolver.unstable_enablePackageExports = true;

// 5. Enable symlinks for pnpm compatibility
config.resolver.unstable_enableSymlinks = true;

// 6. Source extensions - ensure .mjs is included for ESM packages
config.resolver.sourceExts = [...config.resolver.sourceExts, "mjs"];

module.exports = config;
