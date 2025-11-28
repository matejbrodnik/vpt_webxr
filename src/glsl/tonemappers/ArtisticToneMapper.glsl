// #part /glsl/shaders/tonemappers/ArtisticToneMapper/vertex

#version 300 es
#extension GL_OVR_multiview2 : require

layout(num_views = 2) in;

const vec2 vertices[] = vec2[](
    vec2(-1, -1),
    vec2( 3, -1),
    vec2(-1,  3)
);

// const vec2 uv[3] = vec2[](
//     vec2(0.0, 0.0),
//     vec2(2.0, 0.0),
//     vec2(0.0, 2.0)
// );

out vec2 vPosition;

void main() {
    vec2 position = vertices[gl_VertexID];
    vPosition = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0, 1);
}

// #part /glsl/shaders/tonemappers/ArtisticToneMapper/fragment

#version 300 es
#extension GL_OVR_multiview2 : require

precision highp float;

#define M_PI 3.1415926535897932384626

uniform highp sampler2DArray uTexture;
uniform float uLow;
uniform float uMid;
uniform float uHigh;
uniform float uSaturation;
uniform float uGamma;

in vec2 vPosition;

out vec4 oColor;

void main() {
    vec4 color = texture(uTexture, vec3(vPosition, gl_ViewID_OVR));

    color = vec4(color.rgb / color.a, 1.0); 
    color = (color - uLow) / (uHigh - uLow);
    const vec3 gray = normalize(vec3(1));
    color = vec4(mix(dot(color.rgb, gray) * gray, color.rgb, uSaturation), 1.0);
    float midpoint = (uMid - uLow) / (uHigh - uLow);
    float exponent = -log(midpoint) / log(2.0);
    color = pow(color, vec4(exponent / uGamma));

    // oColor = vec4(vPosition, 0.0, 1.0);
    // oColor = vec4(0.0, 0.7, 0.3, 1.0);
    oColor = vec4(color.rgb, 1.0);
}
