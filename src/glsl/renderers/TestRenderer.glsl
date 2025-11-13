// #part /glsl/shaders/renderers/TEST/integrate/vertex

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

// #part /glsl/shaders/renderers/TEST/integrate/fragment

#version 300 es
precision mediump float;
precision highp sampler2D;

uniform highp sampler2D uTexture;
uniform uint uStep;

in vec2 vPosition;

out vec4 oColor;

void main() {
    vec4 color = texture(uTexture, vPosition);
    if(uStep == 0u) {
        color += vec4(0.0, 0.05, 0.03, 0.0);
    }
    oColor = color;
}


// #part /glsl/shaders/renderers/TEST/render/vertex

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

// #part /glsl/shaders/renderers/TEST/render/fragment

#version 300 es
precision mediump float;
precision highp sampler2D;

uniform highp sampler2D uTexture;

in vec2 vPosition;

out vec4 oColor;

void main() {
    vec4 color = texture(uTexture, vPosition);
    // if(color.g > 0.04) {
    //     color = vec4(0.6, color.g, 0.6, 1.0);
    // }
    oColor = color;
}


// #part /glsl/shaders/renderers/TEST/reset/vertex

#version 300 es

const vec2 vertices[] = vec2[](
    vec2(-1, -1),
    vec2( 3, -1),
    vec2(-1,  3)
);

out vec2 vPosition;

void main() {
    vec2 position = vertices[gl_VertexID];
    gl_Position = vec4(position, 0, 1);
}

// #part /glsl/shaders/renderers/TEST/reset/fragment

#version 300 es
precision mediump float;
precision highp sampler2D;

out vec4 oColor;

void main() {
    oColor = vec4(0, 0, 0, 1);
}