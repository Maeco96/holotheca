#!/usr/bin/env python3
"""Asks the official card sites what they serve, so a collector is only built on what is there.

Prints, for each URL: status, type, size, and either the text (robots.txt, terms) or the page
title and the links and image paths that look like card data. Runs from GitHub Actions because
these hosts are not reachable from every build environment.
"""
import re
import sys
import urllib.error
import urllib.request

UA = "Holotheca-catalogue-check/0.1 (+https://github.com/Maeco96/holotheca)"

URLS = [
    # Seventh pass: Pokémon Central set list and card page layout (article pages; its API is
    # closed to robots)
    "https://wiki.pokemoncentral.it/Fossil_(GCC)#context=/102",
    "https://wiki.pokemoncentral.it/Jigglypuff_(Jungle_54)#grep=media\\.pokemoncentral|Debolezza|og:image",
]
FIRST_PASS = [
    # Japan: official card search (The Pokémon Company)
    "https://www.pokemon-card.com/robots.txt",
    "https://www.pokemon-card.com/card-search/",
    "https://www.pokemon-card.com/card-search/resultAPI.php?keyword=%E3%83%94%E3%82%AB%E3%83%81%E3%83%A5%E3%82%A6&regulation_sidebar_form=all&pg=1",
    "https://www.pokemon-card.com/rules/",
    "https://www.pokemon.co.jp/rules/",
    # International: official card database (pokemon.com)
    "https://www.pokemon.com/robots.txt",
    "https://www.pokemon.com/it/gcc/archivio-carte/sm-series/sm2/140",
    "https://www.pokemon.com/it/gcc/archivio-carte/",
    "https://www.pokemon.com/it/termini-di-utilizzo",
    "https://www.pokemon.com/us/terms-of-use",
    "https://assets.pokemon.com/robots.txt",
    "https://assets.pokemon.com/assets/cms2-it-it/img/cards/web/SM2/SM2_IT_140.png",
    "https://assets.pokemon.com/assets/cms2-it-it/img/cards/web/BS/BS_IT_10.png",
    "https://assets.pokemon.com/assets/cms2/img/cards/web/BS/BS_EN_10.png",
    # Korea, Taiwan/Hong Kong: official card search
    "https://pokemoncard.co.kr/robots.txt",
    "https://pokemoncard.co.kr/cards",
    "https://asia.pokemon-card.com/robots.txt",
    "https://asia.pokemon-card.com/tw/card-search/",
    "https://asia.pokemon-card.com/hk/card-search/",
]

TEXT_KINDS = ("robots.txt",)


def fetch(url):
    headers = {"User-Agent": UA, "Accept-Language": "it,en;q=0.8,ja;q=0.6"}
    if "#referer=" in url:  # asks as an <img> on another site would: is hotlinking refused?
        url, ref = url.split("#referer=")
        headers["Referer"] = ref
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.headers.get("Content-Type", ""), r.geturl(), r.read(3_000_000)
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get("Content-Type", ""), url, e.read(20000)
    except Exception as e:  # noqa: BLE001 - report every failure, keep going
        return None, type(e).__name__ + ": " + str(e), url, b""


def show(url):
    grep = None
    context = None
    if "#context=" in url:
        url, context = url.split("#context=")
    if "#grep=" in url:
        url, grep = url.split("#grep=")
    raw = url.endswith("#raw")
    url = url.removesuffix("#raw")
    status, ctype, final, body = fetch(url)
    print(f"\n=== {url}\n  status {status}  type {ctype}  bytes {len(body)}" + (f"  -> {final}" if final != url else ""))
    if not body:
        return
    if raw and "json" in ctype:
        print(body.decode("utf-8", "replace")[:1500])
        return
    if url.endswith(TEXT_KINDS) or "json" in ctype or "text/plain" in ctype:
        print(body.decode("utf-8", "replace")[:12000])
        return
    if "html" not in ctype:
        return
    html = body.decode("utf-8", "replace")
    if context:
        for m in re.finditer(re.escape(context), html):
            print(html[max(0, m.start() - 1500): m.start() + 1500])
            print("  ----")
            break
        return
    if grep:
        for line in html.splitlines():
            if re.search(grep, line, re.I):
                print("  |", line.strip()[:400])
        return
    if raw:
        main = re.sub(r"<script.*?</script>|<style.*?</style>|<head.*?</head>", "", html, flags=re.S | re.I)
        main = re.sub(r"\n\s*\n+", "\n", main)
        print(main[:30000])
        return
    title = re.search(r"<title[^>]*>(.*?)</title>", html, re.S | re.I)
    print("  title:", (title.group(1).strip() if title else "-")[:200])
    imgs = sorted(set(re.findall(r"""["'(]([^"'()\s]*(?:card|Card)[^"'()\s]*\.(?:png|jpg|jpeg|webp))""", html)))
    print(f"  card-like images ({len(imgs)}):", *imgs[:25], sep="\n    ")
    links = sorted(set(re.findall(r"""href=["']([^"']*(?:card|carte|cards|search|api|terms|rules|termini)[^"']*)["']""", html, re.I)))
    print(f"  card-like links ({len(links)}):", *links[:60], sep="\n    ")
    if any(k in url for k in ("rules", "terms", "termini", "policy")):
        text = re.sub(r"<script.*?</script>|<style.*?</style>", " ", html, flags=re.S | re.I)
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"\s+", " ", text)
        for kw in ("scrap", "robot", "crawl", "automat", "spider", "copy", "reproduc", "複製", "転載", "自動", "riprod", "automatic"):
            for m in re.finditer(kw, text, re.I):
                print(f"  [{kw}] ...{text[max(0, m.start() - 300): m.start() + 300]}...")
                break


def main():
    for url in sys.argv[1:] or URLS:
        show(url)


if __name__ == "__main__":
    main()
