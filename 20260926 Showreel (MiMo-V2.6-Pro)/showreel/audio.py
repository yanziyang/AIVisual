"""15s beat-synced showreel soundtrack @ 128 BPM (8 bars = 15.000s)."""
import math
import wave

import numpy as np

rng = np.random.default_rng(20260926)

SR = 48000
DUR = 15.0
N = int(SR * DUR)
BPM = 128.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT

t_axis = np.arange(N) / SR
L = np.zeros(N)
R = np.zeros(N)


def add(buf, sig, start):
    i0 = int(round(start * SR))
    if i0 >= N:
        return
    i1 = min(N, i0 + len(sig))
    if i1 <= 0:
        return
    s0 = max(0, -i0)
    buf[max(i0, 0):i1] += sig[s0:s0 + (i1 - max(i0, 0))]


def fft_filter(x, lo=None, hi=None, order=4):
    n = len(x)
    if n < 8:
        return x
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1.0 / SR)
    H = np.ones_like(f)
    fsafe = np.maximum(f, 1e-6)
    if lo:
        H = H / (1.0 + (lo / fsafe) ** order)
    if hi:
        H = H / (1.0 + (fsafe / hi) ** order)
    return np.fft.irfft(X * H, n)


def env_ad(n, attack, decay, curve=1.0):
    tt = np.arange(n) / SR
    a = 1.0 - np.exp(-tt / max(attack, 1e-5))
    d = np.exp(-tt / max(decay, 1e-5)) ** curve
    return a * d


def kick():
    n = int(SR * 0.36)
    tt = np.arange(n) / SR
    f = 44 + 140 * np.exp(-tt / 0.026)
    phase = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(phase) * np.exp(-tt / 0.078)
    click = rng.standard_normal(n) * np.exp(-tt / 0.0032) * 0.30
    sub = np.sin(2 * np.pi * 47 * tt) * np.exp(-tt / 0.13) * 0.55
    return np.tanh((body + click + sub) * 1.35) * 0.92


def clap():
    n = int(SR * 0.32)
    tt = np.arange(n) / SR
    noise = rng.standard_normal(n)
    env = np.zeros(n)
    for off, g in ((0.0, 1.0), (0.009, 0.86), (0.018, 0.72), (0.028, 0.55)):
        i = int(off * SR)
        env[i:] += g * np.exp(-np.arange(n - i) / SR / 0.011)
    env += np.exp(-tt / 0.115) * 0.52
    y = fft_filter(noise * env, lo=1100, hi=7200)
    return y * 0.42


def hat(open_=False, decay=0.028):
    n = int(SR * (0.22 if open_ else 0.07))
    tt = np.arange(n) / SR
    y = rng.standard_normal(n) * np.exp(-tt / (0.105 if open_ else decay))
    y = fft_filter(y, lo=7000)
    return y * (0.16 if open_ else 0.20)


def snare_roll(dur):
    n = int(SR * dur)
    tt = np.arange(n) / SR
    p = tt / dur
    y = rng.standard_normal(n) * (0.18 + 0.82 * p ** 2)
    y = fft_filter(y, lo=1800, hi=9000)
    trem = 0.55 + 0.45 * np.sin(2 * np.pi * (4 + 26 * p) * tt)
    return y * trem * 0.30


def saw(freq, dur, decay, detune=0.0):
    n = int(SR * dur)
    tt = np.arange(n) / SR
    out = np.zeros(n)
    for d in ((0.0,) if detune == 0 else (-detune, 0.0, detune)):
        ph = (freq * (1 + d)) * tt
        out += 2.0 * (ph % 1.0) - 1.0
    out /= 1.0 if detune == 0 else 3.0
    return out * env_ad(n, 0.004, decay)


def pluck(freq, dur, decay=0.22):
    n = int(SR * dur)
    tt = np.arange(n) / SR
    ph = 2 * np.pi * freq * tt
    y = np.sin(ph) * 0.62 + np.sin(2 * ph) * 0.26 + np.sin(3 * ph) * 0.12
    y += np.sin(ph * 1.005) * 0.30
    y *= env_ad(n, 0.003, decay)
    return fft_filter(y, hi=4200) * 0.34


def bass_note(freq, dur):
    n = int(SR * dur)
    tt = np.arange(n) / SR
    ph = (freq * tt) % 1.0
    y = 2.0 * ph - 1.0
    y = np.tanh(y * 1.7) * 0.7 + np.sin(2 * np.pi * freq * tt) * 0.55
    y *= env_ad(n, 0.006, dur * 0.55)
    return fft_filter(y, hi=260) * 0.52


def pad(freqs, dur):
    n = int(SR * dur)
    tt = np.arange(n) / SR
    y = np.zeros(n)
    for f in freqs:
        for det in (-0.006, 0.0, 0.007):
            ph = (f * (1 + det)) * tt
            y += (2.0 * (ph % 1.0) - 1.0) * 0.30
    y /= max(len(freqs) * 3, 1)
    a = np.clip(tt / 0.35, 0, 1)
    r = np.clip((dur - tt) / 0.55, 0, 1)
    y *= a * r
    return fft_filter(y, hi=1500) * 0.30


def impact(dur=1.4):
    n = int(SR * dur)
    tt = np.arange(n) / SR
    f = 30 + 110 * np.exp(-tt / 0.22)
    phase = 2 * np.pi * np.cumsum(f) / SR
    boom = np.sin(phase) * np.exp(-tt / 0.30) * 1.05
    crash = fft_filter(rng.standard_normal(n) * np.exp(-tt / 0.62), lo=1800) * 0.32
    return np.tanh((boom + crash) * 1.1) * 0.85


def riser(dur):
    n = int(SR * dur)
    tt = np.arange(n) / SR
    p = tt / dur
    f = 160 * (2 ** (3.6 * p))
    phase = 2 * np.pi * np.cumsum(f) / SR
    sweep = np.sin(phase) * (p ** 2.2) * 0.30
    noise = rng.standard_normal(n) * (p ** 3.0) * 0.34
    noise = fft_filter(noise, lo=500)
    return sweep + noise


def downlift(dur):
    n = int(SR * dur)
    tt = np.arange(n) / SR
    p = tt / dur
    f = 900 * (2 ** (-3.2 * p)) + 40
    phase = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(phase) * np.exp(-tt / (dur * 0.55)) * 0.28
    noise = fft_filter(rng.standard_normal(n) * np.exp(-tt / (dur * 0.40)), hi=2600) * 0.20
    return y + noise


# ---------------------------------------------------------------- arrangement
CHORDS = [
    (110.00, [220.00, 261.63, 329.63]),   # bar 0-1  Am
    (110.00, [220.00, 261.63, 329.63]),
    (87.31, [174.61, 220.00, 261.63]),    # bar 2-3  F
    (87.31, [174.61, 220.00, 261.63]),
    (130.81, [261.63, 329.63, 392.00]),   # bar 4-5  C
    (130.81, [261.63, 329.63, 392.00]),
    (98.00, [196.00, 246.94, 293.66]),    # bar 6-7  G
    (98.00, [196.00, 246.94, 293.66]),
]

kick_times = []
for bar in range(8):
    for b in range(4):
        ts = bar * BAR + b * BEAT
        if ts >= DUR:
            continue
        if bar == 7 and b >= 2:
            continue
        kick_times.append(ts)
        k = kick() * (0.95 if b == 0 else 0.86)
        add(L, k, ts)
        add(R, k, ts)

for bar in range(8):
    if bar == 0:
        continue
    for b in (1, 3):
        ts = bar * BAR + b * BEAT
        if ts >= DUR or (bar == 7 and b >= 2):
            continue
        c = clap()
        add(L, c, ts)
        add(R, np.roll(c, 90), ts)

for i in range(int(DUR / (BEAT / 2)) + 1):
    ts = i * BEAT / 2
    if ts >= DUR:
        break
    bar = int(ts // BAR)
    if bar == 7 and (ts - 7 * BAR) > BEAT * 2.2:
        continue
    accent = (i % 2 == 0)
    h = hat(open_=(i % 8 == 6))
    g = 1.0 if accent else 0.55
    if bar == 0:
        g *= 0.55
    add(L, h * g * 1.02, ts)
    add(R, h * g * 0.92, ts)

for i in range(int(DUR / (BEAT / 4)) + 1):
    ts = i * BEAT / 4
    bar = int(ts // BAR)
    if bar < 1 or ts >= DUR:
        continue
    step = i % 16
    if step not in (2, 6, 9, 12, 14):
        continue
    if bar == 7 and (ts - 7 * BAR) > BEAT * 2.6:
        continue
    h = hat(decay=0.018)
    add(L, h * 0.34, ts)
    add(R, h * 0.34, ts + 0.004)

for bar in range(8):
    root, chord = CHORDS[bar]
    ts0 = bar * BAR
    if ts0 >= DUR:
        break
    if bar >= 2:
        add(L, pad(chord, BAR * 1.05), ts0)
        add(R, pad([f * 1.003 for f in chord], BAR * 1.05), ts0)

for bar in range(8):
    root, chord = CHORDS[bar]
    ts0 = bar * BAR
    if bar == 0:
        pattern = (0, 2, 3)
    elif bar == 7:
        pattern = (0,)
    else:
        pattern = (0, 2, 3, 5, 6, 8, 10, 11, 13, 14)
    for step in pattern:
        ts = ts0 + step * BEAT / 4
        if ts >= DUR:
            continue
        if bar == 7 and step > 0:
            continue
        f = root if step % 4 == 0 else root * 1.0
        if step in (3, 6, 11, 14):
            f = root * 2.0
        b = bass_note(f, BEAT * 0.62)
        add(L, b, ts)
        add(R, b, ts)

ARP_START = 2
for i in range(int(DUR / (BEAT / 4)) + 1):
    ts = i * BEAT / 4
    bar = int(ts // BAR)
    if bar < ARP_START or ts >= DUR:
        continue
    if bar == 7 and (ts - 7 * BAR) > BEAT * 1.8:
        continue
    step = i % 16
    if step not in (0, 2, 3, 5, 6, 8, 10, 11, 13, 14):
        continue
    root, chord = CHORDS[bar]
    note = chord[[0, 1, 2, 1, 2, 0, 1, 2, 0, 1][step % 10]]
    if step in (6, 13):
        note *= 2.0
    p = pluck(note, BEAT * 0.9, decay=0.20)
    gain = 1.0 if step % 2 == 0 else 0.7
    add(L, p * gain, ts)
    add(R, p * gain * 0.85, ts + 0.011)

for bar in range(1, 8):
    ts = bar * BAR
    if ts >= DUR:
        break
    add(L, impact(1.1), ts)
    add(R, impact(1.1), ts)
    r = riser(BAR * 0.92)
    add(L, r, ts - BAR * 0.92)
    add(R, r, ts - BAR * 0.92)

add(L, impact(1.6), 0.0)
add(R, impact(1.6), 0.0)

roll = snare_roll(BAR * 0.9)
add(L, roll, 11.25 - BAR * 0.9)
add(R, roll, 11.25 - BAR * 0.9)

add(L, downlift(1.6), 13.125)
add(R, downlift(1.6), 13.125)

tail = impact(1.7) * 0.7
add(L, tail, 13.125)
add(R, tail, 13.125)

# ---------------------------------------------------------------- sidechain
duck = np.ones(N)
for kt in kick_times:
    i0 = int(kt * SR)
    win = int(0.30 * SR)
    i1 = min(N, i0 + win)
    if i1 <= i0:
        continue
    tt = np.arange(i1 - i0) / SR
    d = 1.0 - 0.58 * np.exp(-tt / 0.070)
    duck[i0:i1] = np.minimum(duck[i0:i1], d)

L *= duck
R *= duck

# ---------------------------------------------------------------- master
L = np.tanh(L * 1.18) * 0.96
R = np.tanh(R * 1.18) * 0.96

fade_in = np.clip(t_axis / 0.02, 0, 1)
fade_out = np.clip((DUR - t_axis) / 0.22, 0, 1)
L *= fade_in * fade_out
R *= fade_in * fade_out

peak = max(np.max(np.abs(L)), np.max(np.abs(R)), 1e-9)
L *= 0.94 / peak
R *= 0.94 / peak

stereo = np.empty(N * 2, dtype=np.float64)
stereo[0::2] = L
stereo[1::2] = R
pcm = np.clip(stereo, -1.0, 1.0)
pcm = (pcm * 32767.0).astype(np.int16)

with wave.open('audio.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())

print(f'audio.wav written  {DUR}s  {SR}Hz stereo  peak={peak:.3f}')
