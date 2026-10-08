# bagel-mini-shaders
Collection of shaders and overlays for MustardOS 

<!-- Short description of the pack goes here. -->
Shaders
CRT
Shader	Preset
bagel-CRT-mini-v3	Dither Merge off
bagel-COMPOSITE-mini-v3	Dither Merge on
bagel-RF-mini-v3	Dither Merge, Dot Crawl, Noise, RF Ghosting (Motion) and Vertical Roll on
LCD
Shader	Preset
bagel-LCD-mini-v5	
bagel-LCD-mini-border-v5	Border Fade on
bagel-LCD-mini-background-v5	Border Fade and LCD Background (Warm) on
bagel-LCD-mini-dirty-v5	Border Fade, LCD Background (Green) and Fake Ghosting on
Installation
<!-- How to install. -->
Parameters
<!-- Parameter notes. -->
Overlays
<!-- Overlay notes, one folder per resolution. -->
Credits and licensing

The shaders in this repository are licensed under GPL-3.0-or-later (see LICENSE). They include code from the projects below, which keep their own notices. The credit lines are also in the header of every shader.

Shaders	Based on	Author	License
CRT family	fake-CRT-Geom	DariusG	GPL-2.0-or-later
CRT family	kaizer-lp-small (NTSC blur)	DariusG	GPL-2.0-or-later
CRT family	tiny_ntsc (NTSC dither), sbtl_shaders	DariusG / Vsevolod	MIT, Copyright (c) 2025 Vsevolod
CRT and LCD	Sharp-Shimmerless-Shader	zadpos	Public domain
LCD family (RGB grid)	lcd3x	Gigaherz	BSD 3-Clause, Copyright (c) 2012 David Quintana
LCD family (Mono grid)	lcd1x	Gigaherz, edited by jdgleaver	GPL-2.0-or-later
LCD family (LCD Background)	Pixel Transparency	mattakins	Inspiration only, no code used
All	bagel shaders	bgelmini / ClaudeAI	GPL-3.0-or-later
<!-- Verify: who wrote the tiny_ntsc code in sbtl_shaders. Also update the CRT shader headers: Sharp-Shimmerless author is zadpos, not Woohyun Kang. -->
lcd3x (BSD 3-Clause)
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
sbtl_shaders (MIT)
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
GPL-2.0-or-later parts

fake-CRT-Geom, kaizer-lp-small and lcd1x are free software under the GNU General Public License, version 2 or (at your option) any later version. They are used here under version 3, as the "or later" clause allows. The full texts are at https://www.gnu.org/licenses/old-licenses/gpl-2.0.html and https://www.gnu.org/licenses/gpl-3.0.html.
