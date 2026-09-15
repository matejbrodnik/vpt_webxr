import { mat4 } from '../lib/gl-matrix-module.js';
import { Component } from './Component.js';

export class PerspectiveCamera extends Component {

constructor(node, options = {}) {
    super(node);

    this.fovy = options.fovy ?? 1;
    this.aspect = options.aspect ?? 1;
    this.near = options.near ?? 0.1;
    this.far = options.far ?? 100;
    // this.matrix = null;
    // this.matrix = mat4.fromValues(
    //     0.93, 0, -0.07, 0,
    //     0, 0.869, -0.035, 0,
    //     0, 0, -1, -0.2,
    //     0, 0, -1, 0
    // );
    this.matrixR = mat4.fromValues(
        0.93, 0, -0.07, 0,
        0, 0.869, -0.035, 0,
        0, 0, -1.002, -0.2,
        0, 0, -1, 0
    );
    this.matrix = mat4.fromValues(
        0.93, 0, 0.07, 0,
        0, 0.869, -0.035, 0,
        0, 0, -1.002, -0.2,
        0, 0, -1, 0
    );
    mat4.transpose(this.matrix, this.matrix)
    mat4.transpose(this.matrixR, this.matrixR)
}

get projectionMatrix() {
    if(this.matrix)
        return this.matrix;
    return mat4.perspective(mat4.create(), this.fovy, this.aspect, this.near, this.far);
}

get projectionMatrixR() {
    if(this.matrixR)
        return this.matrixR;
    return mat4.perspective(mat4.create(), this.fovy, this.aspect, this.near, this.far);
}

set projectionMatrix(matrix) {
    this.matrix = matrix;
}

}
