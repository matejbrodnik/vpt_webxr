import { WebGL } from './WebGL.js';

import { SingleBuffer } from './SingleBuffer.js';

const [ SHADERS, MIXINS ] = await Promise.all([
    'shaders.json',
    'mixins.json',
].map(url => fetch(url).then(response => response.json())));

export class UIRenderer {

constructor(gl, texture, renderer, options = {}) {
    this._program = WebGL.buildPrograms(gl, SHADERS.UIRenderer, MIXINS);
    this._resolution = options.resolution ?? {width: 512, height: 512};
    this._gl = gl;
    
    this._scene = texture;
    this._renderBuffer = new SingleBuffer(gl, this._getRenderBufferSpec());
    

    this.init = false;

    this.uiCanvas = document.createElement('canvas');
    this.uiCanvas.width = 512;
    this.uiCanvas.height = 512;

    this.uiCtx = this.uiCanvas.getContext('2d', { alpha: true });

    this.VRAnimator = options.VRAnimator;

    this.renderer = renderer;
    // this.binds = DOMUtils.bind(document.body);

    // this.binds.uiCanvas.appendChild(this.uiCanvas);
}

updateRenderer(renderer) {
    this.renderer = renderer;
}

destroy() {
    const gl = this._gl;
    gl.deleteProgram(this._program.program);

    super.destroy();
}

reset() {
    const gl = this._gl;
    this.uiTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.uiTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);


    this._drawUIText("TEST test");
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        this.uiCanvas
    );
    console.log(this.renderer);
}

render() {
    if(!(this.VRAnimator && this.VRAnimator.uiActive))
        return;

    const gl = this._gl;

    this._renderBuffer.use();

    const { program, uniforms } = this._program.base;
    
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

_drawUIText() {
    let ctx = this.uiCtx;
    ctx.clearRect(0, 0, this._resolution.width, this._resolution.height);

    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, this._resolution.width, this._resolution.height);

    ctx.fillStyle = 'black';
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    // Line 1
    ctx.fillText("Extinction: " + this.VRAnimator.extinction, this.uiCanvas.width - 140, 195);
    // Line 2
    ctx.fillText("Steps: " + this.VRAnimator.steps, this.uiCanvas.width - 140, 225);
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
