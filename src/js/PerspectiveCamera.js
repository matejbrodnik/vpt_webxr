import { mat4 } from '../lib/gl-matrix-module.js';
import { Component } from './Component.js';

export class PerspectiveCamera extends Component {

constructor(node, options = {}) {
    super(node);

    this.fovy = options.fovy ?? 1;
    this.aspect = options.aspect ?? 1;
    this.near = options.near ?? 0.1;
    this.far = options.far ?? 100;
    this.matrix = null;
}

get projectionMatrix() {
    if(this.matrix)
        return this.matrix;
    return mat4.perspective(mat4.create(), this.fovy, this.aspect, this.near, this.far);
}

set projectionMatrix(matrix) {
    this.matrix = matrix;
}

}
