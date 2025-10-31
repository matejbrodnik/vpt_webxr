// #part /glsl/shaders/renderers/FOV2/integrate/vertex

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

// #part /glsl/shaders/renderers/FOV2/integrate/fragment

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
@random/hash/pcg
@random/hash/squashlinear
@random/distribution/uniformdivision
@random/distribution/square
@random/distribution/disk
@random/distribution/sphere
@random/distribution/exponential

@unprojectRand

uniform sampler2D uPosition;
uniform sampler2D uDirection;
uniform sampler2D uTransmittance;
uniform sampler2D uRadiance;

uniform sampler3D uVolume;
uniform sampler2D uTransferFunction;
uniform sampler2D uEnvironment;
uniform sampler2D uMIP;

uniform mat4 uMvpInverseMatrix;
uniform vec2 uInverseResolution;
uniform float uRandSeed;
uniform float uBlur;

uniform float uExtinction;
uniform float uAnisotropy;
uniform uint uMaxBounces;
uniform uint uSteps;
uniform uint uCycles;

in vec2 vPosition;

layout (location = 0) out vec4 oPosition;
layout (location = 1) out vec4 oDirection;
layout (location = 2) out vec4 oTransmittance;
layout (location = 3) out vec4 oRadiance;
layout (location = 4) out vec4 oMIP;

void resetPhoton(inout uint state, inout Photon photon) {
    vec3 from, to;
    unprojectRand(state, vPosition, uMvpInverseMatrix, uInverseResolution, uBlur, from, to);
    photon.direction = normalize(to - from);
    photon.bounces = 0u;
    vec2 tbounds = max(intersectCube(from, photon.direction), 0.0);
    photon.position = from + tbounds.x * photon.direction;
    photon.transmittance = vec3(1);
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

float sampleHenyeyGreensteinAngleCosine(inout uint state, float g) {
    float g2 = g * g;
    float c = (1.0 - g2) / (1.0 - g + 2.0 * g * random_uniform(state));
    return (1.0 + g2 - c * c) / (2.0 * g);
}

vec3 sampleHenyeyGreenstein(inout uint state, float g, vec3 direction) {
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

float mean3(vec3 v) {
    return dot(v, vec3(1.0 / 3.0));
}

void main() {
    Photon photon;
    vec2 mappedPosition = vPosition * 0.5 + 0.5;
    uint state = hash(uvec3(floatBitsToUint(mappedPosition.x), floatBitsToUint(mappedPosition.y), floatBitsToUint(uRandSeed)));
    
    vec4 radianceAndSamples = texture(uRadiance, mappedPosition);
    photon.radiance = radianceAndSamples.rgb;
    photon.samples = uint(radianceAndSamples.w + 0.5);
    photon.position = texture(uPosition, mappedPosition).xyz;
    vec4 directionAndBounces = texture(uDirection, mappedPosition);
    photon.direction = directionAndBounces.xyz;
    photon.bounces = uint(directionAndBounces.w + 0.5);
    photon.transmittance = texture(uTransmittance, mappedPosition).rgb;
    vec4 M2MIP = texture(uMIP, mappedPosition);
    photon.M2 = M2MIP.rgb;
    float mip = M2MIP.a;

    // float mip = texture(uMIP, mappedPosition).r;
    float avg = texelFetch(uMIP, ivec2(0, 0), 9).a;
    uint steps = uint(float(uSteps) * mip / avg);
    // avg
    // if(mip == 0.0) {
    //     photon.radiance = texture(uEnvironment, mappedPosition).rgb;
    //     photon.radiance = vec3(0.0, 0.7, 0.7);
    // }
    if(steps > 250u) {
        steps = 250u;
    }
    for (uint i = 0u; i < steps; i++) {
        float dist = random_exponential(state, uExtinction);
        photon.position += dist * photon.direction;

        vec4 volumeSample = sampleVolumeColor(photon.position);

        float PNull = 1.0 - volumeSample.a;
        float PScattering;
        if (photon.bounces >= uMaxBounces) {
            PScattering = 0.0;
        } else {
            PScattering = volumeSample.a * max3(volumeSample.rgb);
        }
        float PAbsorption = 1.0 - PNull - PScattering;

        float fortuneWheel = random_uniform(state);
        if (any(greaterThan(photon.position, vec3(1))) || any(lessThan(photon.position, vec3(0)))) {
            // out of bounds
            vec4 envSample = sampleEnvironmentMap(photon.direction);
            vec3 radiance = photon.transmittance * envSample.rgb;
            photon.samples++;
            vec3 delta = radiance - photon.radiance;
            photon.radiance += delta / float(photon.samples);
            photon.M2 += delta * (radiance - photon.radiance);
            resetPhoton(state, photon);
        } else if (fortuneWheel < PAbsorption) {
            // absorption
            vec3 radiance = vec3(0);
            photon.samples++;
            vec3 delta = radiance - photon.radiance;
            photon.radiance += delta / float(photon.samples);
            photon.M2 += delta * (radiance - photon.radiance);
            resetPhoton(state, photon);
        } else if (fortuneWheel < PAbsorption + PScattering) {
            // scattering
            photon.transmittance *= volumeSample.rgb;
            photon.direction = sampleHenyeyGreenstein(state, uAnisotropy, photon.direction);
            photon.bounces++;
        } else {
            // null collision
        }
    }

    oPosition = vec4(photon.position, 0);
    oDirection = vec4(photon.direction, float(photon.bounces));
    oRadiance = vec4(photon.radiance, float(photon.samples));
    // oMIP = vec4(mip, mip, mip, 1);
    oMIP = vec4(photon.M2, mip);

    vec3 variance = photon.M2 / float(photon.samples - 1u);
    float sum = variance.r + variance.g + variance.b;
    oTransmittance = vec4(photon.transmittance, sum);
    
    // oTransmittance = vec4(photon.transmittance, texture(uTransmittance, mappedPosition).a);
    // uint thr = 6u;
    // int k = 1;
    // if(uCycles < thr) {
    //     // mip += variance.r / 500.0;
    //     oTransmittance = vec4(photon.transmittance, sum);

    // }
    // else if (uCycles == thr) {
    //     float maxVal = 0.0;
    //     for (int dx = -k; dx <= k; ++dx) {
    //         for (int dy = -k; dy <= k; ++dy) {
    //             vec2 offset = vec2(dx, dy) / 512.0;
    //             float val = texture(uTransmittance, mappedPosition + offset).a;
    //             maxVal = max(maxVal, val);
    //         }
    //     }
    //     oTransmittance = vec4(photon.transmittance, maxVal);
    // }
    // else if (uCycles == thr + 1u) {
    //     float minVal = 1.0;
    //     for (int dx = -k; dx <= k; ++dx) {
    //         for (int dy = -k; dy <= k; ++dy) {
    //             vec2 offset = vec2(dx, dy) / 512.0;
    //             float val = texture(uTransmittance, mappedPosition + offset).a;
    //             minVal = min(minVal, val);
    //         }
    //     }
    //     oTransmittance = vec4(photon.transmittance, minVal);
    // }

}

// #part /glsl/shaders/renderers/FOV2/render/vertex

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

// #part /glsl/shaders/renderers/FOV2/render/fragment

#version 300 es
precision highp float;
precision highp sampler2D;

uniform sampler2D uMIP;
uniform sampler2D uColor;

in vec2 vPosition;

out vec4 oColor;
// layout (location = 1) out vec4 oMIP;

void main() {
    float acc = texture(uMIP, vPosition).a;
    // oMIP = vec4(acc, acc, acc, 1);
    oColor = vec4(acc, acc, acc, 1);
    // if(acc == 1.0) {
    //     oColor = vec4(acc, 0, 0, 1);
    // }
    // oColor = vec4(texture(uColor, vPosition).rgb, 1);
}

// #part /glsl/shaders/renderers/FOV2/reset/vertex

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

// #part /glsl/shaders/renderers/FOV2/reset/fragment

#version 300 es
precision highp float;

// #link /glsl/mixins/Photon
@Photon
// #link /glsl/mixins/intersectCube
@intersectCube

@constants
@random/hash/pcg
@random/hash/squashlinear
@random/distribution/uniformdivision
@random/distribution/square
@random/distribution/disk
@random/distribution/sphere
@random/distribution/exponential

@unprojectRand

uniform sampler2D uMIP;
uniform mat4 uMvpInverseMatrix;
uniform vec2 uInverseResolution;
uniform float uRandSeed;
uniform float uBlur;

in vec2 vPosition;

layout (location = 0) out vec4 oPosition;
layout (location = 1) out vec4 oDirection;
layout (location = 2) out vec4 oTransmittance;
layout (location = 3) out vec4 oRadiance;
layout (location = 4) out vec4 oMIP;

void main() {
    vec2 mappedPosition = vPosition * 0.5 + 0.5;

    Photon photon;
    vec3 from, to;
    uint state = hash(uvec3(floatBitsToUint(vPosition.x), floatBitsToUint(vPosition.y), floatBitsToUint(uRandSeed)));
    
    unprojectRand(state, vPosition, uMvpInverseMatrix, uInverseResolution, uBlur, from, to);
    
    photon.direction = normalize(to - from);
    vec2 tbounds = max(intersectCube(from, photon.direction), 0.0);
    photon.position = from + tbounds.x * photon.direction;
    photon.transmittance = vec3(1);
    photon.radiance = vec3(1);
    photon.bounces = 0u;
    photon.samples = 0u;
    photon.M2 = vec3(0);
    oPosition = vec4(photon.position, 0);
    oDirection = vec4(photon.direction, float(photon.bounces));
    oTransmittance = vec4(photon.transmittance, 0);
    oRadiance = vec4(photon.radiance, float(photon.samples));
    oMIP = vec4(photon.M2, texture(uMIP, mappedPosition).r);
    // oMIP = texture(uMIP, mappedPosition);
}