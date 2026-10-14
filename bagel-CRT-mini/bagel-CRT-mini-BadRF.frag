// Name: bagel-CRT-mini-BadRF
// Author: bgelmini
// Version 3.6

// Co-author: ClaudeAI
// Preset from bagel-CRT-mini
// Ported from "fake-CRT-Geom" by DariusG, with sprinkles from "Sharp-Shimmerless-Shader" by zadpos
// NTSC dither/blur based on "tiny_ntsc" by Vsevolod and "kaizer-lp-small" by DariusG

// License: GPL-3.0-or-later
// fake-CRT-Geom, kaizer-lp-small: GPL-2.0-or-later, DariusG
// tiny_ntsc (sbtl_shaders): MIT, Copyright (c) 2025 Vsevolod (full text in the repo README)

// Options
// Scan Grid:     Auto / 240 / 480. Input over 300 lines gets the same scanline density as 240-class.
// Border:        Geom (rounded corners on the curved shape), Corner (rounded corners) or Flat (soft edge fade).
// Dither Merge:  blends dither columns into a smooth picture. Dot Crawl also makes the dither
//                creep slowly side to side, like composite video.
// RF Ghosting:   faint echoes trailing. Static for a still ghost, Motion adds slow random drifts.
// Noise:         analogue noise on top of the picture.
// Vertical Roll: now and then the picture rolls, like a TV losing vertical sync.

#pragma parameter sharpness "Sharpness" 0.8 0.3 1.0 0.05
#pragma parameter saturation "Saturation" 0.82 0.0 2.0 0.02
#pragma parameter brightness "Brightness" 1.886 0.5 2.5 0.05
#pragma parameter contrast "Contrast" 1.05 0.5 2.0 0.05
#pragma parameter scan_grid "Scan Grid (Auto/240/480)" 0.0 0.0 2.0 1.0
#pragma parameter scanline_low "Scanline (Dark)" 0.5 0.0 1.0 0.02
#pragma parameter scanline_high "Scanline (Bright)" 0.4 0.0 1.0 0.02
#pragma parameter mask_type "Mask Type" 0.0 0.0 2.0 1.0
#pragma parameter mask_strength "Mask Strength" 0.15 0.0 0.5 0.01
#pragma parameter vignette "Vignette" 0.65 0.0 1.0 0.05
#pragma parameter border_style "Border (Geom/Corner/Flat)" 0.0 0.0 2.0 1.0
// menu header only, locked at 0
#pragma parameter fun_options "--- Fun Options - Heavier on the GPU ---" 0.0 0.0 0.001 1.0
#pragma parameter dither_merge "Dither Merge (Off/On/Dot Crawl)" 2.0 0.0 2.0 1.0
#pragma parameter rf_ghost_mode "RF Ghosting (Off/Static/Motion)" 2.0 0.0 2.0 1.0
#pragma parameter noise_on "Noise" 1.0 0.0 1.0 1.0
#pragma parameter vertical_roll "Vertical Roll" 1.0 0.0 1.0 1.0

uniform float sharpness;
uniform float saturation;
uniform float brightness;
uniform float contrast;
uniform float scan_grid;
uniform float scanline_low;
uniform float scanline_high;
uniform float mask_type;
uniform float mask_strength;
uniform float vignette;
uniform float border_style;
uniform float dither_merge;
uniform float rf_ghost_mode;
uniform float noise_on;
uniform float vertical_roll;

// dither strength when Dither Merge is on (0..1)
const float DITHER_AMOUNT = 1.0;

// phosphor mask size (1 or 2)
const float MASK_SIZE = 1.0;

// curvature used only for the Geom border mask, the picture is not warped
const float CURVE_X = 0.031;
const float CURVE_Y = 0.041;

// vertical roll and RF drift share this schedule (frames)
const float ROLL_CYCLE = 2400.0;
const float ROLL_DURATION = 270.0;

// RF ghost
const float GHOST_STRENGTH = 0.5;
const float GHOST_LENGTH   = 5.0;        // px at 640x480, trails to the right
const float DRIFT_DURATION = 600.0;      // frames for one drift out and back
const float DRIFTS_PER_CYCLE = 2.0;      // (ROLL_CYCLE - ROLL_DURATION) / this must stay above DRIFT_DURATION
const float DRIFT_CLOSER_CHANCE = 0.25;  // share of drifts that go closer instead of further
const float DRIFT_CLOSER_MIN = -3.5;     // px added to GHOST_LENGTH at the peak
const float DRIFT_CLOSER_MAX = -3.0;
const float DRIFT_FURTHER_MIN = 6.0;
const float DRIFT_FURTHER_MAX = 10.0;

// border shapes: radius = reach from the edge, smooth = transition width
const float GEOM_RADIUS = 0.04;
const float GEOM_SMOOTH = 90.0;
const float CORNER_RADIUS = 0.055;
const float CORNER_SMOOTH = 60.0;
const float FLAT_RADIUS = 0.025;
const float FLAT_SMOOTH = 60.0;
const float FLAT_FADE = 0.25;            // darkening at the very edge

// Cheap sin-free hash
float rand(vec2 co) {
    vec2 p = fract(co * vec2(443.897, 441.423));
    p += dot(p, p.yx + 19.19);
    return fract((p.x + p.y) * p.x);
}

// Cheap sin(2 * PI * q): a parabola plus one refinement step.
// Keep it highp, some GPUs lose the scanlines and mask at lower precision.
highp float sine(highp float q) {
    highp float u = fract(q) - 0.5;
    highp float y = u * (16.0 * max(u, -u) - 8.0);  // max(u, -u) = abs(u)
    return y * (0.775 + 0.225 * max(y, -y));
}

// Row pattern x in [-1,1] modulates the calibrated level, renormalised so the
// mean of row_mul^2 stays the same (peaks stay near base * (1 + d), no clipping).
//  - coarse grid, scale 2: rows alternate +1/-1
//  - everything else: rows follow the sine
float row_factor(highp float row_pos, highp float mask_scale, bool coarse) {
    // d = 0.42 for alternating rows, 0.5 for the sine
    vec2 row_ab = (mask_scale < 2.5) ? vec2(0.9219821, 0.3872325) : vec2(0.9428090, 0.4714045);
    // rows start a quarter cycle in, except on even coarse scales
    highp float row_phase = row_pos - (coarse ? 0.25 * mask_scale - 0.5 * floor(0.5 * mask_scale) : 0.25);
    return row_ab.x + row_ab.y * sine(row_phase);
}

// 0 Geom: rounded corners on the warped position
// 1 Corner: rounded corners on the plain position
// 2 Flat: soft fade at the edges instead of a cutoff
float border_mask(vec2 uv) {
    vec2 h = abs(uv - 0.5);  // distance from the centre

    // interior early-out: the mask is exactly 1.0 there (0.43 leaves room for the Geom warp)
    if (max(h.x, h.y) < 0.43) return 1.0;

    float radius = GEOM_RADIUS;
    float transition = GEOM_SMOOTH;
    if (border_style < 0.5) {
        // warp() from the fake-geom shaders
        h *= 1.0 + 4.0 * h.yx * h.yx * vec2(CURVE_X, CURVE_Y);
    } else if (border_style < 1.5) {
        radius = CORNER_RADIUS;
        transition = CORNER_SMOOTH;
    } else {
        radius = FLAT_RADIUS;
        transition = FLAT_SMOOTH;
    }

    vec2 q = max(h - (0.5 - radius), 0.0);
    float m = clamp((radius - sqrt(dot(q, q))) * transition, 0.0, 1.0);
    return (border_style > 1.5) ? mix(1.0 - FLAT_FADE, 1.0, m) : m;
}

// Picture sample, with the dither blur when Dither Merge is on.
// Each option reads the picture itself, so the ones switched off cost nothing.
vec3 sample_picture(highp vec2 cuv, highp vec2 res, highp vec2 inv_res, highp float sample_scale, bool coarse, bool crawl_on) {
    // Auto-adjusting sharp-bilinear sampling: uses the real scale, not the
    // rounded one, so it adapts on its own. Sharp when the scale is an exact
    // integer, softer when it's fractional. Requires the source texture to be
    // sampled with LINEAR filtering on the host.
    highp vec2 p = cuv * res;
    highp vec2 edge = floor(p + 0.5);
    highp vec2 coord = (edge + 0.5 * clamp((p - edge) * (2.0 * sample_scale), -1.0, 1.0)) * inv_res;

    if (dither_merge < 0.5) {
        return texture2D(u_tex, coord).rgb;
    }

    // Horizontal blur that merges fine dithering into a smooth blend.
    // Dot Crawl alternates the left/right weighting by row pair on a slow cycle.
    if (coarse) {
        // dither is ~2 native texels wide on a coarse grid, so 3 taps 2 texels apart
        float lean = 0.0;
        if (crawl_on) {
            float crawl = 0.05 * sine(u_time * 0.031830989);  // 0.05 * sin(u_time * 0.2)
            lean = (fract(cuv.y * res.y * 0.125) < 0.5) ? crawl : -crawl;
        }
        highp float dx = 2.0 * inv_res.x;
        mediump vec3 c1 = texture2D(u_tex, coord).rgb;
        mediump vec3 c0 = texture2D(u_tex, coord - vec2(dx, 0.0)).rgb;
        mediump vec3 c2 = texture2D(u_tex, coord + vec2(dx, 0.0)).rgb;
        // == mix(c1, c0 * (0.25 + lean) + c1 * 0.5 + c2 * (0.25 - lean), DITHER_AMOUNT)
        return c1 + DITHER_AMOUNT * (c0 * (0.25 + lean) + c2 * (0.25 - lean) - 0.5 * c1);
    }

    // normal grid: two bilinear fetches half a texel either side of the centre,
    // the same 0.25/0.5/0.25 blend as three taps on the flat part of each texel
    highp float half_tx = 0.5 * DITHER_AMOUNT * inv_res.x;
    if (crawl_on) {
        float crawl = 0.05 * sine(u_time * 0.031830989);
        float lean = (fract(cuv.y * res.y * 0.25) < 0.5) ? crawl : -crawl;
        highp float shift = 2.0 * lean * DITHER_AMOUNT * inv_res.x;
        mediump vec3 la = texture2D(u_tex, coord - vec2(half_tx + shift, 0.0)).rgb;
        mediump vec3 lb = texture2D(u_tex, coord + vec2(half_tx - shift, 0.0)).rgb;
        return 0.5 * (la + lb);
    }
    mediump vec3 ca = texture2D(u_tex, coord - vec2(half_tx, 0.0)).rgb;
    mediump vec3 cb = texture2D(u_tex, coord + vec2(half_tx, 0.0)).rgb;
    return 0.5 * (ca + cb);
}

// Two echoes trailing to the right, the second twice as far and half as strong.
// With Dither Merge on, each echo goes through the same blur as the picture so
// it doesn't bring back raw alternating columns.
vec3 ghost_echoes(vec3 col, highp vec2 uv, highp float half_tx, float length_px, float strength) {
    highp vec2 echo = vec2(length_px / 640.0, 0.0);
    // mix(mix(col, e1, a), e2, b) as one weighted sum
    float a = 0.5 * strength;
    float b = 0.25 * strength;
    float k1 = a - a * b;
    float k0 = 1.0 - k1 - b;
    if (dither_merge < 0.5) {
        return col * k0 + texture2D(u_tex, uv - echo).rgb * k1 + texture2D(u_tex, uv - 2.0 * echo).rgb * b;
    }
    highp vec2 h = vec2(half_tx, 0.0);
    k1 *= 0.5;
    b *= 0.5;
    return col * k0 + (texture2D(u_tex, uv - echo - h).rgb + texture2D(u_tex, uv - echo + h).rgb) * k1
                    + (texture2D(u_tex, uv - 2.0 * echo - h).rgb + texture2D(u_tex, uv - 2.0 * echo + h).rgb) * b;
}

// Static keeps the echoes at GHOST_LENGTH. Motion adds DRIFTS_PER_CYCLE slow
// drifts per cycle, at a random moment inside their own slot, to a random closer
// or further distance and back. The drift pauses while the vertical roll runs.
vec3 rf_ghost(vec3 col, highp vec2 uv, highp float half_tx, float roll_start) {
    if (rf_ghost_mode < 1.5) {
        return ghost_echoes(col, uv, half_tx, GHOST_LENGTH, GHOST_STRENGTH);
    }

    float cycle_id = floor(u_time / ROLL_CYCLE);
    float t = u_time - cycle_id * ROLL_CYCLE;

    // time stands still for the drift while the roll runs (same start as the roll)
    t -= ROLL_DURATION * clamp((t - roll_start) / ROLL_DURATION, 0.0, 1.0);

    // one drift per slot
    float slot_len = (ROLL_CYCLE - ROLL_DURATION) / DRIFTS_PER_CYCLE;
    float slot = min(floor(t / slot_len), DRIFTS_PER_CYCLE - 1.0);
    float drift_id = cycle_id * DRIFTS_PER_CYCLE + slot;

    float start = rand(vec2(drift_id, 7.7)) * (slot_len - DRIFT_DURATION);
    // bump = sin(PI * p)^2 over the drift, 0 outside it
    float p = clamp((t - slot * slot_len - start) / DRIFT_DURATION, 0.0, 1.0);
    float h = 4.0 * p * (1.0 - p);
    float s = h * (0.775 + 0.225 * h);
    float bump = s * s;
    float r = rand(vec2(drift_id, 9.1));
    float drift = (r < DRIFT_CLOSER_CHANCE)
        ? mix(DRIFT_CLOSER_MIN, DRIFT_CLOSER_MAX, r / DRIFT_CLOSER_CHANCE)
        : mix(DRIFT_FURTHER_MIN, DRIFT_FURTHER_MAX, (r - DRIFT_CLOSER_CHANCE) / (1.0 - DRIFT_CLOSER_CHANCE));

    return ghost_echoes(col, uv, half_tx, GHOST_LENGTH + drift * bump, GHOST_STRENGTH * (1.0 + 0.3 * bump));
}

void main() {
    highp vec2 res = max(u_native_resolution, vec2(1.0));
    highp vec2 inv_res = 1.0 / res;
    highp vec2 out_res = u_resolution;

    // scan_grid: 0 = Auto by native height, 1 = 240-class, 2 = 480-class.
    bool coarse = scan_grid > 1.5 || (scan_grid <= 0.5 && res.y > 300.0);

    // Real scale for the sampling. Rounded scale for anything locked to the
    // native grid (the scanlines), so it doesn't drift when the real scale is
    // fractional. Coarse (480-class) input halves the grid resolution.
    highp vec2 ratio = out_res * inv_res;
    highp float ratio_min = min(ratio.x, ratio.y);
    highp float sample_scale = max(ratio_min * sharpness, 1.0);
    // +0.501 so exact halves like 4.5x always round up
    highp float grid_mul = coarse ? 2.0 : 1.0;
    highp float mask_scale = max(floor(ratio_min * grid_mul + 0.501), 1.0);

    vec2 uv = v_uv;

    // scale 1, or scale 2 on a normal grid: uniform rows
    bool uniform_rows = mask_scale * grid_mul < 2.5;

    // position in native-texel space, locked to the rounded scale
    highp vec2 texel_pos = (uv * out_res) / mask_scale;

    // Plain presets take the first path, the fun options all live in the second.
    vec3 col;
    float row_f = 1.0;
    float noise_add = 0.0;
    if (max(max(vertical_roll, rf_ghost_mode), max(noise_on, dither_merge - 1.0)) < 0.5) {
        if (uniform_rows) {
            col = sample_picture(uv, res, inv_res, sample_scale, coarse, false);
        } else {
            col = sample_picture(uv, res, inv_res, sample_scale, coarse, false);
            row_f = row_factor(texel_pos.y, mask_scale, coarse);
        }
    } else {
        if (!uniform_rows) row_f = row_factor(texel_pos.y, mask_scale, coarse);

        bool crawl_on = dither_merge > 1.5;

        // Vertical roll: once per ROLL_CYCLE, at a random point, the picture dips the
        // wrong way, scrolls through its full height, overshoots and settles. Only the
        // sampled content moves, scanlines/mask/border stay put.
        highp vec2 content_uv = uv;
        float roll_start = ROLL_CYCLE;  // shared with the RF drift, no pause without the roll
        if (vertical_roll >= 0.5) {
            const float ROLL_ANTICIPATION = -0.05;
            const float ROLL_OVERSHOOT = 0.09;
            const float ROLL_ANTIC_FRAC = 0.08;  // share of the duration spent on the dip
            const float ROLL_MAIN_FRAC = 0.72;   // share spent on the main scroll
            // the rest settles the overshoot

            float cycle_id = floor(u_time / ROLL_CYCLE);
            roll_start = rand(vec2(cycle_id, 3.1)) * (ROLL_CYCLE - ROLL_DURATION);

            // dip, main scroll and settle, adding up to a full turn once the roll is over
            float t = (u_time - cycle_id * ROLL_CYCLE - roll_start) / ROLL_DURATION;
            float offset = ROLL_ANTICIPATION * clamp(t / ROLL_ANTIC_FRAC, 0.0, 1.0)
                         + (1.0 + ROLL_OVERSHOOT - ROLL_ANTICIPATION) * clamp((t - ROLL_ANTIC_FRAC) / ROLL_MAIN_FRAC, 0.0, 1.0)
                         - ROLL_OVERSHOOT * clamp((t - ROLL_ANTIC_FRAC - ROLL_MAIN_FRAC) / (1.0 - ROLL_ANTIC_FRAC - ROLL_MAIN_FRAC), 0.0, 1.0);

            content_uv.y = fract(content_uv.y + offset);
        }
        col = sample_picture(content_uv, res, inv_res, sample_scale, coarse, crawl_on);

        if (rf_ghost_mode >= 0.5) {
            col = rf_ghost(col, content_uv, (coarse ? 1.0 : 0.5) * DITHER_AMOUNT * inv_res.x, roll_start);
        }

        // analogue noise, added on the finished picture at the end
        if (noise_on >= 0.5) {
            // per-frame offset, bounded so it stays precise
            float time_seed = fract(mod(u_time, 1009.0) * 0.618034) * 1000.0;
            noise_add = (rand(gl_FragCoord.xy + time_seed) - 0.5) * 0.08;
        }
    }

    float ntsc_luma = dot(col, vec3(0.299, 0.587, 0.114));
    col = ntsc_luma + saturation * (col - ntsc_luma);

    // scanline strength follows the picture's brightness (0.92 = fixed brightness loss),
    // vignette darkens towards the sides
    float w = dot(vec3(0.33 * 0.92), col);
    float vig = uv.x - 0.5;
    float row_mul = max((1.0 - scanline_low) - (scanline_high - scanline_low) * w - vignette * vig * vig, 0.0) * row_f;

    // phosphor mask locked to the output resolution
    highp float mask_q = uv.x * out_res.x * ((mask_type > 0.5 ? 0.6666 : 1.0) * (0.5 / MASK_SIZE));
    if (mask_type > 1.5) mask_q = texel_pos.x; // locked to the native grid
    float mask = (1.0 - mask_strength) + mask_strength * sine(mask_q);

    // rows, mask, linear brightness and contrast
    col = col * ((row_mul * mask) * (brightness * contrast)) + (0.5 - 0.5 * contrast);

    // noise on the clamped picture, so it swings both ways instead of vanishing on
    // clipped highlights. Clamp again so headroom above 1.0 can't defeat the border's soft edge.
    col = clamp(clamp(col, 0.0, 1.0) + noise_add, 0.0, 1.0) * border_mask(uv);

    gl_FragColor = vec4(col, 1.0);
}
