// src/clientjs.js — served at /site.js on every page
export const SITE_JS = `
(function(){
  /* ---- utility bar: text size (remembered) ---- */
  var small = document.getElementById('sizeSmall');
  var large = document.getElementById('sizeLarge');
  function applySize(mode){
    document.documentElement.style.fontSize = (mode === 'large') ? '18.5px' : '16px';
    if (small && large) {
      small.classList.toggle('on', mode !== 'large');
      large.classList.toggle('on', mode === 'large');
    }
    try { localStorage.setItem('ggb_size', mode); } catch(e){}
  }
  if (small && large) {
    small.addEventListener('click', function(){ applySize('small'); });
    large.addEventListener('click', function(){ applySize('large'); });
  }
  try { if (localStorage.getItem('ggb_size') === 'large') applySize('large'); } catch(e){}

  /* ---- utility bar: language switch (remembered) ---- */
  var langBtns = Array.prototype.slice.call(document.querySelectorAll('[data-setlang]'));
  function applyLang(lang){
    document.body.setAttribute('data-lang', lang);
    langBtns.forEach(function(x){ x.classList.toggle('on', x.dataset.setlang === lang); });
    try { localStorage.setItem('ggb_lang', lang); } catch(e){}
  }
  langBtns.forEach(function(b){
    b.addEventListener('click', function(){ applyLang(b.dataset.setlang); });
  });
  try {
    var saved = localStorage.getItem('ggb_lang');
    if (saved === 'hi') applyLang('hi');
  } catch(e){}

  /* ---- hero slider (home page only) ---- */
  var slides = Array.prototype.slice.call(document.querySelectorAll('.car-panel'));
  var dots = Array.prototype.slice.call(document.querySelectorAll('.car-dots button'));
  var prev = document.querySelector('.car-arrow.prev');
  var next = document.querySelector('.car-arrow.next');
  var carousel = document.querySelector('.carousel');
  if (!carousel || !prev || !next || slides.length < 2) return;

  var current = 0, timer = null;
  var AUTO_MS = 6000;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function show(i){
    current = (i + slides.length) % slides.length;
    slides.forEach(function(s, idx){
      var on = idx === current;
      s.hidden = !on;
      s.classList.toggle('entering', on && !reduced);
    });
    dots.forEach(function(d, idx){ d.classList.toggle('on', idx === current); });
  }
  function step(dir){ show(current + dir); restart(); }
  function restart(){
    if (reduced) return; /* no auto-scroll for reduced motion */
    clearInterval(timer);
    timer = setInterval(function(){ show(current + 1); }, AUTO_MS);
  }

  next.addEventListener('click', function(){ step(1); });
  prev.addEventListener('click', function(){ step(-1); });
  dots.forEach(function(d){
    d.addEventListener('click', function(){ show(+d.dataset.dot); restart(); });
  });

  carousel.addEventListener('mouseenter', function(){ clearInterval(timer); });
  carousel.addEventListener('mouseleave', restart);
  carousel.addEventListener('focusin', function(){ clearInterval(timer); });
  carousel.addEventListener('focusout', restart);

  var startX = null;
  carousel.addEventListener('touchstart', function(e){ startX = e.touches[0].clientX; }, {passive:true});
  carousel.addEventListener('touchend', function(e){
    if (startX === null) return;
    var dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 45) step(dx < 0 ? 1 : -1);
    startX = null;
  }, {passive:true});

  restart();
})();
`;
