import { quat, vec3, mat4 } from '../../lib/gl-matrix-module.js';
import { Node } from '../Node.js';
import { Transform } from '../Transform.js';
import { CommonUtils } from '../utils/CommonUtils.js';
import { Survey } from '../Survey.js';

export class VRCameraAnimator extends EventTarget {

constructor(volumeTransform) {
    super();
    this.transform = new Transform(new Node());
    this.transform2 = new Transform(new Node());
    this.model = new Transform(new Node());
    
    this.yaw = 0;
    this.pitch = 0;
    this.dx = 0;
    this.dy = 0;
    this.dz = 0;
    // this.focus = [0, 0, 0]; //[0, 0, 2]
    // this.focusDistance = vec3.distance([0, 0, 0], this.transform.globalTranslation);
    this.focusDistance = 1;
    this.transform.localTranslation = vec3.clone([0, 0, this.focusDistance]);
    this.transform2.localTranslation = vec3.clone([0, 0, this.focusDistance]);
    // console.log("focus", this.focusDistance)
    
    this.thr = 0.5;
    this.thrAuto = 0.006;
    this.translationSpeed = 0.0008;
    this.rotationSpeed = 0.005;
    this.translationStep = 0.012;
    this.angleStep = 0.03;

    this.angles = null;
    this.change = 0;

    this.reproject = false;
    this.uiActive = false;
    this.uiCount = 0;
    this.uiCountL = 0

    this.steps = 120;
    this.extinction = 150;

    this.uiState = 0; // 0 - steps, 1 - extinction, 2 - renderer, 3 - state, 4 - filter
    this.uiStateTimeout = 0;

    this.renderState = 1; // 0 - mono, 1 - stereo, 2 - reprojection
    this.renderStateTimeout = 0;
    this.renderStateChanged = false;

    this.chosenRenderer = 0; // 0 - FOV2, 1 - MIP, 2 - MCM, 3 - ISO, 4 - DOS, 5 - EAM, 6 - LAO, 7 - Depth
    this.currentId = -1;
    
    this.filter = 'nearest';
    this.filterTimeout = 0;

    this.bar = 0;
    this.timer = 0;
    this.timerCircle = 0;
    this.fps = 20;

    // this.circle = [0, 1];
    this.lockCircle = false;
    this.circle = Math.PI / 2;
    this.circleActive = 0;
    this.depthMode = false;
    this.disable = false;
    this.searchMode = false;
    this.start = [0, 0, 0];
    this.changeT = vec3.clone([0, 0, 0]);

    this.selectedL = true; // selected circle A
    this.closer = true; 
    this.upHold = false;

    this.jsonReady = true;
    this.unlockA = 0;
    this.unlockAL = 0;
    this.countAL = 0;
    this.survey = new Survey();

    this.pairIndex = 0;
    this.comparison = 0;
    this.comparisonTimeout = 0;
    this.comparisonMode = false;

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
        if(this.bar >= 165)
            this.bar = 165;
    }
    else if(val == "comparison") {
        this.comparison++;
        if(this.comparison >= num)
            this.comparison = 0;
    }
    else if(val == "pair") {
        this.pairIndex++;
        if(this.pairIndex >= num)
            this.pairIndex = 0;
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
    else if(val == "comparison") {
        this.comparison--;
        if(this.comparison < 0)
            this.comparison = num - 1;
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

    if(!gpR) {
        console.log("NO INPUT", inputs);
        return
    }
    let axesR = gpR.axes;
    let btnsR = gpR.buttons;
    let thr = this.thr;

    // if(btnsR[0].pressed) { // up hold
    //     if(!this.lockCircle) {
    //         this.focusDistance -= 0.012;
    //         this.change++;
    //     }
    //     else if(!this.upHold) {
    //         this.selectedL = !this.selectedL;
    //     }
    //     this.upHold = true;
    // }
    // else {
    //     this.upHold = false;
    // }

    // if(btnsR[1].pressed) { // down hold
    //     if(!this.lockCircle) {
    //         this.focusDistance += 0.012;
    //         this.change++;
    //     }
    //     // if(this.uiCount == 0)
    //     //     this.uiActive = !this.uiActive;
    //     // this.uiCount++;
    // }
    // else
    //     this.uiCount = 0;

    if(btnsR[4].pressed) { // A
        if(this.unlockA <= 0) {
            console.log("A pressed", this.depthMode)
            if(this.comparisonMode) {
                if(this.comparison == 0) {
                    this.comparison = 1;
                }
                else {
                    this.comparison = 0;
                }
                this.dispatchEvent(new CustomEvent('comparison', {detail: this.comparison}));
                this.unlockA = 7;
                return;
            }
            if(this.lockCircle) {
                if(this.disable) {
                    this.unlockA = 10;
                    return;
                }
                else {
                    this.survey.data.results.push({
                        id: this.currentId, 
                        renderer: this.chosenRenderer, 
                        reprojected: this.renderState == 2, 
                        correct: this.selectedL == this.closer, 
                        time: (this.timer / 1000).toFixed(3), 
                        timeCircle: (this.timerCircle / 1000).toFixed(3)});
                }
                this.lockCircle = false;
                this.focusDistance = 1;
            }
            else if(this.searchMode) {
                this.survey.data.results.push({type: "search", time: (this.timer / 1000).toFixed(3)});
                this.searchMode = false;
            }
            this.dispatchEvent(new CustomEvent('saveToJSON', {detail: this.survey.data}));
            this.unlockA = 10;
            this.timer = 0;
            this.timerCircle = 0;
            this.yaw = 0;
            this.pitch = 0;
        }
    }
    else {
        this.unlockA--;
    }

    // if(btnsR[5].pressed) { // B
    //     if(this.uiCount == 0)
    //         this.uiActive = !this.uiActive;
    //     this.uiCount++;
    // }   
    // else
    //     this.uiCount = 0;

    this.circleActive--;

    if(axesR[2] > thr) {
        if(this.lockCircle) {
            console.log("move")
            this.circle += 2.2 / this.fps;
            this.circleActive = 2;
            this.timerCircle += dt;
        }
        else
            this.pitch -= this.angleStep * Math.max(axesR[2] * axesR[2], 0.9) * (30 / this.fps);
            // this.pitch -= this.angleStep * (Math.abs(axesR[2])) * (30 / this.fps);
        this.change++;
        
    }
    else if(axesR[2] < -thr) {
        if(this.lockCircle) {
            this.circle -= 2.2 / this.fps;
            this.circleActive = 2;
            this.timerCircle += dt;
        }
        else
            this.pitch += this.angleStep * Math.max(axesR[2] * axesR[2], 0.9) * (30 / this.fps);
        this.change++;
    }


    if(axesR[3] > thr) { 
        if(!this.lockCircle) {
            this.yaw -= this.angleStep * Math.max(axesR[3] * axesR[3], 0.9) * (30 / this.fps);
            this.change++;
        }
    }
    else if(axesR[3] < -thr) {
        if(!this.lockCircle) {
            this.yaw += this.angleStep * Math.max(axesR[3] * axesR[3], 0.9) * (30 / this.fps);
            this.change++;
        }
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
            // this.safeIncrement("bar", 800);
            
            // if(this.reproCount == 0)
            //     this.reproject = !this.reproject;
            // console.log("BUTTON A", this.reproject);
            // this.reproCount++;
            // if(this.unlockAL <= 0) {
            //     if(this.comparisonMode) {
            //         console.log(this.comparison);
            //         // this.dispatchEvent(new CustomEvent('comparison', {detail: this.comparison}));
            //         this.unlockAL = 10;
            //         this.safeIncrement("pair", 6);
            //         this.dispatchEvent(new CustomEvent('comparison', {detail: this.comparison}));
            //         return;
            //     }
            // }
            if(this.unlockAL > 0)
                return
            if(this.unlockAL <= 0 && this.lockCircle && this.disable) {
                this.lockCircle = false;
                this.focusDistance = 1;
                this.dispatchEvent(new CustomEvent('saveToJSON', {detail: this.survey.data}));
                this.unlockAL = 20;
                this.timer = 0;
                this.timerCircle = 0;
                this.yaw = 0;
                this.pitch = 0;
                this.countAL++;
            }
            if(this.countAL == 0) {

                // this.dispatchEvent(new CustomEvent('reset'));
                console.log(this.comparison);
                // this.dispatchEvent(new CustomEvent('comparison', {detail: this.comparison}));
                this.unlockAL = 10;
                this.safeIncrement("pair", 6);
                this.dispatchEvent(new CustomEvent('comparison', {detail: this.comparison}));
            }
            if(this.countAL == 100) {
                this.dispatchEvent(new CustomEvent('reset'));
            }
            this.countAL++;
        }
        else {
            this.countAL = 0;
            this.unlockAL--;
        }

        if(btnsL[5].pressed) { // B
            // this.safeDecrement("bar", 800);
            if(this.uiCountL == 0)
                this.uiActive = !this.uiActive;
            this.uiCountL++;
        }   
        else
            this.uiCountL = 0;
        
        if(axesL[2] > thr) { //right
            if(this.uiActive) {
                if(this.uiState == 0)
                    this.extinction++;
                else if(this.uiState == 1) // && this.steps < 60)
                    this.steps++;
                else if(this.uiState == 2) {
                    if(this.rendererTimeout % 20 == 0)
                        this.safeIncrement("renderer", 8);
                    this.rendererTimeout++;
                }
                else if(this.uiState == 3) {
                    if(this.renderStateTimeout % 20 == 0)
                        this.safeIncrement("state", 3);
                    this.renderStateTimeout++;
                    this.renderStateChanged = true;
                }
                else if(this.uiState == 4) {
                    if(this.filterTimeout % 20 == 0)
                        this.filter = this.filter == 'nearest' ? 'linear' : 'nearest';
                    this.filterTimeout++;
                }
            }
  
            // if(this.comparisonTimeout % 20 == 0) {
            //     this.safeIncrement("comparison", 4);
            //     this.dispatchEvent(new CustomEvent('comparison', {detail: this.comparison}));
            // }
            // this.comparisonTimeout++;
        }
        else if(axesL[2] < -thr) { //left
            if(this.uiActive) {
                if(this.uiState == 0 && this.extinction > 1)
                    this.extinction--;
                else if(this.uiState == 1 && this.steps > 1)
                    this.steps--;
                else if(this.uiState == 2) {
                    if(this.rendererTimeout % 20 == 0)
                        this.safeDecrement("renderer", 8);
                    this.rendererTimeout++;
                }
                else if(this.uiState == 3) {
                    if(this.renderStateTimeout % 20 == 0)
                        this.safeDecrement("state", 3);
                    this.renderStateTimeout++;
                    this.renderStateChanged = true;
                }
                else if(this.uiState == 4) {
                    if(this.filterTimeout % 20 == 0)
                        this.filter = this.filter == 'nearest' ? 'linear' : 'nearest';
                    this.filterTimeout++;
                }
            }
            // if(this.comparisonTimeout % 20 == 0) {
            //     this.safeDecrement("comparison", 4);
            //     this.dispatchEvent(new CustomEvent('comparison', {detail: this.comparison}));
            // }
            // this.comparisonTimeout++;
        }
        else {
            this.comparisonTimeout = 0;
            this.rendererTimeout = 0;
            this.renderStateTimeout = 0;
            this.filterTimeout = 0;
        }
        
        if(axesL[3] > thr) { 
            if(this.uiActive) {
                if(this.uiStateTimeout % 15 == 0) {
                    this.safeIncrement("ui", 5);
                    // this.uiState++;
                    // if(this.uiState > 2)
                    //     this.uiState = 0;
                }
                this.uiStateTimeout++;
            }
        }
        else if(axesL[3] < -thr) {
            if(this.uiActive) {
                if(this.uiStateTimeout % 15 == 0) {
                    this.safeDecrement("ui", 5);
                    // this.uiState--;
                    // if(this.uiState < 0)
                    //     this.uiState = 2;
                }
                this.uiStateTimeout++;
            }
        }
        else {
            this.uiStateTimeout = 0;
        }
    // console.log(axes);
    // console.log(dt);
    // console.log(this.dx, this.dz);
    }
}

apply(viewMatrix, force = false, right = false) {
    // ROLL + T[1] ZAVRŽEMO
    let r = quat.create();
    let t = vec3.create();
    let s = vec3.create();
    mat4.decompose(r, t, s, viewMatrix);
    // console.log(t[0].toFixed(2), "0", t[2].toFixed(2));
    t = [t[0] * 1.0, t[1] * 0, t[2] * 1.0];
    let angles = this.quatToEuler(r);

    let transform = this.transform;
    if(right)
        transform = this.transform;
        // transform = this.transform2;

    if(force || this.change >= 1 || (!this.lockCircle && this.angles && (Math.abs(this.angles.yaw - angles.yaw) > this.thrAuto || Math.abs(this.angles.pitch - angles.pitch) > this.thrAuto))) {  // || Math.abs(this.angles.roll - angles.roll) > this.thrAuto
        if(this.lockCircle) {
            if(this.circleActive > 0) {
                let tr = vec3.create();
                vec3.add(tr, tr, [Math.cos(this.circle), Math.sin(this.circle), 0])
                vec3.scale(tr, tr, 0.02);
                transform.localTranslation = vec3.add(vec3.create(), tr, [0, 0, this.focusDistance]);
            }
            else {
                transform.localTranslation = vec3.clone([0, 0, this.focusDistance]);
                this.circle = Math.PI / 2;
            }
        } else {
            if(this.searchMode) {
                let t2 = vec3.clone([-this.pitch / 3, this.focusDistance * -1.0, -this.yaw / 3]);
                vec3.transformQuat(t2, t2, r);
                vec3.add(this.changeT, this.changeT, t2);
                this.yaw = 0;
                this.pitch = 0;
                this.focusDistance = 0;
                vec3.add(t, t, this.changeT);
                transform.localTranslation = vec3.add(vec3.create(), t, this.start);
            }
            else {
                transform.localTranslation = vec3.add(vec3.create(), t, [0, 0, this.focusDistance]);
            
                const translation = vec3.create();
                vec3.add(translation, translation, [this.dx, this.dy, this.dz])
                this.model.localTranslation = translation;
                const rotationM = quat.create();
                quat.rotateX(rotationM, rotationM, this.yaw);
                quat.rotateY(rotationM, rotationM, this.pitch);
                this.model.localRotation = rotationM;
            }

            transform.localRotation = r;
        
        }
        // if(right) {
            this.change = 0;
            this.angles = angles;
        // }
        return true;
    }
    else if(this.lockCircle && this.circleActive <= 0) {
        let translation = vec3.add(vec3.create(), vec3.create(), [0, 0, this.focusDistance]);
        if(vec3.equals(this.transform.localTranslation, translation)) {
            // console.log("reset circle 2 false");
            return false;
        }
        console.log("reset circle 2");
        transform.localTranslation = translation;
        this.circle = Math.PI / 2;
        return true;
    }
    if(!this.angles){
        this.angles = angles;
        this.t = t;
    }

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