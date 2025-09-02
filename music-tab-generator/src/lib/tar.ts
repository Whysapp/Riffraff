export async function untarToMap(tarGz: ArrayBuffer): Promise<Map<string, Blob>> {
  // Keep it simple: import('fflate') for gzip + tar parsing
  const { gunzipSync } = await import("fflate");
  const gz = new Uint8Array(tarGz);
  const tarU8 = gunzipSync(gz);
  
  // tiny tar reader
  const files = new Map<string, Blob>();
  let i = 0;
  
  while (i + 512 <= tarU8.length) {
    const header = tarU8.subarray(i, i + 512);
    const name = String.fromCharCode(...header.subarray(0, 100)).replace(/\0.*$/, "");
    const sizeOct = String.fromCharCode(...header.subarray(124, 136)).replace(/\0.*$/, "");
    const size = parseInt(sizeOct.trim(), 8) || 0;
    
    i += 512;
    if (!name) break;
    
    const file = tarU8.subarray(i, i + size);
    const arrayBuffer = new ArrayBuffer(file.length);
    new Uint8Array(arrayBuffer).set(file);
    files.set(name, new Blob([arrayBuffer]));
    
    i += Math.ceil(size / 512) * 512;
  }
  
  return files;
}