// #part /glsl/mixins/random/hash_float/tea

float hash(vec2 r) {
    float a = fract(r.x * 1.3819660113 + r.y * 0.72360679775 + 0.1547);
    float b = fract(r.y * 1.73205080756 + 0.41421356237);
    return a;
}


// float hash(vec2 state) {
//     const float d = 0.61803398875; // golden ratio
//     state = fract(state + d);

//     float a = state.x;
//     float b = state.y;

//     a = fract(a + b * 0.38196601125);
//     b = fract(b + a * 0.72360679775);

//     a = fract(a * (a + 0.5));
//     b = fract(b * (b + 0.75));

//     float r = fract(a + b);
//     state = vec2(a, b);
//     return r;
// }