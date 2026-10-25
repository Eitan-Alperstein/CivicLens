"""Seamless topographic contour tile for the page background (web/topo.svg).

Run from the repo root:  python3 tools/make_topo.py [seed] [output]

1. Build a height field that is exactly periodic over the tile: a sum of
   sine waves whose frequencies are whole numbers of cycles per tile.
2. Trace iso-lines with marching squares (wrapping around the edges).
Iso-lines of one surface never cross, and a periodic surface tiles with no seam.
"""
import math, random, sys

T = 900          # tile size in px
N = 180          # grid cells per side (5px cells)
LEVELS = 26
SEED = int(sys.argv[1]) if len(sys.argv) > 1 else 11
OUT = sys.argv[2] if len(sys.argv) > 2 else "web/topo.svg"

random.seed(SEED)
waves = []
for m in range(-6, 7):
    for n in range(0, 7):
        if (n == 0 and m <= 0): continue
        k = math.hypot(m, n)
        if k > 6.5: continue
        amp = random.uniform(0.4, 1.0) / k ** 1.9
        waves.append((m, n, amp, random.uniform(0, 2 * math.pi)))

h = T / N
def field(x, y):
    return sum(a * math.sin(2 * math.pi * (m * x + n * y) / T + p) for m, n, a, p in waves)

grid = [[field(i * h, j * h) for j in range(N)] for i in range(N)]
flat = sorted(v for row in grid for v in row)
lo, hi = flat[int(len(flat) * 0.03)], flat[int(len(flat) * 0.97)]
levels = [lo + (hi - lo) * (k + 0.5) / LEVELS for k in range(LEVELS)]

def interp(p1, p2, v1, v2, lv):
    t = (lv - v1) / (v2 - v1)
    return (p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1]))

def segments(lv):
    segs = []
    for i in range(N):
        for j in range(N):
            v0 = grid[i][j]; v1 = grid[(i + 1) % N][j]
            v2 = grid[(i + 1) % N][(j + 1) % N]; v3 = grid[i][(j + 1) % N]
            p0 = (i * h, j * h); p1 = ((i + 1) * h, j * h)
            p2 = ((i + 1) * h, (j + 1) * h); p3 = (i * h, (j + 1) * h)
            c = (v0 > lv) | ((v1 > lv) << 1) | ((v2 > lv) << 2) | ((v3 > lv) << 3)
            if c in (0, 15): continue
            e = {}
            if (v0 > lv) != (v1 > lv): e['b'] = interp(p0, p1, v0, v1, lv)
            if (v1 > lv) != (v2 > lv): e['r'] = interp(p1, p2, v1, v2, lv)
            if (v2 > lv) != (v3 > lv): e['t'] = interp(p2, p3, v2, v3, lv)
            if (v3 > lv) != (v0 > lv): e['l'] = interp(p3, p0, v3, v0, lv)
            if len(e) == 2:
                a, b = e.values(); segs.append((a, b))
            else:  # saddle: decide by the cell's center value
                center = (v0 + v1 + v2 + v3) / 4
                if (center > lv) == (v0 > lv):
                    segs += [(e['b'], e['r']), (e['t'], e['l'])]
                else:
                    segs += [(e['l'], e['b']), (e['r'], e['t'])]
    return segs

def key(p): return (round(p[0], 3), round(p[1], 3))

def chain(segs):
    adj = {}
    for idx, (a, b) in enumerate(segs):
        adj.setdefault(key(a), []).append(idx); adj.setdefault(key(b), []).append(idx)
    used = [False] * len(segs); lines = []
    for s in range(len(segs)):
        if used[s]: continue
        used[s] = True
        line = [segs[s][0], segs[s][1]]
        for end in (1, 0):   # grow forward, then backward
            while True:
                tip = line[-1] if end else line[0]
                nxt = next((i for i in adj.get(key(tip), []) if not used[i]), None)
                if nxt is None: break
                used[nxt] = True
                a, b = segs[nxt]
                other = b if key(a) == key(tip) else a
                if end: line.append(other)
                else: line.insert(0, other)
        lines.append(line)
    return lines

def simplify(pts, tol=0.5):   # Ramer-Douglas-Peucker
    if len(pts) < 3: return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1; L = math.hypot(dx, dy) or 1e-9
    dmax, idx = 0, 0
    for i in range(1, len(pts) - 1):
        d = abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / L
        if d > dmax: dmax, idx = d, i
    if dmax <= tol: return [pts[0], pts[-1]]
    return simplify(pts[:idx + 1], tol)[:-1] + simplify(pts[idx:], tol)

sys.setrecursionlimit(100000)
paths = []
for k, lv in enumerate(levels):
    for line in chain(segments(lv)):
        pts = simplify(line)
        if len(pts) < 2: continue
        d = "M" + " ".join(f"{x:.1f} {y:.1f}" for x, y in pts)
        paths.append((k, d))

# every 4th line slightly stronger, like index contours on a real map
body = "".join(f"<path d='{d}'{' stroke-opacity=\"0.11\"' if k % 4 == 1 else ''}/>" for k, d in paths)
svg = (f"<svg xmlns='http://www.w3.org/2000/svg' width='{T}' height='{T}' viewBox='0 0 {T} {T}'>"
       f"<g fill='none' stroke='#1b3654' stroke-opacity='0.065' stroke-width='1' stroke-linejoin='round'>{body}</g></svg>")
open(OUT, "w").write(svg)
print(SEED, len(paths), "paths", len(svg) // 1024, "KB")
