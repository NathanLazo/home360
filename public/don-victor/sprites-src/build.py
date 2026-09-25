"""Don Victor vector sprites: original SVG illustration, one file per chat state.

Shared base body; each state swaps arm poses + prop + effect, mirroring the
pixel-art architecture in don-victor-sprites.ts. Effects use the design
system's action tint (tint-sky #4f9fd8).
Layer order: legs -> torso -> head -> arms -> props/effects.
"""
from pathlib import Path
import cairosvg

OUT = Path(__file__).parent
(OUT / "svg").mkdir(exist_ok=True)
(OUT / "png").mkdir(exist_ok=True)

SKIN = "#E9B37E"
SKIN_SH = "#D19A63"
HAIR = "#1E1B1A"
POLO = "#1A1B1F"
POLO_HI = "#2A2C33"
JEANS = "#2E3D57"
JEANS_SH = "#25324A"
BOOT = "#6E4B2E"
BOOT_SH = "#54371F"
TINT = "#4F9FD8"
METAL = "#9AA0A8"
METAL_SH = "#6E747C"

W, H = 480, 780
FULL_VB = f"0 0 {W} {H}"
HALF_VB = "40 20 400 440"  # head to waist


def arm(sx, sy, ex, ey, wx, wy):
    """Short polo sleeve, then bare arm (elbow bend) + hand."""
    mx, my = sx + (ex - sx) * 0.55, sy + (ey - sy) * 0.55
    return f'''
  <path d="M {mx} {my} L {ex} {ey} L {wx} {wy}" stroke="{SKIN}" stroke-width="30" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <path d="M {sx} {sy} L {mx} {my}" stroke="{POLO}" stroke-width="42" stroke-linecap="round" fill="none"/>
  <circle cx="{wx}" cy="{wy}" r="17" fill="{SKIN}"/>'''


ARM_L_DOWN = arm(172, 278, 152, 350, 144, 424)
ARM_R_DOWN = arm(308, 278, 328, 350, 336, 424)


def torso():
    return f'''
  <rect x="222" y="200" width="36" height="48" rx="12" fill="{SKIN_SH}"/>
  <path d="M 240 244
           C 190 244 162 258 154 286
           C 146 316 142 372 146 428
           L 334 428
           C 338 372 334 316 326 286
           C 318 258 290 244 240 244 Z" fill="{POLO}"/>
  <path d="M 214 246 L 240 276 L 266 246 L 257 237 L 240 257 L 223 237 Z" fill="{POLO_HI}"/>
  <path d="M 236 276 h 8 v 38 h -8 Z" fill="{POLO_HI}"/>
  <circle cx="240" cy="288" r="2.6" fill="#0C0D10"/>
  <circle cx="240" cy="304" r="2.6" fill="#0C0D10"/>
  <g stroke="#F4F5F7" stroke-width="3.4" fill="none" stroke-linejoin="round">
    <path d="M 194 302 l 13 -12 l 13 12 v 15 h -26 Z"/>
  </g>'''


def head(pupil_dx=0.0, pupil_dy=0.0, brow_lift=0.0):
    bl = brow_lift
    return f'''
  <ellipse cx="164" cy="152" rx="13" ry="16" fill="{SKIN}"/>
  <ellipse cx="316" cy="152" rx="13" ry="16" fill="{SKIN}"/>
  <path d="M 240 62
           C 190 62 166 100 166 148
           C 166 196 196 228 240 228
           C 284 228 314 196 314 148
           C 314 100 290 62 240 62 Z" fill="{SKIN}"/>
  <path d="M 166 142
           C 162 92 194 56 240 56
           C 286 56 318 92 314 142
           C 310 114 298 102 282 96
           C 258 86 214 94 192 104
           C 178 110 170 124 166 142 Z" fill="{HAIR}"/>
  <ellipse cx="268" cy="62" rx="36" ry="19" fill="{HAIR}" transform="rotate(-10 268 62)"/>
  <rect x="190" y="{116 - bl}" width="40" height="11" rx="5.5" fill="{HAIR}" transform="rotate(-4 210 {121 - bl})"/>
  <rect x="250" y="{116 - bl}" width="40" height="11" rx="5.5" fill="{HAIR}" transform="rotate(4 270 {121 - bl})"/>
  <ellipse cx="211" cy="147" rx="13.5" ry="10.5" fill="#FFFFFF"/>
  <ellipse cx="269" cy="147" rx="13.5" ry="10.5" fill="#FFFFFF"/>
  <circle cx="{211 + pupil_dx}" cy="{147 + pupil_dy}" r="6" fill="#5B3A21"/>
  <circle cx="{269 + pupil_dx}" cy="{147 + pupil_dy}" r="6" fill="#5B3A21"/>
  <circle cx="{211 + pupil_dx}" cy="{147 + pupil_dy}" r="2.8" fill="#17110C"/>
  <circle cx="{269 + pupil_dx}" cy="{147 + pupil_dy}" r="2.8" fill="#17110C"/>
  <circle cx="{213.4 + pupil_dx}" cy="{144.6 + pupil_dy}" r="1.6" fill="#FFFFFF"/>
  <circle cx="{271.4 + pupil_dx}" cy="{144.6 + pupil_dy}" r="1.6" fill="#FFFFFF"/>
  <path d="M 240 150 q 8 14 4 22 q -4 5 -8 0 q -4 -8 4 -22 Z" fill="{SKIN_SH}"/>
  <path d="M 240 184
           C 226 176 206 178 198 188
           C 194 194 196 201 203 202
           C 220 205 234 199 240 193
           C 246 199 260 205 277 202
           C 284 201 286 194 282 188
           C 274 178 254 176 240 184 Z" fill="{HAIR}"/>
  <path d="M 216 206 q 24 18 48 0" stroke="#8A5A38" stroke-width="5" stroke-linecap="round" fill="none"/>'''


def legs():
    return f'''
  <path d="M 158 424 h 164 v 20 q -82 10 -164 0 Z" fill="#141519"/>
  <path d="M 168 440 q -6 100 -2 238 h 62 q 8 -142 10 -238 Z" fill="{JEANS}"/>
  <path d="M 312 440 q 6 100 2 238 h -62 q -8 -142 -10 -238 Z" fill="{JEANS}"/>
  <path d="M 166 676 q -2 26 4 34 q 30 8 60 0 q 4 -10 1 -34 Z" fill="{BOOT}"/>
  <path d="M 314 676 q 2 26 -4 34 q -30 8 -60 0 q -4 -10 -1 -34 Z" fill="{BOOT}"/>
  <path d="M 164 704 q 36 10 70 0 l 0 9 q -34 8 -70 0 Z" fill="{BOOT_SH}"/>
  <path d="M 316 704 q -36 10 -70 0 l 0 9 q 34 8 70 0 Z" fill="{BOOT_SH}"/>'''


SOUND_WAVES = f'''
  <g stroke="{TINT}" stroke-width="6" stroke-linecap="round" fill="none" opacity="0.9">
    <path d="M 372 128 q 10 20 0 40"/>
    <path d="M 394 116 q 16 32 0 64"/>
  </g>'''

SIGNAL_ARCS = f'''
  <g stroke="{TINT}" stroke-width="6" stroke-linecap="round" fill="none" opacity="0.9">
    <path d="M 356 96 q 14 -18 34 -12"/>
    <path d="M 354 74 q 24 -28 56 -16"/>
    <circle cx="348" cy="110" r="4.5" fill="{TINT}" stroke="none"/>
  </g>'''

THOUGHT_DOTS = f'''
  <g fill="{TINT}" opacity="0.9">
    <circle cx="330" cy="96" r="6"/>
    <circle cx="354" cy="70" r="9"/>
    <circle cx="384" cy="42" r="12"/>
  </g>'''

SPARKLE = f'''
  <g fill="{TINT}" opacity="0.95">
    <path d="M 108 110 l 6 16 l 16 6 l -16 6 l -6 16 l -6 -16 l -16 -6 l 16 -6 Z"/>
    <path d="M 144 74 l 3.5 9 l 9 3.5 l -9 3.5 l -3.5 9 l -3.5 -9 l -9 -3.5 l 9 -3.5 Z"/>
  </g>'''

PEN_LINES = ""

PHONE = f'''
  <g transform="rotate(-10 332 148)">
    <rect x="317" y="118" width="30" height="60" rx="9" fill="#101114"/>
    <rect x="321.5" y="124" width="21" height="44" rx="5" fill="#2C3644"/>
  </g>'''

MAGNIFIER = f'''
  <g>
    <circle cx="152" cy="146" r="36" fill="#BFE0F4" opacity="0.4"/>
    <circle cx="152" cy="146" r="36" fill="none" stroke="{METAL}" stroke-width="10"/>
    <path d="M 176 174 l 24 28" stroke="{METAL_SH}" stroke-width="12" stroke-linecap="round"/>
    <path d="M 138 128 q -10 10 -8 24" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.8"/>
  </g>'''

WRENCH = f'''
  <g transform="rotate(18 344 100)">
    <rect x="336" y="76" width="17" height="70" rx="8" fill="{METAL}"/>
    <path fill-rule="evenodd" d="M 344.5 42 a 24 24 0 1 1 -0.01 0 Z
             M 333 20 h 23 v 34 a 11.5 11.5 0 0 1 -23 0 Z" fill="{METAL}"/>
    <path d="M 322 60 a 24 24 0 0 0 10 26 l 3 -8 a 15 15 0 0 1 -6 -14 Z" fill="{METAL_SH}"/>
  </g>'''

CLIPBOARD = f'''
  <g transform="rotate(-4 240 348)">
    <rect x="194" y="298" width="94" height="114" rx="8" fill="#8B6A45"/>
    <rect x="202" y="310" width="78" height="94" rx="4" fill="#F7F7F5"/>
    <rect x="227" y="290" width="28" height="16" rx="5" fill="{METAL}"/>
    <g stroke="#C9CBCF" stroke-width="4" stroke-linecap="round">
      <path d="M 212 330 h 58"/>
      <path d="M 212 348 h 58"/>
      <path d="M 212 366 h 42"/>
    </g>
    <path d="M 212 384 h 32" stroke="{TINT}" stroke-width="4" stroke-linecap="round"/>
  </g>'''

PEN = f'''
  <g transform="rotate(42 300 352)">
    <rect x="295" y="318" width="11" height="52" rx="5" fill="#22242A"/>
    <path d="M 295 370 l 5.5 12 l 5.5 -12 Z" fill="{METAL}"/>
  </g>'''


STATES = {
    "breathing": dict(arms=ARM_L_DOWN + ARM_R_DOWN, props="", pupil=(0, 0), brow=0),
    "listening": dict(
        arms=ARM_L_DOWN + arm(308, 278, 352, 224, 332, 160),
        props=SOUND_WAVES, pupil=(3, 1), brow=3),
    "connecting": dict(
        arms=ARM_L_DOWN + arm(308, 278, 356, 228, 336, 170) + PHONE,
        props=SIGNAL_ARCS, pupil=(0, 0), brow=2),
    "searching": dict(
        arms=ARM_R_DOWN + arm(172, 278, 136, 252, 178, 196) + MAGNIFIER,
        props="", pupil=(-4, 0), brow=4),
    "working": dict(
        arms=ARM_L_DOWN + arm(308, 278, 354, 214, 342, 142) + WRENCH,
        props=SPARKLE, pupil=(3, -2), brow=2),
    "solving": dict(
        arms=ARM_L_DOWN + arm(308, 278, 334, 344, 266, 226),
        props=THOUGHT_DOTS, pupil=(3, -3), brow=5),
    "composing": dict(
        arms=arm(172, 278, 150, 346, 202, 356) + CLIPBOARD
             + arm(308, 278, 332, 346, 288, 356) + PEN,
        props=PEN_LINES, pupil=(0, 4), brow=0),
}


def build(state, cfg, vb, tag):
    dx, dy = cfg["pupil"]
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}">
{legs()}
{torso()}
{head(dx, dy, cfg["brow"])}
{cfg["arms"]}
{cfg["props"]}
</svg>'''
    p = OUT / "svg" / f"{tag}-{state}.svg"
    p.write_text(svg)
    return p


for state, cfg in STATES.items():
    p = build(state, cfg, FULL_VB, "full")
    cairosvg.svg2png(url=str(p), write_to=str(OUT / "png" / f"full-{state}.png"),
                     output_height=1170)
    p = build(state, cfg, HALF_VB, "half")
    cairosvg.svg2png(url=str(p), write_to=str(OUT / "png" / f"half-{state}.png"),
                     output_height=900)
print("built", len(STATES) * 2, "sprites")
