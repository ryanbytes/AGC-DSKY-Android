'use strict';
/*
 * Apollo 11 CM navigation-star catalog aid.
 *
 * Vectors are the 37 entries in Comanche055/STAR_TABLES.agc.  The displayed
 * two-digit codes below are the astronaut DSKY star codes (octal-style):
 * internal catalog index 8 is DSKY code 10, etc.  This module is phone-side
 * reference material only.  It never writes star vectors, REFSMMAT, nouns,
 * or any AGC state; P51 still receives only optics MARK data and the code the
 * astronaut keys on the DSKY.
 */
(() => {
  const raw = [
    [1,'01','ALPHERATZ', .8748658918, .0260879174, .4836621670, 2.06],
    [2,'02','DIPHDA', .9342640400, .1735073142,-.3115219339, 2.04],
    [3,'03','NAVI', .4775639450, .1166004340, .8708254803, 2.47],
    [4,'04','ACHERNAR', .4917678276, .2204887125,-.8423473935, 0.46],
    [5,'05','POLARIS', .0130968840, .0078062795, .9998837600, 1.98],
    [6,'06','ACAMAR', .5450107404, .5314955466,-.6484410356, 2.88],
    [7,'07','MENKAR', .7032235469, .7075846047, .0692868685, 2.54],
    [8,'10','MIRFAK', .4105636020, .4988110001, .7632988371, 1.79],
    [9,'11','ALDEBARAN', .3507315038, .8926333307, .2831839492, 0.85],
    [10,'12','RIGEL', .2011399589, .9690337941,-.1432348512, 0.13],
    [11,'13','CAPELLA', .1371725575, .6813721061, .7189685267, 0.08],
    [12,'14','CANOPUS',-.0614937230, .6031563286,-.7952489957,-0.74],
    [13,'15','SIRIUS',-.1820751783, .9404899869,-.2869271926,-1.46],
    [14,'16','PROCYON',-.4118589524, .9065485360, .0924226975, 0.34],
    [15,'17','REGOR',-.3612508532, .5747270840,-.7342932655, 1.75],
    [16,'20','DNOCES',-.4657947941, .4774785033, .7450164351, 3.14],
    [17,'21','ALPHARD',-.7742591356, .6152504197,-.1482892839, 1.98],
    [18,'22','REGULUS',-.8608205219, .4636213989, .2098647835, 1.35],
    [19,'23','DENEBOLA',-.9656605484, .0525933156, .2544280809, 2.14],
    [20,'24','GIENAH',-.9525211695,-.0593434796,-.2986331746, 2.59],
    [21,'25','ACRUX',-.4523440203,-.0493710140,-.8904759346, 0.76],
    [22,'26','SPICA',-.9170097662,-.3502146628,-.1908999176, 0.98],
    [23,'27','ALKAID',-.5812035376,-.2909171294, .7599800468, 1.86],
    [24,'30','MENKENT',-.6898393233,-.4182330640,-.5909338474, 2.06],
    [25,'31','ARCTURUS',-.7861763936,-.5217996305, .3311371675,-0.05],
    [26,'32','ALPHECCA',-.5326876930,-.7160644554, .4511047742, 2.23],
    [27,'33','ANTARES',-.3516499609,-.8240752703,-.4441196390, 0.96],
    [28,'34','ATRIA',-.1146237858,-.3399692557,-.9334250333, 1.91],
    [29,'35','RASALHAGUE',-.1124304773,-.9694934200, .2178116072, 2.07],
    [30,'36','VEGA', .1217293692,-.7702732847, .6259880410, 0.03],
    [31,'37','NUNKI', .2069525789,-.8719885748,-.4436288486, 2.05],
    [32,'40','ALTAIR', .4537196908,-.8779508801, .1527766153, 0.77],
    [33,'41','DABIH', .5520184464,-.7933187400,-.2567508745, 3.05],
    [34,'42','PEACOCK', .3201817378,-.4436021946,-.8370786986, 1.94],
    [35,'43','DENEB', .4541086270,-.5392368197, .7092312789, 1.25],
    [36,'44','ENIF', .8139832631,-.5557243189, .1691204557, 2.40],
    [37,'45','FOMALHAUT', .8342971408,-.2392481515,-.4966976975, 1.16]
  ];
  const d2r=Math.PI/180, r2d=180/Math.PI;
  const wrap360=x=>((x%360)+360)%360;
  const wrap180=x=>((x+180)%360+360)%360-180;
  const stars=raw.map(([internal,code,name,x,y,z,mag])=>({
    internal,code,name,x,y,z,mag,
    ra:wrap360(Math.atan2(y,x)*r2d),
    dec:Math.asin(Math.max(-1,Math.min(1,z)))*r2d
  }));

  function julianDate(date=new Date()){return date.getTime()/86400000+2440587.5}
  function gmstDeg(date=new Date()){
    const jd=julianDate(date),t=(jd-2451545.0)/36525;
    return wrap360(280.46061837+360.98564736629*(jd-2451545.0)+.000387933*t*t-t*t*t/38710000);
  }
  function horizontalRaDec(raDeg,decDeg,latDeg,lonDeg,date=new Date()){
    const lat=latDeg*d2r,H=wrap180(gmstDeg(date)+lonDeg-raDeg)*d2r,dec=decDeg*d2r;
    const east=-Math.cos(dec)*Math.sin(H);
    const north=Math.sin(dec)*Math.cos(lat)-Math.cos(dec)*Math.cos(H)*Math.sin(lat);
    const up=Math.sin(dec)*Math.sin(lat)+Math.cos(dec)*Math.cos(H)*Math.cos(lat);
    return {az:wrap360(Math.atan2(east,north)*r2d),alt:Math.asin(Math.max(-1,Math.min(1,up)))*r2d};
  }
  function horizontal(star,latDeg,lonDeg,date=new Date()){
    return horizontalRaDec(star.ra,star.dec,latDeg,lonDeg,date);
  }
  function sunEquatorial(date=new Date()){
    const n=julianDate(date)-2451545.0,L=wrap360(280.460+.9856474*n),g=wrap360(357.528+.9856003*n)*d2r;
    const lam=wrap360(L+1.915*Math.sin(g)+.020*Math.sin(2*g))*d2r,eps=(23.439-.0000004*n)*d2r;
    return {ra:wrap360(Math.atan2(Math.cos(eps)*Math.sin(lam),Math.cos(lam))*r2d),dec:Math.asin(Math.sin(eps)*Math.sin(lam))*r2d};
  }
  function skyConditions(lat,lon,date=new Date()){
    const sun=sunEquatorial(date),sunPos=horizontalRaDec(sun.ra,sun.dec,lat,lon,date),a=sunPos.alt;
    // Approximate naked-eye/phone-camera usability. The pair search falls back
    // to geometric visibility if this strict threshold produces no valid pair.
    let maxMag=3.4,label='NIGHT';
    if(a>-2){maxMag=-.3;label='DAYLIGHT'}
    else if(a>-6){maxMag=.5;label='CIVIL TWILIGHT'}
    else if(a>-12){maxMag=1.8;label='NAUTICAL TWILIGHT'}
    else if(a>-18){maxMag=2.8;label='ASTRONOMICAL TWILIGHT'}
    return {sunAlt:a,maxMag,label};
  }
  function angularSeparation(a,b){
    const dot=Math.max(-1,Math.min(1,a.x*b.x+a.y*b.y+a.z*b.z));
    return Math.acos(dot)*r2d;
  }
  function bearingDelta(pointing,target){
    const alt1=pointing.alt*d2r,alt2=target.alt*d2r,da=wrap180(target.az-pointing.az)*d2r;
    const cosd=Math.sin(alt1)*Math.sin(alt2)+Math.cos(alt1)*Math.cos(alt2)*Math.cos(da);
    const distance=Math.acos(Math.max(-1,Math.min(1,cosd)))*r2d;
    const x=Math.cos(alt2)*Math.sin(da);
    const y=Math.cos(alt1)*Math.sin(alt2)-Math.sin(alt1)*Math.cos(alt2)*Math.cos(da);
    return {distance,angle:Math.atan2(x,y)*r2d}; // 0 up, +90 right
  }
  function candidatePairs(lat,lon,date=new Date(),minAlt=12,limit=6){
    if(!Number.isFinite(lat)||!Number.isFinite(lon))return {pairs:[],conditions:null,strict:false,visibleCount:0};
    const conditions=skyConditions(lat,lon,date);
    const geometric=stars.map(star=>({star,pos:horizontal(star,lat,lon,date)})).filter(x=>x.pos.alt>=minAlt);
    const likely=geometric.filter(x=>x.star.mag<=conditions.maxMag);
    function build(pool,strict){
      const pairs=[];
      for(let i=0;i<pool.length;i++)for(let j=i+1;j<pool.length;j++){
        const a=pool[i],b=pool[j],sep=angularSeparation(a.star,b.star);
        if(sep<40||sep>66)continue; // Comanche PICAPAR separation window.
        const brightness=-(a.star.mag+b.star.mag),altitude=a.pos.alt+b.pos.alt;
        const score=altitude*.75+brightness*8-Math.abs(sep-53)*.22;
        pairs.push({a,b,sep,score,strict,conditions});
      }
      pairs.sort((x,y)=>y.score-x.score);
      return pairs.slice(0,Math.max(1,limit|0));
    }
    let pairs=build(likely,true),strict=true;
    if(!pairs.length){pairs=build(geometric,false);strict=false}
    return {pairs,conditions,strict,visibleCount:likely.length,geometricCount:geometric.length};
  }
  function bestPair(lat,lon,date=new Date(),minAlt=12){
    const r=candidatePairs(lat,lon,date,minAlt,1);return r.pairs[0]||null;
  }
  window.AGCDSKY_APOLLO_STARS={stars,horizontal,horizontalRaDec,sunEquatorial,skyConditions,angularSeparation,bearingDelta,candidatePairs,bestPair,wrap180,wrap360};
})();
