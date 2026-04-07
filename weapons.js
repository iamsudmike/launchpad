'use strict';
// id, name, color, dmg, rate(ms), maxAmmo, spd, cnt, spread(rad), explosive, exr(px)
const WEAPONS = [
  { id:0, name:'Pistol',      color:'#FFD700', dmg:10, rate:350,  maxAmmo:Infinity, spd:12, cnt:1, spread:0,    explosive:false, exr:0  },
  { id:1, name:'Shotgun',     color:'#FF8800', dmg:14, rate:700,  maxAmmo:20,       spd:9,  cnt:5, spread:0.22, explosive:false, exr:0  },
  { id:2, name:'Machine Gun', color:'#00DDFF', dmg:6,  rate:85,   maxAmmo:60,       spd:14, cnt:1, spread:0.05, explosive:false, exr:0  },
  { id:3, name:'Rocket',      color:'#FF2200', dmg:60, rate:1200, maxAmmo:5,        spd:7,  cnt:1, spread:0,    explosive:true,  exr:90 },
];
