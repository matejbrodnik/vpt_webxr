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
// uniform float uX;
// uniform float uY;

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
    // float uxMin = uX - 0.002;
    // float uxMax = uX + 0.002;
    // float uyMin = uY - 0.002;
    // float uyMax = uY + 0.002;
    // if((vPosition.x > uxMin && vPosition.x < uxMax) || (vPosition.y > uyMin && vPosition.y < uyMax)) {
    //     if((vPosition.x > uxMin && vPosition.x < uxMax) && (vPosition.y > uyMin && vPosition.y < uyMax)) {
    //         outColor = vec4(1, 0, 0, 0);
    //     }
    //     else {
    //         outColor = vec4(0, 0, 0, 0);
    //     }
    // }
    // else {
        outColor = mix(scene, ui, ui.a);
    // }
}


// #part /glsl/shaders/UIRenderer/text/vertex

#version 300 es

in vec4 a_position;
in vec2 a_texcoord;

uniform mat4 u_matrix;

out vec2 v_texcoord;

void main() {
  gl_Position = u_matrix * a_position;

  v_texcoord = a_texcoord;
}

// #part /glsl/shaders/UIRenderer/text/fragment

#version 300 es
precision highp float;

in vec2 v_texcoord;

uniform sampler2D u_texture;

out vec4 outColor;

void main() {
   outColor = texture(u_texture, v_texcoord);
}