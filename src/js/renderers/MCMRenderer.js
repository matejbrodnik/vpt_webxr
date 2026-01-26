import { mat4 } from '../../lib/gl-matrix-module.js';

import { WebGL } from '../WebGL.js';
import { AbstractRenderer } from './AbstractRenderer.js';
import { MIPRenderer } from './MIPRenderer.js';

import { PerspectiveCamera } from '../PerspectiveCamera.js';

const [ SHADERS, MIXINS ] = await Promise.all([
    'shaders.json',
    'mixins.json',
].map(url => fetch(url).then(response => response.json())));

export class MCMRenderer extends AbstractRenderer {

constructor(gl, volume, camera, environmentTexture, options = {}) {
    super(gl, volume, camera, environmentTexture, options);

    this.registerProperties([
        {
            name: 'extinction',
            label: 'Extinction',
            type: 'spinner',
            value: 60,
            min: 0,
        },
        {
            name: 'anisotropy',
            label: 'Anisotropy',
            type: 'slider',
            value: 0,
            min: -1,
            max: 1,
        },
        {
            name: 'bounces',
            label: 'Max bounces',
            type: 'spinner',
            value: 8,
            min: 0,
        },
        {
            name: 'steps',
            label: 'Steps',
            type: 'spinner',
            value: 60,
            min: 0,
        },
        {
            name: 'transferFunction',
            label: 'Transfer function',
            type: 'transfer-function',
            value: new Uint8Array(256),
        },
    ]);

    this.addEventListener('change', e => {
        const { name, value } = e.detail;

        if (name === 'transferFunction') {
            this.setTransferFunction(this.transferFunction);
        }

        if ([
            'extinction',
            'anisotropy',
            'bounces',
            'transferFunction',
        ].includes(name)) {
            this.reset();
        }
    });

    this._programs = WebGL.buildPrograms(gl, SHADERS.renderers.MCM, MIXINS);
    this.forwardMatrix = null;
    this.forwardMatrixOld = null;
    this.reproject = -1;
    this.iter = 0;
}

destroy() {
    const gl = this._gl;
    Object.keys(this._programs).forEach(programName => {
        gl.deleteProgram(this._programs[programName].program);
    });

    super.destroy();
}

_resetFrame() {
    const gl = this._gl;

    const { program, uniforms } = this._programs.reset;
    gl.useProgram(program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._accumulationBuffer.getAttachments().color[3]);
    gl.uniform1i(uniforms.uRadiance, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this._accumulationBuffer.getAttachments().color[6]);
    gl.uniform1i(uniforms.uAcc, 1);

    gl.uniform2f(uniforms.uInverseResolution, 1 / this._resolution.width, 1 / this._resolution.height);
    gl.uniform1f(uniforms.uRandSeed, Math.random());
    gl.uniform1f(uniforms.uBlur, 0);

    const centerMatrix = mat4.fromTranslation(mat4.create(), [-0.5, -0.5, -0.5]);
    const modelMatrix = this._VRAnimator ? this._VRAnimator.model.globalMatrix : this._volumeTransform.globalMatrix;
    const viewMatrix = this._VRAnimator ? this._VRAnimator.transform.inverseGlobalMatrix : this._camera.transform.inverseGlobalMatrix;
    const projectionMatrix = this.VRProjection || this._camera.getComponent(PerspectiveCamera).projectionMatrix;

    const matrix = mat4.create();
    // console.log("prv: ", this.matrix);
    
    mat4.multiply(matrix, centerMatrix, matrix);
    mat4.multiply(matrix, modelMatrix, matrix);
    mat4.multiply(matrix, viewMatrix, matrix);
    mat4.multiply(matrix, projectionMatrix, matrix);
    this.log(modelMatrix);
    console.log("---");
    this.log(viewMatrix);
    console.log("---------");

    // console.log("fwd: ");
    // console.log(JSON.parse(JSON.stringify(matrix)))
    if(this.matrix == matrix)
        console.log("SAME");
    gl.uniformMatrix4fv(uniforms.uMvpForwardMatrix, false, matrix);
    if(this.forwardMatrix) {
        this.forwardMatrixOld = mat4.clone(this.forwardMatrix);
    }
    this.forwardMatrix = mat4.clone(matrix);
    mat4.invert(matrix, matrix);
    gl.uniformMatrix4fv(uniforms.uMvpInverseMatrix, false, matrix);
    this.log(matrix);

    // console.log("inv: ");
    // console.log(JSON.parse(JSON.stringify(matrix)))
    gl.drawBuffers([
        gl.COLOR_ATTACHMENT0,
        gl.COLOR_ATTACHMENT1,
        gl.COLOR_ATTACHMENT2,
        gl.COLOR_ATTACHMENT3,
        gl.COLOR_ATTACHMENT4,
        gl.COLOR_ATTACHMENT5,
        gl.COLOR_ATTACHMENT6,
        gl.COLOR_ATTACHMENT7,
    ]);

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if(this.reproject == -1)
        this.reproject = 0;
    else if(this.iter > 1)
        this.reproject = 1;

    this.iter = 0;

}

_generateFrame() {
}

_integrateFrame() {
    const gl = this._gl;

    const { program, uniforms } = this._programs.integrate;
    gl.useProgram(program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._accumulationBuffer.getAttachments().color[0]);
    gl.uniform1i(uniforms.uPosition, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this._accumulationBuffer.getAttachments().color[1]);
    gl.uniform1i(uniforms.uDirection, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this._accumulationBuffer.getAttachments().color[2]);
    gl.uniform1i(uniforms.uTransmittance, 2);

    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this._accumulationBuffer.getAttachments().color[3]);
    gl.uniform1i(uniforms.uRadiance, 3);

    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_3D, this._volume.getTexture());
    gl.uniform1i(uniforms.uVolume, 4);

    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, this._environmentTexture);
    gl.uniform1i(uniforms.uEnvironment, 5);

    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_2D, this._transferFunction);
    gl.uniform1i(uniforms.uTransferFunction, 6);

    gl.activeTexture(gl.TEXTURE7);
    gl.bindTexture(gl.TEXTURE_2D, this._accumulationBuffer.getAttachments().color[4]);
    gl.uniform1i(uniforms.uDepth, 7);

    gl.activeTexture(gl.TEXTURE8);
    gl.bindTexture(gl.TEXTURE_2D, this._accumulationBuffer.getAttachments().color[5]);
    gl.uniform1i(uniforms.uFrom, 8);
    
    gl.activeTexture(gl.TEXTURE9);
    gl.bindTexture(gl.TEXTURE_2D, this._accumulationBuffer.getAttachments().color[6]);
    gl.uniform1i(uniforms.uAcc, 9);

    gl.activeTexture(gl.TEXTURE10);
    gl.bindTexture(gl.TEXTURE_2D, this._accumulationBuffer.getAttachments().color[7]);
    gl.uniform1i(uniforms.uOld, 10);

    gl.uniform2f(uniforms.uInverseResolution, 1 / this._resolution.width, 1 / this._resolution.height);
    gl.uniform1f(uniforms.uRandSeed, Math.random());
    gl.uniform1f(uniforms.uBlur, 0);

    gl.uniform1f(uniforms.uExtinction, this.extinction);
    gl.uniform1f(uniforms.uAnisotropy, this.anisotropy);
    gl.uniform1ui(uniforms.uMaxBounces, this.bounces);
    gl.uniform1ui(uniforms.uSteps, this.steps);
    gl.uniform1ui(uniforms.reproject, this.reproject);
    this.reproject = 0;

    const centerMatrix = mat4.fromTranslation(mat4.create(), [-0.5, -0.5, -0.5]);
    // const modelMatrix = this._volumeTransform.globalMatrix;
    const modelMatrix = this._VRAnimator ? this._VRAnimator.model.globalMatrix : this._volumeTransform.globalMatrix;
    const viewMatrix = this._VRAnimator ? this._VRAnimator.transform.inverseGlobalMatrix : this._camera.transform.inverseGlobalMatrix;
    const projectionMatrix = this.VRProjection || this._camera.getComponent(PerspectiveCamera).projectionMatrix;
    // console.log("int");
    // console.log(centerMatrix);
    console.log("model", modelMatrix);
    const matrix = mat4.create();
    mat4.multiply(matrix, centerMatrix, matrix);
    mat4.multiply(matrix, modelMatrix, matrix);
    mat4.multiply(matrix, viewMatrix, matrix);
    mat4.multiply(matrix, projectionMatrix, matrix);
    
    this.matrix = matrix;
    // console.log("int", matrix);
    this.log(mat4.clone(matrix))
    if(this.forwardMatrixOld) {
        this.log(this.forwardMatrixOld)
        gl.uniformMatrix4fv(uniforms.uMvpA, false, matrix);
        // this._context.brick = true;
    }
    else
        gl.uniformMatrix4fv(uniforms.uMvpA, false, mat4.create());
    
    const matrix2 = mat4.create();
    mat4.invert(matrix2, matrix);
    gl.uniformMatrix4fv(uniforms.uMvpInverseMatrix, false, matrix2);

    gl.drawBuffers([
        gl.COLOR_ATTACHMENT0,
        gl.COLOR_ATTACHMENT1,
        gl.COLOR_ATTACHMENT2,
        gl.COLOR_ATTACHMENT3,
        gl.COLOR_ATTACHMENT4,
        gl.COLOR_ATTACHMENT5,
        gl.COLOR_ATTACHMENT6,
    ]);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.iter++;

}

_renderFrame() {
    const gl = this._gl;

    const { program, uniforms } = this._programs.render;
    gl.useProgram(program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._accumulationBuffer.getAttachments().color[3]);
    gl.uniform1i(uniforms.uColor, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this._accumulationBuffer.getAttachments().color[4]);
    gl.uniform1i(uniforms.uDepth, 1);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
}

_getFrameBufferSpec() {
    const gl = this._gl;
    return [{
        width   : this._resolution.width,
        height  : this._resolution.height,
        min     : gl.NEAREST,
        mag     : gl.NEAREST,
        format  : gl.RGBA,
        iformat : gl.RGBA32F,
        type    : gl.FLOAT,
    }];
}

_getAccumulationBufferSpec() {
    const gl = this._gl;

    const positionBufferSpec = {
        width   : this._resolution.width,
        height  : this._resolution.height,
        min     : gl.NEAREST,
        mag     : gl.NEAREST,
        format  : gl.RGBA,
        iformat : gl.RGBA32F,
        type    : gl.FLOAT,
    };

    const directionBufferSpec = {
        width   : this._resolution.width,
        height  : this._resolution.height,
        min     : gl.NEAREST,
        mag     : gl.NEAREST,
        format  : gl.RGBA,
        iformat : gl.RGBA32F,
        type    : gl.FLOAT,
    };

    const transmittanceBufferSpec = {
        width   : this._resolution.width,
        height  : this._resolution.height,
        min     : gl.NEAREST,
        mag     : gl.NEAREST,
        format  : gl.RGBA,
        iformat : gl.RGBA32F,
        type    : gl.FLOAT,
    };

    const radianceBufferSpec = {
        width   : this._resolution.width,
        height  : this._resolution.height,
        min     : gl.NEAREST,
        mag     : gl.NEAREST,
        format  : gl.RGBA,
        iformat : gl.RGBA32F,
        type    : gl.FLOAT,
    };

    const depthBufferSpec = {
        width   : this._resolution.width,
        height  : this._resolution.height,
        min     : gl.NEAREST,
        mag     : gl.NEAREST,
        format  : gl.RGBA,
        iformat : gl.RGBA32F,
        type    : gl.FLOAT,
    };

    const fromBufferSpec = {
        width   : this._resolution.width,
        height  : this._resolution.height,
        min     : gl.NEAREST,
        mag     : gl.NEAREST,
        format  : gl.RGBA,
        iformat : gl.RGBA32F,
        type    : gl.FLOAT,
    };

    const accBufferSpec = {
        width   : this._resolution.width,
        height  : this._resolution.height,
        min     : gl.NEAREST,
        mag     : gl.NEAREST,
        format  : gl.RGBA,
        iformat : gl.RGBA32F,
        type    : gl.FLOAT,
    };

    const oldRadianceBufferSpec = {
        width   : this._resolution.width,
        height  : this._resolution.height,
        min     : gl.NEAREST,
        mag     : gl.NEAREST,
        format  : gl.RGBA,
        iformat : gl.RGBA32F,
        type    : gl.FLOAT,
    };

    return [
        positionBufferSpec,
        directionBufferSpec,
        transmittanceBufferSpec,
        radianceBufferSpec,
        depthBufferSpec,
        fromBufferSpec,
        accBufferSpec,
        oldRadianceBufferSpec,
    ];
}

}