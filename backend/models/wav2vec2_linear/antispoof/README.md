# Audio anti-spoofing demo

Run inference on audio files with either **TCM-Add** (`tcm_add`) or
**IRISA Wav2Vec + Linear** (`wav2vec_linear`) using Docker.

## Prerequisites

- Docker with NVIDIA GPU support configured on the host.
- A CUDA-compatible NVIDIA GPU: `inference.py` requires CUDA.
- The checkpoints and pretrained XLSR model for the selected system (see below).
- A non-empty directory containing only audio files supported by `librosa`.

## 1. Build the Docker image

Run from the project root:

```bash
docker build -t antispoofs:latest .
```

## 2. Start the container

Replace the host paths below with the locations of your models and audio files.
All three directories are mounted read-only.

```bash
docker run -it --rm --gpus all \
  -v /media/benaroya/cricket/wav2vec_linear:/wav2vec_linear:ro \
  -v /media/benaroya/cricket/tcm_add_checkpoints:/tcm_add_checkpoints:ro \
  -v "$(pwd)/audio:/workspace/audio:ro" \
  antispoofs:latest
```

The container opens a shell in `/workspace`. The commands below run inside it.
Only the model directory for the selected system needs to be mounted.

## 3. Run inference

### TCM-Add

Required files inside the container:

- `/tcm_add_checkpoints/DF/avg_5_best.pth`: anti-spoofing checkpoint.
- `/tcm_add_checkpoints/xlsr2_300m.pt`: pretrained XLSR checkpoint.

```bash
python inference.py \
  --audiodir audio \
  --cmmodel tcm_add \
  --ckpt_path /tcm_add_checkpoints/DF/avg_5_best.pth \
  --xlsr_path /tcm_add_checkpoints/xlsr2_300m.pt
```

### IRISA Wav2Vec + Linear

Required paths inside the container:

- `/wav2vec_linear/spoofing_ckpt2.ckpt`: anti-spoofing checkpoint.
- `/wav2vec_linear/wav2vec_xlsr_300m`: pretrained Wav2Vec model directory.

```bash
python inference.py \
  --audiodir audio \
  --cmmodel wav2vec_linear \
  --ckpt_path /wav2vec_linear/spoofing_ckpt2.ckpt \
  --xlsr_path /wav2vec_linear/wav2vec_xlsr_300m
```

### Arguments

| Argument | Description |
| --- | --- |
| `--audiodir` | Directory of audio files to process, using a container path. |
| `--cmmodel` | Model to use: `tcm_add` or `wav2vec_linear`. |
| `--ckpt_path` | Anti-spoofing checkpoint, using a container path. |
| `--xlsr_path` | Pretrained XLSR checkpoint file (TCM-Add) or model directory (Wav2Vec + Linear). |

## Processing and output

Audio is converted to mono and resampled to 16 kHz. Each file is truncated to
64,600 samples (about 4 seconds), or repeated to reach that length if shorter.
Files are processed individually after five warm-up passes.

The script prints a progress bar, the last processed file's raw score and
inference time, and aggregate score statistics (minimum, maximum, median, mean,
and standard deviation). Scores are raw logits, not probabilities; the script
does not apply a decision threshold or save scores to a file.
