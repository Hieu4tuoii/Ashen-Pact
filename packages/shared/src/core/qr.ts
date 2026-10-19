/**
 * Pure TypeScript ISO/IEC 18004 QR Code Matrix Generator (Byte Mode, ECC Level L, Mask 0).
 * Zero external dependencies — used to procedurally render LAN Invite QR Codes in the Hub UI.
 */

interface QrVersionSpec {
  version: number;
  size: number;
  dataCodewords: number;
  ecCodewords: number;
  alignmentCenter: number;
}

const QR_VERSIONS: readonly QrVersionSpec[] = [
  // Version 3-L: 29x29 modules, up to 53 UTF-8 bytes
  { version: 3, size: 29, dataCodewords: 55, ecCodewords: 15, alignmentCenter: 22 },
  // Version 4-L: 33x33 modules, up to 78 UTF-8 bytes
  { version: 4, size: 33, dataCodewords: 80, ecCodewords: 20, alignmentCenter: 26 },
];

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) {
      x ^= 0x11d;
    }
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255]!;
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[(GF_LOG[a]! + GF_LOG[b]!) % 255]!;
}

function buildGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const root = GF_EXP[i]!;
    for (let j = 0; j < poly.length; j++) {
      next[j] = (next[j] ?? 0) ^ poly[j]!;
      next[j + 1] = (next[j + 1] ?? 0) ^ gfMul(poly[j]!, root);
    }
    poly = next;
  }
  return poly;
}

function computeReedSolomonEc(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = buildGeneratorPoly(ecCount);
  const rem = new Uint8Array(ecCount);

  for (let i = 0; i < data.length; i++) {
    const factor = data[i]! ^ rem[0]!;
    for (let j = 0; j < ecCount - 1; j++) {
      rem[j] = rem[j + 1]!;
    }
    rem[ecCount - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < ecCount; j++) {
        rem[j] = (rem[j] ?? 0) ^ gfMul(gen[j + 1]!, factor);
      }
    }
  }
  return rem;
}

function encodeUtf8Bytes(text: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) {
      out.push(code);
    } else if (code < 0x800) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else {
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return new Uint8Array(out);
}

/**
 * Generates an ISO/IEC 18004 QR Code boolean matrix (`true` = dark module, `false` = light module)
 * for any LAN invite URL (up to 78 bytes).
 */
export function generateQrMatrix(text: string): boolean[][] {
  const payloadBytes = encodeUtf8Bytes(text);
  const spec =
    payloadBytes.length <= 53
      ? QR_VERSIONS[0]!
      : QR_VERSIONS[1]!;
  const maxBytes = spec.dataCodewords - 2;
  const trimmed =
    payloadBytes.length > maxBytes ? payloadBytes.slice(0, maxBytes) : payloadBytes;

  // 1. Build bit stream: Byte Mode indicator (0100) + 8-bit length + bytes + terminator (0000) + pad
  const bits: number[] = [];
  const pushBits = (val: number, count: number) => {
    for (let i = count - 1; i >= 0; i--) {
      bits.push((val >>> i) & 1);
    }
  };

  pushBits(0b0100, 4);
  pushBits(trimmed.length, 8);
  for (let i = 0; i < trimmed.length; i++) {
    pushBits(trimmed[i]!, 8);
  }

  const maxDataBits = spec.dataCodewords * 8;
  const termCount = Math.min(4, maxDataBits - bits.length);
  pushBits(0, termCount);
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const dataWords = new Uint8Array(spec.dataCodewords);
  for (let i = 0; i < bits.length / 8; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) {
      byte = (byte << 1) | (bits[i * 8 + b] ?? 0);
    }
    dataWords[i] = byte;
  }

  const padBytes = [0xec, 0x11];
  for (let i = bits.length / 8, p = 0; i < spec.dataCodewords; i++, p++) {
    dataWords[i] = padBytes[p % 2]!;
  }

  const ecWords = computeReedSolomonEc(dataWords, spec.ecCodewords);
  const allWords = new Uint8Array(spec.dataCodewords + spec.ecCodewords);
  allWords.set(dataWords, 0);
  allWords.set(ecWords, spec.dataCodewords);

  const size = spec.size;
  const modules: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false),
  );
  const reserved: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false),
  );

  const setFunctionModule = (r: number, c: number, dark: boolean) => {
    if (r < 0 || r >= size || c < 0 || c >= size) return;
    modules[r]![c] = dark;
    reserved[r]![c] = true;
  };

  // Finder patterns (7x7 + 1px white separator)
  const placeFinder = (topR: number, leftC: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = topR + dr;
        const c = leftC + dc;
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const onBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const inCore = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        setFunctionModule(r, c, inOuter && (onBorder || inCore));
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Alignment pattern (5x5 centered at alignmentCenter)
  const ac = spec.alignmentCenter;
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
      setFunctionModule(ac + dr, ac + dc, dark);
    }
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    const dark = i % 2 === 0;
    if (!reserved[6]![i]) setFunctionModule(6, i, dark);
    if (!reserved[i]![6]) setFunctionModule(i, 6, dark);
  }

  // Dark module & reserve format info areas
  setFunctionModule(size - 8, 8, true);
  for (let i = 0; i < 9; i++) {
    if (!reserved[8]![i]) reserved[8]![i] = true;
    if (!reserved[i]![8]) reserved[i]![8] = true;
  }
  for (let i = 0; i < 8; i++) {
    if (!reserved[8]![size - 1 - i]) reserved[8]![size - 1 - i] = true;
    if (!reserved[size - 1 - i]![8]) reserved[size - 1 - i]![8] = true;
  }

  // Place data + EC bits in upward/downward 2-column zig-zag
  let bitIdx = 0;
  const totalBits = allWords.length * 8;
  let upward = true;

  for (let rightCol = size - 1; rightCol >= 1; rightCol -= 2) {
    if (rightCol === 6) rightCol = 5; // Skip vertical timing column
    for (let step = 0; step < size; step++) {
      const r = upward ? size - 1 - step : step;
      for (let dc = 0; dc < 2; dc++) {
        const c = rightCol - dc;
        if (reserved[r]![c]) continue;
        let bit = false;
        if (bitIdx < totalBits) {
          const word = allWords[bitIdx >>> 3]!;
          bit = ((word >>> (7 - (bitIdx & 7))) & 1) === 1;
          bitIdx += 1;
        }
        // Apply Mask 0: (r + c) % 2 === 0
        if ((r + c) % 2 === 0) {
          bit = !bit;
        }
        modules[r]![c] = bit;
      }
    }
    upward = !upward;
  }

  // Write Format Information for Level L (01) + Mask 0 (000) -> 0x77c4
  const formatBits = 0x77c4;
  for (let i = 0; i <= 5; i++) setFunctionModule(8, i, ((formatBits >>> i) & 1) === 1);
  setFunctionModule(8, 7, ((formatBits >>> 6) & 1) === 1);
  setFunctionModule(8, 8, ((formatBits >>> 7) & 1) === 1);
  setFunctionModule(7, 8, ((formatBits >>> 8) & 1) === 1);
  for (let i = 9; i < 15; i++) {
    setFunctionModule(14 - i, 8, ((formatBits >>> i) & 1) === 1);
  }
  for (let i = 0; i < 8; i++) {
    setFunctionModule(8, size - 1 - i, ((formatBits >>> i) & 1) === 1);
  }
  for (let i = 8; i < 15; i++) {
    setFunctionModule(size - 15 + i, 8, ((formatBits >>> i) & 1) === 1);
  }

  return modules;
}
