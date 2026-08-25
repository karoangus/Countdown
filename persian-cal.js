/**
 * Persian (Jalali) Calendar Utility
 * Pure JS — no dependencies
 */

const PersianCal = (() => {

  // Gregorian → Jalali
  function toJalali(gy, gm, gd) {
    const g_d_no = [31,28+leapG(gy),31,30,31,30,31,31,30,31,30,31];
    let jy,jm,jd,g_y,g_dy,j_dy,i,ij;
    if (gy > 1600) { jy=979; g_y=gy-1600; }
    else           { jy=0;   g_y=gy-621;  }
    let g2 = (gm-1===1) ? leapG(gy) : 0;
    g_dy = 365*g_y + Math.floor((g_y+3)/4) - Math.floor((g_y+99)/100) + Math.floor((g_y+399)/400);
    for(i=0;i<gm-1;i++) g_dy += g_d_no[i];
    g_dy += g2 + gd;
    j_dy = g_dy - 79;
    let j_y = Math.floor((j_dy-1)/365.25);
    if(j_dy <= 365*j_y) j_y--;
    let j_tx = j_dy - 365*j_y - Math.floor(j_y/4);
    jy += 33*j_y + 3*Math.floor(j_tx/400);
    if(j_tx>=400){j_tx%=400; jy++;}
    j_dy=Math.floor(j_tx/29.5);
    jm=j_dy+1;
    jd=Math.ceil(j_tx - 29.5*j_dy);
    if(jm>6&&jd===0){jm--;jd=30;}
    if(jm===0){jm=12;jy--;jd=29;}
    return {y:jy,m:jm,d:jd};
  }

  // Jalali → Gregorian
  function toGregorian(jy, jm, jd) {
    let gy,gm,gd;
    let jy2=jy-979, jm2=jm-1, jd2=jd-1;
    let j_day_no = 365*jy2 + Math.floor(jy2/33)*8 + Math.floor((jy2%33+3)/4);
    for(let i=0;i<jm2;i++) j_day_no += [31,31,31,31,31,31,30,30,30,30,30,29][i];
    j_day_no += jd2;
    let g_day_no = j_day_no + 79;
    let g_y = 1600 + 400*Math.floor(g_day_no/146097); g_day_no %= 146097;
    let leap=true;
    if(g_day_no>=36525){g_day_no--;g_y+=100*Math.floor(g_day_no/36524);g_day_no%=36524;if(g_day_no>=365){g_day_no++;}else{leap=false;}}
    g_y+=4*Math.floor(g_day_no/1461); g_day_no%=1461;
    if(g_day_no>=366){leap=false;g_day_no--;g_y+=Math.floor(g_day_no/365);g_day_no%=365;}
    const g_d_no=[31,29-(!leap?1:0),31,30,31,30,31,31,30,31,30,31];
    let gi;
    for(gi=0;g_day_no>=g_d_no[gi];gi++) g_day_no-=g_d_no[gi];
    gm=gi+1; gd=g_day_no+1;
    return {y:g_y,m:gm,d:gd};
  }

  function leapG(y){ return ((y%4===0&&y%100!==0)||y%400===0)?1:0; }

  function leapJ(y){
    const breaks=[474,973,1472,1920,2420,2970,3520,4119,4666,5189,5765,6288,6840,7384,7895,8401,8966,9289];
    let j,n=y-474;
    let m=474+n%2820;
    return ((m+38)*682)%2816<682 ? 1 : 0;
  }

  function daysInMonth(jy,jm){
    if(jm<=6) return 31;
    if(jm<=11) return 30;
    return leapJ(jy)?30:29;
  }

  // Returns today in Jalali
  function today(){
    const now=new Date();
    return toJalali(now.getFullYear(),now.getMonth()+1,now.getDate());
  }

  // Jalali date → JS Date object
  function toDate(jy,jm,jd,h,min){
    const g=toGregorian(jy,jm,jd);
    return new Date(g.y,g.m-1,g.d,h||0,min||0,0,0);
  }

  // JS Date → Jalali object
  function fromDate(d){
    return toJalali(d.getFullYear(),d.getMonth()+1,d.getDate());
  }

  const MONTH_NAMES=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
  const DAY_NAMES=['ش','ی','د','س','چ','پ','ج'];

  return {toJalali,toGregorian,toDate,fromDate,today,daysInMonth,MONTH_NAMES,DAY_NAMES,leapJ};
})();
