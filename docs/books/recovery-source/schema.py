"""Small constructors keep the book's source readable and consistent."""


def S(title, *paragraphs, bullets=None, callout=None, exercise=None, refs=None, keep_together=False):
    return {
        "title": title,
        "paragraphs": list(paragraphs),
        "bullets": bullets or [],
        "callout": callout,
        "exercise": exercise,
        "refs": refs or [],
        "keep_together": keep_together,
    }


def C(number, title, subtitle, *sections, refs=None):
    return {
        "number": number,
        "title": title,
        "subtitle": subtitle,
        "sections": list(sections),
        "refs": refs or [],
    }


def P(title, subtitle, image, intro, *chapters):
    return {
        "title": title,
        "subtitle": subtitle,
        "image": image,
        "intro": intro,
        "chapters": list(chapters),
    }
