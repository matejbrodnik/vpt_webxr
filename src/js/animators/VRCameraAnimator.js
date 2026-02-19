import { quat, vec3, mat4 } from '../../lib/gl-matrix-module.js';
import { Node } from '../Node.js';
import { Transform } from '../Transform.js';

export class VRCameraAnimator {

constructor(volumeTransform) {
    this.transform = new Transform(new Node());

    this.model = new Transform(new Node());
    this.translationSpeed = 0.0008;
    this.rotationSpeed = 0.005;

    this.yaw = 0;
    this.pitch = 0;
    this.dx = 0;
    this.dy = 0;
    this.dz = 0;
    this.focus = [0, 0, 0]; //[0, 0, 2]
    this.focusDistance = vec3.distance([0, 0, 0], this.transform.globalTranslation);
    this.yaw = 0;
    this.pitch = 0;
    this.thr = 0.6;
    this.thrAuto = 0.01;
    this.step = 0.03;
    this.focusDistance = 1;

    this.translation = [0, 0, 0];
    this.angles = null;
    this.change = 0;

    this.reproject = false;
    this.uiActive = false;
    this.uiCount = 0;

    this.steps = 30;
    this.extinction = 70;

    this.uiState = -1; // 0 - steps, 1 - extinction, 2 - renderer, 3 - tonemapper
}

update(inputs, dt) {
    let gpR;
    let gpL;
    if(inputs.length > 1)
        gpR = inputs[1].gamepad;
    else
        gpR = inputs[0].gamepad;

    let axesR = gpR.axes;
    let btnsR = gpR.buttons;
    let thr = this.thr;

    if(btnsR[0].pressed) { // up hold
        this.reproject = true;
    }
    else {
        this.reproject = false;
    }

    if(btnsR[1].pressed) { // down hold
        if(this.uiCount == 0)
            this.uiActive = !this.uiActive;
        console.log("BUTTON A", this.uiActive);
        this.uiCount++;
    }
    else
        this.uiCount = 0;

    if(btnsR[4].pressed) { // A
        this.extinction += 2;
        if(this.extinction > 200) {
            this.extinction = 50;
        }
    }

    if(btnsR[5].pressed) { // B
        this.steps++;
        if(this.steps > 70) {
            this.steps = 20;
        }
    }   

    if(axesR[2] > thr) {
        this.pitch -= this.step;
        this.change++;
    }
    else if(axesR[2] < -thr) {
        this.pitch += this.step;
        this.change++;
    }

    if(axesR[3] > thr) {
        if(this.uiActive) {
            if(this.uiState == 0)
                this.extinction++;
            else if(this.uiState == 1)
                this.steps++;
        }
        else {
            this.yaw -= this.step;
            this.change++;
        }
    }
    else if(axesR[3] < -thr) {
        if(this.uiActive) {
            if(this.uiState == 0)
                this.extinction--;
            else if(this.uiState == 1)
                this.steps--;
        }
        else {
            this.yaw += this.step;
            this.change++;
        }
    }

    
    if(inputs.length > 1) {
        let gpL = inputs[0].gamepad;
        let axesL = gpL.axes;
        let btnsL = gpL.buttons;

        if(btnsL[0].pressed) { // up hold
            this.reproject = true;
        }
        else {
            this.reproject = false;
        }

        if(btnsL[1].pressed) { // down hold
        
        }
        if(btnsL[4].pressed) { // A
            // if(this.reproCount == 0)
            //     this.reproject = !this.reproject;
            // console.log("BUTTON A", this.reproject);
            // this.reproCount++;
        }
        else
            this.reproCount = 0;
        if(btnsL[5].pressed) { // B

        }   

        if(axesL[2] > thr) {
            this.dy -= this.step;
            this.change++;
        }
        else if(axesL[2] < -thr) {
            this.dy += this.step;
            this.change++;
        }

        if(axesL[3] > thr) {
            this.dz -= this.step;
            this.change++;
        }
        else if(axesL[3] < -thr) {
            this.dz += this.step;
            this.change++;
        }
    }
    // console.log(axes);
    // console.log(dt);
    // console.log(this.dx, this.dz);
}

apply(viewMatrix = null, force = false) {
    if(viewMatrix) {
        // ROLL + T[1] ZAVRŽEMO
        let r = quat.create();
        let t = vec3.create();
        let s = vec3.create();
        mat4.decompose(r, t, s, viewMatrix);
        t = [t[0] * 1.2, t[1] * 0, t[2] * 1.2];
        // vec3.add(t, t, this.focus);
        let angles = this.quatToEuler(r);
        // console.log(this.angles);
        if(force || this.change > 1 || (this.angles && (Math.abs(this.angles.yaw - angles.yaw) > this.thrAuto || Math.abs(this.angles.pitch - angles.pitch) > this.thrAuto))) {  // || Math.abs(this.angles.roll - angles.roll) > this.thrAuto
            const rotation = quat.create();
            quat.rotateY(rotation, rotation, angles.yaw);
            quat.rotateX(rotation, rotation, angles.pitch);
            quat.rotateZ(rotation, rotation, angles.roll);
            
            // vec3.transformQuat(translation, [0, 0, this.focusDistance], rotation);
            this.transform.localRotation = rotation;
            this.transform.localTranslation = vec3.add(vec3.create, t, [0, 0, this.focusDistance]);
            
            const translation = vec3.create();
            const rotationM = quat.create();
            // console.log(this.dx)
            // console.log(this.dy)
            quat.rotateX(rotationM, rotationM, this.yaw);
            quat.rotateY(rotationM, rotationM, this.pitch);
            this.model.localRotation = rotationM;
            vec3.add(translation, translation, [0, this.dy, this.dz])
            this.model.localTranslation = translation;

            this.change = 0;

            this.translation = t;
            this.angles = angles;
            return true;
        }
        if(!this.angles){
            this.angles = angles;
            this.t = t;
        }
    }
    // else {
    //     const translation = [this.dx, 0, this.dz];
    //     const rotation = quat.create();
    //     quat.rotateY(rotation, rotation, this.yaw);
    //     quat.rotateX(rotation, rotation, this.pitch);
    //     vec3.transformQuat(translation, translation, rotation);
    //     vec3.add(this.focus, this.focus, translation);
    
    //     this.transform.localTranslation = this.focus;
    //     this.transform.localRotation = rotation;
    //     // console.log(translation);
    //     this.dx = 0;
    //     this.dz = 0;
    // }
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
    const sinr = 2 * (w*z + x*y);
    const cosr = 1 - 2 * (y*y + z*z);
    const roll = Math.atan2(sinr, cosr);
    // const roll = 0;

  return { yaw, pitch, roll };
}

}