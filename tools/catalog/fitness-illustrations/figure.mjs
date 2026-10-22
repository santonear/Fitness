// Fitness-original flat exercise illustrations, drawn from geometric primitives.
// No third-party image is read, traced or used as a reference here: every figure is
// a parametric skeleton (joint angles / reach targets) dressed with simple shapes.
export const SIZE = 512;
const GROUND = 452;
const C = {
  bgTop: '#e8f4fc',
  bgBottom: '#cfe5f5',
  shadow: '#b7d3e8',
  line: '#2e3b4e',
  skin: '#f2c29b',
  skinFar: '#e0a97f',
  hair: '#3a2a22',
  top: '#3d8ed6',
  topFar: '#3277b6',
  shorts: '#2c3f68',
  shortsFar: '#22324f',
  shoe: '#ffffff',
  sole: '#c4cfda',
  shoeFar: '#e4eaf0',
  wall: '#f3f6f9',
  wallEdge: '#a8b7c6',
  frame: '#7d8a98',
  frameLight: '#aab6c2',
  seat: '#b9c4cf',
  band: '#e65a73',
  accent: '#f08c2e',
  bag: '#e98a3b',
  bagDark: '#c56d24',
  bottle: '#a9daf5',
};
const L = { torso: 118, upper: 72, fore: 64, thigh: 96, shin: 94, neck: 14, head: 26, ankle: 14 };
const W = { upper: 29, fore: 23, thigh: 45, shin: 33, neck: 20 };
const OUT = 6; // outline thickness added around every limb
const R = Math.PI / 180;

const add = (p, v, s = 1) => [p[0] + v[0] * s, p[1] + v[1] * s];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = v => Math.hypot(v[0], v[1]);
const unit = v => {
  const l = len(v) || 1;
  return [v[0] / l, v[1] / l];
};
const rot = (v, deg) => {
  const a = deg * R,
    c = Math.cos(a),
    s = Math.sin(a);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
};
/** Direction for an angle measured from straight down; positive turns toward the facing side (+x). */
export const down = a => [Math.sin(a * R), Math.cos(a * R)];
const angleOf = v => Math.atan2(v[0], v[1]) / R;
const f = n => Math.round(n * 10) / 10;
const pt = p => `${f(p[0])},${f(p[1])}`;

/** Two-bone reach: returns the middle joint and the (possibly clamped) end point. */
function reach(root, target, l1, l2, bend) {
  const d = Math.min(Math.max(len(sub(target, root)), Math.abs(l1 - l2) + 1), l1 + l2 - 0.5);
  const u = unit(sub(target, root));
  const alpha = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)) / R;
  const mid = add(root, rot(u, bend * alpha), l1);
  return [mid, add(mid, unit(sub(add(root, u, d), mid)), l2)];
}

class Scene {
  constructor() {
    this.layers = { back: [], far: [], body: [], near: [], front: [] };
    this.box = [];
    this.walls = [];
  }
  extend(...points) {
    for (const [p, r = 0] of points) this.box.push([p[0] - r, p[1] - r], [p[0] + r, p[1] + r]);
  }
  capsule(layer, a, b, w, fill, outline = true) {
    if (outline)
      this.layers[layer].push(
        `<path d="M${pt(a)}L${pt(b)}" stroke="${C.line}" stroke-width="${w + OUT}" stroke-linecap="round"/>`,
      );
    this.layers[layer].push(
      `<path d="M${pt(a)}L${pt(b)}" stroke="${fill}" stroke-width="${w}" stroke-linecap="round"/>`,
    );
    this.extend([a, w / 2 + OUT / 2], [b, w / 2 + OUT / 2]);
  }
  shape(layer, d, fill, stroke = C.line, sw = 3.5) {
    this.layers[layer].push(
      `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`,
    );
  }
  raw(layer, svg) {
    this.layers[layer].push(svg);
  }
}
const smooth = points => {
  // closed Catmull-Rom path through the points
  let d = `M${pt(points[0])}`;
  for (let i = 0; i < points.length; i++) {
    const p0 = points[(i - 1 + points.length) % points.length],
      p1 = points[i],
      p2 = points[(i + 1) % points.length],
      p3 = points[(i + 2) % points.length];
    d += `C${pt(add(p1, sub(p2, p0), 1 / 6))} ${pt(add(p2, sub(p3, p1), -1 / 6))} ${pt(p2)}`;
  }
  return d + 'Z';
};

/** Limb painted as one piece: outlines of all bones first, then the fills, so joints stay seamless. */
function limb(scene, layer, joints, widths, fills, cover) {
  for (let i = 0; i < joints.length - 1; i++)
    scene.layers[layer].push(
      `<path d="M${pt(joints[i])}L${pt(joints[i + 1])}" stroke="${C.line}" stroke-width="${widths[i] + OUT}" stroke-linecap="round"/>`,
    );
  for (let i = 0; i < joints.length - 1; i++)
    scene.layers[layer].push(
      `<path d="M${pt(joints[i])}L${pt(joints[i + 1])}" stroke="${fills[i]}" stroke-width="${widths[i]}" stroke-linecap="round"/>`,
    );
  if (cover)
    scene.layers[layer].push(
      `<path d="M${pt(joints[0])}L${pt(add(joints[0], sub(joints[1], joints[0]), cover.part))}" stroke="${cover.fill}" stroke-width="${widths[0] + 3}" stroke-linecap="round"/>`,
    );
  joints.forEach((j, i) => scene.extend([j, (widths[Math.min(i, widths.length - 1)] + OUT) / 2]));
}
function shoe(scene, layer, ankle, footDir, sole, far) {
  const n = [-footDir[1], footDir[0]]; // toward the sole for a figure facing +x
  const heel = add(add(ankle, footDir, -8), n, sole),
    toe = add(add(ankle, footDir, 30), n, sole);
  scene.capsule(layer, heel, toe, 20, far ? C.shoeFar : C.shoe);
  scene.layers[layer].push(
    `<path d="M${pt(add(heel, n, 6))}L${pt(add(toe, n, 6))}" stroke="${C.sole}" stroke-width="5" stroke-linecap="round"/>`,
  );
  scene.extend([add(heel, n, 10), 3], [add(toe, n, 10), 3]);
  return { heel, toe, bottom: Math.max(heel[1], toe[1]) + 13 };
}

/** A figure seen from the side, facing +x. Angles in degrees measured from straight down. */
export class Side {
  constructor({ t = 0, head = 0, hip = [0, 0], round = 0 } = {}) {
    this.scene = new Scene();
    this.hip = hip;
    this.t = t;
    this.round = round;
    this.u = unit(rot([0, -1], t)); // hip -> shoulder
    this.shoulder = add(hip, this.u, L.torso);
    const hu = unit(rot(this.u, head));
    this.headUp = hu;
    this.headCenter = add(add(this.shoulder, this.u, 4), hu, L.neck + L.head);
    this.joints = {};
    this.feet = {};
  }
  arm(side, o) {
    const far = side === 'far',
      root = add(this.shoulder, this.u, -6);
    let elbow, hand;
    if (o.elbow) [elbow, hand] = [o.elbow, o.hand];
    else if (o.to) [elbow, hand] = reach(root, o.to, L.upper, L.fore, o.bend ?? 1);
    else {
      elbow = add(root, down(o.s), L.upper);
      hand = add(elbow, down(o.s + (o.e ?? 0)), L.fore);
    }
    this.joints[side + 'Arm'] = { elbow, hand };
    const layer = o.layer ?? (far ? 'far' : 'near'),
      skin = far ? C.skinFar : C.skin;
    o.hold?.(this.scene, layer, hand);
    limb(this.scene, layer, [root, elbow, hand], [W.upper, W.fore], [skin, skin]);
    this.scene.capsule(layer, hand, add(hand, unit(sub(hand, elbow)), 4), 17, skin);
    return { elbow, hand };
  }
  leg(side, o) {
    const far = side === 'far',
      root = this.hip;
    let knee, ankle;
    if (o.knee) [knee, ankle] = [o.knee, o.ankle];
    else if (o.to) [knee, ankle] = reach(root, o.to, L.thigh, L.shin, o.bend ?? -1);
    else {
      knee = add(root, down(o.h), L.thigh);
      ankle = add(knee, down(o.h - (o.k ?? 0)), L.shin);
    }
    const shinAngle = angleOf(sub(ankle, knee));
    const footAngle = o.fa ?? shinAngle + 90 - (o.p ?? 0);
    const layer = o.layer ?? (far ? 'far' : 'near'),
      skin = far ? C.skinFar : C.skin;
    limb(this.scene, layer, [root, knee, ankle], [W.thigh, W.shin], [skin, skin], {
      part: 0.42,
      fill: far ? C.shortsFar : C.shorts,
    });
    const s = shoe(this.scene, layer, ankle, down(footAngle), o.sole ?? 6, far);
    this.feet[side] = s;
    this.joints[side + 'Leg'] = { knee, ankle };
    return { knee, ankle, ...s };
  }
  draw() {
    const s = this.scene,
      u = this.u,
      n = [-u[1], u[0]],
      h = this.hip,
      sh = this.shoulder;
    // neck and head
    s.capsule('body', add(sh, u, 2), this.headCenter, W.neck, C.skin);
    const pelvis = [
      add(h, n, 27),
      add(add(h, u, 28), n, 25),
      add(add(h, u, 28), n, -27),
      add(h, n, -31),
      add(add(h, u, -19), n, -15),
      add(add(h, u, -20), n, 15),
    ];
    s.shape('body', smooth(pelvis), C.shorts);
    const shirt = [
      add(add(sh, u, 8), n, 15),
      add(add(sh, u, -16), n, 33),
      add(add(h, u, 62), n, 25),
      add(add(h, u, 18), n, 27),
      add(add(h, u, 14), n, -28),
      add(add(h, u, 64), n, -24 - this.round * 0.5),
      add(add(sh, u, -12), n, -27 - this.round),
      add(add(sh, u, 9), n, -12 - this.round * 0.4),
    ];
    s.shape('body', smooth(shirt), C.top);
    s.extend(...shirt.map(p => [p, 2]), ...pelvis.map(p => [p, 2]));
    this.head(s);
    return s;
  }
  head(s) {
    const c = this.headCenter,
      hu = this.headUp,
      hn = [-hu[1], hu[0]],
      r = L.head;
    s.raw(
      'body',
      `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${r + OUT / 2}" fill="${C.line}"/><circle cx="${f(c[0])}" cy="${f(c[1])}" r="${r}" fill="${C.skin}"/>`,
    );
    const nose = add(add(c, hn, r - 1), hu, -3);
    s.raw(
      'body',
      `<circle cx="${f(nose[0])}" cy="${f(nose[1])}" r="5" fill="${C.skin}" stroke="${C.line}" stroke-width="3"/>`,
    );
    const hair = [];
    for (let a = 38; a >= -118; a -= 12) hair.push(add(c, rot(hu, a), r + 3));
    hair.push(
      add(add(c, hn, -r * 0.3), hu, -r * 0.35),
      add(add(c, hn, r * 0.05), hu, r * 0.3),
      add(add(c, hn, r * 0.5), hu, r * 0.62),
    );
    s.shape('body', smooth(hair), C.hair, C.line, 3);
    const ear = add(add(c, hn, -6), hu, -6);
    s.raw(
      'body',
      `<ellipse cx="${f(ear[0])}" cy="${f(ear[1])}" rx="5.5" ry="7.5" fill="${C.skinFar}" stroke="${C.line}" stroke-width="2.5"/>`,
    );
    s.extend([c, r + 6]);
  }
}

/** A figure seen from the front. `turn` rotates the whole body in the picture plane (for side-lying). */
export class Front {
  constructor({ turn = 0, hip = [0, 0], torso = 1 } = {}) {
    this.scene = new Scene();
    this.hip = hip;
    this.turn = turn;
    this.u = unit(rot([0, -1], turn));
    this.n = [-this.u[1], this.u[0]]; // n points to image right when upright
    this.shoulderMid = add(hip, this.u, L.torso * torso);
    this.shoulders = { right: add(this.shoulderMid, this.n, 40), left: add(this.shoulderMid, this.n, -40) };
    this.hips = { right: add(hip, this.n, 21), left: add(hip, this.n, -21) };
    this.joints = {};
    this.feet = {};
  }
  /** Angles are relative to the body axis; positive opens away from the midline. */
  arm(side, o) {
    const sign = side === 'right' ? 1 : -1,
      root = add(this.shoulders[side], this.u, -6);
    let elbow, hand;
    if (o.elbow) [elbow, hand] = [o.elbow, o.hand];
    else if (o.to) [elbow, hand] = reach(root, o.to, L.upper * (o.ls ?? 1), L.fore * (o.fs ?? 1), o.bend ?? -sign);
    else {
      elbow = add(root, rot(down(0), this.turn + sign * -o.s), L.upper * (o.ls ?? 1));
      hand = add(elbow, rot(down(0), this.turn + sign * -(o.s + (o.e ?? 0))), L.fore * (o.fs ?? 1));
    }
    const layer = o.layer ?? (o.behind ? 'far' : 'near');
    o.hold?.(this.scene, layer, hand);
    limb(this.scene, layer, [root, elbow, hand], [W.upper, W.fore], [C.skin, C.skin]);
    this.scene.capsule(layer, hand, add(hand, unit(sub(hand, elbow)), 4), 17, C.skin);
    this.joints[side + 'Arm'] = { elbow, hand };
    return { elbow, hand };
  }
  leg(side, o = {}) {
    const sign = side === 'right' ? 1 : -1,
      root = this.hips[side];
    let knee, ankle;
    if (o.knee) [knee, ankle] = [o.knee, o.ankle];
    else if (o.to) [knee, ankle] = reach(root, o.to, L.thigh * (o.ts ?? 1), L.shin * (o.ss ?? 1), o.bend ?? sign);
    else {
      knee = add(root, rot(down(0), this.turn + sign * -(o.h ?? 0)), L.thigh * (o.ts ?? 1));
      ankle = add(knee, rot(down(0), this.turn + sign * -((o.h ?? 0) - (o.k ?? 0))), L.shin * (o.ss ?? 1));
    }
    limb(this.scene, 'far', [root, knee, ankle], [W.thigh, W.shin], [C.skin, C.skin], { part: 0.38, fill: C.shorts });
    // shoe seen from the front: a short rounded block under the ankle
    const shin = unit(sub(ankle, knee)),
      side90 = [-shin[1] * sign, shin[0] * sign];
    const a = add(add(ankle, shin, 4), side90, -4),
      b = add(add(ankle, shin, 8), side90, 9);
    if (!o.noShoe) {
      this.scene.capsule('far', a, b, 20, C.shoe);
      this.scene.extend([b, 14], [a, 14]);
    }
    this.feet[side] = { bottom: Math.max(a[1], b[1]) + 13 };
    this.joints[side + 'Leg'] = { knee, ankle };
    return { knee, ankle };
  }
  draw() {
    const s = this.scene,
      u = this.u,
      n = this.n,
      h = this.hip,
      m = this.shoulderMid;
    const at = (base, du, dn) => add(add(base, u, du), n, dn);
    s.capsule('body', at(m, 4, 0), at(m, L.neck + L.head - 4, 0), W.neck + 4, C.skin);
    const shorts = [
      at(h, 26, -35),
      at(h, 26, 35),
      at(h, -2, 41),
      at(h, -24, 20),
      at(h, -16, 0),
      at(h, -24, -20),
      at(h, -2, -41),
    ];
    s.shape('body', smooth(shorts), C.shorts);
    const shirt = [
      at(m, 2, -17),
      at(m, -7, 0),
      at(m, 2, 17),
      at(m, 0, 44),
      at(m, -28, 45),
      at(m, -62, 36),
      at(h, 16, 38),
      at(h, 12, 0),
      at(h, 16, -38),
      at(m, -62, -36),
      at(m, -28, -45),
      at(m, 0, -44),
    ];
    s.shape('body', smooth(shirt), C.top);
    s.extend(...shirt.map(p => [p, 2]), ...shorts.map(p => [p, 2]));
    const c = at(m, L.neck + L.head + 4, 0),
      r = L.head;
    for (const k of [-1, 1]) {
      const e = at(c, -2, k * (r - 1));
      s.raw(
        'body',
        `<ellipse cx="${f(e[0])}" cy="${f(e[1])}" rx="5.5" ry="7.5" fill="${C.skinFar}" stroke="${C.line}" stroke-width="2.5"/>`,
      );
    }
    s.raw(
      'body',
      `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${r + OUT / 2}" fill="${C.line}"/><circle cx="${f(c[0])}" cy="${f(c[1])}" r="${r}" fill="${C.skin}"/>`,
    );
    const hair = [];
    for (let a = -100; a <= 100; a += 10) hair.push(add(c, rot(u, a), r + 3));
    hair.push(at(c, 6, r * 0.7), at(c, 11, 0), at(c, 6, -r * 0.7));
    s.shape('body', smooth(hair), C.hair, C.line, 3);
    s.extend([c, r + 6]);
    return s;
  }
}

// ---------- props (figure coordinates; ground is the y of the floor) ----------
export const props = {
  wall(scene, x, ground, side = 'right') {
    const w = 600,
      x0 = side === 'right' ? x : x - w;
    scene.raw('back', `<rect x="${f(x0)}" y="${f(ground - 900)}" width="${w}" height="900" fill="${C.wall}"/>`);
    scene.raw('back', `<path d="M${f(x)},${f(ground - 900)}V${f(ground)}" stroke="${C.wallEdge}" stroke-width="5"/>`);
    const bx = side === 'right' ? x : x - 14;
    scene.raw('back', `<rect x="${f(bx)}" y="${f(ground - 16)}" width="14" height="16" fill="${C.frameLight}"/>`);
    scene.box.push([x, ground - 10], [x + (side === 'right' ? 24 : -24), ground]);
  },
  /** Side-view chair facing +x; `back` is the x of the backrest, seat top at `seat`. */
  chair(scene, back, seat, ground, depth = 92, layer = 'back') {
    const legs = `M${f(back + 6)},${f(seat + 8)}V${f(ground)}M${f(back + depth - 6)},${f(seat + 8)}V${f(ground)}`;
    scene.raw(
      layer,
      `<path d="${legs}" stroke="${C.line}" stroke-width="13" stroke-linecap="round"/><path d="${legs}" stroke="${C.frame}" stroke-width="7" stroke-linecap="round"/>`,
    );
    scene.raw(
      layer,
      `<path d="M${f(back)},${f(seat)}V${f(seat - 112)}" stroke="${C.line}" stroke-width="16" stroke-linecap="round"/><path d="M${f(back)},${f(seat)}V${f(seat - 112)}" stroke="${C.frame}" stroke-width="10" stroke-linecap="round"/>`,
    );
    scene.raw(
      layer,
      `<rect x="${f(back - 8)}" y="${f(seat - 112)}" width="18" height="62" rx="8" fill="${C.seat}" stroke="${C.line}" stroke-width="3.5"/>`,
    );
    scene.raw(
      layer,
      `<rect x="${f(back - 6)}" y="${f(seat - 2)}" width="${depth + 12}" height="14" rx="6" fill="${C.seat}" stroke="${C.line}" stroke-width="3.5"/>`,
    );
    scene.box.push([back - 10, seat - 114], [back + depth + 8, ground]);
  },
  /** Chair seen from the side of its backrest (used beside a front-view figure). */
  chairBack(scene, x, ground, height = 178, layer = 'back') {
    const top = ground - height,
      seat = ground - 98;
    const legs = `M${f(x - 30)},${f(seat)}V${f(ground)}M${f(x + 30)},${f(seat)}V${f(ground)}`;
    scene.raw(
      layer,
      `<path d="${legs}" stroke="${C.line}" stroke-width="13" stroke-linecap="round"/><path d="${legs}" stroke="${C.frame}" stroke-width="7" stroke-linecap="round"/>`,
    );
    scene.raw(
      layer,
      `<rect x="${f(x - 40)}" y="${f(seat - 6)}" width="80" height="14" rx="6" fill="${C.seat}" stroke="${C.line}" stroke-width="3.5"/>`,
    );
    scene.raw(
      layer,
      `<rect x="${f(x - 36)}" y="${f(top)}" width="72" height="62" rx="12" fill="${C.seat}" stroke="${C.line}" stroke-width="3.5"/>`,
    );
    const posts = `M${f(x - 28)},${f(top + 60)}V${f(seat - 6)}M${f(x + 28)},${f(top + 60)}V${f(seat - 6)}`;
    scene.raw(
      layer,
      `<path d="${posts}" stroke="${C.line}" stroke-width="12"/><path d="${posts}" stroke="${C.frame}" stroke-width="6"/>`,
    );
    scene.box.push([x - 42, top], [x + 42, ground]);
    return { top };
  },
  step(scene, x0, x1, ground, height = 40) {
    scene.raw(
      'back',
      `<rect x="${f(x0)}" y="${f(ground - height)}" width="${f(x1 - x0)}" height="${height}" rx="6" fill="${C.seat}" stroke="${C.line}" stroke-width="3.5"/><path d="M${f(x0 + 6)},${f(ground - height + 9)}H${f(x1 - 6)}" stroke="${C.frameLight}" stroke-width="4"/>`,
    );
    scene.box.push([x0, ground - height], [x1, ground]);
  },
  band(scene, layer, ...points) {
    scene.raw(
      layer,
      `<path d="M${points.map(pt).join('L')}" fill="none" stroke="${C.line}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M${points.map(pt).join('L')}" fill="none" stroke="${C.band}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
  },
  anchor(scene, x, y) {
    scene.raw(
      'back',
      `<rect x="${f(x - 4)}" y="${f(y - 10)}" width="12" height="20" rx="4" fill="${C.frame}" stroke="${C.line}" stroke-width="3"/>`,
    );
  },
  backpack(scene, layer, hand) {
    const x = hand[0],
      y = hand[1] + 8;
    scene.raw(
      layer,
      `<path d="M${f(x - 9)},${f(y + 10)}Q${f(x)},${f(y - 14)} ${f(x + 9)},${f(y + 10)}" fill="none" stroke="${C.line}" stroke-width="5"/>`,
    );
    scene.raw(
      layer,
      `<rect x="${f(x - 30)}" y="${f(y + 8)}" width="60" height="78" rx="20" fill="${C.bag}" stroke="${C.line}" stroke-width="3.5"/><rect x="${f(x - 20)}" y="${f(y + 46)}" width="40" height="28" rx="9" fill="${C.bagDark}" stroke="${C.line}" stroke-width="3"/>`,
    );
    scene.box.push([x - 32, y - 10], [x + 32, y + 88]);
  },
  bottle(scene, layer, hand, far = false) {
    const x = hand[0],
      y = hand[1] - 8;
    scene.raw(
      layer,
      `<rect x="${f(x - 11)}" y="${f(y)}" width="22" height="62" rx="9" fill="${far ? '#8cc6e6' : C.bottle}" stroke="${C.line}" stroke-width="3.5"/><rect x="${f(x - 6)}" y="${f(y - 9)}" width="12" height="11" rx="3" fill="${C.frame}" stroke="${C.line}" stroke-width="3"/>`,
    );
    scene.box.push([x - 13, y - 10], [x + 13, y + 64]);
  },
  /** Motion or effort cue. */
  arrow(scene, from, to, curve = 0) {
    const mid = add(add(from, sub(to, from), 0.5), unit(rot(sub(to, from), 90)), curve);
    const dirEnd = unit(sub(to, mid)),
      wing = 13;
    const h1 = add(to, rot(dirEnd, 150), wing),
      h2 = add(to, rot(dirEnd, -150), wing);
    const d = `M${pt(from)}Q${pt(mid)} ${pt(to)}M${pt(h1)}L${pt(to)}L${pt(h2)}`;
    scene.raw(
      'front',
      `<path d="${d}" fill="none" stroke="#ffffff" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/><path d="${d}" fill="none" stroke="${C.accent}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
  },
};

/** Fit the scene on the 512 canvas with a floor shadow, in the shared flat style. */
export function render(scene, { maxScale = 1.25, shadow = true } = {}) {
  const xs = scene.box.map(p => p[0]),
    ys = scene.box.map(p => p[1]);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    ground = scene.ground ?? Math.max(...ys);
  const w = maxX - minX,
    h = ground - minY;
  const k = Math.min(maxScale, 452 / w, 418 / h);
  const tx = SIZE / 2 - (minX + w / 2) * k,
    ty = GROUND - ground * k;
  const shadowRx = Math.min(236, ((scene.shadowWidth ?? w) * k) / 2 + 26);
  const sx = SIZE / 2 + ((scene.shadowCenter ?? minX + w / 2) - (minX + w / 2)) * k;
  const layers = ['back', 'far', 'body', 'near', 'front'].map(name => scene.layers[name].join('')).join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">` +
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.bgTop}"/><stop offset="1" stop-color="${C.bgBottom}"/></linearGradient><clipPath id="c"><rect width="${SIZE}" height="${SIZE}"/></clipPath></defs>` +
    `<rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>` +
    (shadow ? `<ellipse cx="${f(sx)}" cy="${GROUND + 2}" rx="${f(shadowRx)}" ry="22" fill="${C.shadow}"/>` : '') +
    `<g clip-path="url(#c)"><g transform="translate(${f(tx)} ${f(ty)}) scale(${Math.round(k * 1000) / 1000})" fill="none">${layers}</g></g></svg>`
  );
}
export { L, C };
