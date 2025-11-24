// #part /glsl/mixins/random/distribution_float/uniformdivision

float random_uniform(inout float state) {
    state = hash(state);
    return state;
}
