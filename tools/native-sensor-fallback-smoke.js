#!/usr/bin/env node
'use strict';

const fs=require('fs');
const os=require('os');
const path=require('path');
const {execFileSync}=require('child_process');

const root=path.resolve(__dirname,'..');
const source=path.join(root,'app/src/main/java/org/apollo/agcdsky/AccelerometerGravityFilter.java');
const registrationSource=path.join(root,'app/src/main/java/org/apollo/agcdsky/SensorRegistrationPolicy.java');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'agcdsky-sensor-filter-'));
const testSource=path.join(temp,'NativeSensorFallbackTest.java');
const javaTest=`package org.apollo.agcdsky;
import java.util.ArrayList;
import java.util.List;
public final class NativeSensorFallbackTest {
  private static void check(boolean condition,String message){if(!condition)throw new AssertionError(message);}
  private static void near(float actual,float expected,String message){if(Math.abs(actual-expected)>1.0e-5f)throw new AssertionError(message+": "+actual+" != "+expected);}
  private static final class FakeRegistrar implements SensorRegistrationPolicy.Registrar {
    final List<SensorRegistrationPolicy.SensorKind> calls=new ArrayList<>();
    final boolean attitude,magnetic,linear,gravity,accelerometer;
    FakeRegistrar(boolean attitude,boolean magnetic,boolean linear,boolean gravity,boolean accelerometer){
      this.attitude=attitude;this.magnetic=magnetic;this.linear=linear;this.gravity=gravity;this.accelerometer=accelerometer;
    }
    public boolean register(SensorRegistrationPolicy.SensorKind sensor){
      calls.add(sensor);
      switch(sensor){case ATTITUDE:return attitude;case MAGNETIC_ATTITUDE:return magnetic;
        case LINEAR_ACCELERATION:return linear;case GRAVITY:return gravity;case ACCELEROMETER:return accelerometer;
        default:throw new AssertionError("unhandled sensor kind: "+sensor);}
    }
  }
  public static void main(String[] args){
    FakeRegistrar preferred=new FakeRegistrar(true,true,true,false,false);
    SensorRegistrationPolicy.Result preferredResult=SensorRegistrationPolicy.register(preferred,true,true,false,true,true,true);
    check(preferredResult.linearAccelerationRegistered&&preferredResult.accelerationAvailable(),"successful preferred linear sensor must be active");
    check(preferred.calls.size()==3&&!preferred.calls.contains(SensorRegistrationPolicy.SensorKind.GRAVITY)
      &&!preferred.calls.contains(SensorRegistrationPolicy.SensorKind.ACCELEROMETER),"fallback sensors must not register when preferred succeeds");

    FakeRegistrar gravityFallback=new FakeRegistrar(false,false,false,true,true);
    SensorRegistrationPolicy.Result gravityResult=SensorRegistrationPolicy.register(gravityFallback,true,true,false,true,true,true);
    check(!gravityResult.linearAccelerationRegistered&&gravityResult.gravityRegistered&&gravityResult.accelerometerRegistered,
      "failed linear registration must attempt gravity and accelerometer registrations");
    check("accelerometer_minus_gravity".equals(gravityResult.accelerationSource()),"registered gravity must select vector subtraction");

    FakeRegistrar lowPassFallback=new FakeRegistrar(false,false,false,false,true);
    SensorRegistrationPolicy.Result lowPassResult=SensorRegistrationPolicy.register(lowPassFallback,true,false,false,true,true,true);
    check(lowPassResult.accelerometerRegistered&&!lowPassResult.gravityRegistered
      &&"accelerometer_lowpass".equals(lowPassResult.accelerationSource()),"failed gravity registration must select low-pass fallback");

    FakeRegistrar noAcceleration=new FakeRegistrar(false,false,false,false,false);
    SensorRegistrationPolicy.Result unavailable=SensorRegistrationPolicy.register(noAcceleration,true,false,false,true,true,true);
    check(!unavailable.accelerationAvailable()&&"none".equals(unavailable.accelerationSource()),"failed fallback registrations must report acceleration unavailable");
    check(noAcceleration.calls.get(noAcceleration.calls.size()-1)==SensorRegistrationPolicy.SensorKind.ACCELEROMETER,
      "accelerometer must still be attempted after gravity registration fails");

    FakeRegistrar sharedAttitude=new FakeRegistrar(true,false,false,false,false);
    SensorRegistrationPolicy.Result sharedResult=SensorRegistrationPolicy.register(sharedAttitude,true,true,true,false,false,false);
    check(sharedResult.attitudeRegistered&&sharedAttitude.calls.size()==1,
      "magnetic status sharing the attitude sensor must not register the same sensor twice");

    AccelerometerGravityFilter filter=new AccelerometerGravityFilter();
    check(filter.removeGravity(0,0,9.81f,1_000_000_000L,true)==null,
      "raw accelerometer sample escaped before the registered gravity stream's first sample");
    filter.onGravitySample(0,0,9.81f);
    float[] corrected=filter.removeGravity(0,0,9.81f,1_020_000_000L,true);
    near(corrected[0],0,"gravity subtraction x");near(corrected[1],0,"gravity subtraction y");near(corrected[2],0,"gravity subtraction z");
    corrected=filter.removeGravity(1,-2,10.81f,1_040_000_000L,true);
    near(corrected[0],1,"linear acceleration x");near(corrected[1],-2,"linear acceleration y");near(corrected[2],1,"linear acceleration z");

    filter.reset();
    corrected=filter.removeGravity(0,0,9.81f,2_000_000_000L,false);
    near(corrected[2],0,"low-pass initialization must not create a gravity impulse");
    corrected=filter.removeGravity(0,0,10.81f,2_020_000_000L,false);
    near(corrected[2],0.92f,"20 ms sample interval must preserve the nominal alpha 0.92 response");
    corrected=filter.removeGravity(0,0,10.81f,2_060_000_000L,false);
    float alpha=0.23f/(0.23f+0.04f);
    float expected=10.81f-(9.89f*alpha+10.81f*(1.0f-alpha));
    near(corrected[2],expected,"filter coefficient must follow the actual 40 ms sample interval");

    filter.reset();
    check(filter.removeGravity(0,0,9.81f,3_000_000_000L,true)==null,
      "reset must clear the prior gravity sample before the next sensor registration");
    System.out.println("Native sensor registration and accelerometer fallback smoke: PASS");
    System.out.println("  preferred registration, fallback order, unavailable state, shared attitude sensor, registered-gravity readiness, subtraction, and irregular timing verified against production Java");
  }
}`;

try{
  fs.writeFileSync(testSource,javaTest);
  execFileSync('javac',['-d',temp,source,registrationSource,testSource],{stdio:'inherit'});
  execFileSync('java',['-cp',temp,'org.apollo.agcdsky.NativeSensorFallbackTest'],{stdio:'inherit'});
}finally{
  fs.rmSync(temp,{recursive:true,force:true});
}
