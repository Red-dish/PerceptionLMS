"""Build the API image with Podman, push it to ECR, then deploy everything with Terraform.

    uv run python scripts/deploy.py

Needs Podman (with its machine running), Terraform, the AWS CLI signed in to your
account, and infra/terraform.tfvars. The last step shows the Terraform plan and asks
before changing anything.
"""

import subprocess
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
INFRA = BACKEND / "infra"
IMAGE_TAG = "latest"


def run(*args: str, cwd: Path = BACKEND, capture: bool = False, stdin: str | None = None) -> str:
    print("+", " ".join(args), flush=True)
    result = subprocess.run(args, cwd=cwd, check=True, text=True, capture_output=capture, input=stdin)
    return result.stdout.strip() if capture else ""


def main() -> None:
    run("terraform", "init", "-input=false", cwd=INFRA)

    # The image repository must exist before there is anywhere to push the image.
    run("terraform", "apply", "-input=false", "-auto-approve", "-target=aws_ecr_repository.api", cwd=INFRA)
    repository = run(
        "terraform", "console", cwd=INFRA, capture=True, stdin="aws_ecr_repository.api.repository_url\n"
    ).strip('"')
    registry = repository.split("/")[0]
    region = registry.split(".")[3]

    password = run("aws", "ecr", "get-login-password", "--region", region, capture=True)
    run("podman", "login", "--username", "AWS", "--password-stdin", registry, stdin=password)
    image = f"{repository}:{IMAGE_TAG}"
    run("podman", "build", "--platform", "linux/amd64", "--format", "docker", "-t", image, ".")
    run("podman", "push", "--format", "v2s2", image)

    run("terraform", "apply", f"-var=image_tag={IMAGE_TAG}", cwd=INFRA)
    print("\nAPI URL:", run("terraform", "output", "-raw", "api_url", cwd=INFRA, capture=True))


if __name__ == "__main__":
    main()
