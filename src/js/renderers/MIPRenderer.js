import { mat4 } from '../../lib/gl-matrix-module.js';

import { WebGL } from '../WebGL.js';
import { AbstractRenderer } from './AbstractRenderer.js';

import { PerspectiveCamera } from '../PerspectiveCamera.js';

const [ SHADERS, MIXINS ] = await Promise.all([
    'shaders.json',
    'mixins.json',
].map(url => fetch(url).then(response => response.json())));

export class MIPRenderer extends AbstractRenderer {

constructor(gl, volume, camera, environmentTexture, options = {}) {
    super(gl, volume, camera, environmentTexture, options);

    this.registerProperties([
        {
            name: 'steps',
            label: 'Steps',
            type: 'spinner',
            value: 200,
            min: 1,
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
            'transferFunction',
        ].includes(name)) {
            this.reset();
        }
    });

    this._programs = WebGL.buildPrograms(this._gl, SHADERS.renderers.MIP, MIXINS);
}

destroy() {
    const gl = this._gl;
    Object.keys(this._programs).forEach(programName => {
        gl.deleteProgram(this._programs[programName].program);
    });

    super.destroy();
}

// setupMultiview() {
    
//     const color = gl.createTexture();
//     gl.bindTexture(gl.TEXTURE_2D_ARRAY, color);
//     gl.texImage3D(
//         gl.TEXTURE_2D_ARRAY,
//         0,
//         gl.R8,
//         this._resolution.width,
//         this._resolution.height,
//         2,
//         0,
//         gl.RED,
//         gl.UNSIGNED_BYTE,
//         null
//     );

//     const fb = gl.createFramebuffer();
//     gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
//     ext.framebufferTextureMultiviewOVR(
//         gl.FRAMEBUFFER,
//         gl.COLOR_ATTACHMENT0,
//         color,
//         0,        // mip level
//         0,        // first layer index
//         2         // number of views
//     );

// }

_resetFrame() {
    const gl = this._gl;
    console.log(gl.getError());

    const { program, uniforms } = this._programs.reset;
    gl.useProgram(program);
    console.log(gl.getError());

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    console.log(gl.getError());
}

_generateFrame() {
    const gl = this._gl;
    console.log(gl.getError());

    const { program, uniforms } = this._programs.generate;
    gl.useProgram(program);
    console.log(gl.getError());

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_3D, this._volume.getTexture());
    gl.uniform1i(uniforms.uVolume, 0);
    console.log(gl.getError());

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this._transferFunction);
    gl.uniform1i(uniforms.uTransferFunction, 1);
    console.log(gl.getError());

    gl.uniform1f(uniforms.uStepSize, 1 / this.steps);
    gl.uniform1f(uniforms.uOffset, Math.random());

    const centerMatrix = mat4.fromTranslation(mat4.create(), [-0.5, -0.5, -0.5]);
    const modelMatrix = this._volumeTransform.globalMatrix;
    // console.log("matrices:")
    // console.log(this.VRView);
    // console.log(this.VRProjection);
    const viewMatrix = this._VRAnimator ? this._VRAnimator.transform.inverseGlobalMatrix : this._camera.transform.inverseGlobalMatrix;
    const projectionMatrix = this.VRProjection || this._camera.getComponent(PerspectiveCamera).projectionMatrix;
    const matrix = mat4.create();
    mat4.multiply(matrix, centerMatrix, matrix);
    mat4.multiply(matrix, modelMatrix, matrix);
    mat4.multiply(matrix, viewMatrix, matrix);
    mat4.multiply(matrix, projectionMatrix, matrix);
    mat4.invert(matrix, matrix);
    gl.uniformMatrix4fv(uniforms.uMvpInverseMatrix, false, matrix);
    console.log(gl.getError());
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    console.log(gl.getError());
}

_integrateFrame() {
    const gl = this._gl;
    console.log(gl.getError());

    const { program, uniforms } = this._programs.integrate;
    gl.useProgram(program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this._accumulationBuffer.getAttachments().color[0]);
    gl.uniform1i(uniforms.uAccumulator, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this._frameBuffer.getAttachments().color[0]);
    gl.uniform1i(uniforms.uFrame, 1);
    console.log(gl.getError());

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    console.log(gl.getError());
}

_renderFrame() {
    const gl = this._gl;
    console.log(gl.getError());

    const { program, uniforms } = this._programs.render;
    gl.useProgram(program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this._accumulationBuffer.getAttachments().color[0]);
    gl.uniform1i(uniforms.uAccumulator, 0);
    console.log(gl.getError());

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    console.log(gl.getError());
}

_getFrameBufferSpec() {
    const gl = this._gl;
    return [{
        width   : this._resolution.width,
        height  : this._resolution.height,
        min     : gl.NEAREST,
        mag     : gl.NEAREST,
        format  : gl.RGBA,
        iformat : gl.RGBA16F,
        type    : gl.FLOAT,
        target  : gl.TEXTURE_2D_ARRAY,
    }];
}

_getAccumulationBufferSpec() {
    const gl = this._gl;
    return [{
        width   : this._resolution.width,
        height  : this._resolution.height,
        min     : gl.NEAREST,
        mag     : gl.NEAREST,
        format  : gl.RGBA,
        iformat : gl.RGBA16F,
        type    : gl.FLOAT,
        target  : gl.TEXTURE_2D_ARRAY,
    }];
}

_getRenderBufferSpec() {
    const gl = this._gl;
    return [{
        width   : this._resolution.width,
        height  : this._resolution.height,
        min     : gl.NEAREST,
        mag     : gl.NEAREST,
        wrapS   : gl.CLAMP_TO_EDGE,
        wrapT   : gl.CLAMP_TO_EDGE,
        format  : gl.RGBA,
        iformat : gl.RGBA16F,
        type    : gl.FLOAT,
        target  : gl.TEXTURE_2D_ARRAY,
    }];
}

}
