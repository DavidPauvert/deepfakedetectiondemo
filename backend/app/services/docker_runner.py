import threading
import time
from collections import deque
from typing import Callable

import tempfile
from pathlib import Path
from typing import List, Tuple, Dict, Any, Optional

import docker
from docker.errors import DockerException, ImageNotFound, APIError
from docker.types import DeviceRequest
from docker.models.containers import Container
from requests.exceptions import ConnectionError
from requests.exceptions import ReadTimeout

from app.core.config import settings
from app.core.models_registry import MODELS_REGISTRY, DEFAULT_MODEL_ID, ModelConfig

GPU_REQUEST = DeviceRequest(count=-1, capabilities=[["gpu"]])

class DockerRunnerService:
    def __init__(self):
        self._client: Optional[docker.DockerClient] = None
        self._gpu_ok: Optional[bool] = None
        self._builds: Dict[str, Dict[str, Any]] = {}
        self._builds_lock = threading.Lock()

    @property
    def client(self) -> docker.DockerClient:
        if self._client is None:
            try:
                self._client = docker.from_env()
            except DockerException as e:
                raise RuntimeError(
                    f"Unable to connect to Docker daemon: {e}. "
                    "Make sure Docker is installed and running."
                )
        return self._client

    def is_docker_available(self) -> bool:
        try:
            return self.client.ping()
        except Exception:
            return False

    def is_image_built(self, image_tag: str) -> bool:
        try:
            self.client.images.get(image_tag)
            return True
        except ImageNotFound:
            return False

    def is_gpu_available(self, force_refresh: bool = False) -> bool:
        """
        Tests if Docker can successfully initialize the NVIDIA GPU runtime.
        """
        if self._gpu_ok is not None and not force_refresh:
            return self._gpu_ok

        try:
            # Making sure the alpine image is downloaded
            try:
                self.client.images.get("alpine")
            except ImageNotFound:
                self.client.images.pull("alpine") 

            # Simple check if nvidia runtime or CDI device request works
            container = self.client.containers.create("alpine", ["true"], device_requests=[GPU_REQUEST])

            container.start()
            self._gpu_ok = container.wait(timeout=10)["StatusCode"] == 0

        except (DockerException, ReadTimeout, ConnectionError):
            self._gpu_ok = False

        finally:
            self._safe_remove(container)
        
        return self._gpu_ok

    def build_model_image(self, model_id: str, on_line: Optional[Callable[[str], None]] = None) -> str:
        """
        Builds the Docker image for the given model_id.
        """
        model_cfg = self._get_model_cfg(model_id)
        collected_logs: list[str] = []

        try:
            stream = self.client.api.build(
                path=str(model_cfg.model_path),
                dockerfile=str(model_cfg.dockerfile),
                tag=model_cfg.image_tag,
                rm=True,
                decode=True
            )

            for chunk in stream:
                if "stream" in chunk:
                    line = chunk["stream"]
                    print(line, end="", flush=True)
                    collected_logs.append(line)
                    if on_line:
                        on_line(line)
                elif "status" in chunk:  # ex: pull de l'image de base
                    line = chunk["status"]
                    if chunk.get("progress"):
                        line += f" {chunk['progress']}"
                    print(line, flush=True)
                    collected_logs.append(line + "\n")
                    if on_line:
                        on_line(line)
                elif "error" in chunk:
                    # Avec l'API bas niveau, les erreurs de build arrivent
                    # dans le flux et ne lèvent pas BuildError
                    raise RuntimeError(f"Docker build failed: {chunk['error'].strip()}\n" f"{''.join(collected_logs)}")

        except APIError as e:
            raise RuntimeError(f"Docker API error during build: {e}") from e

        return "".join(collected_logs)

    def run_inference(
        self,
        model_id: str,
        audio_files: List[Tuple[str, bytes]],
        threshold: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """
        Runs containerized model inference on the provided audio files.
        """
        
        model_cfg = self._get_model_cfg(model_id)

        if not audio_files:
            raise ValueError("No audio files provided for inference.")
        
        if not self.is_image_built(model_cfg.image_tag):
            raise RuntimeError(
                f"Docker image '{model_cfg.image_tag}' is not built yet. "
                f"Please build it using POST /api/models/{model_id}/build or 'docker build'."
            )

        weights_path = (settings.MODELS_DIR / model_id / model_cfg.weights_path).resolve()
        if not weights_path.exists():
            raise FileNotFoundError(
                f"Dossier des poids du modèle introuvable à {weights_path}. "
                "Assurez-vous que spoofing_ckpt2.ckpt et wav2vec_xlsr_300m sont présents."
            )

        used_threshold = threshold if threshold is not None else model_cfg.default_threshold

        # 1. Create a unique temporary directory for this inference job
        with tempfile.TemporaryDirectory() as tmp:
            job_dir = Path(tmp).resolve()

            # 2. Write audio files to the job directory
            self._write_audio_files(job_dir, audio_files)

            # 3. Setup volume mappings
            volumes = {
                # Montage des poids du modèle en lecture seule
                str(weights_path): {"bind": "/" + str(model_cfg.weights_path), "mode": "ro"},
                # Montage des fichiers audio à analyser en lecture seule
                str(job_dir): {"bind": "/" + str(model_cfg.audio_path), "mode": "ro"},
            }

            # 4. Execute container run
            stdout = self._run_container(
                image_tag=model_cfg.image_tag,
                command=["/bin/bash", "-c", model_cfg.command],
                volumes=volumes,
                use_gpu=settings.USE_GPU,
                timeout=settings.DOCKER_TIMEOUT_SECONDS,
            )

        # 6. Parse results from stdout using model's parser
        results = model_cfg.parse_output(stdout, threshold=used_threshold)

        # In case the parser missed files or format differed
        if not results:
            raise RuntimeError(
                "Model executed successfully but no predictions were parsed from output.\n"
                f"Raw container stdout:\n{stdout}"
            )
        
        # Add model_id to each result
        for res in results:
            res["model_id"] = model_id
        
        return results

    def _run_container(
        self,
        image_tag: str,
        command: List[str],
        volumes: dict,
        use_gpu: bool,
        timeout: int,
    ) -> str:
        """
        Runs a temporary container and returns its stdout
        """
        container = None
        try:
            # Preparing the container
            container = self.client.containers.create(
                image_tag,
                command,
                volumes=volumes,
                device_requests=[GPU_REQUEST] if use_gpu else None,
            )

            # Running the container
            try:
                container.start()
            except APIError as e:
                msg = str(e)
                if any(m in msg for m in ("no known GPU vendor found", "failed to discover GPU vendor")):
                    raise RuntimeError(
                        "Docker failed to access NVIDIA GPU (CDI error). "
                        "Please ensure 'nvidia-container-toolkit' is installed and configured:\n"
                        "sudo pacman -S nvidia-container-toolkit && "
                        "sudo nvidia-ctk runtime configure --runtime=docker && "
                        "sudo systemctl restart docker\n"
                        f"Docker error: {msg}"
                    ) from e
                raise RuntimeError(f"Docker failed to start the container: {msg}") from e

            # Catching its exit code
            try:
                exit_code = container.wait(timeout=timeout)["StatusCode"]
            except (ReadTimeout, ConnectionError) as e:
                container.kill()
                raise RuntimeError(f"Inference timed out after {timeout}s") from e

            # Catching its stdout
            stdout = container.logs(stdout=True, stderr=False).decode("utf-8", "replace")

            if exit_code != 0:
                stderr = container.logs(stdout=False, stderr=True).decode("utf-8", "replace")
                raise RuntimeError(
                    f"Inference container failed with exit code {exit_code}.\n"
                    f"Stdout: {stdout}\nStderr: {stderr}"
                )
            
            return stdout
        finally:
            self._safe_remove(container)

    @staticmethod
    def _get_model_cfg(model_id: str) -> ModelConfig:
        """
        Returns a model config from its ID and throws an error if it doesn't exist
        """
        try:
            return MODELS_REGISTRY[model_id]
        except KeyError:
            raise ValueError(f"Unknown model_id: {model_id}") from None

    @staticmethod
    def _write_audio_files(job_dir: Path, audio_files: List[Tuple[str, bytes]]) -> None:
        """
        Writes a list of audio files in a new directory
        """
        used = set()
        for i, (original_name, data) in enumerate(audio_files):
            # Anti path traversal
            name = Path(original_name).name

            # Anti name collision
            if name in used:
                name = f"{i}_{name}"
            
            used.add(name)
            (job_dir / name).write_bytes(data)

    @staticmethod
    def _safe_remove(container: Optional[Container]) -> None:
        if container is None:
            return
        try:
            container.remove(force=True)
        except DockerException:
            pass
        
    def start_build(self, model_id: str) -> Dict[str, Any]:
        self._get_model_cfg(model_id)  # lève ValueError si le modèle est inconnu
        with self._builds_lock:
            current = self._builds.get(model_id)
            if current and current["state"] == "building":
                return self.get_build_status(model_id)  # déjà en cours : pas de 2e build
            self._builds[model_id] = {
                "state": "building",
                "started_at": time.time(),
                "finished_at": None,
                "error": None,
                "log_tail": deque(maxlen=30),
            }
        threading.Thread(target=self._build_worker, args=(model_id,), daemon=True).start()
        return self.get_build_status(model_id)

    def get_build_status(self, model_id: str) -> Dict[str, Any]:
        cfg = self._get_model_cfg(model_id)
        with self._builds_lock:
            current = self._builds.get(model_id)
            if current:
                return {**current, "log_tail": list(current["log_tail"])}
        state = "ready" if self.is_image_built(cfg.image_tag) else "idle"
        return {"state": state, "started_at": None, "finished_at": None, "error": None, "log_tail": []}

    def _build_worker(self, model_id: str) -> None:
        def on_line(line: str) -> None:
            line = line.rstrip()
            if line:
                with self._builds_lock:
                    self._builds[model_id]["log_tail"].append(line)

        try:
            self.build_model_image(model_id, on_line=on_line)
            final = {"state": "ready", "error": None}
        except Exception as e:
            final = {"state": "failed", "error": str(e)[-2000:]}

        with self._builds_lock:
            self._builds[model_id].update(final, finished_at=time.time())


docker_runner = DockerRunnerService()
