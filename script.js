/* ============================================================
   SLANDS — script.js
   ============================================================ */

'use strict';

/* ============================================================
   0. HERO WEBGL SHADER BACKGROUND
   ============================================================ */
function initHeroShader() {
  const canvas = document.getElementById('mission-shader-canvas');
  if (!canvas) return;

  const gl = canvas.getContext('webgl2');
  if (!gl) { canvas.style.display = 'none'; return; }

  const vertSrc = `#version 300 es
precision highp float;
in vec4 position;
void main(){gl_Position=position;}`;

  const fragSrc = `#version 300 es
precision highp float;
out vec4 O;
uniform vec2 resolution;
uniform float time;
uniform vec2 touch;
uniform vec2 move;
#define FC gl_FragCoord.xy
#define T time
#define R resolution
#define MN min(R.x,R.y)
float rnd(vec2 p){
  p=fract(p*vec2(12.9898,78.233));
  p+=dot(p,p+34.56);
  return fract(p.x*p.y);
}
float noise(in vec2 p){
  vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);
  float a=rnd(i),b=rnd(i+vec2(1,0)),c=rnd(i+vec2(0,1)),d=rnd(i+1.);
  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}
float fbm(vec2 p){
  float t=.0,a=1.;mat2 m=mat2(1.,-.5,.2,1.2);
  for(int i=0;i<5;i++){t+=a*noise(p);p*=2.*m;a*=.5;}
  return t;
}
float clouds(vec2 p){
  float d=1.,t=.0;
  for(float i=.0;i<3.;i++){
    float a=d*fbm(i*10.+p.x*.2+.2*(1.+i)*p.y+d+i*i+p);
    t=mix(t,d,a);d=a;p*=2./(i+1.);
  }
  return t;
}
void main(void){
  vec2 uv=(FC-.5*R)/MN,st=uv*vec2(2,1);
  vec3 col=vec3(0);
  float bg=clouds(vec2(st.x+T*.5,-st.y));
  uv*=1.-.3*(sin(T*.2)*.5+.5);
  for(float i=1.;i<12.;i++){
    uv+=.1*cos(i*vec2(.1+.01*i,.8)+i*i+T*.5+.1*uv.x);
    vec2 p=uv;
    float d=length(p);
    col+=.00125/d*(cos(sin(i)*vec3(1,2,3))+1.);
    float b=noise(i+p+bg*1.731);
    col+=.002*b/length(max(p,vec2(b*p.x*.02,p.y)));
    col=mix(col,vec3(bg*.25,bg*.137,bg*.05),d);
  }
  O=vec4(col,1);
}`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  const vs = compile(gl.VERTEX_SHADER,   vertSrc);
  const fs = compile(gl.FRAGMENT_SHADER, fragSrc);
  if (!vs || !fs) { canvas.style.display = 'none'; return; }

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Shader link error:', gl.getProgramInfoLog(program));
    canvas.style.display = 'none';
    return;
  }

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,1,-1,-1,1,1,1,-1]), gl.STATIC_DRAW);

  const posLoc      = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const resLoc   = gl.getUniformLocation(program, 'resolution');
  const timeLoc  = gl.getUniformLocation(program, 'time');
  const touchLoc = gl.getUniformLocation(program, 'touch');
  const moveLoc  = gl.getUniformLocation(program, 'move');

  let dpr = Math.max(1, 0.5 * window.devicePixelRatio);
  let mouseX = 0, mouseY = 0, moveX = 0, moveY = 0;

  function resize() {
    dpr = Math.max(1, 0.5 * window.devicePixelRatio);
    const w = canvas.offsetWidth  || window.innerWidth;
    const h = canvas.offsetHeight || window.innerHeight;
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  const vrFrame = document.getElementById('vr-frame');
  if (vrFrame) {
    vrFrame.addEventListener('mousemove', (e) => {
      mouseX  = e.clientX * dpr;
      mouseY  = (window.innerHeight - e.clientY) * dpr;
      moveX  += e.movementX;
      moveY  += e.movementY;
    }, { passive: true });
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });

  function loop(now) {
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.uniform2f(resLoc,   canvas.width, canvas.height);
    gl.uniform1f(timeLoc,  now * 1e-3);
    gl.uniform2f(touchLoc, mouseX, mouseY);
    gl.uniform2f(moveLoc,  moveX, moveY);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    moveX = 0;
    moveY = 0;
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}


/* ============================================================
   1. BACKGROUND PARTICLE CANVAS (fixed, behind everything)
   ============================================================ */
(function initBgCanvas() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const particles = [];
  const COUNT = 90;

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function createParticle() {
    return {
      x:    Math.random() * canvas.width,
      y:    Math.random() * canvas.height,
      vx:   (Math.random() - 0.5) * 0.25,
      vy:   (Math.random() - 0.5) * 0.25,
      size: Math.random() * 1.5 + 0.4,
      alpha: Math.random() * 0.12 + 0.03
    };
  }

  resize();
  for (let i = 0; i < COUNT; i++) particles.push(createParticle());
  window.addEventListener('resize', resize, { passive: true });

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${p.alpha})`;
      ctx.fill();
    }
    requestAnimationFrame(tick);
  }
  tick();
})();


/* ============================================================
   2. HERO SCROLL EXPANSION
   ============================================================ */
function initHeroExpand() {
  const scrollArea    = document.querySelector('.hero-scroll-area');
  const frame         = document.getElementById('hero-expand-frame');
  const splitL        = document.getElementById('hero-split-l');
  const splitR        = document.getElementById('hero-split-r');
  const hint          = document.getElementById('hero-scroll-hint');
  const dark          = document.getElementById('hero-expand-dark');
  const readOverlay   = document.getElementById('hero-read-overlay');
  const heroSticky    = document.getElementById('hero-sticky');

  if (!scrollArea || !frame) return;

  // Set initial frame size
  function getStart() {
    const mobile = window.innerWidth < 600;
    return { w: mobile ? 240 : 310, h: mobile ? 170 : 220 };
  }

  let start = getStart();
  frame.style.width  = start.w + 'px';
  frame.style.height = start.h + 'px';
  frame.style.borderRadius = '16px';

  function update() {
    const rect     = scrollArea.getBoundingClientRect();
    const scrolled = -rect.top;

    if (scrolled <= 0) {
      // Reset to start state
      start = getStart();
      frame.style.width        = start.w + 'px';
      frame.style.height       = start.h + 'px';
      frame.style.borderRadius = '1px';
      if (hint)        hint.style.opacity        = '1';
      if (readOverlay) readOverlay.style.opacity  = '0';
      if (splitL) { splitL.style.opacity = '0'; splitL.style.transform = ''; }
      if (splitR) { splitR.style.opacity = '0'; splitR.style.transform = ''; }
      if (heroSticky)  heroSticky.classList.remove('hero-text-revealed');
      return;
    }

    const maxScroll = scrollArea.offsetHeight - window.innerHeight;
    const p         = Math.min(scrolled / maxScroll, 1);

    // Expand frame
    const w = start.w + (window.innerWidth  - start.w) * p;
    const h = start.h + (window.innerHeight - start.h) * p;
    frame.style.width        = w + 'px';
    frame.style.height       = h + 'px';
    frame.style.borderRadius = Math.max(0, 16 * (1 - p)) + 'px';

    // Fade hints/overlays
    if (hint)        hint.style.opacity        = Math.max(0, 1 - p * 6) + '';
    if (dark)        dark.style.opacity        = Math.max(0, 0.45 - p * 0.42) + '';
    if (readOverlay) readOverlay.style.opacity  = Math.min(p * 2, 1) + '';

    // Split text slides outward
    const mobile = window.innerWidth < 600;
    const dist   = p * (mobile ? 22 : 38);
    if (splitL) {
      splitL.style.opacity   = Math.min(1, p * 4) + '';
      splitL.style.transform = `translateX(-${dist}vw)`;
    }
    if (splitR) {
      splitR.style.opacity   = Math.min(1, p * 4) + '';
      splitR.style.transform = `translateX(${dist}vw)`;
    }

    // Reveal text pills once expansion is complete
    if (heroSticky) heroSticky.classList.toggle('hero-text-revealed', p >= 0.98);
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', () => { start = getStart(); update(); }, { passive: true });
  update();
}


/* ============================================================
   3. GOOEY TEXT MORPHING (mission section)
   ============================================================ */
(function initGooeyText() {
  const spanA = document.getElementById('gooey-a');
  const spanB = document.getElementById('gooey-b');
  if (!spanA || !spanB) return;

  const phrases = [
    'SOMEONE GOOGLED LAST NIGHT',
    'YOUR COMPETITOR SHOWED UP',
    'YOU DIDN\'T',
    'THAT CUSTOMER IS GONE',
    'THIS IS FIXABLE'
  ];

  const MORPH_TIME = 1.6;
  const COOLDOWN   = 3.2;

  let textIndex = 0;
  let time      = performance.now();
  let morph     = 0;
  let cooldown  = COOLDOWN;
  let animId    = null;

  spanA.textContent = phrases[0];
  spanB.textContent = phrases[1];

  function setMorph(fraction) {
    const blurA = Math.min(8 / (1 - fraction + 0.001) - 8, 100);
    const blurB = Math.min(8 / (fraction     + 0.001) - 8, 100);
    spanA.style.filter  = `blur(${blurA}px)`;
    spanA.style.opacity = Math.pow(1 - fraction, 0.4);
    spanB.style.filter  = `blur(${blurB}px)`;
    spanB.style.opacity = Math.pow(fraction, 0.4);
  }

  function doCooldown() {
    morph = 0;
    spanA.style.filter  = 'none';
    spanA.style.opacity = '0';
    spanB.style.filter  = 'none';
    spanB.style.opacity = '1';
  }

  function animate(now) {
    animId = requestAnimationFrame(animate);
    const dt = (now - time) / 1000;
    time = now;
    cooldown -= dt;
    if (cooldown > 0) { doCooldown(); return; }
    morph += -cooldown;
    cooldown = 0;
    let fraction = morph / MORPH_TIME;
    if (fraction >= 1) {
      fraction  = 1;
      cooldown  = COOLDOWN;
      textIndex = (textIndex + 1) % phrases.length;
      spanA.textContent = phrases[textIndex];
      spanB.textContent = phrases[(textIndex + 1) % phrases.length];
      morph = 0;
    }
    setMorph(fraction);
  }

  const section = document.getElementById('mission');
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        if (!animId) { time = performance.now(); animId = requestAnimationFrame(animate); }
      } else {
        if (animId) { cancelAnimationFrame(animId); animId = null; }
      }
    }
  }, { threshold: 0.1 });
  if (section) io.observe(section);
})();


/* ============================================================
   4. PARTICLE TEXT EFFECT CLASS
      Used on #how, #mission, and #about section canvases.
   ============================================================ */
class ParticleTextEffect {
  constructor(canvas, words, options = {}) {
    this.canvas    = canvas;
    this.ctx       = canvas.getContext('2d');
    this.words     = words;
    this.color     = options.color    || '#FF3B30';
    this.fontSize  = options.fontSize || 130;
    this.step      = options.step     || 7;
    this.speed     = options.speed    || 3.5;
    this.particles = [];
    this.wordIdx   = 0;
    this.frame     = 0;
    this.animId    = null;
  }

  _sampleWord(word) {
    const off = document.createElement('canvas');
    off.width  = this.canvas.width;
    off.height = this.canvas.height;
    const c = off.getContext('2d');
    c.fillStyle = '#fff';
    c.font = `900 ${this.fontSize}px Inter, sans-serif`;
    c.textAlign    = 'center';
    c.textBaseline = 'middle';
    c.fillText(word, off.width / 2, off.height / 2);
    const data = c.getImageData(0, 0, off.width, off.height).data;
    const pts  = [];
    const s    = this.step;
    for (let y = 0; y < off.height; y += s) {
      for (let x = 0; x < off.width; x += s) {
        if (data[(y * off.width + x) * 4 + 3] > 128) pts.push({ x, y });
      }
    }
    for (let i = pts.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [pts[i], pts[j]] = [pts[j], pts[i]];
    }
    return pts;
  }

  setWord(word) {
    const pts = this._sampleWord(word);
    let i = 0;
    for (; i < pts.length; i++) {
      if (i < this.particles.length) {
        const p = this.particles[i];
        p.tx = pts[i].x; p.ty = pts[i].y; p.dead = false;
      } else {
        this.particles.push({
          x: Math.random() * this.canvas.width,
          y: Math.random() * this.canvas.height,
          vx: 0, vy: 0,
          tx: pts[i].x, ty: pts[i].y,
          spd: Math.random() * this.speed + 1.5,
          size: Math.random() * 3.5 + 1.5,
          dead: false
        });
      }
    }
    for (; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.dead = true;
      p.tx = (Math.random() - 0.5) * this.canvas.width  * 1.8 + this.canvas.width  / 2;
      p.ty = (Math.random() - 0.5) * this.canvas.height * 1.8 + this.canvas.height / 2;
    }
  }

  _update() {
    const r = [];
    for (const p of this.particles) {
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const d  = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const f  = Math.min(p.spd * 0.08, d);
      p.vx = p.vx * 0.85 + (dx / d) * f;
      p.vy = p.vy * 0.85 + (dy / d) * f;
      p.x += p.vx; p.y += p.vy;
      if (!p.dead || d > 4) r.push(p);
    }
    this.particles = r;
  }

  _draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const p of this.particles) {
      this.ctx.globalAlpha = p.dead ? 0.2 : 0.5;
      this.ctx.fillStyle   = this.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1;
  }

  _loop() {
    this.frame++;
    if (this.frame % 220 === 0) {
      this.wordIdx = (this.wordIdx + 1) % this.words.length;
      this.setWord(this.words[this.wordIdx]);
    }
    this._update();
    this._draw();
    this.animId = requestAnimationFrame(() => this._loop());
  }

  start() {
    if (this.animId) return;
    this.canvas.width  = this.canvas.offsetWidth  || 800;
    this.canvas.height = this.canvas.offsetHeight || 400;
    this.setWord(this.words[0]);
    this._loop();
  }

  stop() {
    if (this.animId) { cancelAnimationFrame(this.animId); this.animId = null; }
  }

  resize() {
    this.canvas.width  = this.canvas.offsetWidth  || 800;
    this.canvas.height = this.canvas.offsetHeight || 400;
    this.setWord(this.words[this.wordIdx]);
  }
}

function initParticleCanvases() {
  // #how — red particles cycling process words
  const howCanvas = document.getElementById('how-canvas');
  if (howCanvas) {
    const howFx = new ParticleTextEffect(howCanvas,
      ['BUILD', 'AUTOMATE', 'GROW', 'SCALE', 'LAUNCH'],
      { color: '#FF3B30', fontSize: 140, step: 7, speed: 3 }
    );
    const howIO = new IntersectionObserver((entries) => {
      for (const e of entries)
        e.isIntersecting ? howFx.start() : howFx.stop();
    }, { threshold: 0.1 });
    const howSection = document.getElementById('how');
    if (howSection) howIO.observe(howSection);
    window.addEventListener('resize', () => howFx.resize(), { passive: true });
  }

  // #mission — subtle white particles
  const missionCanvas = document.getElementById('mission-canvas');
  if (missionCanvas) {
    const missFx = new ParticleTextEffect(missionCanvas,
      ['REVENUE', 'LEADS', 'CUSTOMERS', 'TIME', 'GROWTH'],
      { color: '#FFFFFF', fontSize: 140, step: 9, speed: 2.5 }
    );
    missionCanvas.style.opacity = '0.18';
    const missIO = new IntersectionObserver((entries) => {
      for (const e of entries)
        e.isIntersecting ? missFx.start() : missFx.stop();
    }, { threshold: 0.1 });
    const missSection = document.getElementById('mission');
    if (missSection) missIO.observe(missSection);
    window.addEventListener('resize', () => missFx.resize(), { passive: true });
  }

  // #about — red particles, tech words
  const aboutCanvas = document.getElementById('about-canvas');
  if (aboutCanvas) {
    const aboutFx = new ParticleTextEffect(aboutCanvas,
      ['TECH', 'AI', 'CODE', 'BUILD', 'LEARN', 'GROW'],
      { color: '#FF3B30', fontSize: 120, step: 8, speed: 3 }
    );
    aboutCanvas.style.opacity = '0.14';
    const aboutIO = new IntersectionObserver((entries) => {
      for (const e of entries)
        e.isIntersecting ? aboutFx.start() : aboutFx.stop();
    }, { threshold: 0.1 });
    const aboutSection = document.getElementById('about');
    if (aboutSection) aboutIO.observe(aboutSection);
    window.addEventListener('resize', () => aboutFx.resize(), { passive: true });
  }
}


/* ============================================================
   5. VIDEO REVEAL — scroll-scale section
   ============================================================ */
function initVideoReveal() {
  const scrollArea = document.querySelector('.vr-scroll-area');
  const frame      = document.getElementById('vr-frame');
  const hint       = document.getElementById('vr-hint');
  if (!scrollArea || !frame) return;

  const START_SCALE = 0.22;

  function update() {
    const rect     = scrollArea.getBoundingClientRect();
    const scrolled = -rect.top;
    if (scrolled < 0) {
      frame.style.width        = window.innerWidth  + 'px';
      frame.style.height       = window.innerHeight + 'px';
      frame.style.transform    = `scale(${START_SCALE})`;
      frame.style.borderRadius = '20px';
      frame.style.boxShadow    = '0 30px 100px rgba(0,0,0,0.8)';
      if (hint) hint.style.opacity = '1';
      return;
    }
    const maxScroll = scrollArea.offsetHeight - window.innerHeight;
    const p = Math.min(scrolled / maxScroll, 1);
    const scale = START_SCALE + (1 - START_SCALE) * p;

    frame.style.width        = window.innerWidth  + 'px';
    frame.style.height       = window.innerHeight + 'px';
    frame.style.transform    = `scale(${scale})`;
    frame.style.borderRadius = Math.max(0, 20 * (1 - p)) + 'px';
    // Fade shadow out as frame fills the screen
    const shadowAlpha = (1 - p) * 0.8;
    frame.style.boxShadow = `0 30px 100px rgba(0,0,0,${shadowAlpha})`;

    if (hint) hint.style.opacity = Math.max(0, 1 - p * 5) + '';
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  update();
}


/* ============================================================
   6. PROCESS TRANSITION (fullscreen FX between §5 and §6)
   ============================================================ */
function initProcessTransition() {
  const section = document.getElementById('process-transition');
  if (!section) return;

  const SLIDES     = 4;
  const bgs        = section.querySelectorAll('.pft-bg');
  const panels     = section.querySelectorAll('.pft-section');
  const slides     = section.querySelectorAll('.pft-slide');
  const trackL     = document.getElementById('pft-track-l');
  const trackR     = document.getElementById('pft-track-r');
  const labelsL    = trackL  ? trackL.querySelectorAll('.pft-label')  : [];
  const labelsR    = trackR  ? trackR.querySelectorAll('.pft-label')  : [];
  const barFill    = document.getElementById('pft-bar-fill');
  const numCur     = document.getElementById('pft-num-cur');
  const scrollCue  = document.getElementById('pft-scroll-cue');

  // Label row height (px) — keep in sync with CSS
  const LABEL_H = 48;

  let currentIdx = -1;

  function activateSlide(idx) {
    if (idx === currentIdx || idx < 0 || idx >= SLIDES) return;
    const prev = currentIdx;
    currentIdx = idx;

    // Backgrounds
    bgs.forEach((bg, i) => bg.classList.toggle('active', i === idx));

    // Content panels
    panels.forEach((p, i) => p.classList.toggle('active', i === idx));

    // Slide titles — out → leaving, in → active
    slides.forEach((s, i) => {
      if (i === prev) {
        s.classList.remove('active');
        s.classList.add('leaving');
        setTimeout(() => s.classList.remove('leaving'), 650);
      } else if (i === idx) {
        s.classList.add('active');
        s.classList.remove('leaving');
      } else {
        s.classList.remove('active', 'leaving');
      }
    });

    // Scroll label tracks
    const offset = -idx * LABEL_H;
    if (trackL) trackL.style.transform = `translateY(${offset}px)`;
    if (trackR) trackR.style.transform = `translateY(${offset}px)`;

    labelsL.forEach((l, i) => l.classList.toggle('active', i === idx));
    labelsR.forEach((l, i) => l.classList.toggle('active', i === idx));

    // Progress bar + number
    if (barFill) barFill.style.width = `${(idx / (SLIDES - 1)) * 100}%`;
    if (numCur)  numCur.textContent  = String(idx + 1).padStart(2, '0');
  }

  function update() {
    const rect     = section.getBoundingClientRect();
    const scrolled = -rect.top;
    if (scrolled < 0) {
      activateSlide(0);
      if (scrollCue) scrollCue.style.opacity = '1';
      return;
    }
    const totalScroll = section.offsetHeight - window.innerHeight;
    const p           = Math.min(scrolled / totalScroll, 1);
    const targetIdx   = Math.min(SLIDES - 1, Math.floor(p * SLIDES));
    activateSlide(targetIdx);

    // Fade scroll cue once past first segment
    if (scrollCue) scrollCue.style.opacity = p < 0.05 ? '1' : '0';
  }

  // Initialize first slide
  activateSlide(0);
  window.addEventListener('scroll', update, { passive: true });
}


/* ============================================================
   7. NAVIGATION — scroll effect + mobile menu
   ============================================================ */
function initNav() {
  const nav        = document.getElementById('nav');
  const hamburger  = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  if (!nav) return;

  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      const open = hamburger.classList.toggle('open');
      mobileMenu.classList.toggle('open', open);
      hamburger.setAttribute('aria-expanded', open);
      mobileMenu.setAttribute('aria-hidden', !open);
    });
    mobileMenu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        hamburger.classList.remove('open');
        mobileMenu.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        mobileMenu.setAttribute('aria-hidden', 'true');
      });
    });
  }
}


/* ============================================================
   8. SCROLL ANIMATIONS (IntersectionObserver)
   ============================================================ */
function initScrollAnimations() {
  const targets = document.querySelectorAll(
    '.anim-slide-left, .anim-slide-right, .anim-rise, ' +
    '.anim-zoom, .anim-pop, .anim-slide-up'
  );

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const el    = entry.target;
        const delay = el.dataset.delay || 0;
        el.style.transitionDelay = `${delay}ms`;
        el.classList.add('in-view');
        io.unobserve(el);
      }
    }
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  targets.forEach(el => io.observe(el));
}


/* ============================================================
   9. VIDEO CARDS — 5 cards, 3+2 layout
   ============================================================ */
const VIDEO_DATA = [
  {
    youtubeId: '2oSh0nDmBIM',
    thumb: 'img/AH.jpg',
    person: 'Alex Hormozi',
    role: 'Owner of 30+ companies · $200M+ annually',
    animClass: 'anim-slide-left',
    delay: 0
  },
  {
    youtubeId: '9LuEH6encVo',
    thumb: 'img/BN.jpg',
    person: 'Brent Franklin',
    role: 'Entrepreneur, investor & CEO · Former military police · $10M+ per year',
    animClass: 'anim-rise',
    delay: 150
  },
  {
    youtubeId: 'jFjggep6n90',
    thumb: 'img/GdB.jpg',
    person: 'Gavin de Becker',
    role: 'Owner of GDBA · Net worth est. hundreds of millions',
    animClass: 'anim-slide-right',
    delay: 300
  },
  // {
  //   youtubeId: 'reUZRyXxUs4',
  //   thumb: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=800&q=80',
  //   person: 'Sam Altman',
  //   role: 'CEO of OpenAI · AI pioneer',
  //   animClass: 'anim-slide-left',
  //   delay: 100
  // },
  // {
  //   youtubeId: 'lFfEA5qLdqI',
  //   thumb: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=800&q=80',
  //   person: 'Elon Musk',
  //   role: 'CEO of Tesla & SpaceX · Tech visionary',
  //   animClass: 'anim-slide-right',
  //   delay: 250
  // }
];

function buildVideoCards() {
  const grid = document.getElementById('video-grid');
  if (!grid) return;

  VIDEO_DATA.forEach((v) => {
    const card = document.createElement('div');
    card.className   = `video-card ${v.animClass}`;
    card.dataset.delay = v.delay;
    card.dataset.ytid  = v.youtubeId;
    card.dataset.state = 'idle';

    card.innerHTML = `
      <div class="video-thumb-wrap">
        <img src="${v.thumb}" alt="${v.person}" loading="lazy" class="video-thumb">
        <div class="video-play-btn" aria-hidden="true">▶</div>
        <div class="video-overlay">
          <div class="video-person">
            <h4>${v.person}</h4>
            <p>${v.role}</p>
          </div>
          <p class="video-hint">Click to play</p>
        </div>
      </div>
    `;

    const isTouch = () => window.matchMedia('(hover: none)').matches;

    card.addEventListener('click', () => {
      const state = card.dataset.state;
      if (!isTouch()) {
        playVideo(card, v.youtubeId);
      } else {
        if (state === 'idle') {
          card.classList.add('tapped');
          card.dataset.state = 'info';
          card.querySelector('.video-hint').textContent = 'Tap again to play';
        } else if (state === 'info') {
          playVideo(card, v.youtubeId);
        }
      }
    });

    grid.appendChild(card);
  });

  // Wire scroll animations for newly created cards
  document.querySelectorAll('.video-card').forEach(el => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          el.style.transitionDelay = `${el.dataset.delay || 0}ms`;
          el.classList.add('in-view');
          io.unobserve(el);
        }
      }
    }, { threshold: 0.2 });
    io.observe(el);
  });
}

const SHORTS_IDS = new Set(['9LuEH6encVo', 'jFjggep6n90']);

function playVideo(card, ytId) {
  card.dataset.state = 'playing';

  if (SHORTS_IDS.has(ytId)) {
    openShortOverlay(ytId);
    return;
  }

  const wrap = card.querySelector('.video-thumb-wrap');
  wrap.innerHTML = `
    <iframe
      class="video-iframe"
      src="https://www.youtube.com/embed/${ytId}?autoplay=1&controls=0&rel=0&modestbranding=1&playsinline=1"
      allow="autoplay; encrypted-media; picture-in-picture"
      allowfullscreen
      title="Video">
    </iframe>`;
}

function openShortOverlay(ytId) {
  const overlay = document.createElement('div');
  overlay.className = 'short-overlay';
  overlay.innerHTML = `
    <div class="short-container">
      <button class="short-close" aria-label="Close">✕</button>
      <iframe
        class="short-iframe"
        src="https://www.youtube.com/embed/${ytId}?autoplay=1&controls=0&rel=0&modestbranding=1&playsinline=1"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowfullscreen
        title="Short">
      </iframe>
    </div>`;

  document.body.appendChild(overlay);

  requestAnimationFrame(() => overlay.classList.add('visible'));

  function close() {
    overlay.classList.remove('visible');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector('.short-close').addEventListener('click', close);

  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
  });
}


/* ============================================================
   10. FAQ ACCORDION
   ============================================================ */
function initFAQ() {
  document.querySelectorAll('.faq-q').forEach(btn => {
    btn.addEventListener('click', () => {
      const answer   = btn.nextElementSibling;
      const expanded = btn.getAttribute('aria-expanded') === 'true';

      // Close all others
      document.querySelectorAll('.faq-q').forEach(b => {
        if (b !== btn) {
          b.setAttribute('aria-expanded', 'false');
          const a = b.nextElementSibling;
          if (a) {
            a.style.maxHeight = '0';
            a.style.paddingBottom = '0';
            setTimeout(() => { if (a.style.maxHeight === '0px') a.hidden = true; }, 320);
          }
        }
      });

      if (!expanded) {
        btn.setAttribute('aria-expanded', 'true');
        answer.hidden = false;
        requestAnimationFrame(() => {
          answer.style.maxHeight = answer.scrollHeight + 'px';
          answer.style.paddingBottom = '1.5rem';
        });
      } else {
        btn.setAttribute('aria-expanded', 'false');
        answer.style.maxHeight = '0';
        answer.style.paddingBottom = '0';
        setTimeout(() => { answer.hidden = true; }, 320);
      }
    });
  });

  document.querySelectorAll('.faq-a').forEach(a => {
    a.style.overflow      = 'hidden';
    a.style.maxHeight     = '0';
    a.style.paddingBottom = '0';
    a.style.transition    = 'max-height 0.32s ease, padding-bottom 0.32s ease';
  });
}


/* ============================================================
   11. CONTACT FORM
   ============================================================ */
function initContactForm() {
  const form   = document.getElementById('contact-form');
  const status = document.getElementById('form-status');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn   = form.querySelector('.btn-submit');
    const name  = form.name.value.trim();
    const email = form.email.value.trim();

    if (!name || !email) {
      setStatus('error', 'Please fill in your name and email.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus('error', 'Please enter a valid email address.');
      return;
    }

    btn.textContent = 'Sending…';
    btn.disabled    = true;

    await new Promise(r => setTimeout(r, 1200));

    setStatus('success', "We got it! We'll be in touch within 24 hours.");
    form.reset();
    btn.textContent = 'Let\'s Talk →';
    btn.disabled    = false;
  });

  function setStatus(type, msg) {
    status.textContent = msg;
    status.className   = `form-status ${type}`;
  }
}


/* ============================================================
   12. HERO SPOTLIGHT (mouse-follow glow)
   ============================================================ */
function initHeroSpotlight() {
  const stickyEl  = document.getElementById('hero-sticky');
  const spotlight = document.getElementById('hero-spotlight');
  if (!stickyEl || !spotlight) return;

  stickyEl.addEventListener('mousemove', (e) => {
    const r = stickyEl.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    spotlight.style.background =
      `radial-gradient(700px circle at ${x}px ${y}px, rgba(255,59,48,0.07), transparent 65%)`;
  });
  stickyEl.addEventListener('mouseleave', () => {
    spotlight.style.background = 'none';
  });
}


/* ============================================================
   13. INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initHeroShader();
  initNav();
  initHeroExpand();
  initVideoReveal();
  buildVideoCards();
  initScrollAnimations();
  initProcessTransition();
  initFAQ();
  initContactForm();
  initHeroSpotlight();
  initParticleCanvases();

  // Smooth-scroll for anchor links (skip the hero scroll area)
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      const offset = 68; // nav height
      const top    = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
});
