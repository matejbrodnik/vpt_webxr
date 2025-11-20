// #part /glsl/shaders/quad/vertex

#version 300 es

const vec2 vertices[] = vec2[](
    vec2(-1, -1),
    vec2( 3, -1),
    vec2(-1,  3)
);

const vec2 uv[3] = vec2[](
    vec2(0.0, 0.0),
    vec2(2.0, 0.0),
    vec2(0.0, 2.0)
);

out vec2 vPosition;

void main() {
    vec2 position = vertices[gl_VertexID];
    vPosition = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0, 1);

    // vec2 position = vertices[gl_VertexID];
    // vPosition = uv[gl_VertexID];
    // gl_Position = vec4(position, 0, 1);
}

// #part /glsl/shaders/quad/fragment

#version 300 es
precision mediump float;
precision highp sampler2D;

uniform highp sampler2D uTexture;

in vec2 vPosition;

out vec4 oColor;

void main() {
    // oColor = vec4(0.6, 0.0, 0.6, 1);
    vec4 color = texture(uTexture, vPosition);
    // if(color.rgb == vec3(0)) {
    //     color = vec4(0, 0.3, 0.6, 1);
    // }
    oColor = color;
}