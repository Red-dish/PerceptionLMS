"""Clean rich-text HTML before it is saved.

Pages are written in a rich-text editor and stored as HTML. Anything not on the
allowlist below is removed on save, so a page can't run scripts in other people's
browsers (cross-site scripting). The work is done by nh3, a well-tested sanitiser.

Allowed: headings, paragraphs, bold/italic/underline, lists, quotes, code, tables,
links (http, https, mailto), images (https), videos (https) and embedded video from
YouTube or Vimeo. Removed: scripts, styles, event handlers such as onclick,
javascript: and data: links, forms, and iframes from any other site.
"""

import re

import nh3

TAGS = {
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "br", "hr", "div", "span",
    "strong", "b", "em", "i", "u", "s", "sub", "sup", "mark", "small",
    "blockquote", "pre", "code",
    "ul", "ol", "li",
    "a", "img", "figure", "figcaption",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
    "iframe", "video", "source",
}  # fmt: skip

ATTRIBUTES = {
    "a": {"href", "title", "target"},
    "img": {"src", "alt", "title", "width", "height"},
    "iframe": {"src", "title", "width", "height", "allowfullscreen"},
    "video": {"src", "controls", "width", "height", "poster"},
    "source": {"src", "type"},
    "ol": {"start"},
    "th": {"colspan", "rowspan", "scope"},
    "td": {"colspan", "rowspan"},
}

# Only these sites may be embedded, and only their embed players.
VIDEO_EMBEDS = (
    "https://www.youtube.com/embed/",
    "https://www.youtube-nocookie.com/embed/",
    "https://player.vimeo.com/video/",
)

# Added to every embed and image whatever the author wrote.
FORCED = {
    "iframe": {
        "sandbox": "allow-scripts allow-same-origin allow-presentation allow-popups",
        "referrerpolicy": "strict-origin-when-cross-origin",
        "loading": "lazy",
    },
    "img": {"loading": "lazy"},
}

MAX_LENGTH = 200_000  # characters of HTML


def _filter(tag: str, attribute: str, value: str) -> str | None:
    if attribute in ("src", "poster"):
        if tag == "iframe":
            return value if value.startswith(VIDEO_EMBEDS) else None
        # Images and videos must be https: no http (mixed content) or data: URLs.
        return value if value.startswith("https://") else None
    if attribute == "target":
        return "_blank" if value == "_blank" else None
    return value


_EMPTY = re.compile(r"<iframe(?![^>]*\ssrc=)[^>]*></iframe>|<img(?![^>]*\ssrc=)[^>]*>|<source(?![^>]*\ssrc=)[^>]*>")


def sanitise(html: str) -> str:
    """Return the HTML with everything unsafe removed."""
    cleaned = nh3.clean(
        html,
        tags=TAGS,
        attributes=ATTRIBUTES,
        url_schemes={"http", "https", "mailto"},
        link_rel="noopener noreferrer nofollow",
        attribute_filter=_filter,
        set_tag_attribute_values=FORCED,
        clean_content_tags={"script", "style"},
        strip_comments=True,
    )
    # Drop embeds and images whose address was removed above.
    return _EMPTY.sub("", cleaned).strip()
