// #part /glsl/shaders/UIRenderer/base/vertex

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

// #part /glsl/shaders/UIRenderer/base/fragment

#version 300 es
precision highp float;

uniform sampler2D uScene;
uniform sampler2D uTex;

in vec2 vPosition;
out vec4 outColor;

void main() {
    vec4 scene = texture(uScene, vPosition);
    // if (vPosition.x < 0.25 || vPosition.y < 0.25) {
    //     outColor = scene;
    //     return;
    // }

    vec2 uiUV = vec2(vPosition.x, 1.0 - vPosition.y);
    vec4 ui = texture(uTex, uiUV);

    // outColor = ui;
    outColor = mix(scene, ui, ui.a);
}


// #part /glsl/shaders/UIRenderer/text/vertex

#version 300 es

in vec4 a_position;
in vec2 a_texcoord;

uniform mat4 u_matrix;

out vec2 v_texcoord;

void main() {
  // Multiply the position by the matrix.
  gl_Position = u_matrix * a_position;

  // Pass the texcoord to the fragment shader.
  v_texcoord = a_texcoord;
}

// #part /glsl/shaders/UIRenderer/text/fragment

#version 300 es
precision highp float;

// Passed in from the vertex shader.
in vec2 v_texcoord;

uniform sampler2D u_texture;

out vec4 outColor;

void main() {
   outColor = texture(u_texture, v_texcoord);
}