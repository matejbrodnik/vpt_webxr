import { mat4 } from '../../lib/gl-matrix-module.js';

import { WebGL } from './WebGL.js';
import { SingleBuffer } from './SingleBuffer.js';
import { PerspectiveCamera } from './PerspectiveCamera.js';

const [ SHADERS, MIXINS ] = await Promise.all([
    'shaders.json',
    'mixins.json',
].map(url => fetch(url).then(response => response.json())));

export class EyeReproject {

constructor(gl, volume, renderer, tonemapper, options = {}) {
    this._gl = gl;
    this._programs = WebGL.buildPrograms(gl, SHADERS.reproject, MIXINS);


    this._resolution = options.resolution ?? {width: 512, height: 512};
    
    this._volume = volume;
    this._renderer = renderer;
    this._tonemapper = tonemapper;
    this._views = [];
    this._volumeTransform = options.transform ?? new Transform();
    this._camera = options.camera;
    console.log(this._camera)
    console.log(options)
    this._frameBuffer = new SingleBuffer(gl, this._getRenderBufferSpec());
    this._renderBuffer = new SingleBuffer(gl, this._getRenderBufferSpec());

    this._transferFunction = WebGL.createTexture(gl, {
        width   : 2,
        height  : 1,
        data    : new Uint8Array([255, 0, 0, 0, 255, 0, 0, 255]),

        iformat : gl.SRGB8_ALPHA8,
        format  : gl.RGBA,
        type    : gl.UNSIGNED_BYTE,

        wrapS   : gl.CLAMP_TO_EDGE,
        wrapT   : gl.CLAMP_TO_EDGE,
        min     : gl.LINEAR,
        mag     : gl.LINEAR,
    });

    // this._VROn = 
    this._VRAnimator = options.VRAnimator;
    this._VRAnimator = null;

    this.MVP = mat4.create();
}

updateViews(views) {
    this._views = views;
}


setMVPleft(projectionMatrix = mat4.create()) {
    const centerMatrix = mat4.fromTranslation(mat4.create(), [-0.5, -0.5, -0.5]);
    const modelMatrix = this._VRAnimator ? this._VRAnimator.model.globalMatrix : this._volumeTransform.globalMatrix;
    const viewMatrix = this._VRAnimator ? (this.right ? this._VRAnimator.transform.inverseGlobalMatrix : this._VRAnimator.transform.inverseGlobalMatrix) : this._camera.transform.inverseGlobalMatrix;
    const projectionMatrix2 = this._VRProjection || this._camera.getComponent(PerspectiveCamera).projectionMatrixR;
    // this.log(this._camera.getComponent(PerspectiveCamera).projectionMatrix);
    const matrix = mat4.create();
    mat4.multiply(matrix, centerMatrix, matrix);
    mat4.multiply(matrix, modelMatrix, matrix);
    mat4.multiply(matrix, viewMatrix, matrix);
    mat4.multiply(matrix, projectionMatrix2, matrix);

    this.MVP = matrix;
}

setMVP(projectionMatrix) {
}

reset(projectionMatrix = mat4.create()) {
    this.setMVPleft();//manual
    const gl = this._gl;
    this._frameBuffer.use();

    this.program = this._programs.reset;
    const { program, uniforms } = this.program;

    gl.useProgram(program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._tonemapper.getTexture());
    gl.uniform1i(uniforms.uColor, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_3D, this._volume.getTexture());
    gl.uniform1i(uniforms.uVolume, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this._transferFunction);
    gl.uniform1i(uniforms.uTransferFunction, 2);

    gl.uniform2f(uniforms.uInverseResolution, 1 / this._resolution.width, 1 / this._resolution.height);
    gl.uniform1f(uniforms.uRandSeed, Math.random());

    const centerMatrix = mat4.fromTranslation(mat4.create(), [-0.5, -0.5, -0.5]);
    const modelMatrix = this._VRAnimator ? this._VRAnimator.model.globalMatrix : this._volumeTransform.globalMatrix;
    const viewMatrix = this._VRAnimator ? (this.right ? this._VRAnimator.transform.inverseGlobalMatrix : this._VRAnimator.transform.inverseGlobalMatrix) : this._camera.transform.inverseGlobalMatrix;
    const projectionMatrix2 = this._VRProjection || this._camera.getComponent(PerspectiveCamera).projectionMatrixR;
    // this.log(this._camera.getComponent(PerspectiveCamera).projectionMatrix);
    const matrix = mat4.create();
    mat4.multiply(matrix, centerMatrix, matrix);
    mat4.multiply(matrix, modelMatrix, matrix);
    mat4.multiply(matrix, viewMatrix, matrix);
    mat4.multiply(matrix, projectionMatrix2, matrix);
    // this.MVP = mat4.clone(matrix);
    mat4.invert(matrix, matrix);
    this.invMVP = matrix;

    // console.log("MVP")
    // this.log(this.MVP)
    // console.log("invMVP")
    // this.log(this.invMVP)
    gl.uniformMatrix4fv(uniforms.uMvpInv, false, this.invMVP);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
}

render() {
    const gl = this._gl;

    this._renderBuffer.use();

    this.program = this._programs.render;
    
    const { program, uniforms } = this.program;

    gl.useProgram(program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._tonemapper.getTexture());
    gl.uniform1i(uniforms.uColor, 0);
    
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this._frameBuffer.getAttachments().color[0]);
    gl.uniform1i(uniforms.uPosition, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this._frameBuffer.getAttachments().color[0]);
    gl.uniform1i(uniforms.uColor2, 2);

    // gl.activeTexture(gl.TEXTURE2);
    // gl.bindTexture(gl.TEXTURE_2D, this._frameBuffer.getAttachments().color[0]);
    // gl.uniform1i(uniforms.uPositionL, 2);
    
    // console.log(this._views[1]);
    // gl.uniformMatrix4fv(uniforms.uView1, false, this._views[0]);
    // gl.uniformMatrix4fv(uniforms.uView2, false, this._views[1]);
    gl.uniform2f(uniforms.uInverseResolution, 1 / this._resolution.width, 1 / this._resolution.height);
    gl.uniform1f(uniforms.uRandSeed, Math.random());

    gl.uniformMatrix4fv(uniforms.uMvp, false, this.MVP);


    gl.drawArrays(gl.TRIANGLES, 0, 3);
}

log(matrix) {
    console.log(parseFloat(matrix[0].toFixed(3)), parseFloat(matrix[4].toFixed(3)), parseFloat(matrix[8].toFixed(3)), parseFloat(matrix[12].toFixed(3)));
    console.log(parseFloat(matrix[1].toFixed(3)), parseFloat(matrix[5].toFixed(3)), parseFloat(matrix[9].toFixed(3)), parseFloat(matrix[13].toFixed(3)));
    console.log(parseFloat(matrix[2].toFixed(3)), parseFloat(matrix[6].toFixed(3)), parseFloat(matrix[10].toFixed(3)), parseFloat(matrix[14].toFixed(3)));
    console.log(parseFloat(matrix[3].toFixed(3)), parseFloat(matrix[7].toFixed(3)), parseFloat(matrix[11].toFixed(3)), parseFloat(matrix[15].toFixed(3)));
}

getTexture() {
    return this._renderBuffer.getAttachments().color[0];
}

setVolume(volume) {
    this._volume = volume;
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
