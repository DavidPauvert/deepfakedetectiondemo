#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Compute the scores for a list of wav files using the specified counter measure model.
"""

import argparse
import os
import time

from tqdm import tqdm
import numpy as np
import torch

SR = 16000

import librosa
from backend.models.antispoof.hparams_class import HParams


def load_audio(filepath, device, no_padd=False, padd_with_zeros=False):
    """
    Load an audio file, resampled if needed, and reshape it to fit the model input requirements.
    """
    audio_np, sr = librosa.load(filepath, sr=SR, mono=True)

    assert sr == SR, f"Sample rate of the audio file ({sr}) does not match the expected sample rate ({SR})"

    # Pad or truncate to SIGNAL
    if no_padd:
        audio_np = audio_np.reshape((BATCH, -1))
    else:
        if len(audio_np) < SIGNAL:
            if padd_with_zeros:
                audio_padded = np.pad(audio_np, (0, SIGNAL - len(audio_np)), 'constant', constant_values=(0., 0.))
            else:
                # Circular method (circular-wrap) => usual way
                repetitions = (SIGNAL + len(audio_np) - 1) // len(audio_np)
                audio_padded = np.tile(audio_np, repetitions)
                assert len(audio_padded) >= SIGNAL, print(f'len audio padded = {len(audio_padded)}, SIGNAL = {SIGNAL}')
                audio_padded = audio_padded[:SIGNAL]
            audio_np = audio_padded
            assert len(audio_np) == SIGNAL, print(f'len audio = {len(audio_np)}, SIGNAL = {SIGNAL}')
        else:
            audio_np = audio_np[:SIGNAL]

        # Reshape en (BATCH, SIGNAL)
        audio_np = audio_np.reshape((BATCH, SIGNAL))

    # Conversion en Tensor PyTorch et envoi sur device
    audio_tensor = torch.from_numpy(audio_np).to(device)
    return audio_tensor, sr


def load_counter_measure_model(hps):
    """
    Load the specified counter measure model based on the configuration dictionary.

    Args:
        hps (dict): Configuration dictionary containing model information.

    Returns:
        model_cm (torch.nn.Module): Loaded counter measure model (Temporal Channel Modeling or IRISA wav2vec + Linear).
        Note : fairseq is needed for tcm_add only.
    """

    if hps['cmmodel'] == 'tcm_add':
        print('Loading TCM-Add model...')
        from backend.models.antispoof.tcm_add.model import Model

        # hard coded args for tcm_add, except for the checkpoint path and xlsr path which are provided in the config
        args_tcm_add = HParams(
            **{
                "emb_size": 144,
                "num_encoders": 4,
                "heads": 4,
                "kernel_size": 31,
                "ckpt_path": hps['ckpt_path'],
                "xlsr_path": hps['xlsr_path'],
                "FT_W2V": False,
            })
        model_cm = Model(args_tcm_add, device=None)
        model_cm_state_dict = torch.load(args_tcm_add.ckpt_path, map_location='cpu')
        model_cm.load_state_dict(model_cm_state_dict, strict=True)
        if not args_tcm_add.FT_W2V:  # not sure of this ...
            for param in model_cm.ssl_model.parameters():
                param.requires_grad = False
        print('TCM-Add model loaded.')

    elif hps['cmmodel'] == 'wav2vec_linear':
        print("Loading My's Wav2Vec + Linear model...")
        from backend.models.antispoof.wav2vec_linear.model import SSLClassifier
        # set the counter measure checkpoint path
        checkpoint_path = hps['ckpt_path']
        model_cm = SSLClassifier(wav2vec_model_dir=hps['xlsr_path'])
        print('Loading counter measure checkpoint from:', checkpoint_path)
        checkpoint = torch.load(checkpoint_path, map_location='cpu')
        checkpoint = checkpoint['state_dict']
        checkpoint.pop("loss_fn.weight", None)
        model_cm.load_state_dict(checkpoint, strict=True)
        print(f'Counter measure {hps["cmmodel"]} loaded.')
    else:
        raise ValueError(f"Unsupported counter measure model: {hps['cmmodel']}")
    return model_cm


def get_scores_from_wav_files(wav_files_dir, config_dict):
    """
    Get the scores for a list of wav files using the specified counter measure model.

    Args:
        wav_files_dir (str): Path to the directory containing wav files.
        config_dict (dict): Configuration dictionary containing model information.

    Returns:
       score_all_np (np.ndarray): Array of scores for all files.
    """
    # Inference loop
    score_list = []
    total_files = len(os.listdir(wav_files_dir))

    for wav_file in tqdm(os.listdir(wav_files_dir), total=total_files, desc=f"Processing audio files"):
        wav_path = os.path.join(wav_files_dir, wav_file)
        audio_tensor, _ = load_audio(wav_path, device)

        # Inference and timing
        with torch.no_grad():
            t0 = time.time()
            if config_dict["cmmodel"] == 'tcm_add':
                logits, _ = model_cm(audio_tensor)
            else:
                logits = model_cm(audio_tensor)

            # pas de sigmoid ici
            if config_dict["cmmodel"] == 'wav2vec_linear':  # simple temporal pooling
                score = logits.mean(dim=1)[:, 1]
            else:
                score = logits[:, 1]
            dt = (time.time() - t0) * 1000  # en ms

        # Move predictions (logits) to the CPU as NumPy arrays
        prob_np = score.cpu().numpy()  # shape (BATCH, …)
        score_list.append(prob_np.reshape(-1))  # store everything, just in case

    # display one pred
    print(f"{os.path.basename(wav_path)} → shape={prob_np.shape}, preds={prob_np.flatten()}, time={dt:.1f} ms")

    # Convert to numpy arrays
    score_all_np = np.array(score_list, dtype=np.float32).reshape(-1)
    return score_all_np


if __name__ == "__main__":

    # Global parameters
    BATCH = 1
    SIGNAL = 64600
    SAMPLE_RATE = 16000

    # device setup
    assert torch.cuda.is_available(), "CPU training is not allowed."
    device = torch.device('cuda')
    print("Using device:", device)

    import argparse
    parser = argparse.ArgumentParser(description="Evaluation script for anti-spoofing model at EER")
    parser.add_argument("--audiodir", type=str, help="Path to the audio directory to be evaluated")
    parser.add_argument("--cmmodel",
                        type=str,
                        choices=['wav2vec_linear', 'tcm_add'],
                        help="Counter measure model to use")
    parser.add_argument("--ckpt_path", type=str, default=None, help="Path to the counter measure model checkpoint")
    parser.add_argument("--xlsr_path", type=str, default="", help="Path to the SSL model checkpoint (if needed)")
    args = parser.parse_args()

    # create config_dict with counter measure model parameters
    config_dict = {'cmmodel': args.cmmodel, 'ckpt_path': args.ckpt_path, 'xlsr_path': args.xlsr_path}

    model_cm = load_counter_measure_model(config_dict)
    model_cm.to(device)
    model_cm.eval()
    print('Counter measure model loaded.')

    # Warm-up
    # Create a dummy input with the shape expected by the model
    # Assume here that the model expects a tensor shaped (BATCH, SIGNAL)
    dummy_input = torch.zeros((BATCH, SIGNAL), dtype=torch.float32, device=device)
    print("> Warm-up : 5 passages sur dummy_input")
    with torch.no_grad():
        for _ in range(5):
            _ = model_cm(dummy_input)

    audiodir = args.audiodir
    print(f"Evaluating audio directory: {audiodir}")

    bonafide_files = os.listdir(audiodir)
    print(f"Found {len(bonafide_files)} bonafide files in {audiodir}")

    score_np = get_scores_from_wav_files(audiodir, config_dict=config_dict)
    print(
        f'Scores : min {np.min(score_np):.2f}, max {np.max(score_np):.2f}, median {np.median(score_np):.2f}, mean {np.mean(score_np):.2f}, std {np.std(score_np):.2f}'
    )
