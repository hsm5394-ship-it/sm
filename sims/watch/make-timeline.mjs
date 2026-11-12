// Writes timeline.json from the film's own script: the stage beats and every tick you can hear.
//   node sims/watch/make-timeline.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {audibleTicks, DURATION, STAGES} from './script.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const beats = Object.fromEntries(STAGES.map((s) => [s.id, s.t]));
const speed = STAGES.map((s) => ({t: s.t, rate: s.rate}));
fs.writeFileSync(path.join(here, 'timeline.json'), JSON.stringify({duration: DURATION, beats, speed, ticks: audibleTicks()}));
console.log(beats, audibleTicks().length, 'ticks');
