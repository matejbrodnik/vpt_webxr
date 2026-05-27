import { WebGL } from './WebGL.js';

import { SingleBuffer } from './SingleBuffer.js';
import { quat, vec3, vec4, mat4 } from '../../lib/gl-matrix-module.js';

const [ SHADERS, MIXINS ] = await Promise.all([
    'shaders.json',
    'mixins.json',
].map(url => fetch(url).then(response => response.json())));

export class UIRenderer {

constructor(gl, texture, options = {}) {
    this._programs = WebGL.buildPrograms(gl, SHADERS.UIRenderer, MIXINS);
    this._resolution = options.resolution ?? {width: 512, height: 512};
    // this._resolution = {width: 512, height: 512};
    this._gl = gl;
    
    this._scene = texture;
    this._renderBuffer = new SingleBuffer(gl, this._getRenderBufferSpec());

    this.init = false;

    this.uiCanvas = document.createElement('canvas');
    this.uiCanvas.width = this._resolution.width / 2;
    this.uiCanvas.height = this._resolution.height;
    // this.uiCanvas.width = 512;
    // this.uiCanvas.height = 512;
    this.ratioW = 512 / 576;
    this.ratioH = 512 / 317;
    console.log("RESOLUTION: ", this._resolution);
    this.uiCtx = this.uiCanvas.getContext('2d', { alpha: true });

    this.VRAnimator = options.VRAnimator;
    this.renderingContext = options.renderingContext;
    this.chosen = 0;

    this.renderers = ["FOV2", "MIP", "MCM", "ISO", "DOS", "EAM", "LAO", "Depth"];
    this.views = ["MONO", "STEREO", "REPROJ"];
    this.right = true;

    this.depthMode = false;
    this.depthParams = {
        xA: 300, yA: 250,
        xB: 370, yB: 200,
        xD: 340, yD: 230,
        rotation: quat.create(), translation: vec3.create()
    }
    this.comparisonMode = false;
    
}

setTexture(texture) {
    this._scene = texture;
}

destroy() {
    const gl = this._gl;
    gl.deleteProgram(this._programs.program);
}

reset() {
    const gl = this._gl;
    this.uiTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.uiTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    
    this._drawUIText(true);

    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        this.uiCanvas
    );
}

render(texture = null, right = true) {
    if(texture)
        this.setTexture(texture);
    // if(!(this.VRAnimator && this.VRAnimator.uiActive))
    //     return;
    this.right = right;
    const gl = this._gl;

    this._renderBuffer.use();

    const { program, uniforms } = this._programs.base;
    
    this._drawUIText();
    
    gl.bindTexture(gl.TEXTURE_2D, this.uiTexture);
    gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        this.uiCanvas
    );
    gl.useProgram(program);
    
    // gl.uniform1f(uniforms.uX, 134 / 288);
    // gl.uniform1f(uniforms.uY, 163 / 317);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._scene);
    gl.uniform1i(uniforms.uScene, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.uiTexture);
    gl.uniform1i(uniforms.uTex, 1);

    // gl.disable(gl.DEPTH_TEST);
    // gl.enable(gl.BLEND);
    // gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // gl.disable(gl.BLEND);

}

_drawUIText(reset = false) {
    let ctx = this.uiCtx;
    // console.log(this._resolution) // 720 396
    ctx.clearRect(0, 0, this._resolution.width, this._resolution.height);

    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, this._resolution.width, this._resolution.height);

    ctx.fillStyle = 'black';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    // if(reset || !(this.VRAnimator))
    //     ctx.fillText("TEST test", this.uiCanvas.width - 140, 195);
    let rightOffset = 123;
    if(this.VRAnimator) {
        if(this.comparisonMode) {
            let x = this._resolution.width / 2.8; // 120
            // let x = 310;
            if(this.right)
                x = x - rightOffset;
            let y = this._resolution.height / 2.5;
            ctx.strokeStyle = 'black';
            ctx.fillStyle = 'black';
            
            ctx.fillText("Mode: " + this.VRAnimator.comparison, x, y);
        }
        if(this.VRAnimator.lockCircle) {
            if(this.VRAnimator.circleActive > 0) {
                // this.VRAnimator.model.localTranslation = this.depthParams.translation;
                // this.VRAnimator.model.localRotation = this.depthParams.rotation;
                return;
            }
            let w = 6;
            let offset = [0, 0];
            let offsetR = 0;
            let multi = 1;

            let three = [
                {A: -18, B: -13},
                {A: -18, B: -12},
                {A: -19, B: -11},
                {A: -14, B: -11},
                {A: -15, B: -13},
                {A: -16, B: -13},

                {A: -18, B: -13},
                {A: -18, B: -13},
                {A: -18, B: -13},
                {A: -18, B: -13},
                {A: -18, B: -13},
                {A: -18, B: -13}
            ];

            let index = this.depthParams.id;
            if(index >= 10)
                index -= 4;

            offset = [0, 0];
            if(this.right)
                offsetR = this.renderingContext.filename == "fibersB" ? -81 : -20;
            
            console.log(this.renderingContext.filename);
            this._drawCircle(Math.round(((this.renderingContext.filename == "fibersB" ? this.depthParams.xA2 : this.depthParams.xA) + offset[0] + offsetR) * multi), this.renderingContext.filename == "fibersB" ? this.depthParams.yA2 : this.depthParams.yA, w, this.VRAnimator.selectedL ? 'rgb(109, 255, 41)' : 'rgb(161, 161, 161)')
            this._drawCircle(Math.round(((this.renderingContext.filename == "fibersB" ? this.depthParams.xB2 : this.depthParams.xB) + offset[1] + offsetR) * multi), this.renderingContext.filename == "fibersB" ? this.depthParams.yB2 : this.depthParams.yB, w, this.VRAnimator.selectedL ? 'rgb(161, 161, 161)' : 'rgb(109, 255, 41)')
            // this._drawCircle(this.depthParams.xB - (this.right ? 20 : 0), this.depthParams.yB, w, 'rgb(237, 41, 255)')
            
            ctx.strokeStyle = 'black';
        }
        if(this.VRAnimator.uiActive) {
            // let x = this.uiCanvas.width - 160;
            let x = this._resolution.width / 2.8; // 120
            // let x = 310;
            if(this.right)
                x = x - rightOffset;
            let y = this._resolution.height / 2.8;
            // let y = 195;
            let yStep = 14;
            // let style = (this.VRAnimator.chosenRenderer == 5 || this.VRAnimator.chosenRenderer == 6 || this.VRAnimator.chosenRenderer == 7) ? 'white' : 'black';
            let style = (this.VRAnimator.chosenRenderer == 5 || this.VRAnimator.chosenRenderer == 6 || this.VRAnimator.chosenRenderer == 7) ? 'white' : 'black';
            // this.chosen = this.VRAnimator.uiState;
            let cursor = ["", "", "", "", "", ""];
            cursor[this.VRAnimator.uiState] = "> ";
            let count = 0;
            if(this.VRAnimator.uiState == count)
                ctx.fillStyle = 'blue';
            else
                ctx.fillStyle = style;
            ctx.fillText(cursor[count++] + "Extcn: " + this.VRAnimator.extinction, x, y);
            y += yStep;
            if(this.VRAnimator.uiState == count)
                ctx.fillStyle = 'blue';
            else
                ctx.fillStyle = style;
            ctx.fillText(cursor[count++] + this.right ? "STEPS: " : "steps" + this.VRAnimator.steps, x, y);
            y += yStep;
            if(this.VRAnimator.uiState == count)
                ctx.fillStyle = 'blue';
            else
                ctx.fillStyle = style;
            ctx.fillText(cursor[count++] + this.renderers[this.VRAnimator.chosenRenderer], x, y);
            y += yStep;
            
            if(this.VRAnimator.uiState == count)
                ctx.fillStyle = 'blue';
            else
                ctx.fillStyle = style;
            ctx.fillText(cursor[count++] + this.views[this.VRAnimator.renderState], x, y);
            y += yStep;
            
            if(this.VRAnimator.uiState == count)
                ctx.fillStyle = 'blue';
            else
                ctx.fillStyle = style;
            ctx.fillText(cursor[count++] + "FIL:" + this.renderingContext.filter, x, y);
    
            if(this.renderingContext.fps) {
                x += 50;
                // if(this.right)
                //     x = x - 80;
                y = this._resolution.height / 2.8;
                // y = 231;
                if(this.VRAnimator.timer)
                    y = y + 18
                ctx.fillStyle = style;
                ctx.fillText("FPS: " + this.renderingContext.fps, x, y);
            }
        }
    
        if(this.VRAnimator.timer) {
            let x = this._resolution.width / 2.8 + 50;
            if(this.right)
                x = x - rightOffset;
            let y = this._resolution.height / 2.8;
            // let y = 231;
            let style = (this.VRAnimator.chosenRenderer == 5 || this.VRAnimator.chosenRenderer == 6 || this.VRAnimator.chosenRenderer == 7) ? 'white' : 'black';
            ctx.fillStyle = style;
            ctx.fillText("T: " + (this.VRAnimator.timer / 1000).toFixed(1), x, y);
        }

    }

}

_drawCircle(x, y, w, color, fill = false) {
    let ctx = this.uiCtx;
    ctx.beginPath();
    ctx.arc(x, y, w, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgb(0, 0, 0)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y, w - 1, 0, 2 * Math.PI);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();  

    if(fill) {
        ctx.beginPath();
        ctx.arc(x, y, w - 3, 0, 2 * Math.PI);
        ctx.fillStyle = 'white';
        ctx.fill();
        ctx.stroke();
    }
}

getTexture() {
    return this._renderBuffer.getAttachments().color[0];
}

_getRenderBufferSpec() {
    const gl = this._gl;
    return [{
        width   : this._resolution.width,
        height  : this._resolution.height,
        min     : gl.LINEAR,
        mag     : gl.LINEAR,
        wrapS   : gl.CLAMP_TO_EDGE,
        wrapT   : gl.CLAMP_TO_EDGE,
        format  : gl.RGBA,
        iformat : gl.RGBA,
        type    : gl.UNSIGNED_BYTE,
    }];
}


}
