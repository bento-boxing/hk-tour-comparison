#!/usr/bin/env python3
"""
Writes src/places/names.zh-Hans.json: every Traditional place name in src/places/data.json (each country,
region and city nameZh, and every alias) mapped to its Simplified Chinese form, for the zh-Hans website.

Run by hand after changing data.json, from packages/core:

    python3 scripts/gen-zh-hans-names.py

Offline and with no package to install: it calls the system OpenCC library (libopencc, Debian/Ubuntu package
libopencc1.1 with libopencc-data) through ctypes, using the hk2s configuration (Hong Kong Traditional to
Simplified). OpenCC converts characters and common phrases; the few names below where mainland usage differs
from the Hong Kong name in more than characters are given by hand and win over OpenCC.
"""

import ctypes
import ctypes.util
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
DATA = HERE.parent / 'src' / 'places' / 'data.json'
OUT = HERE.parent / 'src' / 'places' / 'names.zh-Hans.json'
CONFIG = b'/usr/share/opencc/hk2s.json'

# Hong Kong name -> the name a mainland reader expects (not a character swap). Checked by hand.
OVERRIDES = {
    '紐西蘭': '新西兰',
    '澳洲': '澳大利亚',
    '烏茲別克': '乌兹别克斯坦',
    '哈薩克': '哈萨克斯坦',
    '吉爾吉斯': '吉尔吉斯斯坦',
    '汶萊': '文莱',
    '巴布亞新畿內亞': '巴布亚新几内亚',
    '峇里島': '巴厘岛',
    '峇里': '巴厘',
    '塔斯曼尼亞': '塔斯马尼亚',
    '布吉': '普吉',
    '布吉島': '普吉岛',
    '三藩市': '旧金山',
}


def opencc():
    path = ctypes.util.find_library('opencc') or 'libopencc.so.1.1'
    lib = ctypes.CDLL(path)
    lib.opencc_open.restype = ctypes.c_void_p
    lib.opencc_open.argtypes = [ctypes.c_char_p]
    lib.opencc_convert_utf8.restype = ctypes.c_void_p
    lib.opencc_convert_utf8.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_size_t]
    lib.opencc_convert_utf8_free.argtypes = [ctypes.c_void_p]
    handle = lib.opencc_open(CONFIG)
    if not handle or handle == ctypes.c_void_p(-1).value:
        sys.exit(f'could not open OpenCC configuration {CONFIG.decode()}')

    def convert(text: str) -> str:
        raw = text.encode('utf-8')
        out = lib.opencc_convert_utf8(handle, raw, len(raw))
        try:
            return ctypes.string_at(out).decode('utf-8')
        finally:
            lib.opencc_convert_utf8_free(out)

    return convert


def main() -> None:
    data = json.loads(DATA.read_text('utf-8'))
    names = sorted({name for kind in ('countries', 'regions', 'cities') for place in data[kind]
                    for name in [place['nameZh'], *place['aliases']]})
    convert = opencc()
    result = {name: OVERRIDES.get(name) or convert(name) for name in names}
    lines = [f'  {json.dumps(k, ensure_ascii=False)}: {json.dumps(v, ensure_ascii=False)}' for k, v in result.items()]
    OUT.write_text('{\n' + ',\n'.join(lines) + '\n}\n', 'utf-8')
    changed = sum(1 for k, v in result.items() if k != v)
    print(f'{OUT.name}: {len(result)} names, {changed} differ in Simplified')


if __name__ == '__main__':
    main()
