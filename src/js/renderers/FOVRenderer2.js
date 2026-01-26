import { mat4 } from '../../lib/gl-matrix-module.js';

import { WebGL } from '../WebGL.js';
import { AbstractRenderer } from './AbstractRenderer.js';
import { MIPRenderer } from './MIPRenderer.js';

import { PerspectiveCamera } from '../PerspectiveCamera.js';

const [ SHADERS, MIXINS ] = await Promise.all([
    'shaders.json',
    'mixins.json',
].map(url => fetch(url).then(response => response.json())));

export class FOVRenderer2 extends AbstractRenderer {

constructor(gl, volume, camera, environmentTexture, options = {}) {
    super(gl, volume, camera, environmentTexture, options);

    this.registerProperties([
        {
            name: 'extinction',
            label: 'Extinction',
            type: 'spinner',
            value: 70,
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
            value: 30,
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

    this._programs = WebGL.buildPrograms(gl, SHADERS.renderers.FOV2, MIXINS);
    this.forwardMatrix = null;
    this.forwardMatrixOld = null;
    this.reproject = -1;
    this.allow = true;
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

    if(this.reproject == -1)
        this.reproject = 0;
    else if(this.iter >= 2 && this.allow) // && this._VRAnimator && this._VRAnimator.reproject)
        this.reproject = 1;
    console.log("reset");
    if(this._VRAnimator)
        console.log(this._VRAnimator.reproject);

    if(this.mip == null) {
        this.mip = new MIPRenderer(gl, this._volume, this._camera, this._environmentTexture, {
            resolution: this._resolution,
            transform: this._volumeTransform,
            VRAnimator: this._VRAnimator,
        });
        this.mip.setContext(this._context);
    }
    
    this.mip.reset();
    
    this.mip.render();

    this._MIPmap = { ...this.mip._renderBuffer.getAttachments() };

    // this._rebuildBuffers();
    // console.log(this._accumulationBuffer._readAttachments.color);

    // this._accumulationBuffer._readAttachments.color[4] = WebGL.createTexture(gl, {
    //     texture : this._MIPmap.color[0],
    //     width   : this._resolution,
    //     height  : this._resolution,
    //     min     : gl.NEAREST,
    //     mag     : gl.NEAREST,
    //     format  : gl.RGBA,
    //     iformat : gl.RGBA32F,
    //     type    : gl.FLOAT,
    // });
    // gl.bindFramebuffer(gl.FRAMEBUFFER, this._accumulationBuffer._readFramebuffer);
    // gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT4, gl.TEXTURE_2D, this._accumulationBuffer._readAttachments.color[4], 0);

    this._accumulationBuffer.use();
    
    this._context.count2 = 0;

    const { program, uniforms } = this._programs.reset;
    gl.useProgram(program);

    gl.uniform2f(uniforms.uInverseResolution, 1 / this._resolution.width, 1 / this._resolution.height);
    gl.uniform1f(uniforms.uRandSeed, Math.random());
    gl.uniform1f(uniforms.uBlur, 0);
    gl.uniform1ui(uniforms.reproject, this.reproject);
    
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._MIPmap.color[0]);
    gl.uniform1i(uniforms.uMIP, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this._accumulationBuffer.getAttachments().color[3]);
    gl.uniform1i(uniforms.uRadiance, 1);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_NEAREST);
    //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);


    const centerMatrix = mat4.fromTranslation(mat4.create(), [-0.5, -0.5, -0.5]);
    const modelMatrix = this._VRAnimator ? this._VRAnimator.model.globalMatrix : this._volumeTransform.globalMatrix;
    const viewMatrix = this._VRAnimator ? this._VRAnimator.transform.inverseGlobalMatrix : this._camera.transform.inverseGlobalMatrix;
    const projectionMatrix = this.VRProjection || this._camera.getComponent(PerspectiveCamera).projectionMatrix;

    const matrix = mat4.create();
    mat4.multiply(matrix, centerMatrix, matrix);
    mat4.multiply(matrix, modelMatrix, matrix);
    mat4.multiply(matrix, viewMatrix, matrix);
    mat4.multiply(matrix, projectionMatrix, matrix);
    if(this.forwardMatrix) {
        this.forwardMatrixOld = mat4.clone(this.forwardMatrix);
    }
    this.forwardMatrix = mat4.clone(matrix);

    mat4.invert(matrix, matrix);;
    gl.uniformMatrix4fv(uniforms.uMvpInverseMatrix, false, matrix);

    gl.drawBuffers([
        gl.COLOR_ATTACHMENT0,
        gl.COLOR_ATTACHMENT1,
        gl.COLOR_ATTACHMENT2,
        gl.COLOR_ATTACHMENT3,
        gl.COLOR_ATTACHMENT4,
        gl.COLOR_ATTACHMENT5,
    ]);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.cycles = 0;
    this.thr = 100;

    // if(this.reproject) {
    //     this._frameBuffer.use();
    //     const { program, uniforms } = this._programs.generate;
    //     gl.useProgram(program);
    //     console.log(uniforms)

    //     gl.activeTexture(gl.TEXTURE0);
    //     gl.bindTexture(gl.TEXTURE_2D, this._accumulationBuffer.getAttachments().color[3]);
    //     gl.uniform1i(uniforms.uRadiance, 0);

    //     gl.drawArrays(gl.TRIANGLES, 0, 3);
    // }
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
    if(this.cycles == this.thr || this.thr + 1) { // +1 with blur
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_NEAREST);
        gl.generateMipmap(gl.TEXTURE_2D);
    }

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
    gl.uniform1i(uniforms.uMIP, 7);

    gl.activeTexture(gl.TEXTURE8);
    gl.bindTexture(gl.TEXTURE_2D, this._accumulationBuffer.getAttachments().color[5]);
    gl.uniform1i(uniforms.uOld, 8);

    if(this.cycles <= 1) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_NEAREST);
        gl.generateMipmap(gl.TEXTURE_2D);
    }

    gl.uniform2f(uniforms.uInverseResolution, 1 / this._resolution.width, 1 / this._resolution.height);
    gl.uniform1f(uniforms.uRandSeed, Math.random());
    gl.uniform1f(uniforms.uBlur, 0);
    gl.uniform1ui(uniforms.uCycles, this.cycles);
    gl.uniform1ui(uniforms.uThr, this.thr);

    gl.uniform1f(uniforms.uExtinction, this.extinction);
    gl.uniform1f(uniforms.uAnisotropy, this.anisotropy);
    gl.uniform1ui(uniforms.uMaxBounces, this.bounces);
    gl.uniform1ui(uniforms.uSteps, this.steps);
    gl.uniform1ui(uniforms.reproject, this.reproject);
    if(this.reproject) {
        // this.log(this.forwardMatrixOld);
        // console.log("---------------");
    }
    console.log(this.reproject);
    this.reproject = 0;

    const centerMatrix = mat4.fromTranslation(mat4.create(), [-0.5, -0.5, -0.5]);
    const modelMatrix = this._VRAnimator ? this._VRAnimator.model.globalMatrix : this._volumeTransform.globalMatrix;
    const viewMatrix = this._VRAnimator ? this._VRAnimator.transform.inverseGlobalMatrix : this._camera.transform.inverseGlobalMatrix;
    const projectionMatrix = this.VRProjection || this._camera.getComponent(PerspectiveCamera).projectionMatrix;

    const matrix = mat4.create();
    mat4.multiply(matrix, centerMatrix, matrix);
    mat4.multiply(matrix, modelMatrix, matrix);
    mat4.multiply(matrix, viewMatrix, matrix);
    mat4.multiply(matrix, projectionMatrix, matrix);

    if(this.forwardMatrixOld) {
        // this.log(this.forwardMatrixOld)
        gl.uniformMatrix4fv(uniforms.uMvpA, false, this.forwardMatrixOld);
        
        // this._context.brick = true;
    }
    else
        gl.uniformMatrix4fv(uniforms.uMvpA, false, mat4.create());

    mat4.invert(matrix, matrix);
    // console.log("MODEL")
    // console.log(modelMatrix);
    // console.log("VIEW", viewMatrix);
    // console.log("PROJ", projectionMatrix)
    gl.uniformMatrix4fv(uniforms.uMvpInverseMatrix, false, matrix);

    gl.drawBuffers([
        gl.COLOR_ATTACHMENT0,
        gl.COLOR_ATTACHMENT1,
        gl.COLOR_ATTACHMENT2,
        gl.COLOR_ATTACHMENT3,
        gl.COLOR_ATTACHMENT4,
    ]);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
}

_renderFrame() {
    const gl = this._gl;

    const { program, uniforms } = this._programs.render;
    gl.useProgram(program);
    
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._accumulationBuffer.getAttachments().color[3]);
    gl.uniform1i(uniforms.uColor, 0);
    
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this._accumulationBuffer.getAttachments().color[2]);
    gl.uniform1i(uniforms.uMIP, 1);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.cycles++;
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
        iformat : gl.RGBA32F,
        type    : gl.FLOAT,
    },
    // {
    //     width   : this._resolution.width,
    //     height  : this._resolution.height,
    //     min     : gl.NEAREST,
    //     mag     : gl.NEAREST,
    //     wrapS   : gl.CLAMP_TO_EDGE,
    //     wrapT   : gl.CLAMP_TO_EDGE,
    //     format  : gl.RGBA,
    //     iformat : gl.RGBA32F,
    //     type    : gl.FLOAT,
    // }
];
}

_getAccumulationBufferSpec() {
    const gl = this._gl;
    this.rebuildRead = 1;

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

    const mipBufferSpec = {
        // texture : this._MIPmap ? this._MIPmap.color[0] : gl.createTexture(),
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
        mipBufferSpec,
        oldRadianceBufferSpec,
    ];
}

}