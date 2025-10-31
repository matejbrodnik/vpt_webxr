import { SingleBuffer } from '../SingleBuffer.js';
import { DoubleBuffer } from '../DoubleBuffer.js';
import { WebGL } from '../WebGL.js';
import { AbstractToneMapper } from './AbstractToneMapper.js';

const [ SHADERS, MIXINS ] = await Promise.all([
    'shaders.json',
    'mixins.json',
].map(url => fetch(url).then(response => response.json())));

export class DeviationToneMapper extends AbstractToneMapper {

constructor(gl, texture, options = {}) {
    super(gl, texture, options);

    this.registerProperties([
        {
            name: 'low',
            label: 'Low',
            type: 'spinner',
            value: 0,
        },
        {
            name: 'high',
            label: 'High',
            type: 'spinner',
            value: 1,
        },
        {
            name: 'mid',
            label: 'Midtones',
            type: 'slider',
            value: 0.5,
            min: 0.00001,
            max: 0.99999,
        },
        {
            name: 'saturation',
            label: 'Saturation',
            type: 'spinner',
            value: 1,
        },
        {
            name: 'gamma',
            label: 'Gamma',
            type: 'spinner',
            value: 2.2,
            min: 0,
        },
    ]);

    this._program = WebGL.buildPrograms(gl, {
        DeviationToneMapper: SHADERS.tonemappers.DeviationToneMapper
    }, MIXINS).DeviationToneMapper;
    this._Ref = null;
}

destroy() {
    const gl = this._gl;
    gl.deleteProgram(this._program.program);

    super.destroy();
}

render() {
    
}

_renderFrame() {
    const gl = this._gl;

    const { program, uniforms } = this._program;
    gl.useProgram(program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._texture);
    gl.uniform1i(uniforms.uTexture, 0);

    if(!this._lastTexture) {
        console.log("ERROR!!!");
    }

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this._lastTexture);
    gl.uniform1i(uniforms.uTexture2, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this._accumulationBuffer.getAttachments().color[0]);
    gl.uniform1i(uniforms.uDeviation, 2);

    // gl.activeTexture(gl.TEXTURE2);
    // gl.bindTexture(gl.TEXTURE_2D, this._position);
    // gl.uniform1i(uniforms.uPosition, 2);

    gl.uniform1f(uniforms.uLow, this.low);
    gl.uniform1f(uniforms.uMid, this.mid);
    gl.uniform1f(uniforms.uHigh, this.high);
    gl.uniform1f(uniforms.uSaturation, this.saturation);
    gl.uniform1f(uniforms.uGamma, this.gamma);

    gl.drawBuffers([
        gl.COLOR_ATTACHMENT0,
        gl.COLOR_ATTACHMENT1,
    ]);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
}

_rebuildBuffers() {
    super._rebuildBuffers();
    this._accumulationBuffer = new DoubleBuffer(gl, this._getAccumulationBufferSpec());
}

_getRenderBufferSpec() {
    const gl = this._gl;
    return [{
        width   : this._resolution,
        height  : this._resolution,
        min     : gl.LINEAR,
        mag     : gl.LINEAR,
        wrapS   : gl.CLAMP_TO_EDGE,
        wrapT   : gl.CLAMP_TO_EDGE,
        format  : gl.RGBA,
        iformat : gl.RGBA,
        type    : gl.UNSIGNED_BYTE,
    }];
}

_getAccumulationBufferSpec() { 
    const gl = this._gl;
    return [{
        width   : this._resolution,
        height  : this._resolution,
        min     : gl.NEAREST,
        mag     : gl.NEAREST,
        wrapS   : gl.CLAMP_TO_EDGE,
        wrapT   : gl.CLAMP_TO_EDGE,
        format  : gl.RGBA,
        iformat : gl.RGBA32F,
        type    : gl.FLOAT,
    }];
}

}
