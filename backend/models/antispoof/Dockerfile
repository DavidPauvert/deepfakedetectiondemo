# Utilisation d'une image de base minimale
ARG PYTHON_VERSION=3.11
FROM python:${PYTHON_VERSION}-slim AS base

# Installation des dépendances minimales
RUN apt update && apt install -y --no-install-recommends \
    build-essential ffmpeg libsndfile1 nano \
    && apt clean \
    && rm -rf /var/lib/apt/lists/*

# Installation de Python et des bibliothèques nécessaires
RUN python -m pip install --upgrade pip

# RUN pip install --no-cache-dir torch==2.2.2 torchvision==0.17.2 torchaudio==2.2.2 --index-url https://download.pytorch.org/whl/cu121
# RUN pip install --no-cache-dir torch==2.6.0 torchvision==0.21.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cu124
RUN pip install --no-cache-dir torch==2.7.0 torchvision==0.22.0 torchaudio==2.7.0 --index-url https://download.pytorch.org/whl/cu126

WORKDIR /workspace
# Installation des dépendances Python
COPY requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copie du code source de l'application
COPY . .

# Fairseq installation, needed for Temporal channel modelling antispoof only (tcm_add)
WORKDIR /workspace/fairseq
RUN pip install fairseq-0.12.3.1-cp311-cp311-linux_x86_64.whl

RUN python -c "from fairseq import checkpoint_utils"

WORKDIR /workspace

# set PYTHONPATH to /workspace
ENV PYTHONPATH=/workspace

# interactive mode
CMD ["/bin/bash"]
