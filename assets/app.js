/* ClockInMath UI: weekly/biweekly time card, hours between times, decimal converter, overtime pay. Math lives in calc.js. */
addEventListener('DOMContentLoaded',function(){ 'use strict';
  var C=window.TCCalc, $=UI.$, esc=UI.esc, money=UI.money, d=document;
  var DAY=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'], MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function dec2(min){ return C.toDecimal(min,2).toFixed(2); }
  function both(min){ return C.formatHM(min)+' ('+dec2(min)+' h)'; }
  function stat(k,v,cls){ return '<div class="stat"><div class="k">'+k+'</div><div class="v'+(cls?' '+cls:'')+'">'+v+'</div></div>'; }
  function dateLabel(s){ var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||''); return m?MON[+m[2]-1]+' '+(+m[3])+', '+m[1]:''; }
  function num(id,def){ var el=$(id); return !el||el.value===''?def:UI.num(id); }
  function persist(key,skip){ // remember the last inputs (never the name) in this browser
    try{ var o={}; d.querySelectorAll('[data-state]').forEach(function(e){ if(skip.indexOf(e.id)<0) o[e.id]=e.value; }); localStorage.setItem(key,JSON.stringify(o)); }catch(e){} }
  function restore(key,skip){ try{ var o=JSON.parse(localStorage.getItem(key)||'null'); if(!o) return; Object.keys(o).forEach(function(k){ var e=$(k); if(e&&e.hasAttribute('data-state')&&skip.indexOf(k)<0&&typeof o[k]==='string') e.value=o[k]; }); }catch(e){} }
  function initState(key,skip){ d.querySelectorAll('[data-state]').forEach(function(e){ e.dataset.def=e.value; });
    var p=new URLSearchParams(location.search), has=false; d.querySelectorAll('[data-state]').forEach(function(e){ if(p.has(e.id)) has=true; });
    if(has) UI.readState(); else if(key) restore(key,skip||[]); }
  function sync(key,skip){ history.replaceState(null,'',UI.stateURL()); if(key) persist(key,skip||[]); }
  function copyBtn(text){ d.addEventListener('click',function(e){ if(e.target.closest('#copySum')) UI.copy(text(),'Summary copied'); }); }
  var ACT='<div class="actions no-print"><button type="button" class="btn ghost sm" data-print>'+UI.icon('copy')+'Print / PDF</button><button type="button" class="btn ghost sm" id="copySum">'+UI.icon('copy')+'Copy summary</button></div>';

  /* ---------- weekly and biweekly time card ---------- */
  var form=$('tcForm');
  if(form){ (function(){
    var weeks=+form.dataset.weeks||1, out=$('tcOut'), KEY=form.dataset.key, SKIP=['we'], last='';
    var DEF={1:['9a','5:30p','30'],2:['9a','5:30p','30'],3:['9a','5:30p','30'],4:['9a','5:30p','30'],5:['9a','5:30p','30']};
    var boxes=Array.prototype.slice.call(d.querySelectorAll('.tc-days'));
    function cell(id,lab,aria,val,mode){ return '<div class="tcf"><label for="'+id+'">'+lab+'</label><input id="'+id+'" data-state type="text" inputmode="'+(mode||'text')+'" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="'+aria+'" value="'+esc(val)+'"></div>'; }
    boxes.forEach(function(box){ var pre=box.dataset.prefix, html='';
      for(var wd=0;wd<7;wd++){ var df=DEF[wd]||['','',''], id=pre+wd;
        html+='<div class="tcday" data-wd="'+wd+'" role="group" aria-label="'+DAY[wd]+'"><div class="tcd-h"><b>'+DAY[wd].slice(0,3)+'</b><span class="tcnet" id="'+id+'n" aria-live="off"></span></div>'
          +'<div class="tcrow">'+cell(id+'i','In',DAY[wd]+' in',df[0])+cell(id+'o','Out',DAY[wd]+' out',df[1])+cell(id+'b','Break (min)',DAY[wd]+' unpaid break in minutes',df[2],'numeric')+'</div>'
          +'<div class="tcrow tc-split">'+cell(id+'j','In (2nd)',DAY[wd]+' second in','')+cell(id+'p','Out (2nd)',DAY[wd]+' second out','')+'</div>'
          +'<p class="tcerr" id="'+id+'e" role="status"></p></div>'; }
      box.innerHTML=html; });
    initState(KEY,SKIP);
    var lastWs=null;
    function order(){ var first=$('ws').value==='0'?0:1, seq=[]; for(var k=0;k<7;k++) seq.push((first+k)%7);
      if(lastWs!==first){ lastWs=first; boxes.forEach(function(box){ var frag=d.createDocumentFragment(); seq.forEach(function(wd){ frag.appendChild(box.querySelector('[data-wd="'+wd+'"]')); }); box.appendChild(frag); }); }
      return seq; }
    function bad(el,on){ if(on) el.setAttribute('aria-invalid','true'); else el.removeAttribute('aria-invalid'); }
    function pair(a,b,after,name){ // parse one in/out pair; returns {r:[in,out]|null, errs:[]}
      var av=a.value.trim(), bv=b.value.trim(), errs=[], i=null, o=null; bad(a,false); bad(b,false);
      if(!av&&!bv) return {r:null,errs:errs,empty:true};
      if(av){ i=C.parseTime(av,after!=null?{assume:'next',after:after}:{assume:'am'}); if(i==null){ errs.push('Can’t read “'+av+'” as a '+name+' in time. Try 9a, 9:30 or 1730.'); bad(a,true); } } else { errs.push('Add a '+name+' in time.'); bad(a,true); }
      if(bv){ o=C.parseTime(bv,i!=null?{assume:'next',after:i}:{assume:'pm'}); if(o==null){ errs.push('Can’t read “'+bv+'” as a '+name+' out time. Try 5p or 17:30.'); bad(b,true); } } else { errs.push('Add a '+name+' out time.'); bad(b,true); }
      return {r:i!=null&&o!=null?[i,o]:null,errs:errs};
    }
    function readDay(pre,wd,splitOn){
      var id=pre+wd, g=function(k){ return $(id+k); }, errs=[], punches=[], times=[];
      var p1=pair(g('i'),g('o'),null,DAY[wd].slice(0,3)); errs=errs.concat(p1.errs); if(p1.r){ punches.push(p1.r); times.push(p1.r); }
      var p2={empty:true}; if(splitOn){ p2=pair(g('j'),g('p'),p1.r?p1.r[1]:null,'second'); errs=errs.concat(p2.errs); if(p2.r){ punches.push(p2.r); times.push(p2.r); } }
      var bv=g('b').value.trim(), brk=0; bad(g('b'),false);
      if(bv){ brk=C.parseDuration(bv,{bare:'min'}); if(brk==null){ errs.push('Enter the break in minutes (30) or h:mm (0:30).'); bad(g('b'),true); brk=0; } }
      var gross=0; punches.forEach(function(p){ gross+=C.durationMinutes(p[0],p[1]); });
      if(brk>gross&&gross>0) errs.push('The break is longer than the shift, so this day counts as 0.');
      else if(gross>16*60) errs.push('That shift is over 16 hours. Check am/pm.');
      var day={punches:punches,breakMin:brk}, net=C.dayNet(day), empty=!!(p1.empty&&p2.empty&&!bv);
      $(id+'n').textContent=empty?'':net>0||punches.length?C.formatHM(net)+' · '+dec2(net):'';
      $(id+'e').textContent=errs.join(' '); $(id+'e').style.display=errs.length?'block':'none';
      return {day:day,net:net,errs:errs,times:times,brk:brk,empty:empty,wd:wd};
    }
    function rowsFor(box,splitOn,seq){ var pre=box.dataset.prefix; return seq.map(function(wd){ return readDay(pre,wd,splitOn); }); }
    function dayTable(rs,wt,showOT){
      var h='<div class="table-scroll"><table class="tc-table"><thead><tr><th scope="col">Day</th><th scope="col">Times</th><th scope="col">Hours</th><th scope="col">Decimal</th>'+(showOT?'<th scope="col">OT</th>':'')+'</tr></thead><tbody>';
      rs.forEach(function(r,i){ var w=wt.days[i], t=r.times.map(function(p){ return C.formatClock(p[0]).replace(':00 ',' ')+' – '+C.formatClock(p[1]).replace(':00 ',' '); }).join(', ');
        if(r.brk) t+=(t?' · ':'')+r.brk+' min break'; var o=w.ot+w.dt;
        h+='<tr><th scope="row">'+DAY[r.wd].slice(0,3)+'</th><td>'+(t||'—')+'</td><td>'+(r.net?C.formatHM(r.net):'—')+'</td><td>'+(r.net?dec2(r.net):'—')+'</td>'+(showOT?'<td>'+(o?C.formatHM(o):'')+'</td>':'')+'</tr>'; });
      return h+'</tbody></table></div>'; }
    function render(){
      var splitOn=$('sp').value==='1'; form.classList.toggle('split',splitOn); var seq=order();
      var o={ot:$('ot').value,rate:num('rate',0),otMult:Math.max(1,num('om',1.5)),dtMult:Math.max(1,num('dm',2)),dt:$('dt').value==='1',seventh:$('s7').value==='1'};
      var daily=o.ot==='daily'||o.ot==='both'; $('dt').disabled=!daily; $('s7').disabled=!daily;
      var all=boxes.map(function(b){ return rowsFor(b,splitOn,seq); }), anyErr=false, any=false;
      all.forEach(function(rs){ rs.forEach(function(r){ if(r.errs.length) anyErr=true; if(!r.empty) any=true; }); });
      var wts=all.map(function(rs){ return C.weekTotals(rs.map(function(r){ return r.day; }),o); }), P=C.periodTotals(all.map(function(rs){ return rs.map(function(r){ return r.day; }); }),o);
      var name=($('emp').value||'').trim(), we=dateLabel($('we').value), per=weeks===2?'Pay period':'Week';
      var showOT=o.ot!=='none', hasRate=o.rate>0;
      if(!any){ out.innerHTML='<div class="empty">'+UI.icon('clock')+'<p><strong>Type your in and out times</strong><br>Try 9a and 5:30p, or 0900 and 1730.</p></div>'; last=''; sync(KEY,SKIP); return; }
      var h='<div class="tc-print"><h2>Timesheet'+(weeks===2?' (two weeks)':'')+'</h2><p><strong>Employee:</strong> '+(name?esc(name):'______________________')+' &nbsp; <strong>'+(weeks===2?'Last week ending':'Week ending')+':</strong> '+(we||'______________')+'</p></div>';
      h+='<h2>'+UI.icon('clock')+per+' total: '+C.formatHM(P.totalMin)+' ('+dec2(P.totalMin)+' hours)</h2>';
      var ot=P.otMin+P.dtMin;
      h+='<div class="verdict '+(ot>0?'warn':'good')+'"><span class="vicon">'+UI.icon(ot>0?'dollar':'check')+'</span><div><strong class="big">'+(showOT?(ot>0?both(ot)+' of overtime'+(P.dtMin?' (including '+C.formatHM(P.dtMin)+' double time)':''):'No overtime'):both(P.totalMin)+' worked')+(hasRate?'. Gross pay '+money(P.gross)+'.':'.')+'</strong><span>'+(anyErr?'Fix the flagged entries. Those days are left out until you do.':'')+(showOT?({weekly:'Weekly rule: hours over 40 in a workweek at '+o.otMult+'×.',daily:'Daily rule: hours over 8 in a day at '+o.otMult+'×'+(o.dt?', over 12 at '+o.dtMult+'×':'')+'.',both:'Daily rules first, then regular hours past 40 in the week at '+o.otMult+'×.'})[o.ot]:'No overtime rule picked.')+(weeks===2?' Each week is tested on its own.':'')+'</span></div></div>';
      h+='<div class="stats s3">'+stat('Total hours',C.formatHM(P.totalMin))+stat('Decimal hours',dec2(P.totalMin))+stat('Regular',C.formatHM(P.regMin))+(showOT?stat('Overtime',C.formatHM(P.otMin))+stat('Double time',C.formatHM(P.dtMin)):'')+(hasRate?stat('Gross pay',money(P.gross),'pos'):'')+'</div>';
      all.forEach(function(rs,wi){ var wt=wts[wi]; if(weeks===2) h+='<h3 class="tc-wk">Week '+(wi+1)+': '+both(wt.totalMin)+(showOT&&(wt.otMin+wt.dtMin)?', overtime '+C.formatHM(wt.otMin+wt.dtMin)+(hasRate?', '+money(wt.gross):''):'')+'</h3>'; h+=dayTable(rs,wt,showOT); });
      if(hasRate){ h+='<div class="table-scroll"><table class="tc-table"><caption class="sr-only">Gross pay by line</caption><thead><tr><th scope="col">Pay line</th><th scope="col">Hours</th><th scope="col">Rate</th><th scope="col">Pay</th></tr></thead><tbody>'
        +'<tr><th scope="row">Regular</th><td>'+dec2(P.regMin)+'</td><td>'+money(o.rate)+'</td><td>'+money(P.regPay)+'</td></tr>'
        +(showOT?'<tr><th scope="row">Overtime ('+o.otMult+'×)</th><td>'+dec2(P.otMin)+'</td><td>'+money(C.r2(o.rate*o.otMult))+'</td><td>'+money(P.otPay)+'</td></tr>':'')
        +(showOT&&(P.dtMin||o.dt)?'<tr><th scope="row">Double time ('+o.dtMult+'×)</th><td>'+dec2(P.dtMin)+'</td><td>'+money(C.r2(o.rate*o.dtMult))+'</td><td>'+money(P.dtPay)+'</td></tr>':'')
        +'<tr><th scope="row">Gross pay</th><td>'+dec2(P.totalMin)+'</td><td></td><td><strong>'+money(P.gross)+'</strong></td></tr></tbody></table></div><p class="hint">Gross pay is before taxes and deductions.</p>'; }
      h+='<p class="tc-print tc-sign">Employee signature: ______________________ &nbsp; Supervisor: ______________________</p>';
      h+=ACT; out.innerHTML=h;
      last='ClockInMath '+per.toLowerCase()+': '+both(P.totalMin)+(showOT?'; regular '+C.formatHM(P.regMin)+', overtime '+C.formatHM(P.otMin)+(P.dtMin?', double time '+C.formatHM(P.dtMin):''):'')+(hasRate?'; gross '+money(P.gross):'')+'. '+location.href;
      sync(KEY,SKIP);
    }
    copyBtn(function(){ return last; });
    var run=UI.debounce(render,40);
    form.addEventListener('input',run); form.addEventListener('change',render);
    $('tcClear').addEventListener('click',function(){ form.querySelectorAll('.tc-days input').forEach(function(e){ e.value=''; }); render(); var f=form.querySelector('.tc-days input'); if(f) f.focus(); });
    requestAnimationFrame(function(){ requestAnimationFrame(render); });
  })(); }

  /* ---------- hours between two times ---------- */
  var hb=$('hbForm');
  if(hb){ (function(){ var out=$('hbOut'), last=''; initState(null);
    function render(){ var a=$('st').value.trim(), b=$('en').value.trim(), bk=$('bk').value.trim(), errs=[];
      var s=C.parseTime(a,{assume:'am'}), e=s!=null?C.parseTime(b,{assume:'next',after:s}):C.parseTime(b,{assume:'pm'}), br=bk===''?0:C.parseDuration(bk,{bare:'min'});
      if(s==null) errs.push(a?'Can’t read the start time “'+esc(a)+'”. Try 8:15a, 9:30 or 0815.':'Enter a start time.');
      if(e==null) errs.push(b?'Can’t read the end time “'+esc(b)+'”. Try 4:45p, 17:30 or 1645.':'Enter an end time.');
      if(br==null) errs.push('Enter the break in minutes (30) or h:mm (0:30).');
      ['st','en','bk'].forEach(function(id,i){ var el=$(id); if((i===0&&s==null)||(i===1&&e==null)||(i===2&&br==null)) el.setAttribute('aria-invalid','true'); else el.removeAttribute('aria-invalid'); });
      if(errs.length){ out.innerHTML='<div class="alert err">'+UI.icon('alert')+'<span>'+errs.join(' ')+'</span></div>'; last=''; history.replaceState(null,'',UI.stateURL()); return; }
      var gross=C.durationMinutes(s,e), net=C.hoursBetween(s,e,br), over=e<s;
      var h='<h2>'+UI.icon('clock')+C.formatClock(s)+' to '+C.formatClock(e)+'</h2>';
      h+='<div class="verdict good"><span class="vicon">'+UI.icon('check')+'</span><div><strong class="big">'+Math.floor(net/60)+' hours '+(net%60)+' minutes</strong><span>'+dec2(net)+' decimal hours'+(over?'. The end is earlier than the start, so it counts as the next day.':'.')+(br?' Break of '+br+' min subtracted from '+C.formatHM(gross)+'.':'')+(br>gross?' The break is longer than the span, so you get 0.':'')+'</span></div></div>';
      h+='<div class="stats s3">'+stat('Hours:minutes',C.formatHM(net))+stat('Decimal hours',dec2(net))+stat('Total minutes',String(net))+(br?stat('Before break',C.formatHM(gross)):'')+'</div>'+ACT;
      out.innerHTML=h; last=C.formatClock(s)+' to '+C.formatClock(e)+(br?' minus '+br+' min break':'')+' = '+C.formatHM(net)+' ('+dec2(net)+' hours). '+location.href; history.replaceState(null,'',UI.stateURL()); }
    copyBtn(function(){ return last; }); hb.addEventListener('input',UI.debounce(render,40)); render(); })(); }

  /* ---------- decimal hours converter ---------- */
  var dc=$('dcForm');
  if(dc){ (function(){ var out=$('dcOut'), last=''; initState(null);
    function render(){ var hh=Math.max(0,Math.floor(num('hh',0))), mm=Math.max(0,num('mm',0)), tot=hh*60+mm, dv=num('dc',0), mins=C.fromDecimal(Math.max(0,dv));
      var h='<h2>'+UI.icon('swap')+'Hours and minutes ↔ decimal</h2><div class="verdict good"><span class="vicon">'+UI.icon('check')+'</span><div><strong class="big">'+hh+':'+(mm<10?'0':'')+Math.round(mm)+' = '+C.toDecimal(tot,4)+' decimal hours</strong><span>'+(mm>=60?Math.round(mm)+' minutes is '+C.formatHM(mm)+', so the total is '+C.formatHM(tot)+'. ':'')+Math.round(mm)+' ÷ 60 = '+C.toDecimal(mm,4)+', plus '+hh+' hours. Rounded to 2 decimals: '+dec2(tot)+'.</span></div></div>';
      h+='<div class="verdict warn"><span class="vicon">'+UI.icon('swap')+'</span><div><strong class="big">'+(dv>=0?dv+' decimal hours = '+C.formatHM(mins):'Enter 0 or more')+'</strong><span>'+(dv>=0?'The decimal part × 60 gives the minutes: '+(Math.round((dv-Math.floor(dv))*6000)/100)+' minutes.':'')+'</span></div></div>'+ACT;
      out.innerHTML=h; last=hh+':'+(mm<10?'0':'')+Math.round(mm)+' = '+C.toDecimal(tot,4)+' h; '+dv+' h = '+C.formatHM(mins)+'. '+location.href; history.replaceState(null,'',UI.stateURL()); }
    copyBtn(function(){ return last; }); dc.addEventListener('input',UI.debounce(render,40)); render(); })(); }

  /* ---------- overtime pay ---------- */
  var op=$('opForm');
  if(op){ (function(){ var out=$('opOut'), last=''; initState(null);
    function hrs(id){ var el=$(id), v=el.value.trim().replace(',','.'); el.removeAttribute('aria-invalid'); if(v==='') return 0; var r;
      if(v.indexOf(':')>=0){ var mn=C.parseDuration(v); r=mn==null?NaN:mn/60; } else r=/^\d+(\.\d+)?$/.test(v)?parseFloat(v):NaN;
      if(isNaN(r)){ el.setAttribute('aria-invalid','true'); return null; } return r; }
    function render(){ var reg=hrs('rh'), ot=hrs('oh'), dt=hrs('dh'), rate=num('rt',0), om=Math.max(1,num('om',1.5)), dm=Math.max(1,num('dm',2));
      if(reg==null||ot==null||dt==null){ out.innerHTML='<div class="alert err">'+UI.icon('alert')+'<span>Enter hours as decimals (7.5) or h:mm (7:30).</span></div>'; last=''; history.replaceState(null,'',UI.stateURL()); return; }
      var p=C.overtimePay({reg:reg,ot:ot,dt:dt,rate:rate,otMult:om,dtMult:dm}), tot=reg+ot+dt;
      if(!tot||!rate){ out.innerHTML='<div class="empty">'+UI.icon('dollar')+'<p><strong>Add hours and an hourly rate</strong><br>Try 40 regular and 5 overtime hours at $20.</p></div>'; last=''; history.replaceState(null,'',UI.stateURL()); return; }
      var h='<h2>'+UI.icon('dollar')+'Gross pay: '+money(p.gross)+'</h2><div class="verdict good"><span class="vicon">'+UI.icon('check')+'</span><div><strong class="big">'+money(p.gross)+' for '+C.round(tot,2)+' hours</strong><span>Overtime pays '+money(p.otRate)+' an hour ('+om+'×'+(dt?', double time '+money(p.dtRate)+' at '+dm+'×':'')+'). Average '+money(p.gross/tot)+' an hour. Before taxes and deductions.</span></div></div>';
      h+='<div class="table-scroll"><table class="tc-table"><caption class="sr-only">Gross pay by line</caption><thead><tr><th scope="col">Pay line</th><th scope="col">Hours</th><th scope="col">Rate</th><th scope="col">Pay</th></tr></thead><tbody>'
        +'<tr><th scope="row">Regular</th><td>'+C.round(reg,2)+'</td><td>'+money(rate)+'</td><td>'+money(p.regPay)+'</td></tr>'
        +'<tr><th scope="row">Overtime ('+om+'×)</th><td>'+C.round(ot,2)+'</td><td>'+money(p.otRate)+'</td><td>'+money(p.otPay)+'</td></tr>'
        +'<tr><th scope="row">Double time ('+dm+'×)</th><td>'+C.round(dt,2)+'</td><td>'+money(p.dtRate)+'</td><td>'+money(p.dtPay)+'</td></tr>'
        +'<tr><th scope="row">Gross pay</th><td>'+C.round(tot,2)+'</td><td></td><td><strong>'+money(p.gross)+'</strong></td></tr></tbody></table></div>'
        +'<p class="hint">Federal law (FLSA) sets time-and-a-half after 40 hours in a workweek for nonexempt employees. Not legal advice.</p>'+ACT;
      out.innerHTML=h; last='Gross pay '+money(p.gross)+': '+C.round(reg,2)+' regular + '+C.round(ot,2)+' overtime'+(dt?' + '+C.round(dt,2)+' double time':'')+' hours at '+money(rate)+'. '+location.href; history.replaceState(null,'',UI.stateURL()); }
    copyBtn(function(){ return last; }); op.addEventListener('input',UI.debounce(render,40)); render(); })(); }
});
