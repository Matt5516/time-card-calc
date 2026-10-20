/* ClockInMath converters: military time and hourly <-> salary. Math lives in calc.js. */
addEventListener('DOMContentLoaded',function(){ 'use strict';
  var $=UI.$||function(i){return document.getElementById(i);}, C=window.TCCalc, m=UI.money;
  function stat(k,v){ return '<div class="stat"><div class="k">'+k+'</div><div class="v">'+v+'</div></div>'; }
  var ACT='<div class="actions no-print"><button type="button" class="btn ghost sm" data-print>'+UI.icon('copy')+'Print / PDF</button><button type="button" class="btn ghost sm" id="copySum">'+UI.icon('copy')+'Copy result</button></div>';
  var last='';
  document.addEventListener('click',function(e){ if(e.target.closest('#copySum')&&last) UI.copy(last,'Copied'); });
  function bad(form){ var n=0; form.querySelectorAll('input[type=number]').forEach(function(el){ var b=el.value!==''&&(+el.value<0||!isFinite(+el.value)); el.setAttribute('aria-invalid',b?'true':'false'); if(b) n++; }); return n; }
  var mt=$('mtForm');
  if(mt){ UI.readState(); UI.segs(render); mt.addEventListener('input',UI.debounce(render,40)); mt.addEventListener('change',render);
    function render(){ var dir=$('dir').value, out=$('mtOut'), min=null, msg='';
      $('g12').hidden=dir!=='to24'; $('g24').hidden=dir!=='to12'; history.replaceState(null,'',UI.stateURL());
      if(dir==='to24'){ var h=Math.round(UI.num('hh')), mi=Math.round(UI.num('mm')), pm=$('ap').value==='pm', ok=h>=1&&h<=12&&mi>=0&&mi<=59;
        $('hh').setAttribute('aria-invalid',h>=1&&h<=12?'false':'true'); $('mm').setAttribute('aria-invalid',mi>=0&&mi<=59?'false':'true');
        if(ok) min=(h%12)*60+(pm?720:0)+mi; else msg='Use an hour from 1 to 12 and minutes from 0 to 59.'; }
      else { min=C.parse24($('t24').value); $('t24').setAttribute('aria-invalid',min==null?'true':'false'); if(min==null) msg='Enter a 24-hour time like 1730, 17:30 or 0905 (00:00 to 23:59).'; }
      if(min==null){ out.innerHTML='<div class="alert err">'+UI.icon('alert')+'<div>'+msg+'</div></div>'; last=''; return; }
      var c12=C.formatClock(min), c24=C.format24(min,true), mil=C.format24(min,false), sp=C.spoken24(min);
      var big=dir==='to24'?c12+' = '+mil+' hours':mil+' hours = '+c12;
      var h2='<h2>'+UI.icon('clock')+big+'</h2><div class="verdict good"><span class="vicon">'+UI.icon('check')+'</span><div><strong class="big">'+big+'</strong><span>Spoken: “'+sp+(min%60===0?' hours':'')+'”. With a colon: '+c24+'.'+(min===0?' Midnight is 0000 (12:00 AM); some systems write 2400 for the end of a day.':min===720?' Noon is 1200 (12:00 PM).':'')+'</span></div></div>';
      h2+='<div class="stats s3">'+stat('12-hour',c12)+stat('24-hour',c24)+stat('Military',mil)+'</div>'+ACT;
      out.innerHTML=h2; last=big+' (spoken: '+sp+'). '+location.href; }
    render(); }
  var hs=$('hsForm');
  if(hs){ UI.readState(); UI.segs(rend); hs.addEventListener('input',UI.debounce(rend,40)); hs.addEventListener('change',rend);
    function rend(){ var md=$('md').value, h2s=md==='h2s', out=$('hsOut'); $('fR').hidden=!h2s; $('fO').hidden=!h2s; $('fA').hidden=h2s; history.replaceState(null,'',UI.stateURL());
      if(bad(hs)){ out.innerHTML='<div class="alert err">'+UI.icon('alert')+'<div>Fix the highlighted fields. Numbers can’t be negative or blank.</div></div>'; last=''; return; }
      var hw=UI.num('hw'), wy=UI.num('wy'), h;
      if(h2s){ var rate=UI.num('rt'), ot=UI.num('ot');
        if(!rate||!(hw+ot)||!wy){ out.innerHTML='<div class="empty">'+UI.icon('dollar')+'<p><strong>Add an hourly rate</strong><br>Then your hours per week and weeks per year.</p></div>'; last=''; return; }
        var r=C.hourlyToSalary({rate:rate,hours:hw,weeks:wy,otHours:ot});
        h='<h2>'+UI.icon('dollar')+m(rate)+' an hour is '+m(r.annual,true)+' a year</h2><div class="verdict good"><span class="vicon">'+UI.icon('check')+'</span><div><strong class="big">'+m(r.annual,true)+' a year before taxes</strong><span>'+m(rate)+' × '+hw+' hours × '+wy+' weeks'+(ot?' plus '+ot+' overtime hours a week at 1.5× ('+m(r.otAnnual,true)+' a year)':'')+'. That is '+r.hoursYear.toLocaleString('en-US')+' paid hours a year. Gross pay, pre-tax.</span></div></div>';
        h+='<div class="stats s3">'+stat('Annual',m(r.annual,true))+stat('Monthly',m(r.monthly))+stat('Semimonthly (24)',m(r.semimonthly))+stat('Biweekly (26)',m(r.biweekly))+stat('Weekly',m(r.weekly))+stat('Daily (5 days)',m(r.daily))+'</div>';
        last=m(rate)+'/hr, '+hw+' h/wk, '+wy+' wk/yr = '+m(r.annual,true)+'/yr, '+m(r.monthly)+'/mo, '+m(r.biweekly)+' biweekly, '+m(r.weekly)+'/wk (gross, pre-tax). '+location.href; }
      else { var an=UI.num('an');
        if(!an||!hw||!wy){ out.innerHTML='<div class="empty">'+UI.icon('dollar')+'<p><strong>Add an annual salary</strong><br>Then your hours per week and weeks per year.</p></div>'; last=''; return; }
        var s=C.salaryToHourly({annual:an,hours:hw,weeks:wy});
        h='<h2>'+UI.icon('dollar')+m(an,true)+' a year is '+m(s.hourly)+' an hour</h2><div class="verdict good"><span class="vicon">'+UI.icon('check')+'</span><div><strong class="big">'+m(s.hourly)+' an hour before taxes</strong><span>'+m(an,true)+' ÷ ('+hw+' hours × '+wy+' weeks = '+s.hoursYear.toLocaleString('en-US')+' hours). Gross pay, pre-tax; unpaid overtime is not included.</span></div></div>';
        h+='<div class="stats s3">'+stat('Hourly',m(s.hourly))+stat('Monthly',m(s.monthly))+stat('Biweekly (26)',m(s.biweekly))+stat('Weekly',m(s.weekly))+'</div>';
        last=m(an,true)+'/yr at '+hw+' h/wk, '+wy+' wk/yr = '+m(s.hourly)+'/hr (gross, pre-tax). '+location.href; }
      h+='<p class="hint">This is pre-tax. Taxes, benefits and deductions come out of it, so take-home is lower. Not payroll or tax advice.</p>'+ACT; out.innerHTML=h; }
    rend(); }
});
