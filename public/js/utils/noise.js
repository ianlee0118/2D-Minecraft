export function createRNG(seed) {
  let s = seed | 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(n, seed) {
  let x = (n + seed) | 0;
  x = ((x >> 16) ^ x) * 0x45d9f3b;
  x = ((x >> 16) ^ x) * 0x45d9f3b;
  x = (x >> 16) ^ x;
  return (x & 0x7fffffff) / 0x7fffffff;
}

export function hash2D(x, y, seed) {
  let n = ((x * 374761393 + y * 668265263 + seed) | 0);
  n = ((n >> 13) ^ n);
  n = ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff);
  return n / 0x7fffffff;
}

function cosInterp(a, b, t) {
  const f = (1 - Math.cos(t * Math.PI)) / 2;
  return a + (b - a) * f;
}

export function noise1D(x, seed, wavelength) {
  const sx = x / wavelength;
  const x0 = Math.floor(sx);
  const t = sx - x0;
  const v0 = hash(x0, seed) * 2 - 1;
  const v1 = hash(x0 + 1, seed) * 2 - 1;
  return cosInterp(v0, v1, t);
}

export function noise2D(x, y, seed, wavelength) {
  const sx = x / wavelength;
  const sy = y / wavelength;
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const tx = sx - x0;
  const ty = sy - y0;

  const v00 = hash2D(x0, y0, seed);
  const v10 = hash2D(x0 + 1, y0, seed);
  const v01 = hash2D(x0, y0 + 1, seed);
  const v11 = hash2D(x0 + 1, y0 + 1, seed);

  const a = cosInterp(v00, v10, tx);
  const b = cosInterp(v01, v11, tx);
  return cosInterp(a, b, ty) * 2 - 1;
}

export function fractalNoise1D(x, seed, baseWavelength, octaves, persistence) {
  let value = 0;
  let amplitude = 1;
  let totalAmp = 0;
  let wl = baseWavelength;
  for (let i = 0; i < octaves; i++) {
    value += noise1D(x, seed + i * 1000, wl) * amplitude;
    totalAmp += amplitude;
    amplitude *= persistence;
    wl /= 2;
  }
  return value / totalAmp;
}

export function fractalNoise2D(x, y, seed, baseWavelength, octaves, persistence) {
  let value = 0;
  let amplitude = 1;
  let totalAmp = 0;
  let wl = baseWavelength;
  for (let i = 0; i < octaves; i++) {
    value += noise2D(x, y, seed + i * 1000, wl) * amplitude;
    totalAmp += amplitude;
    amplitude *= persistence;
    wl /= 2;
  }
  return value / totalAmp;
}
