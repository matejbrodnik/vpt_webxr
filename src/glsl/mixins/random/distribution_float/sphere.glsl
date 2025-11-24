// #part /glsl/mixins/random/distribution_float/sphere

// Marsaglia (1972)
vec3 random_sphere(inout float state) {
    vec2 disk = random_disk(state);
    float norm = dot(disk, disk);
    float radius = 2.0 * sqrt(1.0 - norm);
    float z = 1.0 - 2.0 * norm;
    return vec3(radius * disk, z);
}
