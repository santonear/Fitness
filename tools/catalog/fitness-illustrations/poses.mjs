// Pose definitions for the Fitness-original exercise illustrations.
// Each entry returns { start, peak } (movement) or { main } (held position) scenes.
// Coordinates are in figure space: hip joint at (0, 0), y grows downward, side figures face +x.
import { Side, Front, props } from './figure.mjs';

const done = (fig, after) => {
  const scene = fig.draw();
  after?.(scene, fig);
  return scene;
};
const legsStand = (p, near = {}, far = {}) => {
  p.leg('far', { h: -2, ...far });
  p.leg('near', { h: 2, ...near });
};
const armsRelaxed = p => {
  p.arm('far', { s: -5, e: 8 });
  p.arm('near', { s: 6, e: 10 });
};
const frontStand = (p, right = {}, left = {}) => {
  p.leg('left', { h: 3, ...left });
  p.leg('right', { h: 3, ...right });
};
const frontArmsDown = p => {
  p.arm('left', { s: 8, e: 4 });
  p.arm('right', { s: 8, e: 4 });
};
const floorOf = p => Math.max(...Object.values(p.feet).map(foot => foot.bottom));

// ---------- standing self-resisted pulls / presses ----------
const selfRow = phase => () => {
  const p = new Side();
  legsStand(p);
  const hand = phase === 'start' ? [70, -66] : [24, -60];
  p.arm('far', { to: [hand[0] - 8, hand[1] + 3] });
  p.arm('near', { to: hand });
  return done(
    p,
    s => phase !== 'start' && props.arrow(s, [hand[0] + 30, hand[1] + 34], [hand[0] - 34, hand[1] + 34], 10),
  );
};
const selfChestPress = phase => () => {
  const p = new Side();
  legsStand(p);
  const hand = phase === 'start' ? [36, -80] : [128, -96];
  p.arm('near', { to: hand, layer: 'far' });
  p.arm('far', { to: phase === 'start' ? [28, -70] : [84, -86], layer: 'near' });
  return done(p, s => phase !== 'start' && props.arrow(s, [70, -140], [140, -140], -8));
};
const antiLeaning = phase => () => {
  const p = new Side();
  legsStand(p);
  const hand = phase === 'start' ? [40, -84] : [86, -88];
  p.arm('far', { to: [hand[0] - 4, hand[1] + 2] });
  p.arm('near', { to: hand });
  return done(p, s => props.arrow(s, [hand[0] - 14, hand[1] - 46], [hand[0] + 36, hand[1] - 46], -6));
};
const overheadFront = phase => () => {
  const p = new Front();
  frontStand(p);
  if (phase === 'start') {
    p.arm('right', { elbow: [62, -70], hand: [60, -136] });
    p.arm('left', { to: [56, -104] });
  } else {
    p.arm('right', { to: [58, -252] });
    p.arm('left', { to: [48, -200] });
  }
  return done(p, s => phase !== 'start' && props.arrow(s, [96, -170], [96, -240], 8));
};
const pulldownFront = phase => () => {
  const p = new Front();
  frontStand(p);
  if (phase === 'start') {
    p.arm('right', { elbow: [74, -172], hand: [84, -236] });
    p.arm('left', { to: [70, -166] });
  } else if (phase === 'peak') {
    p.arm('right', { elbow: [70, -66], hand: [66, -132] });
    p.arm('left', { to: [58, -110] });
  } else {
    p.arm('right', { elbow: [100, -122], hand: [100, -188] });
    p.arm('left', { to: [86, -160] });
  }
  return done(
    p,
    s =>
      phase !== 'start' &&
      props.arrow(s, [126, phase === 'peak' ? -150 : -200], [126, phase === 'peak' ? -80 : -128], -8),
  );
};

// ---------- walking / marching ----------
const stride = (p, { reach = 22, push = -18 } = {}) => {
  p.leg('far', { h: push, k: 14, p: 18 });
  p.leg('near', { h: reach, k: 10, fa: 96 });
};
const march = (lift, swing) => phase => () => {
  const p = new Side();
  if (phase === 'start') {
    legsStand(p);
    armsRelaxed(p);
    return done(p);
  }
  p.leg('far', { h: -2 });
  p.arm('far', { s: swing, e: 22 });
  p.leg('near', lift);
  p.arm('near', { s: -swing * 0.8, e: 14 });
  return done(p);
};

// ---------- wall helpers ----------
const wallInFront = (p, x) => s => props.wall(s, x, floorOf(p), 'right');

export const illustrations = {
  'custom-standing-self-row': () => ({ start: selfRow('start')(), peak: selfRow('peak')() }),
  'custom-standing-self-row-hold': () => ({ main: selfRow('hold')() }),
  'custom-self-resisted-chest-press': () => ({ start: selfChestPress('start')(), peak: selfChestPress('peak')() }),
  'custom-standing-self-antileaning': () => ({ main: antiLeaning('peak')() }),
  'custom-self-resisted-overhead-press': () => ({ start: overheadFront('start')(), peak: overheadFront('peak')() }),
  'custom-self-resisted-pulldown': () => ({ start: pulldownFront('start')(), peak: pulldownFront('peak')() }),
  'custom-self-resisted-pulldown-hold': () => ({ main: pulldownFront('hold')() }),

  'custom-standing-cross-press-brace': () => ({
    main: (() => {
      const p = new Front();
      frontStand(p);
      p.arm('right', { elbow: [70, -66], hand: [8, -74] });
      p.arm('left', { elbow: [-64, -70], hand: [16, -66] });
      return done(p, s => {
        props.arrow(s, [84, -40], [132, -40]);
        props.arrow(s, [-10, -112], [-58, -112]);
      });
    })(),
  }),
  'custom-standing-self-antirotation': () => ({
    main: (() => {
      const p = new Front();
      frontStand(p);
      p.arm('right', { elbow: [58, -60], hand: [8, -68] });
      p.arm('left', { elbow: [-58, -60], hand: [-8, -68] });
      return done(p, s => props.arrow(s, [-40, -112], [48, -112], -10));
    })(),
  }),
  'custom-standing-side-resistance-hold': () => ({
    main: (() => {
      const p = new Front();
      frontStand(p);
      p.arm('left', { s: 8, e: 4 });
      p.arm('right', { elbow: [62, -46], hand: [52, 16] });
      return done(p, s => props.arrow(s, [70, 30], [118, 30]));
    })(),
  }),

  'custom-kneeling-knuckle-push-up': () => {
    const pose = beta => {
      const p = new Side({ t: 90 - beta, head: -6 });
      const knee = [-96 * Math.cos((beta * Math.PI) / 180), 96 * Math.sin((beta * Math.PI) / 180)];
      const ground = knee[1] + 18;
      for (const side of ['far', 'near']) p.leg(side, { knee, ankle: [knee[0] - 92, ground - 18], fa: -96, sole: -3 });
      const handX = knee[0] + 214 * Math.cos((36 * Math.PI) / 180) + 6;
      p.arm('far', { to: [handX - 6, ground - 11] });
      p.arm('near', { to: [handX, ground - 11] });
      return done(p);
    };
    return { start: pose(36), peak: pose(17) };
  },

  'custom-band-self-anchored-row': () => {
    const pose = phase => {
      const p = new Side({ t: -6 });
      p.leg('far', { h: 87, k: 3 });
      p.leg('near', { h: 88, k: 2 });
      const foot = [p.joints.nearLeg.ankle[0] + 18, p.joints.nearLeg.ankle[1] - 14];
      const hand = phase === 'start' ? [116, -56] : [28, -58];
      return done(p, s => {
        p.arm('far', { to: [hand[0] - 6, hand[1] + 2] });
        props.band(s, 'far', [hand[0] - 6, hand[1] + 2], foot);
        p.arm('near', { to: hand });
        props.band(s, 'near', hand, foot);
        if (phase !== 'start') props.arrow(s, [96, -110], [36, -110], -8);
      });
    };
    return { start: pose('start'), peak: pose('peak') };
  },

  'custom-band-high-pulldown': () => {
    const pose = phase => {
      const p = new Side();
      legsStand(p);
      const hand = phase === 'start' ? [86, -226] : [26, -126];
      return done(p, s => {
        const anchor = [196, -282];
        props.wall(s, 204, floorOf(p), 'right');
        props.anchor(s, 200, anchor[1]);
        p.arm('far', { to: [hand[0] - 6, hand[1] + 2] });
        props.band(s, 'far', [hand[0] - 6, hand[1] + 2], anchor);
        p.arm('near', { to: hand });
        props.band(s, 'near', hand, anchor);
        if (phase !== 'start') props.arrow(s, [86, -214], [86, -144], -8);
      });
    };
    return { start: pose('start'), peak: pose('peak') };
  },

  'custom-backpack-suitcase-walk': () => ({
    main: (() => {
      const p = new Side({ t: 3 });
      stride(p);
      p.arm('far', { s: 18, e: 22 });
      p.arm('near', { s: -2, e: 4, layer: 'front', hold: (s, _layer, hand) => props.backpack(s, 'near', hand) });
      return done(p);
    })(),
  }),
  'custom-bottle-farmer-walk': () => ({
    main: (() => {
      const p = new Side({ t: 2 });
      p.arm('far', { s: -1, e: 4, hold: (s, layer, hand) => props.bottle(s, layer, hand, true) });
      stride(p);
      p.arm('near', { s: 2, e: 4, layer: 'front', hold: (s, _layer, hand) => props.bottle(s, 'near', hand) });
      return done(p);
    })(),
  }),

  'custom-wall-supported-shallow-stepback': () => {
    const pose = phase => {
      const p = new Side({ t: phase === 'start' ? 2 : 6 });
      if (phase === 'start') legsStand(p);
      else {
        p.leg('far', { to: [-96, 150], fa: 38 });
        p.leg('near', { to: [26, 176], fa: 90 });
      }
      p.arm('far', { s: -4, e: 10 });
      p.arm('near', { to: [124, -126] });
      return done(p, wallInFront(p, 134));
    };
    return { start: pose('start'), peak: pose('peak') };
  },
  'custom-shallow-split-squat': () => {
    const pose = phase => {
      const p = new Side({ t: 2 });
      const dy = phase === 'start' ? 0 : 16;
      p.leg('far', { to: [-70, 164 - dy], fa: 38 });
      p.leg('near', { to: [52, 182 - dy], fa: 90 });
      p.arm('far', { s: 4, e: 70 });
      p.arm('near', { s: 4, e: 70 });
      return done(p);
    };
    return { start: pose('start'), peak: pose('peak') };
  },
  'custom-standing-heel-drag-hold': () => ({
    main: (() => {
      const p = new Side({ t: 2 });
      p.leg('far', { to: [-70, 158], fa: 38 });
      p.leg('near', { to: [52, 178], fa: 90 });
      p.arm('far', { s: -4, e: 8 });
      p.arm('near', { s: 4, e: 8 });
      return done(p, s => props.arrow(s, [104, 216], [44, 216], -4));
    })(),
  }),

  'custom-supported-low-step-up': () => {
    const pose = phase => {
      const p = new Side({ t: phase === 'start' ? 10 : 2 });
      let ground;
      if (phase === 'start') {
        p.leg('far', { to: [-26, 178], fa: 90 });
        ground = p.feet.far.bottom;
        p.leg('near', { to: [62, ground - 40 - 18], fa: 90 });
      } else {
        p.leg('far', { h: 14, k: 52, p: 10 });
        p.leg('near', { h: 3, fa: 90 });
        ground = p.feet.near.bottom + 40;
      }
      return done(p, s => {
        const chair = props.chairBack(s, 34, ground, 222);
        props.step(s, 22, 150, ground);
        p.arm('far', { to: [30, chair.top - 2], layer: 'body' });
        p.arm('near', { s: 6, e: 14 });
      });
    };
    return { start: pose('start'), peak: pose('peak') };
  },

  'custom-chair-sit-to-stand': () => {
    const start = (() => {
      const p = new Side({ t: 26 });
      p.leg('far', { to: [72, 98], fa: 90 });
      p.leg('near', { to: [78, 98], fa: 90 });
      p.arm('far', { s: 58, e: 8 });
      p.arm('near', { s: 62, e: 8 });
      return done(p, s => {
        const g = floorOf(p);
        props.wall(s, -112, g, 'left');
        props.chair(s, -82, 16, g);
      });
    })();
    const peak = (() => {
      const p = new Side({ t: 2 });
      legsStand(p);
      armsRelaxed(p);
      return done(p, s => {
        const g = floorOf(p);
        props.wall(s, -176, g, 'left');
        props.chair(s, -152, g - 96, g);
      });
    })();
    return { start, peak };
  },
  'custom-high-wall-sit': () => {
    const pose = phase => {
      const p = new Side();
      if (phase === 'start') {
        p.leg('far', { to: [38, 184], fa: 90 });
        p.leg('near', { to: [42, 184], fa: 90 });
        armsRelaxed(p);
      } else {
        p.leg('far', { to: [62, 158], fa: 90 });
        p.leg('near', { to: [66, 158], fa: 90 });
        p.arm('far', { to: [62, -28] });
        p.arm('near', { to: [70, -26] });
      }
      return done(p, s => props.wall(s, -28, floorOf(p), 'left'));
    };
    return { start: pose('start'), peak: pose('peak') };
  },

  'custom-wall-antirotation-press': () => ({
    main: (() => {
      const p = new Front();
      frontStand(p);
      p.arm('left', { elbow: [-104, -104], hand: [-104, -170] });
      p.arm('right', { s: 8, e: 4 });
      return done(p, s => {
        props.wall(s, -118, floorOf(p), 'left');
        props.arrow(s, [-60, -150], [-104 + 30, -150]);
      });
    })(),
  }),
  'custom-wall-side-brace': () => ({
    main: (() => {
      const p = new Front({ turn: -9 });
      frontStand(p, { h: 2 }, { h: 4 });
      const sh = p.shoulders.left;
      p.arm('left', { elbow: [sh[0] - 70, sh[1] + 10], hand: [sh[0] - 70, sh[1] - 56] });
      p.arm('right', { s: 10, e: 6 });
      return done(p, s => {
        props.wall(s, sh[0] - 82, floorOf(p), 'left');
        props.arrow(s, [sh[0] - 24, sh[1] - 40], [sh[0] - 58, sh[1] - 40]);
      });
    })(),
  }),

  'custom-kneeling-side-bridge': () => {
    // Lying on one side, facing the viewer; the lower forearm and knees carry the body.
    // Shins fold behind the body, so only the knees read from the front.
    const pose = phase => {
      const lift = phase === 'peak';
      const p = new Front({ turn: lift ? -68 : -56 });
      const sl = p.shoulders.left,
        elbow = [sl[0] + 2, sl[1] + 66],
        ground = elbow[1] + 14;
      const hipL = p.hips.left,
        hipR = p.hips.right;
      const kneeY = ground - 20,
        run = Math.sqrt(96 * 96 - (kneeY - hipL[1]) ** 2);
      const kneeL = [hipL[0] + run, kneeY],
        kneeR = [hipR[0] + run + 6, hipR[1] + (kneeY - hipL[1]) - 4];
      p.leg('left', { knee: kneeL, ankle: [kneeL[0] + 4, kneeL[1] - 10], noShoe: true });
      p.leg('right', { knee: kneeR, ankle: [kneeR[0] + 4, kneeR[1] - 10], noShoe: true });
      p.arm('left', { elbow, hand: [elbow[0] + 30, elbow[1] + 4] });
      p.arm('right', { to: [hipR[0] + 6, hipR[1] - 14] });
      return done(p, s => {
        s.ground = ground;
        if (lift) props.arrow(s, [p.hip[0] + 36, p.hip[1] + 4], [p.hip[0] + 36, p.hip[1] - 50], -6);
      });
    };
    return { start: pose('start'), peak: pose('peak') };
  },

  'custom-seated-self-overhead-press': () => {
    const pose = phase => {
      const p = new Side();
      p.leg('far', { h: 86, k: 12 });
      p.leg('near', { h: 84, k: 14 });
      if (phase === 'start') {
        p.arm('far', { to: [40, -96] });
        p.arm('near', { elbow: [34, -60], hand: [48, -124] });
      } else {
        p.arm('far', { to: [14, -196] });
        p.arm('near', { to: [10, -244] });
      }
      return done(p, s => phase !== 'start' && props.arrow(s, [56, -170], [56, -240], -8));
    };
    return { start: pose('start'), peak: pose('peak') };
  },

  'custom-forearm-wall-push': () => {
    // feet stay put; the body leans in toward the wall from a straight line
    const pose = lean => {
      const p = new Side({ t: lean });
      const dir = [-Math.sin((lean * Math.PI) / 180), Math.cos((lean * Math.PI) / 180)];
      const ankle = [dir[0] * 188, dir[1] * 188];
      p.leg('far', { knee: [dir[0] * 96 - 3, dir[1] * 96], ankle: [ankle[0] - 3, ankle[1]], fa: 74 });
      p.leg('near', { knee: [dir[0] * 96, dir[1] * 96], ankle, fa: 74 });
      const wallX = ankle[0] + 196,
        sh = p.shoulder;
      const elbowY = ankle[1] - 288;
      const elbowX = wallX - 12;
      p.arm('far', { elbow: [elbowX - 4, elbowY + 2], hand: [elbowX - 4, elbowY - 62] });
      p.arm('near', { elbow: [elbowX, elbowY], hand: [elbowX, elbowY - 64] });
      return done(p, s => {
        props.wall(s, wallX, floorOf(p), 'right');
        void sh;
      });
    };
    return { start: pose(16), peak: pose(24) };
  },
  'custom-wall-plank': () => ({
    main: (() => {
      const lean = 20,
        p = new Side({ t: lean });
      const dir = [-Math.sin((lean * Math.PI) / 180), Math.cos((lean * Math.PI) / 180)];
      const ankle = [dir[0] * 188, dir[1] * 188];
      p.leg('far', { knee: [dir[0] * 96 - 3, dir[1] * 96], ankle: [ankle[0] - 3, ankle[1]], fa: 74 });
      p.leg('near', { knee: [dir[0] * 96, dir[1] * 96], ankle, fa: 74 });
      const sh = p.shoulder,
        elbow = [sh[0] + 70, sh[1] + 10];
      p.arm('far', { elbow: [elbow[0] - 4, elbow[1] + 2], hand: [elbow[0] - 4, elbow[1] - 62] });
      p.arm('near', { elbow, hand: [elbow[0], elbow[1] - 64] });
      return done(p, s => props.wall(s, elbow[0] + 12, floorOf(p), 'right'));
    })(),
  }),

  'custom-quiet-march': () => ({ start: march({}, 0)('start')(), peak: march({ h: 34, k: 48 }, 20)('peak')() }),
  'custom-slow-walking-in-place': () => ({
    start: march({}, 0)('start')(),
    peak: march({ h: 16, k: 30, p: 12 }, 12)('peak')(),
  }),
  'custom-step-jack': () => {
    const pose = phase => {
      const p = new Front();
      if (phase === 'start') {
        frontStand(p, { h: 1 }, { h: 1 });
        frontArmsDown(p);
      } else {
        p.leg('left', { h: 2 });
        p.leg('right', { h: 22 });
        p.arm('left', { s: 96, e: 8 });
        p.arm('right', { s: 96, e: 8 });
      }
      return done(p);
    };
    return { start: pose('start'), peak: pose('peak') };
  },
  'custom-quiet-shadow-boxing': () => {
    const pose = phase => {
      const p = new Side({ t: 4 });
      p.leg('far', { h: -10, k: 8 });
      p.leg('near', { h: 12, k: 14 });
      p.arm('far', { to: [44, -124] });
      p.arm('near', phase === 'start' ? { to: [54, -128] } : { to: [146, -140] });
      return done(p, s => phase !== 'start' && props.arrow(s, [90, -196], [156, -196], -6));
    };
    return { start: pose('start'), peak: pose('peak') };
  },
  'custom-seated-march': () => {
    const pose = phase => {
      const p = new Side();
      p.leg('far', { to: [88, 94], fa: 90 });
      const ground = p.feet.far.bottom;
      if (phase === 'start') p.leg('near', { to: [94, 94], fa: 90 });
      else p.leg('near', { h: 116, k: 112, fa: 96 });
      return done(p, s => {
        props.chair(s, -52, 14, ground);
        p.arm('far', { to: [16, 14] });
        p.arm('near', { to: [22, 14] });
        if (phase !== 'start') props.arrow(s, [148, 40], [148, -20], -6);
      });
    };
    return { start: pose('start'), peak: pose('peak') };
  },

  'custom-wall-supported-single-leg-stand': () => {
    const pose = phase => {
      const p = new Front();
      p.leg('left', { h: 3 });
      if (phase === 'start') p.leg('right', { h: 3 });
      else {
        const hip = p.hips.right;
        p.leg('right', { knee: [hip[0] + 10, hip[1] + 88], ankle: [hip[0] + 12, hip[1] + 140] });
      }
      p.arm('left', { elbow: [-84, -62], hand: [-112, -112] });
      p.arm('right', { s: 10, e: 6 });
      return done(p, s => props.wall(s, -122, p.feet.left.bottom, 'left'));
    };
    return { start: pose('start'), peak: pose('peak') };
  },
  'custom-supported-tandem-stand': () => ({
    main: (() => {
      const p = new Side();
      p.leg('far', { to: [-12, 188], fa: 90 });
      p.leg('near', { to: [22, 188], fa: 90 });
      p.arm('far', { s: -4, e: 8 });
      p.arm('near', { to: [116, -118] });
      return done(p, wallInFront(p, 126));
    })(),
  }),
  'custom-supported-heel-raise': () => {
    const pose = phase => {
      const p = new Side({ t: 3 });
      if (phase === 'start') legsStand(p, { fa: 90 }, { fa: 90 });
      else {
        p.leg('far', { h: -2, fa: 44 });
        p.leg('near', { h: 2, fa: 44 });
      }
      p.arm('far', { to: [108, -116] });
      p.arm('near', { to: [114, -120] });
      return done(p, s => {
        props.wall(s, 124, floorOf(p), 'right');
        if (phase !== 'start') props.arrow(s, [-30, 190], [-30, 140], 6);
      });
    };
    return { start: pose('start'), peak: pose('peak') };
  },
  'custom-supported-wide-static-stand': () => ({
    main: (() => {
      const p = new Front();
      frontStand(p, { h: 13 }, { h: 13 });
      p.arm('left', { to: [-104, 6] });
      p.arm('right', { s: 8, e: 4 });
      return done(p, s => props.chairBack(s, -108, floorOf(p), 200));
    })(),
  }),

  'custom-slow-bear-step': () => {
    const pose = phase => {
      const p = new Side({ t: 79, head: -20 });
      const ground = 126,
        sh = p.shoulder,
        step = phase === 'start' ? 0 : 30;
      p.leg('far', { knee: [step * 0.6, 96 - (step ? 6 : 0)], ankle: [-82 + step, 98], fa: 20, sole: 4 });
      p.arm('far', { to: [sh[0] - 6, ground - 11] });
      p.leg('near', { knee: [4, 96], ankle: [-80, 100], fa: 20, sole: 4 });
      p.arm('near', { to: [sh[0] + step, ground - 11 - (step ? 0 : 0)] });
      return done(p, s => {
        s.ground = ground;
        if (step) props.arrow(s, [sh[0] + 4, ground - 70], [sh[0] + 46, ground - 70], -6);
      });
    };
    return { start: pose('start'), peak: pose('peak') };
  },
  'custom-forearm-ground-step': () => {
    const pose = phase => {
      const p = new Side({ t: 78, head: -18 });
      const step = phase === 'start' ? 0 : 26,
        sh = p.shoulder,
        ground = sh[1] + 72 + 12;
      const legDir = [-Math.cos((12 * Math.PI) / 180), Math.sin((12 * Math.PI) / 180)];
      const ankle = [legDir[0] * 188, legDir[1] * 188];
      p.leg('far', {
        knee: [legDir[0] * 96 + step * 0.5, legDir[1] * 96 + 2],
        ankle: [ankle[0] + step, ankle[1] + 2],
        fa: 12,
        sole: 4,
      });
      p.arm('far', { elbow: [sh[0] - 4, ground - 12], hand: [sh[0] + 58, ground - 12] });
      p.leg('near', { knee: [legDir[0] * 96, legDir[1] * 96], ankle, fa: 12, sole: 4 });
      p.arm('near', { elbow: [sh[0] + step, ground - 12], hand: [sh[0] + step + 62, ground - 12] });
      return done(p, s => {
        s.ground = ground;
        if (step) props.arrow(s, [sh[0] + 30, ground - 60], [sh[0] + 76, ground - 60], -6);
      });
    };
    return { start: pose('start'), peak: pose('peak') };
  },
  'custom-kneeling-forearm-crawl': () => {
    const pose = phase => {
      const p = new Side({ t: 104, head: -22 });
      const step = phase === 'start' ? 0 : 26,
        sh = p.shoulder,
        ground = 112;
      p.leg('far', { knee: [step * 0.8 - 3, 96], ankle: [step * 0.8 - 96, 96], fa: -96, sole: -3 });
      p.arm('far', { elbow: [sh[0] - 4, ground - 12], hand: [sh[0] + 58, ground - 12] });
      p.leg('near', { knee: [0, 96], ankle: [-94, 96], fa: -96, sole: -3 });
      p.arm('near', { elbow: [sh[0] + step, ground - 12], hand: [sh[0] + step + 62, ground - 12] });
      return done(p, s => {
        s.ground = ground;
        if (step) props.arrow(s, [sh[0] + 30, ground - 66], [sh[0] + 76, ground - 66], -6);
      });
    };
    return { start: pose('start'), peak: pose('peak') };
  },

  'custom-seated-self-resisted-leg-curl': () => ({
    main: (() => {
      const p = new Side({ t: -20 });
      p.arm('far', { to: [-84, 12], bend: -1 });
      p.leg('far', { to: [126, 4], bend: -1, fa: 100 });
      p.leg('near', { to: [104, 6], bend: -1, fa: 100 });
      p.arm('near', { to: [-78, 14], bend: -1 });
      return done(p, s => props.arrow(s, [150, -30], [96, -30], -8));
    })(),
  }),
  'custom-standing-upper-back-stretch': () => ({
    main: (() => {
      const p = new Side({ t: 2, head: 34, round: 12 });
      legsStand(p, { fa: 90 }, { fa: 90 });
      p.arm('far', { to: [126, -116] });
      p.arm('near', { to: [130, -114] });
      return done(p);
    })(),
  }),
};
