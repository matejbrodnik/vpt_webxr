// #part /glsl/mixins/random/hash_float/pcg

float hash(float x) {
    x = fract(x * 0.1031 + 0.11369);
    float r = x;
    r = fract(r * (r + 33.33));
    r = fract(r * (r + r));
    return r;
}

// float hash(vec2 x) {
//     x = fract(x * vec2(443.897, 441.423));
//     x += dot(x, x + 19.19);
//     return fract(x.x * x.y);
// }

float hash(vec3 x) {
    x = fract(x * 0.1031);
    x += dot(x, x.yzx + 33.33);
    return fract((x.x + x.y) * x.z);
}
