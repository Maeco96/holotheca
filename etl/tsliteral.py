"""Minimal parser for the TypeScript object literals used by tcgdex/cards-database.

Each data file looks like:

    import { Card } from '../../../interfaces'
    import Set from '../Jungle'

    const card: Card = {
        name: { en: "Wigglytuff", it: "Wigglytuff" },
        set: Set,
        hp: 80,
        types: ["Colorless",],
    }
    export default card

`parse_declaration` returns the value of the first `const x: T = <value>` as plain
Python data: dict, list, str, int, float, bool, None (string literals joined with `+` are merged). A bare identifier used as a value
(for example `set: Set`) becomes an `Ident` instance. Anything after the value is ignored.
Standard library only.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

_TOKEN = re.compile(
    r"""
      (?P<ws>\s+|//[^\n]*|/\*.*?\*/)
    | (?P<str>"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)
    | (?P<num>-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)
    | (?P<id>[A-Za-z_$][\w$]*)
    | (?P<p>[{}\[\],:()<>=;.+*/!?|&-])
    """,
    re.X | re.S,
)

_ESCAPES = {"n": "\n", "t": "\t", "r": "\r", "b": "\b", "f": "\f", "v": "\v", "0": "\0"}
_ESCAPE = re.compile(r"\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)", re.S)


class ParseError(ValueError):
    pass


@dataclass(frozen=True)
class Ident:
    name: str


def _unescape(body: str) -> str:
    def repl(match: re.Match) -> str:
        code = match.group(1)
        if code[0] in "ux" and len(code) > 1:
            return chr(int(code[1:], 16))
        return _ESCAPES.get(code, code)

    return _ESCAPE.sub(repl, body) if "\\" in body else body


def _tokens(source: str) -> list[tuple[str, str]]:
    tokens = []
    pos = 0
    end = len(source)
    while pos < end:
        match = _TOKEN.match(source, pos)
        if not match:
            raise ParseError(f"unexpected character {source[pos]!r} at offset {pos}")
        pos = match.end()
        kind = match.lastgroup
        if kind == "ws":
            continue
        text = match.group()
        if kind == "str":
            text = _unescape(text[1:-1])
        tokens.append((kind, text))
    return tokens


class _Parser:
    def __init__(self, tokens: list[tuple[str, str]], start: int):
        self.tokens = tokens
        self.pos = start

    def peek(self) -> tuple[str, str] | None:
        return self.tokens[self.pos] if self.pos < len(self.tokens) else None

    def take(self) -> tuple[str, str]:
        token = self.peek()
        if token is None:
            raise ParseError("unexpected end of input")
        self.pos += 1
        return token

    def expect(self, text: str) -> None:
        kind, value = self.take()
        if kind != "p" or value != text:
            raise ParseError(f"expected {text!r}, found {value!r}")

    def value(self):
        kind, text = self.take()
        if kind == "str":
            # Adjacent string literals joined with `+` are concatenated.
            while self.peek() == ("p", "+"):
                self.pos += 1
                next_kind, next_text = self.take()
                if next_kind != "str":
                    raise ParseError("only string literals can be concatenated")
                text += next_text
            return text
        if kind == "num":
            return float(text) if any(c in text for c in ".eE") else int(text)
        if kind == "id":
            if text == "true":
                return True
            if text == "false":
                return False
            if text in ("null", "undefined"):
                return None
            return Ident(text)
        if text == "{":
            return self.obj()
        if text == "[":
            return self.array()
        raise ParseError(f"unexpected token {text!r}")

    def obj(self) -> dict:
        result: dict = {}
        while True:
            token = self.peek()
            if token is None:
                raise ParseError("unterminated object")
            if token == ("p", "}"):
                self.pos += 1
                return result
            if token == ("p", ","):
                self.pos += 1
                continue
            kind, key = self.take()
            if kind not in ("str", "id", "num"):
                raise ParseError(f"bad object key {key!r}")
            self.expect(":")
            result[key] = self.value()

    def array(self) -> list:
        result: list = []
        while True:
            token = self.peek()
            if token is None:
                raise ParseError("unterminated array")
            if token == ("p", "]"):
                self.pos += 1
                return result
            if token == ("p", ","):
                self.pos += 1
                continue
            result.append(self.value())


def parse_declaration(source: str):
    """Return the value assigned in the first `const name[: Type] = value` of a data file."""
    tokens = _tokens(source)
    for index, (kind, text) in enumerate(tokens):
        if kind == "id" and text == "const":
            for j in range(index + 1, len(tokens)):
                if tokens[j] == ("p", "="):
                    return _Parser(tokens, j + 1).value()
            break
    raise ParseError("no `const x = ...` declaration found")
