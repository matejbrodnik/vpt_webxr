import { quat, vec3, mat4 } from '../../lib/gl-matrix-module.js';
import { Node } from '../Node.js';
import { Transform } from '../Transform.js';
import { CommonUtils } from '../utils/CommonUtils.js';
import { Survey } from '../Survey.js';

export class VRCameraAnimator extends EventTarget {

constructor(volumeTransform) {
    super();
    this.transform = new Transform(new Node());

    this.model = new Transform(new Node());
    this.translationSpeed = 0.0008;
    this.rotationSpeed = 0.005;

    this.yaw = 0;
    this.pitch = 0;
    this.dx = 0;
    this.dy = 0;
    this.dz = 0;
    // this.focus = [0, 0, 0]; //[0, 0, 2]
    // this.focusDistance = vec3.distance([0, 0, 0], this.transform.globalTranslation);
    this.focusDistance = 1;
    this.transform.localTranslation = vec3.clone([0, 0, this.focusDistance]);
    // console.log("focus", this.focusDistance)
    this.yaw = 0;
    this.pitch = 0;
    this.thr = 0.66;
    this.thrAuto = 0.01;
    this.angleStep = 0.03;
    this.translationStep = 0.012;
    this.scale = 1.0;

    this.translation = [0, 0, 0];
    this.angles = null;
    this.change = 0;

    this.reproject = false;
    this.uiActive = false;
    this.uiCount = 0;

    this.steps = 30;
    this.extinction = 70;

    this.uiState = 0; // 0 - steps, 1 - extinction, 2 - renderer, 3 - tonemapper
    this.uiStateTimeout = 0;

    this.renderState = 1; // 0 - mono, 1 - stereo, 2 - reprojection
    this.renderStateTimeout = 0;
    this.renderStateChanged = false;

    this.chosenRenderer = 0; // 0 - FOV2, 1 - MIP, 2 - MCM, 3 - ISO, 4 - DOS, 5 - LAO
    this.rendererTimeout = 0;

    this.bar = 0;
    this.timer = 0;

    // this.circle = [0, 1];
    this.lockCircle = false;
    this.circle = Math.PI / 2;
    this.circleActive = 0;
    this.depthMode = false;
    this.searchMode = false;
    this.start = [0, 0, 0];
    this.changeT = vec3.clone([0, 0, 0]);

    this.jsonReady = true;
    this.unlockA = true;
    this.survey = new Survey();
}

safeIncrement(val, num) {
    if(val == "ui") {
        this.uiState++;
        if(this.uiState >= num)
            this.uiState = 0;
    }
    else if(val == "renderer") {
        this.chosenRenderer++;
        if(this.chosenRenderer >= num)
            this.chosenRenderer = 0;
    }
    else if(val == "state") {
        this.renderState++;
        if(this.renderState >= num)
            this.renderState = 0;
    }
    else if(val == "bar") {
        this.bar += 4;
        if(this.bar >= 170)
            this.bar = 170;
    }
}

safeDecrement(val, num) {
    if(val == "ui") {
        this.uiState--;
        if(this.uiState < 0)
            this.uiState = num - 1;
    }
    else if(val == "renderer") {
        this.chosenRenderer--;
        if(this.chosenRenderer < 0)
            this.chosenRenderer = num - 1;
    }
    else if(val == "state") {
        this.renderState--;
        if(this.renderState < 0)
            this.renderState = num - 1;
    }
    else if(val == "bar") {
        this.bar -= 4;
        if(this.bar < 0)
            this.bar = 0;
    }
}

update(inputs, dt) {
    this.renderStateChanged = false;
    this.timer += dt;
    let gpR;
    
    if(inputs.length > 1) {
        if(inputs[0].handedness == "right")
            gpR = inputs[0].gamepad;
        else
            gpR = inputs[1].gamepad;
    }
    else {
        gpR = inputs[0].gamepad;
    }


    let axesR = gpR.axes;
    let btnsR = gpR.buttons;
    let thr = this.thr;

    if(btnsR[0].pressed) { // up hold
        if(!this.lockCircle) {
            this.focusDistance -= 0.01;
            this.change++;
        }
    }

    if(btnsR[1].pressed) { // down hold
        if(!this.lockCircle) {
            this.focusDistance += 0.01;
            this.change++;
        }
        // if(this.uiCount == 0)
        //     this.uiActive = !this.uiActive;
        // this.uiCount++;
    }
    // else
    //     this.uiCount = 0;

    if(btnsR[4].pressed && this.unlockA <= 0) { // A
        console.log("A pressed", this.depthMode)
        if(this.lockCircle) {
            this.survey.data.results.push({type: "depth", bar: this.bar, time: (this.timer / 1000).toFixed(3)});
            this.lockCircle = false;
            this.focusDistance = 1;
        }
        else if(this.searchMode) {
            this.survey.data.results.push({type: "search", time: (this.timer / 1000).toFixed(3)});
            this.searchMode = false;
        }
        this.dispatchEvent(new CustomEvent('saveToJSON', {detail: this.survey.data}));
        this.unlockA = 5;
        this.timer = 0;
        // this.depthMode = true;
        // if(this.depthMode) {
        //     console.log(this.survey.data);
        //     this.survey.data.results.push({bar: this.bar});
        //     console.log(this.survey.data);
            
        //     this.depthMode = false;
        //     this.lockCircle = false;
        //     this.dispatchEvent(new CustomEvent('saveToJSON', {detail: this.survey.data}));
        // }
        // else {
        //     this.depthMode = true;
        // }
        // this.unlockA = false;
    }
    else {
        this.unlockA--;
    }

    if(btnsR[5].pressed) { // B
        if(this.uiCount == 0)
            this.uiActive = !this.uiActive;
        this.uiCount++;
    }   
    else
        this.uiCount = 0;

    this.circleActive--;

    if(axesR[2] > thr) {
        if(this.uiActive) {
            if(this.uiState == 0)
                this.extinction++;
            else if(this.uiState == 1 && this.steps < 60)
                this.steps++;
            else if(this.uiState == 2) {
                if(this.rendererTimeout % 20 == 0)
                    this.safeIncrement("renderer", 6);
                this.rendererTimeout++;
            }
            else if(this.uiState == 3) {
                if(this.renderStateTimeout % 20 == 0)
                    this.safeIncrement("state", 3);
                this.renderStateTimeout++;
                this.renderStateChanged = true;
            }
        }
        else {
            if(this.lockCircle) {
                console.log("move")
                this.circle-=0.13;
                this.circleActive = 2;
            }
            else
                this.pitch -= this.angleStep;
            this.change++;
        }
    }
    else if(axesR[2] < -thr) {
        if(this.uiActive) {
            if(this.uiState == 0 && this.extinction > 1)
                this.extinction--;
            else if(this.uiState == 1 && this.steps > 1)
                this.steps--;
            else if(this.uiState == 2) {
                if(this.rendererTimeout % 20 == 0)
                    this.safeDecrement("renderer", 6);
                this.rendererTimeout++;
            }
            else if(this.uiState == 3) {
                if(this.renderStateTimeout % 20 == 0)
                    this.safeDecrement("state", 3);
                this.renderStateTimeout++;
                this.renderStateChanged = true;
            }
        }
        else {
            if(this.lockCircle) {
                this.circle+=0.13;
                this.circleActive = 2;
            }
            else
                this.pitch += this.angleStep;
            this.change++;
        }
    }
    else {
        this.rendererTimeout = 0;
        this.renderStateTimeout = 0;
    }

    if(axesR[3] > thr) { 
        if(this.uiActive) {
            if(this.uiStateTimeout % 10 == 0) {
                this.safeIncrement("ui", 4);
                // this.uiState++;
                // if(this.uiState > 2)
                //     this.uiState = 0;
            }
            this.uiStateTimeout++;
        }
        else {
            if(!this.lockCircle) {
                this.yaw -= this.angleStep;
                this.change++;
            }
        }
    }
    else if(axesR[3] < -thr) {
        if(this.uiActive) {
            if(this.uiStateTimeout % 10 == 0) {
                this.safeDecrement("ui", 4);
                // this.uiState--;
                // if(this.uiState < 0)
                //     this.uiState = 2;
            }
            this.uiStateTimeout++;
        }
        else {
            if(!this.lockCircle) {
                this.yaw += this.angleStep;
                this.change++;
            }
        }
    }
    else {
        this.uiStateTimeout = 0;
    }
    
    if(inputs.length > 1) {
        let gpL;
        if(inputs[0].handedness == "left")
            gpL = inputs[0].gamepad;
        else
            gpL = inputs[1].gamepad;
        let axesL = gpL.axes;
        let btnsL = gpL.buttons;

        if(btnsL[4].pressed) { // A
            this.safeIncrement("bar", 800);
            
            // if(this.reproCount == 0)
            //     this.reproject = !this.reproject;
            // console.log("BUTTON A", this.reproject);
            // this.reproCount++;
        }
        if(btnsL[5].pressed) { // B
            this.safeDecrement("bar", 800);
            
        }   
        
        if(this.lockCircle)
            return;

        if(btnsL[0].pressed) { // up hold
            this.dz += this.translationStep;
            this.change++;
        }
        if(btnsL[1].pressed) { // down hold
            this.dz -= this.translationStep;
            this.change++;
        }

        if(axesL[2] > thr) {
            this.dx -= this.translationStep;
            this.change++;
        }
        else if(axesL[2] < -thr) {
            this.dx += this.translationStep;
            this.change++;
        }

        if(axesL[3] > thr) {
            this.dy -= this.translationStep;
            this.change++;
        }
        else if(axesL[3] < -thr) {
            this.dy += this.translationStep;
            this.change++;
        }
    }
    // console.log(axes);
    // console.log(dt);
    // console.log(this.dx, this.dz);
}

apply(viewMatrix, force = false) {
    // ROLL + T[1] ZAVRŽEMO
    let r = quat.create();
    let t = vec3.create();
    let s = vec3.create();
    mat4.decompose(r, t, s, viewMatrix);
    // console.log(t[0].toFixed(2), "0", t[2].toFixed(2));
    t = [t[0] * 1.2, t[1] * 0, t[2] * 1.2];
    let angles = this.quatToEuler(r);

    if(force || this.change >= 1 || (!this.lockCircle && this.angles && (Math.abs(this.angles.yaw - angles.yaw) > this.thrAuto || Math.abs(this.angles.pitch - angles.pitch) > this.thrAuto))) {  // || Math.abs(this.angles.roll - angles.roll) > this.thrAuto
        // vec3.transformQuat(translation, [0, 0, this.focusDistance], rotation);
        if(this.lockCircle) {
            if(this.circleActive > 0) {
                console.log("update circle");
                let tr = vec3.create();
                vec3.add(tr, tr, [Math.cos(this.circle), Math.sin(this.circle), 0])
                vec3.scale(tr, tr, 0.02);
                console.log(tr);
                this.transform.localTranslation = vec3.add(vec3.create(), tr, [0, 0, this.focusDistance]);
            }
            else {
                console.log("reset circle 1");
                console.log(this.change);
                console.log(Math.abs(this.angles.yaw - angles.yaw));
                console.log(Math.abs(this.angles.pitch - angles.pitch));
                this.transform.localTranslation = vec3.clone([0, 0, this.focusDistance]);
                this.circle = Math.PI / 2;
            }
        } else {
            // console.log("normal")
            
            // const rotation = quat.create();
            // quat.rotateY(rotation, rotation, angles.yaw);
            // quat.rotateX(rotation, rotation, angles.pitch);
            // quat.rotateZ(rotation, rotation, angles.roll);
;
            // this.transform.localRotation = rotation;
            if(this.searchMode) {
                // console.log("yaw", this.angles.yaw.toFixed(2));
                // console.log("pitch", this.angles.pitch.toFixed(2));
                // console.log("roll", this.angles.roll.toFixed(2));
                let t2 = vec3.clone([this.pitch / 3, this.focusDistance * -1.2, this.yaw / 3]);
                vec3.transformQuat(t2, t2, r);
                vec3.add(this.changeT, this.changeT, t2);
                this.yaw = 0;
                this.pitch = 0;
                this.focusDistance = 0;
                
                // t[0] -= this.pitch / 3;
                // t[1] = this.focusDistance * -1.2;
                // t[2] -= this.yaw / 3;
                vec3.add(t, t, this.changeT);
                this.transform.localTranslation = vec3.add(vec3.create(), t, this.start);
                // quat.rotateX(r, r, this.yaw);
                // quat.rotateY(r, r, this.pitch);
            }
            else {
                this.transform.localTranslation = vec3.add(vec3.create(), t, [0, 0, this.focusDistance]);
            
                const translation = vec3.create();
                vec3.add(translation, translation, [this.dx, this.dy, this.dz])
                this.model.localTranslation = translation;
                const rotationM = quat.create();
                quat.rotateX(rotationM, rotationM, this.yaw);
                quat.rotateY(rotationM, rotationM, this.pitch);
                this.model.localRotation = rotationM;
            }

            this.transform.localRotation = r;
        
        }
        this.change = 0;
        this.translation = t;
        this.angles = angles;
        return true;
    }
    else if(this.lockCircle && this.circleActive <= 0) {
        let translation = vec3.add(vec3.create(), vec3.create(), [0, 0, this.focusDistance]);
        if(vec3.equals(this.transform.localTranslation, translation)) {
            // console.log("reset circle 2 false");
            return false;
        }
        console.log("reset circle 2");
        this.transform.localTranslation = translation;
        this.circle = Math.PI / 2;
        return true;
    }
    if(!this.angles){
        this.angles = angles;
        this.t = t;
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

quatToEuler(q, thr = null) {
    const x = q[0], y = q[1], z = q[2], w = q[3];

    // pitch (X-axis)
    const sinp = 2 * (w*x + y*z);
    const cosp = 1 - 2 * (x*x + y*y);
    let pitch = Math.atan2(sinp, cosp);
    if(thr)
        pitch = Math.min(Math.max(pitch, -thr), thr)

    // yaw (Y-axis)
    const siny = 2 * (w*y - z*x);
    const yawsingularity = Math.abs(siny) >= 1;
    let yaw = yawsingularity ? Math.sign(siny) * (Math.PI / 2) : Math.asin(siny);
    if(thr)
        yaw = Math.min(Math.max(yaw, -thr), thr)

    // roll (Z-axis)
    const sinr = 2 * (w*z + x*y);
    const cosr = 1 - 2 * (y*y + z*z);
    let roll = Math.atan2(sinr, cosr);
    // const roll = 0;


    return { yaw, pitch, roll };
}

}