// 签名书写引擎：按像素计算每一点墨迹的出现时间，交叉处不会提前露出其他笔画
// 签名书写引擎：按像素计算每一点墨迹的出现时间，交叉处不会提前露出其他笔画
function SigEngine(canvas, opt) {
  const VX = opt.view[0], VY = opt.view[1], VW = opt.view[2], VH = opt.view[3];
  const SOFT = 14, FADE = 800;
  // 墨迹路径的坐标变换，默认是 potrace 输出的（y 轴翻转、缩小 10 倍）
  const INK_T = opt.inkTransform || [.1, 0, 0, -.1, 0, 410];
  // 也可以用 inks: [{ d, t }] 传入多段墨迹，各自带坐标变换（例如英文和中文合在一张画布上）
  const INKS = (opt.inks || [{ d: opt.ink, t: INK_T }]).map(k => ({ path: new Path2D(k.d), t: k.t || INK_T }));
  const inkPath = INKS[0].path, iniPath = opt.ini ? new Path2D(opt.ini) : null;
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, s = 1, TX = 0, TY = 0, alpha = null, idx = null, T = null, T2 = null, CV = null, img = null, iniImg = null;
  let strokes = [], color = [27, 26, 24];
  const api = { total: 0, ends: [], starts: [] };

  function rasterize(path) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    for (const k of path === inkPath ? INKS : [{ path, t: INK_T }]) {
      g.setTransform(s, 0, 0, s, TX, TY); g.transform(...k.t);
      g.fill(k.path);
    }
    const d = g.getImageData(0, 0, W, H).data, a = new Uint8Array(W * H);
    for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
    return a;
  }
  function resize() {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    W = Math.max(1, Math.round(r.width * dpr));
    if (opt.layout) {
      // 由调用方决定缩放和位置（例如按页面字号和基线对齐），画布高度沿用页面上的高度
      H = Math.max(1, Math.round(r.height * dpr));
      ({ s, tx: TX, ty: TY } = opt.layout(W, H, dpr));
    } else {
      H = Math.max(1, Math.round(W * VH / VW)); s = W / VW; TX = -VX * s; TY = -VY * s;
    }
    canvas.width = W; canvas.height = H;
    alpha = rasterize(inkPath);
    const list = []; for (let i = 0; i < alpha.length; i++) if (alpha[i]) list.push(i);
    idx = Uint32Array.from(list);
    img = ctx.createImageData(W, H);
    iniImg = iniPath ? rasterize(iniPath) : null;
    compute();
  }
  // 墨迹内部到边缘的距离（像素），用来估计每处笔画的半宽
  function distField() {
    const INF = 1e9, d = new Float32Array(W * H);
    for (let i = 0; i < d.length; i++) d[i] = alpha[i] > 110 ? INF : 0;
    const a = 1, b = Math.SQRT2;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!d[i]) continue; let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + a);
      if (y > 0) { v = Math.min(v, d[i - W] + a); if (x > 0) v = Math.min(v, d[i - W - 1] + b); if (x < W - 1) v = Math.min(v, d[i - W + 1] + b); }
      d[i] = v;
    }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x; if (!d[i]) continue; let v = d[i];
      if (x < W - 1) v = Math.min(v, d[i + 1] + a);
      if (y < H - 1) { v = Math.min(v, d[i + W] + a); if (x < W - 1) v = Math.min(v, d[i + W + 1] + b); if (x > 0) v = Math.min(v, d[i + W - 1] + b); }
      d[i] = v;
    }
    return d;
  }
  // 运笔速度：直线处加速，转折处减速并稍停，原路折返处一带而过；起笔从慢速开始；
  // 收笔若墨迹变尖（出锋）就带着速度甩出，若是钝头（顿笔）就减速停住。
  const VMAX = 1500, V0 = 140, VTIP = 900, ACC = 9000, KAPPA = 9, VAIR = 1600;
  function timing(P, ranges, meta, Rraw) {
    let t = 0, last = null; api.ends = []; api.starts = [];
    const dist = (k1, k2) => Math.hypot(P[3*k1] - P[3*k2], P[3*k1+1] - P[3*k2+1]);
    ranges.forEach(([a, b], ri) => {
      const { si, pi } = meta[ri], m = b - a;
      if (pi === 0) {
        if (si > 0) { api.ends.push(t); t += 90 + dist(last, a) / VAIR * 1000; }   // 提笔移到下一笔
        api.starts.push(t);
      } else t += dist(last, a) / (VAIR * 1.6) * 1000;                            // 连笔：空中快速带过
      const sorted = Array.from(Rraw.slice(a, b)).sort((p, q) => p - q), med = sorted[m >> 1] || 4;
      const endW = Math.min(...Array.from(Rraw.slice(Math.max(a, b - 4), b)));
      const startW = Math.min(...Array.from(Rraw.slice(a, Math.min(b, a + 4))));
      const vEnd = endW < med * 0.65 ? VTIP : V0;
      const vStart = pi > 0 ? VTIP * 0.6 : (startW < med * 0.65 ? V0 * 2 : V0);
      // 曲率：前后各 4 个单位的方向夹角
      const v = new Float32Array(m), dwell = new Float32Array(m), flick = new Uint8Array(m);
      for (let k = 0; k < m; k++) {
        const k0 = Math.max(0, k - 4), k1 = Math.min(m - 1, k + 4);
        if (k1 - k <= 0 || k - k0 <= 0) { v[k] = VMAX; continue; }
        const ax = P[3*(a+k)] - P[3*(a+k0)], ay = P[3*(a+k)+1] - P[3*(a+k0)+1];
        const bx = P[3*(a+k1)] - P[3*(a+k)], by = P[3*(a+k1)+1] - P[3*(a+k)+1];
        const ang = Math.abs(Math.atan2(ax * by - ay * bx, ax * bx + ay * by));
        v[k] = VMAX / (1 + KAPPA * ang / (k1 - k0));
        if (ang > 2.5) { flick[k] = 1; continue; }        // 原路折返：下到尖端立刻提上来，一带而过
        if (ang > 1.6) dwell[k] = 70; else if (ang > 1.0) dwell[k] = 35;
      }
      // 只在每个急转处停一次
      for (let k = 1; k < m; k++) if (dwell[k] && dwell[k-1]) { if (dwell[k] > dwell[k-1]) dwell[k-1] = 0; else dwell[k] = 0; }
      // 折返点前后保持较高速度
      for (let k = 0; k < m; k++) if (flick[k]) for (let q = Math.max(0, k - 6); q <= Math.min(m - 1, k + 6); q++) { v[q] = Math.max(v[q], VTIP); dwell[q] = 0; }
      v[0] = Math.min(v[0], vStart);
      for (let k = 1; k < m; k++) v[k] = Math.min(v[k], Math.sqrt(v[k-1] * v[k-1] + 2 * ACC * dist(a+k-1, a+k)));
      v[m-1] = Math.min(v[m-1], vEnd);
      for (let k = m - 2; k >= 0; k--) v[k] = Math.min(v[k], Math.sqrt(v[k+1] * v[k+1] + 2 * ACC * dist(a+k, a+k+1)));
      P[3*a+2] = t;
      for (let k = 1; k < m; k++) {
        t += dist(a+k-1, a+k) / Math.max(40, (v[k-1] + v[k]) / 2) * 1000 + dwell[k];
        P[3*(a+k)+2] = t;
      }
      last = b - 1;
    });
    api.ends.push(t);
    api.total = t;
  }
  function compute() {
    if (!W || !strokes.length) return;
    // 1. 按 1 个单位间距采样中心线，时间在第 2 步按运笔速度计算
    const P = [], ranges = [], SI = [], meta = [], RF = [];
    strokes.forEach((st, si) => {
      st.parts.forEach((pts, pi) => {
        const r0 = P.length / 3;
        for (let i = 1; i < pts.length; i++) {
          const seg = Math.hypot(pts[i][0] - pts[i-1][0], pts[i][1] - pts[i-1][1]), n = Math.max(1, Math.ceil(seg));
          for (let k = 0; k < n; k++) {
            const f = k / n;
            P.push(pts[i-1][0] + (pts[i][0] - pts[i-1][0]) * f, pts[i-1][1] + (pts[i][1] - pts[i-1][1]) * f, 0);
            RF.push(pts[i][2] || 0);   // 第三项是指定的半宽（细线），没有则按墨迹宽度
          }
        }
        const e = pts[pts.length - 1]; P.push(e[0], e[1], 0); RF.push(e[2] || 0);
        ranges.push([r0, P.length / 3]); meta.push({ si, pi });
        while (SI.length < P.length / 3) SI.push(si);
      });
    });
    const n = P.length / 3;
    // 2. 每个采样点处的笔画半宽
    const D = distField(), R = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      const px = Math.round(P[3*k] * s + TX), py = Math.round(P[3*k+1] * s + TY); let m = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const x = px + dx, y = py + dy; if (x >= 0 && y >= 0 && x < W && y < H) m = Math.max(m, D[y * W + x]);
      }
      R[k] = m / s;
    }
    timing(P, ranges, meta, R);
    // 每个采样点的法线方向，以及沿法线向左、向右到墨迹边缘的距离
    const NX = new Float32Array(n), NY = new Float32Array(n), WL = new Float32Array(n), WR = new Float32Array(n);
    const inkAt = (x, y) => { const px = Math.round(x * s + TX), py = Math.round(y * s + TY); return px >= 0 && py >= 0 && px < W && py < H && alpha[py * W + px] > 110; };
    for (const [a, b] of ranges) for (let k = a; k < b; k++) {
      const k0 = Math.max(a, k - 3), k1 = Math.min(b - 1, k + 3);
      let tx = P[3*k1] - P[3*k0], ty = P[3*k1+1] - P[3*k0+1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      NX[k] = -ty; NY[k] = tx;
      for (const side of [1, -1]) {
        let d = 0; while (d < 15 && inkAt(P[3*k] + NX[k] * side * (d + .5), P[3*k+1] + NY[k] * side * (d + .5))) d += .5;
        if (side > 0) WR[k] = d; else WL[k] = d;
      }
    }
    // 笔宽半径：平常用局部测得的半宽（前后 ±3 个采样点取中位数去噪）。
    // 交叉处墨迹堆积会让局部半宽偏大：有别的笔中心线穿过，或自身交叉且比前后 ±40 个采样点的 40% 分位数大 20% 以上的一段，
    // 改为用这一段前后两端的正常半宽线性插值，笔画穿过交叉点时粗细连续变化。
    const R2 = new Float32Array(n), BAND = new Uint8Array(n), BL = new Float32Array(n), BR = new Float32Array(n);
    // 另一笔的中心线从这一笔的墨迹里穿过的位置，也算交叉处
    const CG = 8, cg = new Map();
    for (let k = 0; k < n; k++) { const key = Math.floor(P[3*k+1] / CG) * 4096 + Math.floor(P[3*k] / CG); let c = cg.get(key); if (!c) cg.set(key, c = []); c.push(k); }
    const crossed = k => {
      const x = P[3*k], y = P[3*k+1], gx = Math.floor(x / CG), gy = Math.floor(y / CG);
      for (let yy = gy - 1; yy <= gy + 1; yy++) for (let xx = gx - 1; xx <= gx + 1; xx++) {
        const c = cg.get(yy * 4096 + xx); if (!c) continue;
        for (const q of c) if (SI[q] !== SI[k] && Math.hypot(P[3*q] - x, P[3*q+1] - y) < R[k] + 1.5) return true;
      }
      return false;
    };
    // 同一笔自身交叉（如「东」的回环）：附近有这一笔沿路程相隔较远的另一段
    const selfNear = (k, a, b) => {
      const x = P[3*k], y = P[3*k+1], gx = Math.floor(x / CG), gy = Math.floor(y / CG);
      for (let yy = gy - 1; yy <= gy + 1; yy++) for (let xx = gx - 1; xx <= gx + 1; xx++) {
        const c = cg.get(yy * 4096 + xx); if (!c) continue;
        for (const q of c) if (SI[q] === SI[k] && Math.abs(q - k) > 25 && Math.hypot(P[3*q] - x, P[3*q+1] - y) < R[k] + 1.5) {
          // 原路折返的两段方向相反、位置重合，不算交叉
          const t1x = P[3*Math.min(k+2, n-1)] - P[3*Math.max(k-2, 0)], t1y = P[3*Math.min(k+2, n-1)+1] - P[3*Math.max(k-2, 0)+1];
          const t2x = P[3*Math.min(q+2, n-1)] - P[3*Math.max(q-2, 0)], t2y = P[3*Math.min(q+2, n-1)+1] - P[3*Math.max(q-2, 0)+1];
          const cos = (t1x * t2x + t1y * t2y) / ((Math.hypot(t1x, t1y) * Math.hypot(t2x, t2y)) || 1);
          if (cos > -0.9) return true;
        }
      }
      return false;
    };
    for (const [a, b] of ranges) {
      const loc = new Float32Array(b - a), bad = new Uint8Array(b - a);
      for (let k = a; k < b; k++) {
        const w3 = Array.from(R.slice(Math.max(a, k - 3), Math.min(b, k + 4))).sort((p, q) => p - q);
        loc[k - a] = w3[w3.length >> 1];
        const w = Array.from(R.slice(Math.max(a, k - 40), Math.min(b, k + 41))).sort((p, q) => p - q);
        const med = w[Math.floor(w.length * 0.4)] || 4;
        if (crossed(k) || (loc[k - a] > med * 1.2 && selfNear(k, a, b))) bad[k - a] = 1;
        else loc[k - a] = Math.max(loc[k - a], med * 0.85);
      }
      for (let i = 0; i < b - a; ) {
        if (!bad[i]) { i++; continue; }
        let j = i; while (j < b - a && bad[j]) j++;
        // 前后各往外多取 2 个点，避开交叉边缘
        // 只有另一笔真正从两侧穿过（十字交叉）时才用条带；T 形相接、端点相接仍用圆盘
        let leftHit = false, rightHit = false;
        for (let k = i; k < j; k++) {
          const K = a + k, x = P[3*K], y = P[3*K+1], gx = Math.floor(x / CG), gy = Math.floor(y / CG);
          for (let yy = gy - 2; yy <= gy + 2; yy++) for (let xx = gx - 2; xx <= gx + 2; xx++) {
            const c = cg.get(yy * 4096 + xx); if (!c) continue;
            for (const q of c) {
              if (SI[q] === SI[K]) continue;
              const dx = P[3*q] - x, dy = P[3*q+1] - y, along = Math.abs(dx * NY[K] - dy * NX[K]), lat = dx * NX[K] + dy * NY[K];
              if (along < 3) { if (lat > R[K] + 2) rightHit = true; if (lat < -R[K] - 2) leftHit = true; }
            }
          }
        }
        const isCross = leftHit && rightHit;
        const ia = i - 6 >= 0 ? i - 6 : (i - 3 >= 0 ? i - 3 : (j + 5 < b - a ? j + 5 : i)), ib = j + 5 < b - a ? j + 5 : (j + 2 < b - a ? j + 2 : ia);   // 锚点离交叉处远一些，量到的边缘不受另一笔墨迹影响
        const L = loc[ia], Rr = loc[ib];
        const kEnd = ib > ia ? ib : b - a, kBeg = ib > ia || ia < i ? ia + 1 : 0;   // 交叉段在笔画一端时，一直延续到端点
        for (let k = Math.max(0, kBeg); k < Math.min(b - a, kEnd); k++) {
          const u = Math.min(1, Math.max(0, (k - ia) / ((ib - ia) || 1)));
          loc[k] = L + (Rr - L) * u;
          // 交叉段改用条带：左右边缘各自从交叉前后的真实墨迹边缘直线过渡（以各点到两端锚点的位置换算）
          if (isCross && k >= i - 2 && k < j + 2 && k >= 3 && k < b - a - 3) {   // 端点附近仍用圆盘，收笔是圆头
            const K = a + k, A = a + ia, B = a + ib;
            const edge = (side, Wa, Wb) => {
              const ex = (P[3*A] + NX[A] * side * Wa) * (1 - u) + (P[3*B] + NX[B] * side * Wb) * u;
              const ey = (P[3*A+1] + NY[A] * side * Wa) * (1 - u) + (P[3*B+1] + NY[B] * side * Wb) * u;
              return (ex - P[3*K]) * NX[K] + (ey - P[3*K+1]) * NY[K];
            };
            BAND[K] = 1; BR[K] = edge(1, WR[A], WR[B]); BL[K] = -edge(-1, WL[A], WL[B]);
          }
        }
        i = j;
      }
      for (let k = a; k < b; k++) {
        if (RF[k] > 0) { R2[k] = RF[k] + 0.35; BAND[k] = 0; continue; }
        let r = loc[k - a];
        if (k - a < 3 || b - 1 - k < 3) r *= 0.9;
        R2[k] = r + 0.35;
      }
    }
    R.set(R2);
    // 3. 网格加速。规则：
    //    落在某笔笔宽圆盘内的像素，取经过它的最早时间；圆盘边缘按覆盖比例半透明，避免切口锯齿；
    //    其余部分（交叉处堆积的墨、笔端多出的墨）等附近所有笔画都经过后再出现。
    const C = 14, GW = 4096, cells = new Map();
    for (let k = 0; k < n; k++) {
      const key = Math.floor(P[3*k+1] / C) * GW + Math.floor(P[3*k] / C);
      let a = cells.get(key); if (!a) cells.set(key, a = []); a.push(k);
    }
    T = new Float32Array(idx.length); T2 = new Float32Array(idx.length); CV = new Float32Array(idx.length);
    const cand = [], half = 0.5 / s;
    for (let j = 0; j < idx.length; j++) {
      const i = idx[j], x = (i % W + .5 - TX) / s, y = ((i / W | 0) + .5 - TY) / s;
      const cx = Math.floor(x / C), cy = Math.floor(y / C);
      let best = Infinity, bestS = -1, near = Infinity, nearT = Infinity;
      cand.length = 0;
      for (let gy = cy - 1; gy <= cy + 1; gy++) for (let gx = cx - 1; gx <= cx + 1; gx++) {
        const a = cells.get(gy * GW + gx); if (!a) continue;
        for (const k of a) {
          const d = Math.hypot(P[3*k] - x, P[3*k+1] - y), tk = P[3*k+2];
          let gap = d - R[k];
          if (BAND[k]) {
            // 条带：沿笔画方向 ±1 个单位，横向在左右边缘之间
            const dx = x - P[3*k], dy = y - P[3*k+1], along = Math.abs(dx * NY[k] - dy * NX[k]), lat = dx * NX[k] + dy * NY[k];
            gap = along <= 1.0 ? Math.max(lat - BR[k], -lat - BL[k]) - 0.35 : Math.max(gap, 0.5 / s + 0.01);
          }
          if (gap <= half && tk < best) { best = tk; bestS = SI[k]; }
          if (d < near) { near = d; nearT = tk; }
          cand.push(gap, tk, SI[k]);
        }
      }
      // 覆盖比例取这一笔所有圆盘里最大的那个
      let cov = 0, gapMin = Infinity, late = -Infinity;
      for (let c = 0; c < cand.length; c += 3) {
        gapMin = Math.min(gapMin, cand[c]);
        if (cand[c+2] === bestS) cov = Math.max(cov, Math.min(1, Math.max(0, 0.5 - cand[c] * s)));
      }
      const lim = Math.max(gapMin, 0) + 2.5;
      for (let c = 0; c < cand.length; c += 3) if (cand[c] <= lim && cand[c+1] > late) late = cand[c+1];
      if (late === -Infinity) late = nearT;
      if (best === Infinity) { best = late; cov = 1; }
      T[j] = best; T2[j] = Math.max(best, late); CV[j] = cov;
    }
    close();
  }
  // 闭运算（先取邻域最大再取最小）：夹在晚出现墨迹之间的细小「早出现」突起，改成和周围一起出现
  function close() {
    const r = Math.max(1, Math.round(s * 1.4)), F = new Float32Array(W * H).fill(NaN);
    for (let j = 0; j < idx.length; j++) F[idx[j]] = T[j];
    const off = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r) off.push(dx, dy);
    const pass = (src, useMax) => {
      const out = new Float32Array(src.length).fill(NaN);
      for (let j = 0; j < idx.length; j++) {
        const i = idx[j], x = i % W, y = i / W | 0; let v = src[i];
        for (let o = 0; o < off.length; o += 2) {
          const xx = x + off[o], yy = y + off[o+1];
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const u = src[yy * W + xx]; if (u !== u) continue;
          v = useMax ? Math.max(v, u) : Math.min(v, u);
        }
        out[i] = v;
      }
      return out;
    };
    const G = pass(pass(F, true), false);
    // 去孤点：周围大多数墨迹都更晚出现的单个像素，跟着周围一起出现
    for (let it = 0; it < 2; it++) {
      const H2 = G.slice();
      for (let j = 0; j < idx.length; j++) {
        const i = idx[j], x = i % W, y = i / W | 0, v = G[i]; let later = 0, same = 0, lo = Infinity;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const u = G[yy * W + xx]; if (u !== u) continue;
          if (u > v + 30) { later++; lo = Math.min(lo, u); } else same++;
        }
        if (later >= 3 && same <= 2) H2[i] = lo;
      }
      G.set(H2);
    }
    for (let j = 0; j < idx.length; j++) { T[j] = G[idx[j]]; T2[j] = Math.max(T2[j], T[j]); }
  }
  api.setStrokes = st => { strokes = st; compute(); };
  api.setColor = c => { color = c; };
  api.draw = t => {
    if (!T) return;
    const d = img.data; d.fill(0);
    const full = t >= api.total + SOFT;
    for (let j = 0; j < idx.length; j++) {
      let f = 1;
      if (!full) {
        const g1 = Math.min(1, Math.max(0, (t - T[j]) / SOFT)), g2 = Math.min(1, Math.max(0, (t - T2[j]) / SOFT));
        f = CV[j] * g1 + (1 - CV[j]) * g2;
        if (f <= 0) continue;
      }
      const o = idx[j] * 4; d[o] = color[0]; d[o+1] = color[1]; d[o+2] = color[2]; d[o+3] = alpha[idx[j]] * f;
    }
    if (iniImg && t > api.total) {
      const f = Math.min(1, (t - api.total) / FADE);
      for (let i = 0; i < iniImg.length; i++) if (iniImg[i]) { const o = i * 4; d[o] = color[0]; d[o+1] = color[1]; d[o+2] = color[2]; d[o+3] = iniImg[i] * f; }
    }
    ctx.putImageData(img, 0, 0);
  };
  api.resize = resize;
  api.fadeTime = FADE;
  resize();
  return api;
}
