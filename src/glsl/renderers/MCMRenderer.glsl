// #part /glsl/shaders/renderers/MCM/generate/vertex

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

// #part /glsl/shaders/renderers/MCM/generate/fragment

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

uniform sampler2D uPosition;
uniform sampler2D uDirection;

uniform float uRandSeed;
uniform float uExtinction;
uniform float uAnisotropy;

in vec2 vPosition;

layout (location = 0) out vec4 oPosition;
layout (location = 1) out vec4 oDirection2;

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

void main() {
    Photon photon;
    vec2 mappedPosition = vPosition * 0.5 + 0.5;
    float state = hash(vec3(mappedPosition.x * 123.456, mappedPosition.y * 654.321, uRandSeed));

    photon.direction = texture(uDirection, mappedPosition).xyz;
    photon.position = texture(uPosition, mappedPosition).xyz;

    float dist = random_exponential(state, uExtinction);
    photon.position += dist * photon.direction;
    photon.direction = sampleHenyeyGreenstein(state, uAnisotropy, photon.direction);

    oPosition = vec4(photon.position, 0);
    // oPosition = vec4(0.7, 0, 0.7, 0);
    oDirection2 = vec4(photon.direction, 0);
}

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
uniform sampler2D uDirection2;

uniform sampler3D uVolume;
uniform sampler2D uTransferFunction;
uniform sampler2D uEnvironment;

uniform mat4 uMvpInverseMatrix;
uniform vec2 uInverseResolution;
uniform float uRandSeed;
uniform float uBlur;

uniform uint uMaxBounces;
uniform uint uSteps;

in vec2 vPosition;

layout (location = 0) out vec4 oPosition;
layout (location = 1) out vec4 oDirection;
layout (location = 2) out vec4 oTransmittance;
layout (location = 3) out vec4 oRadiance;

void resetPhoton(inout float state, inout Photon photon) {
    vec3 from, to;
    unprojectRandFloat(state, vPosition, uMvpInverseMatrix, uInverseResolution, uBlur, from, to);
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
    
    vec3 direction2 = texture(uDirection2, mappedPosition).xyz;

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
    } else if (fortuneWheel < PAbsorption + PScattering) {
        // scattering
        photon.transmittance *= volumeSample.rgb;
        photon.direction = direction2;
        photon.bounces++;
    } else {
        // null collision
    }

    oPosition = vec4(photon.position, 0);
    oDirection = vec4(photon.direction, float(photon.bounces));
    oTransmittance = vec4(photon.transmittance, 0);
    oRadiance = vec4(photon.radiance, float(photon.samples));
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

in vec2 vPosition;

out vec4 oColor;

void main() {
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
uniform vec2 uInverseResolution;
uniform float uRandSeed;
uniform float uBlur;

in vec2 vPosition;

layout (location = 0) out vec4 oPosition;
layout (location = 1) out vec4 oDirection;
layout (location = 2) out vec4 oTransmittance;
layout (location = 3) out vec4 oRadiance;

void main() {
    Photon photon;
    vec3 from, to;
    float state = hash(vec3(vPosition.x * 123.456, vPosition.y * 654.321, uRandSeed));

    unprojectRandFloat(state, vPosition, uMvpInverseMatrix, uInverseResolution, uBlur, from, to);
    
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
}