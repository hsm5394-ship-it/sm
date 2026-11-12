"""Render the 매점 dialogue with CosyVoice2 and mix it into one wav.

Run from inside a CosyVoice checkout (https://github.com/FunAudioLLM/CosyVoice):

    python /path/to/cosyvoice-maejeom/render.py \
        --model pretrained_models/CosyVoice2-0.5B \
        --pack /path/to/cosyvoice-maejeom

Output: <pack>/out/lines/NN_speaker.wav for each line, and <pack>/out/maejeom.wav.
Sound effects: drop optional files into <pack>/sfx/ named after the cue
(bell.wav, footsteps_running.wav, pocket_rustle.wav, footsteps_walk.wav,
footsteps_stairs.wav). A missing cue is skipped and leaves only its pause.
"""
import argparse
import json
import os
import sys

import torch
import torchaudio

sys.path.append("third_party/Matcha-TTS")
from cosyvoice.cli.cosyvoice import CosyVoice2  # noqa: E402

try:
    from cosyvoice.utils.file_utils import load_wav
except ImportError:  # newer releases take a path directly
    load_wav = None


def prompt_arg(wav_path):
    return load_wav(wav_path, 16000) if load_wav else wav_path


def synth(model, line, voice, prompt, use_instruct):
    text = line["text"]
    if use_instruct and line.get("instruct"):
        gen = model.inference_instruct2(text, line["instruct"] + "<|endofprompt|>", prompt, stream=False)
    else:
        gen = model.inference_zero_shot(text, voice["prompt_text"], prompt, stream=False)
    return torch.cat([chunk["tts_speech"] for chunk in gen], dim=1)


def load_sfx(path, sr):
    wav, file_sr = torchaudio.load(path)
    wav = wav.mean(dim=0, keepdim=True)
    if file_sr != sr:
        wav = torchaudio.functional.resample(wav, file_sr, sr)
    return wav * 0.6


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="pretrained_models/CosyVoice2-0.5B")
    ap.add_argument("--pack", default=os.path.dirname(os.path.abspath(__file__)))
    ap.add_argument("--no-instruct", action="store_true",
                    help="plain zero-shot cloning only (closer to the reference voice, flatter emotion)")
    ap.add_argument("--fp16", action="store_true")
    args = ap.parse_args()

    pack = args.pack
    script = json.load(open(os.path.join(pack, "lines.json"), encoding="utf-8"))
    voices = json.load(open(os.path.join(pack, "voices.json"), encoding="utf-8"))
    voices.pop("_comment", None)
    for name, v in voices.items():
        v["wav"] = os.path.join(pack, v["wav"])
        if not os.path.exists(v["wav"]):
            sys.exit(f"missing reference clip for {name}: {v['wav']}")

    model = CosyVoice2(args.model, load_jit=False, load_trt=False, fp16=args.fp16)
    sr = model.sample_rate
    prompts = {name: prompt_arg(v["wav"]) for name, v in voices.items()}

    out_dir = os.path.join(pack, "out", "lines")
    os.makedirs(out_dir, exist_ok=True)
    default_gap = script.get("sample_gap_ms", 350)
    pieces = []

    for i, line in enumerate(script["lines"], 1):
        if "speaker" in line:
            spk = line["speaker"]
            wav = synth(model, line, voices[spk], prompts[spk], not args.no_instruct)
            torchaudio.save(os.path.join(out_dir, f"{i:02d}_{spk}.wav"), wav, sr)
            print(f"[{i:02d}] {spk}: {line['text']}")
            pieces.append(wav)
        else:
            sfx_path = os.path.join(pack, "sfx", f"{line['sfx']}.wav")
            if os.path.exists(sfx_path):
                pieces.append(load_sfx(sfx_path, sr))
                print(f"[{i:02d}] sfx: {line['sfx']}")
            else:
                print(f"[{i:02d}] sfx: {line['sfx']} (no file, skipped)")
        gap = line.get("pause_ms", default_gap)
        pieces.append(torch.zeros(1, int(sr * gap / 1000)))

    mix = torch.cat(pieces, dim=1)
    mix = mix / max(1.0, mix.abs().max().item() / 0.95)
    out = os.path.join(pack, "out", "maejeom.wav")
    torchaudio.save(out, mix, sr)
    print(f"done: {out} ({mix.shape[1] / sr:.1f}s)")


if __name__ == "__main__":
    main()
