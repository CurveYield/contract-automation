#!/usr/bin/env python3
"""Build a Cloudflare Pages manifest without third-party dependencies.

The Pages asset hash is BLAKE3(base64(file_bytes) + extension_without_dot),
truncated to 32 hexadecimal characters. This script prints no asset contents.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import struct
from pathlib import Path
from typing import Iterable, Sequence

_MASK32 = 0xFFFFFFFF
_BLOCK_LEN = 64
_CHUNK_LEN = 1024
_CHUNK_START = 1
_CHUNK_END = 2
_PARENT = 4
_ROOT = 8
_IV = (
    0x6A09E667,
    0xBB67AE85,
    0x3C6EF372,
    0xA54FF53A,
    0x510E527F,
    0x9B05688C,
    0x1F83D9AB,
    0x5BE0CD19,
)
_MSG_PERMUTATION = (2, 6, 3, 10, 7, 0, 4, 13, 1, 11, 12, 5, 9, 14, 15, 8)


def _rotate_right(value: int, count: int) -> int:
    return ((value >> count) | (value << (32 - count))) & _MASK32


def _g(state: list[int], a: int, b: int, c: int, d: int, x: int, y: int) -> None:
    state[a] = (state[a] + state[b] + x) & _MASK32
    state[d] = _rotate_right(state[d] ^ state[a], 16)
    state[c] = (state[c] + state[d]) & _MASK32
    state[b] = _rotate_right(state[b] ^ state[c], 12)
    state[a] = (state[a] + state[b] + y) & _MASK32
    state[d] = _rotate_right(state[d] ^ state[a], 8)
    state[c] = (state[c] + state[d]) & _MASK32
    state[b] = _rotate_right(state[b] ^ state[c], 7)


def _round(state: list[int], message: Sequence[int]) -> None:
    _g(state, 0, 4, 8, 12, message[0], message[1])
    _g(state, 1, 5, 9, 13, message[2], message[3])
    _g(state, 2, 6, 10, 14, message[4], message[5])
    _g(state, 3, 7, 11, 15, message[6], message[7])
    _g(state, 0, 5, 10, 15, message[8], message[9])
    _g(state, 1, 6, 11, 12, message[10], message[11])
    _g(state, 2, 7, 8, 13, message[12], message[13])
    _g(state, 3, 4, 9, 14, message[14], message[15])


def _block_words(block: bytes) -> tuple[int, ...]:
    if len(block) > _BLOCK_LEN:
        raise ValueError("BLAKE3 block exceeds 64 bytes")
    return struct.unpack("<16I", block.ljust(_BLOCK_LEN, b"\x00"))


def _compress(
    chaining_value: Sequence[int],
    block_words: Sequence[int],
    counter: int,
    block_len: int,
    flags: int,
) -> tuple[int, ...]:
    state = list(chaining_value) + list(_IV[:4]) + [
        counter & _MASK32,
        (counter >> 32) & _MASK32,
        block_len,
        flags,
    ]
    message = list(block_words)
    for _ in range(7):
        _round(state, message)
        message = [message[index] for index in _MSG_PERMUTATION]
    return tuple((state[index] ^ state[index + 8]) & _MASK32 for index in range(8)) + tuple(
        (state[index + 8] ^ chaining_value[index]) & _MASK32 for index in range(8)
    )


class _Output:
    def __init__(
        self,
        input_chaining_value: Sequence[int],
        block_words: Sequence[int],
        counter: int,
        block_len: int,
        flags: int,
    ) -> None:
        self.input_chaining_value = tuple(input_chaining_value)
        self.block_words = tuple(block_words)
        self.counter = counter
        self.block_len = block_len
        self.flags = flags

    def chaining_value(self) -> tuple[int, ...]:
        return _compress(
            self.input_chaining_value,
            self.block_words,
            self.counter,
            self.block_len,
            self.flags,
        )[:8]

    def root_output_bytes(self, length: int) -> bytes:
        output = bytearray()
        output_block_counter = 0
        while len(output) < length:
            words = _compress(
                self.input_chaining_value,
                self.block_words,
                output_block_counter,
                self.block_len,
                self.flags | _ROOT,
            )
            output.extend(struct.pack("<16I", *words))
            output_block_counter += 1
        return bytes(output[:length])


class _ChunkState:
    def __init__(self, key_words: Sequence[int], chunk_counter: int, flags: int) -> None:
        self.chaining_value = tuple(key_words)
        self.chunk_counter = chunk_counter
        self.flags = flags
        self.block = bytearray()
        self.blocks_compressed = 0

    def length(self) -> int:
        return self.blocks_compressed * _BLOCK_LEN + len(self.block)

    def _start_flag(self) -> int:
        return _CHUNK_START if self.blocks_compressed == 0 else 0

    def update(self, data: bytes) -> None:
        view = memoryview(data)
        position = 0
        while position < len(view):
            if len(self.block) == _BLOCK_LEN:
                self.chaining_value = _compress(
                    self.chaining_value,
                    _block_words(bytes(self.block)),
                    self.chunk_counter,
                    _BLOCK_LEN,
                    self.flags | self._start_flag(),
                )[:8]
                self.blocks_compressed += 1
                self.block.clear()
            take = min(_BLOCK_LEN - len(self.block), len(view) - position)
            self.block.extend(view[position : position + take])
            position += take

    def output(self) -> _Output:
        return _Output(
            self.chaining_value,
            _block_words(bytes(self.block)),
            self.chunk_counter,
            len(self.block),
            self.flags | self._start_flag() | _CHUNK_END,
        )


def _parent_output(
    left_child: Sequence[int],
    right_child: Sequence[int],
    key_words: Sequence[int],
    flags: int,
) -> _Output:
    return _Output(key_words, tuple(left_child) + tuple(right_child), 0, _BLOCK_LEN, flags | _PARENT)


def blake3_digest(data: bytes, length: int = 32) -> bytes:
    """Return an unkeyed BLAKE3 digest using the standard hash mode."""
    key_words = _IV
    flags = 0
    chunk_state = _ChunkState(key_words, 0, flags)
    chaining_value_stack: list[tuple[int, ...]] = []
    position = 0

    while position < len(data):
        if chunk_state.length() == _CHUNK_LEN:
            new_chaining_value = chunk_state.output().chaining_value()
            total_chunks = chunk_state.chunk_counter + 1
            while total_chunks & 1 == 0:
                new_chaining_value = _parent_output(
                    chaining_value_stack.pop(),
                    new_chaining_value,
                    key_words,
                    flags,
                ).chaining_value()
                total_chunks >>= 1
            chaining_value_stack.append(new_chaining_value)
            chunk_state = _ChunkState(key_words, chunk_state.chunk_counter + 1, flags)

        take = min(_CHUNK_LEN - chunk_state.length(), len(data) - position)
        chunk_state.update(data[position : position + take])
        position += take

    output = chunk_state.output()
    while chaining_value_stack:
        output = _parent_output(
            chaining_value_stack.pop(),
            output.chaining_value(),
            key_words,
            flags,
        )
    return output.root_output_bytes(length)


def _official_vector_input(length: int) -> bytes:
    return bytes(index % 251 for index in range(length))


def _self_test() -> None:
    vectors = (
        (b"", "af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262"),
        (b"abc", "6437b3ac38465133ffb63b75273a8db548c558465d79db03fd359c6cd5bd9d85"),
        (
            _official_vector_input(1023),
            "10108970eeda3eb932baac1428c7a2163b0e924c9a9e25b35bba72b28f70bd11",
        ),
        (
            _official_vector_input(1024),
            "42214739f095a406f3fc83deb889744ac00df831c10daa55189b5d121c855af7",
        ),
        (
            _official_vector_input(1025),
            "d00278ae47eb27b34faecf67b4fe263f82d5412916c1ffd97c8cb7fb814b844",
        ),
    )
    for payload, expected in vectors:
        actual = blake3_digest(payload).hex()
        if actual != expected:
            raise RuntimeError("dependency-free BLAKE3 self-test failed")


def _regular_files(root: Path) -> Iterable[Path]:
    for path in sorted(root.rglob("*"), key=lambda candidate: candidate.as_posix()):
        if path.is_symlink():
            raise ValueError(f"symbolic links are not allowed: {path.relative_to(root).as_posix()}")
        if path.is_file():
            yield path


def _pages_hash(path: Path, content: bytes) -> str:
    extension = path.suffix.lstrip(".")
    encoded = base64.b64encode(content).decode("ascii")
    return blake3_digest((encoded + extension).encode("utf-8")).hex()[:32]


def _write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True) + "\n",
        encoding="utf-8",
    )


def build_manifest(root: Path) -> tuple[dict[str, str], list[str], dict[str, object]]:
    if not root.is_dir():
        raise ValueError("asset root is not a directory")

    manifest: dict[str, str] = {}
    metadata_files: list[dict[str, object]] = []
    for path in _regular_files(root):
        relative = path.relative_to(root).as_posix()
        content = path.read_bytes()
        pages_hash = _pages_hash(path, content)
        manifest[f"/{relative}"] = pages_hash
        metadata_files.append(
            {
                "path": relative,
                "size": len(content),
                "sha256": hashlib.sha256(content).hexdigest(),
                "pagesHash": pages_hash,
            }
        )

    if not manifest:
        raise ValueError("asset root contains no regular files")
    hashes = sorted(set(manifest.values()))
    metadata: dict[str, object] = {
        "schemaVersion": "cloudflare-pages-asset-metadata-v1",
        "fileCount": len(metadata_files),
        "uniqueHashCount": len(hashes),
        "files": metadata_files,
    }
    return manifest, hashes, metadata


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--hashes", required=True, type=Path)
    parser.add_argument("--metadata", required=True, type=Path)
    arguments = parser.parse_args()

    _self_test()
    manifest, hashes, metadata = build_manifest(arguments.root)
    _write_json(arguments.manifest, manifest)
    _write_json(arguments.hashes, hashes)
    _write_json(arguments.metadata, metadata)
    print(f"pages asset manifest generated for {metadata['fileCount']} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
