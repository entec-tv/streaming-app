const cp = require('child_process');
const ffmpeg = require('ffmpeg-static');
try {
  cp.execSync(`${ffmpeg} -i "http://c7wcka2n81930127x.vod33.ip1-st37.me:80/live/play/U21rMU1HTjVibkozUjNsb1luVjVSREZVY0RoRWRrWTRhMUpsVm5GUmRWQkJaVEV4TTNoRVMxbHNiejA9/1555959"`, {stdio: 'inherit'});
} catch (e) {}
