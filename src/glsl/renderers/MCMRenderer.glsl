// #part /glsl/shaders/renderers/MCM/integrate/vertex

#version 300 es

const vec2 vertices[] = vec2[](
    vec2(-1, -1),
    vec2( 3, -1),
    vec2(-1,  3)
);

out vec2 vPosition;

void main() {
    vec2 position = vertices[gl_VertexID];
    vPosition = position;
    gl_Position = vec4(position, 0, 1);
}

// #part /glsl/shaders/renderers/MCM/integrate/fragment

#version 300 es
precision highp float;
precision highp sampler2D;
precision highp sampler3D;

#define EPS 1e-5

// #link /glsl/mixins/Photon
@Photon
// #link /glsl/mixins/intersectCube
@intersectCube

@constants
@random/hash_float/pcg
@random/distribution_float/uniformdivision
@random/distribution_float/square
@random/distribution_float/disk
@random/distribution_float/sphere
@random/distribution_float/exponential

@unprojectRandFloat

uniform sampler2D uPosition;
uniform sampler2D uDirection;
uniform sampler2D uTransmittance;
uniform sampler2D uRadiance;
uniform sampler2D uDepth;
uniform sampler2D uFrom;
uniform sampler2D uAcc;
uniform sampler2D uOld;

uniform sampler3D uVolume;
uniform sampler2D uTransferFunction;
uniform sampler2D uEnvironment;

uniform mat4 uMvpInverseMatrix;
uniform mat4 uMvpA;
uniform vec2 uInverseResolution;
uniform float uRandSeed;
uniform float uBlur;
uniform float uExtinction;
uniform float uAnisotropy;
uniform uint reproject;

uniform uint uMaxBounces;
uniform uint uSteps;

in vec2 vPosition;

layout (location = 0) out vec4 oPosition;
layout (location = 1) out vec4 oDirection;
layout (location = 2) out vec4 oTransmittance;
layout (location = 3) out vec4 oRadiance;
layout (location = 4) out vec4 oDepth;
layout (location = 5) out vec4 oFrom;
layout (location = 6) out vec4 oAcc;

void resetPhoton(inout float state, inout Photon photon) {
    vec3 from, to;
    unprojectRandFloat(state, vPosition, uMvpInverseMatrix, uInverseResolution, uBlur, from, to);
    photon.direction = normalize(to - from);
    photon.bounces = 0u;
    vec2 tbounds = max(intersectCube(from, photon.direction), 0.0);
    photon.position = from + tbounds.x * photon.direction;
    photon.transmittance = vec3(1);
    photon.from = from;
}

vec4 sampleEnvironmentMap(vec3 d) {
    vec2 texCoord = vec2(atan(d.x, -d.z), asin(-d.y) * 2.0) * INVPI * 0.5 + 0.5;
    return texture(uEnvironment, texCoord);
}

vec4 sampleVolumeColor(vec3 position) {
    vec2 volumeSample = texture(uVolume, position).rg;
    vec4 transferSample = texture(uTransferFunction, volumeSample);
    return transferSample;
}

float sampleHenyeyGreensteinAngleCosine(inout float state, float g) {
    float g2 = g * g;
    float c = (1.0 - g2) / (1.0 - g + 2.0 * g * random_uniform(state));
    return (1.0 + g2 - c * c) / (2.0 * g);
}

vec3 sampleHenyeyGreenstein(inout float state, float g, vec3 direction) {
    // generate random direction and adjust it so that the angle is HG-sampled
    vec3 u = random_sphere(state);
    if (abs(g) < EPS) {
        return u;
    }
    float hgcos = sampleHenyeyGreensteinAngleCosine(state, g);
    vec3 circle = normalize(u - dot(u, direction) * direction);
    return sqrt(1.0 - hgcos * hgcos) * circle + hgcos * direction;
}

float max3(vec3 v) {
    return max(max(v.x, v.y), v.z);
}

void main() {
    Photon photon;
    vec2 mappedPosition = vPosition * 0.5 + 0.5;
    float state = hash(vec3(mappedPosition.x * 123.456, mappedPosition.y * 654.321, uRandSeed));
    
    vec4 radianceAndSamples = texture(uRadiance, mappedPosition);
    photon.radiance = radianceAndSamples.rgb;
    photon.samples = uint(radianceAndSamples.w + 0.5);
    photon.position = texture(uPosition, mappedPosition).xyz;
    vec4 directionAndBounces = texture(uDirection, mappedPosition);
    photon.direction = directionAndBounces.xyz;
    photon.bounces = uint(directionAndBounces.w + 0.5);
    photon.transmittance = texture(uTransmittance, mappedPosition).rgb;
    photon.depth = texture(uDepth, mappedPosition).rgb;
    photon.from = texture(uFrom, mappedPosition).rgb;
    photon.acc = texture(uAcc, mappedPosition).rgb;

    vec3 saved = vec3(0);
    for (uint i = 0u; i < uSteps; i++) {
        float dist = random_exponential(state, uExtinction);
        photon.position += dist * photon.direction;

        vec4 volumeSample = sampleVolumeColor(photon.position);

        // float PNull = 1.0 - volumeSample.a;
        float PScattering;
        if (photon.bounces >= uMaxBounces) {
            PScattering = 0.0;
        } else {
            PScattering = volumeSample.a * max3(volumeSample.rgb);
        }
        // float PAbsorption = 1.0 - PNull - PScattering;
        float PAbsorption = volumeSample.a - PScattering;

        float fortuneWheel = random_uniform(state);
        if (any(greaterThan(photon.position, vec3(1))) || any(lessThan(photon.position, vec3(0)))) {
            // out of bounds
            if(saved == vec3(0)) {
                saved = photon.position;
            }

            vec4 envSample = sampleEnvironmentMap(photon.direction);
            vec3 radiance = photon.transmittance * envSample.rgb;
            photon.samples++;
            photon.radiance += (radiance - photon.radiance) / float(photon.samples);
            vec3 pos = photon.position;
            photon.acc += (photon.position - photon.acc) / float(photon.samples);
            resetPhoton(state, photon);
            photon.depth += (vec3(dot(pos - photon.from, photon.direction)) - photon.depth) / float(photon.samples);
        } else if (fortuneWheel < PAbsorption) {
            // absorption
            if(saved == vec3(0)) {
                saved = photon.position;
            }
            vec3 radiance = vec3(0);
            photon.samples++;
            photon.radiance += (radiance - photon.radiance) / float(photon.samples);
            vec3 pos = photon.position;
            photon.acc += (photon.position - photon.acc) / float(photon.samples);
            resetPhoton(state, photon);
            photon.depth += (vec3(dot(pos - photon.from, photon.direction)) - photon.depth) / float(photon.samples);
        } else if (fortuneWheel < volumeSample.a) {
            // scattering
            if(saved == vec3(0)) {
                saved = photon.position;
            }
            photon.transmittance *= volumeSample.rgb;
            photon.direction = sampleHenyeyGreenstein(state, uAnisotropy, photon.direction);
            photon.bounces++;
        } else {
            // null collision
        }
    }
    // photon.depth = vec3(0);
    vec2 uvA = vec2(0);
    vec3 old = texture(uOld, mappedPosition).rgb;
    if(reproject > 0u && saved != vec3(0)) {
        vec4 clipA = uMvpA * vec4(saved, 1.0);
        vec3 ndcA = clipA.xyz / clipA.w;
        uvA = ndcA.xy * 0.5 + 0.5;
        old = texture(uOld, uvA).rgb;
        uint s = 1u;
        photon.radiance = (photon.radiance * float(photon.samples) + old * float(s)) / float(photon.samples + s);
        photon.samples += s;
        photon.radiance = old;
    }
    // photon.depth = abs(photon.radiance - old);

    oPosition = vec4(photon.position, 0);
    oDirection = vec4(photon.direction, float(photon.bounces));
    oTransmittance = vec4(photon.transmittance, 0);
    oRadiance = vec4(photon.radiance, float(photon.samples));
    oDepth = vec4(photon.depth, 1);
    oFrom = vec4(photon.from, 1);
    oAcc = vec4(photon.acc, 1);
    // if(texture(uDirection, mappedPosition) == texture(uDirection, uvA)) {
    //     oRadiance = vec4(0.0, 1.0, 0.0, 1.0);
    // }
}

// #part /glsl/shaders/renderers/MCM/render/vertex

#version 300 es

const vec2 vertices[] = vec2[](
    vec2(-1, -1),
    vec2( 3, -1),
    vec2(-1,  3)
);

out vec2 vPosition;

void main() {
    vec2 position = vertices[gl_VertexID];
    vPosition = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0, 1);
}

// #part /glsl/shaders/renderers/MCM/render/fragment

#version 300 es
precision highp float;
precision highp sampler2D;

uniform sampler2D uColor;
uniform sampler2D uDepth;

in vec2 vPosition;

out vec4 oColor;

void main() {
    // float d = texture(uDepth, vPosition).r;
    // vec3 color = vec3(0);
    // if(d >= 0.9) {
    //     color = vec3(1, 0, 0);
    // }
    // else if(d >= 0.8) {
    //     color = vec3(0.66, 0, 0);
    // }
    // else if(d >= 0.7) {
    //     color = vec3(0.33, 0, 0);
    // }
    // else if(d >= 0.6) {
    //     color = vec3(0, 1, 0);
    // }
    // else if(d >= 0.5) {
    //     color = vec3(0, 0.66, 0);
    // }
    // else if(d >= 0.5) {
    //     color = vec3(0, 0.33, 0);
    // }
    // else if(d >= 0.4) {
    //     color = vec3(0, 0, 1);
    // }
    // else if(d >= 0.3) {
    //     color = vec3(0, 0, 0.66);
    // }
    // else if(d >= 0.2) {
    //     color = vec3(0, 0, 0.33);
    // }
    // else if(d >= 0.1) {
    //     color = vec3(0.33, 0.33, 0.33);
    // }
    // // else {
    // //     d = 0.0;
    // // }

    // oColor = vec4(texture(uDepth, vPosition));
    // oColor = vec4(d, d, d, 1);
    // oColor = vec4(color, 1);
    oColor = vec4(texture(uColor, vPosition).rgb, 1);
}

// #part /glsl/shaders/renderers/MCM/reset/vertex

#version 300 es

const vec2 vertices[] = vec2[](
    vec2(-1, -1),
    vec2( 3, -1),
    vec2(-1,  3)
);

out vec2 vPosition;

void main() {
    vec2 position = vertices[gl_VertexID];
    vPosition = position;
    gl_Position = vec4(position, 0, 1);
}

// #part /glsl/shaders/renderers/MCM/reset/fragment

#version 300 es
precision highp float;

// #link /glsl/mixins/Photon
@Photon
// #link /glsl/mixins/intersectCube
@intersectCube

@constants
@random/hash_float/pcg
@random/distribution_float/uniformdivision
@random/distribution_float/square
@random/distribution_float/disk
@random/distribution_float/sphere
@random/distribution_float/exponential

@unprojectRandFloat

uniform mat4 uMvpInverseMatrix;
uniform mat4 uMvpForwardMatrix;
uniform vec2 uInverseResolution;
uniform float uRandSeed;
uniform float uBlur;

uniform sampler2D uRadiance;
uniform sampler2D uAcc;

in vec2 vPosition;

layout (location = 0) out vec4 oPosition;
layout (location = 1) out vec4 oDirection;
layout (location = 2) out vec4 oTransmittance;
layout (location = 3) out vec4 oRadiance;
layout (location = 4) out vec4 oDepth;
layout (location = 5) out vec4 oFrom;
layout (location = 6) out vec4 oAcc;
layout (location = 7) out vec4 oOld;

void main() {
    Photon photon;
    vec3 from, to;
    float state = hash(vec3(vPosition.x * 123.456, vPosition.y * 654.321, uRandSeed));

    unprojectRandFloat(state, vPosition, uMvpInverseMatrix, uInverseResolution, uBlur, from, to);
    
    photon.direction = normalize(to - from);
    vec2 tbounds = max(intersectCube(from, photon.direction), 0.0);
    photon.position = from + tbounds.x * photon.direction;


    vec2 mappedPosition = vPosition * 0.5 + 0.5;
    vec4 acc = texture(uAcc, mappedPosition);
    vec4 acc2 = vec4(texture(uAcc, mappedPosition).rgb - from, 1);
    vec3 radiance = vec3(1);
    uint samples = 0u;
    // if(acc != vec4(0)) {
    //     // acc = vec4(acc.rgb - 0.5, 1.0);
    //     vec4 clip = uMvpForwardMatrix * acc2;
    //     vec3 ndc = clip.xyz / clip.w;
    //     vec2 uv  = ndc.xy * 0.5 + 0.5;
    //     radiance = texture(uRadiance, uv).rgb;
    //     samples = 500u;
    //     // if(mappedPosition.x + 0.0001 > uv.x && mappedPosition.x - 0.0001 < uv.x && mappedPosition.y + 0.0001 > uv.y && mappedPosition.y - 0.0001 < uv.y) {
    //     //     radiance = vec3(0, 1, 0);
    //     // }
    // }

    photon.transmittance = vec3(1);
    photon.radiance = radiance;
    photon.depth = vec3(1);
    photon.from = from;
    photon.acc = vec3(0);
    photon.bounces = 0u;
    photon.samples = samples;
    photon.M2 = vec3(0);
    oPosition = vec4(photon.position, 0);
    oDirection = vec4(photon.direction, float(photon.bounces));
    oTransmittance = vec4(photon.transmittance, 0);
    oRadiance = vec4(photon.radiance, float(photon.samples));
    oDepth = vec4(photon.depth, 1);
    oFrom = vec4(photon.from, 1);
    oAcc = vec4(photon.acc, 1);
    oOld = texture(uRadiance, mappedPosition);
}