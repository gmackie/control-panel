/**
 * Parse Kubernetes CPU resource strings to millicores.
 * Examples: "250m" -> 250, "1" -> 1000, "0.5" -> 500, "2000m" -> 2000
 */
export function parseCpuMillis(cpu: string | undefined): number {
  if (!cpu) return 0;
  if (cpu.endsWith("m")) {
    return parseInt(cpu.slice(0, -1), 10) || 0;
  }
  if (cpu.endsWith("n")) {
    return Math.round((parseInt(cpu.slice(0, -1), 10) || 0) / 1_000_000);
  }
  return Math.round(parseFloat(cpu) * 1000) || 0;
}

/**
 * Parse Kubernetes memory resource strings to bytes.
 * Examples: "8Gi" -> 8589934592, "512Mi" -> 536870912, "1024Ki" -> 1048576
 */
export function parseMemoryBytes(mem: string | undefined): number {
  if (!mem) return 0;
  const units: Record<string, number> = {
    Ki: 1024,
    Mi: 1024 ** 2,
    Gi: 1024 ** 3,
    Ti: 1024 ** 4,
    K: 1000,
    M: 1000 ** 2,
    G: 1000 ** 3,
    T: 1000 ** 4,
  };
  for (const [suffix, multiplier] of Object.entries(units)) {
    if (mem.endsWith(suffix)) {
      return Math.round(parseFloat(mem.slice(0, -suffix.length)) * multiplier) || 0;
    }
  }
  return parseInt(mem, 10) || 0;
}

/** Format bytes as a human-readable string. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)}Ki`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)}Mi`;
  return `${(bytes / 1024 ** 3).toFixed(1)}Gi`;
}

/** Format millicores as a human-readable string. */
export function formatCpu(millis: number): string {
  if (millis < 1000) return `${millis}m`;
  return `${(millis / 1000).toFixed(1)}`;
}
