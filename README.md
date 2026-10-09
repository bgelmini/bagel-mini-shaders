# bagel-mini Shaders Collection

Shader Presets for MustardOS/Pickles/Wasabi

A collection of (hopefully) useful CRT and LCD shaders for lower resolution screen handhelds powered by MustardOS. 

This is not a professional work, and while I like things to be organized, I will just explain stuff as informally as it was all done.
The technical stuff is all described in the shader files, feel free to check and propose changes for the better! 

<p align="center">
  <a href="https://bgelmini.github.io/bagel-mini-shaders/comparisons.html">
    <img src="Screenshots/bagel-CRT-mini%20Comparisons/640x480RF.png" width="640" alt="bagel-CRT-mini-RF">
  </a>
</p>

## Installation

While running a game in Pickles, open the quick menu, go to Settings, Visual 3/7, open the shader menu, go to downloads, and look for these shaders there. 

If you don't have access to wifi on your device, you can copy any of the `.frag` files from here to `/muos/save/pickles/shader` and to `/muos/save/wasabi/shader` and and they will be available to use.

## Shaders

### Good to know

Both shaders (bagel-CRT-mini and bagel-LCD-mini) are built with scaling in consideration, so you shouldn't need any other external method to have balanced pixels when the content is not integer scaled to the screen resolution. 

The masks/scanlines/grids were thought to consider both the internal game resolution and the screen output resolution to align and avoid shimmering artifacts whenever possible. 

That said, using the `Aspect Ratio` as the scaling mode in Pickles, locks the height to an integer multiple of the content to the screen, and will provide cleaner results, also giving more processing headroom since there's less filtering happening. That can be helpful to some of the more _fun_ parameters available, as they can be pretty demanding.

Since Pickles don't have a function to share shader presets yet, each preset is just the whole shader with some parameters tweaked, meaning that whatever you like from one preset can be toggled/adjusted to be the same in another, so test stuff around and have fun! 

### CRT (`bagel-CRT-mini`)

Here I was mostly inspired by the fake-CRT-Geom shader. 
I always liked the crt borders effect in the little 3.5" screens, it gave them depth, but they never had enough pixels to give a good corner warp to the picture. I "solved" that using a mask that simulates the black geom borders by covering a bit of the picture, but never distorts the image itself. Since most games account for overscan, it works fine almost every time. When it doesn't and you miss some important info on the game, or if you just don't like the geom border, there is the `border` parameter, and you can use it to select a subtle border with rounded corners, or no border at all. 

I also spent a lot of time finding a good enough solution for having those nice composite dither patterns, usually found on Mega Drive gamnes, to blend and be displayed as those pretty extra colours, so don't pass on checking how your games will look with the `Dither` parameter on! 

| Shader | Preset |
| --- | --- |
| `bagel-CRT-mini` | Default |
| `bagel-CRT-mini-GoodDither` | Dither Merge on |
| `bagel-CRT-mini-Composite` | Dither Merge, Dot Crawl, RF Ghosting (Static) on |
| `bagel-CRT-mini-RF` | Dither Merge, Noise and RF Ghosting (Motion) on |
| `bagel-CRT-mini-BadRF` | Dither Merge, Dot Crawl, Noise, RF Ghosting (Motion) and Vertical Roll on |

Some fun parameters to consider:

- Dither Merge:  Blends dither columns into a smooth picture. _Sonic 2's transparent waterfall said hi._
- Dot Crawl:     The dither creeps slowly side to side, like composite video. Needs Dither Merge to be on.
- Noise:         Analogue noise on top of the picture.
- RF Ghosting:   Faint echoes trailing. Static for a still ghost, Motion adds slow random drifts.
- Vertical Roll: Now and then the picture rolls, like a TV losing vertical sync. It always gets you during a tough jump lol
- Border:        Geom (rounded corners on the curved shape), Corner (rounded corners) or Flat (soft edge fade).
- Scan Grid:     Auto / 240 / 480. If the mask/scanlines effect seems off, too big or too small, or even gone, the shader failed to auto detect the correct ratio from content to screen, so tweak this and one of the options should get you going. 

### LCD (`bagel-LCD-mini`)

Inspired by the lcd3x rgb grid, this started as a simple way to have games from older handhelds scaled to full screen with good pixel balancing and a grid that worked well on a non-integer situation. 

The pixel transparency craze happened around me, as I had never used those shaders myself, but I did like the screenshots and pictures people were posting around with that on, so I dabbled in the idea of having a paper background option, where dark pixels would cast their shadow, and white pixels would gain some texture. It worked out fine, and now I'm always checking how the lcd background option looks in every game I try! I just didn't like it with the RGB grid, so I looked at getting something similar to lcd1x, what led to the grid RGBxMono toggle. Having options is good, right? (•‿•) 

Adding a ghosting effect was a suggestion by XongleBongle the man himself, but since every handheld core already has an interframe blending option for accurate ghosting, I tried to get that bad duplicate image I used to deal with, from the terrible screen on my Dingoo A320 (is that the correct model I had?), and it ended up being a fine addition to the fun options of this LCD shader! 

| Shader | Preset |
| --- | --- |
| `bagel-LCD-mini` | RGB grid |
| `bagel-LCD-mini-Background` | Mono grid, LCD Background (Warm) on |
| `bagel-LCD-mini-FakeGhost` | Mono grid, Fake Ghosting on |
| `bagel-LCD-mini-BadDisplay` | Mono grid, LCD Background (Warm) and Fake Ghosting on |

Some fun parameters to consider:

- Grid Style:     RGB (lcd3x style) or Mono (lcd1x style).
- Border Fade:    Rounded darkening at the screen edges. Good to make the picture blend with the edges of the screen. 
- LCD Background: Clear pixels let a paper-coloured backing show through, dark pixels leave a shade in that background
- Fake Ghosting:  Fake, not a real previous-frame effect, simulates a bad LCD display. 
- Grid Mode:      Auto / 240 / 480. If the grid effect seems off, too big or too small, or even gone, the shader failed to auto detect the correct ratio from content to screen, so tweak this and one of the options should get you going. 


## Click the image for some comparisons! 

<p align="center">
  <a href="https://bgelmini.github.io/bagel-mini-shaders/comparisons.html">
    <img src="Screenshots/bagel-LCD-mini%20Comparisons/720x480GBA-LCD.png" width="720" alt="bagel-LCD-mini on Game Boy Advance">
  </a>
</p>

## Overlays

I also have a simple pair of scanlines and grid overlays for 640x480 and 1280x720 (can be used in 720x720 with the proper scaling) screens.
Some systems are just too demanding to also have a shader running, like Dreamcast and N64, and having these on can give them that nice TV look at an (almost) free performance cost. 

Paired with Pickles' pretty robust picture options, like contrast, saturation, vignete and others, you can get a good _old school_ look for even the most demanding systems. 

| Overlay | 640x480 | 1280x720 |
| --- | --- | --- |
| Grid | `overlays/640x480/simple-grid.png` | `overlays/1280x720/simple-grid.png` |
| Scanlines | `overlays/640x480/simple-scanlines.png` | `overlays/1280x720/simple-scanlines.png` |

Installing them works the same as the shaders (see Installation above).

## A little backstory

With the introduction of the overlay/shader system in MustardOS, I began modifying some of XongleBongle's included shaders to resemble some of my favorite presets from RetroArch, some cool LCD and CRT shaders to use on content that was not run through RetroArch itself. Some PortMaster stuff and external emulators worked well with them, and I was happy with the experiment! 

When Pickles arrived, it was an incredible frontend for the libretro cores, only missing the shaders I got used to on my retro systems. 
With that, I started piecing together and translating pieces of the shaders I liked the most on my handhelds, with an honorable mention to the fake/mini set of CRT shaders. It was also where the name came from, since I go by bgelmini, and people usually call me bagel on Discord, it was natural that those would be the bagel-mini shader presets. 

Instead of directly porting the shaders as is, I thought of taking what I like the best from many of those sources and creating shader presets that were ready for my games, with just the parameters that I would really tweak, and thinking on the handheld screen sizes and resolutions first. 

Unfortunately that reached a point where it was above what I could piece together on my own, so before giving up I started experimenting with Claude to check what could be done, and the results were actually pretty good. I checked, tested and re-tested everything, read through code and tried to at least understand where it all was coming from, but I used a ton of AI in the process, let that be clear. 

I really like the results, and there's a bunch of stuff that was not lifted directly from other shaders, and although those are fully fledged shaders, since it is not my own code and Claude was probably checking a lot of code from shaders all over the web, my process was more like creating shader presets, in the same manner you could edit a bunch of shaders in RetroArch, save and share your presets to anyone. 

I'm happy if I'm the only one using those, but I bet some of you may like them too, so here we are! 

## Credits and licensing

The shaders in this repository are licensed under GPL-3.0-or-later (see `LICENSE`). They include code from the projects below, which keep their own notices. The credit lines are also in the header of every shader.

| Shaders | Based on | Author | License |
| --- | --- | --- | --- |
| CRT family | `fake-CRT-Geom` | DariusG | GPL-2.0-or-later |
| CRT family | `kaizer-lp-small` (NTSC blur) | DariusG | GPL-2.0-or-later |
| CRT family | `tiny_ntsc` (NTSC dither), [sbtl_shaders](https://github.com/vsvsv/sbtl_shaders) | Vsevolod (vsvsv) | MIT, Copyright (c) 2025 Vsevolod |
| CRT and LCD | `Sharp-Shimmerless-Shader` | zadpos | Public domain |
| LCD family (RGB grid) | [`lcd3x`](https://github.com/gigaherz/lcd3x) | Gigaherz | BSD 3-Clause, Copyright (c) 2012 David Quintana |
| LCD family (Mono grid) | [`lcd1x`](https://github.com/libretro/slang-shaders/blob/master/handheld/shaders/lcd1x.slang) | Gigaherz, edited by jdgleaver | GPL-2.0-or-later |
| LCD family (LCD Background) | `Pixel Transparency` | mattakins | Inspiration only, no code used |
| All | bagel-mini shaders | bgelmini / ClaudeAI | GPL-3.0-or-later |

### lcd3x (BSD 3-Clause)

```
Copyright (c) 2012, David Quintana <gigaherz@gmail.com>
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * Neither the name of the author nor the names of the contributors may
      be used to endorse or promote products derived from this software
      without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDERS OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.
```

### sbtl_shaders (MIT)

```
MIT License

Copyright (c) 2025 Vsevolod

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### GPL-2.0-or-later parts

`fake-CRT-Geom`, `kaizer-lp-small` and `lcd1x` are free software under the GNU General Public License, version 2 or (at your option) any later version. They are used here under version 3, as the "or later" clause allows. The full texts are at <https://www.gnu.org/licenses/old-licenses/gpl-2.0.html> and <https://www.gnu.org/licenses/gpl-3.0.html>.
