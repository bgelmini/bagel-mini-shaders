// Name: bagel-LCD-mini-Background
// Author: bgelmini
// Version 3.6

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
// Grid:           Off, RGB (lcd3x) or Mono (lcd1x).
// Border Fade:    rounded darkening at the screen edges.
// LCD Background: light pixels let a paper-coloured backing show through, dark pixels leave a shade in that background
// Fake Ghosting:  Spatial fake, not a real previous-frame effect, simulates a bad LCD display.

#pragma parameter sharpness "Sharpness" 1.0 0.3 1.0 0.05
#pragma parameter saturation "Saturation" 1.0 0.0 2.0 0.05
#pragma parameter brightness "Brightness" 1.0 0.5 2.5 0.05
#pragma parameter contrast "Contrast" 1.0 0.5 2.0 0.05
#pragma parameter scan_grid "Grid Mode (Auto/240/480)" 0.0 0.0 2.0 1.0
#pragma parameter grid_type "Grid (Off/RGB/Mono)" 2.0 0.0 2.0 1.0
#pragma parameter border_on "Border Fade" 0.0 0.0 1.0 1.0
#pragma parameter border_depth "  Border Depth" 0.25 0.0 1.0 0.05
// menu header only, locked at 0
#pragma parameter fun_options "--- Fun Options - Heavier on the GPU ---" 0.0 0.0 0.001 1.0
#pragma parameter bg_on "LCD Background" 1.0 0.0 1.0 1.0
#pragma parameter bg_mix "  Background Mix" 0.60 0.0 1.0 0.05
#pragma parameter bg_tint "  Background Color (White/Warm/Gray/Green)" 1.0 0.0 3.0 1.0
#pragma parameter bg_shade_depth "  Shading Depth" 1.0 0.0 1.0 0.05
#pragma parameter bg_shade_dist "  Shading Distance (px at 640x480)" 2.0 0.0 8.0 0.5
#pragma parameter fake_ghost "Fake Ghosting" 0.0 0.0 1.0 1.0

uniform float sharpness;
uniform float saturation;
uniform float brightness;
uniform float contrast;
uniform float scan_grid;
uniform float grid_type;
uniform float border_on;
uniform float border_depth;
uniform float bg_on;
uniform float bg_mix;
uniform float bg_tint;
uniform float bg_shade_depth;
uniform float bg_shade_dist;
uniform float fake_ghost;

// border fade shape
const float BORDER_RADIUS = 0.025; // how far the fade reaches inward
const float BORDER_SMOOTH = 60.0;  // transition width

// fake ghosting
const float GHOST_STRENGTH = 0.5;
const float GHOST_LENGTH   = 5.0; // px at 640x480, trails to the right

// a + b * sin(2 * PI * q), with a cheap sine: a parabola plus one refinement step.
// Keep it highp, some GPUs lose the grid at lower precision.
float wave(highp float q, highp float a, highp float b) {
    highp float u = fract(q) - 0.5;
    highp float y = u * (16.0 * max(u, -u) - 8.0);  // max(u, -u) = abs(u)
    return a + y * (0.775 * b + 0.225 * b * max(y, -y));
}

// sin(2 * PI * u) for u in -0.5..0.5, same parabola as wave()
highp float sine_half(highp float u) {
    highp float y = u * (8.0 - 16.0 * max(u, -u));
    return y * (0.775 + 0.225 * max(y, -y));
}

// frag_coord must stay highp. Without it, precision drops enough at
// large screen coordinates to make the grid drift unevenly (worse
// towards one edge of the screen).

// Mono (lcd1x): one factor for all channels, dark gap between pixels.
// (16 - cos) / 17 and (4 - cos) / 5
vec3 mono_mask(highp vec2 frag_coord, highp float scale) {
    highp vec2 cell = frag_coord / scale;
    float yf = wave(cell.y + 0.25, 16.0 / 17.0, -1.0 / 17.0);
    float xf = wave(cell.x + 0.25, 0.8, -0.2);
    return vec3(yf * xf);
}

// RGB (lcd3x): subpixel phases +90, -30 and -150 degrees from one sin and one cos.
vec3 rgb_mask(highp vec2 frag_coord, highp float scale) {
    highp vec2 cell = frag_coord / scale;
    float yfactor = wave(cell.y, 16.0 / 17.0, 1.0 / 17.0);
    const float K = 0.8660254;
    // sin and cos from the same phase
    highp float u = fract(cell.x) - 0.5;
    float sx = -sine_half(u);
    float cx = -sine_half(0.25 - max(u, -u));
    vec3 xfactors = (4.0 + vec3(cx, K * sx - 0.5 * cx, -K * sx - 0.5 * cx)) / 5.0;
    return yfactor * xfactors;
}

// Gentle rounded fade
float border_fade(vec2 uv) {
    vec2 h = abs(uv - 0.5);  // distance from the centre
    // interior early-out: the fade is exactly 1.0 there
    if (max(h.x, h.y) < 0.5 - BORDER_RADIUS) return 1.0;
    vec2 q = max(h - (0.5 - BORDER_RADIUS), 0.0);
    float c = clamp((BORDER_RADIUS - sqrt(dot(q, q))) * BORDER_SMOOTH, 0.0, 1.0);
    return mix(1.0 - border_depth, 1.0, c);
}

// Two faint echoes trailing to the right, the second twice as far and
// half as strong.
vec3 fake_ghosting(vec3 col) {
    vec2 echo = vec2(GHOST_LENGTH / 640.0, 0.0);
    // mix(mix(col, g1, a), g2, b) as one weighted sum
    const float A = 0.5 * GHOST_STRENGTH;
    const float B = 0.25 * GHOST_STRENGTH;
    return col * ((1.0 - A) * (1.0 - B)) + texture2D(u_tex, v_uv - echo).rgb * (A * (1.0 - B))
                                         + texture2D(u_tex, v_uv - 2.0 * echo).rgb * B;
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
    // one curve through the four paper colours:
    // 0 White (0.86) / 1 Warm (0.72, 0.67, 0.57) / 2 Gray (0.60) / 3 Green (0.60, 0.66, 0.50)
    vec3 paper = vec3(0.86) + bg_tint * (vec3(-0.35, -0.74, -1.8) / 3.0
               + bg_tint * (vec3(-0.04, 0.055, 0.385) + bg_tint * vec3(0.1, 0.01, -0.45) / 6.0));

    // faint static grain, 2x2 output pixels per cell (highp, like the grid)
    highp vec2 frag_coord = gl_FragCoord.xy;
    paper += (bg_hash(floor(frag_coord * 0.5)) - 0.5) * 0.04;

    // shade from dark source pixels, offset down-right
    vec3 src = texture2D(u_tex, v_uv - vec2(bg_shade_dist) / vec2(640.0, 480.0)).rgb;
    float dark = clamp(1.0 - dot(src, vec3(0.299, 0.587, 0.114)), 0.0, 1.0);
    paper *= 1.0 - 0.65 * dark * bg_shade_depth;

    float lum = dot(lcd, vec3(0.299, 0.587, 0.114));
    return mix(lcd, paper, bg_mix * smoothstep(0.25, 0.85, lum));
}

void main() {
    highp vec2 res = max(u_native_resolution, vec2(1.0));
    highp vec2 inv_res = 1.0 / res;

    // scan_grid: 0 = Auto by native height, 1 = 240-class, 2 = 480-class.
    bool coarse = scan_grid > 1.5 || (scan_grid <= 0.5 && res.y > 300.0);

    // Real scale for the sampling. Rounded scale for the grid, so it stays
    // locked to the native pixels when the real scale is fractional. Coarse
    // (480-class) input halves the grid resolution. Never below 2 for the
    // grid: at scale 1 the RGB grid collapses into a flat tint.
    highp vec2 ratio = u_resolution * inv_res;
    highp float ratio_min = min(ratio.x, ratio.y);
    highp float sample_scale = max(max(ratio_min, 1.0) * sharpness, 1.0);
    // +0.501 so exact halves like 4.5x always round up
    highp float mask_scale = max(floor((coarse ? 2.0 * ratio_min : ratio_min) + 0.501), 2.0);

    // Auto-adjusting sharp-bilinear sampling: uses the real scale, not the
    // rounded one, so it adapts on its own. Sharp when the scale is an exact
    // integer, softer when it's fractional.
    highp vec2 p = v_uv * res;
    highp vec2 edge = floor(p + 0.5);
    highp vec2 coord = (edge + 0.5 * clamp((p - edge) * (2.0 * sample_scale), -1.0, 1.0)) * inv_res;

    // Each grid reads the picture itself, so only the chosen one is worked out.
    vec3 col;
    vec3 grid;
    if (grid_type > 1.5) {
        col = texture2D(u_tex, coord).rgb;
        grid = mono_mask(gl_FragCoord.xy, mask_scale);
    } else if (grid_type > 0.5) {
        col = texture2D(u_tex, coord).rgb;
        grid = rgb_mask(gl_FragCoord.xy, mask_scale);
    } else {
        col = texture2D(u_tex, coord).rgb;
        grid = vec3(1.0);
    }

    // Fake Ghosting, Saturation and Border Fade share one check, so the usual
    // presets skip all three in one go.
    if (fake_ghost < 0.5 && border_on < 0.5 && abs(saturation - 1.0) < 0.001) {
        // grid, linear brightness and contrast
        col = col * (grid * (brightness * contrast)) + (0.5 - 0.5 * contrast);
    } else {
        if (fake_ghost >= 0.5) {
            col = fake_ghosting(col);
        }

        float luma = dot(col, vec3(0.299, 0.587, 0.114));
        col = luma + saturation * (col - luma);

        // grid, border fade, linear brightness and contrast
        float k = brightness * contrast;
        if (border_on >= 0.5) {
            k *= border_fade(v_uv);
        }
        col = col * (grid * k) + (0.5 - 0.5 * contrast);
    }

    if (bg_on >= 0.5) {
        col = lcd_background(col);
    }

    gl_FragColor = vec4(col, 1.0);
}
