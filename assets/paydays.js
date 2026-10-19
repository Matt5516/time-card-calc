/* ClockInMath pay periods in a year. Date math lives in calc.js (paydays). */
addEventListener('DOMContentLoaded',function(){ 'use strict';
  var $=UI.$||function(i){return document.getElementById(i);}, C=window.TCCalc, form=$('ppForm'); if(!form) return;
  var MON=['January','February','March','April','May','June','July','August','September','October','November','December'], DOW=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var NAME={weekly:'weekly',biweekly:'biweekly',semimonthly:'semimonthly',monthly:'monthly'};
  UI.readState(); UI.segs(render);
  function stat(k,v){ return '<div class="stat"><div class="k">'+k+'</div><div class="v">'+v+'</div></div>'; }
  var last='';
  function render(){
    var fr=$('fr').value, wk=fr==='weekly'||fr==='biweekly', out=$('ppOut'), yr=+$('yr').value;
    $('qAnchor').hidden=!wk; $('qShift').hidden=wk; history.replaceState(null,'',UI.stateURL());
    var a=$('ad').value; $('ad').setAttribute('aria-invalid',wk&&C.parseISO(a)==null?'true':'false');
    if(wk&&C.parseISO(a)==null){ out.innerHTML='<div class="empty">'+UI.icon('clock')+'<p><strong>Pick a payday</strong><br>Choose any payday on your schedule to list every payday of '+yr+'.</p></div>'; last=''; return; }
    var r=C.paydays({freq:fr,year:yr,anchor:a,shift:$('sh').value});
    var first=r.dates[0], lastD=r.dates[r.dates.length-1];
    function label(i){ return DOW[i.dow].slice(0,3)+' '+MON[i.m-1].slice(0,3)+' '+i.d; }
    var extra=r.extraMonths.map(function(m){ return MON[m-1]; });
    var h='<h2>'+UI.icon('clock')+r.count+' '+NAME[fr]+' paydays in '+yr+'</h2>';
    h+='<div class="verdict good"><span class="vicon">'+UI.icon('check')+'</span><div><strong class="big">'+r.count+' paychecks in '+yr+(wk&&r.count>(fr==='weekly'?52:26)?' (one extra)':'')+'</strong><span>First payday '+label(first)+', last payday '+label(lastD)+'.'+(extra.length?' '+(fr==='weekly'?'Five-payday months: ':'Three-paycheck months: ')+extra.join(', ')+'.':(wk?' No month has an extra paycheck.':''))+'</span></div></div>';
    h+='<div class="stats s3">'+stat('Paydays in '+yr,r.count)+stat('First',label(first))+stat('Last',label(lastD))+'</div>';
    h+='<div class="table-scroll"><table><caption class="sr-only">Paydays by month</caption><thead><tr><th scope="col">Month</th><th scope="col">Paydays</th><th scope="col">Count</th></tr></thead><tbody>';
    for(var m=1;m<=12;m++){ var ds=r.dates.filter(function(i){ return i.m===m; }), x=r.extraMonths.indexOf(m)>=0;
      h+='<tr'+(x?'':'')+'><th scope="row">'+MON[m-1]+'</th><td>'+ds.map(function(i){ return DOW[i.dow].slice(0,3)+' '+i.d; }).join(', ')+'</td><td>'+ds.length+(x?' <strong>(extra)</strong>':'')+'</td></tr>'; }
    h+='</tbody></table></div><p class="hint">Calendar math only. Your employer may pay earlier around holidays, and some payroll systems use a different schedule. Salaried pay is usually the same each check; ask your employer how a year with an extra paycheck is handled.</p>';
    h+='<div class="actions no-print"><button type="button" class="btn ghost sm" data-print>'+UI.icon('copy')+'Print / PDF</button><button type="button" class="btn ghost sm" id="copySum">'+UI.icon('copy')+'Copy dates</button></div>';
    out.innerHTML=h;
    last=r.count+' '+NAME[fr]+' paydays in '+yr+': '+r.dates.map(function(i){ return i.iso; }).join(', ')+(extra.length?'. Extra-paycheck months: '+extra.join(', '):'')+'. '+location.href;
  }
  form.addEventListener('input',UI.debounce(render,40)); form.addEventListener('change',render);
  document.addEventListener('click',function(e){ if(e.target.closest('#copySum')&&last) UI.copy(last,'Copied'); });
  render();
});
