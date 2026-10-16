/* ClockInMath: time parsing, hours worked, overtime splits and gross pay. Pure functions, no DOM. Tested in _tests/unit.test.js.
   All durations are whole minutes. Times of day are minutes after midnight (0-1439). */
(function(root){
'use strict';
var DAY = 1440;
function r2(x){ return Math.round((x + 1e-9) * 100) / 100; }
function round(x, dp){ var p = Math.pow(10, dp == null ? 2 : dp); return Math.round((x + 1e-9 * (x < 0 ? -1 : 1)) * p) / p; }

/* parseTime('9a' | '9:30pm' | '1730' | '5p' | '930' ...) -> minutes after midnight, or null if unreadable.
   Unambiguous: 24-hour style (hour 13-23, leading zero such as 09:30 or 0930) or an a/p suffix.
   Ambiguous bare times (9, 9:30, 930, 12:15) resolve by opts.assume:
     'am' (default) or 'pm'  -> that half of the day (a bare 12 always reads as noon unless 12a is typed)
     'next'                  -> whichever of am/pm makes the shortest positive shift after opts.after (minutes), so "9a to 5" is 8h and "10p to 6" is 8h. */
function parseTime(str, opts){
  opts = opts || {};
  if (str == null) return null;
  var s = String(str).trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, '');
  if (!s) return null;
  var m = /^(\d{1,4}|\d{1,2}:\d{2})(a|p|am|pm)?$/.exec(s);
  if (!m) return null;
  var body = m[1], suf = m[2] ? m[2].charAt(0) : '', h, mi, lead;
  if (body.indexOf(':') >= 0) { var q = body.split(':'); h = +q[0]; mi = +q[1]; lead = q[0].length === 2 && q[0].charAt(0) === '0'; }
  else if (body.length <= 2) { h = +body; mi = 0; lead = body.length === 2 && body.charAt(0) === '0'; }
  else { h = +body.slice(0, body.length - 2); mi = +body.slice(-2); lead = body.length === 4 && body.charAt(0) === '0'; }
  if (mi > 59 || h > 23) return null;
  if (suf) {
    if (h < 1 || h > 12) return null;
    return ((h % 12) + (suf === 'p' ? 12 : 0)) * 60 + mi;
  }
  if (h > 12 || h === 0 || lead) return h * 60 + mi;            // 24-hour style: explicit
  var asAm = (h % 12) * 60 + mi, asPm = (h % 12) * 60 + 720 + mi;   // 12 -> 0 (am) / 12 (pm)
  var as = opts.assume || 'am';
  if (as === 'pm') return asPm;
  if (as === 'next' && opts.after != null) {
    var da = durationMinutes(opts.after, asAm), dp = durationMinutes(opts.after, asPm);
    if (da === 0) return asPm; if (dp === 0) return asAm;
    return dp < da ? asPm : asAm;
  }
  if (h === 12) return asPm;                                     // bare "12" as a start time means noon
  return asAm;
}
/* Minutes from inMin to outMin; out earlier than in means the next day (22:00 -> 06:00 = 480). Equal times = 0. */
function durationMinutes(inMin, outMin){ return outMin >= inMin ? outMin - inMin : outMin + DAY - inMin; }
/* "8:15", "8h 15m", "8h", "45m", "0:45" -> minutes; a bare number (no colon, h or m) is minutes only when opts.bare === 'min'. */
function parseDuration(str, opts){
  if (str == null) return null; var s = String(str).trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return null; var m;
  if ((m = /^(\d{1,3}):(\d{2})$/.exec(s))) return +m[2] > 59 ? null : +m[1] * 60 + +m[2];
  if ((m = /^(?:(\d{1,3})h(?:rs?|ours?)?)?(?:(\d{1,3})m(?:in(?:ute)?s?)?)?$/.exec(s)) && (m[1] || m[2])) return (+m[1] || 0) * 60 + (+m[2] || 0);
  if (/^\d+(\.\d+)?$/.test(s) && opts && opts.bare === 'min') return Math.round(+s);
  return null;
}
function formatHM(mins){ mins = Math.round(mins); var neg = mins < 0; if (neg) mins = -mins; var h = Math.floor(mins / 60), m = mins % 60; return (neg ? '-' : '') + h + ':' + (m < 10 ? '0' : '') + m; }
function toDecimal(mins, dp){ return round(mins / 60, dp == null ? 2 : dp); }
function fromDecimal(dec){ return Math.round(dec * 60); }
/* 9:00 AM style label for a time of day */
function formatClock(min){ var h = Math.floor(min / 60) % 24, m = min % 60; return ((h % 12) || 12) + ':' + (m < 10 ? '0' : '') + m + ' ' + (h < 12 ? 'AM' : 'PM'); }

/* hoursBetween(startMin, endMin, breakMin) -> net minutes worked (overnight-aware, never below 0) */
function hoursBetween(startMin, endMin, breakMin){ return Math.max(0, durationMinutes(startMin, endMin) - (breakMin || 0)); }
/* A day is a number of net minutes, or {punches:[[in,out],[in,out]], breakMin}. Returns net minutes (punch pairs minus break, min 0). */
function dayNet(day){
  if (typeof day === 'number') return Math.max(0, Math.round(day));
  if (!day) return 0;
  var t = 0; (day.punches || []).forEach(function(p){ if (p && p[0] != null && p[1] != null) t += durationMinutes(p[0], p[1]); });
  return Math.max(0, t - (day.breakMin || 0));
}

/* Split one day's net minutes into regular / OT (1.5x) / DT (2x).
   opts.dailyOT (minutes, default 480), opts.dailyDT (minutes, default 720; only if opts.dt is true).
   opts.seventh: every minute worked is OT up to dailyOT and DT after (California seventh consecutive day). */
function splitDay(net, opts){
  opts = opts || {}; var ot = opts.dailyOT == null ? 480 : opts.dailyOT, dtAt = opts.dailyDT == null ? 720 : opts.dailyDT;
  if (opts.seventh) { var o7 = Math.min(net, ot), d7 = Math.max(0, net - ot); return {reg: 0, ot: o7, dt: d7}; }
  var dt = opts.dt ? Math.max(0, net - dtAt) : 0;
  var o = Math.max(0, Math.min(net, opts.dt ? dtAt : net) - ot);
  return {reg: net - o - dt, ot: o, dt: dt};
}

/* weekTotals(days, opts): days = up to 7 entries in workweek order (numbers of minutes or day objects).
   opts.ot: 'none' | 'weekly' | 'daily' | 'both'   (default 'none')
     weekly: regular up to opts.weeklyOT (default 2400 = 40 h), the rest at OT.
     daily : each day over 8 h at OT; with opts.dt, over 12 h at DT. No weekly test.
     both  : daily split first; then regular minutes (those not already OT/DT) beyond 40 h in the week become OT. Daily OT hours are never counted twice.
   opts.seventh (daily/both): if all 7 days have time, the 7th day is OT to 8 h and DT beyond (California).
   opts.rate, opts.otMult (1.5), opts.dtMult (2): gross pay in dollars, each line rounded to cents.
   Returns {days:[{net,reg,ot,dt}], regMin, otMin, dtMin, totalMin, regPay, otPay, dtPay, gross}. */
function weekTotals(days, opts){
  opts = opts || {}; var mode = opts.ot || 'none', wk = opts.weeklyOT == null ? 2400 : opts.weeklyOT;
  var nets = (days || []).map(dayNet), total = nets.reduce(function(a, b){ return a + b; }, 0);
  var seventh = !!opts.seventh && (mode === 'daily' || mode === 'both') && nets.length === 7 && nets.every(function(n){ return n > 0; });
  var rows = nets.map(function(n, i){
    if (mode === 'daily' || mode === 'both') { var d = splitDay(n, {dailyOT: opts.dailyOT, dailyDT: opts.dailyDT, dt: opts.dt, seventh: seventh && i === 6}); return {net: n, reg: d.reg, ot: d.ot, dt: d.dt}; }
    return {net: n, reg: n, ot: 0, dt: 0};
  });
  var reg = 0, ot = 0, dt = 0; rows.forEach(function(r){ reg += r.reg; ot += r.ot; dt += r.dt; });
  if (mode === 'weekly') { reg = Math.min(total, wk); ot = total - reg; rows.forEach(function(r){ r.reg = r.net; });
    var over = ot; for (var i = rows.length - 1; i >= 0 && over > 0; i--) { var mv = Math.min(rows[i].reg, over); rows[i].reg -= mv; rows[i].ot += mv; over -= mv; } }
  else if (mode === 'both' && reg > wk) { var extra = reg - wk; reg = wk; ot += extra;
    var left = extra; for (var j = rows.length - 1; j >= 0 && left > 0; j--) { var mv2 = Math.min(rows[j].reg, left); rows[j].reg -= mv2; rows[j].ot += mv2; left -= mv2; } }
  var rate = +opts.rate || 0, om = opts.otMult == null ? 1.5 : opts.otMult, dm = opts.dtMult == null ? 2 : opts.dtMult;
  var regPay = r2(reg / 60 * rate), otPay = r2(ot / 60 * rate * om), dtPay = r2(dt / 60 * rate * dm);
  return {days: rows, regMin: reg, otMin: ot, dtMin: dt, totalMin: total, regPay: regPay, otPay: otPay, dtPay: dtPay, gross: r2(regPay + otPay + dtPay)};
}
/* Two or more workweeks: each week is tested on its own (FLSA never averages across weeks), then the lines are added. */
function periodTotals(weeks, opts){
  var ws = weeks.map(function(w){ return weekTotals(w, opts); });
  var s = {weeks: ws, regMin: 0, otMin: 0, dtMin: 0, totalMin: 0, regPay: 0, otPay: 0, dtPay: 0, gross: 0};
  ws.forEach(function(w){ ['regMin', 'otMin', 'dtMin', 'totalMin', 'regPay', 'otPay', 'dtPay', 'gross'].forEach(function(k){ s[k] += w[k]; }); });
  ['regPay', 'otPay', 'dtPay', 'gross'].forEach(function(k){ s[k] = r2(s[k]); });
  return s;
}
/* Overtime pay from hours (decimals): {reg, ot, dt, rate, otMult, dtMult} -> pay lines and gross */
function overtimePay(o){
  var rate = +o.rate || 0, om = o.otMult == null ? 1.5 : o.otMult, dm = o.dtMult == null ? 2 : o.dtMult;
  var reg = r2((o.reg || 0) * rate), ot = r2((o.ot || 0) * rate * om), dt = r2((o.dt || 0) * rate * dm);
  return {regPay: reg, otPay: ot, dtPay: dt, gross: r2(reg + ot + dt), otRate: r2(rate * om), dtRate: r2(rate * dm), hours: (o.reg || 0) + (o.ot || 0) + (o.dt || 0)};
}
/* Common conversion rows: every 5 minutes and quarter hours. */
function minuteTable(step){ var r = []; for (var m = 0; m <= 60; m += step || 1) r.push({min: m, dec: m / 60}); return r; }

/* ---- Military (24-hour) time ---- */
/* parse24('1730' | '17:30' | '0905' | '9:05' | '17' | '2400') -> minutes after midnight, or null. '2400' is read as midnight (0). */
function parse24(str){
  if (str == null) return null; var s = String(str).trim().replace(/\s+/g, '').replace(/(hours|hrs|hr|h)$/i, ''); if (!s) return null;
  var m = /^(\d{1,2}):?(\d{2})$/.exec(s), h, mi;
  if (m) { h = +m[1]; mi = +m[2]; } else if (/^\d{1,2}$/.test(s)) { h = +s; mi = 0; } else return null;
  if (mi > 59) return null; if (h === 24 && mi === 0) return 0; if (h > 23) return null;
  return h * 60 + mi;
}
/* format24(min, colon) -> '17:30' (colon) or '1730' */
function format24(min, colon){ min = ((Math.round(min) % DAY) + DAY) % DAY; var h = Math.floor(min / 60), m = min % 60, hh = (h < 10 ? '0' : '') + h, mm = (m < 10 ? '0' : '') + m; return colon ? hh + ':' + mm : hh + mm; }
var WORDS = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty','twenty-one','twenty-two','twenty-three'];
var TENS = {2:'twenty',3:'thirty',4:'forty',5:'fifty'}, ONES = ['','one','two','three','four','five','six','seven','eight','nine'];
/* How a military time is spoken: 0600 'zero six hundred', 1730 'seventeen thirty', 0905 'zero nine zero five', 0000 'zero zero hundred'. */
function spoken24(min){ min = ((Math.round(min) % DAY) + DAY) % DAY; var h = Math.floor(min / 60), m = min % 60;
  var hw = h < 10 ? 'zero ' + WORDS[h] : WORDS[h];
  if (m === 0) return hw + ' hundred';
  var mw = m < 10 ? 'zero ' + WORDS[m] : m < 20 ? WORDS[m] : TENS[Math.floor(m / 10)] + (m % 10 ? '-' + ONES[m % 10] : '');
  return hw + ' ' + mw; }
/* chart24(step): rows for every 'step' minutes across the day: {min, h24:'13:30', mil:'1330', h12:'1:30 PM'} */
function chart24(step){ var r = []; for (var m = 0; m < DAY; m += step || 60) r.push({min: m, h24: format24(m, true), mil: format24(m, false), h12: formatClock(m)}); return r; }

/* ---- Hourly <-> salary (pre-tax). o: {rate, hours (per week, default 40), weeks (per year, default 52), otHours (extra hours per week, default 0), otMult (1.5)}
   weekly pay = rate*hours + rate*otMult*otHours; annual = weekly * weeks; pay periods = annual / periods per year (52, 26, 24, 12). */
function hourlyToSalary(o){
  var rate = +o.rate || 0, h = o.hours == null || o.hours === '' ? 40 : +o.hours, w = o.weeks == null || o.weeks === '' ? 52 : +o.weeks, ot = +o.otHours || 0, om = o.otMult == null ? 1.5 : +o.otMult;
  var weekWorked = rate * h + rate * om * ot, annual = weekWorked * w;
  return {annual: r2(annual), monthly: r2(annual / 12), semimonthly: r2(annual / 24), biweekly: r2(annual / 26), weekly: r2(annual / 52), weekWorked: r2(weekWorked), daily: r2(rate * h / 5), otAnnual: r2(rate * om * ot * w), hoursYear: round((h + ot) * w, 2)};
}
/* salaryToHourly({annual, hours, weeks}) -> hourly rate = annual / (hours * weeks) */
function salaryToHourly(o){
  var a = +o.annual || 0, h = o.hours == null || o.hours === '' ? 40 : +o.hours, w = o.weeks == null || o.weeks === '' ? 52 : +o.weeks, d = h * w;
  var hr = d > 0 ? a / d : 0; return {hourly: r2(hr), monthly: r2(a / 12), biweekly: r2(a / 26), weekly: r2(a / 52), hoursYear: round(d, 2)};
}

var api = {parse24: parse24, format24: format24, spoken24: spoken24, chart24: chart24, hourlyToSalary: hourlyToSalary, salaryToHourly: salaryToHourly, parseTime: parseTime, parseDuration: parseDuration, durationMinutes: durationMinutes, formatHM: formatHM, formatClock: formatClock, toDecimal: toDecimal, fromDecimal: fromDecimal,
  hoursBetween: hoursBetween, dayNet: dayNet, splitDay: splitDay, weekTotals: weekTotals, periodTotals: periodTotals, overtimePay: overtimePay, minuteTable: minuteTable, r2: r2, round: round};
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TCCalc = api;
})(typeof window !== 'undefined' ? window : this);
