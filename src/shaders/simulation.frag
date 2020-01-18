precision mediump float;

uniform sampler2D posTex;
uniform sampler2D logoTex;
uniform float uTime;
uniform vec2 uMouse;

varying vec2 vUv;

float random (in vec2 st) {
    return fract(sin(dot(st.xy,
                         vec2(12.9898,78.233)))*
        43758.5453123);
}

// Based on Morgan McGuire @morgan3d
// https://www.shadertoy.com/view/4dS3Wd
float noise (in vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);

    // Four corners in 2D of a tile
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(a, b, u.x) +
            (c - a)* u.y * (1.0 - u.x) +
            (d - b) * u.x * u.y;
}

#define OCTAVES 6
float fbm (in vec2 st) {
    // Initial values
    float value = 0.0;
    float amplitude = .5;
    float frequency = 0.;
    //
    // Loop of octaves
    for (int i = 0; i < OCTAVES; i++) {
        value += amplitude * noise(st);
        st *= 2.;
        amplitude *= .5;
    }
    return value;
}



void main() {

    // read the supplied x,y,z vert positions
    vec3 pos = texture2D(posTex, vUv).xyz;
    vec3 logoCol = texture2D(logoTex, vUv).rgb;

    float fbmVal = fbm(vec2(vUv.x, vUv.y + uTime * 0.1) * 8.0) * uMouse.x;


    pos.z = fbmVal - logoCol.r;

    // vec3 tar = pos + curl( pos.x * frequency, pos.y * frequency, pos.z * frequency ) * amplitude;

    // float d = length( pos-tar ) / maxDistance;

    // pos = mix( pos, tar, pow( d, 3.5 ) );

    gl_FragColor = vec4(pos, 1.0);
}