import { WebGL } from './WebGL.js';

export class SingleBuffer {

constructor(gl, spec, extMV = null) {
    this._gl = gl;
    this._spec = spec;

    this._attachments = this._createAttachmentsFromSpec(gl, this._spec);
    this._framebuffer = WebGL.createFramebuffer(gl, this._attachments, extMV);

    this._width = this._spec[0].width;
    this._height = this._spec[0].height;
}

destroy() {
    const gl = this._gl;
    gl.deleteFramebuffer(this._framebuffer);
    for (let texture of this._attachments.color) {
        gl.deleteTexture(texture);
    }
}

_createAttachmentsFromSpec(gl, spec) {
    return { color: spec.map(s => WebGL.createTexture(gl, s)) };
}

use() {
    const gl = this._gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._framebuffer);
    gl.viewport(0, 0, this._width, this._height);
    console.log(gl.getError());
}

getAttachments() {
    return this._attachments;
}

}
