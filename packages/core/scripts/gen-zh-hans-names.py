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
    # Cities and regions outside China, Hong Kong, Macau and Taiwan whose Hong Kong transliteration differs from
    # the standard mainland name (read one by one; names I was unsure of are left to OpenCC).
    "南澳洲": "南澳大利亚",
    "西澳": "西澳大利亚",
    "喀比": "甲米",
    "狄臣港": "波德申",
    "史特拉斯堡": "斯特拉斯堡",
    "康城": "戛纳",
    "亞維農": "阿维尼翁",
    "卡卡頌": "卡尔卡松",
    "盧昂": "鲁昂",
    "狄莊": "第戎",
    "波本": "博讷",
    "蒙地卡羅": "蒙特卡洛",
    "馬斯垂克": "马斯特里赫特",
    "符茲堡": "维尔茨堡",
    "羅騰堡": "罗滕堡",
    "歌廷根": "哥廷根",
    "奧巴拉瑪高": "上阿默高",
    "因哥斯塔特": "英戈尔施塔特",
    "美瑙島": "迈瑙岛",
    "琉森": "卢塞恩",
    "伯恩": "伯尔尼",
    "茵特拉肯": "因特拉肯",
    "策馬特": "采尔马特",
    "盧加柏": "洛伊克巴德",
    "聖莫里茲": "圣莫里茨",
    "艾班諾士": "阿彭策尔",
    "賽永": "锡永",
    "英高柏": "恩格尔伯格",
    "華多茲": "瓦杜兹",
    "薩爾斯堡": "萨尔茨堡",
    "哈修塔特": "哈尔施塔特",
    "林茲": "林茨",
    "古姆洛夫": "克鲁姆洛夫",
    "皮爾森": "比尔森",
    "森檀德": "圣安德烈",
    "盧比安娜": "卢布尔雅那",
    "札格勒布": "萨格勒布",
    "杜邦力夫": "杜布罗夫尼克",
    "札達爾": "扎达尔",
    "普羅維斯": "普利特维采",
    "普洛第夫": "普罗夫迪夫",
    "賽薩羅尼奇": "塞萨洛尼基",
    "麥提奧拉": "迈泰奥拉",
    "佛羅倫斯": "佛罗伦萨",
    "拿坡里": "那不勒斯",
    "索倫多": "索伦托",
    "亞西西": "阿西西",
    "奧維渥特": "奥尔维耶托",
    "西恩納": "锡耶纳",
    "路加": "卢卡",
    "拉士碧芝": "拉斯佩齐亚",
    "帕多華": "帕多瓦",
    "利佛諾": "里窝那",
    "波札諾": "博尔扎诺",
    "史特雷薩": "斯特雷萨",
    "胡西庸": "鲁西永",
    "瓦倫索": "瓦朗索勒",
    "蒙頓": "芒通",
    "聖堤米里翁": "圣埃美隆",
    "卡恩": "卡昂",
    "安錫": "安纳西",
    "西米歐尼": "西尔苗内",
    "蒙地卡汀尼": "蒙特卡蒂尼",
    "蒙特納": "摩德纳",
    "阿格真圖": "阿格里真托",
    "巴塞隆拿": "巴塞罗那",
    "杜麗多": "托莱多",
    "哥多華": "科尔多瓦",
    "塞維爾": "塞维利亚",
    "格蘭納達": "格拉纳达",
    "薩拉哥莎": "萨拉戈萨",
    "畢爾包": "毕尔巴鄂",
    "潘普隆納": "潘普洛纳",
    "康修迦納": "孔苏埃格拉",
    "托雷美利斯": "托雷莫利诺斯",
    "塔拉哥納": "塔拉戈纳",
    "卡迪斯": "加的斯",
    "維哥": "维戈",
    "花地瑪": "法蒂玛",
    "歐比多斯": "奥比杜斯",
    "巴塔哈": "巴塔利亚",
    "印威內斯": "因弗内斯",
    "徹斯特": "切斯特",
    "修咸頓": "南安普敦",
    "高威": "戈尔韦",
    "雷克雅維克": "雷克雅未克",
    "羅凡尼米": "罗瓦涅米",
    "札科帕內": "扎科帕内",
    "伊斯坦堡": "伊斯坦布尔",
    "古薩達斯": "库沙达瑟",
    "康雅": "科尼亚",
    "凱色利": "开塞利",
    "特洛依": "特洛伊",
    "居里默": "格雷梅",
    "杜拜": "迪拜",
    "亞斯旺": "阿斯旺",
    "樂蜀": "卢克索",
    "艾德夫": "埃德富",
    "高寶安": "康翁波",
    "卡薩布蘭加": "卡萨布兰卡",
    "費斯": "非斯",
    "歐薩薩": "瓦尔扎扎特",
    "瑪特瑪它": "马特马塔",
    "普勒托利亞": "比勒陀利亚",
    "奈羅比": "内罗毕",
    "卡加利": "卡尔加里",
    "基隆那": "基洛纳",
    "甘露市": "坎卢普斯",
    "滿地可": "蒙特利尔",
    "千里達": "特立尼达",
    "瑪坦沙市": "马坦萨斯",
    "夏灣拿": "哈瓦那",
    "聖地牙哥": "圣地亚哥",
    "瑪瑙斯": "马瑙斯",
    "布里斯本": "布里斯班",
    "弗里曼特": "弗里曼特尔",
    "史提芬斯港": "斯蒂芬斯港",
    "朗賽斯頓": "朗塞斯顿",
    "威靈頓": "惠灵顿",
    "但尼丁": "达尼丁",
    "格雷矛斯": "格雷茅斯",
    "布倫亨": "布莱尼姆",
    "法蘭士約瑟夫": "弗朗茨约瑟夫",
    "塞倫蓋堤": "塞伦盖蒂",
    "亞格拉": "阿格拉",
    "華雷塔": "瓦莱塔",
    "蒙特維多": "蒙得维的亚",
    "史丹尼港": "斯坦利港",
    "溫荷克": "温得和克",
    "伊托夏": "埃托沙",
    "利溫斯頓": "利文斯顿",
    "淡武廊": "淡布隆",
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
