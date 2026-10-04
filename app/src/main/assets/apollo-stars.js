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
  // Hipparcos New Reduction (I/311) positions and linear proper motions for
  // the matching bright stars. Coordinates are ICRS at J1991.25; pmRA is
  // the eastward component mu_alpha*cos(dec), both proper-motion fields in
  // mas/Julian-year. Keep the original Comanche vectors above unchanged.
  const hipparcos = [
    ['01',  677,   2.09653385,  29.09082837,  137.46, -163.44],
    ['02', 3419,  10.89678447, -17.98668407,  232.55,   31.99],
    ['03', 4427,  14.17708782,  60.71674955,   25.17,   -3.92],
    ['04', 7588,  24.42813208, -57.23665985,   87.00,  -38.24],
    ['05',11767,  37.94614300,  89.26413778,   44.48,  -11.85],
    ['06',13847,  44.56548212, -40.30473465,  -52.89,   21.98],
    ['07',14135,  45.56991317,   4.08992556,  -10.41,  -76.85],
    ['10',15863,  51.08061917,  49.86124305,   23.75,  -26.23],
    ['11',21421,  68.98000194,  16.50976158,   63.45, -188.94],
    ['12',24436,  78.63446385,  -8.20163958,    1.31,    0.50],
    ['13',24608,  79.17206466,  45.99902905,   75.25, -426.89],
    ['14',30438,  95.98787790, -52.69571787,   19.93,   23.24],
    ['15',32349, 101.28854105, -16.71314306, -546.01,-1223.07],
    ['16',37279, 114.82724202,   5.22750758, -714.59,-1036.80],
    ['17',39953, 122.38314733, -47.33661168,   -6.07,   10.43],
    ['20',44127, 134.80349431,  48.04234950, -441.29, -215.32],
    ['21',46390, 141.89688204,  -8.65868307,  -15.23,   34.37],
    ['22',49669, 152.09358042,  11.96719519, -248.73,    5.59],
    ['23',57632, 177.26615960,  14.57233678, -497.68, -114.67],
    ['24',59803, 183.95194935, -17.54198359, -158.61,   21.86],
    ['25',60718, 186.64975588, -63.09905674,  -35.83,  -14.86],
    ['26',65474, 201.29835228, -11.16124494,  -42.35,  -30.67],
    ['27',67301, 206.88560910,  49.31330297, -121.17,  -14.91],
    ['30',68933, 211.67218593, -36.36869558, -520.53, -518.06],
    ['31',69673, 213.91811408,  19.18727046,-1093.39,-2000.06],
    ['32',76267, 233.67162276,  26.71491051,  120.27,  -89.58],
    ['33',80763, 247.35194829, -26.43194598,  -12.11,  -23.30],
    ['34',82273, 252.16610734, -69.02763509,   17.99,  -31.58],
    ['35',86032, 263.73335361,  12.56057593,  108.07, -221.57],
    ['36',91262, 279.23410825,  38.78299326,  200.94,  286.23],
    ['37',92855, 283.81631936, -26.29659425,   15.14,  -53.43],
    ['40',97649, 297.69450819,   8.86738473,  536.23,  385.29],
    ['41',100345,305.25269233, -14.78140101,   44.92,    7.38],
    ['42',100751,306.41187379, -56.73488065,    6.90,  -86.02],
    ['43',102098,310.35797281,  45.28033431,    2.01,    1.85],
    ['44',107315,326.04641750,   9.87500758,   26.92,    0.44],
    ['45',113368,344.41177299, -29.62183680,  328.95, -164.67]
  ];
  const d2r=Math.PI/180, r2d=180/Math.PI;
  // Comanche 055 (Apollo 11) uses the 1969/1970 Nearest Besselian Year
  // Basic Reference Coordinate System. Its star vectors are not J2000.
  const starCatalogEpoch=1970.0;
  const hipparcosEpoch=1991.25;
  const hipparcosByCode=new Map(hipparcos.map(([code,hip,ra,dec,pmRaCosDec,pmDec])=>[
    code,{catalog:'Hipparcos New Reduction (I/311)',hip,ra,dec,pmRaCosDec,pmDec,referenceEpoch:hipparcosEpoch}
  ]));
  const wrap360=x=>((x%360)+360)%360;
  const wrap180=x=>((x+180)%360+360)%360-180;
  const stars=raw.map(([internal,code,name,x,y,z,mag])=>({
    internal,code,name,x,y,z,mag,
    coordinateEpoch:starCatalogEpoch,
    astrometry:hipparcosByCode.get(code),
    ra:wrap360(Math.atan2(y,x)*r2d),
    dec:Math.asin(Math.max(-1,Math.min(1,z)))*r2d
  }));

  function julianDate(date=new Date()){return date.getTime()/86400000+2440587.5}
  function julianEpoch(date=new Date()){return 2000+(julianDate(date)-2451545.0)/365.25}
  // Lieske/IAU 1976 precession, matching the IAU SOFA prec76/pmat76 model.
  // Inputs and output are mean equator/equinox coordinates; proper motion and
  // nutation are not present in the historical AGC star table.
  function precessEquatorial(raDeg,decDeg,fromEpoch,toEpoch){
    if(fromEpoch===toEpoch)return {ra:wrap360(raDeg),dec:decDeg};
    const T=(fromEpoch-2000)/100,t=(toEpoch-fromEpoch)/100;
    const zeta=((2306.2181+(1.39656-.000139*T)*T)*t+(.30188-.000344*T)*t*t+.017998*t*t*t)/3600*d2r;
    const z=((2306.2181+(1.39656-.000139*T)*T)*t+(1.09468+.000066*T)*t*t+.018203*t*t*t)/3600*d2r;
    const theta=((2004.3109+(-.85330-.000217*T)*T)*t+(-.42665-.000217*T)*t*t-.041833*t*t*t)/3600*d2r;
    const ra=raDeg*d2r,dec=decDeg*d2r;
    const A=Math.cos(dec)*Math.sin(ra+zeta);
    const B=Math.cos(theta)*Math.cos(dec)*Math.cos(ra+zeta)-Math.sin(theta)*Math.sin(dec);
    const C=Math.sin(theta)*Math.cos(dec)*Math.cos(ra+zeta)+Math.cos(theta)*Math.sin(dec);
    return {ra:wrap360((Math.atan2(A,B)+z)*r2d),dec:Math.asin(Math.max(-1,Math.min(1,C)))*r2d};
  }
  function propagateProperMotion(astrometry,toEpoch){
    const dt=toEpoch-astrometry.referenceEpoch,ra=astrometry.ra*d2r,dec=astrometry.dec*d2r;
    const cosRa=Math.cos(ra),sinRa=Math.sin(ra),cosDec=Math.cos(dec),sinDec=Math.sin(dec);
    const direction=[cosDec*cosRa,cosDec*sinRa,sinDec];
    const east=[-sinRa,cosRa,0],north=[-sinDec*cosRa,-sinDec*sinRa,cosDec];
    const eastOffset=astrometry.pmRaCosDec*dt*d2r/3600000;
    const northOffset=astrometry.pmDec*dt*d2r/3600000;
    const distance=Math.hypot(eastOffset,northOffset);
    if(distance===0)return {ra:wrap360(astrometry.ra),dec:astrometry.dec};
    const tangentScale=Math.sin(distance)/distance,radialScale=Math.cos(distance);
    const x=radialScale*direction[0]+tangentScale*(eastOffset*east[0]+northOffset*north[0]);
    const y=radialScale*direction[1]+tangentScale*(eastOffset*east[1]+northOffset*north[1]);
    const z=radialScale*direction[2]+tangentScale*(eastOffset*east[2]+northOffset*north[2]);
    return {ra:wrap360(Math.atan2(y,x)*r2d),dec:Math.asin(Math.max(-1,Math.min(1,z)))*r2d};
  }
  function equatorialOfDate(star,date=new Date()){
    const epoch=julianEpoch(date);
    if(star.astrometry){
      const position=propagateProperMotion(star.astrometry,epoch);
      // Hipparcos astrometry is ICRS (effectively the J2000 inertial frame);
      // precess the propagated direction to the observation-date mean frame.
      return precessEquatorial(position.ra,position.dec,2000.0,epoch);
    }
    return precessEquatorial(star.ra,star.dec,starCatalogEpoch,epoch);
  }
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
    const position=equatorialOfDate(star,date);
    return horizontalRaDec(position.ra,position.dec,latDeg,lonDeg,date);
  }
  function sunEquatorial(date=new Date()){
    const n=julianDate(date)-2451545.0,L=wrap360(280.460+.9856474*n),g=wrap360(357.528+.9856003*n)*d2r;
    const lam=wrap360(L+1.915*Math.sin(g)+.020*Math.sin(2*g))*d2r,eps=(23.439-.0000004*n)*d2r;
    return {ra:wrap360(Math.atan2(Math.cos(eps)*Math.sin(lam),Math.cos(lam))*r2d),dec:Math.asin(Math.sin(eps)*Math.sin(lam))*r2d};
  }
  function skyConditions(lat,lon,date=new Date()){
    const sun=sunEquatorial(date),sunPos=horizontalRaDec(sun.ra,sun.dec,lat,lon,date),a=sunPos.alt;
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
    return {distance,angle:Math.atan2(x,y)*r2d};
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
        if(sep<40||sep>66)continue;
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
  window.AGCDSKY_SERVICE_REGISTRY.publish('AGCDSKY_APOLLO_STARS',{stars,horizontal,horizontalRaDec,equatorialOfDate,sunEquatorial,skyConditions,angularSeparation,bearingDelta,candidatePairs,bestPair,wrap180,wrap360},'apollo-stars publication');
})();
