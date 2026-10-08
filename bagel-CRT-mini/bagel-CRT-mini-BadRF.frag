// Name: bagel-CRT-mini-BadRF
// Author: bgelmini
// Version 3.0

// Co-author: ClaudeAI
// Preset from bagel-CRT-mini
// Ported from "fake-CRT-Geom" by DariusG, with sprinkles from "Sharp-Shimmerless-Shader" by zadpos
// NTSC dither/blur based on "tiny_ntsc" by Vsevolod and "kaizer-lp-small" by DariusG

// License: GPL-3.0-or-later
// fake-CRT-Geom, kaizer-lp-small: GPL-2.0-or-later, DariusG
// tiny_ntsc (sbtl_shaders): MIT, Copyright (c) 2025 Vsevolod (full text in the repo README)

// Options
// Dither Merge:  blends dither columns into a smooth picture. 
// Dot Crawl:     the dither creeps slowly side to side, like composite video. Needs Dither Merge.
// Noise:         analogue noise on top of the picture.
// RF Ghosting:   faint echoes trailing. Static for a still ghost, Motion adds slow random drifts.
// Vertical Roll: now and then the picture rolls, like a TV losing vertical sync.
// Border:        Geom (rounded corners on the curved shape), Corner (rounded corners) or Flat (soft edge fade).
// Scan Grid:     Auto / 240 / 480. Input over 300 lines gets the same scanline density as 240-class.

const float PI = 3.14159265;

#pragma parameter sharpness "Sharpness" 0.8 0.3 1.0 0.05
#pragma parameter dither_merge "Dither Merge" 1.0 0.0 1.0 1.0
#pragma parameter dot_crawl "Dot Crawl" 1.0 0.0 1.0 1.0
#pragma parameter noise_on "Noise" 1.0 0.0 1.0 1.0
#pragma parameter rf_ghost_mode "RF Ghosting (Off/Static/Motion)" 2.0 0.0 2.0 1.0
#pragma parameter vertical_roll "Vertical Roll" 1.0 0.0 1.0 1.0
#pragma parameter saturation "Saturation" 0.82 0.0 2.0 0.02
#pragma parameter brightness "Brightness" 1.886 0.5 2.5 0.05
#pragma parameter contrast "Contrast" 1.05 0.5 2.0 0.05
#pragma parameter scanline_low "Scanline (Dark)" 0.5 0.0 1.0 0.02
#pragma parameter scanline_high "Scanline (Bright)" 0.4 0.0 1.0 0.02
#pragma parameter mask_type "Mask Type" 0.0 0.0 2.0 1.0
#pragma parameter mask_strength "Mask Strength" 0.15 0.0 0.5 0.01
#pragma parameter vignette "Vignette" 0.65 0.0 1.0 0.05
#pragma parameter scan_grid "Scan Grid (Auto/240/480)" 0.0 0.0 2.0 1.0
#pragma parameter border_style "Border (Geom/Corner/Flat)" 0.0 0.0 2.0 1.0

uniform float sharpness;
uniform float dither_merge;
uniform float dot_crawl;
uniform float noise_on;
uniform float rf_ghost_mode;
uniform float vertical_roll;
uniform float saturation;
uniform float brightness;
uniform float contrast;
uniform float scanline_low;
uniform float scanline_high;
uniform float mask_type;
uniform float mask_strength;
uniform float vignette;
uniform float scan_grid;
uniform float border_style;

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

float dither_amount() {
    return dither_merge >= 0.5 ? DITHER_AMOUNT : 0.0;
}

vec2 native_res() {
    return max(u_native_resolution, vec2(1.0));
}

// scan_grid: 0 = Auto by native height, 1 = 240-class, 2 = 480-class.
bool use_coarse_grid() {
    if (scan_grid > 1.5) return true;
    if (scan_grid > 0.5) return false;
    return native_res().y > 300.0;
}

// Real, non-rounded, scale between output and input resolution, isotropic. Aspect ratio preserved.
highp float raw_grid_scale() {
    highp vec2 res = native_res();
    highp vec2 out_res = max(u_resolution, vec2(1.0));
    highp vec2 raw_scale = out_res / res;
    return max(min(raw_scale.x, raw_scale.y), 1.0);
}

// Scale rounded to the nearest integer, used by anything that needs to
// stay "locked" to the native pixel grid (here the scanlines), so it
// doesn't drift irregularly when the real scale is fractional.
// Coarse (480-class) input halves the grid resolution.
highp float grid_scale() {
    highp vec2 res = native_res();
    if (use_coarse_grid()) res *= 0.5;
    highp vec2 out_res = max(u_resolution, vec2(1.0));
    highp vec2 s = out_res / res;
    return max(floor(min(s.x, s.y) + 0.5), 1.0);
}

// Auto-adjusting sharp-bilinear sampling: uses the REAL scale ,not the
// rounded one, so it adapts on its own. Sharp when the scale is an
// exact integer, softer when it's fractional. Requires the source
// texture to be sampled with LINEAR filtering on the host.
// Returns the remapped coordinate so the blur can offset it for its side taps.
highp vec2 sharp_bilinear_coord(highp vec2 uv, highp float scale) {
    highp vec2 res = native_res();

    highp vec2 texel = uv * res;
    highp vec2 s = fract(texel);

    highp vec2 region_range = vec2(0.5) - vec2(0.5) / scale;
    highp vec2 center_dist = s - vec2(0.5);
    highp vec2 f = (center_dist - clamp(center_dist, -region_range, region_range)) * scale + vec2(0.5);

    return (texel - s + f) / res;
}

// Horizontal blur that merges fine dithering into a smooth blend.
// Dot Crawl alternates the left/right weighting by row pair on a slow cycle.
vec3 sample_blur(highp vec2 uv, highp float scale) {
    highp vec2 coord = sharp_bilinear_coord(uv, scale);

    // dither off: centre tap only
    if (dither_amount() <= 0.0) return texture2D(u_tex, coord).rgb;

    bool coarse = use_coarse_grid();

    float lean = 0.0;
    if (dot_crawl >= 0.5) {
        highp float row_pair = floor(uv.y * native_res().y * (coarse ? 0.25 : 0.5));
        float row_sign = (mod(row_pair, 2.0) < 1.0) ? 1.0 : -1.0;
        lean = sin(u_time * 0.2) * 0.05 * row_sign;
    }

    if (coarse) {
        // dither is ~2 native texels wide on a coarse grid, so 3 taps 2 texels apart
        highp float texel_x = 2.0 / native_res().x;
        vec3 c1 = texture2D(u_tex, coord).rgb;
        vec3 c0 = texture2D(u_tex, coord - vec2(texel_x, 0.0)).rgb;
        vec3 c2 = texture2D(u_tex, coord + vec2(texel_x, 0.0)).rgb;
        float w0 = 0.25 + lean;
        float w2 = 0.25 - lean;
        // == mix(c1, c0*w0 + c1*0.5 + c2*w2, amount)
        return c1 + dither_amount() * (c0 * w0 + c2 * w2 - 0.5 * c1);
    }

    // normal grid: two bilinear fetches half a texel either side of the centre,
    // the same 0.25/0.5/0.25 blend as three taps on the flat part of each texel
    highp float half_tx = 0.5 * dither_amount() / native_res().x;
    highp float shift = 2.0 * lean * dither_amount() / native_res().x;
    vec3 ca = texture2D(u_tex, coord - vec2(half_tx + shift, 0.0)).rgb;
    vec3 cb = texture2D(u_tex, coord + vec2(half_tx - shift, 0.0)).rgb;
    return 0.5 * (ca + cb);
}

// Cheap sin-free hash
float rand(vec2 co) {
    vec2 p = fract(co * vec2(443.897, 441.423));
    p += dot(p, p.yx + 19.19);
    return fract((p.x + p.y) * p.x);
}

// warp() from the fake-geom shaders, only used for the Geom border mask
vec2 warp(vec2 pos) {
    pos = pos * 2.0 - 1.0;
    pos *= vec2(1.0 + pos.y * pos.y * CURVE_X, 1.0 + pos.x * pos.x * CURVE_Y);
    return pos * 0.5 + 0.5;
}

// 0 Geom: rounded corners on the warped position
// 1 Corner: rounded corners on the plain position
// 2 Flat: soft fade at the edges instead of a cutoff
float border_mask(vec2 uv) {
    vec2 pos = uv;
    float radius = GEOM_RADIUS;
    float transition = GEOM_SMOOTH;
    if (border_style < 0.5) {
        pos = warp(uv);
    } else if (border_style < 1.5) {
        radius = CORNER_RADIUS;
        transition = CORNER_SMOOTH;
    } else {
        radius = FLAT_RADIUS;
        transition = FLAT_SMOOTH;
    }

    // interior early-out: the mask is exactly 1.0 there
    vec2 edge_dist = min(pos, vec2(1.0) - pos);
    if (min(edge_dist.x, edge_dist.y) >= radius) return 1.0;

    vec2 cdist = vec2(radius);
    vec2 q = cdist - min(edge_dist, cdist);
    float dist = sqrt(dot(q, q));
    float c = clamp((radius - dist) * transition, 0.0, 1.0);
    return (border_style > 1.5) ? mix(1.0 - FLAT_FADE, 1.0, c) : c;
}

// One RF ghost echo, run through the same dither blur as the picture so it
// doesn't bring back raw alternating columns.
vec3 ghost_tap(vec2 uv) {
    if (dither_amount() <= 0.0) return texture2D(u_tex, uv).rgb;
    highp float half_tx = 0.5 * dither_amount() * (use_coarse_grid() ? 2.0 : 1.0) / native_res().x;
    return 0.5 * (texture2D(u_tex, uv - vec2(half_tx, 0.0)).rgb + texture2D(u_tex, uv + vec2(half_tx, 0.0)).rgb);
}

// Two echoes trailing to the right, the second twice as far and half as strong.
// Static keeps them at GHOST_LENGTH. Motion adds DRIFTS_PER_CYCLE slow drifts
// per cycle, at a random moment inside their own slot, to a random closer or
// further distance and back. The drift pauses while the vertical roll runs.
vec3 rf_ghost(vec3 col, vec2 uv) {
    float bump = 0.0;
    float drift = 0.0;

    if (rf_ghost_mode > 1.5) {
        float cycle_id = floor(u_time / ROLL_CYCLE);
        float t = mod(u_time, ROLL_CYCLE);

        // time stands still for the drift while the roll runs (same start as the roll)
        if (vertical_roll >= 0.5) {
            float roll_start = rand(vec2(cycle_id, 3.1)) * (ROLL_CYCLE - ROLL_DURATION);
            if (t > roll_start) t = max(roll_start, t - ROLL_DURATION);
        }

        // one drift per slot
        float slot_len = (ROLL_CYCLE - ROLL_DURATION) / DRIFTS_PER_CYCLE;
        float slot = min(floor(t / slot_len), DRIFTS_PER_CYCLE - 1.0);
        float drift_id = cycle_id * DRIFTS_PER_CYCLE + slot;

        float start = rand(vec2(drift_id, 7.7)) * (slot_len - DRIFT_DURATION);
        float p = (t - slot * slot_len - start) / DRIFT_DURATION;
        if (p > 0.0 && p < 1.0) {
            float s = sin(PI * p);
            bump = s * s;
        }
        float r = rand(vec2(drift_id, 9.1));
        drift = (r < DRIFT_CLOSER_CHANCE)
            ? mix(DRIFT_CLOSER_MIN, DRIFT_CLOSER_MAX, r / DRIFT_CLOSER_CHANCE)
            : mix(DRIFT_FURTHER_MIN, DRIFT_FURTHER_MAX, (r - DRIFT_CLOSER_CHANCE) / (1.0 - DRIFT_CLOSER_CHANCE));
    }

    vec2 echo = vec2((GHOST_LENGTH + drift * bump) / 640.0, 0.0);
    float strength = GHOST_STRENGTH * (1.0 + 0.3 * bump);
    col = mix(col, ghost_tap(uv - echo), 0.5 * strength);
    return mix(col, ghost_tap(uv - 2.0 * echo), 0.25 * strength);
}

void main() {
    highp vec2 out_res = max(u_resolution, vec2(1.0));

    vec2 uv = v_uv;
    vec2 cpos = uv; // no curvature: "screen" position = uv

    highp float sample_scale = max(raw_grid_scale() * sharpness, 1.0);
    highp float mask_scale = grid_scale();

    // Vertical roll: once per ROLL_CYCLE, at a random point, the picture dips
    // the wrong way, scrolls through its full height, overshoots and settles.
    // Only the sampled content moves, scanlines/mask/border stay put.
    vec2 content_uv = uv;
    if (vertical_roll >= 0.5) {
        const float ROLL_ANTICIPATION = -0.05;
        const float ROLL_OVERSHOOT = 0.09;
        const float ROLL_ANTIC_FRAC = 0.08;  // share of the duration spent on the dip
        const float ROLL_MAIN_FRAC = 0.72;   // share spent on the main scroll
        // the rest settles the overshoot

        float cycle_id = floor(u_time / ROLL_CYCLE);
        float local_t = mod(u_time, ROLL_CYCLE);
        float start = rand(vec2(cycle_id, 3.1)) * (ROLL_CYCLE - ROLL_DURATION);

        bool roll_active = (local_t >= start && local_t <= start + ROLL_DURATION);
        float offset = 0.0;
        if (roll_active) {
            float t = (local_t - start) / ROLL_DURATION;
            if (t <= ROLL_ANTIC_FRAC) {
                offset = mix(0.0, ROLL_ANTICIPATION, t / ROLL_ANTIC_FRAC);
            } else if (t <= ROLL_ANTIC_FRAC + ROLL_MAIN_FRAC) {
                float p = (t - ROLL_ANTIC_FRAC) / ROLL_MAIN_FRAC;
                offset = mix(ROLL_ANTICIPATION, 1.0 + ROLL_OVERSHOOT, p);
            } else {
                float p = (t - ROLL_ANTIC_FRAC - ROLL_MAIN_FRAC) / (1.0 - ROLL_ANTIC_FRAC - ROLL_MAIN_FRAC);
                offset = mix(1.0 + ROLL_OVERSHOOT, 1.0, p);
            }
        }

        content_uv.y = fract(content_uv.y + offset);
    }

    vec3 col = sample_blur(content_uv, sample_scale);

    if (rf_ghost_mode >= 0.5) {
        col = rf_ghost(col, content_uv);
    }

    float ntsc_luma = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(ntsc_luma), col, saturation);

    // scanline strength follows the picture's brightness (0.92 = fixed brightness loss)
    float w = dot(vec3(0.33 * 0.92), col);

    // position in native-texel space, locked to the rounded scale
    highp vec2 texel_pos = (uv * out_res) / mask_scale;

    // horizontal scanline
    float scan = mix(scanline_low, scanline_high, w);
    // Row pattern x in [-1,1] modulates the calibrated level 'base', renormalised
    // so the mean of row_mul^2 stays base^2 (peaks stay near base * (1 + d), no clipping).
    //  - scale 1, or scale 2 on a normal grid: uniform rows
    //  - coarse grid, scale 2: rows alternate +1/-1
    //  - everything else: rows follow the sine
    bool coarse = use_coarse_grid();
    bool coarse_even = coarse && mod(mask_scale, 2.0) < 0.5;
    bool uniform_rows = (mask_scale < 1.5) || (mask_scale < 2.5 && !coarse);

    float phase_off = coarse_even ? 0.0 : 0.25;
    highp float phase_y = fract(texel_pos.y) - phase_off;
    float x = sin(phase_y * 2.0 * PI);

    float vig = cpos.x - 0.5;
    vig = vig * vig * vignette;

    float base = max(1.0 - scan - vig, 0.0);
    float row_mul = base;
    if (!uniform_rows) {
        bool alt_rows = coarse_even && mask_scale < 2.5;
        float d = alt_rows ? 0.42 : 0.5;
        float ex2 = alt_rows ? 1.0 : 0.5;
        row_mul = base * (1.0 + d * x) * inversesqrt(1.0 + d * d * ex2);
    }
    col *= row_mul;

    // phosphor mask locked to the output resolution
    highp float maskpos = uv.x * out_res.x / MASK_SIZE * PI;
    float sz = 1.0;
    highp float m_m = maskpos;
    if (mask_type == 1.0) sz = 0.6666;
    if (mask_type == 2.0) m_m = texel_pos.x * 2.0 * PI; // locked to the native grid
    col *= mask_strength * sin(m_m * sz) + 1.0 - mask_strength;

    // linear brightness (compensates for scanline/mask darkening)
    col *= brightness;

    col = (col - 0.5) * contrast + 0.5;

    // noise last, like analogue noise on the finished signal. Clamp first so
    // it swings both ways instead of vanishing on clipped highlights.
    if (noise_on >= 0.5) {
        col = clamp(col, 0.0, 1.0);
        // per-frame offset through its own hash, bounded so it stays precise
        float time_seed = rand(vec2(mod(u_time, 1009.0), 0.0)) * 1000.0;
        float n = rand(gl_FragCoord.xy + time_seed) - 0.5;
        col += n * 0.08;
    }

    // clamp before the border so headroom above 1.0 can't defeat its soft edge
    col = clamp(col, 0.0, 1.0) * border_mask(uv);

    gl_FragColor = vec4(col, 1.0);
}
