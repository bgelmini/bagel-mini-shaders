// Name: bagel-LCD-mini-FakeGhost
// Author: bgelmini
// Version 3.0

// Co-author: ClaudeAI
// Preset from bagel-LCD-mini
// Loosely adapted from "lcd3x" shader by Gigaherz, with sprinkles from "Sharp-Shimmerless-Shader" by zadpos
// Mono grid style based on "lcd1x" shader by Gigaherz (edited by jdgleaver)
// LCD Background inspired by "Pixel Transparency" shader by mattakins

// License: GPL-3.0-or-later
// lcd3x: Copyright (c) 2012, David Quintana, BSD 3-Clause (full text in the repo README)
// lcd1x: GPL-2.0-or-later, Gigaherz, edited by jdgleaver

// Options
// Grid Mode:      Auto / 240 / 480. Input over 300 lines gets the same grid density as 240-class.
// Grid Style:     RGB (lcd3x) or Mono (lcd1x).
// Border Fade:    rounded darkening at the screen edges.
// LCD Background: light pixels let a paper-coloured backing show through, dark pixels leave a shade in that background
// Fake Ghosting:  Spatial fake, not a real previous-frame effect, simulates a bad LCD display. 

#pragma parameter sharpness "Sharpness" 1.0 0.3 1.0 0.05
#pragma parameter saturation "Saturation" 0.6 0.0 2.0 0.05
#pragma parameter brightness "Brightness" 1.0 0.5 2.5 0.05
#pragma parameter contrast "Contrast" 1.0 0.5 2.0 0.05
#pragma parameter scan_grid "Grid Mode (Auto/240/480)" 0.0 0.0 2.0 1.0
#pragma parameter grid_style "Grid Style (RGB/Mono)" 1.0 0.0 1.0 1.0
#pragma parameter border_on "Border Fade" 0.0 0.0 1.0 1.0
#pragma parameter border_depth "  Border Depth" 0.25 0.0 1.0 0.05
#pragma parameter fake_ghost "Fake Ghosting" 1.0 0.0 1.0 1.0
#pragma parameter bg_on "LCD Background" 0.0 0.0 1.0 1.0
#pragma parameter bg_mix "  Background Mix" 0.60 0.0 1.0 0.05
#pragma parameter bg_tint "  Background Color (White/Warm/Gray/Green)" 1.0 0.0 3.0 1.0
#pragma parameter bg_shade_depth "  Shading Depth" 1.0 0.0 1.0 0.05
#pragma parameter bg_shade_dist "  Shading Distance (px at 640x480)" 2.0 0.0 8.0 0.5

uniform float sharpness;
uniform float saturation;
uniform float brightness;
uniform float contrast;
uniform float scan_grid;
uniform float grid_style;
uniform float border_on;
uniform float border_depth;
uniform float fake_ghost;
uniform float bg_on;
uniform float bg_mix;
uniform float bg_tint;
uniform float bg_shade_depth;
uniform float bg_shade_dist;

// border fade shape
const float BORDER_RADIUS = 0.025; // how far the fade reaches inward
const float BORDER_SMOOTH = 60.0;  // transition width

// fake ghosting
const float GHOST_STRENGTH = 0.5;
const float GHOST_LENGTH   = 5.0; // px at 640x480, trails to the right

vec2 native_res() {
    return max(u_native_resolution, vec2(1.0));
}

// scan_grid: 0 = Auto by native height, 1 = 240-class, 2 = 480-class.
bool use_coarse_grid() {
    if (scan_grid > 1.5) return true;
    if (scan_grid > 0.5) return false;
    return native_res().y > 300.0;
}

// Real (non-rounded) scale between output and input resolution, isotropic (aspect ratio preserved).
highp float raw_grid_scale() {
    highp vec2 res = native_res();
    highp vec2 out_res = max(u_resolution, vec2(1.0));
    highp vec2 raw_scale = out_res / res;
    return max(min(raw_scale.x, raw_scale.y), 1.0);
}

// Scale rounded to the nearest integer, used by anything that needs to
// stay "locked" to the native pixel grid (in thi case the mask), so it
// doesn't drift irregularly when the real scale is fractional.
// Coarse (480-class) input halves the grid resolution.
highp float grid_scale() {
    highp vec2 res = native_res();
    if (use_coarse_grid()) res *= 0.5;
    highp vec2 out_res = max(u_resolution, vec2(1.0));
    highp vec2 s = out_res / res;
    return max(floor(min(s.x, s.y) + 0.5), 1.0);
}

// frag_coord must stay highp. Without it, precision drops enough at
// large screen coordinates to make the mask drift unevenly (worse
// towards one edge of the screen).
vec3 lcd_mask(highp vec2 frag_coord, highp float scale) {
    const float PI = 3.14159265;

    highp vec2 texel_pos = frag_coord / scale;
    // Reducing to [0,1) via fract() before multiplying by 2*PI keeps the
    // sin() argument small, avoiding precision loss at typical screen
    // resolutions.
    highp vec2 phase = fract(texel_pos);

    vec2 angle = phase * 2.0 * PI;

    // Mono (lcd1x): one factor for all channels, dark gap between pixels.
    if (grid_style > 0.5) {
        float yf = (16.0 - cos(angle.y)) / 17.0;
        float xf = (4.0 - cos(angle.x)) / 5.0;
        return vec3(yf * xf);
    }

    float yfactor = (16.0 + sin(angle.y)) / 17.0;

    // Subpixel phases +90, -30 and -150 degrees from one sin and one cos.
    const float K = 0.8660254;
    float sx = sin(angle.x);
    float cx = cos(angle.x);
    vec3 xfactors = (4.0 + vec3(cx, K * sx - 0.5 * cx, -K * sx - 0.5 * cx)) / 5.0;

    return yfactor * xfactors;
}

// Auto-adjusting sharp-bilinear sampling: uses the real scale, not the
// rounded one, so it adapts on its own. Sharp when the scale is an
// exact integer, softer when it's fractional.
vec3 sample_sharp_bilinear(highp vec2 uv, highp float scale) {
    highp vec2 res = native_res();

    highp vec2 texel = uv * res;
    highp vec2 s = fract(texel);

    highp vec2 region_range = vec2(0.5) - vec2(0.5) / scale;
    highp vec2 center_dist = s - vec2(0.5);
    highp vec2 f = (center_dist - clamp(center_dist, -region_range, region_range)) * scale + vec2(0.5);

    return texture2D(u_tex, (texel - s + f) / res).rgb;
}

// Gentle rounded fade
float border_fade(vec2 coord) {
    coord = min(coord, vec2(1.0) - coord);
    // Interior early-out: the fade is exactly 1.0 there.
    if (min(coord.x, coord.y) >= BORDER_RADIUS) return 1.0;
    vec2 cdist = vec2(BORDER_RADIUS);
    coord = cdist - min(coord, cdist);
    float dist = sqrt(dot(coord, coord));
    float c = clamp((cdist.x - dist) * BORDER_SMOOTH, 0.0, 1.0);
    return mix(1.0 - border_depth, 1.0, c);
}

// Two faint echoes trailing to the right, the second twice as far and
// half as strong.
vec3 fake_ghosting(vec3 col) {
    vec2 echo = vec2(GHOST_LENGTH / 640.0, 0.0);
    vec3 g1 = texture2D(u_tex, v_uv - echo).rgb;
    vec3 g2 = texture2D(u_tex, v_uv - 2.0 * echo).rgb;
    col = mix(col, g1, 0.5 * GHOST_STRENGTH);
    return mix(col, g2, 0.25 * GHOST_STRENGTH);
}

// Cheap sin-free hash, used for the paper grain.
float bg_hash(vec2 co) {
    vec2 p = fract(co * vec2(443.897, 441.423));
    p += dot(p, p.yx + 19.19);
    return fract((p.x + p.y) * p.x);
}

// Clear pixels blend towards the paper colour, dark pixels stay solid and
// shade the paper. Works on the finished LCD colour, so the grid stays
// visible across the paper.
vec3 lcd_background(vec3 lcd) {
    // 0 White / 1 Warm / 2 Gray / 3 Green
    vec3 paper = vec3(0.86);
    if (bg_tint > 2.5)      paper = vec3(0.60, 0.66, 0.50);
    else if (bg_tint > 1.5) paper = vec3(0.60);
    else if (bg_tint > 0.5) paper = vec3(0.72, 0.67, 0.57);

    // faint static grain, 2x2 output pixels per cell
    paper += (bg_hash(floor(gl_FragCoord.xy * 0.5)) - 0.5) * 0.04;

    // shade from dark source pixels, offset down-right
    if (bg_shade_depth > 0.0) {
        vec2 off = vec2(bg_shade_dist) / vec2(640.0, 480.0);
        vec3 src = texture2D(u_tex, v_uv - off).rgb;
        float dark = clamp(1.0 - dot(src, vec3(0.299, 0.587, 0.114)), 0.0, 1.0);
        paper *= 1.0 - 0.65 * dark * bg_shade_depth;
    }

    float lum = clamp(dot(lcd, vec3(0.299, 0.587, 0.114)), 0.0, 1.0);
    return mix(lcd, paper, bg_mix * smoothstep(0.25, 0.85, lum));
}

void main() {
    highp float sample_scale = max(raw_grid_scale() * sharpness, 1.0);

    // Never below 2. At scale 1 the RGB grid collapses into a flat tint.
    highp float mask_scale = max(grid_scale(), 2.0);

    vec3 col = sample_sharp_bilinear(v_uv, sample_scale);

    if (fake_ghost >= 0.5) {
        col = fake_ghosting(col);
    }

    if (saturation != 1.0) {
        float luma = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(vec3(luma), col, saturation);
    }

    col *= lcd_mask(gl_FragCoord.xy, mask_scale);

    if (border_on >= 0.5) {
        col *= border_fade(v_uv);
    }

    // linear brightness
    col *= brightness;

    // contrast
    col = (col - 0.5) * contrast + 0.5;

    if (bg_on >= 0.5) {
        col = lcd_background(col);
    }

    gl_FragColor = vec4(col, 1.0);
}
