// =====================================================
// ตัวสร้าง QR Code (ไม่พึ่งแพ็กเกจภายนอก) — โหมด Byte, ECC ระดับ M, เวอร์ชัน 1-9 (รองรับข้อความได้ ~180 ไบต์ — PromptPay ใช้ ~85 ไบต์)
// ใช้กับ PromptPay payload (~140 ตัวอักษร) ได้สบาย
// คืนค่า: matrix เป็น array 2 มิติของ boolean (true = ช่องดำ)
// =====================================================

const EC_M = {
  // เวอร์ชัน: [ecBytesPerBlock, [ [จำนวนบล็อก, dataBytesต่อบล็อก], ... ]]
  1: [10, [[1, 16]]],
  2: [16, [[1, 28]]],
  3: [26, [[1, 44]]],
  4: [18, [[2, 32]]],
  5: [24, [[2, 43]]],
  6: [16, [[4, 27]]],
  7: [18, [[4, 31]]],
  8: [22, [[2, 38], [2, 39]]],
  9: [22, [[3, 36], [2, 37]]],
}

const ALIGN = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46],
}

// ---------- Reed-Solomon (GF 256) ----------
const EXP = new Array(512)
const LOG = new Array(256)
;(() => {
  let x = 1
  for (let i = 0; i < 255; i++) {
    EXP[i] = x
    LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]
})()

const gmul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]])

function rsGenerator(degree) {
  let poly = [1]
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0)
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j]
      next[j + 1] ^= gmul(poly[j], EXP[i])
    }
    poly = next
  }
  return poly
}

function rsRemainder(data, degree) {
  const gen = rsGenerator(degree)
  const res = new Array(degree).fill(0)
  for (const byte of data) {
    const factor = byte ^ res.shift()
    res.push(0)
    for (let i = 0; i < degree; i++) res[i] ^= gmul(gen[i + 1], factor)
  }
  return res
}

// ---------- ข้อมูล -> codewords ----------
function totalDataBytes(version) {
  const [, blocks] = EC_M[version]
  return blocks.reduce((s, [n, d]) => s + n * d, 0)
}

function pickVersion(byteLen) {
  for (let v = 1; v <= 9; v++) {
    const countBits = 8
    const need = 4 + countBits + byteLen * 8
    if (need <= totalDataBytes(v) * 8) return v
  }
  throw new Error('ข้อความยาวเกินกว่าจะสร้าง QR ได้')
}

function buildCodewords(bytes, version) {
  const capacity = totalDataBytes(version)
  const bits = []
  const push = (val, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1)
  }

  push(0b0100, 4)
  push(bytes.length, 8)
  for (const b of bytes) push(b, 8)

  const maxBits = capacity * 8
  push(0, Math.min(4, maxBits - bits.length))
  while (bits.length % 8) bits.push(0)

  const data = []
  for (let i = 0; i < bits.length; i += 8) {
    data.push(parseInt(bits.slice(i, i + 8).join(''), 2))
  }
  for (let pad = 0xec; data.length < capacity; pad ^= 0xec ^ 0x11) data.push(pad)

  // แบ่งบล็อก + ใส่ error correction + สลับลำดับ
  const [ecLen, groups] = EC_M[version]
  const dataBlocks = []
  let pos = 0
  for (const [count, size] of groups) {
    for (let i = 0; i < count; i++) {
      dataBlocks.push(data.slice(pos, pos + size))
      pos += size
    }
  }
  const ecBlocks = dataBlocks.map(b => rsRemainder(b, ecLen))

  const out = []
  const maxData = Math.max(...dataBlocks.map(b => b.length))
  for (let i = 0; i < maxData; i++) {
    for (const b of dataBlocks) if (i < b.length) out.push(b[i])
  }
  for (let i = 0; i < ecLen; i++) {
    for (const b of ecBlocks) out.push(b[i])
  }
  return out
}

// ---------- วาด matrix ----------
function makeMatrix(version, codewords, mask) {
  const size = version * 4 + 17
  const m = Array.from({ length: size }, () => new Array(size).fill(false))
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false))

  const set = (r, c, v, res = true) => {
    m[r][c] = v
    if (res) reserved[r][c] = true
  }

  const finder = (r0, c0) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = r0 + dr
        const c = c0 + dc
        if (r < 0 || c < 0 || r >= size || c >= size) continue
        const inSquare = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6
        const dark =
          inSquare &&
          (dr === 0 || dr === 6 || dc === 0 || dc === 6 ||
            (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4))
        set(r, c, dark)
      }
    }
  }
  finder(0, 0)
  finder(0, size - 7)
  finder(size - 7, 0)

  // timing
  for (let i = 8; i < size - 8; i++) {
    set(6, i, i % 2 === 0)
    set(i, 6, i % 2 === 0)
  }

  // alignment
  const pts = ALIGN[version]
  const lastIdx = pts.length - 1
  for (let i = 0; i < pts.length; i++) {
    for (let j = 0; j < pts.length; j++) {
      // ข้ามเฉพาะมุมที่ชนกับ finder pattern (ตำแหน่งบนเส้น timing ต้องวางตามปกติ)
      if ((i === 0 && j === 0) || (i === 0 && j === lastIdx) || (i === lastIdx && j === 0)) continue
      const r = pts[i]
      const c = pts[j]
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1
          set(r + dr, c + dc, dark)
        }
      }
    }
  }

  // dark module + จองพื้นที่ format / version
  set(size - 8, 8, true)
  for (let i = 0; i < 9; i++) {
    if (!reserved[8][i]) set(8, i, false)
    if (!reserved[i][8]) set(i, 8, false)
  }
  for (let i = 0; i < 8; i++) {
    set(8, size - 1 - i, false)
    set(size - 1 - i, 8, false)
  }
  set(size - 8, 8, true)

  if (version >= 7) {
    let rem = version
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
    const bits = (version << 12) | rem
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >>> i) & 1) === 1
      const a = size - 11 + (i % 3)
      const b = Math.floor(i / 3)
      set(b, a, bit)
      set(a, b, bit)
    }
  }

  // วาง data แบบซิกแซก
  const maskFn = [
    (r, c) => (r + c) % 2 === 0,
    r => r % 2 === 0,
    (r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ][mask]

  let bitIdx = 0
  const totalBits = codewords.length * 8
  let up = true
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--
    for (let i = 0; i < size; i++) {
      const r = up ? size - 1 - i : i
      for (let dc = 0; dc < 2; dc++) {
        const c = col - dc
        if (reserved[r][c]) continue
        let bit = false
        if (bitIdx < totalBits) {
          bit = ((codewords[bitIdx >> 3] >>> (7 - (bitIdx & 7))) & 1) === 1
          bitIdx++
        }
        m[r][c] = bit !== maskFn(r, c)
      }
    }
    up = !up
  }

  // format info (ECC M = 00)
  const fmtData = (0b00 << 3) | mask
  let rem = fmtData
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
  const fmt = ((fmtData << 10) | rem) ^ 0x5412
  const bit = i => ((fmt >>> i) & 1) === 1

  for (let i = 0; i <= 5; i++) m[i][8] = bit(i)
  m[7][8] = bit(6)
  m[8][8] = bit(7)
  m[8][7] = bit(8)
  for (let i = 9; i < 15; i++) m[8][14 - i] = bit(i)
  for (let i = 0; i < 8; i++) m[8][size - 1 - i] = bit(i)
  for (let i = 8; i < 15; i++) m[size - 15 + i][8] = bit(i)
  m[size - 8][8] = true

  return m
}

function penalty(m) {
  const n = m.length
  let score = 0

  const runScore = line => {
    let s = 0
    let run = 1
    for (let i = 1; i < n; i++) {
      if (line[i] === line[i - 1]) {
        run++
      } else {
        if (run >= 5) s += run - 2
        run = 1
      }
    }
    if (run >= 5) s += run - 2
    return s
  }

  for (let i = 0; i < n; i++) {
    score += runScore(m[i])
    score += runScore(m.map(row => row[i]))
  }

  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const v = m[r][c]
      if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3
    }
  }

  const pat = [true, false, true, true, true, false, true, false, false, false, false]
  const rev = [...pat].reverse()
  const match = (get, i, p) => p.every((v, k) => get(i + k) === v)
  for (let a = 0; a < n; a++) {
    for (let b = 0; b <= n - 11; b++) {
      for (const p of [pat, rev]) {
        if (match(k => m[a][k], b, p)) score += 40
        if (match(k => m[k][a], b, p)) score += 40
      }
    }
  }

  let dark = 0
  for (const row of m) for (const v of row) if (v) dark++
  score += Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10

  return score
}

export function qrMatrix(text) {
  const bytes = Array.from(new TextEncoder().encode(String(text)))
  const version = pickVersion(bytes.length)
  const codewords = buildCodewords(bytes, version)

  let best = null
  let bestScore = Infinity
  for (let mask = 0; mask < 8; mask++) {
    const m = makeMatrix(version, codewords, mask)
    const s = penalty(m)
    if (s < bestScore) {
      bestScore = s
      best = m
    }
  }
  return best
}

// คืน SVG path (ใช้ crispEdges ภาพคมทุกขนาด) + ขอบสงบ (quiet zone) 4 ช่อง
export function qrSvgPath(text, quiet = 4) {
  const m = qrMatrix(text)
  const n = m.length
  let d = ''
  for (let r = 0; r < n; r++) {
    let c = 0
    while (c < n) {
      if (m[r][c]) {
        let end = c
        while (end < n && m[r][end]) end++
        d += `M${c + quiet} ${r + quiet}h${end - c}v1h-${end - c}z`
        c = end
      } else c++
    }
  }
  return { d, size: n + quiet * 2 }
}
