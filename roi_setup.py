# roi_setup.py : ROI 한 번 지정해서 config.json에 저장
import json, time
import numpy as np
import cv2, mss, pygetwindow as gw
from pathlib import Path

CONFIG = Path("config.json")
WINDOW_TITLE = "메이플"  # 게임 창 제목의 일부

def find_window_rect(keyword):
    for t in gw.getAllTitles():
        if keyword.lower() in t.lower():
            w = gw.getWindowsWithTitle(t)[0]
            if w.isMinimized: w.restore()
            time.sleep(0.2)
            return (w.left, w.top, w.width, w.height)
    return None

def grab_window_image(rect):
    left, top, width, height = rect
    with mss.mss() as sct:
        mon = {"left": left, "top": top, "width": width, "height": height}
        img = np.array(sct.grab(mon))[:, :, :3]  # BGR
    return img

def main():
    rect = find_window_rect(WINDOW_TITLE)
    if not rect:
        print("대상 창을 못 찾았어요. 창 제목 키워드를 확인하세요."); return
    img = grab_window_image(rect)
    disp = img.copy()
    cv2.putText(disp, "Drag to select QUESTION area, Enter=OK, c=Cancel",
                (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,255,255), 2, cv2.LINE_AA)

    # OpenCV 내장 ROI 선택기 (드래그로 박스 지정)
    roi = cv2.selectROI("Select ROI", disp, showCrosshair=True, fromCenter=False)
    cv2.destroyAllWindows()
    x, y, w, h = map(int, roi)
    if w <= 0 or h <= 0:
        print("ROI가 지정되지 않았습니다."); return

    # 비율 저장(창 크기 변화 대응)
    _, _, W, H = rect
    rx, ry, rw, rh = x/W, y/H, w/W, h/H

    cfg = {
        "windowTitleKeyword": WINDOW_TITLE,
        "roi_px": [x, y, w, h],
        "roi_ratio": [rx, ry, rw, rh],
        "use_ratio": True  # True면 매 프레임 현재 창 크기로 환산
    }
    CONFIG.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
    print("저장 완료: config.json")

if __name__ == "__main__":
    main()
