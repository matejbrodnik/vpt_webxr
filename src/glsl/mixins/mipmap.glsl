// #part /glsl/mixins/mipmap

void mipmap(
        inout float state,
        in sampler2D MIP,
        out vec2 pos)
{
    int a = 0;
    int b = 0;
    float root = 1.0;
    float leaf = 1.0;
    float total = 0.0;
    for(int i = 8; i >= 0; i--) {
        float nw = texelFetch(MIP, ivec2(a, b), i).r;
        float sw = texelFetch(MIP, ivec2(a, b + 1), i).r;
        float ne = texelFetch(MIP, ivec2(a + 1, b), i).r;
        float se = texelFetch(MIP, ivec2(a + 1, b + 1), i).r;

        float sum = nw + sw + ne + se;
        nw = nw / sum;
        sw = sw / sum;
        ne = ne / sum;
        se = se / sum;
        // state = state + uint(i);
        float h1 = (nw + 0.7421245196) * (se + 0.397136137);
        float h2 = (ne + 0.2397198051) * (sw + 0.8735190153);
        state += fract(random_uniform(h1) + random_uniform(h2));
        float normRand = random_uniform(state);
        // normRand *= sum;
        if(normRand < nw) {
            a *= 2;
            b *= 2;
            leaf = nw * sum;
        }
        else if(normRand < sw + nw) {
            a *= 2;
            b = (b + 1) * 2;
            leaf = sw * sum;
        }
        else if(normRand < ne + sw + nw) {
            a = (a + 1) * 2;
            b *= 2;
            leaf = ne * sum;
        }
        else {
            a = (a + 1) * 2;
            b = (b + 1) * 2;
            leaf = se * sum;
        }
        if(i == 8) {
            root = sum;
        }
    }
    // pdf = leaf / root;
    // a = a / 2;
    // b = b / 2;

    // float aa = float(a) / 1024.0;
    // aa = aa * 2.0 - 1.0;
    // float bb = float(b) / 1024.0;
    // bb = bb * 2.0 - 1.0;
    pos = (vec2(float(a) + 0.5, float(b) + 0.5) / 1024.0) * 2.0 - 1.0;
    // pos = vec2(float(a) / 1024.0 * 2.0 - 1.0, float(b) / 1024.0 * 2.0 - 1.0);
}
