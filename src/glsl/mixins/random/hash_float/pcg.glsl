// #part /glsl/mixins/random/hash_float/pcg

float hash(float x) {
    x = fract(x * 0.1031);
    x *= x + 33.33;
    x *= x + x;
    return fract(x);
}

float hash(vec2 x) {
    x = fract(x * vec2(443.897, 441.423));
    x += dot(x, x + 19.19);
    return fract(x.x * x.y);
}

float hash(vec3 x) {
    x = fract(x * 0.1031);
    x += dot(x, x.yzx + 33.33);
    return fract((x.x + x.y) * x.z);
}
