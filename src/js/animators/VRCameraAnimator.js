import { quat, vec3, mat4 } from '../../lib/gl-matrix-module.js';
import { Node } from '../Node.js';
import { Transform } from '../Transform.js';

export class VRCameraAnimator {

constructor() {
    this.transform = new Transform(new Node());
    this.translationSpeed = 0.0008;
    this.rotationSpeed = 0.005;

    this.dx = 0;
    this.dz = 0;
    this.focus = [0, 0, 0]; //[0, 0, 2]
    this.focusDistance = vec3.distance([0, 0, 0], this.transform.globalTranslation);
    this.yaw = 0;
    this.pitch = 0;
    this.thr = 0.6;
    this.thrAuto = 0.15;
    this.focusDistance = 2;

    this.translation = [0, 0, 0];
    this.angles = null;
}

update(gp, dt) {
    let axes = gp.axes;
    let btns = gp.buttons;
    let thr = this.thr;

    if(btns[0].pressed) { // up hold
        this.pitch -= 0.02;
    }
    if(btns[1].pressed) { // down hold
        this.yaw -= 0.02;
    }
    if(btns[4].pressed) { // A
        this.yaw += 0.02;
    }
    if(btns[5].pressed) { // B
        this.pitch += 0.02;
    }

    if(axes[2] > thr) {
        this.dx -= this.translationSpeed * this.focusDistance * dt;
    }
    else if(axes[2] < -thr) {
        this.dx += this.translationSpeed * this.focusDistance * dt;
    }

    if(axes[3] > thr) {
        this.dz -= this.translationSpeed * this.focusDistance * dt;
    }
    else if(axes[3] < -thr) {
        this.dz += this.translationSpeed * this.focusDistance * dt;
    }
    // console.log(axes);
    // console.log(dt);
    // console.log(this.dx, this.dz);
}

apply(viewMatrix = null) {
    if(viewMatrix) {
        // ROLL + T[1] ZAVRŽEMO
        let r = quat.create();
        let t = vec3.create();
        let s = vec3.create();
        mat4.decompose(r, t, s, viewMatrix);
        t = [t[0] * 1.2, t[1] * 0, t[2] * 1.2];
        // vec3.add(t, t, this.focus);
        let angles = this.quatToEuler(r);
        console.log(angles);
        console.log(this.angles);
        if(this.angles && (Math.abs(this.angles.yaw - angles.yaw) > this.thrAuto || Math.abs(this.angles.pitch - angles.pitch) > this.thrAuto)) {
            const rotation = quat.create();
            quat.rotateY(rotation, rotation, angles.yaw);
            quat.rotateX(rotation, rotation, angles.pitch);
            
            const translation = vec3.transformQuat(vec3.create(),
            [0, 0, this.focusDistance], rotation);
    
            this.transform.localRotation = rotation;
            this.transform.localTranslation = vec3.add(vec3.create, t, translation);
            
            this.translation = t;
            this.angles = angles;
            return true;
        }
        if(!this.angles)
            this.angles = angles;
    }
    else {
        const translation = [this.dx, 0, this.dz];
        const rotation = quat.create();
        quat.rotateY(rotation, rotation, this.yaw);
        quat.rotateX(rotation, rotation, this.pitch);
        vec3.transformQuat(translation, translation, rotation);
        vec3.add(this.focus, this.focus, translation);
    
        this.transform.localTranslation = this.focus;
        this.transform.localRotation = rotation;
        // console.log(translation);
        this.dx = 0;
        this.dz = 0;
    }
    return false;
}

quatToEuler(q) {
    const x = q[0], y = q[1], z = q[2], w = q[3];

    // pitch (X-axis)
    const sinp = 2 * (w*x + y*z);
    const cosp = 1 - 2 * (x*x + y*y);
    const pitch = Math.atan2(sinp, cosp);

    // yaw (Y-axis)
    const siny = 2 * (w*y - z*x);
    const yawsingularity = Math.abs(siny) >= 1;
    const yaw = yawsingularity ? Math.sign(siny) * (Math.PI / 2) : Math.asin(siny);

  // roll (Z-axis)
//   const sinr = 2 * (w*z + x*y);
//   const cosr = 1 - 2 * (y*y + z*z);
//   const roll = Math.atan2(sinr, cosr);
    const roll = 0;

  return { yaw, pitch, roll };
}

}