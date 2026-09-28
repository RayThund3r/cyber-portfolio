// src/utils/telemetry.ts

export interface SystemTelemetryData {
  timestamp: string;
  platform: string;
  cores: number | string;
  approxMemoryGB: string;
  screenResolution: string;
  viewport: string;
  gpu: string;
  connectionType: string;
}

export async function collectSystemTelemetry(): Promise<SystemTelemetryData> {
  const nav = navigator as any;
  
  // Extract GPU info securely via WebGL
  let gpuInfo = "Unknown GPU / Restricted";
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        gpuInfo = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      }
    }
  } catch (e) {
    gpuInfo = "Unavailable";
  }

  return {
    timestamp: new Date().toISOString(),
    platform: nav.platform || 'Unknown Platform',
    cores: nav.hardwareConcurrency || 'N/A',
    approxMemoryGB: nav.deviceMemory ? `${nav.deviceMemory} GB (Estimated)` : 'N/A',
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    gpu: gpuInfo,
    connectionType: nav.connection ? nav.connection.effectiveType : 'Unknown',
  };
}