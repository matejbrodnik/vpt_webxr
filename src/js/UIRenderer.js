import { WebGL } from './WebGL.js';

import { SingleBuffer } from './SingleBuffer.js';
import { quat, vec3 } from '../../lib/gl-matrix-module.js';

const [ SHADERS, MIXINS ] = await Promise.all([
    'shaders.json',
    'mixins.json',
].map(url => fetch(url).then(response => response.json())));

export class UIRenderer {

constructor(gl, texture, options = {}) {
    this._programs = WebGL.buildPrograms(gl, SHADERS.UIRenderer, MIXINS);
    this._resolution = options.resolution ?? {width: 512, height: 512};
    this._gl = gl;
    
    this._scene = texture;
    this._renderBuffer = new SingleBuffer(gl, this._getRenderBufferSpec());

    this.init = false;

    this.uiCanvas = document.createElement('canvas');
    this.uiCanvas.width = 512;
    this.uiCanvas.height = 512;
    this.ratioW = this._resolution.width / 512;
    this.ratioH = this._resolution.height / 512;

    this.uiCtx = this.uiCanvas.getContext('2d', { alpha: true });

    this.VRAnimator = options.VRAnimator;
    this.chosen = 0;

    this.renderers = ["FOV2", "MIP", "MCM", "ISO", "DOS", "LAO"];
    this.views = ["MONO", "STEREO", "REPROJ"];
    this.right = true;

    this.depthMode = false;
    this.depthParams = {
        xA: 300, yA: 250,
        xB: 370, yB: 200,
        xD: 340, yD: 230,
        rotation: quat.create(), translation: vec3.create()
    }
    
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
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    // if(reset || !(this.VRAnimator))
    //     ctx.fillText("TEST test", this.uiCanvas.width - 140, 195);
    if(this.VRAnimator) {
        if(this.VRAnimator.lockCircle) {
            if(this.VRAnimator.circleActive > 0) {
                // this.VRAnimator.model.localTranslation = this.depthParams.translation;
                // this.VRAnimator.model.localRotation = this.depthParams.rotation;
                return;
            }
    
            this._drawCircle(this.depthParams.xA - (this.right ? 38 : 0), this.depthParams.yA, 8, 'rgb(109, 255, 41)')
    
            this._drawCircle(this.depthParams.xD - (this.right ? 38 : 0), this.depthParams.yD, 8, 'rgb(161, 161, 161)')
    
            this._drawCircle(this.depthParams.xB - (this.right ? 38 : 0), this.depthParams.yB, 8, 'rgb(237, 41, 255)')
            
            ctx.strokeStyle = 'black';
            //bar
            let x = 210;
            let y = 300;
            if(this.right)
                x = x - 38;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo((x + 170), y);
            ctx.stroke();
        
            this._drawCircle((x), y, 10, 'rgb(109, 255, 41)', true);
            this._drawCircle((x + 170), y, 10, 'rgb(237, 41, 255)', true);
            this._drawCircle((x + this.VRAnimator.bar), y, 10, 'rgb(161, 161, 161)', true);
            ctx.strokeStyle = 'black';
    
            // ctx.beginPath();
            // ctx.arc((x + this.VRAnimator.bar), y, 14, 0, 2 * Math.PI);
            // ctx.fillStyle = 'rgb(161, 161, 161)';
            // ctx.fill();
            // ctx.lineWidth = 2;
            // ctx.stroke();

        }
        if(this.VRAnimator.uiActive) {
            let x = this.uiCanvas.width - 160;
            if(this.right)
                x = x - 80;
            let y = 190;
            let yStep = 20;
            // this.chosen = this.VRAnimator.uiState;
            let cursor = ["", "", "", "", ""];
            cursor[this.VRAnimator.uiState] = "> ";
            let count = 0;
            if(this.VRAnimator.uiState == count)
                ctx.fillStyle = 'blue';
            else
                ctx.fillStyle = 'black';
            ctx.fillText(cursor[count++] + "Extinction: " + this.VRAnimator.extinction, x, y);
            y += yStep;
            if(this.VRAnimator.uiState == count)
                ctx.fillStyle = 'blue';
            else
                ctx.fillStyle = 'black';
            ctx.fillText(cursor[count++] + "Steps: " + this.VRAnimator.steps, x, y);
            y += yStep;
            if(this.VRAnimator.uiState == count)
                ctx.fillStyle = 'blue';
            else
                ctx.fillStyle = 'black';
            ctx.fillText(cursor[count++] + this.renderers[this.VRAnimator.chosenRenderer] + " renderer", x, y);
            y += yStep;
    
            
            if(this.VRAnimator.uiState == count)
                ctx.fillStyle = 'blue';
            else
                ctx.fillStyle = 'black';
            ctx.fillText(cursor[count++] + this.views[this.VRAnimator.renderState] + " view", x, y);
        }
    }
        

        // x = 218;
        // y = this._resolution.height - 72;
        // if(this.right)
        //     x = x - 120;
        // ctx.beginPath();
        // ctx.moveTo(x, y);
        // ctx.lineTo(x + 190, y);
        // ctx.stroke();
    
        // ctx.beginPath();
        // ctx.arc(x + this.VRAnimator.bar, y, 14, 0, 2 * Math.PI);
        // ctx.fillStyle = 'rgb(161, 161, 161)';
        // ctx.fill();
        // ctx.lineWidth = 2;
        // ctx.stroke();

    // ctx.beginPath();
    // ctx.moveTo(200, 700);
    // ctx.lineTo(200 + 800, 700);
    // ctx.stroke();

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
