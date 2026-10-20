"""Builds Kissa OTA story packages from compact specs (free-form: opening moment only)."""
import json, os, sys, importlib

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CREATOR = {"name": "Ankit", "avatar": None, "verified": True}

COMMON_SAFETY = [
    "All characters in any romance are adults. Romance is consensual, affectionate and non-explicit: kisses, hugs, cuddles, flirting and fade-to-black only — never sexual detail.",
    "The player alone controls {{playerName}}. Never write his dialogue, actions, inner feelings, reactions, consent or decisions. If he says no, slows down or sets a boundary, the heroine respects it at once and stays loving.",
    "The heroine is dangerous to the world, never to {{playerName}}. She never threatens, hurts, traps or controls him; her protectiveness and jealousy are playful and she backs off when he asks.",
    "Violence against others stays off-screen or brief and non-graphic; no gore, no torture, no glorified cruelty, and she never harms ordinary people over small slights — comic intimidation is her style with them.",
    "This is one continuous, player-led story with no predefined scenes, arcs, chapters, phases, milestones or ending. Never conclude the story or push it toward a fixed outcome.",
    "Never show numbers, percentages, meters or length of any kind in visible text.",
    "Gallery images are illustrative possibilities only and never establish events, feelings or decisions.",
]

COMMON_WORLD_RULES = [
    "Free-form story: the opening moment is the only predefined situation. Everything after it grows from the player's moves; there is no plot plan, scene list, arc or ending.",
    "Only {{playerName}} controls the player character: never invent his speech, actions, thoughts, feelings, consent, promises or decisions.",
    "Write in natural Roman-script Hinglish: short paragraphs, *actions and narration in asterisks*, dialogue as Name: \"...\".",
    "The heroine takes the romantic initiative often and warmly — teasing, cuddling, feeding him, forehead kisses, pulling him close — while always reading and respecting his response.",
    "Keep continuity of every promise, secret, nickname, gift and argument through the app's universal memory, scoped to this storyId only.",
]

COMMON_NEVER = [
    "Never store invented thoughts, feelings, words or actions for {{playerName}}.",
    "Never store narrator-only hidden truths as something {{playerName}} knows until he discovers them in play.",
    "Never store gallery images as events that happened.",
]

COMMON_HINTS = [
    "Remember every word {{playerName}} actually said and every boundary or wish he expressed, exactly as written.",
    "Track the heroine's feelings, jealousy, protectiveness and the specific moments that changed them.",
    "Remember nicknames, running jokes, places visited together, gifts, promises and who saw what.",
    "Track which secrets {{playerName}} has discovered and how; an inference is not a fact.",
]


LIST_FIELDS = ['goals', 'fears', 'likes', 'dislikes', 'knowledge']


def build(spec):
    sid = spec['id']
    # Bump a spec's "version" whenever a published package changes: devices
    # re-download a story only when its per-story version goes up.
    ver = spec.get('version', 1)
    d = os.path.join(REPO, 'content', 'stories', sid)
    os.makedirs(os.path.join(d, 'assets', 'gallery'), exist_ok=True)
    gallery = [{"id": "cover", "file": "assets/cover.jpg", "kind": "cover", "label": spec['title']}]
    for i, g in enumerate(spec['gallery'], 1):
        item = {"id": g['id'], "file": f"assets/gallery/image-{i:02d}.jpg", "kind": g['kind'], "label": g['label']}
        if g.get('characterId'):
            item['characterId'] = g['characterId']
        gallery.append(item)
    story = {
        "id": sid, "title": spec['title'], "description": spec['description'], "version": ver,
        "language": "hinglish", "ageRating": "18+", "contentLevel": "mature",
        "genres": spec['genres'], "tags": spec['tags'] + ["player-agency", "dynamic-continuous", "ongoing", "hinglish"],
        "userRole": spec['userRole'], "setting": spec['setting'], "openingSceneId": spec['opening']['id'],
        "tone": spec['tone'], "safetyNotes": COMMON_SAFETY + spec.get('safety', []), "endings": [],
        "creator": CREATOR, "media": {"cover": "assets/cover.jpg", "gallery": gallery},
    }
    # Every character needs these lists (the app reads them as arrays).
    characters = [{**c, **{k: [] for k in LIST_FIELDS if k not in c}} for c in spec['characters']]
    chars = {"storyId": sid, "version": ver, "playerVisualDesign": spec['playerVisual'], "characters": characters}
    world = {"storyId": sid, "version": ver, "premise": spec['premise'], "locations": spec['locations'],
             "factions": spec.get('factions', []), "lore": spec['lore'],
             "rules": COMMON_WORLD_RULES + spec.get('rules', []),
             "importantObjects": spec.get('objects', []), "timeline": spec.get('timeline', [])}
    scenes = {"storyId": sid, "version": ver, "scenes": [{
        "id": spec['opening']['id'], "title": spec['opening']['title'],
        "narration": spec['opening']['narration'], "fallbackLines": spec['opening']['fallback'],
        "choices": [{"id": c[0], "text": c[1], "shortLabel": c[2], "keywords": c[3], "next": None,
                     "effects": {"memory": [c[4]]}} for c in spec['opening']['choices']]}], "endings": []}
    memory = {"storyId": sid, "version": ver, "shortTermWindow": 24, "seedMemories": spec['seed'],
              "extractionHints": COMMON_HINTS + spec.get('hints', []), "neverRemember": COMMON_NEVER}
    for name, obj in [('story', story), ('characters', chars), ('world', world), ('scenes', scenes), ('memory', memory)]:
        with open(os.path.join(d, f'{name}.json'), 'w', encoding='utf-8') as f:
            json.dump(obj, f, ensure_ascii=False, indent=2)
            f.write('\n')
    entry = {
        "id": sid, "title": spec['title'], "tagline": spec['tagline'], "description": spec['description'],
        "genres": spec['genres'], "tags": story['tags'], "characters": [c['name'] for c in spec['characters']],
        "ageRating": "18+", "contentLevel": "mature", "language": "hinglish", "version": ver,
        "coverUrl": f"stories/{sid}/assets/cover.jpg", "accentColor": spec['accent'],
        "userRole": spec['userRole'], "setting": spec['setting'], "estimatedMinutes": 60, "featured": False, "isNew": True,
        "popularity": spec.get('popularity', 97), "storyDir": sid, "creator": CREATOR,
        "updatedAt": "2026-10-20T00:00:00Z",
    }
    mp = os.path.join(REPO, 'content', 'manifest.json')
    m = json.load(open(mp, encoding='utf-8'))
    m['stories'] = [s for s in m['stories'] if s['id'] != sid]
    m['stories'].insert(1, entry)
    m['updatedAt'] = "2026-10-20T00:00:00Z"
    with open(mp, 'w', encoding='utf-8') as f:
        json.dump(m, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print('built', sid)


if __name__ == '__main__':
    sys.path.insert(0, os.path.dirname(__file__))
    for mod in sys.argv[1:]:
        build(importlib.import_module(mod).SPEC)
