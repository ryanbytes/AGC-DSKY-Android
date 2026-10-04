'use strict';

// WMM2025 Gauss coefficients published by NOAA NCEI. U.S. Government work;
// see THIRD_PARTY.md for attribution and the model's 2025-2030 validity.
(() => {
  const COEFFICIENTS=`2025.0 WMM-2025
1 0 -29351.8 0.0 12.0 0.0
1 1 -1410.8 4545.4 9.7 -21.5
2 0 -2556.6 0.0 -11.6 0.0
2 1 2951.1 -3133.6 -5.2 -27.7
2 2 1649.3 -815.1 -8.0 -12.1
3 0 1361.0 0.0 -1.3 0.0
3 1 -2404.1 -56.6 -4.2 4.0
3 2 1243.8 237.5 0.4 -0.3
3 3 453.6 -549.5 -15.6 -4.1
4 0 895.0 0.0 -1.6 0.0
4 1 799.5 278.6 -2.4 -1.1
4 2 55.7 -133.9 -6.0 4.1
4 3 -281.1 212.0 5.6 1.6
4 4 12.1 -375.6 -7.0 -4.4
5 0 -233.2 0.0 0.6 0.0
5 1 368.9 45.4 1.4 -0.5
5 2 187.2 220.2 0.0 2.2
5 3 -138.7 -122.9 0.6 0.4
5 4 -142.0 43.0 2.2 1.7
5 5 20.9 106.1 0.9 1.9
6 0 64.4 0.0 -0.2 0.0
6 1 63.8 -18.4 -0.4 0.3
6 2 76.9 16.8 0.9 -1.6
6 3 -115.7 48.8 1.2 -0.4
6 4 -40.9 -59.8 -0.9 0.9
6 5 14.9 10.9 0.3 0.7
6 6 -60.7 72.7 0.9 0.9
7 0 79.5 0.0 -0.0 0.0
7 1 -77.0 -48.9 -0.1 0.6
7 2 -8.8 -14.4 -0.1 0.5
7 3 59.3 -1.0 0.5 -0.8
7 4 15.8 23.4 -0.1 0.0
7 5 2.5 -7.4 -0.8 -1.0
7 6 -11.1 -25.1 -0.8 0.6
7 7 14.2 -2.3 0.8 -0.2
8 0 23.2 0.0 -0.1 0.0
8 1 10.8 7.1 0.2 -0.2
8 2 -17.5 -12.6 0.0 0.5
8 3 2.0 11.4 0.5 -0.4
8 4 -21.7 -9.7 -0.1 0.4
8 5 16.9 12.7 0.3 -0.5
8 6 15.0 0.7 0.2 -0.6
8 7 -16.8 -5.2 -0.0 0.3
8 8 0.9 3.9 0.2 0.2
9 0 4.6 0.0 -0.0 0.0
9 1 7.8 -24.8 -0.1 -0.3
9 2 3.0 12.2 0.1 0.3
9 3 -0.2 8.3 0.3 -0.3
9 4 -2.5 -3.3 -0.3 0.3
9 5 -13.1 -5.2 0.0 0.2
9 6 2.4 7.2 0.3 -0.1
9 7 8.6 -0.6 -0.1 -0.2
9 8 -8.7 0.8 0.1 0.4
9 9 -12.9 10.0 -0.1 0.1
10 0 -1.3 0.0 0.1 0.0
10 1 -6.4 3.3 0.0 0.0
10 2 0.2 0.0 0.1 -0.0
10 3 2.0 2.4 0.1 -0.2
10 4 -1.0 5.3 -0.0 0.1
10 5 -0.6 -9.1 -0.3 -0.1
10 6 -0.9 0.4 0.0 0.1
10 7 1.5 -4.2 -0.1 0.0
10 8 0.9 -3.8 -0.1 -0.1
10 9 -2.7 0.9 -0.0 0.2
10 10 -3.9 -9.1 -0.0 -0.0
11 0 2.9 0.0 0.0 0.0
11 1 -1.5 0.0 -0.0 -0.0
11 2 -2.5 2.9 0.0 0.1
11 3 2.4 -0.6 0.0 -0.0
11 4 -0.6 0.2 0.0 0.1
11 5 -0.1 0.5 -0.1 -0.0
11 6 -0.6 -0.3 0.0 -0.0
11 7 -0.1 -1.2 -0.0 0.1
11 8 1.1 -1.7 -0.1 -0.0
11 9 -1.0 -2.9 -0.1 0.0
11 10 -0.2 -1.8 -0.1 0.0
11 11 2.6 -2.3 -0.1 0.0
12 0 -2.0 0.0 0.0 0.0
12 1 -0.2 -1.3 0.0 -0.0
12 2 0.3 0.7 -0.0 0.0
12 3 1.2 1.0 -0.0 -0.1
12 4 -1.3 -1.4 -0.0 0.1
12 5 0.6 -0.0 -0.0 -0.0
12 6 0.6 0.6 0.1 -0.0
12 7 0.5 -0.1 -0.0 -0.0
12 8 -0.1 0.8 0.0 0.0
12 9 -0.4 0.1 0.0 -0.0
12 10 -0.2 -1.0 -0.1 -0.0
12 11 -1.3 0.1 -0.0 0.0
12 12 -0.7 0.2 -0.1 -0.1
9999 0 0 0 0 0`;
  const DEGREE=12,REFERENCE_RADIUS_KM=6371.2;
  const g=Array.from({length:DEGREE+1},()=>[]),h=Array.from({length:DEGREE+1},()=>[]);
  const dg=Array.from({length:DEGREE+1},()=>[]),dh=Array.from({length:DEGREE+1},()=>[]);
  for(const line of COEFFICIENTS.split('\n').slice(1)){
    const values=line.trim().split(/\s+/).map(Number),n=values[0],m=values[1];
    if(n===9999)break;
    g[n][m]=values[2];h[n][m]=values[3];dg[n][m]=values[4];dh[n][m]=values[5];
  }

  function decimalYear(date){
    const time=date&&typeof date.getTime==='function'?date.getTime():Number(date);
    if(!Number.isFinite(time))return NaN;
    const d=new Date(time),year=d.getUTCFullYear();
    const start=Date.UTC(year,0,1),end=Date.UTC(year+1,0,1);
    return year+(time-start)/(end-start);
  }

  function field(latitudeDeg,longitudeDeg,altitudeMeters,date){
    const lat=Number(latitudeDeg),lon=Number(longitudeDeg),alt=Number(altitudeMeters),year=decimalYear(date);
    if(![lat,lon,alt,year].every(Number.isFinite)||lat < -90||lat > 90||lon < -180||lon > 180
        ||alt < -1000||alt > 850000||year < 2025||year >= 2030||Math.abs(lat)>=89.999999)return null;

    // Geodetic (WGS84) to geocentric coordinates, following the WMM reference
    // equations. Altitude is metres above the WGS84 ellipsoid, as supplied by
    // Android and the Geolocation API.
    const a=6378.137,b=6356.7523142,a2=a*a,b2=b*b,altKm=alt/1000;
    const gdLat=lat*Math.PI/180,cosLat=Math.cos(gdLat),sinLat=Math.sin(gdLat);
    const latRadius=Math.sqrt(a2*cosLat*cosLat+b2*sinLat*sinLat);
    const gcLat=Math.atan((sinLat/cosLat)*(latRadius*altKm+b2)/(latRadius*altKm+a2));
    const radiusSq=altKm*altKm+2*altKm*latRadius
      +(a2*a2*cosLat*cosLat+b2*b2*sinLat*sinLat)/(a2*cosLat*cosLat+b2*sinLat*sinLat);
    const gcRadius=Math.sqrt(radiusSq),theta=Math.PI/2-gcLat;

    // Gauss-normalized associated Legendre functions and theta derivatives.
    const p=Array.from({length:DEGREE+1},()=>[]),pDeriv=Array.from({length:DEGREE+1},()=>[]);
    p[0][0]=1;pDeriv[0][0]=0;
    const ct=Math.cos(theta),st=Math.sin(theta);
    for(let n=1;n<=DEGREE;n++)for(let m=0;m<=n;m++){
      if(n===m){p[n][m]=st*p[n-1][m-1];pDeriv[n][m]=ct*p[n-1][m-1]+st*pDeriv[n-1][m-1]}
      else if(n===1||m===n-1){p[n][m]=ct*p[n-1][m];pDeriv[n][m]=-st*p[n-1][m]+ct*pDeriv[n-1][m]}
      else{const k=((n-1)*(n-1)-m*m)/((2*n-1)*(2*n-3));p[n][m]=ct*p[n-1][m]-k*p[n-2][m];pDeriv[n][m]=-st*p[n-1][m]+ct*pDeriv[n-1][m]-k*pDeriv[n-2][m]}
    }
    const schmidt=Array.from({length:DEGREE+1},()=>[]);schmidt[0][0]=1;
    for(let n=1;n<=DEGREE;n++){
      schmidt[n][0]=schmidt[n-1][0]*(2*n-1)/n;
      for(let m=1;m<=n;m++)schmidt[n][m]=schmidt[n][m-1]*Math.sqrt((n-m+1)*(m===1?2:1)/(n+m));
    }

    const radiusPower=[1,REFERENCE_RADIUS_KM/gcRadius];
    for(let i=2;i<=DEGREE+2;i++)radiusPower[i]=radiusPower[i-1]*radiusPower[1];
    const lonRad=lon*Math.PI/180,sinMLon=[0],cosMLon=[1];
    sinMLon[1]=Math.sin(lonRad);cosMLon[1]=Math.cos(lonRad);
    for(let m=2;m<=DEGREE;m++){
      const x=m>>1;sinMLon[m]=sinMLon[m-x]*cosMLon[x]+cosMLon[m-x]*sinMLon[x];
      cosMLon[m]=cosMLon[m-x]*cosMLon[x]-sinMLon[m-x]*sinMLon[x];
    }

    const years=year-2025,inverseCosLatitude=1/Math.cos(gcLat);let gcX=0,gcY=0,gcZ=0;
    for(let n=1;n<=DEGREE;n++)for(let m=0;m<=n;m++){
      const gNow=g[n][m]+years*dg[n][m],hNow=h[n][m]+years*dh[n][m];
      const term=gNow*cosMLon[m]+hNow*sinMLon[m];
      gcX+=radiusPower[n+2]*term*pDeriv[n][m]*schmidt[n][m];
      gcY+=radiusPower[n+2]*m*(gNow*sinMLon[m]-hNow*cosMLon[m])*p[n][m]*schmidt[n][m]*inverseCosLatitude;
      gcZ-=(n+1)*radiusPower[n+2]*term*p[n][m]*schmidt[n][m];
    }
    const latitudeDifference=gdLat-gcLat;
    const x=gcX*Math.cos(latitudeDifference)+gcZ*Math.sin(latitudeDifference);
    const y=gcY,z=-gcX*Math.sin(latitudeDifference)+gcZ*Math.cos(latitudeDifference);
    const horizontalIntensityNt=Math.hypot(x,y);
    if(!Number.isFinite(horizontalIntensityNt)||horizontalIntensityNt<=0)return null;
    const declinationDeg=Math.atan2(y,x)*180/Math.PI;
    const uncertaintyDeg=Math.sqrt(0.26*0.26+Math.pow(5417/horizontalIntensityNt,2));
    return Object.freeze({model:'WMM2025',decimalYear:year,declinationDeg,horizontalIntensityNt,uncertaintyDeg,
      blackout:horizontalIntensityNt<2000,caution:horizontalIntensityNt<6000});
  }

  window.AGCDSKY_SERVICE_REGISTRY.publish('AGCDSKY_WMM2025',Object.freeze({field,decimalYear,validFrom:2025,validUntil:2030}),
    'WMM2025 geomagnetic model publication');
})();
