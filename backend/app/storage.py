"""S3 file storage. Browsers upload and download directly with short-lived signed links,
because Lambda cannot accept request bodies larger than 6 MB."""

import re
from functools import cache

import boto3
from botocore.config import Config
from fastapi import HTTPException, status

from app.config import get_settings

UPLOAD_LINK_SECONDS = 15 * 60
DOWNLOAD_LINK_SECONDS = 5 * 60


@cache
def s3():
    return boto3.client("s3", config=Config(signature_version="s3v4"))


# Documents, slides, spreadsheets, images, audio/video, archives and code. Programs that
# run when opened (.exe, .bat, .msi and so on) are refused.
ALLOWED_EXTENSIONS = frozenset(
    """pdf doc docx odt rtf txt md ppt pptx odp key xls xlsx ods csv numbers pages
    png jpg jpeg gif webp heic mp3 m4a wav mp4 mov webm zip 7z tar gz
    py ipynb java c h cpp cs js ts html css json xml sql r""".split()
)


def check_file_type(name: str) -> None:
    """Refuse file types that aren't on the allowed list."""
    extension = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"Files of type .{extension or '(none)'} can't be uploaded. Use a document, image, video, archive or code file.",
        )


def safe_file_name(name: str) -> str:
    """Keep only the last path part and characters that are safe in a key and a header."""
    name = re.split(r"[\\/]", name)[-1]
    name = re.sub(r"[^A-Za-z0-9._ -]", "_", name).strip(" .")
    return name[:150] or "file"


def upload_ticket(key: str, content_type: str) -> dict:
    """Signed form for uploading one file with an HTTP POST. Enforces the size limit."""
    settings = get_settings()
    max_bytes = settings.max_upload_mb * 1024 * 1024
    post = s3().generate_presigned_post(
        Bucket=settings.bucket_name,
        Key=key,
        Fields={"Content-Type": content_type},
        Conditions=[{"Content-Type": content_type}, ["content-length-range", 1, max_bytes]],
        ExpiresIn=UPLOAD_LINK_SECONDS,
    )
    return {"url": post["url"], "fields": post["fields"]}


def download_url(key: str, file_name: str) -> str:
    # "attachment" makes browsers save the file instead of opening it on our site.
    return s3().generate_presigned_url(
        "get_object",
        Params={
            "Bucket": get_settings().bucket_name,
            "Key": key,
            "ResponseContentDisposition": f'attachment; filename="{safe_file_name(file_name)}"',
        },
        ExpiresIn=DOWNLOAD_LINK_SECONDS,
    )


def delete_file(key: str) -> None:
    s3().delete_object(Bucket=get_settings().bucket_name, Key=key)
