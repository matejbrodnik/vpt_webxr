// #part /glsl/mixins/random/distribution_float/square

vec2 random_square(inout float state) {
    float x = random_uniform(state);
    float y = random_uniform(state);
    return vec2(x, y);
}
