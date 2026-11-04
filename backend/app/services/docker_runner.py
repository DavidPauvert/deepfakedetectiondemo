import os
import shutil
import uuid
import time
import subprocess
from pathlib import Path
from typing import List, Tuple, Dict, Any, Optional

import docker
from docker.errors import DockerException, ImageNotFound, APIError
from docker.types import DeviceRequest

from app.core.config import settings
from app.core.models_registry import MODELS_REGISTRY, DEFAULT_MODEL_ID


class DockerRunnerService:
    def __init__(self):
        self._client: Optional[docker.DockerClient] = None

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
        except Exception:
            return False

    def is_gpu_available(self) -> bool:
        """
        Tests if Docker can successfully initialize the NVIDIA GPU runtime.
        """
        try:
            # Simple check if nvidia runtime or CDI device request works
            result = subprocess.run(
                ["docker", "run", "--rm", "--gpus", "all", "alpine", "true"],
                capture_output=True,
                text=True,
                timeout=10,
            )
            return result.returncode == 0
        except Exception:
            return False

    def build_model_image(self, model_id: str) -> str:
        """
        Builds the Docker image for the given model_id.
        """
        if model_id not in MODELS_REGISTRY:
            raise ValueError(f"Unknown model_id: {model_id}")

        model_cfg = MODELS_REGISTRY[model_id]
        dockerfile_dir = settings.BASE_DIR / model_cfg["dockerfile_dir"]
        dockerfile_path = dockerfile_dir / "Dockerfile"

        if not dockerfile_path.exists():
            raise FileNotFoundError(f"Dockerfile not found at {dockerfile_path}")

        image_tag = model_cfg["image_tag"]

        # Run docker build via subprocess for reliable streaming/log capture
        cmd = ["docker", "build", "-t", image_tag, str(dockerfile_dir)]
        process = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return process.stdout

    def run_inference(
        self,
        model_id: str,
        audio_files: List[Tuple[str, bytes]],
        threshold: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """
        Runs containerized model inference on the provided audio files.
        """
        if model_id not in MODELS_REGISTRY:
            raise ValueError(f"Model '{model_id}' is not registered.")

        model_cfg = MODELS_REGISTRY[model_id]
        image_tag = model_cfg["image_tag"]

        if not self.is_image_built(image_tag):
            raise RuntimeError(
                f"Docker image '{image_tag}' is not built yet. "
                f"Please build it using POST /api/models/{model_id}/build or 'docker build'."
            )

        used_threshold = (
            threshold if threshold is not None else model_cfg["default_threshold"]
        )

        # 1. Create a unique temporary directory for this inference job
        job_id = uuid.uuid4().hex
        job_dir = settings.TEMP_AUDIO_DIR / job_id
        job_dir.mkdir(parents=True, exist_ok=True)

        try:
            # 2. Write audio files to the job directory
            written_filenames = []
            for original_filename, file_bytes in audio_files:
                safe_name = Path(original_filename).name
                file_path = job_dir / safe_name
                file_path.write_bytes(file_bytes)
                written_filenames.append(safe_name)

            if not written_filenames:
                raise ValueError("No audio files provided for inference.")

            # 3. Setup volume mappings
            volumes_dict = model_cfg["get_volumes"](settings.BASE_DIR, job_dir)

            # 4. Construct command
            docker_cmd = [
                "docker", "run", "--rm",
            ]

            # GPU support
            if settings.USE_GPU:
                docker_cmd.extend(["--gpus", "all"])

            # Add volumes
            for host_path, bind_info in volumes_dict.items():
                bind_path = bind_info["bind"]
                mode = bind_info.get("mode", "ro")
                docker_cmd.extend(["-v", f"{host_path}:{bind_path}:{mode}"])

            # Add image and container command
            docker_cmd.append(image_tag)
            docker_cmd.extend(["/bin/bash", "-c", model_cfg["command"]])

            # 5. Execute container run
            start_time = time.time()
            proc = subprocess.run(
                docker_cmd,
                capture_output=True,
                text=True,
                timeout=settings.DOCKER_TIMEOUT_SECONDS,
            )

            stdout = proc.stdout
            stderr = proc.stderr

            if proc.returncode != 0:
                if "no known GPU vendor found" in stderr or "failed to discover GPU vendor" in stderr:
                    raise RuntimeError(
                        "Docker failed to access NVIDIA GPU (CDI error). "
                        "Please ensure 'nvidia-container-toolkit' is installed and configured: \n"
                        "sudo pacman -S nvidia-container-toolkit && "
                        "sudo nvidia-ctk runtime configure --runtime=docker && "
                        "sudo systemctl restart docker\n"
                        f"Docker error: {stderr.strip()}"
                    )
                raise RuntimeError(
                    f"Inference container failed with exit code {proc.returncode}.\n"
                    f"Stdout: {stdout}\nStderr: {stderr}"
                )

            # 6. Parse results from stdout using model's parser
            parsed_results = model_cfg["parse_output"](stdout, threshold=used_threshold)

            # In case the parser missed files or format differed
            if not parsed_results:
                raise RuntimeError(
                    f"Model executed successfully but no predictions were parsed from output.\n"
                    f"Raw container stdout:\n{stdout}"
                )

            # Add model_id to each result
            for res in parsed_results:
                res["model_id"] = model_id

            return parsed_results

        finally:
            # 7. Clean up the temporary job directory
            if job_dir.exists():
                shutil.rmtree(job_dir, ignore_errors=True)


docker_runner = DockerRunnerService()
