// #part /glsl/mixins/random/distribution_float/exponential

float random_exponential(inout float state, float rate) {
    return -log(random_uniform(state)) / rate;
}
