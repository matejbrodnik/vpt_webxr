import { quat, vec3, mat4 } from '../../lib/gl-matrix-module.js';
import { Node } from '../Node.js';
import { Transform } from '../Transform.js';

export class VRCameraAnimator {

constructor() {
    this.transform = new Transform(new Node());
    this.translationSpeed = 0.002;
    this.rotationSpeed = 0.005;

    this.dx = 0;
    this.dz = 0;
    this.focus = [0, 0, 2];
    this.focusDistance = vec3.distance([0, 0, 0], this.transform.globalTranslation);
    this.yaw = 0;
    this.pitch = 0;
    this.thr = 0.6;
    this.focusDistance = 1;
}

update(gp, dt) {
    let axes = gp.axes;
    let btns = gp.buttons;
    let thr = this.thr;

    if(btns[0].pressed) { // up hold
        this.pitch -= 0.04;
    }
    if(btns[1].pressed) { // down hold
        this.yaw -= 0.04;
    }
    if(btns[4].pressed) { // A
        this.yaw += 0.04;
    }
    if(btns[5].pressed) { // B
        this.pitch += 0.04;
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
    console.log(axes);
    console.log(dt);
    console.log(this.dx, this.dz);
}

apply() {
    const translation = [this.dx, 0, this.dz];
    const rotation = quat.create();
    quat.rotateY(rotation, rotation, this.yaw);
    quat.rotateX(rotation, rotation, this.pitch);
    vec3.transformQuat(translation, translation, rotation);
    vec3.add(this.focus, this.focus, translation);

    this.transform.localTranslation = this.focus;
    this.transform.localRotation = rotation;
    console.log(translation);
    this.dx = 0;
    this.dz = 0;
}

}