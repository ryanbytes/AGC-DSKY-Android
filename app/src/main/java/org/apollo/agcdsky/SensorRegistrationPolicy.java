package org.apollo.agcdsky;

/** Keeps sensor registration fallback decisions independent of Android SensorManager. */
final class SensorRegistrationPolicy {
    enum SensorKind { ATTITUDE, MAGNETIC_ATTITUDE, LINEAR_ACCELERATION, GRAVITY, ACCELEROMETER }

    interface Registrar {
        boolean register(SensorKind sensor);
    }

    static final class Result {
        final boolean attitudeRegistered;
        final boolean magneticAttitudeRegistered;
        final boolean linearAccelerationRegistered;
        final boolean gravityRegistered;
        final boolean accelerometerRegistered;

        private Result(boolean attitude, boolean magnetic, boolean linear, boolean gravity, boolean accelerometer) {
            attitudeRegistered = attitude;
            magneticAttitudeRegistered = magnetic;
            linearAccelerationRegistered = linear;
            gravityRegistered = gravity;
            accelerometerRegistered = accelerometer;
        }

        boolean anyRegistered() {
            return attitudeRegistered || magneticAttitudeRegistered || linearAccelerationRegistered
                    || gravityRegistered || accelerometerRegistered;
        }

        boolean accelerationAvailable() {
            return linearAccelerationRegistered || accelerometerRegistered;
        }

        String accelerationSource() {
            if (linearAccelerationRegistered) return "linear_acceleration";
            if (!accelerometerRegistered) return "none";
            return gravityRegistered ? "accelerometer_minus_gravity" : "accelerometer_lowpass";
        }
    }

    private SensorRegistrationPolicy() {}

    static Result register(Registrar registrar, boolean hasAttitude, boolean hasMagneticAttitude,
            boolean magneticIsAttitude, boolean hasLinearAcceleration, boolean hasGravity,
            boolean hasAccelerometer) {
        boolean attitude = hasAttitude && registrar.register(SensorKind.ATTITUDE);
        boolean magnetic = hasMagneticAttitude && !magneticIsAttitude
                && registrar.register(SensorKind.MAGNETIC_ATTITUDE);
        boolean linear = hasLinearAcceleration && registrar.register(SensorKind.LINEAR_ACCELERATION);
        boolean gravity = false;
        boolean accelerometer = false;
        if (!linear) {
            gravity = hasGravity && registrar.register(SensorKind.GRAVITY);
            accelerometer = hasAccelerometer && registrar.register(SensorKind.ACCELEROMETER);
        }
        return new Result(attitude, magnetic, linear, gravity, accelerometer);
    }
}
