# roi_runtime_snippet.py : 런타임에서 현재 창 크기에 맞춰 ROI 계산
import json, time
import numpy as np
import cv2, mss, pygetwindow as gw

def load_cfg(path="config.json"):
    with open(path, encoding="utf-8") as f:
        return json.load(f)

def find_window_rect(keyword):
    for t in gw.getAllTitles():
        if keyword.lower() in t.lower():
            w = gw.getWindowsWithTitle(t)[0]
            if w.isMinimized: w.restore()
            time.sleep(0.15)
            return (w.left, w.top, w.width, w.height)
    return None

def resolve_roi(rect, cfg):
    left, top, W, H = rect
    if cfg.get("use_ratio", True):
        rx, ry, rw, rh = cfg["roi_ratio"]
        x, y, w, h = int(rx*W), int(ry*H), int(rw*W), int(rh*H)
    else:
        x, y, w, h = cfg["roi_px"]
    return (left + x, top + y, w, h)  # 화면 기준 좌표

def capture_roi(abs_roi):
    l, t, w, h = abs_roi
    with mss.mss() as sct:
        mon = {"left": l, "top": t, "width": w, "height": h}
        img = np.array(sct.grab(mon))[:, :, :3]
    return img

if __name__ == "__main__":
    cfg = load_cfg()
    while True:
        rect = find_window_rect(cfg["windowTitleKeyword"])
        if not rect:
            print("창을 찾는 중..."); time.sleep(0.5); continue
        abs_roi = resolve_roi(rect, cfg)
        img = capture_roi(abs_roi)
        # 여기서 전처리→OCR→사전조회→입력 로직으로 연결
        cv2.imshow("ROI Live", img)
        if cv2.waitKey(1) == 27: break
    cv2.destroyAllWindows()
