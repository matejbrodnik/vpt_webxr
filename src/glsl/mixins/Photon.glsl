// #part /glsl/mixins/Photon

struct Photon {
    vec3 position;
    vec3 direction;
    vec3 transmittance;
    vec3 radiance;
    vec3 M2;
    vec2 positionA;
    uint bounces;
    uint samples;
    float pdf;
};
