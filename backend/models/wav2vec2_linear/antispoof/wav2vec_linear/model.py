import torch
from torch import nn
import torch.nn.functional as F
import lightning as pl
# from .custom_logger import get_logger
# logger = get_logger(__name__)
# from .layers import MyFeatureExtractor
from transformers import Wav2Vec2Model

torch.autograd.set_detect_anomaly(True)


class SSLClassifier(pl.LightningModule):

    def __init__(self, wav2vec_model_dir=None):
        super().__init__()

        if wav2vec_model_dir is None:
            model_source = "facebook/wav2vec2-xls-r-300m"
            local_only = False
        else:
            model_source = wav2vec_model_dir
            local_only = True

        self.feature_extractor = Wav2Vec2Model.from_pretrained(
            model_source,
            local_files_only=local_only,
        )

        self.classifier = nn.Linear(1024, 2)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x, _ = self.feature_extractor(x, output_hidden_states=False, return_dict=False)
        x = self.classifier(x)
        return x
