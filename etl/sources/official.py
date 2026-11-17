#!/usr/bin/env python3
"""Collects card facts from the official Pokémon card sites, to fill and check the TCGdex catalogue.

Only facts are kept: official id, set code, printed number, name, and the address of the
official image. Images are not downloaded: the app loads them from the official site, whose
terms allow personal use and forbid redistributing copies.

Sources (all run by The Pokémon Company or its regional licensees):
  ja  www.pokemon-card.com        JSON list + one detail page per card
  ko  pokemoncard.co.kr           list pages + one detail page per card
  zh-tw asia.pokemon-card.com/tw  list per expansion + one detail page per card

The output is one JSON file per source, {official id: record}. A run resumes from the file it
finds, asks only for cards it does not know yet, and stops cleanly at --budget minutes, so a
large site is collected over several runs.

Usage:
  python3 etl/sources/official.py ja --out etl/sources/data/ja.json [--budget 300] [--rate 1.5]
"""
import argparse
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

UA = "Holotheca-catalogue/0.1 (+https://github.com/Maeco96/holotheca; personal collection app)"


class Client:
    """Polite HTTP: one request at a time, at most `rate` per second, retries on 429/5xx."""

    def __init__(self, rate):
        self.gap = 1.0 / rate
        self.last = 0.0
        self.requests = 0

    def get(self, url, referer=None, form=None):
        for attempt in range(5):
            wait = self.last + self.gap - time.monotonic()
            if wait > 0:
                time.sleep(wait)
            self.last = time.monotonic()
            self.requests += 1
            headers = {"User-Agent": UA, "Accept-Language": "ja,ko,zh-TW;q=0.8,en;q=0.5"}
            if referer:
                headers["Referer"] = referer
            try:
                data = None
                if form is not None:
                    data = urllib.parse.urlencode(form).encode()
                    headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8"
                    headers["X-Requested-With"] = "XMLHttpRequest"
                with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=headers), timeout=40) as r:
                    return r.read().decode("utf-8", "replace")
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    return None
                if e.code not in (429, 500, 502, 503, 504):
                    raise
            except (urllib.error.URLError, TimeoutError, ConnectionError):
                pass
            time.sleep(5 * 2**attempt)
        raise RuntimeError(f"giving up on {url}")


def text(fragment):
    return html.unescape(re.sub(r"<[^>]+>", " ", fragment)).replace("　", " ").strip()


def number_of(raw):
    """'001 / 038' -> ('001', '038'); 'SV-P 123' -> ('123', None)."""
    m = re.search(r"([A-Za-z]*\d+[A-Za-z]?)\s*/\s*([A-Za-z]*\d+)", raw)
    if m:
        return m.group(1), m.group(2)
    m = re.search(r"(\d{1,4})", raw)
    return (m.group(1), None) if m else (None, None)


# --- Japan -----------------------------------------------------------------------------------

JA = "https://www.pokemon-card.com"


def ja_list(client, log, max_pages=None):
    """Every card id with its image path. The page parameter is `page` (`pg` is a product filter)."""
    first = json.loads(client.get(f"{JA}/card-search/resultAPI.php?keyword=&regulation_sidebar_form=all&page=1"))
    pages = int(first["maxPage"])
    if max_pages:
        pages = min(pages, max_pages)
    log(f"ja: {first['hitCnt']} cards on {pages} pages")
    seen = {}
    for page in range(1, pages + 1):
        data = first if page == 1 else json.loads(client.get(f"{JA}/card-search/resultAPI.php?keyword=&regulation_sidebar_form=all&page={page}"))
        if int(data.get("thisPage", page)) != page:
            raise RuntimeError(f"ja: asked page {page}, got {data.get('thisPage')}: the paging parameter changed")
        for c in data.get("cardList") or []:
            seen[str(c["cardID"])] = {"image": JA + c["cardThumbFile"], "name": html.unescape(c.get("cardNameViewText") or "")}
    return seen


def ja_detail(client, card_id):
    page = client.get(f"{JA}/card-search/details.php/card/{card_id}/regu/all")
    if page is None:
        return None
    rec = {"url": f"{JA}/card-search/details.php/card/{card_id}/regu/all"}
    m = re.search(r'<h1 class="Heading1[^"]*">(.*?)</h1>', page, re.S)
    rec["name"] = text(m.group(1)) if m else None
    m = re.search(r'<div class="subtext[^"]*">(.*?)</div>', page, re.S)
    if m:
        block = m.group(1)
        mark = re.search(r'regulation_logo_\d+/([^"./]+)\.', block)
        rec["mark"] = mark.group(1) if mark else None
        rec["number"], rec["total"] = number_of(text(block))
    m = re.search(r'card_images/large/([^/]+)/', page)
    rec["set"] = m.group(1) if m else None
    m = re.search(r'<div class="author">.*?<a[^>]*>(.*?)</a>', page, re.S)
    rec["illustrator"] = text(m.group(1)) if m else None
    m = re.search(r'<span class="hp-num">(\d+)</span>', page)
    rec["hp"] = int(m.group(1)) if m else None
    products = re.findall(r'<li class="List_item"><a [^>]*>(.*?)</a>', page, re.S)
    rec["products"] = [text(p) for p in products]
    return rec


# --- Korea -----------------------------------------------------------------------------------

KO = "https://pokemoncard.co.kr"


def ko_list(client, log, max_pages=None):
    """The card page loads more cards with a POST ("get_more_cards"), one tab per card kind:
    1 Pokémon, 2 Trainers, 3 Energy. `limit` is the offset the server hands back each time."""
    seen = {}
    front = client.get(f"{KO}/cards") or ""
    for i in re.findall(r'/cards/detail/([A-Za-z0-9]+)"', front):
        seen.setdefault(i, {})
    # the sort the page sends by default, and the offset after the cards already on the page
    opt = re.search(r'<option[^>]*data-order="([^"]*)"[^>]*data-orderby="([^"]*)"', front) or \
        re.search(r'<option[^>]*data-orderby="([^"]*)"[^>]*data-order="([^"]*)"', front)
    order, orderby = (opt.group(1), opt.group(2)) if opt else ("", "")
    if opt and "data-orderby" in opt.group(0)[: opt.group(0).find("data-order=")]:
        order, orderby = orderby, order
    lim = re.search(r'name="limit"[^>]*value="(\d+)"', front) or re.search(r'value="(\d+)"[^>]*name="limit"', front)
    start = int(lim.group(1)) if lim else len(seen)
    log(f"ko: {len(seen)} cards on the page, sort {order!r}/{orderby!r}, next offset {start}")
    for kind in (1, 2, 3):
        offset, pages = (start if kind == 1 else 0), 0
        # The Pokémon tab filters on HP and retreat ranges ("HP >= x AND HP <= y"); the page keeps the
        # maximums in hidden inputs (hp 380, retreat 5). The range format is not documented, so the
        # first one the server accepts is kept.
        ranges = [("", "")] if kind != 1 else [("0,380", "0,5"), ("0;380", "0;5"), ("0-380", "0-5"), ("380", "5")]
        hp_range, retreat_range = ranges[0]
        while True:
            def ask(hp, retreat):
                return client.get(f"{KO}/v2/ajax2_dev2", referer=f"{KO}/cards", form={
                    "action": "get_more_cards", "limit": offset, "GoodsName": "", "CardTypeNum": kind,
                    "CardType": "", "CardMonType": "", "Weakness": "", "Resistance": "", "TechErg": "",
                    "ability_label1": "", "hp": hp, "retreat": retreat, "order": order, "orderby": orderby,
                })
            body = ask(hp_range, retreat_range)
            if pages == 0 and len(ranges) > 1:
                for hp_range, retreat_range in ranges:
                    body = ask(hp_range, retreat_range)
                    try:
                        if int(json.loads(body or "{}").get("count") or 0) > 0:
                            log(f"ko: Pokémon tab accepts hp={hp_range!r} retreat={retreat_range!r}")
                            break
                    except json.JSONDecodeError:
                        pass
                    log(f"ko: hp={hp_range!r} retreat={retreat_range!r} gave {(body or '')[:160]!r}")
            try:
                data = json.loads(body or "{}")
            except json.JSONDecodeError:
                raise RuntimeError(f"ko: the load-more answer is not JSON: {(body or '')[:200]!r}")
            rows = data.get("result") or []
            if isinstance(rows, dict):  # the server sends an object keyed by position
                rows = list(rows.values())
            rows = [r for r in rows if isinstance(r, dict) and r.get("CardNum")]
            if not rows or int(data.get("count") or 0) == 0:
                if pages == 0:
                    log(f"ko: kind {kind} answered {(body or '')[:300]!r}")
                break
            for r in rows:
                seen.setdefault(str(r["CardNum"]), {"kind": kind})
            new_offset = int(data.get("limit") or 0)
            pages += 1
            if new_offset <= offset or (max_pages and pages >= max_pages):
                break
            offset = new_offset
            if pages % 50 == 0:
                log(f"ko: kind {kind}, {pages} pages, {len(seen)} cards")
        log(f"ko: kind {kind} done after {pages} pages, {len(seen)} cards so far")
    return seen


def ko_detail(client, card_id):
    page = client.get(f"{KO}/cards/detail/{card_id}")
    if page is None:
        return None
    rec = {"url": f"{KO}/cards/detail/{card_id}"}
    m = re.search(r'<img src="(/public-assets/[^"?]+wmimages/[^"?]+)\?[^"]*" class="feature_image"', page)
    rec["image"] = KO + m.group(1) if m else None
    m = re.search(r'wmimages/[^/]+/([^/]+)/', rec["image"] or "")
    rec["set"] = m.group(1) if m else None
    m = re.search(r'<span class="p_num">(.*?)<span', page, re.S)
    rec["number"], rec["total"] = number_of(text(m.group(1))) if m else (None, None)
    m = re.search(r'<span class="card-hp title">(.*?)</span>', page, re.S)
    rec["name"] = text(m.group(1)) if m else None
    m = re.search(r'<span class="hp_num">HP(\d+)</span>', page)
    rec["hp"] = int(m.group(1)) if m else None
    return rec


# --- Taiwan ----------------------------------------------------------------------------------

TW = "https://asia.pokemon-card.com/tw"


def tw_list(client, log, max_pages=None):
    front = client.get(f"{TW}/card-search/")
    codes = sorted(set(re.findall(r"expansionCodes=([A-Za-z0-9.\-]+)", front or "")))
    log(f"tw: {len(codes)} expansions on the search page")
    seen = {}
    for code in codes[: max_pages or None]:
        page = 1
        while True:
            body = client.get(f"{TW}/card-search/list/?pageNo={page}&expansionCodes={urllib.parse.quote(code)}")
            ids = re.findall(r"/tw/card-search/detail/(\d+)/", body or "")
            new = [i for i in dict.fromkeys(ids) if i not in seen]
            if not new or (max_pages and page > max_pages):
                break
            for i in new:
                seen[i] = {"expansion": code}
            page += 1
    log(f"tw: {len(seen)} cards")
    return seen


def tw_detail(client, card_id):
    page = client.get(f"{TW}/card-search/detail/{card_id}/")
    if page is None:
        return None
    rec = {"url": f"{TW}/card-search/detail/{card_id}/"}
    m = re.search(r'<img src="(https://asia\.pokemon-card\.com/tw/card-img/tw\d+\.png)"', page)
    rec["image"] = m.group(1) if m else None
    m = re.search(r'<h1 class="pageHeader cardDetail">(.*?)</h1>', page, re.S)
    if m:
        # the heading holds the stage ("基礎", "1階進化", ...) before the name
        full = re.sub(r"\s+", " ", text(m.group(1)))
        stage = re.match(r"^(基礎|\S*進化|復原|TAG TEAM|V-UNION|物品|支援者|競技場|寶可夢道具|基本能量|特殊能量)\s+", full)
        rec["stage"] = stage.group(1) if stage else None
        rec["name"] = full[stage.end():] if stage else full
    m = re.search(r'<section class="expansionColumn">(.*?)</section>', page, re.S)
    if m:
        block = m.group(1)
        mark = re.search(r"twhk_([A-Za-z0-9.\-]+)_exp\.png", block)
        rec["set"] = mark.group(1) if mark else None
        rec["number"], rec["total"] = number_of(text(block))
    return rec


SOURCES = {"ja": (ja_list, ja_detail), "ko": (ko_list, ko_detail), "zh-tw": (tw_list, tw_detail)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("source", choices=SOURCES)
    ap.add_argument("--out", required=True)
    ap.add_argument("--budget", type=float, default=300, help="minutes; stops cleanly after this")
    ap.add_argument("--rate", type=float, default=1.5, help="requests per second")
    ap.add_argument("--limit", type=int, help="ask at most this many detail pages (smoke test)")
    ap.add_argument("--max-pages", type=int, help="read at most this many list pages (smoke test)")
    ap.add_argument("--only-set", action="append", default=[], help="collect details only for these image folders (ja)")
    args = ap.parse_args()

    deadline = time.monotonic() + args.budget * 60
    log = lambda m: print(m, flush=True)  # noqa: E731
    client = Client(args.rate)
    lister, detailer = SOURCES[args.source]

    known = {}
    if os.path.exists(args.out):
        with open(args.out, encoding="utf-8") as f:
            known = json.load(f)
    listed = lister(client, log, args.max_pages)

    # newest cards first: they are the ones TCGdex is most likely to lack
    todo = sorted((i for i in listed if i not in known or not known[i].get("number")), key=lambda i: (len(i), i), reverse=True)
    if args.only_set:
        wanted = set(args.only_set)
        todo = [i for i in todo if re.search(r"/large/([^/]+)/", listed[i].get("image", "")) and re.search(r"/large/([^/]+)/", listed[i]["image"]).group(1) in wanted]
    if args.limit:
        todo = todo[: args.limit]
    log(f"{args.source}: {len(listed)} listed, {len(known)} known, {len(todo)} to ask, "
        f"about {len(todo) / args.rate / 60:.0f} minutes at {args.rate}/s (budget {args.budget:.0f})")

    def save():
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        tmp = args.out + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(dict(sorted(known.items(), key=lambda kv: (len(kv[0]), kv[0]))), f, ensure_ascii=False, indent=0)
        os.replace(tmp, args.out)

    done = 0
    for card_id in todo:
        if time.monotonic() > deadline:
            log(f"{args.source}: time budget reached, {len(todo) - done} left for the next run")
            break
        rec = detailer(client, card_id)
        if rec is not None:
            merged = {**listed[card_id], **{k: v for k, v in rec.items() if v not in (None, [], "")}}
            merged.setdefault("set", merged.get("expansion"))
            known[card_id] = merged
        done += 1
        if done % 500 == 0:
            save()
            log(f"{args.source}: {done}/{len(todo)}")
    save()
    log(f"{args.source}: {len(known)} cards saved, {client.requests} requests")
    left = len([i for i in listed if i not in known])
    print(f"::notice::{args.source}: {len(known)} cards collected, {left} still to ask")
    return 0


if __name__ == "__main__":
    sys.exit(main())
