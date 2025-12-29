import { mat4 } from '../../lib/gl-matrix-module.js';

import { WebGL } from '../WebGL.js';
import { AbstractRenderer } from './AbstractRenderer.js';

import { PerspectiveCamera } from '../PerspectiveCamera.js';

const [ SHADERS, MIXINS ] = await Promise.all([
    'shaders.json',
    'mixins.json',
].map(url => fetch(url).then(response => response.json())));

export class TestRenderer extends AbstractRenderer {

constructor(gl, volume, camera, environmentTexture, options = {}) {
    super(gl, volume, camera, environmentTexture, options);

    this.registerProperties([
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

    this._programs = WebGL.buildPrograms(this._gl, SHADERS.renderers.TEST, MIXINS);
    this.step = 0;
}

destroy() {
    const gl = this._gl;
    Object.keys(this._programs).forEach(programName => {
        gl.deleteProgram(this._programs[programName].program);
    });

    super.destroy();
}

_resetFrame() {
    console.log("TEST RESET");
    const gl = this._gl;

    const { program, uniforms } = this._programs.reset;
    gl.useProgram(program);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
}

_generateFrame() {
}

_integrateFrame() {
    // console.log("TEST INTEGRATE");
    const gl = this._gl;
    // console.log(gl.getError());

    const { program, uniforms } = this._programs.integrate;
    gl.useProgram(program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._accumulationBuffer.getAttachments().color[0]);

    gl.uniform1i(uniforms.uTexture, 0);
    gl.uniform1ui(uniforms.uStep, this.step);


    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if(!this.VROn) {
        this.step = 0;
    }
}


// Draw loop
render(t) {
  t *= 0.001;
  const dt = t - last; last = t;
  angle += dt * 0.7; // radians per second

  gl.clearColor(0.12,0.12,0.12,1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Build MVP
  const aspect = canvas.width / canvas.height;
  const proj = Mat4.perspective(Math.PI/4, aspect, 0.1, 100);
  const view = Mat4.translate(0,0,-6);
  const rotX = Mat4.rotateX(angle * 0.6);
  const rotY = Mat4.rotateY(angle * 0.9);
  const model = Mat4.multiply(rotY, rotX); // model = rotY * rotX
  const mv = Mat4.multiply(view, model);   // mv = view * model
  const mvp = Mat4.multiply(proj, mv);     // mvp = proj * mv

  gl.uniformMatrix4fv(uMVP, false, mvp);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
  gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

  requestAnimationFrame(render);
}

_renderFrame() {



    // console.log("TEST RENDER");
    

    // console.log(gl.getError());

    
    gl.useProgram(program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._accumulationBuffer.getAttachments().color[0]);

    gl.uniform1i(uniforms.uTexture, 0);

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

}
