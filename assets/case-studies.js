/* Case Studies interactive graphics */
(function(){
  document.querySelectorAll('.gw').forEach(function(w){
    var tabs=w.querySelectorAll('[data-gw-prompt]'), fills=w.querySelectorAll('.gw-fill'), vals=w.querySelectorAll('.gw-val');
    tabs.forEach(function(t){t.addEventListener('click',function(){
      tabs.forEach(function(x){x.setAttribute('aria-pressed',x===t?'true':'false');});
      t.getAttribute('data-gw-prompt').split(',').forEach(function(v,i){fills[i].style.width=v+'%';vals[i].textContent=v+'%';});
    });});
    var detail=w.querySelector('.gw-detail'), heads=Array.prototype.map.call(w.querySelectorAll('.gw-m thead th'),function(h){return h.textContent;});
    var dots=w.querySelectorAll('.gw-dot');
    dots.forEach(function(d){
      var row=d.closest('tr'), col=Array.prototype.indexOf.call(row.children,d.parentNode);
      var label=row.querySelector('th').textContent+' · '+heads[col];
      d.setAttribute('aria-label',label+(d.classList.contains('no')?': tested, not visible yet':': visible'));
      if(label==='Hoodie designer · AI Overviews') d.setAttribute('aria-pressed','true'); else d.setAttribute('aria-pressed','false');
      d.addEventListener('click',function(){
        dots.forEach(function(x){x.setAttribute('aria-pressed',x===d?'true':'false');});
        detail.innerHTML='';var b=document.createElement('b');b.textContent=label+':';detail.appendChild(b);detail.appendChild(document.createTextNode(' '+d.getAttribute('data-t')));
      });
    });
  });
  document.querySelectorAll('.dw').forEach(function(w){
    var tabs=w.querySelectorAll('[data-dw]');
    tabs.forEach(function(t){t.addEventListener('click',function(){
      tabs.forEach(function(x){var on=x===t;x.setAttribute('aria-pressed',on?'true':'false');document.getElementById(x.getAttribute('data-dw')).hidden=!on;});
    });});
  });
})();
