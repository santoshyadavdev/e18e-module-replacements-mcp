import {
  getNativeManifest,
  getMicroUtilitiesManifest,
  getPreferredManifest,
} from "../manifests.js";

interface LookupResult {
  source: "native" | "micro-utility" | "preferred";
  id: string;
  type: string;
  description?: string;
  example?: string;
  url?: string;
  replacements?: string[];
}

export function lookupReplacement(name: string): LookupResult[] {
  const query = name.toLowerCase().trim();
  if (!query) {
    return [];
  }
  const results: LookupResult[] = [];

  const native = getNativeManifest();
  if (native) {
    for (const [key, entry] of Object.entries(native.replacements)) {
      if (key.toLowerCase().includes(query)) {
        results.push({
          source: "native",
          id: entry.id,
          type: entry.type,
          url: `https://developer.mozilla.org/en-US/docs/${entry.url.id}`,
          description: `Native replacement available. Use the built-in API instead.`,
        });
      }
    }
  }

  const micro = getMicroUtilitiesManifest();
  if (micro) {
    for (const [key, entry] of Object.entries(micro.replacements)) {
      if (
        key.toLowerCase().includes(query) ||
        entry.description.toLowerCase().includes(query)
      ) {
        results.push({
          source: "micro-utility",
          id: entry.id,
          type: entry.type,
          description: entry.description,
          example: entry.example,
        });
      }
    }
  }

  const preferred = getPreferredManifest();
  if (preferred) {
    for (const [key, entry] of Object.entries(preferred.mappings)) {
      if (
        key.toLowerCase().includes(query) ||
        entry.replacements.some((r) => r.toLowerCase().includes(query))
      ) {
        results.push({
          source: "preferred",
          id: entry.moduleName,
          type: entry.type,
          replacements: entry.replacements,
          url: `https://e18e.dev/guide/module-replacements/${entry.url.id}`,
        });
      }
    }
  }

  return results;
}
