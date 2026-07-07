import { getPreferredManifest } from "../manifests.js";

interface ScanResult {
  dependency: string;
  replacements: string[];
  url: string;
}

export function scanDependencies(
  dependencies: Record<string, string>,
): ScanResult[] {
  const preferred = getPreferredManifest();
  if (!preferred) {
    return [];
  }

  const results: ScanResult[] = [];

  for (const depName of Object.keys(dependencies)) {
    const mapping = preferred.mappings[depName];
    if (mapping) {
      results.push({
        dependency: depName,
        replacements: mapping.replacements,
        url: `https://e18e.dev/guide/module-replacements/${mapping.url.id}`,
      });
    }
  }

  return results;
}
