import cv2
import json
import time
import os
import threading
import queue
from ultralytics import YOLO
from datetime import datetime
from flask import Flask, Response, send_from_directory

app = Flask(__name__)

current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, ".."))
json_path = os.path.join(project_root, "data.json")
path_model = os.path.join(current_dir, "weights (3).pt") 
captures_dir = os.path.join(project_root, "captures")

if not os.path.exists(captures_dir):
    os.makedirs(captures_dir)

print("Memuat model YOLO...")
model = YOLO(path_model)
ODOL_CLASS_ID = 0
ODOL_THRESHOLD = 0.6

# --- VARIABEL GLOBAL (MEMISAHKAN KAMERA DAN AI) ---
shared_frame = None
shared_boxes = []
frame_lock = threading.Lock()
task_queue = queue.Queue()

# ========================================================
# PEKERJA 1: PENYIMPAN FILE (Mencegah Lag saat Save Foto)
# ========================================================
def worker_penyimpan():
    while True:
        task = task_queue.get()
        if task is None: break
            
        waktu_sekarang = datetime.now().strftime("%H:%M:%S")
        timestamp = int(task["start_time"])
        
        g_depan = f"capture_{timestamp}_depan.jpg"
        g_samping = f"capture_{timestamp}_samping.jpg"
        g_belakang = f"capture_{timestamp}_belakang.jpg"
        
        try:
            frames = task["frames"]
            if len(frames) > 0: cv2.imwrite(os.path.join(captures_dir, g_depan), frames[0])
            if len(frames) > 1: cv2.imwrite(os.path.join(captures_dir, g_samping), frames[1])
            if len(frames) > 2: cv2.imwrite(os.path.join(captures_dir, g_belakang), frames[2])
            
            try:
                list_foto = [f for f in os.listdir(captures_dir) if f.endswith('.jpg')]
                list_foto.sort()
                while len(list_foto) > 45:
                    os.remove(os.path.join(captures_dir, list_foto.pop(0))) 
            except:
                pass

            data_baru = {
                "waktu": waktu_sekarang,
                "nopol": "TERDETEKSI KAMERA",
                "jenis": "Truk Komersial",
                "warna": "Dalam Pengecekan", 
                "berat_ton": "-", 
                "dimensi": "Terukur Visual", 
                "kategori_pelanggaran": task["status_text"],
                "isViolation": task["isViolation"],
                "akurasi_yolo": f"{task['highest_conf'] * 100:.1f}%",
                "gambar": {
                    "depan": g_depan if len(frames) > 0 else "",
                    "samping": g_samping if len(frames) > 1 else "",
                    "belakang": g_belakang if len(frames) > 2 else ""
                }
            }
            
            try:
                with open(json_path, 'r') as file:
                    existing_data = json.load(file)
            except:
                existing_data = [] 
                
            existing_data.insert(0, data_baru)
            existing_data = existing_data[:15]
            
            with open(json_path, 'w') as file:
                json.dump(existing_data, file, indent=4)
                
        except Exception as e:
            print(f"⚠️ Gagal menyimpan data: {e}")
        finally:
            task_queue.task_done()

# ========================================================
# PEKERJA 2: PEMBACA KAMERA SUPER CEPAT
# ========================================================
def camera_reader():
    global shared_frame
    cap = cv2.VideoCapture(0) 
    # Ringankan beban kamera Raspberry Pi
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    
    while True:
        success, frame = cap.read()
        if success:
            with frame_lock:
                shared_frame = frame.copy()
        time.sleep(0.01) 

# ========================================================
# PEKERJA 3: AI YOLO & SESSION TRACKING (Background)
# ========================================================
def yolo_inference():
    global shared_frame, shared_boxes
    active_truck = None
    TIMEOUT_LEWAT = 2.5 

    while True:
        # 1. Ambil frame terbaru dengan aman
        with frame_lock:
            if shared_frame is None:
                continue
            frame_to_process = shared_frame.copy()

        # Dapatkan dimensi asli frame untuk mengonversi posisi kotak nantinya
        original_h, original_w = frame_to_process.shape[:2]

        # 2. Proses YOLO
        # NAIKKAN imgsz menjadi 640 untuk meningkatkan Confidence Score!
        results = model(frame_to_process, conf=0.5, iou=0.5, verbose=False, imgsz=640, device="cpu")
        
        is_truck_detected = False
        is_violation = False
        status_text = "Aman Sesuai Aturan"
        highest_conf = 0.0 
        current_boxes = []
        
        for box in results[0].boxes:
            cls_id = int(box.cls)
            conf = float(box.conf)
            
            # --- PERBAIKAN BOUNDING BOX MELENCENG ---
            # Jangan gunakan box.xyxy[0] langsung.
            # Gunakan box.xyxyn[0] (nilai rasio/persentase 0.0 - 1.0)
            norm_x1, norm_y1, norm_x2, norm_y2 = map(float, box.xyxyn[0])
            
            # Kalikan nilai rasio dengan ukuran lebar dan tinggi ASLI dari video
            x1 = int(norm_x1 * original_w)
            y1 = int(norm_y1 * original_h)
            x2 = int(norm_x2 * original_w)
            y2 = int(norm_y2 * original_h)

            is_truck_detected = True
            if conf > highest_conf: highest_conf = conf

            if cls_id == ODOL_CLASS_ID and conf >= ODOL_THRESHOLD:
                is_violation = True
                status_text = "ODOL (Dimensi & Muatan)"
                color = (0, 0, 255)
            else:
                color = (0, 255, 0) 
            
            # Simpan kotak deteksi yang SUDAH DIKONVERSI ke variabel global
            current_boxes.append({"coords": (x1, y1, x2, y2), "color": color, "conf": conf})

        # Update kotak global agar web bisa menggambarnya
        shared_boxes = current_boxes
        current_time = time.time()

        # 3. Logika Grouping (Session Tracking)
        if is_truck_detected:
            if active_truck is None:
                active_truck = {
                    "start_time": current_time,
                    "last_seen": current_time,
                    "frames": [frame_to_process.copy()],
                    "highest_conf": highest_conf,
                    "isViolation": is_violation,
                    "status_text": status_text
                }
            else:
                active_truck["last_seen"] = current_time
                if is_violation:
                    active_truck["isViolation"] = True
                    active_truck["status_text"] = status_text
                if highest_conf > active_truck["highest_conf"]:
                    active_truck["highest_conf"] = highest_conf
                
                if (current_time - active_truck["start_time"] > 1.0) and len(active_truck["frames"]) == 1:
                    active_truck["frames"].append(frame_to_process.copy())
                
                if (current_time - active_truck["start_time"] > 2.0) and len(active_truck["frames"]) == 2:
                    active_truck["frames"].append(frame_to_process.copy())

        if (active_truck is not None) and (current_time - active_truck["last_seen"] > TIMEOUT_LEWAT):
            task_queue.put(active_truck)
            active_truck = None 

        time.sleep(0.01) # Beri nafas untuk CPU

# --- JALANKAN SEMUA PEKERJA DI LATAR BELAKANG ---
threading.Thread(target=worker_penyimpan, daemon=True).start()
threading.Thread(target=camera_reader, daemon=True).start()
threading.Thread(target=yolo_inference, daemon=True).start()

# ========================================================
# PEKERJA 4: FLASK STREAMING (Langsung Kirim Gambar ke Web)
# ========================================================
def generate_frames():
    global shared_frame, shared_boxes
    
    while True:
        with frame_lock:
            if shared_frame is None:
                time.sleep(0.1)
                continue
            frame_to_stream = shared_frame.copy()

        # Gambar kotak deteksi terbaru (Web tidak perlu menunggu AI selesai mikir)
        for box in shared_boxes:
            x1, y1, x2, y2 = box["coords"]
            color = box["color"]
            conf = box["conf"]
            cv2.rectangle(frame_to_stream, (x1, y1), (x2, y2), color, 2)
            cv2.putText(frame_to_stream, f"{conf:.2f}", (x1, max(y1 - 10, 20)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

        try:
            ret, buffer = cv2.imencode('.jpg', frame_to_stream)
            if ret: yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
        except: pass
        
        # Atur Frame Rate (30 FPS)
        time.sleep(0.033)

@app.route('/video_feed')
def video_feed(): return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')
@app.route('/data.json')
def send_json_data():
    try:
        with open(json_path, 'r') as file: r = Response(file.read(), mimetype='application/json')
    except: r = Response("[]", mimetype='application/json')
    r.headers.add('Access-Control-Allow-Origin', '*')
    return r
@app.route('/captures/<filename>')
def serve_image(filename):
    r = send_from_directory(captures_dir, filename)
    r.headers.add('Access-Control-Allow-Origin', '*')
    return r
    
if __name__ == '__main__': 
    print("==========================================================")
    print("🚀 Server Aktif (Asynchronous Multithreading AI + Web)")
    print("==========================================================")
    app.run(host='0.0.0.0', port=5000, threaded=True, debug=False)