"""Contact sheet of stills — labels go ABOVE each thumbnail (repo rule)."""
import sys

from PIL import Image, ImageDraw, ImageFont

FONT = '/home/user/ankitstorychat/docs/promo/ad2/fonts/Poppins_600SemiBold.ttf'


def build(paths, out, cols=5):
    thumbs = [Image.open(p).convert('RGB').resize((300, 533), Image.LANCZOS) for p in paths]
    rows = (len(thumbs) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * 316 + 16, rows * 580 + 16), (10, 11, 16))
    d = ImageDraw.Draw(sheet)
    f = ImageFont.truetype(FONT, 15)
    for i, th in enumerate(thumbs):
        x = 16 + (i % cols) * 316
        y = 16 + (i // cols) * 580
        label = paths[i].split('_')[-1].replace('.jpg', '')
        d.text((x, y), f'{i + 1} · {label}s', font=f, fill=(200, 202, 212))
        sheet.paste(th, (x, y + 24))
    sheet.save(out, quality=90)
    print('sheet', out, sheet.size)


if __name__ == '__main__':
    build(sys.argv[2:], sys.argv[1])
