import sys, numpy as np
from scipy.io import wavfile
from scipy import signal
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
sr, x = wavfile.read(sys.argv[1] if len(sys.argv)>1 else 'out/score.wav')
x = x.astype(np.float32)/32768
m = x.mean(axis=1)
beat = 60/144
print('peak', 20*np.log10(np.abs(x).max()+1e-9), 'rms', 10*np.log10((x**2).mean()+1e-12))
print('per-bar rms dBFS / peak:')
for b in range(12):
    seg = x[int(b*4*beat*sr):int((b+1)*4*beat*sr)]
    print(b, round(10*np.log10((seg**2).mean()+1e-12),1), round(20*np.log10(np.abs(seg).max()+1e-9),1))
# spectral balance (octave bands) overall
f, P = signal.welch(m, sr, nperseg=8192)
bands=[(20,60),(60,120),(120,250),(250,500),(500,1000),(1000,2000),(2000,4000),(4000,8000),(8000,16000)]
tot=P.sum()
print('band energy %:', [ (lo, round(100*P[(f>=lo)&(f<hi)].sum()/tot,1)) for lo,hi in bands])
# clipping / DC
print('DC', m.mean(), 'samples >0.98:', int((np.abs(x)>0.98).sum()))
fig, ax = plt.subplots(2,1, figsize=(16,8), gridspec_kw={'height_ratios':[1,2]})
t = np.arange(len(m))/sr
ax[0].plot(t, m, lw=0.3); ax[0].set_xlim(0,20)
for k in [1.667,5,7.5,10,13.333,14.167,15,15.833,16.667]: ax[0].axvline(k,color='r',lw=0.5)
f, tt, S = signal.spectrogram(m, sr, nperseg=2048, noverlap=1536)
ax[1].pcolormesh(tt, f, 10*np.log10(S+1e-12), vmin=-120, vmax=-40, shading='auto'); ax[1].set_ylim(0,12000)
plt.tight_layout(); plt.savefig('previews/spectrogram.png', dpi=70)
