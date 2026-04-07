'use strict';
const Input = {
  _k: new Set(),
  _p: new Set(),

  init() {
    window.addEventListener('keydown', e => {
      if (!this._k.has(e.code)) this._p.add(e.code);
      this._k.add(e.code);
      if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))
        e.preventDefault();
    });
    window.addEventListener('keyup', e => this._k.delete(e.code));
  },

  down(c)    { return this._k.has(c); },
  pressed(c) { return this._p.has(c); },
  flush()    { this._p.clear(); },

  left()  { return this._k.has('ArrowLeft')  || this._k.has('KeyA'); },
  right() { return this._k.has('ArrowRight') || this._k.has('KeyD'); },
  jump()  { return this._k.has('ArrowUp')    || this._k.has('KeyW') || this._k.has('Space'); },
  shoot() { return this._k.has('KeyZ') || this._k.has('KeyX') || this._k.has('KeyF'); },

  jumpPressed() {
    return this._p.has('ArrowUp') || this._p.has('KeyW') || this._p.has('Space');
  },
  digit() {
    for (let i = 1; i <= 4; i++)
      if (this._p.has(`Digit${i}`)) return i - 1;
    return -1;
  },
};
