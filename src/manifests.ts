export interface NativeReplacement {
  id: string;
  type: "native";
  url: { type: "mdn"; id: string };
  webFeatureId?: { featureId: string; compatKey: string };
}

export interface MicroUtilityReplacement {
  id: string;
  type: "simple";
  description: string;
  example: string;
}

export interface PreferredMapping {
  type: "module";
  moduleName: string;
  replacements: string[];
  url: { type: "e18e"; id: string };
}

export interface NativeManifest {
  replacements: Record<string, NativeReplacement>;
}

export interface MicroUtilitiesManifest {
  replacements: Record<string, MicroUtilityReplacement>;
}

export interface PreferredManifest {
  mappings: Record<string, PreferredMapping>;
}

const URLS = {
  native:
    "https://raw.githubusercontent.com/e18e/module-replacements/main/manifests/native.json",
  microUtilities:
    "https://raw.githubusercontent.com/e18e/module-replacements/main/manifests/micro-utilities.json",
  preferred:
    "https://raw.githubusercontent.com/e18e/module-replacements/main/manifests/preferred.json",
} as const;

let nativeManifest: NativeManifest | null = null;
let microUtilitiesManifest: MicroUtilitiesManifest | null = null;
let preferredManifest: PreferredManifest | null = null;

async function fetchJSON<T>(
  url: string,
  name: string,
  timeoutMs = 10_000,
): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      console.error(
        `Failed to fetch ${name}: ${response.status} ${response.statusText}`,
      );
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error(`Error fetching ${name}:`, error);
    return null;
  }
}

export async function loadManifests(): Promise<void> {
  const [native, micro, preferred] = await Promise.all([
    fetchJSON<NativeManifest>(URLS.native, "native.json"),
    fetchJSON<MicroUtilitiesManifest>(
      URLS.microUtilities,
      "micro-utilities.json",
    ),
    fetchJSON<PreferredManifest>(URLS.preferred, "preferred.json"),
  ]);

  nativeManifest = native;
  microUtilitiesManifest = micro;
  preferredManifest = preferred;

  const loaded = [
    native && "native",
    micro && "micro-utilities",
    preferred && "preferred",
  ].filter(Boolean);
  console.error(`Loaded manifests: ${loaded.join(", ")}`);
}

export function getNativeManifest(): NativeManifest | null {
  return nativeManifest;
}

export function getMicroUtilitiesManifest(): MicroUtilitiesManifest | null {
  return microUtilitiesManifest;
}

export function getPreferredManifest(): PreferredManifest | null {
  return preferredManifest;
}
