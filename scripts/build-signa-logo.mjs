// Génère l'emblème Signa SANS la tuile navy, optimisé pour l'en-tête du CRM.
//
// Source : src/assets/logo-clair.png — image OPAQUE (fond blanc) composée de :
//   • un fond blanc extérieur,
//   • une tuile arrondie navy,
//   • le « S » blanc évidé DANS la tuile (même blanc que le fond → indissociable
//     par la couleur seule),
//   • un point orange.
//
// Méthode : flood-fill depuis les bords à travers les pixels blancs pour marquer
// le fond EXTÉRIEUR ; le « S » (blanc intérieur entouré de navy) n'est pas atteint.
// On rend transparents le fond extérieur + la tuile navy ; on garde le « S » et le
// point orange.
//   • signa-dark.png  : « S » crème + point orange  → THÈME SOMBRE.
//   • signa-light.png : « S » near-black + point orange → THÈME CLAIR.
// Lancer : node scripts/build-signa-logo.mjs
import sharp from 'sharp'

const SRC = 'src/assets/logo-clair.png'
const TARGET_H = 144 // px (affiché ~36px → marge Retina)
const DARK = [0x14, 0x15, 0x1a] // « S » near-black (thème clair)
const CREAM = [0xf3, 0xee, 0xe3] // « S » crème (thème sombre)

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const { width: w, height: h } = info
const N = w * h

const isOrange = (r, g, b) => r > 170 && g > 50 && g < 185 && b < 120 && r - b > 70
const isLight = (r, g, b) => (r + g + b) / 3 > 165

// 1) Flood-fill du fond extérieur (pixels clairs accessibles depuis un bord).
const exterior = new Uint8Array(N)
const stack = []
for (let x = 0; x < w; x++) {
  stack.push(x, x + (h - 1) * w)
}
for (let y = 0; y < h; y++) {
  stack.push(y * w, w - 1 + y * w)
}
while (stack.length) {
  const p = stack.pop()
  if (exterior[p]) continue
  const o = p * 4
  if (!isLight(data[o], data[o + 1], data[o + 2])) continue
  exterior[p] = 1
  const x = p % w
  const y = (p / w) | 0
  if (x > 0) stack.push(p - 1)
  if (x < w - 1) stack.push(p + 1)
  if (y > 0) stack.push(p - w)
  if (y < h - 1) stack.push(p + w)
}

// 2) Construit les deux variantes (alpha = opaque seulement pour « S » + point).
function build(sColor) {
  const out = Buffer.alloc(N * 4)
  for (let p = 0; p < N; p++) {
    const o = p * 4
    const r = data[o], g = data[o + 1], b = data[o + 2]
    if (isOrange(r, g, b)) {
      out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255
    } else if (!exterior[p] && isLight(r, g, b)) {
      out[o] = sColor[0]; out[o + 1] = sColor[1]; out[o + 2] = sColor[2]; out[o + 3] = 255
    } // sinon : transparent (fond extérieur, tuile navy, bords anti-crénelés)
  }
  return out
}

const opts = { compressionLevel: 9 }
await sharp(build(CREAM), { raw: { width: w, height: h, channels: 4 } })
  .trim().resize({ height: TARGET_H }).png(opts).toFile('src/assets/signa-dark.png')
await sharp(build(DARK), { raw: { width: w, height: h, channels: 4 } })
  .trim().resize({ height: TARGET_H }).png(opts).toFile('src/assets/signa-light.png')

console.log('Généré : src/assets/signa-light.png + src/assets/signa-dark.png')
