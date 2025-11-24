// #part /glsl/mixins/random/distribution_float/disk

vec2 random_disk(inout float state) {
    float radius = sqrt(random_uniform(state));
    float angle = TWOPI * random_uniform(state);
    return radius * vec2(cos(angle), sin(angle));
}
