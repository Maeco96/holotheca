#!/usr/bin/env python3
"""Which marketplace link formats open a product page without a login. Prints the redirect chain."""
import http.client
import urllib.parse

UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")
URLS = [
    "https://www.cardmarket.com/it/Pokemon/Products?idProduct=483559",
    "https://www.cardmarket.com/it/Pokemon/Products?idProduct=483559&language=5",
    "https://www.cardmarket.com/it/Pokemon/Products/Singles?idProduct=483559",
    "https://www.cardmarket.com/it/Pokemon/Products/Search?searchString=Furret",
    "https://www.cardmarket.com/it/Pokemon/Products/Singles/Darkness-Ablaze/Furret-V1-DAA136",
    "https://www.cardmarket.com/it/Pokemon/Products/Singles/Darkness-Ablaze/Furret-V1-DAA136?language=5&minCondition=2",
    "https://www.cardtrader.com/",
    "https://www.cardtrader.com/it/search?q=Furret",
    "https://api.cardtrader.com/api/v2/info",
]


def follow(url, hops=6):
    for _ in range(hops):
        parts = urllib.parse.urlsplit(url)
        conn = http.client.HTTPSConnection(parts.netloc, timeout=30)
        path = parts.path + ("?" + parts.query if parts.query else "")
        conn.request("GET", path, headers={"User-Agent": UA, "Accept": "text/html", "Accept-Language": "it-IT,it",
                                            "Origin": "https://maeco96.github.io"})
        r = conn.getresponse()
        body = r.read(200000).decode("utf-8", "replace")
        title = body.split("<title>")[1].split("</title>")[0].strip()[:120] if "<title>" in body else ""
        print(f"  {r.status} {url}  title={title!r} acao={r.getheader('Access-Control-Allow-Origin')}")
        if r.status in (301, 302, 303, 307, 308) and r.getheader("Location"):
            url = urllib.parse.urljoin(url, r.getheader("Location"))
            continue
        return


for u in URLS:
    print(u)
    try:
        follow(u)
    except Exception as e:  # noqa: BLE001
        print("  ERROR", e)
