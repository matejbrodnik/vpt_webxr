// #part /glsl/shaders/reproject/render/vertex

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

// #part /glsl/shaders/reproject/render/fragment

#version 300 es
precision highp float;

// #link /glsl/mixins/Photon
@Photon
// #link /glsl/mixins/intersectCube
@intersectCube

uniform sampler2D uColor;
uniform sampler2D uPosition;

uniform mat4 uMvp;
uniform vec2 uInverseResolution;
uniform float uRandSeed;

// uniform mat4 uView1;
// uniform mat4 uView2;

in vec2 vPosition;

out vec4 oColor;

void main() {
    vec2 mappedPosition = vPosition * 0.5 + 0.5;
    
    vec3 color = texture(uColor, mappedPosition).rgb;
    vec3 position = texture(uPosition, mappedPosition).rgb;

    if(position != vec3(0)) {
        vec4 clipA = uMvp * vec4(position, 1.0);
        vec3 ndcA = clipA.xyz / clipA.w;
        vec2 uvA = ndcA.xy * 0.5 + 0.5;
        vec3 old = texture(uColor, uvA).rgb;
        oColor = vec4(old, 1);
        // oColor = vec4(position, 1);
    }
    else {
        oColor = vec4(0, 1, 0, 1);
    }

}


// #part /glsl/shaders/reproject/reset/vertex

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

// #part /glsl/shaders/reproject/reset/fragment

#version 300 es
precision highp float;
precision highp sampler2D;
precision highp sampler3D;

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

uniform sampler2D uColor;
uniform sampler2D uPosition;
uniform sampler3D uVolume;
uniform sampler2D uTransferFunction;

uniform mat4 uMvpInv;
uniform vec2 uInverseResolution;
uniform float uRandSeed;

// uniform mat4 uView1;
// uniform mat4 uView2;

in vec2 vPosition;

out vec4 oPosition;

vec4 sampleVolumeColor(vec3 position) {
    vec2 volumeSample = texture(uVolume, position).rg;
    vec4 transferSample = texture(uTransferFunction, volumeSample);
    return transferSample;
}

float max3(vec3 v) {
    return max(max(v.x, v.y), v.z);
}

void reset(inout float state, inout Photon photon) {
    vec3 from, to;
    unprojectRandFloat(state, vPosition, uMvpInv, uInverseResolution, 0.0, from, to);
    photon.direction = normalize(to - from);
    vec2 tbounds = max(intersectCube(from, photon.direction), 0.0);
    photon.position = from + tbounds.x * photon.direction;
}

void main() {
    vec2 mappedPosition = vPosition * 0.5 + 0.5;

    Photon photon;
    vec3 from, to;
    float state = hash(vec3(vPosition.x * 123.456, vPosition.y * 654.321, uRandSeed));
    unprojectRandFloat(state, vPosition, uMvpInv, uInverseResolution, 0.0, from, to);
    photon.direction = normalize(to - from);
    vec2 tbounds = max(intersectCube(from, photon.direction), 0.0);
    vec3 init = from + tbounds.x * photon.direction;
    photon.position = from + tbounds.x * photon.direction;

    vec3 pos = vec3(0);
    uint count = 0u;
    // while (pos == vec3(0) && count < 3u) {
    for(uint i = 0u; i < 200u; i++) {
        float dist = random_exponential(state, 100.0);
        photon.position += dist * photon.direction;

        vec4 volumeSample = sampleVolumeColor(photon.position);

        float PNull = 1.0 - volumeSample.a;
        float PScattering = volumeSample.a * max3(volumeSample.rgb);
        float PAbsorption = 1.0 - PNull - PScattering;
        // float PAbsorption = volumeSample.a * (1.0 - max3(volumeSample.rgb));

        float fortuneWheel = random_uniform(state);
        if (any(greaterThan(photon.position, vec3(1))) || any(lessThan(photon.position, vec3(0)))) {
            count++;
            pos += photon.position;
            reset(state, photon);
        } else if (fortuneWheel < PAbsorption) {
            count++;
            pos += photon.position;
            reset(state, photon);
        } else if (fortuneWheel < PAbsorption + PScattering) {
            count++;
            pos += photon.position;
            reset(state, photon);
        } else {
            // null collision
        }
    }

    oPosition = vec4(pos / float(count), 1);
}